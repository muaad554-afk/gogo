const db = require("../config/db");
const { encrypt, decrypt } = require("./crypto");

// Save encrypted credentials for a client
async function saveCredentials(clientId, { stripeKey, paypalKey, slackUrl, openAiKey }) {
  const encStripeKey = stripeKey ? encrypt(stripeKey) : null;
  const encPaypalKey = paypalKey ? encrypt(paypalKey) : null;
  const encSlackUrl = slackUrl ? encrypt(slackUrl) : null;
  const encOpenAiKey = openAiKey ? encrypt(openAiKey) : null;

  await db.saveEncryptedCredentials({
    client_id: clientId,
    stripe_key: encStripeKey,
    paypal_key: encPaypalKey,
    slack_url: encSlackUrl,
    openai_key: encOpenAiKey,
  });
}

// Retrieve and decrypt credentials for a client
async function getCredentials(clientId) {
  const record = await db.getEncryptedCredentials(clientId);
  if (!record) return null;

  return {
    stripeKey: record.stripe_key ? decrypt(record.stripe_key) : null,
    paypalKey: record.paypal_key ? decrypt(record.paypal_key) : null,
    slackUrl: record.slack_url ? decrypt(record.slack_url) : null,
    openAiKey: record.openai_key ? decrypt(record.openai_key) : null,
  };
}

module.exports = { saveCredentials, getCredentials };
