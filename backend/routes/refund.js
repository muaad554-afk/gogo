const express = require("express");
const router = express.Router();
const ai = require("../ai");
const slack = require("../slack");
const db = require("../db");
const Stripe = require("stripe");
const paypal = require("paypal-rest-sdk");
const Shopify = require("shopify-api-node");

// Middleware to load client credentials
async function loadClientCredentials(clientId) {
  const creds = await db.getDecryptedCredentials(clientId);
  if (!creds) throw new Error("Client credentials not found");
  return creds;
}

// Configure PayPal SDK dynamically per client
function configurePaypal(clientPaypalKey) {
  paypal.configure({
    mode: process.env.PAYPAL_MODE || "sandbox",
    client_id: clientPaypalKey.client_id,
    client_secret: clientPaypalKey.client_secret,
  });
}

router.post("/", async (req, res) => {
  try {
    const { client_id, message, paymentInfo, manualOverride } = req.body;
    if (!client_id || !message) {
      return res.status(400).json({ error: "client_id and message required" });
    }

    // Load client credentials
    const creds = await loadClientCredentials(client_id);
    if (!creds) {
      return res.status(400).json({ error: "Missing client credentials" });
    }

    // Initialize Stripe with client's key
    const stripe = new Stripe(creds.stripeKey);

    // Configure PayPal if keys are present (paypal_key expected to be JSON with id and secret)
    let paypalCredentials = null;
    if (creds.paypalKey) {
      try {
        paypalCredentials = JSON.parse(creds.paypalKey);
        paypal.configure({
          mode: process.env.PAYPAL_MODE || "sandbox",
          client_id: paypalCredentials.client_id,
          client_secret: paypalCredentials.client_secret,
        });
      } catch {
        // invalid paypal key format
      }
    }

    // Fraud scoring
    const fraudScore = await ai.getFraudScore(message, creds.openAiKey);
    if (fraudScore > (parseFloat(process.env.FRAUD_SCORE_THRESHOLD) || 0.7)) {
      await db.logAudit({
        client_id,
        action: `Refund flagged as fraudulent (score: ${fraudScore})`,
      });
      return res.status(403).json({ error: "Refund request flagged as fraudulent" });
    }

    // Extract refund details via AI
    const data = await ai.extractRefundDetails(message, creds.openAiKey);
    if (!data) {
      return res.status(400).json({ error: "Could not extract refund details" });
    }

    // Shopify order validation if Shopify credentials exist
    if (creds.shopifyDomain && creds.shopifyApiKey && creds.shopifyApiSecret) {
      const shopify = new Shopify({
        shopName: creds.shopifyDomain,
        apiKey: creds.shopifyApiKey,
        password: creds.shopifyApiSecret,
        apiVersion: "2023-07",
      });
      try {
        const order = await shopify.order.get(data.order_id);
        if (!order) {
          return res.status(400).json({ error: "Order not found on Shopify" });
        }
      } catch (e) {
        return res.status(400).json({ error: "Shopify order validation failed" });
      }
    }

    // Determine auto-approve threshold
    const autoThreshold = parseFloat(process.env.AUTO_APPROVE_THRESHOLD || "100");
    let status = data.refund_amount < autoThreshold ? "Approved" : "Needs Review";

    // Manual override sets to Approved immediately
    if (manualOverride) {
      status = "Approved";
    }

    // Log refund
    const refundLogId = await db.logRefund({
      client_id,
      order_id: data.order_id,
      refund_amount: data.refund_amount,
      status,
      customer_name: data.customer_name || "Unknown",
    });

    // Log audit for refund creation
    await db.logAudit({
      client_id,
      action: `Refund logged with status: ${status}`,
      refund_log_id: refundLogId,
      new_status: status,
    });

    // Slack alert if flagged
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

    // Process refund if approved and payment info provided
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
            paypal.sale.refund(paymentInfo.saleId, refundDetails, (error, refund) => {
              if (error) reject(error);
              else resolve(refund);
            });
          });
        }
      } catch (err) {
        await db.logAudit({
          client_id,
          action: "Refund processing failed",
          refund_log_id: refundLogId,
          user_id: req.user?.id || null,
        });
        console.error("Payment refund failed:", err);
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
  } catch (error) {
    console.error("Refund route error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
