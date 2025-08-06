const { Configuration, OpenAIApi } = require("openai");

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

/**
 * Parses refund info from customer email content using GPT.
 * Returns { orderId, refundAmount, customerName }
 */
async function parseRefundEmail(emailContent) {
  if (process.env.MOCK_MODE === "true") {
    // Mock response for local testing
    return {
      orderId: "MOCK123456",
      refundAmount: 49.99,
      customerName: "John Doe",
    };
  }

  const prompt = `Extract the order ID, refund amount in USD, and customer name from this customer email:\n\n${emailContent}\n\nReturn a JSON object like {"orderId":"...","refundAmount":...,"customerName":"..."}`;

  try {
    const completion = await openai.createCompletion({
      model: "text-davinci-003",
      prompt,
      max_tokens: 150,
      temperature: 0,
    });

    const text = completion.data.choices[0].text.trim();
    const json = JSON.parse(text);

    return {
      orderId: json.orderId,
      refundAmount: json.refundAmount,
      customerName: json.customerName,
    };
  } catch (error) {
    console.error("OpenAI parse error:", error);
    throw new Error("Failed to parse refund email with AI");
  }
}

module.exports = { parseRefundEmail };
