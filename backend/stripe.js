const Stripe = require("stripe");
const { getCredentials } = require("./utils/credentials");

const MOCK_MODE = process.env.MOCK_MODE === "true";

async function refundStripePayment(clientId, paymentIntentId, amount) {
  if (MOCK_MODE) {
    console.log(`[Mock Stripe] Refund requested for paymentIntentId: ${paymentIntentId}, amount: ${amount}`);
    return { id: "mock_refund_id", status: "succeeded" };
  }

  const creds = await getCredentials(clientId);
  if (!creds || !creds.stripeKey) {
    throw new Error(`Stripe API key not found for client ${clientId}`);
  }

  const stripe = new Stripe(creds.stripeKey);

  return await stripe.refunds.create({
    payment_intent: paymentIntentId,
    amount: Math.round(amount * 100), // amount in cents
    reason: "requested_by_customer",
  });
}

module.exports = { refundStripePayment };
