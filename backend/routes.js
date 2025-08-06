const express = require("express");
const router = express.Router();
const ai = require("./ai");
const slack = require("./slack");
const db = require("./db");
const Stripe = require("stripe");
const paypal = require("paypal-rest-sdk");

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

paypal.configure({
  mode: process.env.PAYPAL_MODE || "sandbox", // "sandbox" or "live"
  client_id: process.env.PAYPAL_CLIENT_ID,
  client_secret: process.env.PAYPAL_CLIENT_SECRET,
});

// Refund processing helper functions

async function processStripeRefund(orderId, amount) {
  // You need to map orderId to Stripe chargeId in your DB or CRM, here is a dummy example:
  const chargeId = orderId; // Replace with actual chargeId lookup logic
  return await stripe.refunds.create({
    charge: chargeId,
    amount: Math.round(amount * 100), // amount in cents
  });
}

async function processPaypalRefund(orderId, amount) {
  // Refund PayPal payment by saleId (replace orderId accordingly)
  return new Promise((resolve, reject) => {
    paypal.sale.refund(orderId, { amount: { total: amount.toFixed(2), currency: "USD" } }, function (error, refund) {
      if (error) reject(error);
      else resolve(refund);
    });
  });
}

// POST /process - Main refund processing route
router.post("/process", async (req, res) => {
  const { message, paymentProvider, performedBy } = req.body;

  // 1. Extract refund details using AI
  const data = await ai.extractRefundDetails(message);
  if (!data) return res.status(400).json({ error: "Could not extract refund details" });

  // 2. Determine refund status (auto approve if below threshold)
  const threshold = parseFloat(process.env.AUTO_APPROVE_THRESHOLD || 100);
  const status = data.refund_amount < threshold ? "Approved" : "Needs Review";

  // 3. Log refund
  const refundId = await db.logRefund({
    order_id: data.order_id,
    refund_amount: data.refund_amount,
    status,
    customer_name: data.customer_name || "Unknown",
  });

  // 4. Upsert customer to CRM
  await db.upsertCustomer({ customer_name: data.customer_name });

  // 5. If approved, process refund payment via provider
  if (status === "Approved") {
    try {
      if (paymentProvider === "stripe") {
        await processStripeRefund(data.order_id, data.refund_amount);
      } else if (paymentProvider === "paypal") {
        await processPaypalRefund(data.order_id, data.refund_amount);
      }
    } catch (err) {
      // Log failure and update status
      await db.logAudit({ refund_id: refundId, action: "Refund payment failed: " + err.message, performed_by: performedBy || "system" });
      return res.status(500).json({ error: "Refund payment processing failed", details: err.message });
    }
  }

  // 6. Send Slack alert if refund needs review or manual override events happen
  if (status === "Needs Review") {
    await slack.sendAlert({ ...data, status });
  }

  // 7. Log audit trail for refund creation
  await db.logAudit({ refund_id: refundId, action: `Refund ${status}`, performed_by: performedBy || "system" });

  res.json({ message: `Refund ${status}`, refundId, status });
});

// POST /manual-override - Mark refund as manually approved or rejected
router.post("/manual-override", async (req, res) => {
  const { refundId, action, performedBy } = req.body; // action = "approve" or "reject"
  if (!refundId || !action) return res.status(400).json({ error: "refundId and action required" });

  // Update refund status in DB
  const status = action === "approve" ? "Manually Approved" : "Manually Rejected";
  await new Promise((resolve, reject) => {
    db.run(`UPDATE refunds SET status = ? WHERE id = ?`, [status, refundId], function (err) {
      if (err) reject(err);
      else resolve();
    });
  });

  // Log audit event
  await db.logAudit({ refund_id: refundId, action: `Manual override: ${status}`, performed_by: performedBy || "admin" });

  // Send Slack alert for manual override
  await slack.sendAlert({ order_id: refundId, refund_amount: null, customer_name: null, status, manualOverride: true });

  res.json({ message: `Refund ${status}` });
});

module.exports = router;
