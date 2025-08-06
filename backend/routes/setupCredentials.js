const express = require("express");
const authMiddleware = require("../middleware/auth");
const db = require("../config/db");

const router = express.Router();

// POST /setup-credentials
// Body: { stripeKey, paypalKey, slackUrl, openAiKey }
router.post("/", authMiddleware, async (req, res) => {
  try {
    const clientId = req.user.id; // Assuming user is client owner or admin

    const { stripeKey, paypalKey, slackUrl, openAiKey } = req.body;

    if (!stripeKey && !paypalKey && !slackUrl && !openAiKey) {
      return res.status(400).json({ error: "At least one credential required" });
    }

    await db.saveEncryptedCredentials({
      client_id: clientId,
      stripe_key: stripeKey,
      paypal_key: paypalKey,
      slack_url: slackUrl,
      openai_key: openAiKey,
    });

    res.json({ message: "Credentials saved securely" });
  } catch (err) {
    console.error("Setup credentials error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
