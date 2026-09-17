import { createAdminClient } from '../src/lib/supabase/admin';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const DEFAULT_ONBOARDING_TASKS = [
  { title: 'Submit PAN & Government ID Proof', desc: 'Upload verified identity proof and Aadhaar copy', category: 'DOCUMENT' },
  { title: 'Bank Account & Direct Deposit Details', desc: 'Provide bank branch, account number and IFSC code', category: 'DOCUMENT' },
  { title: 'IT Hardware & Work Laptop Provisioning', desc: 'Issue company laptop, accessories and security key', category: 'ASSET' },
  { title: 'Acknowledge Employee Handbook & Safety Policy', desc: 'Read and digitally sign HR and Safety policies', category: 'POLICY' },
  { title: 'Corporate Email & System Account Provisioning', desc: 'Configure company Google/Outlook workspace email', category: 'ACCOUNT_CREATION' }
];

const RAW_ONBOARDING = [
  {
    code: 'ONB001',
    empCode: 'EMP007',
    checklist: 'Joining Checklist',
    status: 'In Progress',
    date: '2026-09-10',
    owner: 'HR Executive',
    tasksState: [
      { taskIndex: 0, status: 'COMPLETED' },
      { taskIndex: 1, status: 'COMPLETED' },
      { taskIndex: 2, status: 'COMPLETED' },
      { taskIndex: 3, status: 'PENDING' },
      { taskIndex: 4, status: 'PENDING' }
    ]
  },
  {
    code: 'ONB002',
    empCode: 'EMP009',
    checklist: 'Joining Checklist',
    status: 'Completed',
    date: '2026-09-11',
    owner: 'HR Executive',
    tasksState: [
      { taskIndex: 0, status: 'COMPLETED' },
      { taskIndex: 1, status: 'COMPLETED' },
      { taskIndex: 2, status: 'COMPLETED' },
      { taskIndex: 3, status: 'COMPLETED' },
      { taskIndex: 4, status: 'COMPLETED' }
    ]
  }
];

async function run() {
  const admin = createAdminClient();
  const workspaceId = 'e4cca776-684e-48c2-b93d-d4f4c34e443b';

  console.log('Seeding onboarding data into workspace:', workspaceId);

  // Map employee_code to hr_employees.id and workspace_members.id
  const { data: hrEmpList } = await admin
    .from('hr_employees')
    .select('id, employee_code, workspace_member_id')
    .eq('workspace_id', workspaceId);

  const hrEmpMap: Record<string, string> = {};
  if (hrEmpList) {
    for (const emp of hrEmpList) {
      if (emp.employee_code && emp.id) {
        hrEmpMap[emp.employee_code] = emp.id;
      }
    }
  }

  // 1. Ensure Onboarding Task Templates
  const taskIds: string[] = [];
  for (const t of DEFAULT_ONBOARDING_TASKS) {
    const { data: existing } = await admin
      .from('hr_onboarding_tasks')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('title', t.title)
      .maybeSingle();

    if (existing?.id) {
      taskIds.push(existing.id);
    } else {
      const { data: newTask, error: tErr } = await admin
        .from('hr_onboarding_tasks')
        .insert({
          workspace_id: workspaceId,
          title: t.title,
          description: t.desc,
          category: t.category
        })
        .select('id')
        .single();

      if (tErr) {
        console.error(`Error creating onboarding task ${t.title}:`, tErr.message);
      } else if (newTask?.id) {
        taskIds.push(newTask.id);
      }
    }
  }

  console.log('Onboarding template task count:', taskIds.length);

  let successCount = 0;

  for (const onb of RAW_ONBOARDING) {
    const hrEmpId = hrEmpMap[onb.empCode];
    if (!hrEmpId) {
      console.error(`HR Employee ID not found for ${onb.empCode}`);
      continue;
    }

    let completedTasksCount = 0;

    for (const ts of onb.tasksState) {
      const taskId = taskIds[ts.taskIndex];
      if (!taskId) continue;

      const isCompleted = ts.status === 'COMPLETED';
      if (isCompleted) completedTasksCount++;

      const { error: upsertErr } = await admin
        .from('hr_onboarding_employee_tasks')
        .upsert({
          workspace_id: workspaceId,
          hr_employee_id: hrEmpId,
          task_id: taskId,
          status: ts.status,
          completed_at: isCompleted ? `${onb.date}T16:00:00Z` : null
        }, { onConflict: 'hr_employee_id,task_id' });

      if (upsertErr) {
        console.error(`Error assigning task to ${onb.empCode}:`, upsertErr.message);
      }
    }

    console.log(`✅ ${onb.code} | ${onb.empCode} | Checklist: ${onb.checklist} | Status: ${onb.status} (${completedTasksCount}/${taskIds.length} Tasks Done) | Owner: ${onb.owner}`);
    successCount++;
  }

  console.log(`\n🎉 Seeded ${successCount}/2 onboarding records successfully into Nexora Manufacturing!`);
}

run().catch(console.error);
