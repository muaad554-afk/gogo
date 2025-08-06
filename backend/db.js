const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
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

  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password_hash TEXT,
    twofa_secret TEXT
  )`);
});

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

exports.setUser2FASecret = (userId, secret) => {
  return new Promise((resolve, reject) => {
    db.run(
      "UPDATE users SET twofa_secret = ? WHERE id = ?",
      [secret, userId],
      (err) => {
        if (err) return reject(err);
        resolve();
      }
    );
  });
};

exports.getUser2FASecret = (userId) => {
  return new Promise((resolve, reject) => {
    db.get(
      "SELECT twofa_secret FROM users WHERE id = ?",
      [userId],
      (err, row) => {
        if (err) return reject(err);
        resolve(row ? row.twofa_secret : null);
      }
    );
  });
};

exports.logRefund = ({ order_id, refund_amount, status, customer_name }) => {
  return new Promise((resolve, reject) => {
    db.run(
      "INSERT INTO refunds (order_id, refund_amount, status, customer_name) VALUES (?, ?, ?, ?)",
      [order_id, refund_amount, status, customer_name],
      function (err) {
        if (err) return reject(err);
        resolve(this.lastID);
      }
    );
  });
};
