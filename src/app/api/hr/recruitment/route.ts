import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    const [jobsRes, candidatesRes, appsRes, deptsRes] = await Promise.all([
      supabase.from('hr_recruitment_jobs').select('*, department:departments(id, name)').eq('workspace_id', workspaceId).order('created_at', { ascending: false }),
      supabase.from('hr_candidates').select('*').eq('workspace_id', workspaceId),
      supabase.from('hr_job_applications').select('*, job:hr_recruitment_jobs(*), candidate:hr_candidates(*)').eq('workspace_id', workspaceId),
      supabase.from('departments').select('id, name').eq('workspace_id', workspaceId)
    ]);

    const jobs = jobsRes.data || [];
    const applications = appsRes.data || [];

    // Calculate recruitment budget metrics
    const totalApprovedBudget = jobs.reduce((acc: number, j: any) => acc + (Number(j.approved_budget_amount) || 0), 0);
    const totalVacancies = jobs.reduce((acc: number, j: any) => acc + (Number(j.vacancies_count) || 1), 0);
    const hiredApps = applications.filter((a: any) => a.stage === 'HIRED');
    const committedBudget = hiredApps.reduce((acc: number, a: any) => acc + (Number(a.offered_salary) || 0), 0);

    return NextResponse.json({
      jobs,
      candidates: candidatesRes.data || [],
      applications,
      departments: deptsRes.data || [],
      budgetMetrics: {
        totalApprovedBudget,
        committedBudget,
        remainingBudget: Math.max(0, totalApprovedBudget - committedBudget),
        totalVacancies,
        hiredCount: hiredApps.length,
        openVacancies: Math.max(0, totalVacancies - hiredApps.length)
      }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { action, workspaceId } = body;

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    if (action === 'CREATE_JOB') {
      const {
        title,
        departmentId,
        location,
        employmentType,
        experienceLevel,
        jobDescription,
        costCenter,
        budgetType,
        approvedBudgetAmount,
        budgetApprovalStatus,
        vacanciesCount,
        hiringManager,
        expectedDoj,
        hiringReason,
        designationGrade,
        rolesResponsibilities,
        requiredSkills,
        minExperienceYears,
        maxExperienceYears,
        educationalCriteria,
        minSalary,
        maxSalary,
        salaryCurrency
      } = body;

      const { data: job, error } = await supabase
        .from('hr_recruitment_jobs')
        .insert({
          workspace_id: workspaceId,
          title,
          department_id: departmentId || null,
          location: location || 'Remote / Hybrid',
          employment_type: employmentType || 'FULL_TIME',
          experience_level: experienceLevel || 'Mid-Senior',
          job_description: jobDescription || '',
          cost_center: costCenter || null,
          budget_type: budgetType || 'ANNUAL_BUDGET',
          approved_budget_amount: approvedBudgetAmount ? Number(approvedBudgetAmount) : 0,
          budget_approval_status: budgetApprovalStatus || 'APPROVED',
          vacancies_count: vacanciesCount ? Number(vacanciesCount) : 1,
          hiring_manager: hiringManager || null,
          expected_doj: expectedDoj || null,
          hiring_reason: hiringReason || null,
          designation_grade: designationGrade || null,
          roles_responsibilities: rolesResponsibilities || null,
          required_skills: requiredSkills || null,
          min_experience_years: minExperienceYears ? Number(minExperienceYears) : null,
          max_experience_years: maxExperienceYears ? Number(maxExperienceYears) : null,
          educational_criteria: educationalCriteria || null,
          min_salary: minSalary ? Number(minSalary) : null,
          max_salary: maxSalary ? Number(maxSalary) : null,
          salary_currency: salaryCurrency || 'USD',
          status: 'OPEN'
        })
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ job });
    }

    if (action === 'CONVERT_TO_EMPLOYEE') {
      const { applicationId } = body;
      const admin = createAdminClient();

      // Fetch application with candidate & job
      const { data: appRow } = await admin
        .from('hr_job_applications')
        .select('*, candidate:hr_candidates(*), job:hr_recruitment_jobs(*)')
        .eq('id', applicationId)
        .eq('workspace_id', workspaceId)
        .maybeSingle();

      if (!appRow || !appRow.candidate) {
        return NextResponse.json({ error: 'Candidate application not found' }, { status: 404 });
      }

      // Idempotency Guard: Check if employee already exists for this application
      const { data: existingEmp } = await admin
        .from('hr_employees')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('application_id', applicationId)
        .maybeSingle();

      if (existingEmp) {
        return NextResponse.json({
          employee: existingEmp,
          message: `Candidate already onboarded as ${existingEmp.employee_code}`,
          alreadyExists: true,
        });
      }

      const cand = appRow.candidate;
      const job = appRow.job;

      // Generate next Employee Code (e.g. EMP-1042)
      const empCode = `EMP-${Math.floor(1000 + Math.random() * 9000)}`;

      const { data: emp, error: empErr } = await admin
        .from('hr_employees')
        .insert({
          workspace_id: workspaceId,
          application_id: applicationId,
          employee_code: empCode,
          department_id: job?.department_id || null,
          joining_date: appRow.offered_doj || job?.expected_doj || new Date().toISOString().split('T')[0],
          employment_status: 'PROBATION',
          probation_decision: 'PENDING'
        })
        .select()
        .single();

      if (empErr) {
        return NextResponse.json({ error: empErr.message }, { status: 500 });
      }

      // Update application stage to HIRED
      await admin
        .from('hr_job_applications')
        .update({ stage: 'HIRED', stage_changed_at: new Date().toISOString() })
        .eq('id', applicationId);

      return NextResponse.json({ employee: emp, message: `Candidate onboarded successfully as ${empCode}` });
    }

    if (action === 'ADD_CANDIDATE') {
      const { jobId, fullName, email, phone, resumeUrl } = body;

      // 1. Insert or get candidate
      const { data: cand } = await supabase
        .from('hr_candidates')
        .upsert({
          workspace_id: workspaceId,
          full_name: fullName,
          email,
          phone: phone || null,
          resume_url: resumeUrl || null
        }, { onConflict: 'workspace_id,email' })
        .select()
        .single();

      if (!cand) return NextResponse.json({ error: 'Failed to create candidate' }, { status: 500 });

      // 2. Create Application
      const { data: app, error } = await supabase
        .from('hr_job_applications')
        .insert({
          workspace_id: workspaceId,
          job_id: jobId,
          candidate_id: cand.id,
          stage: 'APPLIED',
          stage_changed_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ candidate: cand, application: app });
    }

    if (action === 'MOVE_STAGE') {
      const { applicationId, newStage } = body;
      const { data: rows, error } = await supabase
        .from('hr_job_applications')
        .update({
          stage: newStage,
          stage_changed_at: new Date().toISOString()
        })
        .eq('id', applicationId)
        .eq('workspace_id', workspaceId)
        .select();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (!rows || rows.length === 0) {
        const { data: stillThere } = await supabase
          .from('hr_job_applications')
          .select('id')
          .eq('id', applicationId)
          .eq('workspace_id', workspaceId)
          .maybeSingle();

        return stillThere
          ? NextResponse.json(
              {
                error:
                  'You do not have permission to move this application. It needs the "people_manage" permission on this workspace.',
              },
              { status: 403 }
            )
          : NextResponse.json(
              { error: 'That application no longer exists' },
              { status: 404 }
            );
      }
      return NextResponse.json({ application: rows[0] });
    }

    if (action === 'DELETE_APPLICATION') {
      const { applicationId } = body;
      const { data: rows, error } = await supabase
        .from('hr_job_applications')
        .delete()
        .eq('id', applicationId)
        .eq('workspace_id', workspaceId)
        .select();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (!rows || rows.length === 0) {
        const { data: stillThere } = await supabase
          .from('hr_job_applications')
          .select('id')
          .eq('id', applicationId)
          .eq('workspace_id', workspaceId)
          .maybeSingle();

        return stillThere
          ? NextResponse.json(
              {
                error:
                  'You do not have permission to remove this application. It needs the "people_manage" permission on this workspace.',
              },
              { status: 403 }
            )
          : NextResponse.json(
              { error: 'That application no longer exists' },
              { status: 404 }
            );
      }
      return NextResponse.json({ deleted: applicationId });
    }

    if (action === 'UPDATE_APPLICATION') {
      const { applicationId, candidateId, fullName, email, phone, jobId, stage, decision, bgvStatus, offeredSalary, offeredDoj } = body;

      if (candidateId && (fullName || email || phone)) {
        const candidatePatch: Record<string, unknown> = {};
        if (fullName !== undefined) candidatePatch.full_name = fullName;
        if (email !== undefined) candidatePatch.email = email || null;
        if (phone !== undefined) candidatePatch.phone = phone || null;

        const { data: candRows, error: candErr } = await supabase
          .from('hr_candidates')
          .update(candidatePatch)
          .eq('id', candidateId)
          .eq('workspace_id', workspaceId)
          .select();
        if (candErr) {
          return NextResponse.json({ error: candErr.message }, { status: 500 });
        }
        if (!candRows || candRows.length === 0) {
          return NextResponse.json(
            { error: 'Could not update the candidate — you may not have permission.' },
            { status: 403 }
          );
        }
      }

      const appPatch: Record<string, unknown> = {};
      if (jobId !== undefined) appPatch.job_id = jobId;
      if (stage !== undefined) {
        appPatch.stage = stage;
        appPatch.stage_changed_at = new Date().toISOString();
      }
      if (decision !== undefined) appPatch.decision = decision;
      if (bgvStatus !== undefined) appPatch.bgv_status = bgvStatus;
      if (offeredSalary !== undefined) appPatch.offered_salary = offeredSalary ? Number(offeredSalary) : null;
      if (offeredDoj !== undefined) appPatch.offered_doj = offeredDoj || null;

      if (Object.keys(appPatch).length > 0) {
        const { data: appRows, error: appErr } = await supabase
          .from('hr_job_applications')
          .update(appPatch)
          .eq('id', applicationId)
          .eq('workspace_id', workspaceId)
          .select();
        if (appErr) {
          return NextResponse.json({ error: appErr.message }, { status: 500 });
        }
        if (!appRows || appRows.length === 0) {
          return NextResponse.json(
            { error: 'Could not update the application — you may not have permission.' },
            { status: 403 }
          );
        }
      }

      return NextResponse.json({ updated: applicationId });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
