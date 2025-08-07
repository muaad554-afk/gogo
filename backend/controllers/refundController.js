const { extractOrderDetails, scoreRefundRisk } = require("../utils/ai");
const { sendSlackAlert } = require("../utils/slack");
const { issueStripeRefund } = require("../utils/stripe");
const { issuePayPalRefund } = require("../utils/paypal");
const { logAudit } = require("../utils/logs");
const clients = require("../mock");

exports.handleRefund = async (req, res) => {
  try {
    const { clientId, emailText, paymentPlatform, transactionId } = req.body;
    const client = clients[clientId];
    if (!client) return res.status(400).json({ error: "Invalid clientId" });

    const { orderId, amount } = await extractOrderDetails(emailText, client.openai);
    const fraudRisk = await scoreRefundRisk(emailText, client.openai);

    let status;
    if (amount <= 100 && fraudRisk < 0.5) {
      if (paymentPlatform === "stripe") {
        await issueStripeRefund(transactionId, client.stripe);
      } else if (paymentPlatform === "paypal") {
        await issuePayPalRefund(transactionId, client.paypal);
      } else {
        return res.status(400).json({ error: "Invalid payment platform" });
      }
      status = "auto_approved";
    } else {
      status = "manual_review";
    }

    await sendSlackAlert(client.slack, { orderId, amount, status, fraudRisk });
    await logAudit({ clientId, orderId, amount, status, fraudRisk });

    res.json({ orderId, amount, status, fraudRisk });
  } catch (err) {
    console.error("Refund error:", err);
    res.status(500).json({ error: "Refund failed" });
  }
};
