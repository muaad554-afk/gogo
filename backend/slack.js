const axios = require("axios");

exports.sendAlert = async (data) => {
  try {
    const text = `
🚨 *Refund flagged for manual review*:
- Order: ${data.order_id}
- Amount: $${data.refund_amount}
- Customer: ${data.customer_name}
- Status: ${data.status}
- Fraud Score: ${data.fraudScore.toFixed(2)}
- Log ID: ${data.refundLogId}
    `;

    await axios.post(process.env.SLACK_WEBHOOK_URL, { text });
  } catch (err) {
    console.error("Slack alert failed:", err.message);
  }
};
