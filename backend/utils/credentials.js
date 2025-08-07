const db = require("../config/db");
const { encrypt, decrypt } = require("./crypto");

const MOCK_MODE = process.env.MOCK_MODE === "true";

// Save or update encrypted credentials for a client
async function saveCredentials(clientId, { stripeKey, paypalKey, slackUrl, openAiKey }) {
  if (MOCK_MODE) {
    // Skip saving real creds or save dummy data during mock mode
    return;
  }

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
  if (MOCK_MODE) {
    return {
      stripeKey: "mock_stripe_key",
      paypalKey: "mock_paypal_key",
      slackUrl: "https://hooks.slack.com/mock",
      openAiKey: "mock_openai_key",
    };
  }

  const record = await db.getEncryptedCredentials(clientId);
  if (!record) return null;

  return {
    stripeKey: record.stripe_key ? decrypt(record.stripe_key) : null,
    paypalKey: record.paypal_key ? decrypt(record.paypal_key) : null,
    slackUrl: record.slack_url ? decrypt(record.slack_url) : null,
    openAiKey: record.openai_key ? decrypt(record.openai_key) : null,
  };
}

// Optional: Delete credentials for a client (if you want)
async function deleteCredentials(clientId) {
  if (MOCK_MODE) {
    return;
  }
  await db.deleteCredentials(clientId);
}

module.exports = { saveCredentials, getCredentials, deleteCredentials };
