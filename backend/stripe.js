const Stripe = require("stripe");
const db = require("./db");
const logger = require("./utils/logs");

const MOCK_MODE = process.env.MOCK_MODE === "true";

/**
 * Process Stripe refund
 */
async function refundStripePayment(clientId, paymentIntentId, amount) {
  if (MOCK_MODE) {
    logger.info(`[Mock Stripe] Refund for payment ${paymentIntentId}, amount: $${amount}`, clientId);
    return {
      id: "re_mock_" + Math.random().toString(36).substr(2, 9),
      status: "succeeded",
      amount: Math.round(amount * 100),
      currency: "usd",
      payment_intent: paymentIntentId,
      mock: true
    };
  }

  try {
    const stripeSecret = await db.getCredential(clientId, "stripe_secret");
    if (!stripeSecret) {
      throw new Error("Stripe secret key not configured for client");
    }

    const stripe = new Stripe(stripeSecret);

    // Create refund
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: Math.round(amount * 100), // Convert to cents
      reason: "requested_by_customer",
      metadata: {
        client_id: clientId.toString(),
        processed_by: "ai_refund_automator"
      }
    });

    logger.info(`Stripe refund successful: ${refund.id}`, clientId);
    return refund;

  } catch (error) {
    logger.error(`Stripe refund failed: ${error.message}`, clientId);
    throw error;
  }
}

/**
 * Validate Stripe payment intent
 */
async function validatePaymentIntent(clientId, paymentIntentId) {
  if (MOCK_MODE) {
    logger.info(`[Mock Stripe] Validating payment intent ${paymentIntentId}`, clientId);
    return { valid: true, amount: 5000, currency: "usd" }; // Mock $50.00
  }

  try {
    const stripeSecret = await db.getCredential(clientId, "stripe_secret");
    if (!stripeSecret) {
      throw new Error("Stripe secret key not configured for client");
    }

    const stripe = new Stripe(stripeSecret);
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    return {
      valid: paymentIntent.status === "succeeded",
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      customer: paymentIntent.customer
    };

  } catch (error) {
    logger.error(`Stripe validation failed: ${error.message}`, clientId);
    return { valid: false, error: error.message };
  }
}

/**
 * Get refund by ID
 */
async function getRefund(clientId, refundId) {
  if (MOCK_MODE) {
    return {
      id: refundId,
      status: "succeeded",
      amount: 5000,
      currency: "usd",
      mock: true
    };
  }

  try {
    const stripeSecret = await db.getCredential(clientId, "stripe_secret");
    if (!stripeSecret) {
      throw new Error("Stripe secret key not configured for client");
    }

    const stripe = new Stripe(stripeSecret);
    return await stripe.refunds.retrieve(refundId);

  } catch (error) {
    logger.error(`Stripe get refund failed: ${error.message}`, clientId);
    throw error;
  }
}

module.exports = {
  refundStripePayment,
  validatePaymentIntent,
  getRefund
};