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

const supabase = createClient(url, key, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

async function run() {
  console.log("----------------------------------------");
  console.log("Searching user by email: info@genesysvoyage.com");
  
  // 1. Fetch user from auth.users (requires service_role bypass)
  const { data: users, error: userError } = await supabase.auth.admin.listUsers();
  if (userError) {
    console.error("Error listing users:", userError);
    return;
  }

  const targetUser = users.users.find(u => u.email?.toLowerCase() === 'info@genesysvoyage.com');
  if (!targetUser) {
    console.log("User 'info@genesysvoyage.com' not found in database.");
    console.log("----------------------------------------");
    return;
  }

  console.log(`Found User:`);
  console.log(`- ID: ${targetUser.id}`);
  console.log(`- Email: ${targetUser.email}`);
  console.log(`- Created At: ${targetUser.created_at}`);

  // 2. Fetch workspace memberships for this user
  console.log("----------------------------------------");
  console.log("Checking workspace memberships...");
  const { data: members, error: memberError } = await supabase
    .from('workspace_members')
    .select('workspace_id, role, workspaces(name)')
    .eq('user_id', targetUser.id);

  if (memberError) {
    console.error("Error fetching workspace memberships:", memberError);
  } else if (!members || members.length === 0) {
    console.log("No workspace memberships found for this user.");
  } else {
    for (const m of members) {
      console.log(`- Workspace ID: ${m.workspace_id}`);
      console.log(`  Name: ${m.workspaces?.name || 'N/A'}`);
      console.log(`  Role: ${m.role}`);

      // 3. Check whatsapp_config for this workspace
      const { data: waConfigs, error: waError } = await supabase
        .from('whatsapp_config')
        .select('*')
        .eq('workspace_id', m.workspace_id);

      if (waError) {
        console.error(`  Error fetching whatsapp_config for workspace ${m.workspace_id}:`, waError);
      } else if (!waConfigs || waConfigs.length === 0) {
        console.log("  No WhatsApp configuration found for this workspace.");
      } else {
        console.log(`  WhatsApp Configurations (${waConfigs.length} found):`);
        for (const config of waConfigs) {
          console.log(`  - ID: ${config.id}`);
          console.log(`    Phone Number ID: ${config.phone_number_id || 'N/A'}`);
          console.log(`    WABA ID: ${config.waba_id || 'N/A'}`);
          console.log(`    Status: ${config.status}`);
          console.log(`    Connected At: ${config.connected_at || 'N/A'}`);
          console.log(`    Provider: ${config.provider || 'meta'}`);
        }
      }
    }
  }
  console.log("----------------------------------------");
}

run();
