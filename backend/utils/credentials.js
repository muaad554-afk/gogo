const db = require("../config/db");
const { encrypt, decrypt } = require("./crypto");

const MOCK_MODE = process.env.MOCK_MODE === "true";

// Save or update encrypted credentials
async function saveCredentials(clientId, { stripeKey, paypalKey, slackUrl, openAiKey }) {
  if (MOCK_MODE) return;

  const encrypted = {
    stripe_key: stripeKey ? encrypt(stripeKey) : null,
    paypal_key: paypalKey ? encrypt(paypalKey) : null,
    slack_url: slackUrl ? encrypt(slackUrl) : null,
    openai_key: openAiKey ? encrypt(openAiKey) : null,
  };

  // Save to credentials table
  await db.saveEncryptedCredentials({ client_id: clientId, ...encrypted });

  // Save to history table
  await db.saveCredentialVersion({
    client_id: clientId,
    ...encrypted,
    timestamp: new Date().toISOString(),
  });
}

// Decrypt credentials
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

// Delete stored credentials
async function deleteCredentials(clientId) {
  if (MOCK_MODE) return;
  await db.deleteCredentials(clientId);
}

// Retrieve version history
async function getCredentialHistory(clientId) {
  if (MOCK_MODE) {
    return [
      {
        timestamp: "mock_time",
        stripeKey: "****",
        paypalKey: "****",
        slackUrl: "https://hooks.slack.com/mock",
        openAiKey: "****",
      },
    ];
  }

  const records = await db.getCredentialHistory(clientId);
  return records.map(r => ({
    timestamp: r.timestamp,
    stripeKey: r.stripe_key ? "****" : null,
    paypalKey: r.paypal_key ? "****" : null,
    slackUrl: r.slack_url ? decrypt(r.slack_url) : null,
    openAiKey: r.openai_key ? "****" : null,
  }));
}

module.exports = {
  saveCredentials,
  getCredentials,
  deleteCredentials,
  getCredentialHistory,
};
