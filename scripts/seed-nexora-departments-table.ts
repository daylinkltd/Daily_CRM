import { createAdminClient } from '../src/lib/supabase/admin';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const RAW_DEPARTMENTS = [
  { code: 'D001', name: 'HR & Administration', location: 'Corporate Office', head: 'Amit Kulkarni' },
  { code: 'D002', name: 'Accounts & Finance', location: 'Corporate Office', head: 'Sneha Patil' },
  { code: 'D003', name: 'Projects & Construction', location: 'Construction Division', head: 'Rahul Desai' },
  { code: 'D004', name: 'RMC & Concrete', location: 'Concrete Plant', head: 'Vikram Naik' },
  { code: 'D005', name: 'Operations & Logistics', location: 'Operations', head: 'Kiran More' },
  { code: 'D006', name: 'Sales & Business Development', location: 'Corporate Office', head: 'Neha Shah' },
  { code: 'D007', name: 'Plant & Production', location: 'Concrete Plant', head: 'Suresh Patil' },
  { code: 'D008', name: 'Procurement & Stores', location: 'Corporate Office', head: 'Meera Kulkarni' }
];

async function run() {
  const admin = createAdminClient();
  const workspaceId = 'e4cca776-684e-48c2-b93d-d4f4c34e443b';

  console.log('Seeding departments into workspace:', workspaceId);

  let successCount = 0;

  for (const dept of RAW_DEPARTMENTS) {
    const descriptionText = `[${dept.code}] Location: ${dept.location} | Head: ${dept.head}`;

    // Find if department exists by name in workspace
    const { data: existing } = await admin
      .from('departments')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('name', dept.name)
      .maybeSingle();

    if (existing?.id) {
      const { error: updateErr } = await admin
        .from('departments')
        .update({
          description: descriptionText
        })
        .eq('id', existing.id);

      if (updateErr) {
        console.error('Update error for:', dept.name, updateErr.message);
      } else {
        console.log(`✅ Updated department: ${dept.code} - ${dept.name} (${dept.location} | Head: ${dept.head})`);
        successCount++;
      }
    } else {
      const { error: insertErr } = await admin
        .from('departments')
        .insert({
          workspace_id: workspaceId,
          name: dept.name,
          description: descriptionText
        });

      if (insertErr) {
        console.error('Insert error for:', dept.name, insertErr.message);
      } else {
        console.log(`✅ Created department: ${dept.code} - ${dept.name} (${dept.location} | Head: ${dept.head})`);
        successCount++;
      }
    }
  }

  console.log(`\n🎉 Seeded ${successCount}/8 departments successfully into Nexora Manufacturing!`);
}

run().catch(console.error);
