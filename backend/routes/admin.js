const express = require("express");
const authMiddleware = require("../middleware/auth");
const Client = require("../models/Clients");
const AuditLog = require("../models/AuditLog");

const router = express.Router();

router.use(authMiddleware);
router.use((req, res, next) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: "Admin access required" });
  next();
});

// GET /admin/clients - list all clients
router.get("/clients", async (req, res) => {
  try {
    const clients = await Client.getAll();
    res.json(clients);
  } catch (err) {
    console.error("Admin clients error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /admin/audit-logs?clientId= - get audit logs, optionally filtered by clientId
router.get("/audit-logs", async (req, res) => {
  try {
    const clientId = req.query.clientId || null;
    const logs = await AuditLog.getAll({ client_id: clientId, limit: 100 });
    res.json(logs);
  } catch (err) {
    console.error("Admin audit logs error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
