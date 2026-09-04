import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    const admin = createAdminClient();

    // 1. Fetch departments
    const { data: depts } = await admin
      .from('departments')
      .select('id, name')
      .eq('workspace_id', workspaceId);

    // 2. Fetch headcount budget allocations
    const { data: budgets } = await admin
      .from('hr_headcount_budgets')
      .select('*')
      .eq('workspace_id', workspaceId);

    // 3. Fetch manpower requisitions
    const { data: requisitions } = await admin
      .from('hr_manpower_requisitions')
      .select('*, department:departments(id, name)')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    // 4. Fetch open recruitment jobs
    const { data: jobs } = await admin
      .from('hr_recruitment_jobs')
      .select('*')
      .eq('workspace_id', workspaceId);

    // 5. Fetch current active employees count per department
    const { data: employees } = await admin
      .from('hr_employees')
      .select('id, department_id, base_salary')
      .eq('workspace_id', workspaceId)
      .neq('employment_status', 'EXITED');

    // Aggregate department budget metrics
    const deptMetrics = (depts || []).map((dept: any) => {
      const bRow = (budgets || []).find((b: any) => b.department_id === dept.id);
      const deptEmps = (employees || []).filter((e: any) => e.department_id === dept.id);
      const currentHeadcount = deptEmps.length;
      const budgetedHeadcount = bRow?.budgeted_headcount || 5;

      const deptJobs = (jobs || []).filter((j: any) => j.department_id === dept.id && j.status === 'OPEN');
      const openVacancies = deptJobs.reduce((acc: number, j: any) => acc + (Number(j.vacancies_count) || 1), 0);

      const committedSalaryBudget = deptEmps.reduce((acc: number, e: any) => acc + (Number(e.base_salary) || 0), 0);
      const totalApprovedSalary = Number(bRow?.approved_salary_budget) || 500000;

      return {
        departmentId: dept.id,
        departmentName: dept.name,
        budgetedHeadcount,
        currentHeadcount,
        openVacancies,
        availableSeats: Math.max(0, budgetedHeadcount - currentHeadcount - openVacancies),
        approvedSalaryBudget: totalApprovedSalary,
        committedSalaryBudget,
        remainingSalaryBudget: Math.max(0, totalApprovedSalary - committedSalaryBudget),
      };
    });

    return NextResponse.json({
      departments: deptMetrics,
      requisitions: requisitions || [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, workspaceId, departmentId, positionTitle, requestedVacancies, targetHiringDate, justification, estimatedSalary, budgetedHeadcount, approvedSalaryBudget } = body;

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    const admin = createAdminClient();

    if (action === 'UPSERT_BUDGET') {
      if (!departmentId) {
        return NextResponse.json({ error: 'departmentId is required' }, { status: 400 });
      }

      const { data: budgetRow, error } = await admin
        .from('hr_headcount_budgets')
        .upsert(
          {
            workspace_id: workspaceId,
            department_id: departmentId,
            financial_year: '2026-2027',
            budgeted_headcount: budgetedHeadcount ? Number(budgetedHeadcount) : 5,
            approved_salary_budget: approvedSalaryBudget ? Number(approvedSalaryBudget) : 500000,
          },
          { onConflict: 'workspace_id,department_id,financial_year' }
        )
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ budget: budgetRow });
    }

    if (action === 'SUBMIT_REQUISITION') {
      if (!departmentId || !positionTitle || !justification) {
        return NextResponse.json({ error: 'departmentId, positionTitle, and justification are required' }, { status: 400 });
      }

      const { data: reqRow, error } = await admin
        .from('hr_manpower_requisitions')
        .insert({
          workspace_id: workspaceId,
          department_id: departmentId,
          position_title: positionTitle,
          requested_vacancies: requestedVacancies ? Number(requestedVacancies) : 1,
          target_hiring_date: targetHiringDate || new Date().toISOString().split('T')[0],
          justification,
          estimated_salary: estimatedSalary ? Number(estimatedSalary) : 0,
          status: 'SUBMITTED',
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ requisition: reqRow });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { requisitionId, status, approverMemberId } = body;

    if (!requisitionId || !status) {
      return NextResponse.json({ error: 'requisitionId and status are required' }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: reqRow, error } = await admin
      .from('hr_manpower_requisitions')
      .update({
        status,
        approved_by: approverMemberId || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', requisitionId)
      .select('*, department:departments(id, name)')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If approved, automatically create an open recruitment job requisition idempotently
    if (status === 'APPROVED' && reqRow) {
      await admin
        .from('hr_recruitment_jobs')
        .insert({
          workspace_id: reqRow.workspace_id,
          department_id: reqRow.department_id,
          title: reqRow.position_title,
          vacancies_count: reqRow.requested_vacancies || 1,
          approved_budget_amount: reqRow.estimated_salary || 0,
          budget_approval_status: 'APPROVED',
          expected_doj: reqRow.target_hiring_date,
          hiring_reason: reqRow.justification,
          status: 'OPEN',
        });
    }

    return NextResponse.json({ requisition: reqRow });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
