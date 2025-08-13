const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");
const db = require("../config/db");
const logger = require("../utils/logs");

router.use(authMiddleware);

// Amazon integration
router.post("/amazon/refund", async (req, res) => {
  try {
    const clientId = req.user.id;
    const { orderId, amount, reason } = req.body;
    
    // Get Amazon credentials
    const amazonKey = await db.getCredential(clientId, "api_key", "amazon_access_key");
    if (!amazonKey) {
      return res.status(400).json({ error: "Amazon credentials not configured" });
    }
    
    // Mock Amazon refund processing
    if (process.env.MOCK_MODE === "true") {
      logger.info(`[Mock Amazon] Refund processed for order ${orderId}`, clientId);
      
      await db.createRefund({
        client_id: clientId,
        user_email: req.user.email,
        order_id: orderId,
        amount: amount,
        status: "approved",
        reason: reason || "Amazon refund request"
      });
      
      await db.logAudit(clientId, "amazon_refund_processed", req.user.email);
      
      return res.json({ 
        success: true, 
        message: "Amazon refund processed successfully",
        platform: "amazon",
        order_id: orderId,
        amount: amount
      });
    }
    
    // TODO: Implement real Amazon MWS/SP-API integration
    res.status(501).json({ error: "Amazon integration not yet implemented" });
    
  } catch (error) {
    logger.error(`Amazon refund error: ${error.message}`, req.user.id);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Etsy integration
router.post("/etsy/refund", async (req, res) => {
  try {
    const clientId = req.user.id;
    const { orderId, amount, reason } = req.body;
    
    // Get Etsy credentials
    const etsyKey = await db.getCredential(clientId, "api_key", "etsy_api_key");
    if (!etsyKey) {
      return res.status(400).json({ error: "Etsy credentials not configured" });
    }
    
    // Mock Etsy refund processing
    if (process.env.MOCK_MODE === "true") {
      logger.info(`[Mock Etsy] Refund processed for order ${orderId}`, clientId);
      
      await db.createRefund({
        client_id: clientId,
        user_email: req.user.email,
        order_id: orderId,
        amount: amount,
        status: "approved",
        reason: reason || "Etsy refund request"
      });
      
      await db.logAudit(clientId, "etsy_refund_processed", req.user.email);
      
      return res.json({ 
        success: true, 
        message: "Etsy refund processed successfully",
        platform: "etsy",
        order_id: orderId,
        amount: amount
      });
    }
    
    // TODO: Implement real Etsy API integration
    res.status(501).json({ error: "Etsy integration not yet implemented" });
    
  } catch (error) {
    logger.error(`Etsy refund error: ${error.message}`, req.user.id);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Gumroad integration
router.post("/gumroad/refund", async (req, res) => {
  try {
    const clientId = req.user.id;
    const { orderId, amount, reason } = req.body;
    
    // Get Gumroad credentials
    const gumroadKey = await db.getCredential(clientId, "api_key", "gumroad_api_key");
    if (!gumroadKey) {
      return res.status(400).json({ error: "Gumroad credentials not configured" });
    }
    
    // Mock Gumroad refund processing
    if (process.env.MOCK_MODE === "true") {
      logger.info(`[Mock Gumroad] Refund processed for order ${orderId}`, clientId);
      
      await db.createRefund({
        client_id: clientId,
        user_email: req.user.email,
        order_id: orderId,
        amount: amount,
        status: "approved",
        reason: reason || "Gumroad refund request"
      });
      
      await db.logAudit(clientId, "gumroad_refund_processed", req.user.email);
      
      return res.json({ 
        success: true, 
        message: "Gumroad refund processed successfully",
        platform: "gumroad",
        order_id: orderId,
        amount: amount
      });
    }
    
    // TODO: Implement real Gumroad API integration
    res.status(501).json({ error: "Gumroad integration not yet implemented" });
    
  } catch (error) {
    logger.error(`Gumroad refund error: ${error.message}`, req.user.id);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get supported platforms
router.get("/supported", (req, res) => {
  res.json({
    platforms: [
      {
        name: "Shopify",
        key: "shopify",
        status: "active",
        credentials_required: ["shopify_access_token", "shopify_shop_name"]
      },
      {
        name: "Stripe",
        key: "stripe",
        status: "active",
        credentials_required: ["stripe_secret"]
      },
      {
        name: "PayPal",
        key: "paypal",
        status: "active",
        credentials_required: ["paypal_client_id", "paypal_client_secret"]
      },
      {
        name: "Amazon",
        key: "amazon",
        status: "beta",
        credentials_required: ["amazon_access_key"]
      },
      {
        name: "Etsy",
        key: "etsy",
        status: "beta",
        credentials_required: ["etsy_api_key"]
      },
      {
        name: "Gumroad",
        key: "gumroad",
        status: "beta",
        credentials_required: ["gumroad_api_key"]
      }
    ]
  });
});

module.exports = router;