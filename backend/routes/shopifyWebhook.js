const express = require("express");
const router = express.Router();
const db = require("../config/db");

// Example webhook for Shopify order refund event
router.post("/shopify/refund", async (req, res) => {
  const { shopDomain, orderId, refundAmount, customerName, clientId } = req.body;

  try {
    // Log refund and trigger refund processing, AI parsing, etc.
    const refundId = await db.logRefund({
      client_id: clientId,
      order_id: orderId,
      refund_amount: refundAmount,
      status: "pending",
      customer_name: customerName,
    });

    // TODO: Trigger refund automation pipeline here

    res.status(200).send("Webhook received");
  } catch (err) {
    console.error("Shopify webhook error:", err);
    res.status(500).send("Internal Server Error");
  }
});

module.exports = router;
