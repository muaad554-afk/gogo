const express = require("express");
const authMiddleware = require("../middleware/auth");
const { saveCredentials } = require("../utils/credentials");

const router = express.Router();

router.post("/", authMiddleware, async (req, res) => {
  try {
    const clientId = req.user.clientId || req.user.id; // Adapt depending on your auth payload
    const { stripeKey, paypalKey, slackUrl, openAiKey } = req.body;

    if (
      !stripeKey &&
      !paypalKey &&
      !slackUrl &&
      !openAiKey
    ) {
      return res.status(400).json({ error: "At least one credential must be provided" });
    }

    await saveCredentials(clientId, { stripeKey, paypalKey, slackUrl, openAiKey });

    res.json({ message: "Credentials saved successfully" });
  } catch (error) {
    console.error("Setup credentials error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
