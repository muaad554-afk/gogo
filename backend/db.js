const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database(process.env.DATABASE_URL || "refunds.db");

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
