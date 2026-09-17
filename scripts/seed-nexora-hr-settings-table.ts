import { createAdminClient } from '../src/lib/supabase/admin';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const RAW_HR_SETTINGS = {
  company_name: 'Popular Group of Industries – Demo Environment',
  demo_employee_count: 10,
  payroll_month: 'September 2026',
  financial_year: '2026-27',
  attendance_cutoff: 'Monthly',
  working_days: 'Monday-Saturday (office/plant variations)',
  currency: 'INR (₹)',
  location: 'Belagavi, Karnataka',
  default_timezone: 'Asia/Kolkata',
  leave_cycle: 'April 1 - March 31',
  payroll_processing_day: '28th of every month'
};

async function run() {
  const admin = createAdminClient();
  const workspaceId = 'e4cca776-684e-48c2-b93d-d4f4c34e443b';

  console.log('Updating HR settings into workspace:', workspaceId);

  // 1. Update workspaces table
  const { error: wsErr } = await admin
    .from('workspaces')
    .update({
      company_name: RAW_HR_SETTINGS.company_name,
      default_currency: 'INR',
      company_address: RAW_HR_SETTINGS.location
    })
    .eq('id', workspaceId);

  if (wsErr) {
    console.error('Error updating workspaces table:', wsErr.message);
  } else {
    console.log(`✅ Updated workspaces table (Company Name & Currency)`);
  }

  // 2. Upsert into hr_operational_settings table
  const { data: existingHos } = await admin
    .from('hr_operational_settings')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('setting_type', 'PAYROLL_CONFIG')
    .eq('scope_type', 'WORKSPACE_DEFAULT')
    .maybeSingle();

  if (existingHos?.id) {
    const { error: uErr } = await admin
      .from('hr_operational_settings')
      .update({
        settings_json: RAW_HR_SETTINGS,
        updated_at: new Date().toISOString()
      })
      .eq('id', existingHos.id);

    if (uErr) console.error('Error updating hr_operational_settings:', uErr.message);
    else console.log(`✅ Updated hr_operational_settings record`);
  } else {
    const { error: iErr } = await admin
      .from('hr_operational_settings')
      .insert({
        workspace_id: workspaceId,
        setting_type: 'PAYROLL_CONFIG',
        scope_type: 'WORKSPACE_DEFAULT',
        settings_json: RAW_HR_SETTINGS
      });

    if (iErr) console.error('Error inserting hr_operational_settings:', iErr.message);
    else console.log(`✅ Inserted hr_operational_settings record`);
  }

  console.log(`\n🎉 HR Settings successfully saved into Nexora Manufacturing!`);
}

run().catch(console.error);
