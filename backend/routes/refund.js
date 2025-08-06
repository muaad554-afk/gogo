const express = require("express");
const router = express.Router();
const ai = require("../ai");
const slack = require("../slack");
const db = require("../db");
const authMiddleware = require("../middleware/auth");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const paypal = require("paypal-rest-sdk");
const Shopify = require("shopify-api-node");

// PayPal config
paypal.configure({
  mode: process.env.PAYPAL_MODE || "sandbox",
  client_id: process.env.PAYPAL_CLIENT_ID,
  client_secret: process.env.PAYPAL_CLIENT_SECRET,
});

// Shopify client
const shopify = new Shopify({
  shopName: process.env.SHOPIFY_STORE_DOMAIN,
  apiKey: process.env.SHOPIFY_API_KEY,
  password: process.env.SHOPIFY_API_PASSWORD,
  apiVersion: "2023-07",
});

// Helper to execute refunds
async function processRefund(paymentInfo, amount) {
  if (!paymentInfo || !paymentInfo.method) throw new Error("Payment info missing");

  if (paymentInfo.method === "stripe") {
    return stripe.refunds.create({
      payment_intent: paymentInfo.paymentIntentId,
      amount: Math.round(amount * 100),
      reason: "requested_by_customer",
    });
  } else if (paymentInfo.method === "paypal") {
    const refundDetails = {
      amount: {
        currency: "USD",
        total: amount.toFixed(2),
      },
    };
    return new Promise((resolve, reject) => {
      paypal.sale.refund(paymentInfo.saleId, refundDetails, (error, refund) => {
        if (error) reject(error);
        else resolve(refund);
      });
    });
  } else {
    throw new Error("Unsupported payment method");
  }
}

// Parse refund details from customer message
router.post("/parse-email", authMiddleware, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "Message is required" });

    const data = await ai.extractRefundDetails(message);
    if (!data) return res.status(400).json({ error: "Could not extract refund details" });

    res.json({ data });
  } catch (err) {
    console.error("Error parsing refund email:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Auto-approve refund and execute if under threshold
router.post("/auto-approve", authMiddleware, async (req, res) => {
  try {
    const { message, paymentInfo } = req.body;
    if (!message) return res.status(400).json({ error: "Message is required" });

    // Fraud scoring
    const fraudScore = await ai.getFraudScore(message);
    if (fraudScore > parseFloat(process.env.FRAUD_SCORE_THRESHOLD || "0.7")) {
      return res.status(403).json({ error: "Refund flagged as fraudulent" });
    }

    // Extract refund data
    const data = await ai.extractRefundDetails(message);
    if (!data) return res.status(400).json({ error: "Could not extract refund details" });

    // Shopify order validation
    try {
      await shopify.order.get(data.order_id);
    } catch {
      return res.status(400).json({ error: "Shopify order validation failed" });
    }

    const autoThreshold = parseFloat(process.env.AUTO_APPROVE_THRESHOLD || "100");
    const status = data.refund_amount <= autoThreshold ? "Approved" : "Needs Review";

    // Log refund
    const refundLogId = await db.logRefund({
      order_id: data.order_id,
      refund_amount: data.refund_amount,
      status,
      customer_name: data.customer_name || "Unknown",
    });

    // Slack alert on "Needs Review"
    if (status === "Needs Review") {
      await slack.sendAlert({
        order_id: data.order_id,
        refund_amount: data.refund_amount,
        status,
        customer_name: data.customer_name || "Unknown",
        fraudScore,
        refundLogId,
      });

      return res.json({ refundLogId, status, fraudScore, message: "Refund requires manual review" });
    }

    // Execute payment refund for auto-approved
    if (paymentInfo) {
      try {
        await processRefund(paymentInfo, data.refund_amount);
      } catch (refundErr) {
        console.error("Refund execution failed:", refundErr);
        return res.status(500).json({ error: "Refund payment execution failed" });
      }
    }

    res.json({ refundLogId, status, fraudScore, message: "Refund approved and processed" });
  } catch (err) {
    console.error("Auto-approve refund error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Manual override by admin
router.post("/manual-override", authMiddleware, async (req, res) => {
  try {
    const { refundLogId, newStatus } = req.body;
    if (!refundLogId || !newStatus) return res.status(400).json({ error: "refundLogId and newStatus are required" });

    const updated = await db.updateRefundStatus(refundLogId, newStatus);
    if (!updated) return res.status(404).json({ error: "Refund record not found" });

    await db.logAudit({
      action: "manual-override",
      refundLogId,
      newStatus,
      userId: req.user.id,
      timestamp: new Date().toISOString(),
    });

    res.json({ message: "Refund status updated successfully" });
  } catch (err) {
    console.error("Manual override error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
