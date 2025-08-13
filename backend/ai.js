const OpenAI = require("openai");
const db = require("./db");
const logger = require("./utils/logs");

const MOCK_MODE = process.env.MOCK_MODE === "true";

/**
 * Extract refund details from customer message using OpenAI
 */
async function extractRefundDetails(message, clientId) {
  if (MOCK_MODE) {
    logger.info("[Mock AI] Extracting refund details", clientId);
    return {
      order_id: "MOCK-" + Math.random().toString(36).substr(2, 9),
      refund_amount: Math.floor(Math.random() * 200) + 10,
      customer_name: "Mock Customer",
      customer_email: "mock@example.com",
      reason: "Mock refund request"
    };
  }

  try {
    const openaiKey = await db.getCredential(clientId, "openai_api_key");
    if (!openaiKey) {
      throw new Error("OpenAI API key not configured for client");
    }

    const openai = new OpenAI({ apiKey: openaiKey });

    const prompt = `Extract refund information from this customer message. Return ONLY a JSON object with these exact fields:
{
  "order_id": "extracted order ID or null",
  "refund_amount": number or null,
  "customer_name": "extracted name or null",
  "customer_email": "extracted email or null",
  "reason": "brief reason for refund"
}

Customer message: ${message}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: "You are a refund processing assistant. Extract structured data from customer messages and return only valid JSON." },
        { role: "user", content: prompt }
      ],
      temperature: 0.1,
      max_tokens: 300
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    // Parse JSON response
    const extractedData = JSON.parse(content);
    
    // Validate required fields
    if (!extractedData.order_id && !extractedData.refund_amount) {
      throw new Error("Could not extract order ID or refund amount");
    }

    logger.info(`AI extracted refund details: ${JSON.stringify(extractedData)}`, clientId);
    return extractedData;

  } catch (error) {
    logger.error(`AI extraction failed: ${error.message}`, clientId);
    throw error;
  }
}

/**
 * Get fraud score for refund request using OpenAI
 */
async function getFraudScore(message, clientId) {
  if (MOCK_MODE) {
    const mockScore = Math.random() * 0.8; // Mock scores between 0-0.8
    logger.info(`[Mock AI] Fraud score: ${mockScore}`, clientId);
    return mockScore;
  }

  try {
    const openaiKey = await db.getCredential(clientId, "openai_api_key");
    if (!openaiKey) {
      logger.warn("OpenAI API key not configured, using default fraud score", clientId);
      return 0.1; // Low default score
    }

    const openai = new OpenAI({ apiKey: openaiKey });

    const prompt = `Analyze this refund request for fraud risk. Consider factors like:
- Urgency/pressure tactics
- Vague or inconsistent details
- Unusual language patterns
- Suspicious timing or amounts

Return ONLY a number between 0.0 (no risk) and 1.0 (high risk).

Message: ${message}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: "You are a fraud detection expert. Analyze messages and return only a decimal number between 0.0 and 1.0 representing fraud risk." },
        { role: "user", content: prompt }
      ],
      temperature: 0.1,
      max_tokens: 50
    });

    const content = response.choices[0]?.message?.content?.trim();
    const score = parseFloat(content);
    
    if (isNaN(score) || score < 0 || score > 1) {
      logger.warn(`Invalid fraud score from AI: ${content}, using default`, clientId);
      return 0.3; // Default moderate score
    }

    logger.info(`AI fraud score: ${score}`, clientId);
    return score;

  } catch (error) {
    logger.error(`Fraud scoring failed: ${error.message}`, clientId);
    return 0.3; // Default moderate score on error
  }
}

module.exports = {
  extractRefundDetails,
  getFraudScore
};