import { createAdminClient } from '../src/lib/supabase/admin';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const RAW_ATTENDANCE = [
  { date: '2026-09-14', empCode: 'EMP001', status: 'Present', checkIn: '09:26', checkOut: '18:18', location: 'Corporate Office', remarks: 'Regular' },
  { date: '2026-09-14', empCode: 'EMP002', status: 'Present', checkIn: '09:41', checkOut: '18:05', location: 'Corporate Office', remarks: 'Regular' },
  { date: '2026-09-14', empCode: 'EMP003', status: 'Present', checkIn: '08:55', checkOut: '18:22', location: 'Construction Division', remarks: 'Site Visit' },
  { date: '2026-09-14', empCode: 'EMP004', status: 'Present', checkIn: '09:18', checkOut: '18:11', location: 'Corporate Office', remarks: 'Regular' },
  { date: '2026-09-14', empCode: 'EMP005', status: 'Present', checkIn: '07:52', checkOut: '17:34', location: 'Concrete Plant', remarks: 'Plant Shift' },
  { date: '2026-09-14', empCode: 'EMP006', status: 'Present', checkIn: '08:21', checkOut: '17:48', location: 'Operations', remarks: 'Field Operations' },
  { date: '2026-09-14', empCode: 'EMP007', status: 'Present', checkIn: '09:32', checkOut: '18:00', location: 'Corporate Office', remarks: 'Regular' },
  { date: '2026-09-14', empCode: 'EMP008', status: 'Present', checkIn: '07:45', checkOut: '17:30', location: 'Concrete Plant', remarks: 'Plant Shift' },
  { date: '2026-09-14', empCode: 'EMP009', status: 'Present', checkIn: '09:36', checkOut: '18:08', location: 'Corporate Office', remarks: 'Regular' },
  { date: '2026-09-14', empCode: 'EMP010', status: 'Present', checkIn: '08:07', checkOut: '17:41', location: 'Project Site', remarks: 'Site Shift' },
  { date: '2026-09-15', empCode: 'EMP001', status: 'Present', checkIn: '09:31', checkOut: '18:15', location: 'Corporate Office', remarks: 'Regular' },
  { date: '2026-09-15', empCode: 'EMP002', status: 'Late', checkIn: '10:12', checkOut: '18:14', location: 'Corporate Office', remarks: 'Traffic' },
  { date: '2026-09-15', empCode: 'EMP003', status: 'Present', checkIn: '08:49', checkOut: '18:25', location: 'Construction Division', remarks: 'Site Visit' },
  { date: '2026-09-15', empCode: 'EMP004', status: 'Present', checkIn: '09:16', checkOut: '18:04', location: 'Corporate Office', remarks: 'Regular' },
  { date: '2026-09-15', empCode: 'EMP005', status: 'Present', checkIn: '07:48', checkOut: '17:36', location: 'Concrete Plant', remarks: 'Plant Shift' },
  { date: '2026-09-15', empCode: 'EMP006', status: 'Present', checkIn: '08:18', checkOut: '17:52', location: 'Operations', remarks: 'Field Operations' },
  { date: '2026-09-15', empCode: 'EMP007', status: 'Present', checkIn: '09:29', checkOut: '18:02', location: 'Corporate Office', remarks: 'Regular' },
  { date: '2026-09-15', empCode: 'EMP008', status: 'Present', checkIn: '07:43', checkOut: '17:33', location: 'Concrete Plant', remarks: 'Plant Shift' },
  { date: '2026-09-15', empCode: 'EMP009', status: 'Present', checkIn: '09:34', checkOut: '18:10', location: 'Corporate Office', remarks: 'Regular' },
  { date: '2026-09-15', empCode: 'EMP010', status: 'Absent', checkIn: '', checkOut: '', location: 'Project Site', remarks: 'Unplanned' }
];

function mapWorkLocation(rawLocation: string): 'OFFICE' | 'WFH' | 'CLIENT_SITE' | 'FIELD_WORK' {
  const loc = rawLocation.toLowerCase();
  if (loc.includes('office')) return 'OFFICE';
  if (loc.includes('construction') || loc.includes('project site') || loc.includes('client')) return 'CLIENT_SITE';
  if (loc.includes('plant') || loc.includes('operations') || loc.includes('field')) return 'FIELD_WORK';
  return 'OFFICE';
}

async function run() {
  const admin = createAdminClient();
  const workspaceId = 'e4cca776-684e-48c2-b93d-d4f4c34e443b';

  console.log('Seeding attendance records into workspace:', workspaceId);

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

  console.log('Mapped employees count:', Object.keys(empMap).length);

  let successCount = 0;

  for (const row of RAW_ATTENDANCE) {
    const memberId = empMap[row.empCode];
    if (!memberId) {
      console.error(`Member ID not found for ${row.empCode}`);
      continue;
    }

    let punchInISO: string | null = null;
    let punchOutISO: string | null = null;
    let workingHours = 0;

    if (row.checkIn) {
      punchInISO = `${row.date}T${row.checkIn}:00Z`;
    }
    if (row.checkOut) {
      punchOutISO = `${row.date}T${row.checkOut}:00Z`;
    }

    if (punchInISO && punchOutISO) {
      const inDate = new Date(punchInISO);
      const outDate = new Date(punchOutISO);
      workingHours = Number(((outDate.getTime() - inDate.getTime()) / (1000 * 60 * 60)).toFixed(2));
    }

    const workLocEnum = mapWorkLocation(row.location);
    const fullRemarks = `[${row.location}] ${row.remarks}`;

    const { error: upsertErr } = await admin
      .from('attendance')
      .upsert({
        workspace_id: workspaceId,
        workspace_member_id: memberId,
        attendance_date: row.date,
        punch_in_time: punchInISO,
        punch_out_time: punchOutISO,
        working_hours: workingHours,
        status: row.status,
        remarks: fullRemarks,
        work_location: workLocEnum,
        is_approved: true,
      }, { onConflict: 'workspace_member_id,attendance_date' });

    if (upsertErr) {
      console.error(`Error adding attendance for ${row.empCode} on ${row.date}:`, upsertErr.message);
    } else {
      console.log(`✅ ${row.date} | ${row.empCode} | Status: ${row.status} | Location: ${workLocEnum} (${row.location}) | Hours: ${workingHours}`);
      successCount++;
    }
  }

  console.log(`\n🎉 Seeded ${successCount}/20 attendance records successfully into Nexora Manufacturing!`);
}

run().catch(console.error);
