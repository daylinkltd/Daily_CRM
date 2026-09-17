import { createAdminClient } from '../src/lib/supabase/admin';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const RAW_HOLIDAYS = [
  { code: 'HOL001', title: 'Ganesh Chaturthi', date: '2026-09-14', duration: 'Full Day', type: 'COMPANY' },
  { code: 'HOL002', title: 'Gandhi Jayanti', date: '2026-10-02', duration: 'Full Day', type: 'NATIONAL' },
  { code: 'HOL003', title: 'Diwali', date: '2026-11-08', duration: 'Full Day', type: 'COMPANY' }
];

async function run() {
  const admin = createAdminClient();
  const workspaceId = 'e4cca776-684e-48c2-b93d-d4f4c34e443b';

  console.log('Seeding holidays into workspace:', workspaceId);

  let successCount = 0;

  for (const hol of RAW_HOLIDAYS) {
    const descriptionText = `[${hol.code}] Duration: ${hol.duration}`;

    // Check existing by workspace_id and date
    const { data: existing } = await admin
      .from('hr_holidays')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('date', hol.date)
      .maybeSingle();

    if (existing?.id) {
      const { error: updateErr } = await admin
        .from('hr_holidays')
        .update({
          title: hol.title,
          holiday_type: hol.type,
          description: descriptionText
        })
        .eq('id', existing.id);

      if (updateErr) {
        console.error('Update error for holiday:', hol.code, updateErr.message);
      } else {
        console.log(`✅ Updated holiday: ${hol.code} - ${hol.title} (${hol.date})`);
        successCount++;
      }
    } else {
      const { error: insertErr } = await admin
        .from('hr_holidays')
        .insert({
          workspace_id: workspaceId,
          title: hol.title,
          date: hol.date,
          holiday_type: hol.type,
          recurrence_type: 'YEARLY',
          description: descriptionText
        });

      if (insertErr) {
        console.error('Insert error for holiday:', hol.code, insertErr.message);
      } else {
        console.log(`✅ Created holiday: ${hol.code} - ${hol.title} (${hol.date})`);
        successCount++;
      }
    }
  }

  console.log(`\n🎉 Seeded ${successCount}/3 holidays successfully into Nexora Manufacturing!`);
}

run().catch(console.error);
