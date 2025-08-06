const axios = require("axios");
require("dotenv").config();

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
