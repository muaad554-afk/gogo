const axios = require("axios");

exports.sendAlert = async (data) => {
  try {
    let text = "";

    if (data.manualOverride) {
      text = `🔔 *Manual Override Event*:
- Refund ID: ${data.order_id}
- Status: ${data.status}`;
    } else if (data.status === "Needs Review") {
      text = `🚨 *Refund flagged for manual review*:
- Order: ${data.order_id}
- Amount: $${data.refund_amount}
- Customer: ${data.customer_name}
- Status: ${data.status}`;
    } else {
      text = `✅ Refund processed:
- Order: ${data.order_id}
- Amount: $${data.refund_amount}
- Customer: ${data.customer_name}
- Status: ${data.status}`;
    }

    // You can add logic here to detect suspicious patterns and send different alerts

    await axios.post(process.env.SLACK_WEBHOOK_URL, { text });
  } catch (err) {
    console.error("Slack alert failed:", err.message);
  }
};
