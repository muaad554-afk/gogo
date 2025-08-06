const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database(process.env.DATABASE_URL || "refunds.db");

// Initialize refunds table if not exists
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS refunds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT,
    refund_amount REAL,
    status TEXT,
    customer_name TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// Insert a refund log entry
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

// Update refund status by refund id
exports.updateRefundStatus = (refundId, newStatus) => {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE refunds SET status = ? WHERE id = ?`,
      [newStatus, refundId],
      function (err) {
        if (err) return reject(err);
        if (this.changes === 0) return reject(new Error("Refund ID not found"));
        resolve();
      }
    );
  });
};

// Optional: get refund by id (for testing/debugging)
exports.getRefundById = (refundId) => {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM refunds WHERE id = ?`,
      [refundId],
      (err, row) => {
        if (err) return reject(err);
        resolve(row);
      }
    );
  });
};
