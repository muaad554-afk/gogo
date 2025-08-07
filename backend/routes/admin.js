const express = require("express");
const authMiddleware = require("../middleware/auth");
const db = require("../config/db");
const { maskCredential } = require("../utils/security");

const router = express.Router();

// Admin-only access middleware
router.use(authMiddleware);
router.use((req, res, next) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
});

// GET /admin/clients — List all clients (safe masking)
router.get("/clients", async (req, res) => {
  try {
    const clients = await db.getAllClients();
    const sanitizedClients = clients.map(client => ({
      id: client.id,
      name: client.name,
      email: client.email,
      stripeKey: maskCredential(client.stripeKey),
      paypalClientId: maskCredential(client.paypalClientId),
      slackWebhook: maskCredential(client.slackWebhook),
      openaiKey: maskCredential(client.openaiKey),
      shopifyApiKey: maskCredential(client.shopifyApiKey),
      createdAt: client.createdAt,
    }));
    res.json(sanitizedClients);
  } catch (err) {
    console.error("Admin clients error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /admin/audit-logs?clientId=... — Fetch audit logs for a client (or all)
router.get("/audit-logs", async (req, res) => {
  try {
    const { clientId } = req.query;
    let logs;

    if (clientId) {
      logs = await db.all(
        "SELECT * FROM audit_logs WHERE client_id = ? ORDER BY timestamp DESC LIMIT 100",
        [clientId]
      );
    } else {
      logs = await db.all(
        "SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100"
      );
    }

    res.json(logs);
  } catch (err) {
    console.error("Admin audit logs error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
