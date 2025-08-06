const express = require("express");
const router = express.Router();
const ai = require("./ai");
const slack = require("./slack");
const db = require("./db");

router.post("/process", async (req, res) => {
  const { message } = req.body;

  const data = await ai.extractRefundDetails(message);
  if (!data) {
    return res.status(400).json({ error: "Could not extract refund details" });
  }

  const status = data.refund_amount < parseFloat(process.env.AUTO_APPROVE_THRESHOLD || 100)
    ? "Approved"
    : "Needs Review";

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

  res.json({ ...log, message: `Refund ${status}!` });
});

module.exports = router;
