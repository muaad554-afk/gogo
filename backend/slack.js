const axios = require("axios");
const { getCredentials } = require("./utils/credentials");

const MOCK_MODE = process.env.MOCK_MODE === "true";

async function sendAlert(clientId, refund) {
  if (MOCK_MODE) {
    console.log("[Mock Slack] Alert sent:", refund);
    return;
  }

  const creds = await getCredentials(clientId);
  if (!creds || !creds.slackUrl) {
    console.warn(`Slack webhook URL not configured for client ${clientId}`);
    return;
  }

  const text = `🚨 *Refund Needs Review* 🚨
• Order ID: ${refund.order_id}
• Amount: $${refund.refund_amount}
• Customer: ${refund.customer_name}
• Status: ${refund.status}
• Fraud Score: ${refund.fraudScore ?? "N/A"}
• Log ID: ${refund.refundLogId ?? "N/A"}`;

  try {
    await axios.post(creds.slackUrl, { text });
  } catch (err) {
    console.error("Slack alert failed:", err.message);
  }
}

module.exports = { sendAlert };
