const express = require("express");
const router = express.Router();
const Joi = require("joi");
const { getCredentials, saveCredentials, deleteCredentials } = require("../utils/credentials");

// Validation schema
const credentialsSchema = Joi.object({
  stripeKey: Joi.string().allow(null, "").optional(),
  paypalKey: Joi.string().allow(null, "").optional(),
  slackUrl: Joi.string().uri().allow(null, "").optional(),
  openAiKey: Joi.string().allow(null, "").optional(),
});

// GET credentials (masked)
router.get("/", async (req, res) => {
  try {
    const clientId = req.user.clientId;
    const creds = await getCredentials(clientId);
    if (!creds) return res.status(404).json({ error: "Credentials not found" });

    // Mask credentials except slackUrl (which is a public webhook url)
    const maskedCreds = {
      stripeKey: creds.stripeKey ? "****" : null,
      paypalKey: creds.paypalKey ? "****" : null,
      slackUrl: creds.slackUrl || null,
      openAiKey: creds.openAiKey ? "****" : null,
    };

    res.json(maskedCreds);
  } catch (error) {
    console.error("Error fetching credentials:", error);
    res.status(500).json({ error: "Failed to fetch credentials" });
  }
});

// POST update/save credentials
router.post("/", async (req, res) => {
  try {
    const clientId = req.user.clientId;
    const newCreds = req.body;

    // Validate input
    const { error, value } = credentialsSchema.validate(newCreds);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    await saveCredentials(clientId, value);

    res.json({ message: "Credentials saved/updated successfully" });
  } catch (error) {
    console.error("Error saving credentials:", error);
    res.status(500).json({ error: "Failed to save credentials" });
  }
});

// DELETE credentials (optional)
router.delete("/", async (req, res) => {
  try {
    const clientId = req.user.clientId;
    await deleteCredentials(clientId);
    res.json({ message: "Credentials deleted successfully" });
  } catch (error) {
    console.error("Error deleting credentials:", error);
    res.status(500).json({ error: "Failed to delete credentials" });
  }
});

module.exports = router;
