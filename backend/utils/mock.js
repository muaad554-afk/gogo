const clients = {
  testClient: {
    stripe: { secretKey: "sk_test_...", mock: true },
    paypal: { clientId: "client_id", clientSecret: "secret", mock: true },
    openai: { key: "mock-openai-key", mock: true },
    slack: { webhookUrl: "https://hooks.slack.com/mock", mock: true }
  }
};

module.exports = clients;
