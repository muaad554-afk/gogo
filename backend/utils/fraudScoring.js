const { getOpenAICredentials } = require("./credentials");
const { callOpenAI } = require("../services/openai");

async function scoreFraudRisk(emailBody, clientId) {
  const openaiKey = await getOpenAICredentials(clientId);
  const prompt = `Rate the fraud risk of this refund request from 0 (low) to 100 (high):\n\n${emailBody}`;

  const response = await callOpenAI(prompt, openaiKey);
  const number = parseInt(response.match(/\d+/)?.[0]);
  return Math.min(Math.max(number || 0, 0), 100);
}

module.exports = { scoreFraudRisk };
