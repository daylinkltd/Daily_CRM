import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const admin = createClient(url, key);
const workspaceId = 'e4cca776-684e-48c2-b93d-d4f4c34e443b';
const ownerMemberId = 'dbee9f90-067f-4fd3-be2c-13e148fa826d';

async function main() {
  // 1. Get or create a task for workspace_id to satisfy time_logs.task_id non-null constraint
  const { data: tasks } = await admin.from('tasks').select('id').eq('workspace_id', workspaceId).limit(1);
  let taskId = tasks && tasks[0] ? tasks[0].id : null;

  if (!taskId) {
    const { data: newTask, error: nErr } = await admin.from('tasks').insert({
      workspace_id: workspaceId,
      title: 'General Management & HR Operations Review',
      created_by: ownerMemberId,
      status: 'DONE'
    }).select('id').single();
    if (nErr) console.error('Task insert error:', nErr);
    if (newTask) taskId = newTask.id;
  }

  if (taskId) {
    const timeLogs = [
      {
        workspace_id: workspaceId,
        task_id: taskId,
        workspace_member_id: ownerMemberId,
        log_date: '2026-09-14',
        duration: 8.5,
        description: 'Reviewed Q3 HR policy updates and employee onboarding progress',
        billable: true
      },
      {
        workspace_id: workspaceId,
        task_id: taskId,
        workspace_member_id: ownerMemberId,
        log_date: '2026-09-15',
        duration: 8.5,
        description: 'On-site audit of RMC equipment safety compliance',
        billable: true
      },
      {
        workspace_id: workspaceId,
        task_id: taskId,
        workspace_member_id: ownerMemberId,
        log_date: '2026-09-16',
        duration: 7.5,
        description: 'Employee Exit Management & Settlement Review',
        billable: true
      },
      {
        workspace_id: workspaceId,
        task_id: taskId,
        workspace_member_id: ownerMemberId,
        log_date: '2026-09-17',
        duration: 8.0,
        description: 'Belagavi Construction Operations Planning',
        billable: true
      }
    ];

    const { error: tErr } = await admin.from('time_logs').insert(timeLogs);
    if (tErr) console.error('Time logs insert error:', tErr);
    else console.log('Successfully inserted time logs for workspace owner!');
  }

  // 2. Seed Exit & FnF record EXIT001 for EMP008 (Suresh Patil)
  const { data: emps } = await admin.from('hr_employees').select('id, employee_code').eq('workspace_id', workspaceId).eq('employee_code', 'EMP008').maybeSingle();
  if (emps) {
    const { data: exitRow, error: exitErr } = await admin.from('hr_exits').upsert({
      workspace_id: workspaceId,
      hr_employee_id: emps.id,
      resignation_date: '2026-09-01',
      reason: 'Relocation to native city / Personal career growth',
      requested_lwd: '2026-12-15',
      approved_lwd: '2026-12-15',
      notice_days: 30,
      served_days: 15,
      waived_days: 0,
      shortfall_days: 15,
      status: 'APPROVED'
    }, { onConflict: 'workspace_id,hr_employee_id' }).select().single();

    if (exitErr) console.error('Exit insert error:', exitErr);
    else console.log('Successfully seeded exit record EXIT001 for EMP008');

    if (exitRow) {
      const defaultClearances = ['MANAGER', 'HR', 'IT', 'ASSET', 'FINANCE'].map((type) => ({
        workspace_id: workspaceId,
        exit_id: exitRow.id,
        clearance_type: type,
        status: type === 'MANAGER' || type === 'IT' ? 'APPROVED' : 'PENDING',
        asset_recovery_amount: 0
      }));
      await admin.from('hr_exit_clearances').upsert(defaultClearances, { onConflict: 'exit_id,clearance_type' });
      console.log('Successfully seeded exit clearances for EXIT001');
    }
  }
}

main().catch(console.error);
