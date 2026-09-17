import { createAdminClient } from '../src/lib/supabase/admin';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  console.log('=== SEEDING HR DEMO DATA FOR NEXORA ===');
  const admin = createAdminClient();

  // 1. Get workspace for info@nexora.in
  const targetEmail = 'info@nexora.in';
  const { data: profile } = await admin
    .from('profiles')
    .select('user_id')
    .eq('email', targetEmail)
    .maybeSingle();

  console.log('Nexora Profile:', profile);

  let workspaceId: string | null = null;
  if (profile?.user_id) {
    const { data: mem } = await admin
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', profile.user_id)
      .maybeSingle();
    workspaceId = mem?.workspace_id || null;
  }

  if (!workspaceId) {
    const { data: ws } = await admin
      .from('workspaces')
      .select('id, name')
      .ilike('name', '%nexora%')
      .limit(1)
      .maybeSingle();
    workspaceId = ws?.id || null;
  }

  console.log('Target Workspace ID:', workspaceId);
  if (!workspaceId) {
    console.error('Workspace not found!');
    process.exit(1);
  }

  // 2. Departments
  const deptNames = ['Engineering', 'Sales & Marketing', 'Human Resources', 'Operations', 'Customer Success'];
  const departmentMap: Record<string, string> = {};

  for (const name of deptNames) {
    const { data: existing } = await admin
      .from('departments')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('name', name)
      .maybeSingle();

    if (existing?.id) {
      departmentMap[name] = existing.id;
    } else {
      const { data: newDept } = await admin
        .from('departments')
        .insert({ workspace_id: workspaceId, name })
        .select('id')
        .single();
      if (newDept?.id) departmentMap[name] = newDept.id;
    }
  }

  console.log('Departments:', departmentMap);

  // 3. Designations
  const desigTitles = [
    'Senior Lead Architect',
    'Enterprise Account Executive',
    'HR Operations Specialist',
    'Frontend Tech Lead',
    'Operations Manager',
    'Customer Success Lead',
    'DevOps Lead Engineer',
    'Associate Software Engineer',
    'Senior Sales Representative',
    'Talent Acquisition Partner',
  ];

  const designationMap: Record<string, string> = {};
  for (const title of desigTitles) {
    const { data: existing } = await admin
      .from('designations')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('title', title)
      .maybeSingle();

    if (existing?.id) {
      designationMap[title] = existing.id;
    } else {
      const { data: newDesig } = await admin
        .from('designations')
        .insert({ workspace_id: workspaceId, title })
        .select('id')
        .single();
      if (newDesig?.id) designationMap[title] = newDesig.id;
    }
  }

  console.log('Designations:', designationMap);

  // 4. Employees
  const DEMO_EMPLOYEES = [
    {
      full_name: 'Aarav Sharma',
      email: 'aarav.sharma@demo.nexora.in',
      department: 'Engineering',
      designation: 'Senior Lead Architect',
      employee_code: 'NEX-1001',
      joining_date: '2023-01-15',
      status: 'ACTIVE',
      salary: 135000,
    },
    {
      full_name: 'Priya Patel',
      email: 'priya.patel@demo.nexora.in',
      department: 'Sales & Marketing',
      designation: 'Enterprise Account Executive',
      employee_code: 'NEX-1002',
      joining_date: '2023-06-01',
      status: 'ACTIVE',
      salary: 95000,
    },
    {
      full_name: 'Rohan Verma',
      email: 'rohan.verma@demo.nexora.in',
      department: 'Human Resources',
      designation: 'HR Operations Specialist',
      employee_code: 'NEX-1003',
      joining_date: '2023-08-10',
      status: 'ACTIVE',
      salary: 75000,
    },
    {
      full_name: 'Ananya Gupta',
      email: 'ananya.gupta@demo.nexora.in',
      department: 'Engineering',
      designation: 'Frontend Tech Lead',
      employee_code: 'NEX-1004',
      joining_date: '2024-01-10',
      status: 'ACTIVE',
      salary: 105000,
    },
    {
      full_name: 'Vikram Singh',
      email: 'vikram.singh@demo.nexora.in',
      department: 'Operations',
      designation: 'Operations Manager',
      employee_code: 'NEX-1005',
      joining_date: '2024-02-15',
      status: 'ACTIVE',
      salary: 90000,
    },
    {
      full_name: 'Sneha Reddy',
      email: 'sneha.reddy@demo.nexora.in',
      department: 'Customer Success',
      designation: 'Customer Success Lead',
      employee_code: 'NEX-1006',
      joining_date: '2024-04-01',
      status: 'ACTIVE',
      salary: 82000,
    },
    {
      full_name: 'Kabir Mehta',
      email: 'kabir.mehta@demo.nexora.in',
      department: 'Engineering',
      designation: 'DevOps Lead Engineer',
      employee_code: 'NEX-1007',
      joining_date: '2024-05-12',
      status: 'ACTIVE',
      salary: 115000,
    },
    {
      full_name: 'Neha Kapoor',
      email: 'neha.kapoor@demo.nexora.in',
      department: 'Engineering',
      designation: 'Associate Software Engineer',
      employee_code: 'NEX-1008',
      joining_date: '2026-09-01',
      status: 'PROBATION',
      salary: 65000,
    },
    {
      full_name: 'Siddharth Nair',
      email: 'siddharth.nair@demo.nexora.in',
      department: 'Sales & Marketing',
      designation: 'Senior Sales Representative',
      employee_code: 'NEX-1009',
      joining_date: '2023-11-20',
      status: 'PROBATION',
      salary: 78000,
    },
    {
      full_name: 'Ishita Roy',
      email: 'ishita.roy@demo.nexora.in',
      department: 'Human Resources',
      designation: 'Talent Acquisition Partner',
      employee_code: 'NEX-1010',
      joining_date: '2026-10-01',
      status: 'PROBATION',
      salary: 85000,
    },
  ];

  let seededCount = 0;

  for (const emp of DEMO_EMPLOYEES) {
    const deptId = departmentMap[emp.department];
    const desigId = designationMap[emp.designation];

    // Check if profile exists by email
    let userId: string | null = null;
    const { data: existingProf } = await admin
      .from('profiles')
      .select('user_id')
      .eq('email', emp.email)
      .maybeSingle();

    if (existingProf?.user_id) {
      userId = existingProf.user_id;
    } else {
      // Create auth user via admin SDK
      const { data: newUser, error: createError } = await admin.auth.admin.createUser({
        email: emp.email,
        password: 'DemoPassword123!',
        email_confirm: true,
        user_metadata: { full_name: emp.full_name },
      });

      if (createError) {
        // If user already exists in auth.users, find them
        const { data: usersData } = await admin.auth.admin.listUsers();
        const found = usersData.users.find((u) => u.email === emp.email);
        userId = found?.id || null;
      } else {
        userId = newUser.user.id;
      }

      if (userId) {
        await admin.from('profiles').upsert({
          user_id: userId,
          full_name: emp.full_name,
          email: emp.email,
          role: 'user',
          system_role: 'user',
        }, { onConflict: 'user_id' });
      }
    }

    if (!userId) {
      console.error('Could not get/create user_id for:', emp.email);
      continue;
    }

    // Check workspace membership
    let memberId: string | null = null;
    const { data: existingMem } = await admin
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existingMem?.id) {
      memberId = existingMem.id;
    } else {
      const { data: newMem, error: mErr } = await admin
        .from('workspace_members')
        .insert({
          workspace_id: workspaceId,
          user_id: userId,
          role: 'member',
        })
        .select('id')
        .single();

      if (mErr) console.error('Member insert error:', emp.email, mErr.message);
      memberId = newMem?.id || null;
    }

    if (!memberId) continue;

    // Insert into employee_profiles
    const { error: epErr } = await admin
      .from('employee_profiles')
      .upsert({
        workspace_member_id: memberId,
        workspace_id: workspaceId,
        employee_code: emp.employee_code,
        department_id: deptId,
        designation_id: desigId,
        joining_date: emp.joining_date,
        status: emp.status,
      }, { onConflict: 'workspace_member_id' });

    if (epErr) console.error('employee_profiles upsert error:', epErr.message);

    // Also insert into hr_employees
    await admin
      .from('hr_employees')
      .upsert({
        workspace_id: workspaceId,
        workspace_member_id: memberId,
        employee_code: emp.employee_code,
        joining_date: emp.joining_date,
        employment_status: emp.status === 'ACTIVE' ? 'CONFIRMED' : 'PROBATION',
        department_id: deptId,
        designation_id: desigId,
      }, { onConflict: 'workspace_id,employee_code' });

    console.log(`✅ Seeded employee: ${emp.full_name} (${emp.employee_code}) -> memberId: ${memberId}`);
    seededCount++;
  }

  // 5. Onboarding Task Templates & Employee Tasks
  const defaultTasks = [
    { workspace_id: workspaceId, title: 'Submit PAN & Government ID Proof', description: 'Upload identity proof', category: 'DOCUMENT' },
    { workspace_id: workspaceId, title: 'Bank Account & Salary Disbursement Details', description: 'Void cheque & IFSC', category: 'DOCUMENT' },
    { workspace_id: workspaceId, title: 'IT Hardware & Work Laptop Provisioning', description: 'Laptop & Security Key', category: 'ASSET' },
    { workspace_id: workspaceId, title: 'Acknowledge Employee Handbook & NDA', description: 'Sign policy handbook', category: 'POLICY' },
  ];

  const taskIds: string[] = [];
  for (const t of defaultTasks) {
    const { data: existingTask } = await admin
      .from('hr_onboarding_tasks')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('title', t.title)
      .maybeSingle();

    if (existingTask?.id) {
      taskIds.push(existingTask.id);
    } else {
      const { data: newTask } = await admin
        .from('hr_onboarding_tasks')
        .insert(t)
        .select('id')
        .single();
      if (newTask?.id) taskIds.push(newTask.id);
    }
  }

  // 6. Recruitment Jobs & Candidates
  const { data: job } = await admin
    .from('hr_recruitment_jobs')
    .insert({
      workspace_id: workspaceId,
      title: 'Senior Enterprise Solution Architect',
      department_id: departmentMap['Engineering'],
      status: 'OPEN',
      headcount: 2,
      description: 'Lead enterprise architecture for cloud microservices.',
    })
    .select('id')
    .single();

  if (job?.id) {
    const candidates = [
      { full_name: 'Ishita Roy', email: 'ishita.roy@demo.nexora.in', phone: '+919876543210', stage: 'OFFER' },
      { full_name: 'Rahul Kapur', email: 'rahul.kapur@gmail.com', phone: '+919812345678', stage: 'INTERVIEW' },
      { full_name: 'Meera Sharma', email: 'meera.sharma@yahoo.com', phone: '+919899887766', stage: 'APPLIED' },
    ];

    for (const cand of candidates) {
      const { data: newCand } = await admin
        .from('hr_candidates')
        .insert({
          workspace_id: workspaceId,
          full_name: cand.full_name,
          email: cand.email,
          phone: cand.phone,
          stage: cand.stage,
        })
        .select('id')
        .single();

      if (newCand?.id) {
        await admin.from('hr_job_applications').insert({
          workspace_id: workspaceId,
          job_id: job.id,
          candidate_id: newCand.id,
          status: cand.stage === 'OFFER' ? 'OFFER_ACCEPTED' : 'INTERVIEW_SCHEDULED',
        });
      }
    }
  }

  // 7. Attendance Logs & HR Dashboard Metrics
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  for (const emp of DEMO_EMPLOYEES.slice(0, 7)) {
    const { data: prof } = await admin
      .from('employee_profiles')
      .select('workspace_member_id')
      .eq('workspace_id', workspaceId)
      .eq('employee_code', emp.employee_code)
      .maybeSingle();

    if (prof?.workspace_member_id) {
      await admin.from('attendance').upsert([
        {
          workspace_id: workspaceId,
          workspace_member_id: prof.workspace_member_id,
          attendance_date: today,
          punch_in: `${today}T09:05:00Z`,
          status: 'Present',
          working_hours: 8.5,
          net_productive_hours: 8.0,
          work_location: 'OFFICE',
        },
        {
          workspace_id: workspaceId,
          workspace_member_id: prof.workspace_member_id,
          attendance_date: yesterday,
          punch_in: `${yesterday}T09:00:00Z`,
          punch_out: `${yesterday}T18:00:00Z`,
          status: 'Present',
          working_hours: 9.0,
          net_productive_hours: 8.5,
          work_location: 'OFFICE',
        },
      ], { onConflict: 'workspace_member_id,attendance_date' });
    }
  }

  // 8. Pending Leaves & Employee Requests for HR Dashboard
  const { data: firstEmp } = await admin
    .from('employee_profiles')
    .select('workspace_member_id')
    .eq('workspace_id', workspaceId)
    .limit(1)
    .maybeSingle();

  if (firstEmp?.workspace_member_id) {
    // Pending Leave Application
    await admin.from('leave_requests').insert({
      workspace_id: workspaceId,
      workspace_member_id: firstEmp.workspace_member_id,
      leave_type: 'Annual Leave',
      start_date: today,
      end_date: today,
      days_count: 1,
      reason: 'Personal work & family commitment',
      status: 'pending',
    });

    // Pending ESS Request
    await admin.from('hr_employee_requests').insert({
      workspace_id: workspaceId,
      workspace_member_id: firstEmp.workspace_member_id,
      request_type: 'BANK_ACCOUNT_UPDATE',
      title: 'Update Direct Deposit Account Details',
      details: { bank: 'HDFC Bank', account: 'XXXX-XXXX-9812' },
      status: 'PENDING',
    });
  }

  // 9. Policies & Compliance Documents
  const { data: pol } = await admin.from('hr_policies').insert({
    workspace_id: workspaceId,
    title: 'Code of Conduct & Professional Workplace Ethics',
    category: 'CODE_OF_CONDUCT',
    description: 'Guidelines for professional conduct, anti-harassment, data security, and ethics.',
    status: 'PUBLISHED',
  }).select('id').single();

  if (pol?.id) {
    await admin.from('hr_policy_versions').insert({
      policy_id: pol.id,
      version_number: 1,
      content: 'Standard Nexora Code of Conduct and Workplace Guidelines.',
      mandatory: true,
      change_summary: 'Initial release',
    });
  }

  await admin.from('hr_policies').insert({
    workspace_id: workspaceId,
    title: 'Remote Work & Hybrid Operations Policy',
    category: 'LEAVE_RULES',
    description: 'Rules for WFH approval, equipment safety, and core working hours.',
    status: 'PUBLISHED',
  });

  // 10. Work Shifts
  await admin.from('hr_shifts').upsert([
    {
      workspace_id: workspaceId,
      name: 'General Day Shift',
      code: 'GS-01',
      start_time: '09:00',
      end_time: '18:00',
      grace_minutes: 15,
      is_default: true,
    },
    {
      workspace_id: workspaceId,
      name: 'UK/Europe Coverage Shift',
      code: 'UK-02',
      start_time: '13:30',
      end_time: '22:30',
      grace_minutes: 15,
      is_default: false,
    },
  ], { onConflict: 'workspace_id,code' });

  // 11. Company Holidays
  await admin.from('hr_holidays').upsert([
    {
      workspace_id: workspaceId,
      title: 'Gandhi Jayanti',
      holiday_date: '2026-10-02',
      holiday_type: 'NATIONAL',
      description: 'National Holiday',
    },
    {
      workspace_id: workspaceId,
      title: 'Diwali Celebration',
      holiday_date: '2026-11-08',
      holiday_type: 'COMPANY',
      description: 'Festival Holiday',
    },
  ], { onConflict: 'workspace_id,holiday_date' });

  // 12. Payroll Cycles & Payslips
  const { data: payCycle } = await admin.from('payroll_cycles').insert({
    workspace_id: workspaceId,
    month: 9,
    year: 2026,
    status: 'processed',
    total_payout: 68500.00,
  }).select('id').single();

  if (payCycle?.id && firstEmp?.workspace_member_id) {
    await admin.from('payroll_slips').insert({
      payroll_cycle_id: payCycle.id,
      workspace_member_id: firstEmp.workspace_member_id,
      gross_salary: 85000.00,
      total_earnings: 85000.00,
      total_deductions: 16500.00,
      net_payable: 68500.00,
      status: 'PROCESSED',
    });
  }

  console.log(`\n🎉 === SUCCESS! Seeded ${seededCount} employees & ALL HR modules for Workspace ${workspaceId} === 🎉`);
}

run().catch(console.error);
