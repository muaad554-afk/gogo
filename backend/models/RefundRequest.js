const db = require("../config/db");

class RefundRequest {
  static async create({ client_id, order_id, refund_amount, status, customer_name }) {
    const sql = `
      INSERT INTO refunds (client_id, order_id, refund_amount, status, customer_name)
      VALUES (?, ?, ?, ?, ?)
    `;
    const result = await db.run(sql, [client_id, order_id, refund_amount, status, customer_name]);
    return result.lastID;
  }

  static async updateStatus(id, newStatus) {
    return db.run("UPDATE refunds SET status = ? WHERE id = ?", [newStatus, id]);
  }

  static async getByClient({ client_id, status = null, startDate = null, endDate = null }) {
    let sql = "SELECT * FROM refunds WHERE client_id = ?";
    const params = [client_id];

    if (status) {
      sql += " AND status = ?";
      params.push(status);
    }
    if (startDate) {
      sql += " AND timestamp >= ?";
      params.push(startDate);
    }
    if (endDate) {
      sql += " AND timestamp <= ?";
      params.push(endDate);
    }
    sql += " ORDER BY timestamp DESC";

    return db.all(sql, params);
  }
}

module.exports = RefundRequest;
