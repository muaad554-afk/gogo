const axios = require("axios");
const db = require("./db");
const logger = require("./utils/logs");

const MOCK_MODE = process.env.MOCK_MODE === "true";

/**
 * Get Shopify credentials for client
 */
async function getShopifyCredentials(clientId) {
  const accessToken = await db.getCredential(clientId, "shopify_access_token");
  const shopName = await db.getCredential(clientId, "shopify_shop_name");

  if (!accessToken || !shopName) {
    throw new Error("Shopify credentials not configured for client");
  }

  return { accessToken, shopName };
}

/**
 * Validate Shopify order
 */
async function validateOrder(clientId, orderId) {
  if (MOCK_MODE) {
    logger.info(`[Mock Shopify] Validating order ${orderId}`, clientId);
    return {
      valid: true,
      order: {
        id: orderId,
        total_price: "50.00",
        currency: "USD",
        customer: { first_name: "Mock", last_name: "Customer" }
      }
    };
  }

  try {
    const { accessToken, shopName } = await getShopifyCredentials(clientId);

    const url = `https://${shopName}/admin/api/2023-10/orders/${orderId}.json`;
    const response = await axios.get(url, {
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json"
      },
      timeout: 10000
    });

    if (response.status === 200 && response.data.order) {
      logger.info(`Shopify order validated: ${orderId}`, clientId);
      return { valid: true, order: response.data.order };
    }

    return { valid: false, error: "Order not found" };

  } catch (error) {
    logger.error(`Shopify order validation failed: ${error.message}`, clientId);
    return { valid: false, error: error.message };
  }
}

/**
 * Process Shopify refund
 */
async function refundOrder(clientId, orderId, refundAmount, reason = "Customer request") {
  if (MOCK_MODE) {
    logger.info(`[Mock Shopify] Refunding order ${orderId}, amount: $${refundAmount}`, clientId);
    return {
      refund: {
        id: "mock_refund_" + Math.random().toString(36).substr(2, 9),
        order_id: orderId,
        amount: refundAmount.toFixed(2),
        currency: "USD",
        processed_at: new Date().toISOString()
      },
      mock: true
    };
  }

  try {
    const { accessToken, shopName } = await getShopifyCredentials(clientId);

    // First, get the order details to build proper refund
    const orderValidation = await validateOrder(clientId, orderId);
    if (!orderValidation.valid) {
      throw new Error("Order not found or invalid");
    }

    const order = orderValidation.order;

    // Create refund payload
    const refundPayload = {
      refund: {
        note: reason,
        notify: true,
        shipping: {
          full_refund: false,
          amount: 0
        },
        refund_line_items: order.line_items?.map(item => ({
          line_item_id: item.id,
          quantity: item.quantity,
          restock_type: "return"
        })) || [],
        transactions: [
          {
            parent_id: order.id,
            amount: refundAmount.toFixed(2),
            kind: "refund",
            gateway: order.gateway || "manual"
          }
        ]
      }
    };

    const url = `https://${shopName}/admin/api/2023-10/orders/${orderId}/refunds.json`;
    const response = await axios.post(url, refundPayload, {
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json"
      },
      timeout: 15000
    });

    logger.info(`Shopify refund successful: ${response.data.refund.id}`, clientId);
    return response.data;

  } catch (error) {
    logger.error(`Shopify refund failed: ${error.message}`, clientId);
    throw error;
  }
}

/**
 * Get order details
 */
async function getOrder(clientId, orderId) {
  if (MOCK_MODE) {
    return {
      id: orderId,
      total_price: "50.00",
      currency: "USD",
      customer: { first_name: "Mock", last_name: "Customer" },
      mock: true
    };
  }

  try {
    const { accessToken, shopName } = await getShopifyCredentials(clientId);

    const url = `https://${shopName}/admin/api/2023-10/orders/${orderId}.json`;
    const response = await axios.get(url, {
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json"
      },
      timeout: 10000
    });

    return response.data.order;

  } catch (error) {
    logger.error(`Shopify get order failed: ${error.message}`, clientId);
    throw error;
  }
}

/**
 * List recent orders
 */
async function getRecentOrders(clientId, limit = 50) {
  if (MOCK_MODE) {
    return {
      orders: Array.from({ length: 5 }, (_, i) => ({
        id: `mock_order_${i + 1}`,
        total_price: (Math.random() * 100 + 10).toFixed(2),
        currency: "USD",
        created_at: new Date(Date.now() - i * 86400000).toISOString()
      })),
      mock: true
    };
  }

  try {
    const { accessToken, shopName } = await getShopifyCredentials(clientId);

    const url = `https://${shopName}/admin/api/2023-10/orders.json?limit=${limit}&status=any`;
    const response = await axios.get(url, {
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json"
      },
      timeout: 10000
    });

    return response.data;

  } catch (error) {
    logger.error(`Shopify get orders failed: ${error.message}`, clientId);
    throw error;
  }
}

module.exports = {
  validateOrder,
  refundOrder,
  getOrder,
  getRecentOrders,
  getShopifyCredentials
};