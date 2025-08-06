const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', process.env.DATABASE_URL || 'db.sqlite');
const db = new sqlite3.Database(dbPath);

function init() {
  // Clients table
  db.run(`CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Credentials (encrypted)
  db.run(`CREATE TABLE IF NOT EXISTS credentials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER,
    stripe_key TEXT,
    paypal_key TEXT,
    slack_url TEXT,
    openai_key TEXT,
    FOREIGN KEY(client_id) REFERENCES clients(id)
  )`);

  // Refund logs
  db.run(`CREATE TABLE IF NOT EXISTS refunds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER,
    order_id TEXT,
    amount REAL,
    status TEXT,
    reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Audit logs
  db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER,
    action TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Users table (for JWT + 2FA)
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT,
    password TEXT,
    is_admin BOOLEAN DEFAULT 0,
    twofa_secret TEXT
  )`);
}

module.exports = {
  db,
  init
};
