const express = require("express");
const router = express.Router();
const ai = require("./ai");
const slack = require("./slack");
const db = require("./db");

// Process refund route
router.post("/process", async (req, res) => {
  const { message } = req.body;

  const data = await ai.extractRefundDetails(message);
  if (!data) {
    return res.status(400).json({ error: "Could not extract refund details" });
  }

  const autoApproveThreshold = parseFloat(process.env.AUTO_APPROVE_THRESHOLD || "100");
  const status = data.refund_amount < autoApproveThreshold ? "Approved" : "Needs Review";

  const log = {
    order_id: data.order_id,
    refund_amount: data.refund_amount,
    status,
    customer_name: data.customer_name || "Unknown"
  };

  await db.logRefund(log);

  if (status === "Needs Review") {
    await slack.sendAlert(log);
  }

  if (data.refund_amount > 1000) {
    await slack.sendAlert({
      suspicious: true,
      details: `High refund amount detected: $${data.refund_amount} for order ${data.order_id}`
    });
  }

  res.json({ ...log, message: `Refund ${status}!` });
});

// Manual override route
router.post("/override", async (req, res) => {
  const { refundId, newStatus, user } = req.body;

  if (!refundId || !newStatus) {
    return res.status(400).json({ error: "refundId and newStatus are required" });
  }

  try {
    await db.updateRefundStatus(refundId, newStatus);

    await slack.sendAlert({
      status: `Manual override: refund ${refundId} status changed to ${newStatus} by ${user || "admin"}`
    });

    res.json({ message: `Manual override applied for refund ${refundId}`, refundId, newStatus });
  } catch (err) {
    console.error("Override error:", err);
    res.status(500).json({ error: "Failed to apply manual override" });
  }
});

module.exports = router;
