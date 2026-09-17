const pool = require('../../db');

class ExpenseRepository {
  async findById(expenseId) {
    const res = await pool.query(
      `SELECT * FROM "expense" WHERE id = $1 AND deleted_at IS NULL`,
      [expenseId]
    );
    return res.rows[0] || null;
  }

  async findByRequestId(requestId) {
    const res = await pool.query(
      `SELECT * FROM "expense" WHERE (request = $1 OR id__request = $1) AND deleted_at IS NULL ORDER BY id ASC`,
      [requestId]
    );
    return res.rows;
  }

  async getNextSequence(client) {
    const db = client || pool;
    const res = await db.query("SELECT nextval('expense_id_seq') as next_id");
    return res.rows[0].next_id;
  }
}

module.exports = new ExpenseRepository();
