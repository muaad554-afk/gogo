const express = require("express");
const router = express.Router();
const ai = require("../ai");
const slack = require("../slack");
const db = require("../db");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const paypal = require("paypal-rest-sdk");
const Shopify = require("shopify-api-node");

paypal.configure({
  mode: "sandbox",
  client_id: process.env.PAYPAL_CLIENT_ID,
  client_secret: process.env.PAYPAL_CLIENT_SECRET
});

const shopify = new Shopify({
  shopName: process.env.SHOPIFY_SHOP_NAME,
  apiKey: process.env.SHOPIFY_API_KEY,
  password: process.env.SHOPIFY_API_PASSWORD,
  apiVersion: '2023-07'
});

router.post("/", async (req, res) => {
  const { message, paymentInfo } = req.body;

  // Fraud scoring
  const fraudScore = await ai.getFraudScore(message);
  if (fraudScore > 0.7) {
    return res.status(403).json({ error: "Refund request flagged as fraudulent" });
  }

  // Extract refund details via AI
  const data = await ai.extractRefundDetails(message);
  if (!data) {
    return res.status(400).json({ error: "Could not extract refund details" });
  }

  // Shopify order validation for extra security
  try {
    const order = await shopify.order.get(data.order_id);
    if (!order) {
      return res.status(400).json({ error: "Order not found on Shopify" });
    }
  } catch (err) {
    return res.status(400).json({ error: "Shopify order validation failed" });
  }

  // Auto-approve based on threshold
  const autoThreshold = parseFloat(process.env.AUTO_APPROVE_THRESHOLD || "100");
  const status = data.refund_amount < autoThreshold ? "Approved" : "Needs Review";

  // Log refund
  const refundLogId = await db.logRefund({
    order_id: data.order_id,
    refund_amount: data.refund_amount,
    status,
    customer_name: data.customer_name || "Unknown"
  });

  // Slack alert if needs review
  if (status === "Needs Review") {
    await slack.sendAlert({
      order_id: data.order_id,
      refund_amount: data.refund_amount,
      status,
      customer_name: data.customer_name || "Unknown",
      fraudScore,
      refundLogId
    });
  }

  // Refund via Stripe/PayPal for auto-approved refunds
  if (status === "Approved" && paymentInfo) {
    try {
      if (paymentInfo.method === "stripe") {
        await stripe.refunds.create({
          payment_intent: paymentInfo.paymentIntentId,
          amount: Math.round(data.refund_amount * 100),
          reason: "requested_by_customer"
        });
      } else if (paymentInfo.method === "paypal") {
        const refundDetails = {
          amount: {
            currency: "USD",
            total: data.refund_amount.toFixed(2)
          }
        };
        await new Promise((resolve, reject) => {
          paypal.sale.refund(paymentInfo.saleId, refundDetails, function (error, refund) {
            if (error) {
              reject(error);
            } else {
              resolve(refund);
            }
          });
        });
      }
    } catch (err) {
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
    message: `Refund ${status}!`
  });
});

module.exports = router;
