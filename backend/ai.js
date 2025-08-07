const axios = require("axios");
const db = require("./db").db;
const crypto = require("./utils/crypto");
const logger = require("./utils/logs");

const MOCK_MODE = process.env.MOCK_MODE === "true";

const getClientOpenAIKey = async (clientId) => {
  if (MOCK_MODE) return "mock-key";

  return new Promise((resolve, reject) => {
    db.get(
      "SELECT encrypted_key FROM credentials WHERE client_id = ? AND service = ? ORDER BY id DESC LIMIT 1",
      [clientId, "openai"],
      (err, row) => {
        if (err) {
          logger.error(`DB error fetching OpenAI key for client ${clientId}: ${err.message}`);
          return reject(err);
        }
        if (!row) return resolve(null);
        try {
          const decrypted = crypto.decrypt(row.encrypted_key);
          resolve(decrypted);
        } catch (e) {
          logger.error(`Failed to decrypt OpenAI key for client ${clientId}: ${e.message}`);
          resolve(null);
        }
      }
    );
  });
};

exports.extractRefundDetails = async (inputText, clientId) => {
  if (MOCK_MODE) {
    logger.info(`[Mock OpenAI] Refund extraction for client ${clientId}`);
    return {
      order_id: "MOCK123456",
      refund_amount: 19.99,
      customer_name: "Mock Customer",
    };
  }

  const openaiKey = await getClientOpenAIKey(clientId);
  if (!openaiKey) {
    logger.error(`No OpenAI key found for client: ${clientId}`);
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

    const content = response.data.choices[0].message.content;
    const match = content.match(/{.*}/s);
    if (!match) {
      logger.warn(`OpenAI response missing JSON for client ${clientId}: ${content}`);
      return null;
    }

    return JSON.parse(match[0]);
  } catch (err) {
    logger.error(`AI extraction error for client ${clientId}: ${err.message}`);
    return null;
  }
};

exports.getFraudScore = async (inputText, clientId) => {
  if (MOCK_MODE) {
    logger.info(`[Mock OpenAI] Fraud scoring for client ${clientId}`);
    return 0.25;
  }

  const openaiKey = await getClientOpenAIKey(clientId);
  if (!openaiKey) {
    logger.error(`No OpenAI key found for client: ${clientId}`);
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

    const scoreStr = response.data.choices[0].message.content.trim();
    const score = parseFloat(scoreStr);
    if (isNaN(score)) {
      logger.warn(`OpenAI fraud score invalid for client ${clientId}: ${scoreStr}`);
      return 0;
    }
    return score;
  } catch (err) {
    logger.error(`AI fraud scoring error for client ${clientId}: ${err.message}`);
    return 0;
  }
};
