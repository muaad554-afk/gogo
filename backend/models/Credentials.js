const db = require("../config/db");
const { encrypt, decrypt } = require("../utils/crypto");

class Credentials {
  static async save(client_id, { stripe_key, paypal_key, slack_url, openai_key }) {
    const encStripe = stripe_key ? encrypt(stripe_key) : null;
    const encPaypal = paypal_key ? encrypt(paypal_key) : null;
    const encSlack = slack_url ? encrypt(slack_url) : null;
    const encOpenAI = openai_key ? encrypt(openai_key) : null;

    const sql = `
      INSERT INTO credentials (client_id, stripe_key, paypal_key, slack_url, openai_key)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(client_id) DO UPDATE SET
        stripe_key=excluded.stripe_key,
        paypal_key=excluded.paypal_key,
        slack_url=excluded.slack_url,
        openai_key=excluded.openai_key
    `;
    await db.run(sql, [client_id, encStripe, encPaypal, encSlack, encOpenAI]);
  }

  static async getByClientId(client_id) {
    const row = await db.get("SELECT * FROM credentials WHERE client_id = ?", [client_id]);
    if (!row) return null;

    return {
      stripeKey: row.stripe_key ? decrypt(row.stripe_key) : null,
      paypalKey: row.paypal_key ? decrypt(row.paypal_key) : null,
      slackUrl: row.slack_url ? decrypt(row.slack_url) : null,
      openAiKey: row.openai_key ? decrypt(row.openai_key) : null,
    };
  }
}

module.exports = Credentials;
