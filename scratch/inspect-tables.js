const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing URL or Service Role Key in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key);

async function inspect() {
  // Query all tables in public schema
  const { data, error } = await supabase.rpc('get_tables');
  if (error) {
    console.error("Error with custom rpc get_tables:", error.message);
    
    // Let's try executing a raw SQL if there is an exec SQL RPC, or let's try reading a table we know
    console.log("Attempting to query table_to_xml to list tables...");
    const { data: tableData, error: tableError } = await supabase
      .from('deals')
      .select('*')
      .limit(1);
    if (tableError) {
      console.error("Error querying deals:", tableError);
    } else {
      console.log("Deals table exists, data:", tableData);
    }
  } else {
    console.log("Tables list:", data);
  }
}

inspect();
