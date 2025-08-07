const paypal = require("paypal-rest-sdk");

function configurePaypal(clientId, clientSecret) {
  paypal.configure({
    mode: process.env.PAYPAL_MODE || "sandbox",
    client_id: clientId,
    client_secret: clientSecret
  });
}

function refundPaypalSale(saleId, amount) {
  return new Promise((resolve, reject) => {
    const refund = {
      amount: {
        currency: "USD",
        total: amount.toFixed(2)
      }
    };

    paypal.sale.refund(saleId, refund, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
}

module.exports = { configurePaypal, refundPaypalSale };

