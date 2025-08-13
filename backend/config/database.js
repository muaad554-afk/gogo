const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const { encrypt, decrypt } = require("../utils/crypto");
const logger = require("../utils/logs");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "../database.sqlite");

class Database {
  constructor() {
    this.db = null;
  }

  async init() {
    if (this.db) return this.db;

    this.db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        logger.error(`Database connection failed: ${err.message}`);
        throw err;
      }
      logger.info("Connected to SQLite database");
    });

    await this.createTables();
    return this.db;
  }

  async createTables() {
    const tables = `
      CREATE TABLE IF NOT EXISTS clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT,
        is_admin BOOLEAN DEFAULT 0,
        ip_whitelist TEXT,
        twofa_secret TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS credentials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        service TEXT NOT NULL,
        encrypted_key TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES clients(id),
        UNIQUE(client_id, service)
      );

      CREATE TABLE IF NOT EXISTS credentials_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        service TEXT NOT NULL,
        encrypted_key TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES clients(id)
      );

      CREATE TABLE IF NOT EXISTS refunds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        order_id TEXT NOT NULL,
        refund_amount REAL NOT NULL,
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
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
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
      );

      CREATE INDEX IF NOT EXISTS idx_refunds_client_id ON refunds(client_id);
      CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_client_id ON audit_logs(client_id);
      CREATE INDEX IF NOT EXISTS idx_credentials_client_service ON credentials(client_id, service);
    `;

    return new Promise((resolve, reject) => {
      this.db.exec(tables, (err) => {
        if (err) {
          logger.error(`Table creation failed: ${err.message}`);
          reject(err);
        } else {
          logger.info("Database tables initialized");
          resolve();
        }
      });
    });
  }

  // Client operations
  async createClient({ email, password_hash, name, is_admin = false }) {
    const sql = `INSERT INTO clients (email, password_hash, name, is_admin) VALUES (?, ?, ?, ?)`;
    return new Promise((resolve, reject) => {
      this.db.run(sql, [email, password_hash, name, is_admin ? 1 : 0], function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });
  }

  async getClientByEmail(email) {
    const sql = `SELECT * FROM clients WHERE email = ?`;
    return new Promise((resolve, reject) => {
      this.db.get(sql, [email], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async getClientById(id) {
    const sql = `SELECT * FROM clients WHERE id = ?`;
    return new Promise((resolve, reject) => {
      this.db.get(sql, [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async getAllClients() {
    const sql = `SELECT id, email, name, is_admin, created_at FROM clients ORDER BY created_at DESC`;
    return new Promise((resolve, reject) => {
      this.db.all(sql, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  // Credentials operations
  async storeCredential(clientId, service, encryptedKey) {
    const sql = `INSERT OR REPLACE INTO credentials (client_id, service, encrypted_key, updated_at) 
                 VALUES (?, ?, ?, CURRENT_TIMESTAMP)`;
    return new Promise((resolve, reject) => {
      this.db.run(sql, [clientId, service, encryptedKey], function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });
  }

  async getCredential(clientId, service) {
    const sql = `SELECT encrypted_key FROM credentials WHERE client_id = ? AND service = ?`;
    return new Promise((resolve, reject) => {
      this.db.get(sql, [clientId, service], (err, row) => {
        if (err) reject(err);
        else resolve(row ? decrypt(row.encrypted_key) : null);
      });
    });
  }

  async getAllCredentials(clientId) {
    const sql = `SELECT service, encrypted_key FROM credentials WHERE client_id = ?`;
    return new Promise((resolve, reject) => {
      this.db.all(sql, [clientId], (err, rows) => {
        if (err) reject(err);
        else {
          const credentials = {};
          rows.forEach(row => {
            credentials[row.service] = decrypt(row.encrypted_key);
          });
          resolve(credentials);
        }
      });
    });
  }

  // Refund operations
  async createRefund(refundData) {
    const sql = `INSERT INTO refunds 
                 (client_id, order_id, refund_amount, customer_name, customer_email, platform, 
                  status, fraud_score, reason, auto_approved, manual_override) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    
    const params = [
      refundData.client_id,
      refundData.order_id,
      refundData.refund_amount,
      refundData.customer_name || null,
      refundData.customer_email || null,
      refundData.platform || 'unknown',
      refundData.status || 'pending',
      refundData.fraud_score || 0,
      refundData.reason || null,
      refundData.auto_approved ? 1 : 0,
      refundData.manual_override ? 1 : 0
    ];

    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });
  }

  async updateRefundStatus(refundId, status, processedAt = null) {
    const sql = `UPDATE refunds SET status = ?, processed_at = ? WHERE id = ?`;
    return new Promise((resolve, reject) => {
      this.db.run(sql, [status, processedAt || new Date().toISOString(), refundId], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  }

  async getRefunds(clientId, filters = {}) {
    let sql = `SELECT * FROM refunds WHERE client_id = ?`;
    const params = [clientId];

    if (filters.status) {
      sql += ` AND status = ?`;
      params.push(filters.status);
    }

    if (filters.startDate) {
      sql += ` AND created_at >= ?`;
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      sql += ` AND created_at <= ?`;
      params.push(filters.endDate);
    }

    sql += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(filters.limit || 100);

    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  // Audit log operations
  async createAuditLog({ client_id, action, details, refund_id, user_id, ip_address }) {
    const sql = `INSERT INTO audit_logs (client_id, action, details, refund_id, user_id, ip_address) 
                 VALUES (?, ?, ?, ?, ?, ?)`;
    return new Promise((resolve, reject) => {
      this.db.run(sql, [client_id, action, details, refund_id, user_id, ip_address], function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });
  }

  async getAuditLogs(clientId = null, limit = 100) {
    let sql = `SELECT al.*, c.email as user_email FROM audit_logs al 
               LEFT JOIN clients c ON al.user_id = c.id`;
    const params = [];

    if (clientId) {
      sql += ` WHERE al.client_id = ?`;
      params.push(clientId);
    }

    sql += ` ORDER BY al.timestamp DESC LIMIT ?`;
    params.push(limit);

    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  // 2FA operations
  async set2FASecret(userId, secret) {
    const sql = `UPDATE clients SET twofa_secret = ? WHERE id = ?`;
    return new Promise((resolve, reject) => {
      this.db.run(sql, [secret, userId], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  }

  async get2FASecret(userId) {
    const sql = `SELECT twofa_secret FROM clients WHERE id = ?`;
    return new Promise((resolve, reject) => {
      this.db.get(sql, [userId], (err, row) => {
        if (err) reject(err);
        else resolve(row ? row.twofa_secret : null);
      });
    });
  }

  async close() {
    if (this.db) {
      return new Promise((resolve) => {
        this.db.close((err) => {
          if (err) logger.error(`Database close error: ${err.message}`);
          else logger.info("Database connection closed");
          resolve();
        });
      });
    }
  }
}

// Singleton instance
const database = new Database();

module.exports = database;