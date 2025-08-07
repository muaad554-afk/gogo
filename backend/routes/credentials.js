const express = require("express");
const router = express.Router();
const Joi = require("joi");
const {
  getCredentials,
  saveCredentials,
  deleteCredentials,
  getCredentialHistory,
} = require("../utils/credentials");
const { requireAdmin } = require("../middleware/auth");

// Joi validation schema
const credentialsSchema = Joi.object({
  stripeKey: Joi.string().allow(null, "").optional(),
  paypalKey: Joi.string().allow(null, "").optional(),
  slackUrl: Joi.string().uri().allow(null, "").optional(),
  openAiKey: Joi.string().allow(null, "").optional(),
});

// GET (masked credentials) — admin-only
router.get("/", requireAdmin, async (req, res) => {
  try {
    const clientId = req.user.clientId;
    const creds = await getCredentials(clientId);
    if (!creds) return res.status(404).json({ error: "Credentials not found" });

    const masked = {
      stripeKey: creds.stripeKey ? "****" : null,
      paypalKey: creds.paypalKey ? "****" : null,
      slackUrl: creds.slackUrl || null,
      openAiKey: creds.openAiKey ? "****" : null,
    };

    res.json(masked);
  } catch (err) {
    console.error("Fetch credentials failed:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST (create/update credentials) — admin-only
router.post("/", requireAdmin, async (req, res) => {
  try {
    const { error, value } = credentialsSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const clientId = req.user.clientId;
    await saveCredentials(clientId, value);

    res.json({ message: "Credentials saved successfully" });
  } catch (err) {
    console.error("Save credentials failed:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE credentials — admin-only
router.delete("/", requireAdmin, async (req, res) => {
  try {
    const clientId = req.user.clientId;
    await deleteCredentials(clientId);
    res.json({ message: "Credentials deleted" });
  } catch (err) {
    console.error("Delete credentials failed:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET version history of credentials — admin-only
router.get("/history", requireAdmin, async (req, res) => {
  try {
    const clientId = req.user.clientId;
    const history = await getCredentialHistory(clientId);
    res.json(history);
  } catch (err) {
    console.error("Fetch credential history failed:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
