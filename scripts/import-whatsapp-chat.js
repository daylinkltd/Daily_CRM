const fs = require('fs');
const path = require('path');
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

const filePath = args.file;
const phone = args.phone;
const workspaceId = args.workspace;
const customerSender = args.customerSender || args['customer-sender'];
const agentSender = args.agentSender || args['agent-sender'];

if (!filePath || !phone || !workspaceId || !customerSender || !agentSender) {
  console.log(`
Usage:
  node scripts/import-whatsapp-chat.js \\
    --file="path/to/chat.txt" \\
    --phone="+1234567890" \\
    --workspace="workspace-uuid" \\
    --customer-sender="Customer Name in Chat" \\
    --agent-sender="Agent/Business Name in Chat"

Example:
  node scripts/import-whatsapp-chat.js \\
    --file="WhatsApp Chat.txt" \\
    --phone="+15551234567" \\
    --workspace="946e73b7-5fae-4065-8b74-7cab342111e5" \\
    --customer-sender="Balwinder Kaur USA Meditation & Charas addiction" \\
    --agent-sender="Genesys Voyage"
  `);
  process.exit(1);
}

// Check if file exists
if (!fs.existsSync(filePath)) {
  console.error(`Error: File not found at ${filePath}`);
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

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// WhatsApp parser logic
function parseDate(dateStr, timeStr) {
  const [monthStr, dayStr, yearStr] = dateStr.split('/');
  let year = parseInt(yearStr);
  if (year < 100) year += 2000;

  // Clean thin spaces and non-breaking spaces
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

function parseWhatsAppChat(text) {
  const lines = text.split(/\r?\n/);
  const messages = [];
  let currentMsg = null;

  // bracketed (iOS): [6/8/26, 5:19:00 PM] Sender: Message
  const bracketRegex = /^\[(\d{1,2}\/\d{1,2}\/\d{2,4}),\s*(\d{1,2}:\d{2}(?::\d{2})?[\u202F\s]*[AP]M)\]\s*(.*)$/i;

  // standard (Android): 6/8/26, 5:19 PM - Sender: Message
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
          console.error('Failed to parse date:', dateStr, timeStr, e.message);
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

async function run() {
  console.log(`Loading chat file: ${filePath}`);
  const fileContent = fs.readFileSync(filePath, 'utf8');

  console.log('Parsing messages...');
  const rawParsed = parseWhatsAppChat(fileContent);
  console.log(`Parsed ${rawParsed.length} raw messages from file.`);

  // Filter messages by mapped senders
  const filtered = rawParsed.filter(m => {
    return m.sender === customerSender || m.sender === agentSender;
  });

  console.log(`Found ${filtered.length} messages matching mapped senders.`);
  if (filtered.length === 0) {
    console.error('Error: No messages matched the specified customerSender or agentSender.');
    console.log('Unique senders in chat file:');
    const senders = new Set(rawParsed.map(m => m.sender));
    senders.forEach(s => console.log(` - "${s}"`));
    process.exit(1);
  }

  // 1. Verify workspace exists
  console.log(`Verifying workspace ${workspaceId}...`);
  console.log(`workspaceId raw value: ${JSON.stringify(workspaceId)}`);
  const { data: workspace, error: wsErr } = await supabase
    .from('workspaces')
    .select('id, name')
    .eq('id', workspaceId)
    .single();

  if (wsErr || !workspace) {
    console.error('Workspace verification failed:', wsErr || 'Workspace not found');
    process.exit(1);
  }
  console.log(`Workspace verified: "${workspace.name}"`);

  // 2. Fetch or create contact
  console.log(`Checking contact with phone "${phone}" in workspace...`);
  let { data: contact, error: contactErr } = await supabase
    .from('contacts')
    .select('*')
    .eq('phone', phone)
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (contactErr) {
    console.error('Failed to fetch contact:', contactErr);
    process.exit(1);
  }

  if (!contact) {
    console.log(`Contact not found. Creating new contact for "${customerSender}"...`);
    
    // Find the first user in the workspace to assign contact's user_id
    const { data: members, error: memErr } = await supabase
      .from('workspace_members')
      .select('user_id')
      .eq('workspace_id', workspaceId)
      .limit(1);

    if (memErr || !members || members.length === 0) {
      console.error('Failed to find user in workspace to assign contact to:', memErr);
      process.exit(1);
    }
    const userId = members[0].user_id;

    const { data: newContact, error: createContactErr } = await supabase
      .from('contacts')
      .insert({
        workspace_id: workspaceId,
        user_id: userId,
        phone: phone,
        name: customerSender
      })
      .select('*')
      .single();

    if (createContactErr || !newContact) {
      console.error('Failed to create contact:', createContactErr);
      process.exit(1);
    }

    contact = newContact;
    console.log(`Contact created successfully with ID: ${contact.id}`);
  } else {
    console.log(`Contact found: "${contact.name}" (ID: ${contact.id})`);
  }

  // 3. Find or create conversation
  console.log('Checking conversation for contact...');
  let { data: conversation, error: convErr } = await supabase
    .from('conversations')
    .select('*')
    .eq('contact_id', contact.id)
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (convErr) {
    console.error('Failed to fetch conversation:', convErr);
    process.exit(1);
  }

  if (!conversation) {
    console.log('Conversation not found. Creating a new conversation...');
    const { data: newConv, error: createConvErr } = await supabase
      .from('conversations')
      .insert({
        workspace_id: workspaceId,
        user_id: contact.user_id,
        contact_id: contact.id,
        status: 'open',
        unread_count: 0
      })
      .select('*')
      .single();

    if (createConvErr || !newConv) {
      console.error('Failed to create conversation:', createConvErr);
      process.exit(1);
    }

    conversation = newConv;
    console.log(`Conversation created successfully with ID: ${conversation.id}`);
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

  // 4. Ingest messages
  console.log(`Ingesting ${filtered.length} messages...`);
  let imported = 0;
  const chunkSize = 50;

  for (let i = 0; i < filtered.length; i += chunkSize) {
    const chunk = filtered.slice(i, i + chunkSize);
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
          const workspaceSubdir = sanitizeName(workspace.name);
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

    const { error: insertErr } = await supabase
      .from('messages')
      .insert(rows);

    if (insertErr) {
      console.error(`Error inserting chunk starting at index ${i}:`, insertErr);
      console.log('Trying individual inserts for this chunk...');
      for (const row of rows) {
        const { error: singleErr } = await supabase.from('messages').insert(row);
        if (singleErr) {
          console.error(`Failed to insert message at ${row.created_at}:`, singleErr.message);
        } else {
          imported++;
        }
      }
    } else {
      imported += rows.length;
    }
  }

  console.log(`Successfully imported ${imported} out of ${filtered.length} messages.`);

  // 5. Update conversation status/preview
  if (filtered.length > 0) {
    const lastMsg = filtered[filtered.length - 1];
    console.log('Updating conversation preview with last message details...');
    const { error: updateConvErr } = await supabase
      .from('conversations')
      .update({
        last_message_text: lastMsg.text || '',
        last_message_at: lastMsg.timestamp.toISOString()
      })
      .eq('id', conversation.id);

    if (updateConvErr) {
      console.error('Failed to update conversation preview details:', updateConvErr);
    } else {
      console.log('Conversation details updated successfully.');
    }
  }

  console.log('\nImport completed successfully!');
}

run().catch(console.error);
