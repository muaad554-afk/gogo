const axios = require("axios");
const db = require("./db");
const logger = require("./utils/logs");

const MOCK_MODE = process.env.MOCK_MODE === "true";

/**
 * Send Slack alert for refund activity
 */
async function sendAlert(clientId, refundData) {
  if (MOCK_MODE) {
    logger.info(`[Mock Slack] Alert sent: ${JSON.stringify(refundData)}`, clientId);
    return { success: true, mock: true };
  }

  try {
    const slackWebhook = await db.getCredential(clientId, "slack_webhook");
    if (!slackWebhook) {
      logger.warn("Slack webhook not configured for client", clientId);
      return { success: false, reason: "No webhook configured" };
    }

    const {
      refund_id,
      order_id,
      refund_amount,
      customer_name,
      status,
      fraud_score,
      auto_approved,
      refund_result
    } = refundData;

    // Determine alert color based on status and fraud score
    let color = "#36a64f"; // Green for approved
    if (status === "pending_review") color = "#ff9500"; // Orange for pending
    if (fraud_score > 0.7) color = "#ff0000"; // Red for high fraud risk

    // Create rich Slack message
    const message = {
      text: `🔄 Refund ${status === "approved" ? "Processed" : "Requires Review"}`,
      attachments: [
        {
          color: color,
          fields: [
            {
              title: "Order ID",
              value: order_id || "N/A",
              short: true
            },
            {
              title: "Amount",
              value: `$${refund_amount?.toFixed(2) || "0.00"}`,
              short: true
            },
            {
              title: "Customer",
              value: customer_name || "Unknown",
              short: true
            },
            {
              title: "Status",
              value: status.toUpperCase(),
              short: true
            },
            {
              title: "Fraud Score",
              value: `${(fraud_score * 100).toFixed(1)}%`,
              short: true
            },
            {
              title: "Auto-Approved",
              value: auto_approved ? "✅ Yes" : "❌ No",
              short: true
            }
          ],
          footer: `Refund ID: ${refund_id}`,
          ts: Math.floor(Date.now() / 1000)
        }
      ]
    };

    // Add refund result info if available
    if (refund_result) {
      message.attachments[0].fields.push({
        title: "Processing Result",
        value: refund_result.success ? "✅ Successful" : "❌ Failed",
        short: true
      });
    }

    const response = await axios.post(slackWebhook, message, {
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    logger.info("Slack alert sent successfully", clientId);
    return { success: true, status: response.status };

  } catch (error) {
    logger.error(`Slack alert failed: ${error.message}`, clientId);
    return { success: false, error: error.message };
  }
}

/**
 * Send general notification to Slack
 */
async function sendNotification(clientId, message, options = {}) {
  if (MOCK_MODE) {
    logger.info(`[Mock Slack] Notification: ${message}`, clientId);
    return { success: true, mock: true };
  }

  try {
    const slackWebhook = await db.getCredential(clientId, "slack_webhook");
    if (!slackWebhook) {
      return { success: false, reason: "No webhook configured" };
    }

    const payload = {
      text: message,
      ...options
    };

    const response = await axios.post(slackWebhook, payload, {
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    return { success: true, status: response.status };

  } catch (error) {
    logger.error(`Slack notification failed: ${error.message}`, clientId);
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendAlert,
  sendNotification
};