const pool = require('../../db');

class TargetTableRepository {
  async findById(id) {
    const res = await pool.query(
      `SELECT * FROM "target_table" WHERE target_table_id = $1 AND deleted_at IS NULL`,
      [id]
    );
    return res.rows[0] || null;
  }

  async findByRequestId(requestId) {
    const res = await pool.query(
      `SELECT * FROM "target_table" WHERE (request = $1 OR id__request = $1) AND deleted_at IS NULL ORDER BY target_table_id ASC`,
      [requestId]
    );
    return res.rows;
  }
}

module.exports = new TargetTableRepository();
