// backend/services/openai.js
const { getClientCredentials } = require("../db");
const OpenAI = require("openai");

async function scoreFraud(refundRequest, clientId, mock = false) {
  if (mock) {
    // Return a mock fraud score for testing
    return {
      score: Math.floor(Math.random() * 100),
      reason: "Mock fraud score for testing",
    };
  }

  const creds = await getClientCredentials(clientId, "openai");
  if (!creds) throw new Error("OpenAI credentials not found for client");

  const openai = new OpenAI({ apiKey: creds.api_key });

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content:
          "You're a fraud detection expert. Score refund requests from 0 (not suspicious) to 100 (highly fraudulent).",
      },
      {
        role: "user",
        content: `Refund request: ${JSON.stringify(refundRequest)}`,
      },
    ],
    temperature: 0.2,
  });

  const text = response.choices[0]?.message?.content || "";
  const match = text.match(/(\d{1,3})/); // Extract first number
  const score = match ? parseInt(match[1]) : 50;

  return {
    score,
    reason: text.trim(),
  };
}

module.exports = {
  scoreFraud,
};
