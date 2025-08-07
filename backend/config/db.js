const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const crypto = require("crypto");
const path = require("path");

const { encrypt, decrypt } = require("../utils/encryption");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "database.sqlite");

let db;

async function init() {
  if (!db) {
    db = await open({
      filename: DB_PATH,
      driver: sqlite3.Database,
    });

    // Tables for clients, refunds, credentials, audit logs
    await db.exec(`
      CREATE TABLE IF NOT EXISTS clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT,
        password TEXT,
        name TEXT,
        isAdmin BOOLEAN DEFAULT 0,
        ipWhitelist TEXT,
        twoFactorSecret TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS credentials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER,
        type TEXT,
        key TEXT,
        value TEXT,
        FOREIGN KEY (client_id) REFERENCES clients(id)
      );

      CREATE TABLE IF NOT EXISTS refunds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER,
        user_email TEXT,
        order_id TEXT,
        amount REAL,
        status TEXT,
        reason TEXT,
        manual_override BOOLEAN DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER,
        action TEXT,
        performed_by TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  return db;
}

// -------- CLIENTS --------

async function getClientById(id) {
  await init();
  return db.get("SELECT * FROM clients WHERE id = ?", [id]);
}

async function getClientByEmail(email) {
  await init();
  return db.get("SELECT * FROM clients WHERE email = ?", [email]);
}

async function createClient({ email, password, name, isAdmin = 0 }) {
  await init();
  const stmt = await db.run(
    `INSERT INTO clients (email, password, name, isAdmin) VALUES (?, ?, ?, ?)`,
    [email, password, name, isAdmin]
  );
  return getClientById(stmt.lastID);
}

async function setUser2FASecret(userId, secret) {
  await init();
  await db.run(`UPDATE clients SET twoFactorSecret = ? WHERE id = ?`, [secret, userId]);
}

async function getUser2FASecret(userId) {
  await init();
  const row = await db.get(`SELECT twoFactorSecret FROM clients WHERE id = ?`, [userId]);
  return row?.twoFactorSecret || null;
}

async function getAllClients() {
  await init();
  return db.all("SELECT id, email, name, isAdmin, created_at FROM clients");
}

// -------- CREDENTIALS --------

async function storeCredential(clientId, type, key, value) {
  await init();
  const encrypted = encrypt(value);
  await db.run(
    `INSERT INTO credentials (client_id, type, key, value) VALUES (?, ?, ?, ?)`,
    [clientId, type, key, encrypted]
  );
}

async function getCredential(clientId, type, key) {
  await init();
  const row = await db.get(
    `SELECT value FROM credentials WHERE client_id = ? AND type = ? AND key = ?`,
    [clientId, type, key]
  );
  return row ? decrypt(row.value) : null;
}

async function getAllCredentialsMasked(clientId) {
  await init();
  const rows = await db.all(
    `SELECT type, key, value FROM credentials WHERE client_id = ?`,
    [clientId]
  );
  return rows.map(row => ({
    type: row.type,
    key: row.key,
    value: maskCredential(decrypt(row.value)),
  }));
}

// -------- AUDIT LOGS --------

async function logAudit(clientId, action, performed_by) {
  await init();
  await db.run(
    `INSERT INTO audit_logs (client_id, action, performed_by) VALUES (?, ?, ?)`,
    [clientId, action, performed_by]
  );
}

async function getAuditLogs(clientId = null) {
  await init();
  if (clientId) {
    return db.all(
      `SELECT * FROM audit_logs WHERE client_id = ? ORDER BY timestamp DESC LIMIT 100`,
      [clientId]
    );
  }
  return db.all(`SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100`);
}

// -------- REFUNDS --------

async function createRefund({ client_id, user_email, order_id, amount, status, reason, manual_override = false }) {
  await init();
  await db.run(
    `INSERT INTO refunds (client_id, user_email, order_id, amount, status, reason, manual_override) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [client_id, user_email, order_id, amount, status, reason, manual_override ? 1 : 0]
  );
}

async function getRecentRefunds(clientId, limit = 50) {
  await init();
  return db.all(
    `SELECT * FROM refunds WHERE client_id = ? ORDER BY created_at DESC LIMIT ?`,
    [clientId, limit]
  );
}

// -------- MASKING UTILITY --------

function maskCredential(secret) {
  if (!secret || secret.length < 8) return "********";
  return secret.slice(0, 3) + "*".repeat(secret.length - 6) + secret.slice(-3);
}

module.exports = {
  getClientById,
  getClientByEmail,
  createClient,
  getAllClients,
  storeCredential,
  getCredential,
  getAllCredentialsMasked,
  setUser2FASecret,
  getUser2FASecret,
  logAudit,
  getAuditLogs,
  createRefund,
  getRecentRefunds,
};
