const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");

const db = new sqlite3.Database(process.env.DATABASE_URL || "refunds.db");

// ---- INITIAL TABLES ----
db.serialize(() => {
  // Clients table (multi-tenant support)
  db.run(`CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Encrypted API credentials
  db.run(`CREATE TABLE IF NOT EXISTS credentials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER,
    stripe_key TEXT,
    paypal_key TEXT,
    slack_url TEXT,
    openai_key TEXT,
    FOREIGN KEY(client_id) REFERENCES clients(id)
  )`);

  // Refund table
  db.run(`CREATE TABLE IF NOT EXISTS refunds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER,
    order_id TEXT,
    refund_amount REAL,
    status TEXT,
    customer_name TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Audit logging
  db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER,
    action TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Users with 2FA
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password_hash TEXT,
    twofa_secret TEXT,
    is_admin BOOLEAN DEFAULT 0
  )`);
});

// ---- USER FUNCTIONS ----
exports.createUser = (username, passwordHash) => {
  return new Promise((resolve, reject) => {
    db.run(
      "INSERT INTO users (username, password_hash) VALUES (?, ?)",
      [username, passwordHash],
      function (err) {
        if (err) return reject(err);
        resolve(this.lastID);
      }
    );
  });
};

exports.getUserByUsername = (username) => {
  return new Promise((resolve, reject) => {
    db.get("SELECT * FROM users WHERE username = ?", [username], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
};

exports.setUser2FASecret = (userId, secret) => {
  return new Promise((resolve, reject) => {
    db.run("UPDATE users SET twofa_secret = ? WHERE id = ?", [secret, userId], (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
};

exports.getUser2FASecret = (userId) => {
  return new Promise((resolve, reject) => {
    db.get("SELECT twofa_secret FROM users WHERE id = ?", [userId], (err, row) => {
      if (err) return reject(err);
      resolve(row ? row.twofa_secret : null);
    });
  });
};

// ---- REFUND LOGGING ----
exports.logRefund = ({ client_id, order_id, refund_amount, status, customer_name }) => {
  return new Promise((resolve, reject) => {
    db.run(
      "INSERT INTO refunds (client_id, order_id, refund_amount, status, customer_name) VALUES (?, ?, ?, ?, ?)",
      [client_id, order_id, refund_amount, status, customer_name],
      function (err) {
        if (err) return reject(err);
        resolve(this.lastID);
      }
    );
  });
};

// ---- CLIENTS ----
exports.createClient = ({ name, email }) => {
  return new Promise((resolve, reject) => {
    db.run("INSERT INTO clients (name, email) VALUES (?, ?)", [name, email], function (err) {
      if (err) return reject(err);
      resolve(this.lastID);
    });
  });
};

exports.getAllClients = () => {
  return new Promise((resolve, reject) => {
    db.all("SELECT * FROM clients", (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
};

// ---- CREDENTIALS ----
exports.saveEncryptedCredentials = ({ client_id, stripe_key, paypal_key, slack_url, openai_key }) => {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT OR REPLACE INTO credentials (client_id, stripe_key, paypal_key, slack_url, openai_key)
       VALUES (?, ?, ?, ?, ?)`,
      [client_id, stripe_key, paypal_key, slack_url, openai_key],
      function (err) {
        if (err) return reject(err);
        resolve(this.lastID);
      }
    );
  });
};

exports.getEncryptedCredentials = (client_id) => {
  return new Promise((resolve, reject) => {
    db.get("SELECT * FROM credentials WHERE client_id = ?", [client_id], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
};

// ---- AUDIT LOGGING ----
exports.logAudit = ({ client_id, action }) => {
  return new Promise((resolve, reject) => {
    db.run("INSERT INTO audit_logs (client_id, action) VALUES (?, ?)", [client_id, action], function (err) {
      if (err) return reject(err);
      resolve(this.lastID);
    });
  });
};

// ---- EXPORT DB FOR DIRECT ACCESS ----
exports.db = db;
