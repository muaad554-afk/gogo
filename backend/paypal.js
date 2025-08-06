const paypal = require("paypal-rest-sdk");
const logger = require("./logger");

paypal.configure({
  mode: process.env.PAYPAL_MODE || "sandbox",
  client_id: process.env.PAYPAL_CLIENT_ID,
  client_secret: process.env.PAYPAL_CLIENT_SECRET,
});

exports.issueRefund = (saleId, amount, currency = "USD") => {
  const data = {
    amount: {
      total: amount.toFixed(2),
      currency,
    },
  };

  return new Promise((resolve, reject) => {
    paypal.sale.refund(saleId, data, function (error, refund) {
      if (error) {
        logger.error(`PayPal refund error: ${error.message}`);
        return reject(error);
      }
      logger.info(`PayPal refund issued: ${refund.id || 'unknown id'}`);
      resolve(refund);
    });
  });
};
