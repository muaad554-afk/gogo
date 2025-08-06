const Stripe = require("stripe");
const logger = require("./logger");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

exports.issueRefund = async (paymentIntentId, amount) => {
  try {
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: Math.round(amount * 100), // cents
    });
    logger.info(`Stripe refund issued: ${refund.id}`);
    return refund;
  } catch (err) {
    logger.error(`Stripe refund error: ${err.message}`);
    throw err;
  }
};
