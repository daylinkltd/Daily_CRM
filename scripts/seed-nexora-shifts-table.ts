import { createAdminClient } from '../src/lib/supabase/admin';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const RAW_SHIFTS = [
  { code: 'SHIFT001', name: 'General Office Shift', start: '09:30:00', end: '18:00:00', days: 'Mon-Fri', breakMin: 30, location: 'Corporate Office' },
  { code: 'SHIFT002', name: 'Plant Morning Shift', start: '07:30:00', end: '16:00:00', days: 'Mon-Sat', breakMin: 30, location: 'Concrete Plant' },
  { code: 'SHIFT003', name: 'Site Shift', start: '08:00:00', end: '17:00:00', days: 'Mon-Sat', breakMin: 60, location: 'Project Site' }
];

async function run() {
  const admin = createAdminClient();
  const workspaceId = 'e4cca776-684e-48c2-b93d-d4f4c34e443b';

  console.log('Seeding shifts into workspace:', workspaceId);

  let successCount = 0;

  for (const shift of RAW_SHIFTS) {
    const { data: existing } = await admin
      .from('hr_shifts')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('code', shift.code)
      .maybeSingle();

    if (existing?.id) {
      const { error: updateErr } = await admin
        .from('hr_shifts')
        .update({
          name: shift.name,
          start_time: shift.start,
          end_time: shift.end,
          grace_period_minutes: 15,
        })
        .eq('id', existing.id);

      if (updateErr) {
        console.error('Update error for shift:', shift.code, updateErr.message);
      } else {
        console.log(`✅ Updated shift: ${shift.code} - ${shift.name} (${shift.start} - ${shift.end})`);
        successCount++;
      }
    } else {
      const { error: insertErr } = await admin
        .from('hr_shifts')
        .insert({
          workspace_id: workspaceId,
          code: shift.code,
          name: shift.name,
          start_time: shift.start,
          end_time: shift.end,
          grace_period_minutes: 15,
          half_day_threshold_hours: 4.0,
          color: shift.code === 'SHIFT001' ? '#3b82f6' : shift.code === 'SHIFT002' ? '#10b981' : '#f59e0b'
        });

      if (insertErr) {
        console.error('Insert error for shift:', shift.code, insertErr.message);
      } else {
        console.log(`✅ Created shift: ${shift.code} - ${shift.name} (${shift.start} - ${shift.end})`);
        successCount++;
      }
    }
  }

  console.log(`\n🎉 Seeded ${successCount}/3 shifts successfully into Nexora Manufacturing!`);
}

run().catch(console.error);
