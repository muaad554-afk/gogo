const express = require("express");
const router = express.Router();

// Placeholder for Etsy integration

router.post("/etsy/refund", async (req, res) => {
  // TODO: Implement Etsy refund webhook or API integration
  res.status(200).json({ message: "Etsy refund webhook received (stub)" });
});

module.exports = router;
