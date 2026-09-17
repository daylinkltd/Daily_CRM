import { createAdminClient } from '../src/lib/supabase/admin';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const RAW_DESIGNATIONS = [
  { code: 'DS001', title: 'HR Manager', dept: 'HR & Administration', levelName: 'Management', shortCode: 'M', levelNum: 1 },
  { code: 'DS002', title: 'Senior Accounts Executive', dept: 'Accounts & Finance', levelName: 'Executive', shortCode: 'S', levelNum: 2 },
  { code: 'DS003', title: 'Project Engineer', dept: 'Projects & Construction', levelName: 'Engineering', shortCode: 'E', levelNum: 3 },
  { code: 'DS004', title: 'HR Executive', dept: 'HR & Administration', levelName: 'Executive', shortCode: 'E', levelNum: 4 },
  { code: 'DS005', title: 'Plant Supervisor', dept: 'RMC & Concrete', levelName: 'Supervisory', shortCode: 'S', levelNum: 2 },
  { code: 'DS006', title: 'Operations Coordinator', dept: 'Operations & Logistics', levelName: 'Executive', shortCode: 'E', levelNum: 4 },
  { code: 'DS007', title: 'Sales Executive', dept: 'Sales & Business Development', levelName: 'Executive', shortCode: 'E', levelNum: 4 },
  { code: 'DS008', title: 'Production Supervisor', dept: 'Plant & Production', levelName: 'Supervisory', shortCode: 'S', levelNum: 2 },
  { code: 'DS009', title: 'Procurement Executive', dept: 'Procurement & Stores', levelName: 'Executive', shortCode: 'E', levelNum: 4 },
  { code: 'DS010', title: 'Site Supervisor', dept: 'Projects & Construction', levelName: 'Supervisory', shortCode: 'S', levelNum: 2 }
];

async function run() {
  const admin = createAdminClient();
  const workspaceId = 'e4cca776-684e-48c2-b93d-d4f4c34e443b';

  console.log('Seeding designations into workspace:', workspaceId);

  let successCount = 0;

  for (const desig of RAW_DESIGNATIONS) {
    const descriptionText = `[${desig.code}] Short Code: ${desig.shortCode} | Level: ${desig.levelName} | Dept: ${desig.dept}`;

    // Find if designation exists by title in workspace
    const { data: existing } = await admin
      .from('designations')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('title', desig.title)
      .maybeSingle();

    if (existing?.id) {
      const { error: updateErr } = await admin
        .from('designations')
        .update({
          level: desig.levelNum,
          description: descriptionText
        })
        .eq('id', existing.id);

      if (updateErr) {
        console.error('Update error for:', desig.title, updateErr.message);
      } else {
        console.log(`✅ Updated designation: ${desig.code} - ${desig.title} (${desig.levelName} | Code: ${desig.shortCode})`);
        successCount++;
      }
    } else {
      const { error: insertErr } = await admin
        .from('designations')
        .insert({
          workspace_id: workspaceId,
          title: desig.title,
          level: desig.levelNum,
          description: descriptionText
        });

      if (insertErr) {
        console.error('Insert error for:', desig.title, insertErr.message);
      } else {
        console.log(`✅ Created designation: ${desig.code} - ${desig.title} (${desig.levelName} | Code: ${desig.shortCode})`);
        successCount++;
      }
    }
  }

  console.log(`\n🎉 Seeded ${successCount}/10 designations successfully into Nexora Manufacturing!`);
}

run().catch(console.error);
