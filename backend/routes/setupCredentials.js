const express = require("express");
const authMiddleware = require("../middleware/auth");
const db = require("../config/db");
const { encrypt } = require("../utils/crypto");
const logger = require("../utils/logs");

const router = express.Router();

// Save or update credentials for a client
router.post("/", authMiddleware, async (req, res) => {
  try {
    const clientId = req.user.id;
    const credentials = req.body;

    // Validate that at least one credential is provided
    const validServices = [
      'stripe_secret', 'paypal_client_id', 'paypal_client_secret',
      'shopify_access_token', 'shopify_shop_name', 'slack_webhook',
      'openai_api_key', 'amazon_access_key', 'etsy_api_key', 'gumroad_api_key'
    ];
    
    const providedCredentials = Object.keys(credentials).filter(key => 
      validServices.includes(key) && credentials[key]
    );

    if (providedCredentials.length === 0) {
      return res.status(400).json({ error: "At least one credential must be provided" });
    }

    // Save each credential using the existing db methods
    for (const service of providedCredentials) {
      try {
        await db.updateCredential(clientId, "api_key", service, credentials[service]);
      } catch (err) {
        // If update fails, create new credential
        await db.storeCredential(clientId, "api_key", service, credentials[service]);
      }
      
      // Save version history
      await db.saveCredentialVersion({
        client_id: clientId,
        type: "api_key",
        key: service,
        value: encrypt(credentials[service])
      });
    }

    // Log audit entry
    await db.logAudit(clientId, "credentials_updated", `Updated services: ${providedCredentials.join(', ')}`);

    logger.info(`Credentials updated for services: ${providedCredentials.join(', ')}`, clientId);
    res.json({ 
      message: "Credentials saved successfully",
      services: providedCredentials
    });
  } catch (error) {
    logger.error(`Setup credentials error: ${error.message}`, req.user.id);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get current credentials (masked for security)
router.get("/", authMiddleware, async (req, res) => {
  try {
    const clientId = req.user.id;
    
    const credentials = await db.getAllCredentialsMasked(clientId);
    
    // Convert array to object format
    const credentialsObj = {};
    credentials.forEach(cred => {
      credentialsObj[cred.key] = cred.value;
    });

    res.json({ credentials: credentialsObj });
  } catch (error) {
    logger.error(`Get credentials error: ${error.message}`, req.user.id);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete specific credential
router.delete("/:service", authMiddleware, async (req, res) => {
  try {
    const clientId = req.user.id;
    const service = req.params.service;
    
    // Find and delete the credential
    const credentials = await db.getAllCredentialsMasked(clientId);
    const credential = credentials.find(c => c.key === service);
    
    if (credential) {
      await db.deleteCredential(credential.id);
      
      // Log audit entry
      await db.logAudit(clientId, "credential_deleted", `Deleted service: ${service}`);
      
      logger.info(`Credential deleted for service: ${service}`, clientId);
      res.json({ message: `${service} credential deleted successfully` });
    } else {
      res.status(404).json({ error: "Credential not found" });
    }
  } catch (error) {
    logger.error(`Delete credential error: ${error.message}`, req.user.id);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;