const axios = require("axios");

const mockSend = async () => console.log("[Mock Slack] Alert sent");

async function sendAlert(refund, webhookUrl) {
  if (process.env.MOCK_MODE === "true") return mockSend();

  const text = `🚨 *Refund Needs Review* 🚨
• Order ID: ${refund.order_id}
• Amount: $${refund.refund_amount}
• Customer: ${refund.customer_name}
• Status: ${refund.status}
• Fraud Score: ${refund.fraudScore}
• Log ID: ${refund.refundLogId}`;

  try {
    await axios.post(webhookUrl, { text });
  } catch (err) {
    console.error("Slack alert failed:", err.message);
  }
}

module.exports = { sendAlert };
