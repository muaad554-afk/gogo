const RefundRequest = require("../models/RefundRequest");
const Credentials = require("../models/Credentials");
const AuditLog = require("../models/AuditLog");
const slack = require("../slack");
const stripeModule = require("../stripe");
const paypalModule = require("../paypal");
const openaiUtil = require("../utils/openai");

const AUTO_APPROVE_THRESHOLD = Number(process.env.AUTO_APPROVE_THRESHOLD) || 100;
const FRAUD_SCORE_THRESHOLD = Number(process.env.FRAUD_SCORE_THRESHOLD) || 0.7;

exports.createRefundRequest = async (req, res) => {
  try {
    const clientId = req.user.clientId; // Assuming clientId is stored in JWT token payload
    const { order_id, refund_amount, customer_name } = req.body;

    // Validate input
    if (!order_id || !refund_amount || !customer_name) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // AI-powered refund extraction & fraud scoring via OpenAI
    const credentials = await Credentials.getByClientId(clientId);
    if (!credentials || !credentials.openAiKey) {
      return res.status(400).json({ error: "OpenAI credentials missing" });
    }
    const fraudScore = await openaiUtil.getFraudScore(credentials.openAiKey, req.body);

    // Auto-approve logic
    let status = "pending";
    if (refund_amount <= AUTO_APPROVE_THRESHOLD && fraudScore <= FRAUD_SCORE_THRESHOLD) {
      status = "approved";
    }

    // Log refund request
    const refundLogId = await RefundRequest.create({
      client_id: clientId,
      order_id,
      refund_amount,
      status,
      customer_name,
    });

    // Audit log
    await AuditLog.create({
      client_id: clientId,
      action: "refund_request_created",
      refund_log_id: refundLogId,
      new_status: status,
      user_id: req.user.id,
    });

    // If approved, execute refund via Stripe or PayPal depending on stored credentials
    if (status === "approved") {
      // Choose payment provider based on credentials, here assume Stripe if key present, else PayPal
      if (credentials.stripeKey) {
        await stripeModule.refundStripePayment(credentials.stripeKey, order_id, refund_amount);
      } else if (credentials.paypalKey) {
        await paypalModule.configurePaypal(credentials.paypalKey, credentials.paypalSecret); // You might need to store secret also
        await paypalModule.refundPaypalSale(order_id, refund_amount);
      }

      // Slack alert
      if (credentials.slackUrl) {
        await slack.sendAlert({
          order_id,
          refund_amount,
          status,
          customer_name,
          fraudScore,
          refundLogId,
        }, credentials.slackUrl);
      }

      // Update refund status
      await RefundRequest.updateStatus(refundLogId, "refunded");

      // Audit log for refund execution
      await AuditLog.create({
        client_id: clientId,
        action: "refund_executed",
        refund_log_id: refundLogId,
        new_status: "refunded",
        user_id: req.user.id,
      });
    }

    res.json({ refundLogId, status, fraudScore });
  } catch (err) {
    console.error("Refund request error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.overrideRefundStatus = async (req, res) => {
  try {
    const clientId = req.user.clientId;
    const { refundId, newStatus } = req.body;

    if (!refundId || !newStatus) {
      return res.status(400).json({ error: "Missing refundId or newStatus" });
    }

    await RefundRequest.updateStatus(refundId, newStatus);

    await AuditLog.create({
      client_id: clientId,
      action: "refund_status_override",
      refund_log_id: refundId,
      new_status: newStatus,
      user_id: req.user.id,
    });

    res.json({ message: "Refund status updated" });
  } catch (err) {
    console.error("Override refund status error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};
