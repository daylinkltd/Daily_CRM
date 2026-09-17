import { createAdminClient } from '../src/lib/supabase/admin';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const RAW_REQUESTS = [
  { code: 'REQ001', empCode: 'EMP004', rawType: 'Document Request', dbType: 'EXPERIENCE_LETTER', subject: 'Employment Confirmation Letter', date: '2026-09-12', status: 'APPROVED' },
  { code: 'REQ002', empCode: 'EMP007', rawType: 'HR Request', dbType: 'SALARY_CERTIFICATE', subject: 'Salary Certificate', date: '2026-09-13', status: 'PENDING' },
  { code: 'REQ003', empCode: 'EMP010', rawType: 'Asset Request', dbType: 'ADDRESS_CHANGE', subject: 'Safety Helmet Replacement', date: '2026-09-14', status: 'APPROVED' },
  { code: 'REQ004', empCode: 'EMP009', rawType: 'Leave Request', dbType: 'PF_DECLARATION', subject: 'Leave from 21 Sep', date: '2026-09-15', status: 'PENDING' }
];

async function run() {
  const admin = createAdminClient();
  const workspaceId = 'e4cca776-684e-48c2-b93d-d4f4c34e443b';

  console.log('Seeding employee requests into workspace:', workspaceId);

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

  for (const req of RAW_REQUESTS) {
    const memberId = empMap[req.empCode];
    if (!memberId) {
      console.error(`Workspace member ID not found for ${req.empCode}`);
      continue;
    }

    const { error: insertErr } = await admin
      .from('hr_employee_requests')
      .insert({
        workspace_id: workspaceId,
        hr_employee_id: memberId, // Points to workspace_members(id) per migration 079
        request_type: req.dbType,
        details_json: {
          request_id: req.code,
          category: req.rawType,
          subject: req.subject,
          request_date: req.date
        },
        status: req.status,
        created_at: `${req.date}T10:00:00Z`
      });

    if (insertErr) {
      console.error(`Error adding request ${req.code}:`, insertErr.message);
    } else {
      console.log(`✅ ${req.code} | ${req.empCode} | ${req.rawType} | ${req.subject} | Status: ${req.status}`);
      successCount++;
    }
  }

  console.log(`\n🎉 Seeded ${successCount}/4 employee requests successfully into Nexora Manufacturing!`);
}

run().catch(console.error);
