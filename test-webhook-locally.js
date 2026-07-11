async function testWebhook() {
  const testMessage = process.argv[2] || "Hello! What are your business hours?";
  
  const payload = {
    phoneid: "1115949418270020", 
    mobile: "918951335548", 
    name: "ApiAuto Test User",
    message: testMessage,
    msgId: `test-msg-${Date.now()}`
  };

  const targetUrl = process.env.WEBHOOK_URL || 'http://localhost:3000/api/whatsapp/webhook';

  console.log(`Sending test payload to ${targetUrl}`);
  console.log(JSON.stringify(payload, null, 2));

  try {
    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const status = res.status;
    console.log(`Response Status: ${status}`);
    
    const text = await res.text();
    console.log(`Response Body: ${text}`);
  } catch (err) {
    console.error("Connection failed.", err.message);
  }
}

testWebhook();
