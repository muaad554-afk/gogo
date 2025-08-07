const Stripe = require("stripe");

async function refundStripePayment(apiKey, paymentIntentId, amount) {
  const stripe = new Stripe(apiKey);
  return await stripe.refunds.create({
    payment_intent: paymentIntentId,
    amount: Math.round(amount * 100),
    reason: "requested_by_customer"
  });
}

module.exports = { refundStripePayment };

