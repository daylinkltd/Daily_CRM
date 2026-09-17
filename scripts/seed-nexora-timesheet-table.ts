import { createAdminClient } from '../src/lib/supabase/admin';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const RAW_TIMESHEETS = [
  { tsId: 'TS001', empCode: 'EMP003', date: '2026-09-14', project: 'Construction Project A', workType: 'Site Supervision', hours: 8.0, status: 'Approved' },
  { tsId: 'TS002', empCode: 'EMP006', date: '2026-09-14', project: 'Fleet & Logistics', workType: 'Operations Coordination', hours: 8.0, status: 'Approved' },
  { tsId: 'TS003', empCode: 'EMP010', date: '2026-09-14', project: 'Construction Project A', workType: 'Site Supervision', hours: 8.0, status: 'Approved' },
  { tsId: 'TS004', empCode: 'EMP003', date: '2026-09-15', project: 'Construction Project A', workType: 'Site Supervision', hours: 8.5, status: 'Submitted' },
  { tsId: 'TS005', empCode: 'EMP006', date: '2026-09-15', project: 'Fleet & Logistics', workType: 'Operations Coordination', hours: 8.0, status: 'Submitted' },
  { tsId: 'TS006', empCode: 'EMP010', date: '2026-09-15', project: 'Construction Project A', workType: 'Site Supervision', hours: 0.0, status: 'Rejected - Absent' }
];

async function run() {
  const admin = createAdminClient();
  const workspaceId = 'e4cca776-684e-48c2-b93d-d4f4c34e443b';

  console.log('Seeding timesheet records into workspace:', workspaceId);

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

  // Ensure Projects exist
  const projectMap: Record<string, string> = {};
  const projectNames = Array.from(new Set(RAW_TIMESHEETS.map(t => t.project)));

  for (const name of projectNames) {
    const { data: existing } = await admin
      .from('projects')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('name', name)
      .maybeSingle();

    if (existing?.id) {
      projectMap[name] = existing.id;
    } else {
      const { data: newProj, error } = await admin
        .from('projects')
        .insert({
          workspace_id: workspaceId,
          name: name,
          status: 'in_progress'
        })
        .select('id')
        .single();

      if (newProj?.id) {
        projectMap[name] = newProj.id;
        console.log(`✅ Created project: ${name}`);
      } else {
        console.error(`Error creating project ${name}:`, error?.message);
      }
    }
  }

  // Ensure Tasks exist
  const taskMap: Record<string, string> = {}; // "ProjectName:WorkType" -> taskId
  for (const ts of RAW_TIMESHEETS) {
    const key = `${ts.project}:${ts.workType}`;
    if (!taskMap[key]) {
      const projectId = projectMap[ts.project];
      const { data: existing } = await admin
        .from('tasks')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('project_id', projectId)
        .eq('title', ts.workType)
        .maybeSingle();

      if (existing?.id) {
        taskMap[key] = existing.id;
      } else {
        const { data: newTask, error } = await admin
          .from('tasks')
          .insert({
            workspace_id: workspaceId,
            project_id: projectId,
            title: ts.workType,
            description: `Work Type: ${ts.workType}`
          })
          .select('id')
          .single();

        if (newTask?.id) {
          taskMap[key] = newTask.id;
          console.log(`✅ Created task: ${ts.workType} under ${ts.project}`);
        } else {
          console.error(`Error creating task ${ts.workType}:`, error?.message);
        }
      }
    }
  }

  let successCount = 0;

  for (const ts of RAW_TIMESHEETS) {
    const memberId = empMap[ts.empCode];
    const taskId = taskMap[`${ts.project}:${ts.workType}`];

    if (!memberId || !taskId) {
      console.error(`Missing memberId or taskId for ${ts.tsId}`);
      continue;
    }

    const isApproved = ts.status.toLowerCase().includes('approved');
    const descriptionText = `[${ts.tsId}] ${ts.workType} | Status: ${ts.status}`;

    const { error: insertErr } = await admin
      .from('time_logs')
      .insert({
        workspace_id: workspaceId,
        workspace_member_id: memberId,
        task_id: taskId,
        log_date: ts.date,
        duration: ts.hours,
        billable: true,
        description: descriptionText,
        approved: isApproved
      });

    if (insertErr) {
      console.error(`Error inserting timesheet ${ts.tsId}:`, insertErr.message);
    } else {
      console.log(`✅ ${ts.tsId} | ${ts.empCode} | ${ts.date} | ${ts.project} | ${ts.hours} hrs | ${ts.status}`);
      successCount++;
    }
  }

  console.log(`\n🎉 Seeded ${successCount}/6 timesheet records successfully into Nexora Manufacturing!`);
}

run().catch(console.error);
