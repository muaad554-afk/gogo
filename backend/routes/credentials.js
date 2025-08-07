const express = require("express");
const router = express.Router();
const { 
  getClientCredentials, 
  updateClientCredentials, 
  deleteClientCredentials 
} = require("../utils/credentials");
const Joi = require("joi");

// Validation schema for credentials update (customize as needed)
const credentialsSchema = Joi.object({
  stripeKey: Joi.string().allow("").optional(),
  paypalKey: Joi.string().allow("").optional(),
  slackUrl: Joi.string().uri().allow("").optional(),
  openAiKey: Joi.string().allow("").optional(),
  shopifyDomain: Joi.string().allow("").optional(),
  shopifyApiKey: Joi.string().allow("").optional(),
  shopifyApiSecret: Joi.string().allow("").optional()
});

// Get current client credentials (masked)
router.get("/", async (req, res) => {
  try {
    const clientId = req.user.clientId;
    const creds = await getClientCredentials(clientId);
    if (!creds) return res.status(404).json({ error: "Credentials not found" });

    // Mask sensitive keys before sending
    const maskedCreds = {
      stripeKey: creds.stripeKey ? "****" : null,
      paypalKey: creds.paypalKey ? "****" : null,
      slackUrl: creds.slackUrl || null,
      openAiKey: creds.openAiKey ? "****" : null,
      shopifyDomain: creds.shopifyDomain || null,
      shopifyApiKey: creds.shopifyApiKey ? "****" : null,
      shopifyApiSecret: creds.shopifyApiSecret ? "****" : null
    };

    res.json(maskedCreds);
  } catch (error) {
    console.error("Error fetching credentials:", error);
    res.status(500).json({ error: "Failed to fetch credentials" });
  }
});

// Update client credentials
router.post("/", async (req, res) => {
  try {
    const clientId = req.user.clientId;
    const newCreds = req.body;

    // Validate input
    const { error, value } = credentialsSchema.validate(newCreds);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Save/update credentials securely
    await updateClientCredentials(clientId, value);

    res.json({ message: "Credentials updated successfully" });
  } catch (error) {
    console.error("Error updating credentials:", error);
    res.status(500).json({ error: "Failed to update credentials" });
  }
});

// Delete client credentials (optional)
router.delete("/", async (req, res) => {
  try {
    const clientId = req.user.clientId;
    await deleteClientCredentials(clientId);
    res.json({ message: "Credentials deleted" });
  } catch (error) {
    console.error("Error deleting credentials:", error);
    res.status(500).json({ error: "Failed to delete credentials" });
  }
});

module.exports = router;
