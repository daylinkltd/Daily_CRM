import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const employeeId = searchParams.get('employeeId');

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    const admin = createAdminClient();

    // 1. Fetch template tasks for the workspace
    let { data: templates, error: tmplErr } = await admin
      .from('hr_onboarding_tasks')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true });

    if (tmplErr) {
      return NextResponse.json({ error: tmplErr.message }, { status: 500 });
    }

    // Seed default template tasks if none exist yet for this workspace
    if (!templates || templates.length === 0) {
      const defaultTasks = [
        { workspace_id: workspaceId, title: 'Submit PAN & Government ID Proof', description: 'Upload government-issued identity proof for compliance verification', category: 'DOCUMENT' },
        { workspace_id: workspaceId, title: 'Bank Account & Salary Disbursement Details', description: 'Provide bank account number, IFSC code, and void cheque copy', category: 'DOCUMENT' },
        { workspace_id: workspaceId, title: 'IT Hardware & Work Laptop Provisioning', description: 'Receive laptop, workstation credentials, and security key', category: 'ASSET' },
        { workspace_id: workspaceId, title: 'Acknowledge Company Code of Conduct & HR Policy', description: 'Read and digitally sign the employee handbook and NDA', category: 'POLICY' },
        { workspace_id: workspaceId, title: 'Enterprise Email & Worksuite Account Setup', description: 'Set up company email, slack/teams, and CRM permissions', category: 'ACCOUNT_CREATION' },
      ];

      const { data: seeded } = await admin
        .from('hr_onboarding_tasks')
        .insert(defaultTasks)
        .select('*');

      templates = seeded || [];
    }

    // 2. If employeeId is provided, fetch or idempotently initialize employee tasks
    let employeeTasks: any[] = [];
    if (employeeId) {
      const { data: existingTasks } = await admin
        .from('hr_onboarding_employee_tasks')
        .select('*, task:hr_onboarding_tasks(*)')
        .eq('workspace_id', workspaceId)
        .eq('hr_employee_id', employeeId);

      if (existingTasks && existingTasks.length > 0) {
        employeeTasks = existingTasks;
      } else if (templates && templates.length > 0) {
        // Idempotently initialize employee tasks from templates
        const newEmpTasks = templates.map((t: any) => ({
          workspace_id: workspaceId,
          hr_employee_id: employeeId,
          task_id: t.id,
          status: 'PENDING',
        }));

        await admin.from('hr_onboarding_employee_tasks').insert(newEmpTasks);

        const { data: freshlyAssigned } = await admin
          .from('hr_onboarding_employee_tasks')
          .select('*, task:hr_onboarding_tasks(*)')
          .eq('workspace_id', workspaceId)
          .eq('hr_employee_id', employeeId);

        employeeTasks = freshlyAssigned || [];
      }
    }

    return NextResponse.json({
      templates: templates || [],
      employeeTasks,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { workspaceId, title, description, category, tasks } = body;

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    const admin = createAdminClient();

    if (Array.isArray(tasks) && tasks.length > 0) {
      const rows = tasks
        .filter((t: any) => t.title && t.title.trim())
        .map((t: any) => ({
          workspace_id: workspaceId,
          title: t.title.trim(),
          description: t.description || null,
          category: t.category || 'DOCUMENT',
        }));

      if (rows.length === 0) {
        return NextResponse.json({ error: 'At least one valid task title is required' }, { status: 400 });
      }

      const { data: created, error } = await admin
        .from('hr_onboarding_tasks')
        .insert(rows)
        .select('*');

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ tasks: created });
    }

    if (!title) {
      return NextResponse.json({ error: 'title or tasks array is required' }, { status: 400 });
    }

    const { data: task, error } = await admin
      .from('hr_onboarding_tasks')
      .insert({
        workspace_id: workspaceId,
        title,
        description: description || null,
        category: category || 'DOCUMENT',
      })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ task });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { taskInstanceId, status, verifiedByMemberId } = body;

    if (!taskInstanceId) {
      return NextResponse.json({ error: 'taskInstanceId is required' }, { status: 400 });
    }

    const admin = createAdminClient();

    const patch: Record<string, any> = {};
    if (status !== undefined) {
      patch.status = status;
      if (status === 'COMPLETED') {
        patch.completed_at = new Date().toISOString();
      }
    }
    if (verifiedByMemberId !== undefined) {
      patch.verified_by = verifiedByMemberId;
    }

    const { data: updated, error } = await admin
      .from('hr_onboarding_employee_tasks')
      .update(patch)
      .eq('id', taskInstanceId)
      .select('*, task:hr_onboarding_tasks(*)')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ employeeTask: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
