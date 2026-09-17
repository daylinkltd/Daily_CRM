import { createAdminClient } from '../src/lib/supabase/admin';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const RAW_ASSETS = [
  { code: 'AST001', tag: 'DL-LAP-001', category: 'Laptop', item: 'Dell Latitude 5450', empCode: 'EMP001', purchaseDate: '2025-05-10', value: 78000, location: 'Corporate Office', status: 'Assigned' },
  { code: 'AST002', tag: 'DL-LAP-002', category: 'Laptop', item: 'Dell Latitude 5440', empCode: 'EMP003', purchaseDate: '2024-08-15', value: 72000, location: 'Construction Division', status: 'Assigned' },
  { code: 'AST003', tag: 'DL-LAP-003', category: 'Laptop', item: 'HP ProBook 440', empCode: 'EMP004', purchaseDate: '2025-01-12', value: 62000, location: 'Corporate Office', status: 'Assigned' },
  { code: 'AST004', tag: 'DL-MOB-001', category: 'Mobile', item: 'Samsung Galaxy A55', empCode: 'EMP007', purchaseDate: '2025-03-20', value: 34000, location: 'Corporate Office', status: 'Assigned' },
  { code: 'AST005', tag: 'DL-SAF-001', category: 'Safety Equipment', item: 'Safety Helmet Kit', empCode: 'EMP010', purchaseDate: '2026-01-15', value: 2500, location: 'Project Site', status: 'Assigned' }
];

async function run() {
  const admin = createAdminClient();
  const workspaceId = 'e4cca776-684e-48c2-b93d-d4f4c34e443b';

  console.log('Seeding assets into workspace:', workspaceId);

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

  for (const ast of RAW_ASSETS) {
    const memberId = empMap[ast.empCode];
    if (!memberId) {
      console.error(`Workspace member ID not found for ${ast.empCode}`);
      continue;
    }

    const fullAssetName = `[${ast.code}] ${ast.item} (${ast.category} | Value: ₹${ast.value.toLocaleString()} | Location: ${ast.location})`;

    const { error: insertErr } = await admin
      .from('employee_assets')
      .insert({
        workspace_id: workspaceId,
        workspace_member_id: memberId,
        asset_name: fullAssetName,
        serial_number: ast.tag,
        assigned_date: ast.purchaseDate
      });

    if (insertErr) {
      console.error(`Error adding asset ${ast.code}:`, insertErr.message);
    } else {
      console.log(`✅ ${ast.code} | Tag: ${ast.tag} | ${ast.item} | ${ast.empCode} | ₹${ast.value} | Status: ${ast.status}`);
      successCount++;
    }
  }

  console.log(`\n🎉 Seeded ${successCount}/5 assets successfully into Nexora Manufacturing!`);
}

run().catch(console.error);
