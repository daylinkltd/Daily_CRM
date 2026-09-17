import { createAdminClient } from '../src/lib/supabase/admin';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const RAW_PAYROLL = [
  { month: 'SEP-2026', empCode: 'EMP001', name: 'Amit Kulkarni', basic: 55000, hra: 3000, allowances: 2000, pf: 600, lop: 0, otherDed: 0, netPay: 59400 },
  { month: 'SEP-2026', empCode: 'EMP002', name: 'Sneha Patil', basic: 42000, hra: 2500, allowances: 1500, pf: 600, lop: 0, otherDed: 0, netPay: 45400 },
  { month: 'SEP-2026', empCode: 'EMP003', name: 'Rahul Desai', basic: 48000, hra: 3000, allowances: 1800, pf: 600, lop: 0, otherDed: 0, netPay: 52200 },
  { month: 'SEP-2026', empCode: 'EMP004', name: 'Pooja Joshi', basic: 32000, hra: 2000, allowances: 1200, pf: 600, lop: 0, otherDed: 0, netPay: 34600 },
  { month: 'SEP-2026', empCode: 'EMP005', name: 'Vikram Naik', basic: 38000, hra: 2500, allowances: 1500, pf: 600, lop: 0, otherDed: 0, netPay: 41400 },
  { month: 'SEP-2026', empCode: 'EMP006', name: 'Kiran More', basic: 36000, hra: 2200, allowances: 1400, pf: 600, lop: 0, otherDed: 0, netPay: 39200 },
  { month: 'SEP-2026', empCode: 'EMP007', name: 'Neha Shah', basic: 30000, hra: 1800, allowances: 1200, pf: 600, lop: 0, otherDed: 0, netPay: 32400 },
  { month: 'SEP-2026', empCode: 'EMP008', name: 'Suresh Patil', basic: 40000, hra: 2500, allowances: 1500, pf: 600, lop: 0, otherDed: 0, netPay: 43400 },
  { month: 'SEP-2026', empCode: 'EMP009', name: 'Meera Kulkarni', basic: 35000, hra: 2200, allowances: 1300, pf: 600, lop: 0, otherDed: 0, netPay: 37900 },
  { month: 'SEP-2026', empCode: 'EMP010', name: 'Mahesh Jadhav', basic: 34000, hra: 2200, allowances: 1200, pf: 600, lop: 0, otherDed: 0, netPay: 37000 }
];

async function run() {
  const admin = createAdminClient();
  const workspaceId = 'e4cca776-684e-48c2-b93d-d4f4c34e443b';

  console.log('Seeding payroll data into workspace:', workspaceId);

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

  // 1. Ensure Payroll Cycle exists for SEP-2026 (Month: 9, Year: 2026)
  const totalPayout = RAW_PAYROLL.reduce((sum, p) => sum + p.netPay, 0);

  let cycleId: string | null = null;
  const { data: existingCycle } = await admin
    .from('payroll_cycles')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('month', 9)
    .eq('year', 2026)
    .maybeSingle();

  if (existingCycle?.id) {
    cycleId = existingCycle.id;
    await admin.from('payroll_cycles').update({ status: 'processed', total_payout: totalPayout }).eq('id', cycleId);
  } else {
    const { data: newCycle, error: cErr } = await admin
      .from('payroll_cycles')
      .insert({
        workspace_id: workspaceId,
        month: 9,
        year: 2026,
        status: 'processed',
        total_payout: totalPayout,
      })
      .select('id')
      .single();

    if (cErr) {
      console.error('Error creating payroll cycle:', cErr.message);
      process.exit(1);
    }
    cycleId = newCycle.id;
  }

  console.log('Payroll Cycle ID for SEP-2026:', cycleId, 'Total Payout: ₹', totalPayout);

  let successCount = 0;

  for (const pay of RAW_PAYROLL) {
    const memberId = empMap[pay.empCode];
    if (!memberId) {
      console.error(`Member ID not found for ${pay.empCode}`);
      continue;
    }

    const totalEarnings = pay.basic + pay.hra + pay.allowances;
    const totalDeductions = pay.pf + pay.lop + pay.otherDed;

    // Update employee_profiles salary structure
    await admin
      .from('employee_profiles')
      .update({
        basic_salary: pay.basic,
        hra: pay.hra,
        special_allowance: pay.allowances,
        pf_deduction: pay.pf,
        ctc_annual: totalEarnings * 12,
      })
      .eq('workspace_member_id', memberId);

    // Upsert into payslips
    const { error: slipErr } = await admin
      .from('payslips')
      .upsert({
        workspace_id: workspaceId,
        payroll_cycle_id: cycleId,
        workspace_member_id: memberId,
        basic_salary: pay.basic,
        hra: pay.hra,
        special_allowance: pay.allowances,
        total_earnings: totalEarnings,
        pf_deduction: pay.pf,
        unpaid_leave_deduction: pay.lop,
        tds_deduction: pay.otherDed,
        total_deductions: totalDeductions,
        net_payable: pay.netPay,
        status: 'published',
      }, { onConflict: 'payroll_cycle_id,workspace_member_id' });

    if (slipErr) {
      console.error(`Error inserting payslip for ${pay.empCode}:`, slipErr.message);
    } else {
      console.log(`✅ ${pay.month} | ${pay.empCode} (${pay.name}) | Basic: ₹${pay.basic} | Net: ₹${pay.netPay}`);
      successCount++;
    }
  }

  console.log(`\n🎉 Seeded ${successCount}/10 payslips & payroll cycle successfully into Nexora Manufacturing!`);
}

run().catch(console.error);
