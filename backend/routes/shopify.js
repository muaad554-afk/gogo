const axios = require("axios");
const { getCredentials } = require("./utils/credentials");

const MOCK_MODE = process.env.MOCK_MODE === "true";

async function getShopifyAccessToken(clientId) {
  const creds = await getCredentials(clientId);
  if (!creds || !creds.shopifyAccessToken) {
    throw new Error("Shopify access token not found for client");
  }
  return creds.shopifyAccessToken;
}

// Validate that the order exists and belongs to the shop
async function validateOrder(clientId, shopName, orderId) {
  if (MOCK_MODE) {
    console.log("[Mock Shopify] Validating order", orderId);
    return true; // Always valid in mock
  }

  const accessToken = await getShopifyAccessToken(clientId);

  try {
    const url = `https://${shopName}/admin/api/2023-04/orders/${orderId}.json`;
    const response = await axios.get(url, {
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
    });
    return response.status === 200 && response.data.order != null;
  } catch (err) {
    console.error("Shopify order validation error:", err.response?.data || err.message);
    return false;
  }
}

// Issue refund via Shopify API (note: Shopify requires creating refund objects tied to order)
async function refundOrder(clientId, shopName, orderId, refundAmount) {
  if (MOCK_MODE) {
    console.log(`[Mock Shopify] Refund issued for order ${orderId} amount $${refundAmount}`);
    return { success: true, refundAmount };
  }

  const accessToken = await getShopifyAccessToken(clientId);

  // Shopify refund API requires detailed refund structure,
  // here is a simplified placeholder for demo purposes:
  try {
    const url = `https://${shopName}/admin/api/2023-04/orders/${orderId}/refunds.json`;
    // A proper refund request requires transactions and refund_line_items setup,
    // You may need to fetch order details first and build this payload accordingly.
    const refundPayload = {
      refund: {
        note: "Refund via AI Refund Automator",
        shipping: { full_refund: true },
        refund_line_items: [], // TODO: fill properly based on order
        transactions: [
          {
            parent_id: orderId,
            amount: refundAmount.toFixed(2),
            kind: "refund",
            gateway: "manual",
          },
        ],
      },
    };

    const response = await axios.post(url, refundPayload, {
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
    });

    return response.data;
  } catch (err) {
    console.error("Shopify refund error:", err.response?.data || err.message);
    throw err;
  }
}

module.exports = { validateOrder, refundOrder };
