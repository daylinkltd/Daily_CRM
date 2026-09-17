import { createAdminClient } from '../src/lib/supabase/admin';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const RAW_EXIT = {
  code: 'EXIT001',
  empCode: 'EMP008',
  empName: 'Suresh Patil',
  exitType: 'Resignation',
  lastWorkingDate: '2026-12-15',
  settlementDate: '2026-12-31',
  stage: 'Notice Period',
  status: 'Pending',
  noticeDays: 30,
  handoverStatus: 'In Progress - Training Junior Supervisor',
  fnfEstimate: 43400,
  reason: 'Personal reasons & relocation'
};

async function run() {
  const admin = createAdminClient();
  const workspaceId = 'e4cca776-684e-48c2-b93d-d4f4c34e443b';

  console.log('Seeding Exit & FnF data into workspace:', workspaceId);

  // Map employee_code to hr_employees.id and workspace_members.id
  const { data: hrEmpList } = await admin
    .from('hr_employees')
    .select('id, employee_code, workspace_member_id')
    .eq('workspace_id', workspaceId);

  const hrEmpMap: Record<string, string> = {};
  const memMap: Record<string, string> = {};

  if (hrEmpList) {
    for (const emp of hrEmpList) {
      if (emp.employee_code && emp.id) {
        hrEmpMap[emp.employee_code] = emp.id;
        memMap[emp.employee_code] = emp.workspace_member_id;
      }
    }
  }

  const hrEmpId = hrEmpMap[RAW_EXIT.empCode];
  const memberId = memMap[RAW_EXIT.empCode];

  if (!hrEmpId || !memberId) {
    console.error(`HR Employee / Member ID not found for ${RAW_EXIT.empCode}`);
    process.exit(1);
  }

  // 1. Update hr_employees status to NOTICE_PERIOD
  await admin
    .from('hr_employees')
    .update({ employment_status: 'NOTICE_PERIOD' })
    .eq('id', hrEmpId);

  // 2. Insert into hr_employee_history
  const exitDetailsJson = {
    exit_id: RAW_EXIT.code,
    exit_type: RAW_EXIT.exitType,
    last_working_date: RAW_EXIT.lastWorkingDate,
    settlement_date: RAW_EXIT.settlementDate,
    stage: RAW_EXIT.stage,
    status: RAW_EXIT.status,
    notice_days: RAW_EXIT.noticeDays,
    handover_status: RAW_EXIT.handoverStatus,
    fnf_estimate_amount: RAW_EXIT.fnfEstimate,
    reason: RAW_EXIT.reason
  };

  const { error: histErr } = await admin
    .from('hr_employee_history')
    .insert({
      workspace_id: workspaceId,
      hr_employee_id: hrEmpId,
      change_type: 'EXIT',
      old_value: { employment_status: 'CONFIRMED' },
      new_value: exitDetailsJson,
      effective_date: RAW_EXIT.lastWorkingDate,
      remarks: `[${RAW_EXIT.code}] Exit & FnF initiated (${RAW_EXIT.exitType}) - ${RAW_EXIT.stage}`
    });

  if (histErr) {
    console.error('Error recording exit history:', histErr.message);
  } else {
    console.log(`✅ Logged exit history for ${RAW_EXIT.empCode} (${RAW_EXIT.empName})`);
  }

  // 3. Create Resignation Request in hr_employee_requests
  const { error: reqErr } = await admin
    .from('hr_employee_requests')
    .insert({
      workspace_id: workspaceId,
      hr_employee_id: memberId, // workspace_members.id per migration 079
      request_type: 'RESIGNATION',
      details_json: exitDetailsJson,
      status: 'PENDING',
      created_at: `${RAW_EXIT.lastWorkingDate}T10:00:00Z`
    });

  if (reqErr) {
    console.error('Error creating resignation request:', reqErr.message);
  } else {
    console.log(`✅ Created resignation request for ${RAW_EXIT.empCode}`);
  }

  console.log(`\n🎉 Seeded Exit & FnF record ${RAW_EXIT.code} successfully into Nexora Manufacturing!`);
}

run().catch(console.error);
