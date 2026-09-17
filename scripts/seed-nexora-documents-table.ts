import { createAdminClient } from '../src/lib/supabase/admin';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const RAW_DOCUMENTS = [
  { code: 'DOC001', empCode: 'EMP001', docType: 'Aadhaar / ID Proof', status: 'Verified', dateExpiry: '2026-04-10', owner: 'HR' },
  { code: 'DOC002', empCode: 'EMP001', docType: 'Employment Agreement', status: 'Verified', dateExpiry: '2022-06-13', owner: 'HR' },
  { code: 'DOC003', empCode: 'EMP003', docType: 'Educational Certificate', status: 'Verified', dateExpiry: '2021-08-02', owner: 'HR' },
  { code: 'DOC004', empCode: 'EMP005', docType: 'Safety Training Certificate', status: 'Verified', dateExpiry: '2026-06-20', owner: 'Safety' },
  { code: 'DOC005', empCode: 'EMP010', docType: 'Site Safety Training', status: 'Expires 2027-01-15', dateExpiry: '2026-01-15', owner: 'Safety' }
];

async function run() {
  const admin = createAdminClient();
  const workspaceId = 'e4cca776-684e-48c2-b93d-d4f4c34e443b';

  console.log('Seeding official documents into workspace:', workspaceId);

  // Map employee_code to workspace_member_id
  const { data: epList } = await admin
    .from('employee_profiles')
    .select('employee_code, workspace_member_id, document_vault')
    .eq('workspace_id', workspaceId);

  const empMap: Record<string, string> = {};
  const vaultMap: Record<string, any[]> = {};

  if (epList) {
    for (const ep of epList) {
      if (ep.employee_code && ep.workspace_member_id) {
        empMap[ep.employee_code] = ep.workspace_member_id;
        vaultMap[ep.employee_code] = Array.isArray(ep.document_vault) ? ep.document_vault : [];
      }
    }
  }

  let successCount = 0;

  for (const doc of RAW_DOCUMENTS) {
    const memberId = empMap[doc.empCode];
    if (!memberId) {
      console.error(`Workspace member ID not found for ${doc.empCode}`);
      continue;
    }

    const storageMeta = `[${doc.code}] Status: ${doc.status} | Date/Expiry: ${doc.dateExpiry} | Owner: ${doc.owner}`;

    // 1. Insert into employee_documents table
    const { error: insertErr } = await admin
      .from('employee_documents')
      .insert({
        workspace_id: workspaceId,
        workspace_member_id: memberId,
        document_type: doc.docType,
        storage_path: storageMeta,
        created_at: `${doc.dateExpiry}T10:00:00Z`
      });

    if (insertErr) {
      console.error(`Error adding document ${doc.code}:`, insertErr.message);
    } else {
      console.log(`✅ ${doc.code} | ${doc.empCode} | ${doc.docType} | Status: ${doc.status} | Owner: ${doc.owner}`);
      successCount++;
    }

    // 2. Add to employee_profiles document_vault JSONB
    const docObj = {
      doc_id: doc.code,
      type: doc.docType,
      status: doc.status,
      date_expiry: doc.dateExpiry,
      owner: doc.owner
    };
    vaultMap[doc.empCode].push(docObj);
  }

  // Update employee_profiles document_vault
  for (const [empCode, docs] of Object.entries(vaultMap)) {
    if (docs.length > 0) {
      const memberId = empMap[empCode];
      await admin
        .from('employee_profiles')
        .update({ document_vault: docs })
        .eq('workspace_member_id', memberId);
    }
  }

  console.log(`\n🎉 Seeded ${successCount}/5 official documents successfully into Nexora Manufacturing!`);
}

run().catch(console.error);
