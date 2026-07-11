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

async function listUsers() {
  const { data: profiles, error } = await supabase.from('profiles').select('id, email, full_name');
  if (error) {
    console.error("Error listing profiles:", error);
  } else {
    console.log("Profiles in DB:", profiles);
  }
}

listUsers();
