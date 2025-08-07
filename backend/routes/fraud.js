const express = require("express");
const router = express.Router();
const { scoreFraudRisk } = require("../utils/fraudScoring");

router.post("/fraud-score", async (req, res) => {
  const { emailBody } = req.body;
  if (!emailBody) return res.status(400).json({ error: "Missing email body" });

  try {
    const score = await scoreFraudRisk(emailBody);
    res.json({ score });
  } catch (err) {
    console.error("Fraud scoring error:", err);
    res.status(500).json({ error: "Failed to score fraud risk" });
  }
});

module.exports = router;
