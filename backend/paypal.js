const paypal = require("paypal-rest-sdk");
const { getCredentials } = require("./utils/credentials");

const MOCK_MODE = process.env.MOCK_MODE === "true";

async function configurePaypal(clientId) {
  const creds = await getCredentials(clientId);
  if (!creds || !creds.paypalKey) {
    throw new Error("PayPal API credentials not found for client");
  }

  paypal.configure({
    mode: process.env.PAYPAL_MODE || "sandbox",
    client_id: creds.paypalKey.clientId || creds.paypalKey, // Depending on storage format
    client_secret: creds.paypalKey.clientSecret || creds.paypalKey,
  });
}

async function refundPaypalSale(clientId, saleId, amount) {
  if (MOCK_MODE) {
    console.log(`[Mock PayPal] Refund saleId: ${saleId}, amount: $${amount}`);
    return { id: "mock_refund_id", state: "completed" };
  }

  const creds = await getCredentials(clientId);
  if (!creds || !creds.paypalKey) {
    throw new Error("PayPal API credentials not found for client");
  }

  paypal.configure({
    mode: process.env.PAYPAL_MODE || "sandbox",
    client_id: creds.paypalKey.clientId || creds.paypalKey,
    client_secret: creds.paypalKey.clientSecret || creds.paypalKey,
  });

  const refund = {
    amount: {
      currency: "USD",
      total: amount.toFixed(2),
    },
  };

  return new Promise((resolve, reject) => {
    paypal.sale.refund(saleId, refund, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
}

module.exports = { refundPaypalSale };
