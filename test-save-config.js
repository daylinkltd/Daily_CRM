const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env.local') });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing URL or Service Role Key in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key);

async function testSave() {
  const workspaceId = '0384aa61-25ad-440f-9a43-603f9779cde4';
  const textToSave = `What treatment are you looking for?
Display as searchable dropdown with buttons
The treatment list should be categorized for usability while preserving all treatment names exactly.
Cardiology
• Angiography (Including Non-Ionic Contrast)
• Angioplasty
• Cardiac Valve Replacement
• Coronary Artery Bypass Grafting (CABG)
• Heart Double Valve Replacement
• Heart Port Surgery
• Pacemaker Implantation Surgery
• PDA Closure
• VSD Closure / Repair (Adult)
• Left Ventricular Assist Device (LVAD)
• Norwood Surgery
• Atrial Septal Defect (ASD) Repair
Oncology
• Lung Cancer Treatment
• Oral Cancer Treatment
• Ovarian Cancer Treatment`;

  console.log("Attempting to update business_context in chatbot_config...");
  
  const { data, error } = await supabase
    .from('chatbot_config')
    .update({
      business_context: textToSave
    })
    .eq('workspace_id', workspaceId)
    .select();

  if (error) {
    console.error("Database Update Failed:", error);
  } else {
    console.log("Database Update Succeeded! Saved row:", data);
  }
}

testSave();
