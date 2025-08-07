const express = require("express");
const router = express.Router();
const Joi = require("joi");

const authMiddleware = require("../middleware/auth");
const {
  saveCredentials,
  getCredentials,
  deleteCredentials,
} = require("../utils/credentials");

// Joi schema for validating input credentials
const credentialsSchema = Joi.object({
  stripeKey: Joi.string().optional().allow(null, ''),
  paypalKey: Joi.string().optional().allow(null, ''),
  slackUrl: Joi.string().uri().optional().allow(null, ''),
  openAiKey: Joi.string().optional().allow(null, ''),
});

// Save or update credentials for a client
router.post("/setup-credentials", authMiddleware, async (req, res) => {
  const { error, value } = credentialsSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  try {
    const clientId = req.user.id;
    await saveCredentials(clientId, value);
    res.status(200).json({ success: true, message: "Credentials saved" });
  } catch (err) {
    console.error("Error saving credentials:", err);
    res.status(500).json({ error: "Failed to save credentials" });
  }
});

// Retrieve credentials (decrypted)
router.get("/credentials", authMiddleware, async (req, res) => {
  try {
    const clientId = req.user.id;
    const creds = await getCredentials(clientId);

    if (!creds) {
      return res.status(404).json({ error: "No credentials found" });
    }

    res.status(200).json({ success: true, credentials: creds });
  } catch (err) {
    console.error("Error fetching credentials:", err);
    res.status(500).json({ error: "Failed to retrieve credentials" });
  }
});

// Delete credentials (optional endpoint)
router.delete("/credentials", authMiddleware, async (req, res) => {
  try {
    const clientId = req.user.id;
    await deleteCredentials(clientId);
    res.status(200).json({ success: true, message: "Credentials deleted" });
  } catch (err) {
    console.error("Error deleting credentials:", err);
    res.status(500).json({ error: "Failed to delete credentials" });
  }
});

module.exports = router;
