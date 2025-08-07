const express = require("express");
const router = express.Router();
const Joi = require("joi");

const {
  getCredentials,
  saveCredentials,
  deleteCredentials,
  getCredentialHistory
} = require("../utils/credentials");

// Validation schema
const credentialsSchema = Joi.object({
  stripeKey: Joi.string().allow(null, "").optional(),
  paypalKey: Joi.string().allow(null, "").optional(),
  slackUrl: Joi.string().uri().allow(null, "").optional(),
  openAiKey: Joi.string().allow(null, "").optional(),
});

// Middleware to restrict to admin
function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Admin access only" });
  }
  next();
}

// GET current (masked) credentials
router.get("/", requireAdmin, async (req, res) => {
  try {
    const clientId = req.user.clientId;
    const creds = await getCredentials(clientId);
    if (!creds) return res.status(404).json({ error: "No credentials found" });

    res.json({
      stripeKey: creds.stripeKey ? "****" : null,
      paypalKey: creds.paypalKey ? "****" : null,
      slackUrl: creds.slackUrl || null,
      openAiKey: creds.openAiKey ? "****" : null,
    });
  } catch (err) {
    console.error("Error fetching credentials:", err);
    res.status(500).json({ error: "Failed to fetch credentials" });
  }
});

// GET credential history
router.get("/history", requireAdmin, async (req, res) => {
  try {
    const clientId = req.user.clientId;
    const history = await getCredentialHistory(clientId); // You must implement this in utils/credentials
    res.json(history || []);
  } catch (err) {
    console.error("Error fetching credential history:", err);
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

// POST - Save or update credentials
router.post("/", requireAdmin, async (req, res) => {
  const clientId = req.user.clientId;
  const { error, value } = credentialsSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  try {
    await saveCredentials(clientId, value); // versioning should be handled inside saveCredentials
    res.json({ message: "Credentials saved/updated successfully" });
  } catch (err) {
    console.error("Error saving credentials:", err);
    res.status(500).json({ error: "Failed to save credentials" });
  }
});

// DELETE all credentials for this client
router.delete("/", requireAdmin, async (req, res) => {
  try {
    await deleteCredentials(req.user.clientId);
    res.json({ message: "All credentials deleted successfully" });
  } catch (err) {
    console.error("Error deleting credentials:", err);
    res.status(500).json({ error: "Failed to delete credentials" });
  }
});

// DELETE a single provider's credential (e.g., /credentials/stripe)
router.delete("/:provider", requireAdmin, async (req, res) => {
  const validProviders = ["stripe", "paypal", "slack", "openai"];
  const provider = req.params.provider.toLowerCase();

  if (!validProviders.includes(provider)) {
    return res.status(400).json({ error: "Invalid provider" });
  }

  try {
    const creds = await getCredentials(req.user.clientId);
    if (!creds) return res.status(404).json({ error: "No credentials found" });

    // Nullify only the targeted provider
    const updated = {
      stripeKey: provider === "stripe" ? null : creds.stripeKey,
      paypalKey: provider === "paypal" ? null : creds.paypalKey,
      slackUrl: provider === "slack" ? null : creds.slackUrl,
      openAiKey: provider === "openai" ? null : creds.openAiKey,
    };

    await saveCredentials(req.user.clientId, updated);
    res.json({ message: `${provider} credential deleted successfully` });
  } catch (err) {
    console.error("Error deleting single credential:", err);
    res.status(500).json({ error: "Failed to delete credential" });
  }
});

module.exports = router;
