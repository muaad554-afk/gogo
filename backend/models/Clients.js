const db = require("../config/db");

class Client {
  static async create({ name, email }) {
    const sql = `INSERT INTO clients (name, email) VALUES (?, ?)`;
    const result = await db.run(sql, [name, email]);
    return result.lastID;
  }

  static async getAll() {
    return db.all("SELECT * FROM clients ORDER BY created_at DESC");
  }

  static async getById(id) {
    return db.get("SELECT * FROM clients WHERE id = ?", [id]);
  }
}

module.exports = Client;
