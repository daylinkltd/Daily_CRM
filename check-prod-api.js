async function checkProdAPI() {
  try {
    const res = await fetch('https://dailycrm.cloud/api/whatsapp/chatbot-config');
    console.log("Prod API GET status:", res.status);
    const body = await res.text();
    console.log("Prod API GET response:", body);
  } catch (err) {
    console.error("Failed to connect to prod API:", err);
  }
}

checkProdAPI();
