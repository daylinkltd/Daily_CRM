import { NextResponse } from 'next/server';
import { ApprovalService } from '@/lib/hr/approval-service';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const moduleFilter = searchParams.get('module');

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    const instances = await ApprovalService.getWorkspaceApprovals(workspaceId, moduleFilter || undefined);
    return NextResponse.json({ instances });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { workspaceId, module, recordId, conditionValue } = body;

    if (!workspaceId || !module || !recordId) {
      return NextResponse.json({ error: 'workspaceId, module, and recordId are required' }, { status: 400 });
    }

    const result = await ApprovalService.createApprovalInstance({
      workspaceId,
      module,
      recordId,
      conditionValue: conditionValue ? Number(conditionValue) : 0,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { instanceId, stepNumber, approverMemberId, action, comments } = body;

    if (!instanceId || !stepNumber || !action) {
      return NextResponse.json({ error: 'instanceId, stepNumber, and action are required' }, { status: 400 });
    }

    const result = await ApprovalService.actionApprovalStep({
      instanceId,
      stepNumber: Number(stepNumber),
      approverMemberId: approverMemberId || 'hr_admin',
      action,
      comments,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
