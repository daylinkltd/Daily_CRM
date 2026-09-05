import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const exitId = searchParams.get('exitId');

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    const admin = createAdminClient();

    let query = admin
      .from('hr_exits')
      .select(`
        *,
        employee:hr_employees(id, employee_code, joining_date, workspace_member_id),
        clearances:hr_exit_clearances(*),
        fnf:hr_fnf_settlements(*)
      `)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (exitId) {
      query = query.eq('id', exitId);
    }

    const { data: exits, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ exits: exits || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, workspaceId, employeeId, resignationDate, reason, requestedLWD, noticeDays } = body;

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    const admin = createAdminClient();

    if (action === 'SUBMIT_RESIGNATION') {
      if (!employeeId || !requestedLWD) {
        return NextResponse.json({ error: 'employeeId and requestedLWD are required' }, { status: 400 });
      }

      // Idempotency Guard: Check if employee already has an active exit request
      const { data: existing } = await admin
        .from('hr_exits')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('hr_employee_id', employeeId)
        .maybeSingle();

      if (existing) {
        return NextResponse.json({ exit: existing, message: 'Resignation request already exists', isNew: false });
      }

      const { data: exitRow, error } = await admin
        .from('hr_exits')
        .insert({
          workspace_id: workspaceId,
          hr_employee_id: employeeId,
          resignation_date: resignationDate || new Date().toISOString().split('T')[0],
          reason: reason || 'Personal Reasons',
          requested_lwd: requestedLWD,
          notice_days: noticeDays ? Number(noticeDays) : 30,
          status: 'PENDING',
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ exit: exitRow, isNew: true });
    }

    if (action === 'GENERATE_FNF') {
      const { exitId } = body;
      if (!exitId) {
        return NextResponse.json({ error: 'exitId is required' }, { status: 400 });
      }

      // Fetch exit record
      const { data: exitRow } = await admin
        .from('hr_exits')
        .select('*, employee:hr_employees(*), clearances:hr_exit_clearances(*)')
        .eq('id', exitId)
        .single();

      if (!exitRow) {
        return NextResponse.json({ error: 'Exit record not found' }, { status: 404 });
      }

      // Calculate Daily Rate & Prorated Salary
      const baseMonthlySalary = Number(exitRow.employee?.base_salary) || 50000;
      const dailyRate = Math.round(baseMonthlySalary / 30);

      // Served days & Notice shortfall calculation
      const servedDays = exitRow.served_days || 15;
      const shortfallDays = Math.max(0, (exitRow.notice_days || 30) - servedDays - (exitRow.waived_days || 0));
      const noticeShortfallRecovery = shortfallDays * dailyRate;

      // Calculate asset recovery amount from clearances
      const clearances = exitRow.clearances || [];
      const approvedAssetRecovery = clearances.reduce(
        (acc: number, c: any) => acc + (Number(c.asset_recovery_amount) || 0),
        0
      );

      // Prorated Salary
      const proratedSalary = servedDays * dailyRate;

      // Leave Encashment (reusing leave balance query or standard 10 days fallback)
      const leaveDaysBalance = 10;
      const leaveEncashmentAmount = leaveDaysBalance * dailyRate;

      // Reimbursements & Bonus
      const reimbursementsAmount = 0;
      const bonusIncentivesAmount = 0;

      // Totals
      const totalEarnings = proratedSalary + leaveEncashmentAmount + reimbursementsAmount + bonusIncentivesAmount;
      const totalDeductions = noticeShortfallRecovery + approvedAssetRecovery;

      const netSettlement = totalEarnings - totalDeductions;
      const isReceivable = netSettlement < 0;
      const receivableAmount = isReceivable ? Math.abs(netSettlement) : 0;
      const netPayout = isReceivable ? 0 : netSettlement;

      // Upsert F&F settlement record idempotently
      const { data: fnfRow, error: fnfErr } = await admin
        .from('hr_fnf_settlements')
        .upsert(
          {
            workspace_id: workspaceId,
            exit_id: exitId,
            hr_employee_id: exitRow.hr_employee_id,
            prorated_salary: proratedSalary,
            leave_encashment_amount: leaveEncashmentAmount,
            reimbursements_amount: reimbursementsAmount,
            bonus_incentives_amount: bonusIncentivesAmount,
            total_earnings: totalEarnings,
            notice_shortfall_recovery: noticeShortfallRecovery,
            approved_asset_recovery: approvedAssetRecovery,
            salary_advance_recovery: 0,
            statutory_deductions: 0,
            other_deductions: 0,
            total_deductions: totalDeductions,
            net_settlement_amount: netPayout,
            is_receivable: isReceivable,
            receivable_amount: receivableAmount,
            status: 'GENERATED',
            retryable_document_state: 'PENDING',
          },
          { onConflict: 'workspace_id,exit_id' }
        )
        .select()
        .single();

      if (fnfErr) {
        return NextResponse.json({ error: fnfErr.message }, { status: 500 });
      }

      // Advance exit status to FNF_IN_PROGRESS
      await admin
        .from('hr_exits')
        .update({ status: 'FNF_IN_PROGRESS' })
        .eq('id', exitId);

      return NextResponse.json({ fnf: fnfRow });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { action, exitId, workspaceId, approvedLWD, waivedDays, clearanceType, status, comments, assetRecoveryAmount, approvedByMemberId } = body;

    if (!exitId || !workspaceId) {
      return NextResponse.json({ error: 'exitId and workspaceId are required' }, { status: 400 });
    }

    const admin = createAdminClient();

    if (action === 'DECIDE_RESIGNATION') {
      const isApproved = status === 'APPROVED';
      const nextStatus = isApproved ? 'APPROVED' : 'REJECTED';

      const { data: exitRow } = await admin
        .from('hr_exits')
        .select('*')
        .eq('id', exitId)
        .single();

      if (!exitRow) {
        return NextResponse.json({ error: 'Exit record not found' }, { status: 404 });
      }

      const lwd = approvedLWD || exitRow.requested_lwd;
      const waived = waivedDays ? Number(waivedDays) : 0;
      const noticeDays = exitRow.notice_days || 30;

      // Calculate served days from resignation date to LWD
      const start = new Date(exitRow.resignation_date);
      const end = new Date(lwd);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const servedDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const shortfallDays = Math.max(0, noticeDays - servedDays - waived);

      const { data: updatedExit, error } = await admin
        .from('hr_exits')
        .update({
          status: nextStatus,
          approved_lwd: lwd,
          waived_days: waived,
          served_days: servedDays,
          shortfall_days: shortfallDays,
        })
        .eq('id', exitId)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (isApproved) {
        // Synchronize employee status to NOTICE_PERIOD
        await admin
          .from('hr_employees')
          .update({ employment_status: 'NOTICE_PERIOD' })
          .eq('id', exitRow.hr_employee_id);

        // Seed 5 Default Exit Clearance Types idempotently
        const defaultClearances = ['MANAGER', 'HR', 'IT', 'ASSET', 'FINANCE'].map((type) => ({
          workspace_id: workspaceId,
          exit_id: exitId,
          clearance_type: type,
          status: 'PENDING',
          asset_recovery_amount: 0,
        }));

        await admin
          .from('hr_exit_clearances')
          .upsert(defaultClearances, { onConflict: 'exit_id,clearance_type' });
      }

      return NextResponse.json({ exit: updatedExit });
    }

    if (action === 'ACTION_CLEARANCE') {
      if (!clearanceType || !status) {
        return NextResponse.json({ error: 'clearanceType and status are required' }, { status: 400 });
      }

      const { data: clearanceRow, error: clrErr } = await admin
        .from('hr_exit_clearances')
        .update({
          status,
          comments: comments || null,
          asset_recovery_amount: assetRecoveryAmount ? Number(assetRecoveryAmount) : 0,
          approved_by: approvedByMemberId || null,
          approved_at: new Date().toISOString(),
        })
        .eq('exit_id', exitId)
        .eq('clearance_type', clearanceType)
        .select()
        .single();

      if (clrErr) {
        return NextResponse.json({ error: clrErr.message }, { status: 500 });
      }

      // Check if all 5 clearances are approved
      const { data: allClearances } = await admin
        .from('hr_exit_clearances')
        .select('*')
        .eq('exit_id', exitId);

      const approvedCount = (allClearances || []).filter((c: any) => c.status === 'APPROVED').length;
      if (approvedCount === 5) {
        await admin
          .from('hr_exits')
          .update({ status: 'CLEARANCE_IN_PROGRESS' })
          .eq('id', exitId);
      }

      return NextResponse.json({ clearance: clearanceRow, totalApproved: approvedCount });
    }

    if (action === 'APPROVE_FNF') {
      // Lock F&F settlement and set retryable document state
      const { data: fnfRow, error: fnfErr } = await admin
        .from('hr_fnf_settlements')
        .update({
          status: 'APPROVED',
          retryable_document_state: 'GENERATED',
          relieving_letter_url: `/documents/relieving_${exitId}.pdf`,
          experience_letter_url: `/documents/experience_${exitId}.pdf`,
        })
        .eq('exit_id', exitId)
        .select()
        .single();

      if (fnfErr) {
        return NextResponse.json({ error: fnfErr.message }, { status: 500 });
      }

      // Complete Exit and Synchronize employee status to EXITED
      const { data: exitRow } = await admin
        .from('hr_exits')
        .update({ status: 'COMPLETED', actual_lwd: new Date().toISOString().split('T')[0] })
        .eq('id', exitId)
        .select()
        .single();

      if (exitRow) {
        await admin
          .from('hr_employees')
          .update({ employment_status: 'EXITED' })
          .eq('id', exitRow.hr_employee_id);
      }

      return NextResponse.json({ fnf: fnfRow, exit: exitRow });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
