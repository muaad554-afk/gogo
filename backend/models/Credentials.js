const { db } = require('../config/db');

function saveCredentials(clientId, encryptedKeys, callback) {
  db.run(
    `INSERT OR REPLACE INTO credentials (client_id, stripe_key, paypal_key, slack_url, openai_key)
     VALUES (?, ?, ?, ?, ?)`,
    [
      clientId,
      encryptedKeys.stripe_key,
      encryptedKeys.paypal_key,
      encryptedKeys.slack_url,
      encryptedKeys.openai_key
    ],
    callback
  );
}

function getCredentialsByClientId(clientId, callback) {
  db.get(`SELECT * FROM credentials WHERE client_id = ?`, [clientId], callback);
}

module.exports = { saveCredentials, getCredentialsByClientId };
