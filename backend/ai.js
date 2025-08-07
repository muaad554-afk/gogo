const axios = require("axios");
const db = require("./db").db;
const crypto = require("./utils/crypto");

const getClientOpenAIKey = async (clientId) => {
  if (process.env.MOCK_MODE === "true") return "mock-key";

  return new Promise((resolve, reject) => {
    db.get(
      "SELECT encrypted_key FROM credentials WHERE client_id = ? AND service = ? ORDER BY id DESC LIMIT 1",
      [clientId, "openai"],
      (err, row) => {
        if (err) return reject(err);
        if (!row) return resolve(null);
        try {
          const decrypted = crypto.decrypt(row.encrypted_key);
          resolve(decrypted);
        } catch (e) {
          console.error("Failed to decrypt OpenAI key:", e);
          resolve(null);
        }
      }
    );
  });
};

exports.extractRefundDetails = async (inputText, clientId) => {
  if (process.env.MOCK_MODE === "true") {
    return {
      order_id: "MOCK123456",
      refund_amount: 19.99,
      customer_name: "Mock Customer",
    };
  }

  const openaiKey = await getClientOpenAIKey(clientId);
  if (!openaiKey) {
    console.error("No OpenAI key found for client:", clientId);
    return null;
  }

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "Extract order_id, refund_amount, and customer_name ONLY in JSON format.",
          },
          {
            role: "user",
            content: inputText,
          },
        ],
        temperature: 0,
      },
      {
        headers: {
          Authorization: `Bearer ${openaiKey}`,
        },
      }
    );

    const match = response.data.choices[0].message.content.match(/{.*}/s);
    return match ? JSON.parse(match[0]) : null;
  } catch (err) {
    console.error("AI extraction error:", err.message);
    return null;
  }
};

exports.getFraudScore = async (inputText, clientId) => {
  if (process.env.MOCK_MODE === "true") {
    return 0.25;
  }

  const openaiKey = await getClientOpenAIKey(clientId);
  if (!openaiKey) {
    console.error("No OpenAI key found for client:", clientId);
    return 0;
  }

  try {
    const prompt = `Rate the likelihood (0 to 1) that the following refund request is fraudulent:\n${inputText}\nOnly respond with a decimal number.`;

    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
      },
      {
        headers: {
          Authorization: `Bearer ${openaiKey}`,
        },
      }
    );

    const score = parseFloat(response.data.choices[0].message.content.trim());
    return isNaN(score) ? 0 : score;
  } catch (err) {
    console.error("AI fraud scoring error:", err.message);
    return 0;
  }
};

