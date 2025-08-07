// routes/refunds.js
const express = require("express");
const router = express.Router();
const ai = require("../ai");
const slack = require("../slack");
const db = require("../db");
const Stripe = require("stripe");
const paypal = require("paypal-rest-sdk");
const { validateOrder } = require("../shopify");
const logger = require("../utils/logs");
const authMiddleware = require("../middleware/auth");

router.use(authMiddleware);

router.post("/", async (req, res) => {
  const clientId = req.user.clientId || req.user.id;
  const { message, paymentInfo, manualOverride } = req.body;

  if (!message) {
    return res.status(400).json({ error: "message is required" });
  }

  try {
    // Load client credentials (decrypted)
    const creds = await db.getDecryptedCredentials(clientId);
    if (!creds) {
      await logger.error("Missing client credentials", clientId);
      return res.status(400).json({ error: "Missing client credentials" });
    }

    // Initialize Stripe with client's key
    const stripe = new Stripe(creds.stripeKey);

    // Configure PayPal if keys present
    let paypalCredentials = null;
    if (creds.paypalKey) {
      try {
        paypalCredentials = JSON.parse(creds.paypalKey);
        paypal.configure({
          mode: process.env.PAYPAL_MODE || "sandbox",
          client_id: paypalCredentials.client_id,
          client_secret: paypalCredentials.client_secret,
        });
      } catch (e) {
        await logger.warn("Invalid PayPal key format", clientId);
      }
    }

    // Get fraud score using AI
    const fraudScore = await ai.getFraudScore(message, clientId);

    if (fraudScore > (parseFloat(process.env.FRAUD_SCORE_THRESHOLD) || 0.7)) {
      await db.logAudit({
        client_id: clientId,
        message: `Refund flagged as fraudulent (score: ${fraudScore})`,
      });
      return res.status(403).json({ error: "Refund request flagged as fraudulent" });
    }

    // Extract refund details using AI
    const data = await ai.extractRefundDetails(message, clientId);
    if (!data) {
      return res.status(400).json({ error: "Could not extract refund details" });
    }

    // Shopify order validation if Shopify credentials exist
    if (creds.shopifyAccessToken && creds.shopifyShopName) {
      const isValid = await validateOrder(clientId, creds.shopifyShopName, data.order_id);
      if (!isValid) {
        return res.status(400).json({ error: "Order not found on Shopify" });
      }
    }

    // Determine refund status and respect manual override
    const autoThreshold = parseFloat(process.env.AUTO_APPROVE_THRESHOLD || "100");
    let status = data.refund_amount <= autoThreshold ? "Approved" : "Needs Review";
    if (manualOverride) status = "Approved";

    // Log refund in DB
    const refundLogId = await db.logRefund({
      client_id: clientId,
      order_id: data.order_id,
      refund_amount: data.refund_amount,
      status,
      customer_name: data.customer_name || "Unknown",
      created_at: new Date().toISOString(),
    });

    // Log audit entry
    await db.logAudit({
      client_id: clientId,
      message: `Refund logged with status: ${status}`,
      refund_log_id: refundLogId,
    });

    // Send Slack alert if review needed
    if (status === "Needs Review" && creds.slackUrl) {
      await slack.sendAlert(
        {
          order_id: data.order_id,
          refund_amount: data.refund_amount,
          status,
          customer_name: data.customer_name || "Unknown",
          fraudScore,
          refundLogId,
        },
        creds.slackUrl
      );
    }

    // Process refund if approved and payment info given
    if (status === "Approved" && paymentInfo) {
      try {
        if (paymentInfo.method === "stripe" && creds.stripeKey) {
          await stripe.refunds.create({
            payment_intent: paymentInfo.paymentIntentId,
            amount: Math.round(data.refund_amount * 100),
            reason: "requested_by_customer",
          });
        } else if (paymentInfo.method === "paypal" && paypalCredentials) {
          const refundDetails = {
            amount: {
              currency: "USD",
              total: data.refund_amount.toFixed(2),
            },
          };
          await new Promise((resolve, reject) => {
            paypal.sale.refund(paymentInfo.saleId, refundDetails, (err, refund) => {
              if (err) reject(err);
              else resolve(refund);
            });
          });
        }
      } catch (refundError) {
        await db.logAudit({
          client_id: clientId,
          message: "Refund processing failed",
          refund_log_id: refundLogId,
          user_id: req.user.id,
        });
        await logger.error(`Refund processing failed: ${refundError.message}`, clientId);
        return res.status(500).json({ error: "Refund processing failed" });
      }
    }

    res.json({
      order_id: data.order_id,
      refund_amount: data.refund_amount,
      status,
      customer_name: data.customer_name || "Unknown",
      fraudScore,
      message: `Refund ${status}!`,
    });
  } catch (err) {
    await logger.error(`Refund route error: ${err.message}`, req.user.clientId || req.user.id);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
