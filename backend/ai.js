const axios = require("axios");

exports.extractRefundDetails = async (inputText) => {
  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "Extract order_id, refund_amount, and customer_name ONLY in JSON format."
          },
          {
            role: "user",
            content: inputText
          }
        ],
        temperature: 0
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
        }
      }
    );

    const match = response.data.choices[0].message.content.match(/{.*}/s);
    return match ? JSON.parse(match[0]) : null;
  } catch (err) {
    console.error("AI extraction error:", err.message);
    return null;
  }
};

exports.getFraudScore = async (inputText) => {
  try {
    const prompt = `Rate the likelihood (0 to 1) that the following refund request is fraudulent:\n${inputText}\nOnly respond with a decimal number.`;

    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        temperature: 0
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
        }
      }
    );

    const score = parseFloat(response.data.choices[0].message.content.trim());
    return isNaN(score) ? 0 : score;
  } catch (err) {
    console.error("AI fraud scoring error:", err.message);
    return 0;
  }
};
