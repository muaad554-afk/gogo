const db = require("../config/db");
const { encrypt, decrypt } = require("./crypto");

const MOCK_MODE = process.env.MOCK_MODE === "true";

// Save or update encrypted credentials for a client, plus save version history
async function saveCredentials(clientId, { stripeKey, paypalKey, slackUrl, openAiKey }) {
  if (MOCK_MODE) {
    // Skip saving real creds or save dummy data during mock mode
    return;
  }

  // Save each credential as a separate record with type and key
  // Types are fixed strings for clarity, keys are descriptive strings per credential

  if (stripeKey !== undefined) {
    await db.updateCredential(clientId, "api_key", "stripe", stripeKey).catch(async () => {
      await db.storeCredential(clientId, "api_key", "stripe", stripeKey);
    });
    await db.saveCredentialVersion({
      client_id: clientId,
      type: "api_key",
      key: "stripe",
      value: encrypt(stripeKey),
    });
  }

  if (paypalKey !== undefined) {
    await db.updateCredential(clientId, "api_key", "paypal", paypalKey).catch(async () => {
      await db.storeCredential(clientId, "api_key", "paypal", paypalKey);
    });
    await db.saveCredentialVersion({
      client_id: clientId,
      type: "api_key",
      key: "paypal",
      value: encrypt(paypalKey),
    });
  }

  if (slackUrl !== undefined) {
    await db.updateCredential(clientId, "webhook_url", "slack", slackUrl).catch(async () => {
      await db.storeCredential(clientId, "webhook_url", "slack", slackUrl);
    });
    await db.saveCredentialVersion({
      client_id: clientId,
      type: "webhook_url",
      key: "slack",
      value: encrypt(slackUrl),
    });
  }

  if (openAiKey !== undefined) {
    await db.updateCredential(clientId, "api_key", "openai", openAiKey).catch(async () => {
      await db.storeCredential(clientId, "api_key", "openai", openAiKey);
    });
    await db.saveCredentialVersion({
      client_id: clientId,
      type: "api_key",
      key: "openai",
      value: encrypt(openAiKey),
    });
  }
}

// Retrieve and decrypt all credentials for a client
async function getCredentials(clientId) {
  if (MOCK_MODE) {
    return {
      stripeKey: "mock_stripe_key",
      paypalKey: "mock_paypal_key",
      slackUrl: "https://hooks.slack.com/mock",
      openAiKey: "mock_openai_key",
    };
  }

  const creds = {};
  const typesAndKeys = [
    { type: "api_key", key: "stripe", prop: "stripeKey" },
    { type: "api_key", key: "paypal", prop: "paypalKey" },
    { type: "webhook_url", key: "slack", prop: "slackUrl" },
    { type: "api_key", key: "openai", prop: "openAiKey" },
  ];

  for (const { type, key, prop } of typesAndKeys) {
    const val = await db.getCredential(clientId, type, key);
    creds[prop] = val || null;
  }

  return creds;
}

// Delete all credentials for a client
async function deleteCredentials(clientId) {
  if (MOCK_MODE) return;
  const allCreds = await db.getAllCredentialsMasked(clientId);
  for (const cred of allCreds) {
    await db.deleteCredential(cred.id);
  }
}

// Get credential version history (masked except slackUrl decrypted)
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

  // Organize versions by timestamp
  const grouped = {};
  for (const rec of records) {
    if (!grouped[rec.timestamp]) grouped[rec.timestamp] = {};
    if (rec.type === "api_key") {
      if (rec.key === "stripe") grouped[rec.timestamp].stripeKey = "****";
      else if (rec.key === "paypal") grouped[rec.timestamp].paypalKey = "****";
      else if (rec.key === "openai") grouped[rec.timestamp].openAiKey = "****";
    } else if (rec.type === "webhook_url" && rec.key === "slack") {
      grouped[rec.timestamp].slackUrl = decrypt(rec.value);
    }
    grouped[rec.timestamp].timestamp = rec.timestamp;
  }

  // Convert grouped object to array sorted by timestamp descending
  return Object.values(grouped).sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
}

module.exports = {
  saveCredentials,
  getCredentials,
  deleteCredentials,
  getCredentialHistory,
};
