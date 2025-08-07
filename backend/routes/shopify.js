const axios = require("axios");
const { getCredentials } = require("./utils/credentials");
const { sendSlackAlert } = require("./utils/logs");

const MOCK_MODE = process.env.MOCK_MODE === "true";

async function getShopifyAccessTokenAndShop(clientId) {
  const creds = await getCredentials(clientId);
  if (!creds || !creds.shopifyAccessToken || !creds.shopifyShopName) {
    throw new Error("Missing Shopify credentials for client");
  }
  return {
    accessToken: creds.shopifyAccessToken,
    shopName: creds.shopifyShopName,
  };
}

async function validateOrder(clientId, orderId) {
  if (MOCK_MODE) {
    console.log(`[Mock Shopify] Validating order ${orderId}`);
    return true;
  }

  const { accessToken, shopName } = await getShopifyAccessTokenAndShop(clientId);

  try {
    const url = `https://${shopName}/admin/api/2023-04/orders/${orderId}.json`;
    const res = await axios.get(url, {
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
    });

    return res.status === 200 && res.data?.order != null;
  } catch (err) {
    console.error("Shopify order validation error:", err.response?.data || err.message);
    await sendSlackAlert(`[Shopify] Order validation error for client ${clientId}: ${err.message}`);
    return false;
  }
}

async function refundOrder(clientId, orderId, refundAmount) {
  if (MOCK_MODE) {
    console.log(`[Mock Shopify] Refunding order ${orderId} with amount $${refundAmount}`);
    return {
      success: true,
      refundAmount,
      mock: true,
    };
  }

  const { accessToken, shopName } = await getShopifyAccessTokenAndShop(clientId);

  try {
    const url = `https://${shopName}/admin/api/2023-04/orders/${orderId}/refunds.json`;

    // Proper refund structure — still simplified
    const refundPayload = {
      refund: {
        note: "Refund via AI Refund Automator",
        shipping: { full_refund: true },
        refund_line_items: [],
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

    const res = await axios.post(url, refundPayload, {
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
    });

    await sendSlackAlert(`[Shopify] Refund successful for client ${clientId}, order ${orderId}`);
    return res.data;
  } catch (err) {
    console.error("Shopify refund error:", err.response?.data || err.message);
    await sendSlackAlert(`[Shopify] Refund failed for client ${clientId}, order ${orderId}: ${err.message}`);
    throw err;
  }
}

module.exports = {
  validateOrder,
  refundOrder,
};
