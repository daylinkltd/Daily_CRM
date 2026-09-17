import { createAdminClient } from '../src/lib/supabase/admin';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const RAW_LEAVES = [
  { code: 'LV001', empCode: 'EMP007', leaveType: 'Casual Leave', from: '2026-09-18', to: '2026-09-18', days: 1, status: 'approved', reason: 'Personal work' },
  { code: 'LV002', empCode: 'EMP002', leaveType: 'Sick Leave', from: '2026-09-16', to: '2026-09-16', days: 1, status: 'approved', reason: 'Not feeling well' },
  { code: 'LV003', empCode: 'EMP003', leaveType: 'Earned Leave', from: '2026-09-24', to: '2026-09-25', days: 2, status: 'pending', reason: 'Family function' },
  { code: 'LV004', empCode: 'EMP009', leaveType: 'Casual Leave', from: '2026-09-21', to: '2026-09-21', days: 1, status: 'pending', reason: 'Personal work' }
];

async function run() {
  const admin = createAdminClient();
  const workspaceId = 'e4cca776-684e-48c2-b93d-d4f4c34e443b';

  console.log('Seeding leave requests into workspace:', workspaceId);

  // Map employee_code to workspace_member_id
  const { data: epList } = await admin
    .from('employee_profiles')
    .select('employee_code, workspace_member_id')
    .eq('workspace_id', workspaceId);

  const empMap: Record<string, string> = {};
  if (epList) {
    for (const ep of epList) {
      if (ep.employee_code && ep.workspace_member_id) {
        empMap[ep.employee_code] = ep.workspace_member_id;
      }
    }
  }

  let successCount = 0;

  for (const lv of RAW_LEAVES) {
    const memberId = empMap[lv.empCode];
    if (!memberId) {
      console.error(`Member ID not found for ${lv.empCode}`);
      continue;
    }

    const fullReason = `[${lv.code}] ${lv.reason}`;

    const { error: insertErr } = await admin
      .from('leave_requests')
      .insert({
        workspace_id: workspaceId,
        workspace_member_id: memberId,
        leave_type: lv.leaveType,
        from_date: lv.from,
        to_date: lv.to,
        reason: fullReason,
        status: lv.status,
      });

    if (insertErr) {
      console.error(`Error adding leave ${lv.code}:`, insertErr.message);
    } else {
      console.log(`✅ ${lv.code} | ${lv.empCode} | ${lv.leaveType} | ${lv.from} to ${lv.to} (${lv.days}d) | Status: ${lv.status}`);
      successCount++;
    }
  }

  console.log(`\n🎉 Seeded ${successCount}/4 leave requests successfully into Nexora Manufacturing!`);
}

run().catch(console.error);
