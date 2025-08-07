const { db } = require('../config/db');
const { getRefundReason } = require('../utils/openai');
const { sendSlackAlert } = require('../slack');
const { logAction } = require('../utils/logs');
const { processStripeRefund } = require('../stripe');
const { processPayPalRefund } = require('../paypal');
const { getClientCredentials } = require('../utils/credentials');

const AUTO_APPROVE_THRESHOLD = parseFloat(process.env.AUTO_APPROVE_THRESHOLD || '100');
const MOCK_MODE = process.env.MOCK_MODE === 'true';

exports.handleRefundRequest = async (req, res) => {
  const { email, body, amount, platform, orderId } = req.body;
  const clientId = req.user?.client_id;

  if (!email || !body || !amount || !platform || !orderId) {
    return res.status(400).json({ error: 'Missing refund fields.' });
  }

  let reason = 'Not provided';
  let isFraud = false;

  try {
    // Get GPT reason (mock or real)
    reason = await getRefundReason(body);
    isFraud = reason.toLowerCase().includes('fraud') || reason.toLowerCase().includes('suspicious');
  } catch (err) {
    if (!MOCK_MODE) {
      return res.status(500).json({ error: 'Failed to analyze refund.' });
    }
  }

  const autoApprove = amount <= AUTO_APPROVE_THRESHOLD && !isFraud;

  const status = autoApprove ? 'approved' : 'pending';
  const createdAt = new Date().toISOString();

  // Save refund to DB
  db.run(
    `INSERT INTO refunds (email, body, amount, platform, order_id, reason, status, auto_approved, client_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [email, body, amount, platform, orderId,]()
