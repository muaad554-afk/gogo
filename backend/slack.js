const axios = require("axios");

exports.sendAlert = async (data) => {
  try {
    let text;

    if (data.suspicious) {
      text = `🚨 Suspicious refund detected:\n${data.details}`;
    } else if (data.status && data.status.startsWith("Manual override")) {
      text = `✏️ ${data.status}`;
    } else {
      text = `🚨 Refund flagged for manual review:
- Order: ${data.order_id}
- Amount: $${data.refund_amount}
- Customer: ${data.customer_name}
- Status: ${data.status}`;
    }

    await axios.post(process.env.SLACK_WEBHOOK_URL, { text });
  } catch (err) {
    console.error("Slack alert failed:", err.message);
  }
};
