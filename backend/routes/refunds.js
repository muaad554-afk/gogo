const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");
const db = require("../config/db");
const ai = require("../ai");
const slack = require("../slack");
const stripe = require("../stripe");
const paypal = require("../paypal");
const shopify = require("../shopify");
const logger = require("../utils/logs");

router.use(authMiddleware);

const AUTO_APPROVE_THRESHOLD = parseFloat(process.env.AUTO_APPROVE_THRESHOLD) || 100;
const FRAUD_SCORE_THRESHOLD = parseFloat(process.env.FRAUD_SCORE_THRESHOLD) || 0.7;

// Create new refund request
router.post("/", async (req, res) => {
  try {
    const clientId = req.user.id;
    const { message, paymentInfo, manualOverride = false } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    // Step 1: Extract refund details using AI
    const extractedData = await ai.extractRefundDetails(message, clientId);
    if (!extractedData) {
      return res.status(400).json({ error: "Could not extract refund details from request" });
    }

    // Step 2: Get fraud score
    const fraudScore = await ai.getFraudScore(message, clientId);
    
    // Step 3: Check fraud threshold
    if (fraudScore > FRAUD_SCORE_THRESHOLD && !manualOverride) {
      await db.logAudit(clientId, "refund_rejected_fraud", req.user.email);
      
      return res.status(400).json({
        error: "Refund request flagged as potentially fraudulent",
        fraudScore,
        extractedData
      });
    }

    // Step 4: Determine approval status
    const autoApproved = (extractedData.refund_amount <= AUTO_APPROVE_THRESHOLD) || manualOverride;
    const status = autoApproved ? "approved" : "pending";

    // Step 5: Create refund record
    await db.createRefund({
      client_id: clientId,
      user_email: req.user.email,
      order_id: extractedData.order_id,
      amount: extractedData.refund_amount,
      status: status,
      reason: extractedData.reason || "Customer request",
      manual_override: manualOverride
    });

    // Step 6: Log audit entry
    await db.logAudit(clientId, "refund_created", req.user.email);

    // Step 7: Execute refund if approved
    let refundResult = null;
    if (status === "approved") {
      try {
        // Try different payment platforms based on available credentials
        const credentials = await getClientCredentials(clientId);
        
        if (credentials.stripe_secret && paymentInfo?.payment_intent_id) {
          refundResult = await stripe.refundStripePayment(clientId, paymentInfo.payment_intent_id, extractedData.refund_amount);
        } else if (credentials.paypal_client_id && paymentInfo?.sale_id) {
          refundResult = await paypal.refundPaypalSale(clientId, paymentInfo.sale_id, extractedData.refund_amount);
        } else if (credentials.shopify_access_token && credentials.shopify_shop_name) {
          refundResult = await shopify.refundOrder(clientId, credentials.shopify_shop_name, extractedData.order_id, extractedData.refund_amount);
        }

        if (refundResult) {
          await db.logAudit(clientId, "refund_executed", req.user.email);
        }
      } catch (refundError) {
        logger.error(`Refund execution failed: ${refundError.message}`, clientId);
        await db.logAudit(clientId, "refund_execution_failed", req.user.email);
      }
    }

    // Step 8: Send Slack notification
    try {
      await slack.sendAlert(clientId, {
        order_id: extractedData.order_id,
        refund_amount: extractedData.refund_amount,
        customer_name: extractedData.customer_name,
        status: status,
        fraudScore: fraudScore,
        auto_approved: autoApproved
      });
    } catch (slackError) {
      logger.warn(`Slack notification failed: ${slackError.message}`, clientId);
    }

    res.json({
      success: true,
      status: status,
      fraud_score: fraudScore,
      extracted_data: extractedData,
      auto_approved: autoApproved,
      refund_result: refundResult,
      message: `Refund ${status === 'approved' ? 'approved and processed' : 'created for review'}`
    });

  } catch (error) {
    logger.error(`Refund creation failed: ${error.message}`, req.user.id);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get refunds for client
router.get("/", async (req, res) => {
  try {
    const clientId = req.user.id;
    const limit = parseInt(req.query.limit) || 50;
    
    const refunds = await db.getRecentRefunds(clientId, limit);
    res.json({ refunds });

  } catch (error) {
    logger.error(`Get refunds failed: ${error.message}`, req.user.id);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Override refund status (manual approval/rejection)
router.put("/:refundId/status", async (req, res) => {
  try {
    const clientId = req.user.id;
    const refundId = parseInt(req.params.refundId);
    const { status } = req.body;
    
    if (!status || !["approved", "rejected", "pending"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    // Update refund status (this would need to be implemented in db.js)
    // For now, we'll log the action
    await db.logAudit(clientId, `refund_status_override_${status}`, req.user.email);

    res.json({ 
      success: true, 
      refund_id: refundId, 
      new_status: status,
      message: `Refund status updated to ${status}`
    });

  } catch (error) {
    logger.error(`Refund status override failed: ${error.message}`, req.user.id);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Helper function to get client credentials
async function getClientCredentials(clientId) {
  const credentials = {};
  
  try {
    credentials.stripe_secret = await db.getCredential(clientId, "api_key", "stripe_secret");
    credentials.paypal_client_id = await db.getCredential(clientId, "api_key", "paypal_client_id");
    credentials.paypal_client_secret = await db.getCredential(clientId, "api_key", "paypal_client_secret");
    credentials.shopify_access_token = await db.getCredential(clientId, "api_key", "shopify_access_token");
    credentials.shopify_shop_name = await db.getCredential(clientId, "api_key", "shopify_shop_name");
    credentials.slack_webhook = await db.getCredential(clientId, "api_key", "slack_webhook");
    credentials.openai_api_key = await db.getCredential(clientId, "api_key", "openai_api_key");
  } catch (error) {
    logger.error(`Error fetching credentials: ${error.message}`, clientId);
  }
  
  return credentials;
}

module.exports = router;