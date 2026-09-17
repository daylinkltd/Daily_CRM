import { createAdminClient } from '../src/lib/supabase/admin';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const RAW_EXPENSES = [
  { code: 'EXP001', empCode: 'EMP003', date: '2026-09-10', rawCategory: 'Site Travel', mappedCategory: 'Travel', description: 'Travel to Project Site A', amount: 2450, status: 'pending', raisedBy: 'Project Engineer' },
  { code: 'EXP002', empCode: 'EMP006', date: '2026-09-11', rawCategory: 'Fuel / Transport', mappedCategory: 'Travel', description: 'Operational vehicle fuel', amount: 3180, status: 'approved', raisedBy: 'Operations' },
  { code: 'EXP003', empCode: 'EMP009', date: '2026-09-12', rawCategory: 'Procurement Travel', mappedCategory: 'Travel', description: 'Vendor visit', amount: 1250, status: 'approved', raisedBy: 'Procurement' },
  { code: 'EXP004', empCode: 'EMP005', date: '2026-09-13', rawCategory: 'Plant Expense', mappedCategory: 'Office Supplies', description: 'Safety consumables', amount: 2760, status: 'pending', raisedBy: 'Plant Supervisor' }
];

async function run() {
  const admin = createAdminClient();
  const workspaceId = 'e4cca776-684e-48c2-b93d-d4f4c34e443b';

  console.log('Seeding expense claims into workspace:', workspaceId);

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

  let successCount = 0;

  for (const exp of RAW_EXPENSES) {
    const memberId = empMap[exp.empCode];
    if (!memberId) {
      console.error(`Member ID not found for ${exp.empCode}`);
      continue;
    }

    const fullDescription = `[${exp.code}] ${exp.description} (Type: ${exp.rawCategory} | Raised By: ${exp.raisedBy})`;

    const { error: insertErr } = await admin
      .from('expense_claims')
      .insert({
        workspace_id: workspaceId,
        workspace_member_id: memberId,
        category: exp.mappedCategory,
        amount: exp.amount,
        description: fullDescription,
        status: exp.status,
        created_at: `${exp.date}T10:00:00Z`
      });

    if (insertErr) {
      console.error(`Error adding expense ${exp.code}:`, insertErr.message);
    } else {
      console.log(`✅ ${exp.code} | ${exp.empCode} | ${exp.date} | ₹${exp.amount} | Category: ${exp.mappedCategory} | Status: ${exp.status}`);
      successCount++;
    }
  }

  console.log(`\n🎉 Seeded ${successCount}/4 expense claims successfully into Nexora Manufacturing!`);
}

run().catch(console.error);
