const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env.local
dotenv.config({ path: path.join(__dirname, '.env.local') });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing URL or Service Role Key in .env.local");
  process.exit(1);
}

console.log("Connecting to:", url);
const supabase = createClient(url, key);

async function check() {
  console.log("----------------------------------------");
  console.log("Checking chatbot_config...");
  const { data, error } = await supabase.from('chatbot_config').select('*').limit(1);
  if (error) {
    console.error("Error querying chatbot_config:", error);
  } else {
    console.log("chatbot_config exists! Sample row:", data);
  }

  console.log("----------------------------------------");
  console.log("Checking member_presence...");
  const { data: presenceData, error: presenceError } = await supabase.from('member_presence').select('*').limit(1);
  if (presenceError) {
    console.error("Error querying member_presence:", presenceError);
  } else {
    console.log("member_presence exists! Sample row:", presenceData);
  }
  console.log("----------------------------------------");
}

check();
