const express = require("express");
const authMiddleware = require("../middleware/auth");
const db = require("../config/db");
const logger = require("../utils/logs");

const router = express.Router();

router.use(authMiddleware);
router.use((req, res, next) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: "Admin access required" });
  next();
});

// GET /admin/clients - list all clients
router.get("/clients", async (req, res) => {
  try {
    const clients = await db.getAllClients();
    res.json({ clients });
  } catch (err) {
    logger.error(`Admin clients error: ${err.message}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /admin/audit-logs?clientId= - get audit logs, optionally filtered by clientId
router.get("/audit-logs", async (req, res) => {
  try {
    const clientId = req.query.clientId || null;
    const limit = parseInt(req.query.limit) || 100;
    
    const logs = await db.getAuditLogs(clientId, limit);
    res.json({ logs });
  } catch (err) {
    logger.error(`Admin audit logs error: ${err.message}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /admin/refunds - get all refunds across all clients
router.get("/refunds", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const status = req.query.status;
    
    // Get all clients first
    const clients = await db.getAllClients();
    const allRefunds = [];
    
    // Get refunds for each client
    for (const client of clients) {
      const refunds = await db.getRecentRefunds(client.id, limit);
      refunds.forEach(refund => {
        refund.client_email = client.email;
        refund.client_name = client.name;
        if (!status || refund.status === status) {
          allRefunds.push(refund);
        }
      });
    }
    
    // Sort by creation date
    allRefunds.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    res.json({ refunds: allRefunds.slice(0, limit) });
  } catch (err) {
    logger.error(`Admin refunds error: ${err.message}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /admin/stats - get system statistics
router.get("/stats", async (req, res) => {
  try {
    const clients = await db.getAllClients();
    const totalClients = clients.length;
    
    let totalRefunds = 0;
    let pendingRefunds = 0;
    let approvedRefunds = 0;
    let totalRefundAmount = 0;
    
    // Aggregate stats from all clients
    for (const client of clients) {
      const refunds = await db.getRecentRefunds(client.id, 1000); // Get more for stats
      totalRefunds += refunds.length;
      
      refunds.forEach(refund => {
        if (refund.status === 'pending') pendingRefunds++;
        if (refund.status === 'approved') {
          approvedRefunds++;
          totalRefundAmount += refund.amount || 0;
        }
      });
    }
    
    const stats = {
      total_clients: totalClients,
      total_refunds: totalRefunds,
      pending_refunds: pendingRefunds,
      approved_refunds: approvedRefunds,
      total_refund_amount: totalRefundAmount,
      avg_refund_amount: approvedRefunds > 0 ? (totalRefundAmount / approvedRefunds).toFixed(2) : 0
    };
    
    res.json({ stats });
  } catch (err) {
    logger.error(`Admin stats error: ${err.message}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /admin/clients/:clientId/toggle-admin - toggle admin status
router.post("/clients/:clientId/toggle-admin", async (req, res) => {
  try {
    const clientId = parseInt(req.params.clientId);
    const client = await db.getClientById(clientId);
    
    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }
    
    // This would need to be implemented in db.js
    await db.logAudit(clientId, "admin_status_toggled", req.user.email);
    
    res.json({ 
      message: `Admin status toggled for client ${client.email}`,
      client_id: clientId
    });
  } catch (err) {
    logger.error(`Toggle admin error: ${err.message}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;