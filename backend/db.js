const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database(process.env.DATABASE_URL || "refunds.db");

db.serialize(() => {
  // Refunds table
  db.run(`CREATE TABLE IF NOT EXISTS refunds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT,
    refund_amount REAL,
    status TEXT,
    customer_name TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // CRM customers table (simple example)
  db.run(`CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT UNIQUE,
    email TEXT,
    phone TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Audit trail table
  db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    refund_id INTEGER,
    action TEXT,
    performed_by TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(refund_id) REFERENCES refunds(id)
  )`);
});

// Log refund
exports.logRefund = ({ order_id, refund_amount, status, customer_name }) => {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO refunds (order_id, refund_amount, status, customer_name) VALUES (?, ?, ?, ?)`,
      [order_id, refund_amount, status, customer_name],
      function (err) {
        if (err) return reject(err);
        resolve(this.lastID);
      }
    );
  });
};

// Log audit event
exports.logAudit = ({ refund_id, action, performed_by }) => {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO audit_logs (refund_id, action, performed_by) VALUES (?, ?, ?)`,
      [refund_id, action, performed_by],
      function (err) {
        if (err) return reject(err);
        resolve(this.lastID);
      }
    );
  });
};

// Add or get customer
exports.upsertCustomer = ({ customer_name, email, phone }) => {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT OR IGNORE INTO customers (customer_name, email, phone) VALUES (?, ?, ?)`,
      [customer_name, email || null, phone || null],
      function (err) {
        if (err) return reject(err);
        resolve(this.lastID);
      }
    );
  });
};

module.exports = db;
