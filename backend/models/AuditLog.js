const db = require("../config/db");

class AuditLog {
  static async create({ client_id, action, refund_log_id = null, new_status = null, user_id = null, timestamp = null }) {
    const sql = `
      INSERT INTO audit_logs (client_id, action, refund_log_id, new_status, user_id, timestamp)
      VALUES (?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
    `;
    const result = await db.run(sql, [client_id, action, refund_log_id, new_status, user_id, timestamp]);
    return result.lastID;
  }

  static async getAll({ client_id = null, limit = 100 } = {}) {
    let sql = "SELECT * FROM audit_logs";
    const params = [];
    if (client_id) {
      sql += " WHERE client_id = ?";
      params.push(client_id);
    }
    sql += " ORDER BY timestamp DESC LIMIT ?";
    params.push(limit);
    return db.all(sql, params);
  }
}

module.exports = AuditLog;
