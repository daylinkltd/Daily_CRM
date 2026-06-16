const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Parse .env.local
const envPath = path.join(__dirname, '..', '.env.local');
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
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('Fetching workspaces...');
  const { data: workspaces, error: wsError } = await supabase
    .from('workspaces')
    .select('id, name, created_at');

  if (wsError) {
    console.error('Error fetching workspaces:', wsError);
    return;
  }

  console.log('\nTesting direct lookup of workspace 946e73b7-5fae-4065-8b74-7cab342111e5...');
  const testRes = await supabase.from('workspaces').select('id, name').eq('id', '946e73b7-5fae-4065-8b74-7cab342111e5');
  console.log('Test result:', JSON.stringify(testRes));

  console.log('\nWorkspaces:');
  console.log('=========================================');
  workspaces.forEach(w => {
    console.log(`ID:   ${w.id}`);
    console.log(`Name: ${w.name}`);
    console.log('-----------------------------------------');
  });

  console.log('\nFetching recent contacts (up to 10)...');
  const { data: contacts, error: cError } = await supabase
    .from('contacts')
    .select('id, name, phone, workspace_id')
    .order('created_at', { ascending: false })
    .limit(10);

  if (cError) {
    console.error('Error fetching contacts:', cError);
    return;
  }

  console.log('\nRecent Contacts:');
  console.log('=========================================');
  contacts.forEach(c => {
    console.log(`ID:           ${c.id}`);
    console.log(`Name:         ${c.name}`);
    console.log(`Phone:        ${c.phone}`);
    console.log(`Workspace ID: ${c.workspace_id}`);
    console.log('-----------------------------------------');
  });
}

main().catch(console.error);
