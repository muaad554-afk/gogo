const express = require("express");
const authMiddleware = require("../middleware/auth");
const db = require("../config/db");

const router = express.Router();

// Middleware to restrict admin-only access
router.use(authMiddleware);
router.use((req, res, next) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
});

// GET /admin/clients — List all clients
router.get("/clients", async (req, res) => {
  try {
    const clients = await db.getAllClients();
    res.json(clients);
  } catch (err) {
    console.error("Admin clients error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /admin/audit-logs?clientId=
// Fetch audit logs optionally filtered by client ID
router.get("/audit-logs", async (req, res) => {
  try {
    const clientId = req.query.clientId;

    let logs;
    if (clientId) {
      logs = await db.all("SELECT * FROM audit_logs WHERE client_id = ? ORDER BY timestamp DESC LIMIT 100", [clientId]);
    } else {
      logs = await db.all("SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100");
    }

    res.json(logs);
  } catch (err) {
    console.error("Admin audit logs error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
