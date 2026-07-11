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

async function update() {
  const workspaceId = '0384aa61-25ad-440f-9a43-603f9779cde4'; // Genesys Voyage
  
  console.log(`Updating chatbot_config for workspace ${workspaceId} to use Groq...`);
  
  const { data, error } = await supabase
    .from('chatbot_config')
    .update({
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      is_enabled: true
    })
    .eq('workspace_id', workspaceId)
    .select();

  if (error) {
    console.error("Error updating configuration:", error);
  } else {
    console.log("Success! Chatbot updated successfully:", data);
  }
}

update();
