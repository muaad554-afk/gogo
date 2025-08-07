const express = require("express");
const router = express.Router();

// Placeholder for Gumroad integration

router.post("/gumroad/refund", async (req, res) => {
  // TODO: Implement Gumroad refund webhook or API integration
  res.status(200).json({ message: "Gumroad refund webhook received (stub)" });
});

module.exports = router;
