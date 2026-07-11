const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env.local') });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing URL or Service Role Key in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key);

async function run() {
  console.log("----------------------------------------");
  console.log("Checking recent messages in database...");
  
  const { data: messages, error } = await supabase
    .from('messages')
    .select('id, sender_type, content_text, created_at, conversations(contact_id, contacts(name, phone))')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error("Error fetching recent messages:", error);
    return;
  }

  if (!messages || messages.length === 0) {
    console.log("No messages found in the database.");
  } else {
    console.log(`Last 5 messages found:`);
    for (const msg of messages) {
      console.log(`- Time: ${msg.created_at}`);
      console.log(`  Sender: ${msg.sender_type}`);
      console.log(`  Content: "${msg.content_text}"`);
      console.log(`  Contact Name: ${msg.conversations?.contacts?.name || 'N/A'}`);
      console.log(`  Contact Phone: ${msg.conversations?.contacts?.phone || 'N/A'}`);
    }
  }
  console.log("----------------------------------------");
}

run();
