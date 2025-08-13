const paypal = require("paypal-rest-sdk");
const db = require("./db");
const logger = require("./utils/logs");

const MOCK_MODE = process.env.MOCK_MODE === "true";

/**
 * Configure PayPal SDK for client
 */
async function configurePayPal(clientId) {
  if (MOCK_MODE) {
    return { configured: true, mock: true };
  }

  const paypalClientId = await db.getCredential(clientId, "paypal_client_id");
  const paypalClientSecret = await db.getCredential(clientId, "paypal_client_secret");

  if (!paypalClientId || !paypalClientSecret) {
    throw new Error("PayPal credentials not configured for client");
  }

  paypal.configure({
    mode: process.env.PAYPAL_MODE || "sandbox",
    client_id: paypalClientId,
    client_secret: paypalClientSecret
  });

  return { configured: true };
}

/**
 * Process PayPal refund
 */
async function refundPaypalSale(clientId, saleId, amount) {
  if (MOCK_MODE) {
    logger.info(`[Mock PayPal] Refund for sale ${saleId}, amount: $${amount}`, clientId);
    return {
      id: "mock_refund_" + Math.random().toString(36).substr(2, 9),
      state: "completed",
      amount: {
        total: amount.toFixed(2),
        currency: "USD"
      },
      sale_id: saleId,
      mock: true
    };
  }

  try {
    await configurePayPal(clientId);

    const refundData = {
      amount: {
        total: amount.toFixed(2),
        currency: "USD"
      },
      reason: "Customer requested refund via AI Refund Automator"
    };

    return new Promise((resolve, reject) => {
      paypal.sale.refund(saleId, refundData, (error, refund) => {
        if (error) {
          logger.error(`PayPal refund failed: ${error.message}`, clientId);
          reject(error);
        } else {
          logger.info(`PayPal refund successful: ${refund.id}`, clientId);
          resolve(refund);
        }
      });
    });

  } catch (error) {
    logger.error(`PayPal refund error: ${error.message}`, clientId);
    throw error;
  }
}

/**
 * Validate PayPal sale
 */
async function validateSale(clientId, saleId) {
  if (MOCK_MODE) {
    logger.info(`[Mock PayPal] Validating sale ${saleId}`, clientId);
    return { valid: true, amount: "50.00", currency: "USD" };
  }

  try {
    await configurePayPal(clientId);

    return new Promise((resolve, reject) => {
      paypal.sale.get(saleId, (error, sale) => {
        if (error) {
          logger.error(`PayPal validation failed: ${error.message}`, clientId);
          resolve({ valid: false, error: error.message });
        } else {
          resolve({
            valid: sale.state === "completed",
            amount: sale.amount.total,
            currency: sale.amount.currency,
            transaction_fee: sale.transaction_fee
          });
        }
      });
    });

  } catch (error) {
    logger.error(`PayPal validation error: ${error.message}`, clientId);
    return { valid: false, error: error.message };
  }
}

/**
 * Get refund details
 */
async function getRefund(clientId, refundId) {
  if (MOCK_MODE) {
    return {
      id: refundId,
      state: "completed",
      amount: { total: "50.00", currency: "USD" },
      mock: true
    };
  }

  try {
    await configurePayPal(clientId);

    return new Promise((resolve, reject) => {
      paypal.refund.get(refundId, (error, refund) => {
        if (error) {
          reject(error);
        } else {
          resolve(refund);
        }
      });
    });

  } catch (error) {
    logger.error(`PayPal get refund failed: ${error.message}`, clientId);
    throw error;
  }
}

module.exports = {
  refundPaypalSale,
  validateSale,
  getRefund,
  configurePayPal
};