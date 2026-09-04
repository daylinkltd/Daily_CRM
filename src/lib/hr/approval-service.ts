import { createAdminClient } from '@/lib/supabase/admin';

export interface CreateApprovalParams {
  workspaceId: string;
  module: 'LEAVE' | 'EXPENSE' | 'REQUEST' | 'PROMOTION' | 'RESIGNATION';
  recordId: string;
  conditionValue?: number;
}

export interface ActionStepParams {
  instanceId: string;
  stepNumber: number;
  approverMemberId: string;
  action: 'APPROVED' | 'REJECTED';
  comments?: string;
}

export class ApprovalService {
  /**
   * Initializes or fetches an approval workflow instance for a given entity record
   */
  static async createApprovalInstance({
    workspaceId,
    module,
    recordId,
    conditionValue = 0,
  }: CreateApprovalParams) {
    const admin = createAdminClient();

    // 1. Idempotency Check: Return existing instance if one already exists for this record
    const { data: existingInstance } = await admin
      .from('hr_approval_instances')
      .select('*, steps:hr_approval_steps(*)')
      .eq('workspace_id', workspaceId)
      .eq('module', module)
      .eq('record_id', recordId)
      .maybeSingle();

    if (existingInstance) {
      return { instance: existingInstance, isNew: false };
    }

    // 2. Fetch configured workflows for this module
    let { data: workflows, error: wfErr } = await admin
      .from('hr_approval_workflows')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('module', module)
      .order('step_number', { ascending: true });

    if (wfErr) {
      throw new Error(`Failed to query approval workflows: ${wfErr.message}`);
    }

    // Seed default 2-step approval workflow if none exists for this module
    if (!workflows || workflows.length === 0) {
      const defaultWfs = [
        {
          workspace_id: workspaceId,
          module,
          step_number: 1,
          approver_type: 'MANAGER',
          condition_type: 'ALWAYS',
          condition_value: 0,
        },
        {
          workspace_id: workspaceId,
          module,
          step_number: 2,
          approver_type: 'HR_ADMIN',
          condition_type: 'ALWAYS',
          condition_value: 0,
        },
      ];

      const { data: seeded } = await admin
        .from('hr_approval_workflows')
        .insert(defaultWfs)
        .select('*');

      workflows = seeded || [];
    }

    // 3. Create approval instance
    const { data: instance, error: instErr } = await admin
      .from('hr_approval_instances')
      .insert({
        workspace_id: workspaceId,
        module,
        record_id: recordId,
        current_step: 1,
        status: 'PENDING',
      })
      .select('*')
      .single();

    if (instErr || !instance) {
      throw new Error(`Failed to create approval instance: ${instErr?.message}`);
    }

    // 4. Create corresponding approval steps
    const stepRows = (workflows || []).map((wf: any) => ({
      instance_id: instance.id,
      step_number: wf.step_number,
      status: 'PENDING',
      comments: null,
    }));

    const { data: createdSteps } = await admin
      .from('hr_approval_steps')
      .insert(stepRows)
      .select('*');

    return {
      instance: { ...instance, steps: createdSteps || [] },
      isNew: true,
    };
  }

  /**
   * Actions (Approves or Rejects) a specific step in an approval workflow
   */
  static async actionApprovalStep({
    instanceId,
    stepNumber,
    approverMemberId,
    action,
    comments,
  }: ActionStepParams) {
    const admin = createAdminClient();

    // 1. Fetch current instance with steps
    const { data: instance, error: instErr } = await admin
      .from('hr_approval_instances')
      .select('*, steps:hr_approval_steps(*)')
      .eq('id', instanceId)
      .single();

    if (instErr || !instance) {
      throw new Error('Approval instance not found');
    }

    if (instance.status !== 'PENDING') {
      return { instance, message: `Instance is already ${instance.status}` };
    }

    const currentStepRow = (instance.steps || []).find((s: any) => s.step_number === stepNumber);
    if (!currentStepRow) {
      throw new Error(`Approval step ${stepNumber} does not exist for this instance`);
    }

    if (currentStepRow.status !== 'PENDING') {
      return { instance, message: `Step ${stepNumber} has already been actioned` };
    }

    // 2. Resolve approver hr_employees ID if available
    const { data: emp } = await admin
      .from('hr_employees')
      .select('id')
      .eq('workspace_id', instance.workspace_id)
      .eq('workspace_member_id', approverMemberId)
      .maybeSingle();

    // 3. Action the step
    await admin
      .from('hr_approval_steps')
      .update({
        status: action,
        comments: comments || null,
        acted_at: new Date().toISOString(),
        approver_employee_id: emp?.id || null,
      })
      .eq('id', currentStepRow.id);

    // 4. Update overall instance status
    const allSteps = instance.steps || [];
    const totalSteps = allSteps.length;

    let nextStatus: 'PENDING' | 'APPROVED' | 'REJECTED' = 'PENDING';
    let nextStepNumber = instance.current_step;

    if (action === 'REJECTED') {
      nextStatus = 'REJECTED';
    } else if (action === 'APPROVED') {
      if (stepNumber < totalSteps) {
        nextStatus = 'PENDING';
        nextStepNumber = stepNumber + 1;
      } else {
        nextStatus = 'APPROVED';
      }
    }

    const { data: updatedInstance } = await admin
      .from('hr_approval_instances')
      .update({
        status: nextStatus,
        current_step: nextStepNumber,
      })
      .eq('id', instanceId)
      .select('*, steps:hr_approval_steps(*)')
      .single();

    return {
      instance: updatedInstance,
      message: `Step ${stepNumber} ${action.toLowerCase()} successfully`,
    };
  }

  /**
   * Fetches all pending approval instances for a workspace
   */
  static async getWorkspaceApprovals(workspaceId: string, moduleFilter?: string) {
    const admin = createAdminClient();

    let query = admin
      .from('hr_approval_instances')
      .select('*, steps:hr_approval_steps(*)')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (moduleFilter && moduleFilter !== 'ALL') {
      query = query.eq('module', moduleFilter);
    }

    const { data: instances, error } = await query;
    if (error) {
      throw new Error(`Failed to fetch approvals: ${error.message}`);
    }

    return instances || [];
  }
}
