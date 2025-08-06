const { db } = require('../config/db');

function logRefund(clientId, orderId, amount, status, reason, callback) {
  db.run(
    `INSERT INTO refunds (client_id, order_id, amount, status, reason) VALUES (?, ?, ?, ?, ?)`,
    [clientId, orderId, amount, status, reason],
    callback
  );
}

module.exports = { logRefund };
