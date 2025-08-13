const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const path = require("path");
const { encrypt, decrypt } = require("./utils/crypto");
const logger = require("./utils/logs");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "database.sqlite");
const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  // Clients table with all necessary fields
  db.run(`CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    is_admin BOOLEAN DEFAULT 0,
    ip_whitelist TEXT,
    twofa_secret TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  // Credentials table for encrypted API keys
  db.run(`CREATE TABLE IF NOT EXISTS credentials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    service TEXT NOT NULL,
    encrypted_key TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id),
    UNIQUE(client_id, service)
  )`);

  // Enhanced refunds table
  db.run(`CREATE TABLE IF NOT EXISTS refunds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    order_id TEXT,
    refund_amount REAL,
    customer_name TEXT,
    customer_email TEXT,
    platform TEXT,
    status TEXT DEFAULT 'pending',
    fraud_score REAL DEFAULT 0,
    reason TEXT,
    auto_approved BOOLEAN DEFAULT 0,
    manual_override BOOLEAN DEFAULT 0,
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id)
  )`);

  // Audit logs table
  db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    details TEXT,
    refund_id INTEGER,
    user_id INTEGER,
    ip_address TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id),
    FOREIGN KEY (refund_id) REFERENCES refunds(id),
    FOREIGN KEY (user_id) REFERENCES clients(id)
  )`);

  // Users table (legacy support)
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password_hash TEXT,
    twofa_secret TEXT
  )`);

  // Create indexes for performance
  db.run(`CREATE INDEX IF NOT EXISTS idx_refunds_client_id ON refunds(client_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_audit_logs_client_id ON audit_logs(client_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_credentials_client_service ON credentials(client_id, service)`);
});

// Client operations
exports.createClient = (email, passwordHash, name, isAdmin = false) => {
  return new Promise((resolve, reject) => {
    db.run(
      "INSERT INTO clients (email, password_hash, name, is_admin) VALUES (?, ?, ?, ?)",
      [email, passwordHash, name, isAdmin ? 1 : 0],
      function (err) {
        if (err) return reject(err);
        resolve(this.lastID);
      }
    );
  });
};

exports.getClientByEmail = (email) => {
  return new Promise((resolve, reject) => {
    db.get(
      "SELECT * FROM clients WHERE email = ?",
      [email],
      (err, row) => {
        if (err) return reject(err);
        resolve(row);
      }
    );
  });
};

exports.getClientById = (id) => {
  return new Promise((resolve, reject) => {
    db.get(
      "SELECT * FROM clients WHERE id = ?",
      [id],
      (err, row) => {
        if (err) return reject(err);
        resolve(row);
      }
    );
  });
};

exports.getAllClients = () => {
  return new Promise((resolve, reject) => {
    db.all(
      "SELECT id, email, name, is_admin, created_at FROM clients ORDER BY created_at DESC",
      [],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      }
    );
  });
};

// Credentials operations
exports.storeCredential = (clientId, service, value) => {
  return new Promise((resolve, reject) => {
    const encryptedValue = encrypt(value);
    db.run(
      "INSERT OR REPLACE INTO credentials (client_id, service, encrypted_key, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
      [clientId, service, encryptedValue],
      function (err) {
        if (err) return reject(err);
        resolve(this.lastID);
      }
    );
  });
};

exports.getCredential = (clientId, service) => {
  return new Promise((resolve, reject) => {
    db.get(
      "SELECT encrypted_key FROM credentials WHERE client_id = ? AND service = ?",
      [clientId, service],
      (err, row) => {
        if (err) return reject(err);
        if (!row) return resolve(null);
        try {
          const decrypted = decrypt(row.encrypted_key);
          resolve(decrypted);
        } catch (e) {
          logger.error(`Failed to decrypt credential for client ${clientId}, service ${service}: ${e.message}`);
          resolve(null);
        }
      }
    );
  });
};

exports.getAllCredentials = (clientId) => {
  return new Promise((resolve, reject) => {
    db.all(
      "SELECT service, encrypted_key FROM credentials WHERE client_id = ?",
      [clientId],
      (err, rows) => {
        if (err) return reject(err);
        const credentials = {};
        rows.forEach(row => {
          try {
            credentials[row.service] = decrypt(row.encrypted_key);
          } catch (e) {
            logger.error(`Failed to decrypt credential ${row.service} for client ${clientId}: ${e.message}`);
            credentials[row.service] = null;
          }
        });
        resolve(credentials);
      }
    );
  });
};

// Refund operations
exports.createRefund = ({ client_id, order_id, refund_amount, customer_name, customer_email, platform, status, fraud_score, reason, auto_approved, manual_override }) => {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO refunds 
       (client_id, order_id, refund_amount, customer_name, customer_email, platform, status, fraud_score, reason, auto_approved, manual_override) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [client_id, order_id, refund_amount, customer_name, customer_email, platform || 'unknown', status || 'pending', fraud_score || 0, reason, auto_approved ? 1 : 0, manual_override ? 1 : 0],
      function (err) {
        if (err) return reject(err);
        resolve(this.lastID);
      }
    );
  });
};

exports.updateRefundStatus = (refundId, status) => {
  return new Promise((resolve, reject) => {
    db.run(
      "UPDATE refunds SET status = ?, processed_at = CURRENT_TIMESTAMP WHERE id = ?",
      [status, refundId],
      function (err) {
        if (err) return reject(err);
        resolve(this.changes);
      }
    );
  });
};

exports.getRecentRefunds = (clientId, limit = 50) => {
  return new Promise((resolve, reject) => {
    db.all(
      "SELECT * FROM refunds WHERE client_id = ? ORDER BY created_at DESC LIMIT ?",
      [clientId, limit],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      }
    );
  });
};

exports.getRefundById = (refundId) => {
  return new Promise((resolve, reject) => {
    db.get(
      "SELECT * FROM refunds WHERE id = ?",
      [refundId],
      (err, row) => {
        if (err) return reject(err);
        resolve(row);
      }
    );
  });
};

// Audit log operations
exports.logAudit = (clientId, action, details, refundId = null, userId = null, ipAddress = null) => {
  return new Promise((resolve, reject) => {
    db.run(
      "INSERT INTO audit_logs (client_id, action, details, refund_id, user_id, ip_address) VALUES (?, ?, ?, ?, ?, ?)",
      [clientId, action, details, refundId, userId, ipAddress],
      function (err) {
        if (err) return reject(err);
        resolve(this.lastID);
      }
    );
  });
};

exports.getAuditLogs = (clientId = null, limit = 100) => {
  return new Promise((resolve, reject) => {
    let sql = `SELECT al.*, c.email as user_email FROM audit_logs al 
               LEFT JOIN clients c ON al.user_id = c.id`;
    const params = [];

    if (clientId) {
      sql += ` WHERE al.client_id = ?`;
      params.push(clientId);
    }

    sql += ` ORDER BY al.timestamp DESC LIMIT ?`;
    params.push(limit);

    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
};

// 2FA operations
exports.setUser2FASecret = (userId, secret) => {
  return new Promise((resolve, reject) => {
    db.run(
      "UPDATE clients SET twofa_secret = ? WHERE id = ?",
      [secret, userId],
      function (err) {
        if (err) return reject(err);
        resolve(this.changes);
      }
    );
  });
};

exports.getUser2FASecret = (userId) => {
  return new Promise((resolve, reject) => {
    db.get(
      "SELECT twofa_secret FROM clients WHERE id = ?",
      [userId],
      (err, row) => {
        if (err) return reject(err);
        resolve(row ? row.twofa_secret : null);
      }
    );
  });
};

// Legacy user operations for backward compatibility
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
    db.get(
      "SELECT * FROM users WHERE username = ?",
      [username],
      (err, row) => {
        if (err) return reject(err);
        resolve(row);
      }
    );
  });
};

// IP whitelist operations
exports.updateClientIPWhitelist = (clientId, ipWhitelist) => {
  return new Promise((resolve, reject) => {
    db.run(
      "UPDATE clients SET ip_whitelist = ? WHERE id = ?",
      [ipWhitelist, clientId],
      function (err) {
        if (err) return reject(err);
        resolve(this.changes);
      }
    );
  });
};

exports.db = db;