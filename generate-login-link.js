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

async function generate() {
  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: 'info@genesysvoyage.com',
    options: {
      redirectTo: 'http://localhost:3000/settings?tab=chatbot'
    }
  });

  if (error) {
    console.error("Error generating link:", error);
  } else {
    console.log("Success! Login URL:", data.properties.action_link);
  }
}

generate();
