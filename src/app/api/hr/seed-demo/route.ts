import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/hr/seed-demo
 *
 * Body: { targetEmail?: string, workspaceId?: string }
 *
 * Seeds a comprehensive 10-employee demo dataset into employee_profiles, hr_employees,
 * workspace_members, profiles, onboarding, recruitment, attendance, and performance tables
 * so that /employees, /employee-onboarding, /recruitment, etc. show live demo data.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const targetEmail = body.targetEmail || 'info@nexora.in';
    let workspaceId = body.workspaceId;

    const admin = createAdminClient();

    // 1. Resolve workspace_id for info@nexora.in
    if (!workspaceId) {
      const { data: profile } = await admin
        .from('profiles')
        .select('user_id')
        .eq('email', targetEmail)
        .maybeSingle();

      if (profile?.user_id) {
        const { data: membership } = await admin
          .from('workspace_members')
          .select('workspace_id')
          .eq('user_id', profile.user_id)
          .maybeSingle();
        workspaceId = membership?.workspace_id;
      }

      if (!workspaceId) {
        const { data: ws } = await admin
          .from('workspaces')
          .select('id, name')
          .ilike('name', '%nexora%')
          .limit(1)
          .maybeSingle();
        workspaceId = ws?.id;
      }

      if (!workspaceId) {
        const { data: fallbackWs } = await admin.from('workspaces').select('id, name').limit(1).single();
        workspaceId = fallbackWs?.id;
      }
    }

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'No workspace found for info@nexora.in. Please create a workspace first.' },
        { status: 404 }
      );
    }

    // 2. Fetch or create Departments
    const deptNames = ['Engineering', 'Sales & Marketing', 'Human Resources', 'Operations', 'Customer Success'];
    const departmentMap: Record<string, string> = {};

    const { data: existingDepts } = await admin
      .from('departments')
      .select('id, name')
      .eq('workspace_id', workspaceId);

    if (existingDepts && existingDepts.length > 0) {
      existingDepts.forEach((d) => (departmentMap[d.name] = d.id));
    }

    for (const name of deptNames) {
      if (!departmentMap[name]) {
        const { data: newDept } = await admin
          .from('departments')
          .insert({ workspace_id: workspaceId, name })
          .select('id, name')
          .single();
        if (newDept) departmentMap[newDept.name] = newDept.id;
      }
    }

    // 3. Fetch or create Designations
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
    const { data: existingDesigs } = await admin
      .from('designations')
      .select('id, title')
      .eq('workspace_id', workspaceId);

    if (existingDesigs && existingDesigs.length > 0) {
      existingDesigs.forEach((d) => (designationMap[d.title] = d.id));
    }

    for (const title of desigTitles) {
      if (!designationMap[title]) {
        const { data: newDesig } = await admin
          .from('designations')
          .insert({ workspace_id: workspaceId, title })
          .select('id, title')
          .single();
        if (newDesig) designationMap[newDesig.title] = newDesig.id;
      }
    }

    // 4. Define 10 Employees covering the Employee Lifecycle
    const DEMO_EMPLOYEES = [
      {
        full_name: 'Aarav Sharma',
        email: 'aarav.sharma@nexora.in',
        department: 'Engineering',
        designation: 'Senior Lead Architect',
        employee_code: 'NEX-1001',
        joining_date: '2023-01-15',
        status: 'ACTIVE',
        salary: 135000,
        stage_desc: 'Active - Lead Architect (KPI Score: 4.9)',
      },
      {
        full_name: 'Priya Patel',
        email: 'priya.patel@nexora.in',
        department: 'Sales & Marketing',
        designation: 'Enterprise Account Executive',
        employee_code: 'NEX-1002',
        joining_date: '2023-06-01',
        status: 'ACTIVE',
        salary: 95000,
        stage_desc: 'Active - Top Sales Performer',
      },
      {
        full_name: 'Rohan Verma',
        email: 'rohan.verma@nexora.in',
        department: 'Human Resources',
        designation: 'HR Operations Specialist',
        employee_code: 'NEX-1003',
        joining_date: '2023-08-10',
        status: 'ACTIVE',
        salary: 75000,
        stage_desc: 'Active - HR Specialist',
      },
      {
        full_name: 'Ananya Gupta',
        email: 'ananya.gupta@nexora.in',
        department: 'Engineering',
        designation: 'Frontend Tech Lead',
        employee_code: 'NEX-1004',
        joining_date: '2024-01-10',
        status: 'ACTIVE',
        salary: 105000,
        stage_desc: 'Active - Frontend Lead',
      },
      {
        full_name: 'Vikram Singh',
        email: 'vikram.singh@nexora.in',
        department: 'Operations',
        designation: 'Operations Manager',
        employee_code: 'NEX-1005',
        joining_date: '2024-02-15',
        status: 'ACTIVE',
        salary: 90000,
        stage_desc: 'Active - Operations Manager',
      },
      {
        full_name: 'Sneha Reddy',
        email: 'sneha.reddy@nexora.in',
        department: 'Customer Success',
        designation: 'Customer Success Lead',
        employee_code: 'NEX-1006',
        joining_date: '2024-04-01',
        status: 'ACTIVE',
        salary: 82000,
        stage_desc: 'Active - CS Lead (CSAT 98%)',
      },
      {
        full_name: 'Kabir Mehta',
        email: 'kabir.mehta@nexora.in',
        department: 'Engineering',
        designation: 'DevOps Lead Engineer',
        employee_code: 'NEX-1007',
        joining_date: '2024-05-12',
        status: 'ACTIVE',
        salary: 115000,
        stage_desc: 'Active - DevOps Lead',
      },
      {
        full_name: 'Neha Kapoor',
        email: 'neha.kapoor@nexora.in',
        department: 'Engineering',
        designation: 'Associate Software Engineer',
        employee_code: 'NEX-1008',
        joining_date: '2026-09-01',
        status: 'PROBATION',
        salary: 65000,
        stage_desc: 'Onboarding & BGV Phase (Document Verification Pending)',
      },
      {
        full_name: 'Siddharth Nair',
        email: 'siddharth.nair@nexora.in',
        department: 'Sales & Marketing',
        designation: 'Senior Sales Representative',
        employee_code: 'NEX-1009',
        joining_date: '2023-11-20',
        status: 'PROBATION',
        salary: 78000,
        stage_desc: 'Exit & Offboarding Phase (Resignation Filed / Handover)',
      },
      {
        full_name: 'Ishita Roy',
        email: 'ishita.roy@nexora.in',
        department: 'Human Resources',
        designation: 'Talent Acquisition Partner',
        employee_code: 'NEX-1010',
        joining_date: '2026-10-01',
        status: 'PROBATION',
        salary: 85000,
        stage_desc: 'Recruitment & Hiring Phase (Offer Letter Released)',
      },
    ];

    const seededList = [];

    for (const emp of DEMO_EMPLOYEES) {
      const deptId = departmentMap[emp.department];
      const desigId = designationMap[emp.designation];

      // 1. Ensure Auth user & Profile exist
      let userId: string | null = null;
      const { data: existingProfile } = await admin
        .from('profiles')
        .select('user_id')
        .eq('email', emp.email)
        .maybeSingle();

      if (existingProfile?.user_id) {
        userId = existingProfile.user_id;
      } else {
        try {
          const { data: newUser } = await admin.auth.admin.createUser({
            email: emp.email,
            email_confirm: true,
            user_metadata: { full_name: emp.full_name },
          });

          if (newUser?.user?.id) {
            userId = newUser.user.id;
            await admin.from('profiles').upsert({
              user_id: userId,
              full_name: emp.full_name,
              email: emp.email,
            }, { onConflict: 'user_id' });
          }
        } catch (err) {}
      }

      if (!userId) continue;

      // 2. Ensure Workspace Membership (`workspace_members`) exists
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
        const { data: newMem } = await admin
          .from('workspace_members')
          .insert({
            workspace_id: workspaceId,
            user_id: userId,
            role: 'member',
          })
          .select('id')
          .single();
        memberId = newMem?.id || null;
      }

      if (!memberId) continue;

      // 3. Insert into `employee_profiles` (The main live employees table for UI)
      await admin
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

      // 4. Also insert into `hr_employees` extension table
      try {
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
      } catch (err) {}

      seededList.push({
        id: memberId,
        name: emp.full_name,
        email: emp.email,
        code: emp.employee_code,
        department: emp.department,
        designation: emp.designation,
        status: emp.status,
      });
    }

    // 5. Seed Onboarding Task Templates & Employee Tasks (for /employee-onboarding UI)
    const defaultOnboardingTasks = [
      { workspace_id: workspaceId, title: 'Submit PAN & Government ID Proof', description: 'Upload identity proof', category: 'DOCUMENT' },
      { workspace_id: workspaceId, title: 'Bank Account & Salary Disbursement Details', description: 'Void cheque & IFSC', category: 'DOCUMENT' },
      { workspace_id: workspaceId, title: 'IT Hardware & Work Laptop Provisioning', description: 'Laptop & Security Key', category: 'ASSET' },
      { workspace_id: workspaceId, title: 'Acknowledge Employee Handbook & NDA', description: 'Sign policy handbook', category: 'POLICY' },
    ];

    const seededTasks = [];
    for (const t of defaultOnboardingTasks) {
      try {
        const { data: seededT } = await admin
          .from('hr_onboarding_tasks')
          .insert(t)
          .select('*')
          .single();
        if (seededT) seededTasks.push(seededT);
      } catch (err) {}
    }

    // Assign onboarding tasks to employees
    if (seededTasks.length > 0 && seededList.length > 0) {
      for (const emp of seededList) {
        for (const task of seededTasks) {
          try {
            await admin
              .from('hr_onboarding_employee_tasks')
              .insert({
                workspace_id: workspaceId,
                hr_employee_id: emp.id,
                task_id: task.id,
                status: emp.status === 'ACTIVE' ? 'VERIFIED' : 'PENDING',
              });
          } catch (err) {}
        }
      }
    }

    // 6. Seed Recruitment Jobs & Candidates (for /recruitment UI)
    let jobId: string | null = null;
    try {
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
      jobId = job?.id || null;
    } catch (err) {}

    if (jobId) {
      const candidatesData = [
        { full_name: 'Ishita Roy', email: 'ishita.roy@nexora.in', phone: '+919876543210', stage: 'OFFER' },
        { full_name: 'Rahul Kapur', email: 'rahul.kapur@gmail.com', phone: '+919812345678', stage: 'INTERVIEW' },
        { full_name: 'Meera Sharma', email: 'meera.sharma@yahoo.com', phone: '+919899887766', stage: 'APPLIED' },
      ];

      for (const cand of candidatesData) {
        try {
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
              job_id: jobId,
              candidate_id: newCand.id,
              status: cand.stage === 'OFFER' ? 'OFFER_ACCEPTED' : 'INTERVIEW_SCHEDULED',
            });
          }
        } catch (err) {}
      }
    }

    // 7. Seed Real Attendance Logs (for /attendance UI)
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    for (const emp of seededList) {
      try {
        await admin.from('attendance_logs').upsert([
          {
            workspace_id: workspaceId,
            employee_code: emp.code,
            date: today,
            clock_in: `${today}T09:05:00Z`,
            status: 'PRESENT',
            notes: 'Verified GPS mobile clock-in',
          },
          {
            workspace_id: workspaceId,
            employee_code: emp.code,
            date: yesterday,
            clock_in: `${yesterday}T09:00:00Z`,
            clock_out: `${yesterday}T18:00:00Z`,
            status: 'PRESENT',
            notes: 'Full shift completed (8.5 hrs)',
          },
        ], { onConflict: 'workspace_id,employee_code,date' });
      } catch (err) {}
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully populated 10 employees into employee_profiles, onboarding, and recruitment!',
      target_account: targetEmail,
      workspace_id: workspaceId,
      total_employees_created: seededList.length,
      employees: seededList,
    });
  } catch (err: any) {
    console.error('[seed-demo-hr]', err);
    return NextResponse.json({ error: err.message || 'Failed to seed demo data' }, { status: 500 });
  }
}
