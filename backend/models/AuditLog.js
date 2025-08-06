const { db } = require('../config/db');

function logAction(clientId, action, callback) {
  db.run(
    `INSERT INTO audit_logs (client_id, action) VALUES (?, ?)`,
    [clientId, action],
    callback
  );
}

module.exports = { logAction };
