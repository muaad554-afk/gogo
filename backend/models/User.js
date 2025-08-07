const db = require("../config/db");

class User {
  static async create({ username, passwordHash, isAdmin = false }) {
    const sql = `
      INSERT INTO users (username, password_hash, is_admin)
      VALUES (?, ?, ?)
    `;
    const result = await db.run(sql, [username, passwordHash, isAdmin ? 1 : 0]);
    return result.lastID;
  }

  static async getByUsername(username) {
    return db.get("SELECT * FROM users WHERE username = ?", [username]);
  }

  static async set2FASecret(userId, secret) {
    return db.run("UPDATE users SET twofa_secret = ? WHERE id = ?", [secret, userId]);
  }

  static async get2FASecret(userId) {
    const row = await db.get("SELECT twofa_secret FROM users WHERE id = ?", [userId]);
    return row ? row.twofa_secret : null;
  }
}

module.exports = User;
