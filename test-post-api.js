async function testPost() {
  const payload = {
    workspace_id: "0384aa61-25ad-440f-9a43-603f9779cde4",
    is_enabled: true,
    provider: "groq",
    model: "llama-3.3-70b-versatile",
    system_prompt: "You are a helpful customer service assistant for our business.",
    business_context: `What treatment are you looking for?
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
• Ovarian Cancer Treatment`,
    auto_pause_duration: 60,
    response_delay: 0,
    bot_name: "AI Assistant",
  };

  console.log("Sending POST to http://localhost:3000/api/whatsapp/chatbot-config...");

  try {
    const res = await fetch("http://localhost:3000/api/whatsapp/chatbot-config", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    console.log("Status:", res.status);
    const body = await res.json();
    console.log("Response Body:", body);
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}

testPost();
