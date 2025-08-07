const express = require("express");
const router = express.Router();
const Joi = require("joi");
const {
  getCredentials,
  saveCredentials,
  deleteCredentials,
  getCredentialHistory,
  logCredentialVersion,
} = require("../utils/credentials");
const { maskCredential } = require("../utils/security");

// Validation schema
const credentialsSchema = Joi.object({
  stripeKey: Joi.string().allow(null, "").optional(),
  paypalKey: Joi.string().allow(null, "").optional(),
  slackUrl: Joi.string().uri().allow(null, "").optional(),
  openAiKey: Joi.string().allow(null, "").optional(),
});

// Utility to determine target client
function resolveTargetClientId(req, paramClientId) {
  const isAdmin = req.user?.role === "admin";
  return isAdmin && paramClientId ? paramClientId : req.user?.clientId;
}

// ============================
// GET /credentials
// ============================
router.get("/:clientId?", async (req, res) => {
  try {
    const targetClientId = resolveTargetClientId(req, req.params.clientId);

    const creds = await getCredentials(targetClientId);
    if (!creds) return res.status(404).json({ error: "Credentials not found" });

    const maskedCreds = {
      stripeKey: maskCredential(creds.stripeKey),
      paypalKey: maskCredential(creds.paypalKey),
      slackUrl: creds.slackUrl || null,
      openAiKey: maskCredential(creds.openAiKey),
    };

    res.json(maskedCreds);
  } catch (error) {
    console.error("Error fetching credentials:", error);
    res.status(500).json({ error: "Failed to fetch credentials" });
  }
});

// ============================
// POST /credentials
// ============================
router.post("/:clientId?", async (req, res) => {
  try {
    const targetClientId = resolveTargetClientId(req, req.params.clientId);
    const { error, value } = credentialsSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    // Log the version before overwrite (if not mock mode)
    if (process.env.MOCK_MODE !== "true") {
      const oldCreds = await getCredentials(targetClientId);
      if (oldCreds) await logCredentialVersion(targetClientId, oldCreds);
    }

    await saveCredentials(targetClientId, value);
    res.json({ message: "Credentials saved/updated successfully" });
  } catch (error) {
    console.error("Error saving credentials:", error);
    res.status(500).json({ error: "Failed to save credentials" });
  }
});

// ============================
// DELETE /credentials
// ============================
router.delete("/:clientId?", async (req, res) => {
  try {
    const targetClientId = resolveTargetClientId(req, req.params.clientId);

    await deleteCredentials(targetClientId);
    res.json({ message: "Credentials deleted successfully" });
  } catch (error) {
    console.error("Error deleting credentials:", error);
    res.status(500).json({ error: "Failed to delete credentials" });
  }
});

// ============================
// GET /credentials/history
// ============================
router.get("/history/:clientId?", async (req, res) => {
  try {
    const targetClientId = resolveTargetClientId(req, req.params.clientId);

    const history = await getCredentialHistory(targetClientId);
    if (!history || history.length === 0) {
      return res.status(404).json({ error: "No credential history found" });
    }

    // Mask values in history
    const maskedHistory = history.map(entry => ({
      ...entry,
      stripeKey: maskCredential(entry.stripeKey),
      paypalKey: maskCredential(entry.paypalKey),
      slackUrl: entry.slackUrl,
      openAiKey: maskCredential(entry.openAiKey),
      timestamp: entry.timestamp,
    }));

    res.json(maskedHistory);
  } catch (error) {
    console.error("Error fetching credential history:", error);
    res.status(500).json({ error: "Failed to fetch credential history" });
  }
});

module.exports = router;
