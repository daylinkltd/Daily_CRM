const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { createClient } = require('@supabase/supabase-js');

// Parse CLI arguments
const args = {};
process.argv.slice(2).forEach(arg => {
  if (arg.startsWith('--')) {
    const parts = arg.split('=');
    const key = parts[0].substring(2);
    let value = parts.slice(1).join('=');
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.substring(1, value.length - 1);
    }
    args[key] = value;
  }
});

const scanDir = args.dir;
const workspaceId = args.workspace;
const agentSender = args.agentSender || args['agent-sender'] || 'Genesys Voyage';

if (!scanDir || !workspaceId) {
  console.log(`
Batch Importer Usage:
  node scripts/batch-import-chats.js \\
    --dir="path/to/chats/folder" \\
    --workspace="workspace-uuid" \\
    --agent-sender="Genesys Voyage"

Example:
  node scripts/batch-import-chats.js \\
    --dir="D:\\New folder (2)\\Daily_CRM" \\
    --workspace="0384aa61-25ad-440f-9a43-603f9779cde4"
  `);
  process.exit(1);
}

if (!fs.existsSync(scanDir)) {
  console.error(`Error: Directory not found at ${scanDir}`);
  process.exit(1);
}

// Load environment variables from .env.local
const envPath = path.join(__dirname, '..', '.env.local');
if (!fs.existsSync(envPath)) {
  console.error('Error: .env.local not found in project root');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split(/\r?\n/).forEach(line => {
  const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)$/);
  if (match) {
    const key = match[1].trim();
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.substring(1, val.length - 1);
    } else if (val.startsWith("'") && val.endsWith("'")) {
      val = val.substring(1, val.length - 1);
    }
    envVars[key] = val;
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Find all WhatsApp chat text files recursively
function getChatFiles(dir, filesList = []) {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (item !== 'node_modules' && item !== '.next' && item !== '.git') {
        getChatFiles(fullPath, filesList);
      }
    } else if (stat.isFile() && item.startsWith('WhatsApp Chat with') && item.endsWith('.txt')) {
      filesList.push(fullPath);
    }
  }
  return filesList;
}

// Extract contact name from filename
function extractContactName(filePath) {
  const filename = path.basename(filePath);
  // Matches "WhatsApp Chat with " followed by the name up to ".txt"
  const match = filename.match(/^WhatsApp Chat with (.*?)\.txt$/i);
  return match ? match[1].trim() : null;
}

// WhatsApp date parsing
function parseDate(dateStr, timeStr) {
  const [monthStr, dayStr, yearStr] = dateStr.split('/');
  let year = parseInt(yearStr);
  if (year < 100) year += 2000;

  const cleanTime = timeStr.replace(/[\u202F\u00A0\s]+/g, ' ').trim();
  const parts = cleanTime.split(' ');
  const timePart = parts[0];
  const ampm = parts[1];

  const timeComponents = timePart.split(':');
  let hour = parseInt(timeComponents[0]);
  const minute = parseInt(timeComponents[1]);
  const second = timeComponents[2] ? parseInt(timeComponents[2]) : 0;

  if (ampm && ampm.toUpperCase() === 'PM' && hour < 12) hour += 12;
  if (ampm && ampm.toUpperCase() === 'AM' && hour === 12) hour = 0;

  return new Date(year, parseInt(monthStr) - 1, parseInt(dayStr), hour, minute, second);
}

// Parse WhatsApp chat text
function parseWhatsAppChat(text) {
  const lines = text.split(/\r?\n/);
  const messages = [];
  let currentMsg = null;

  const bracketRegex = /^\[(\d{1,2}\/\d{1,2}\/\d{2,4}),\s*(\d{1,2}:\d{2}(?::\d{2})?[\u202F\s]*[AP]M)\]\s*(.*)$/i;
  const standardRegex = /^(\d{1,2}\/\d{1,2}\/\d{2,4}),\s*(\d{1,2}:\d{2}(?::\d{2})?[\u202F\s]*[AP]M)\s*-\s*(.*)$/i;

  for (const line of lines) {
    const bracketMatch = line.match(bracketRegex);
    const standardMatch = line.match(standardRegex);
    const match = bracketMatch || standardMatch;

    if (match) {
      if (currentMsg) {
        messages.push(currentMsg);
        currentMsg = null;
      }
      const dateStr = match[1];
      const timeStr = match[2];
      const rest = match[3];

      const senderMatch = rest.match(/^([^:]+):\s*(.*)$/);
      if (senderMatch) {
        const sender = senderMatch[1].trim();
        const textContent = senderMatch[2].trim();
        try {
          const timestamp = parseDate(dateStr, timeStr);
          currentMsg = { timestamp, sender, text: textContent };
        } catch (e) {
          // ignore parsing error line
        }
      }
    } else if (currentMsg) {
      currentMsg.text += '\n' + line;
    }
  }

  if (currentMsg) {
    messages.push(currentMsg);
  }
  return messages;
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const askQuestion = (query) => new Promise((resolve) => rl.question(query, resolve));

let workspaceName = '';

async function importSingleChat(filePath, contactName, phoneNum, userId) {
  console.log(`\n--------------------------------------------------`);
  console.log(`Starting import for: "${contactName}" (${phoneNum})`);
  
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const rawParsed = parseWhatsAppChat(fileContent);
  
  const customerSender = contactName;
  const filtered = rawParsed.filter(m => m.sender === customerSender || m.sender === agentSender);
  
  if (filtered.length === 0) {
    console.warn(`⚠️ Warning: No messages matched senders "${customerSender}" or "${agentSender}".`);
    console.log('Unique senders found in file:');
    const uniqueSenders = [...new Set(rawParsed.map(m => m.sender))];
    uniqueSenders.forEach(s => console.log(` - "${s}"`));
    
    // Auto-fallback: if there are only 2 unique senders, and one is agentSender, assign the other as customer!
    const nonAgentSenders = uniqueSenders.filter(s => s !== agentSender);
    if (nonAgentSenders.length === 1) {
      const fallbackCustomer = nonAgentSenders[0];
      console.log(`Found only one other sender: "${fallbackCustomer}". Using this as customer.`);
      return importSingleChatWithMappedSenders(filePath, fallbackCustomer, phoneNum, userId);
    }
    
    console.log('Skipping file.');
    return false;
  }

  return importSingleChatWithMappedSenders(filePath, customerSender, phoneNum, userId, filtered);
}

async function importSingleChatWithMappedSenders(filePath, customerSender, phoneNum, userId, preFiltered = null) {
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const messages = preFiltered || parseWhatsAppChat(fileContent).filter(m => m.sender === customerSender || m.sender === agentSender);

  // 1. Fetch or create contact
  let { data: contact, error: contactErr } = await supabase
    .from('contacts')
    .select('*')
    .eq('phone', phoneNum)
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (contactErr) {
    console.error('Failed to query contact:', contactErr);
    return false;
  }

  if (!contact) {
    console.log(`Creating new contact "${customerSender}" with phone ${phoneNum}...`);
    const { data: newContact, error: createErr } = await supabase
      .from('contacts')
      .insert({
        workspace_id: workspaceId,
        user_id: userId,
        phone: phoneNum,
        name: customerSender
      })
      .select('*')
      .single();

    if (createErr || !newContact) {
      console.error('Failed to create contact:', createErr);
      return false;
    }
    contact = newContact;
  }

  // 2. Fetch or create conversation
  let { data: conversation, error: convErr } = await supabase
    .from('conversations')
    .select('*')
    .eq('contact_id', contact.id)
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (convErr) {
    console.error('Failed to query conversation:', convErr);
    return false;
  }

  if (!conversation) {
    console.log('Creating new conversation...');
    const { data: newConv, error: createConvErr } = await supabase
      .from('conversations')
      .insert({
        workspace_id: workspaceId,
        user_id: userId,
        contact_id: contact.id,
        status: 'open',
        unread_count: 0
      })
      .select('*')
      .single();

    if (createConvErr || !newConv) {
      console.error('Failed to create conversation:', createConvErr);
      return false;
    }
    conversation = newConv;
  } else {
    console.log(`Conversation found (ID: ${conversation.id})`);
    console.log('Clearing existing messages in this conversation to prevent duplicates...');
    const { error: clearErr } = await supabase
      .from('messages')
      .delete()
      .eq('conversation_id', conversation.id);
    if (clearErr) {
      console.warn('Warning: Could not clear existing messages:', clearErr.message);
    }
  }

  // 3. Insert messages
  console.log(`Ingesting ${messages.length} messages...`);
  let imported = 0;
  const chunkSize = 50;

  for (let i = 0; i < messages.length; i += chunkSize) {
    const chunk = messages.slice(i, i + chunkSize);
    const rows = chunk.map(m => {
      const lines = m.text.split('\n');
      const firstLine = lines[0];
      const isMedia = firstLine.match(/^(.*?)\s*\(file attached\)$/i);
      let contentType = 'text';
      let mediaUrl = null;
      let contentText = m.text;

      if (isMedia) {
        const filename = isMedia[1].trim();
        const ext = path.extname(filename).toLowerCase();
        if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) {
          contentType = 'image';
        } else if (['.mp4', '.mov', '.avi', '.mkv'].includes(ext)) {
          contentType = 'video';
        } else if (['.mp3', '.wav', '.ogg', '.m4a', '.aac'].includes(ext)) {
          contentType = 'audio';
        } else {
          contentType = 'document';
        }

        // Try to locate file in the same directory as the chat file
        const chatDir = path.dirname(filePath);
        const sourceFilePath = path.join(chatDir, filename);

        if (fs.existsSync(sourceFilePath)) {
          const sanitizeName = (name) => name.replace(/[^a-zA-Z0-9 _-]/g, '').trim();
          const workspaceSubdir = sanitizeName(workspaceName);
          const contactSubdir = sanitizeName(contact.name || customerSender);
          
          const destDir = path.join(__dirname, '..', 'public', 'uploads', workspaceSubdir, contactSubdir);
          fs.mkdirSync(destDir, { recursive: true });
          
          const destFilePath = path.join(destDir, filename);
          try {
            fs.copyFileSync(sourceFilePath, destFilePath);
            mediaUrl = `/uploads/${workspaceSubdir}/${contactSubdir}/${filename}`;
            contentText = lines.slice(1).join('\n').trim() || filename;
            console.log(`Copied media attachment: ${filename}`);
          } catch (copyErr) {
            console.error(`Failed to copy file ${filename}:`, copyErr.message);
          }
        } else {
          console.warn(`⚠️ Warning: Media file "${filename}" referenced in chat but not found in folder.`);
        }
      }

      return {
        conversation_id: conversation.id,
        sender_type: m.sender === customerSender ? 'customer' : 'agent',
        content_type: contentType,
        content_text: contentText || ' ',
        media_url: mediaUrl,
        status: 'read',
        created_at: m.timestamp.toISOString()
      };
    });

    const { error: insertErr } = await supabase.from('messages').insert(rows);
    if (insertErr) {
      // Individual fallback
      for (const row of rows) {
        const { error: singleErr } = await supabase.from('messages').insert(row);
        if (!singleErr) imported++;
      }
    } else {
      imported += rows.length;
    }
  }

  console.log(`Success: Imported ${imported} messages.`);

  // 4. Update conversation preview
  if (messages.length > 0) {
    const lastMsg = messages[messages.length - 1];
    await supabase
      .from('conversations')
      .update({
        last_message_text: lastMsg.text || '',
        last_message_at: lastMsg.timestamp.toISOString()
      })
      .eq('id', conversation.id);
  }

  return true;
}

async function main() {
  console.log('Scanning for WhatsApp chat files...');
  const chatFiles = getChatFiles(scanDir);
  console.log(`Found ${chatFiles.length} WhatsApp chat files.`);

  if (chatFiles.length === 0) {
    console.log('No chat files starting with "WhatsApp Chat with" and ending in ".txt" were found.');
    process.exit(0);
  }

  // Verify workspace & get a user ID to assign contact ownership
  const { data: workspace, error: wsErr } = await supabase
    .from('workspaces')
    .select('name')
    .eq('id', workspaceId)
    .single();

  if (wsErr || !workspace) {
    console.error('Workspace verification failed. Verify the workspace UUID.');
    process.exit(1);
  }
  workspaceName = workspace.name;

  const { data: members, error: memErr } = await supabase
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', workspaceId)
    .limit(1);

  if (memErr || !members || members.length === 0) {
    console.error('No members found in workspace.');
    process.exit(1);
  }
  const defaultUserId = members[0].user_id;

  console.log(`Target Workspace: "${workspace.name}"`);
  console.log('==================================================');

  for (let i = 0; i < chatFiles.length; i++) {
    const filePath = chatFiles[i];
    const contactName = extractContactName(filePath);
    if (!contactName) continue;

    console.log(`\n[${i + 1}/${chatFiles.length}] File: ${path.basename(filePath)}`);

    // Try to find the contact by name in the database
    const { data: existingContacts, error: searchErr } = await supabase
      .from('contacts')
      .select('name, phone')
      .eq('workspace_id', workspaceId)
      .ilike('name', `%${contactName}%`);

    let phoneNum = null;

    if (!searchErr && existingContacts && existingContacts.length > 0) {
      // Direct or partial name match found
      if (existingContacts.length === 1) {
        phoneNum = existingContacts[0].phone;
        console.log(`Found match in CRM: "${existingContacts[0].name}" (${phoneNum})`);
      } else {
        console.log(`Multiple matching contacts found in CRM:`);
        existingContacts.forEach((c, idx) => console.log(`  ${idx + 1}. ${c.name} (${c.phone})`));
        const selection = await askQuestion(`Select contact number (1-${existingContacts.length}) or enter a custom phone, or press enter to skip: `);
        const selIdx = parseInt(selection) - 1;
        if (selIdx >= 0 && selIdx < existingContacts.length) {
          phoneNum = existingContacts[selIdx].phone;
        } else if (selection.trim()) {
          phoneNum = selection.trim();
        }
      }
    }

    // If no match found or skipped, ask for phone number
    if (!phoneNum) {
      // Check if the contact name itself is a clean phone number
      const cleanName = contactName.replace(/[+\s()-]/g, '');
      if (/^\d{8,15}$/.test(cleanName)) {
        phoneNum = contactName;
        console.log(`Contact name matches a phone number layout. Using: ${phoneNum}`);
      } else {
        const answer = await askQuestion(`No contact found for "${contactName}".\n👉 Please enter their phone number to import (or press Enter to skip this file): `);
        if (answer.trim()) {
          phoneNum = answer.trim();
        } else {
          console.log(`Skipping file.`);
          continue;
        }
      }
    }

    // Run the import
    try {
      await importSingleChat(filePath, contactName, phoneNum, defaultUserId);
    } catch (err) {
      console.error(`Failed to import chat for ${contactName}:`, err.message);
    }
  }

  console.log('\n==================================================');
  console.log('Batch import completed!');
  rl.close();
}

main().catch(err => {
  console.error(err);
  rl.close();
});
