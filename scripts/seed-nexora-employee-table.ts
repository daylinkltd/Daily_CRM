import { createAdminClient } from '../src/lib/supabase/admin';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const RAW_EMPLOYEES = [
  { code: 'EMP001', name: 'Amit Kulkarni', gender: 'Male', dob: '1990-04-18', email: 'amit.kulkarni@demo.popularind.com', phone: '+91 90000 10001', dept: 'HR & Administration', desig: 'HR Manager', location: 'Corporate Office', joining: '2022-06-13', empType: 'Full Time', address: 'CCB 110, Congress Road, Tilakwadi, Belagavi', bank: 'HDFC Bank', bankAcc: 'XXXXXX1001', uan: 'UAN-DEMO-001' },
  { code: 'EMP002', name: 'Sneha Patil', gender: 'Female', dob: '1993-09-12', email: 'sneha.patil@demo.popularind.com', phone: '+91 90000 10002', dept: 'Accounts & Finance', desig: 'Senior Accounts Executive', location: 'Corporate Office', joining: '2023-01-09', empType: 'Full Time', address: 'Belagavi', bank: 'ICICI Bank', bankAcc: 'XXXXXX1002', uan: 'UAN-DEMO-002' },
  { code: 'EMP003', name: 'Rahul Desai', gender: 'Male', dob: '1988-11-02', email: 'rahul.desai@demo.popularind.com', phone: '+91 90000 10003', dept: 'Projects & Construction', desig: 'Project Engineer', location: 'Construction Division', joining: '2021-08-02', empType: 'Full Time', address: 'Belagavi', bank: 'SBI', bankAcc: 'XXXXXX1003', uan: 'UAN-DEMO-003' },
  { code: 'EMP004', name: 'Pooja Joshi', gender: 'Female', dob: '1995-02-21', email: 'pooja.joshi@demo.popularind.com', phone: '+91 90000 10004', dept: 'HR & Administration', desig: 'HR Executive', location: 'Corporate Office', joining: '2024-03-18', empType: 'Full Time', address: 'Belagavi', bank: 'Axis Bank', bankAcc: 'XXXXXX1004', uan: 'UAN-DEMO-004' },
  { code: 'EMP005', name: 'Vikram Naik', gender: 'Male', dob: '1991-07-14', email: 'vikram.naik@demo.popularind.com', phone: '+91 90000 10005', dept: 'RMC & Concrete', desig: 'Plant Supervisor', location: 'Concrete Plant', joining: '2020-11-16', empType: 'Full Time', address: 'Kakati, Belagavi', bank: 'HDFC Bank', bankAcc: 'XXXXXX1005', uan: 'UAN-DEMO-005' },
  { code: 'EMP006', name: 'Kiran More', gender: 'Male', dob: '1986-12-09', email: 'kiran.more@demo.popularind.com', phone: '+91 90000 10006', dept: 'Operations & Logistics', desig: 'Operations Coordinator', location: 'Operations', joining: '2019-05-20', empType: 'Full Time', address: 'Belagavi', bank: 'SBI', bankAcc: 'XXXXXX1006', uan: 'UAN-DEMO-006' },
  { code: 'EMP007', name: 'Neha Shah', gender: 'Female', dob: '1997-06-30', email: 'neha.shah@demo.popularind.com', phone: '+91 90000 10007', dept: 'Sales & Business Development', desig: 'Sales Executive', location: 'Corporate Office', joining: '2025-01-06', empType: 'Full Time', address: 'Belagavi', bank: 'ICICI Bank', bankAcc: 'XXXXXX1007', uan: 'UAN-DEMO-007' },
  { code: 'EMP008', name: 'Suresh Patil', gender: 'Male', dob: '1984-03-25', email: 'suresh.patil@demo.popularind.com', phone: '+91 90000 10008', dept: 'Plant & Production', desig: 'Production Supervisor', location: 'Concrete Plant', joining: '2018-07-02', empType: 'Full Time', address: 'Udyambag, Belagavi', bank: 'Canara Bank', bankAcc: 'XXXXXX1008', uan: 'UAN-DEMO-008' },
  { code: 'EMP009', name: 'Meera Kulkarni', gender: 'Female', dob: '1992-10-17', email: 'meera.kulkarni@demo.popularind.com', phone: '+91 90000 10009', dept: 'Procurement & Stores', desig: 'Procurement Executive', location: 'Corporate Office', joining: '2022-10-10', empType: 'Full Time', address: 'Belagavi', bank: 'Axis Bank', bankAcc: 'XXXXXX1009', uan: 'UAN-DEMO-009' },
  { code: 'EMP010', name: 'Mahesh Jadhav', gender: 'Male', dob: '1989-01-28', email: 'mahesh.jadhav@demo.popularind.com', phone: '+91 90000 10010', dept: 'Projects & Construction', desig: 'Site Supervisor', location: 'Project Site', joining: '2023-07-17', empType: 'Full Time', address: 'Belagavi', bank: 'SBI', bankAcc: 'XXXXXX1010', uan: 'UAN-DEMO-010' }
];

async function run() {
  const admin = createAdminClient();
  const workspaceId = 'e4cca776-684e-48c2-b93d-d4f4c34e443b';

  console.log('Seeding employees into workspace:', workspaceId);

  // Departments
  const deptMap: Record<string, string> = {};
  for (const emp of RAW_EMPLOYEES) {
    if (!deptMap[emp.dept]) {
      const { data: existing } = await admin.from('departments').select('id').eq('workspace_id', workspaceId).eq('name', emp.dept).maybeSingle();
      if (existing?.id) {
        deptMap[emp.dept] = existing.id;
      } else {
        const { data: newDept, error } = await admin.from('departments').insert({ workspace_id: workspaceId, name: emp.dept }).select('id').single();
        if (newDept?.id) deptMap[emp.dept] = newDept.id;
        else console.error('Dept error:', emp.dept, error);
      }
    }
  }

  // Designations
  const desigMap: Record<string, string> = {};
  for (const emp of RAW_EMPLOYEES) {
    if (!desigMap[emp.desig]) {
      const { data: existing } = await admin.from('designations').select('id').eq('workspace_id', workspaceId).eq('title', emp.desig).maybeSingle();
      if (existing?.id) {
        desigMap[emp.desig] = existing.id;
      } else {
        const { data: newDesig, error } = await admin.from('designations').insert({ workspace_id: workspaceId, title: emp.desig }).select('id').single();
        if (newDesig?.id) desigMap[emp.desig] = newDesig.id;
        else console.error('Desig error:', emp.desig, error);
      }
    }
  }

  console.log('Departments created/resolved:', deptMap);
  console.log('Designations created/resolved:', desigMap);

  let successCount = 0;

  for (const emp of RAW_EMPLOYEES) {
    const deptId = deptMap[emp.dept];
    const desigId = desigMap[emp.desig];

    // Auth user
    let userId: string | null = null;
    const { data: prof } = await admin.from('profiles').select('user_id').eq('email', emp.email).maybeSingle();
    if (prof?.user_id) {
      userId = prof.user_id;
    } else {
      const { data: newUser, error: cErr } = await admin.auth.admin.createUser({
        email: emp.email,
        password: 'DemoPassword123!',
        email_confirm: true,
        user_metadata: { full_name: emp.name },
      });
      if (cErr) {
        const { data: usersData } = await admin.auth.admin.listUsers();
        const found = usersData.users.find(u => u.email === emp.email);
        userId = found?.id || null;
      } else {
        userId = newUser.user.id;
      }

      if (userId) {
        await admin.from('profiles').upsert({
          user_id: userId,
          full_name: emp.name,
          email: emp.email,
          role: 'user',
          system_role: 'user',
        }, { onConflict: 'user_id' });
      }
    }

    if (!userId) {
      console.error('Failed to get user_id for', emp.email);
      continue;
    }

    // Workspace Member
    let memberId: string | null = null;
    const { data: existingMem } = await admin.from('workspace_members').select('id').eq('workspace_id', workspaceId).eq('user_id', userId).maybeSingle();
    if (existingMem?.id) {
      memberId = existingMem.id;
    } else {
      const { data: newMem, error: mErr } = await admin.from('workspace_members').insert({
        workspace_id: workspaceId,
        user_id: userId,
        role: 'member',
      }).select('id').single();
      if (mErr) console.error('Mem insert err:', emp.email, mErr.message);
      memberId = newMem?.id || null;
    }

    if (!memberId) continue;

    // employee_profiles
    const { error: epErr } = await admin.from('employee_profiles').upsert({
      workspace_member_id: memberId,
      workspace_id: workspaceId,
      employee_code: emp.code,
      department_id: deptId,
      designation_id: desigId,
      joining_date: emp.joining,
      date_of_birth: emp.dob,
      gender: emp.gender,
      employment_type: emp.empType,
      work_location: emp.location,
      address: emp.address,
      permanent_address: emp.address,
      bank_name: emp.bank,
      bank_account_number: emp.bankAcc,
      uan_number: emp.uan,
      personal_email: emp.email,
      personal_phone: emp.phone,
      status: 'ACTIVE',
    }, { onConflict: 'workspace_member_id' });

    if (epErr) console.error('employee_profiles error:', emp.code, epErr.message);

    // hr_employees
    const { error: hrErr } = await admin.from('hr_employees').upsert({
      workspace_id: workspaceId,
      workspace_member_id: memberId,
      employee_code: emp.code,
      joining_date: emp.joining,
      employment_status: 'CONFIRMED',
      department_id: deptId,
      designation_id: desigId,
    }, { onConflict: 'workspace_id,employee_code' });

    if (hrErr) console.error('hr_employees error:', emp.code, hrErr.message);

    console.log(`✅ Successfully added ${emp.code}: ${emp.name}`);
    successCount++;
  }

  console.log(`\n🎉 Seeded ${successCount}/10 employees successfully into Nexora Manufacturing!`);
}

run().catch(console.error);
