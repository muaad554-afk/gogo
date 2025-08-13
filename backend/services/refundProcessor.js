const ai = require("../ai");
const slack = require("../slack");
const stripe = require("../stripe");
const paypal = require("../paypal");
const shopify = require("../shopify");
const database = require("../config/database");
const logger = require("../utils/logs");

class RefundProcessor {
  constructor() {
    this.autoApproveThreshold = parseFloat(process.env.AUTO_APPROVE_THRESHOLD) || 100;
    this.fraudScoreThreshold = parseFloat(process.env.FRAUD_SCORE_THRESHOLD) || 0.7;
  }

  async processRefundRequest(clientId, requestData, userInfo = null) {
    const { message, paymentInfo, manualOverride = false } = requestData;
    
    try {
      await database.init();

      // Step 1: Extract refund details using AI
      const extractedData = await ai.extractRefundDetails(message, clientId);
      if (!extractedData) {
        throw new Error("Could not extract refund details from request");
      }

      // Step 2: Get fraud score
      const fraudScore = await ai.getFraudScore(message, clientId);
      
      // Step 3: Check fraud threshold
      if (fraudScore > this.fraudScoreThreshold && !manualOverride) {
        await this.logAudit(clientId, "refund_rejected_fraud", {
          reason: "High fraud score",
          fraud_score: fraudScore,
          threshold: this.fraudScoreThreshold
        }, null, userInfo);

        return {
          success: false,
          error: "Refund request flagged as potentially fraudulent",
          fraudScore,
          extractedData
        };
      }

      // Step 4: Determine approval status
      const autoApproved = (extractedData.refund_amount <= this.autoApproveThreshold) || manualOverride;
      const status = autoApproved ? "approved" : "pending_review";

      // Step 5: Validate order if Shopify integration exists
      const credentials = await database.getAllCredentials(clientId);
      if (credentials.shopify_access_token && credentials.shopify_shop_name) {
        const isValidOrder = await shopify.validateOrder(
          clientId, 
          credentials.shopify_shop_name, 
          extractedData.order_id
        );
        
        if (!isValidOrder) {
          await this.logAudit(clientId, "refund_rejected_invalid_order", {
            order_id: extractedData.order_id,
            reason: "Order not found in Shopify"
          }, null, userInfo);

          return {
            success: false,
            error: "Order not found in connected store",
            extractedData
          };
        }
      }

      // Step 6: Create refund record
      const refundId = await database.createRefund({
        client_id: clientId,
        order_id: extractedData.order_id,
        refund_amount: extractedData.refund_amount,
        customer_name: extractedData.customer_name,
        customer_email: extractedData.customer_email,
        platform: this.determinePlatform(paymentInfo, credentials),
        status: status,
        fraud_score: fraudScore,
        reason: extractedData.reason,
        auto_approved: autoApproved,
        manual_override: manualOverride
      });

      // Step 7: Log audit entry
      await this.logAudit(clientId, "refund_created", {
        refund_id: refundId,
        status: status,
        amount: extractedData.refund_amount,
        fraud_score: fraudScore,
        auto_approved: autoApproved
      }, refundId, userInfo);

      // Step 8: Process refund if approved
      let refundResult = null;
      if (status === "approved") {
        refundResult = await this.executeRefund(clientId, refundId, extractedData, paymentInfo, credentials);
      }

      // Step 9: Send Slack notification
      if (credentials.slack_webhook) {
        await slack.sendAlert(clientId, {
          refund_id: refundId,
          order_id: extractedData.order_id,
          refund_amount: extractedData.refund_amount,
          customer_name: extractedData.customer_name,
          status: status,
          fraud_score: fraudScore,
          auto_approved: autoApproved,
          refund_result: refundResult
        });
      }

      return {
        success: true,
        refund_id: refundId,
        status: status,
        fraud_score: fraudScore,
        extracted_data: extractedData,
        refund_result: refundResult,
        auto_approved: autoApproved
      };

    } catch (error) {
      logger.error(`Refund processing failed for client ${clientId}: ${error.message}`);
      
      await this.logAudit(clientId, "refund_processing_error", {
        error: error.message,
        stack: error.stack
      }, null, userInfo);

      throw error;
    }
  }

  async executeRefund(clientId, refundId, refundData, paymentInfo, credentials) {
    try {
      let result = null;
      const platform = this.determinePlatform(paymentInfo, credentials);

      switch (platform) {
        case "stripe":
          if (credentials.stripe_secret && paymentInfo?.payment_intent_id) {
            result = await stripe.refundStripePayment(
              clientId,
              paymentInfo.payment_intent_id,
              refundData.refund_amount
            );
          }
          break;

        case "paypal":
          if (credentials.paypal_client_id && paymentInfo?.sale_id) {
            result = await paypal.refundPaypalSale(
              clientId,
              paymentInfo.sale_id,
              refundData.refund_amount
            );
          }
          break;

        case "shopify":
          if (credentials.shopify_access_token && credentials.shopify_shop_name) {
            result = await shopify.refundOrder(
              clientId,
              credentials.shopify_shop_name,
              refundData.order_id,
              refundData.refund_amount
            );
          }
          break;

        default:
          logger.warn(`Unknown platform for refund execution: ${platform}`);
      }

      if (result) {
        await database.updateRefundStatus(refundId, "completed");
        await this.logAudit(clientId, "refund_executed", {
          refund_id: refundId,
          platform: platform,
          result: result
        }, refundId);
      }

      return result;

    } catch (error) {
      await database.updateRefundStatus(refundId, "failed");
      await this.logAudit(clientId, "refund_execution_failed", {
        refund_id: refundId,
        error: error.message
      }, refundId);
      
      throw error;
    }
  }

  determinePlatform(paymentInfo, credentials) {
    if (paymentInfo?.platform) {
      return paymentInfo.platform;
    }

    // Auto-detect based on available credentials and payment info
    if (paymentInfo?.payment_intent_id && credentials.stripe_secret) {
      return "stripe";
    }
    
    if (paymentInfo?.sale_id && credentials.paypal_client_id) {
      return "paypal";
    }
    
    if (credentials.shopify_access_token) {
      return "shopify";
    }

    return "unknown";
  }

  async logAudit(clientId, action, details, refundId = null, userInfo = null) {
    await database.createAuditLog({
      client_id: clientId,
      action: action,
      details: JSON.stringify(details),
      refund_id: refundId,
      user_id: userInfo?.id || null,
      ip_address: userInfo?.ip || null
    });
  }

  async overrideRefundStatus(clientId, refundId, newStatus, userInfo) {
    try {
      await database.init();
      
      const updated = await database.updateRefundStatus(refundId, newStatus);
      if (updated === 0) {
        throw new Error("Refund not found or no changes made");
      }

      await this.logAudit(clientId, "refund_status_override", {
        refund_id: refundId,
        new_status: newStatus,
        overridden_by: userInfo.email
      }, refundId, userInfo);

      // If approved, try to execute the refund
      if (newStatus === "approved") {
        const refunds = await database.getRefunds(clientId, { limit: 1 });
        const refund = refunds.find(r => r.id === refundId);
        
        if (refund) {
          const credentials = await database.getAllCredentials(clientId);
          await this.executeRefund(clientId, refundId, {
            order_id: refund.order_id,
            refund_amount: refund.refund_amount,
            customer_name: refund.customer_name
          }, null, credentials);
        }
      }

      return { success: true, refund_id: refundId, new_status: newStatus };

    } catch (error) {
      logger.error(`Refund override failed: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new RefundProcessor();