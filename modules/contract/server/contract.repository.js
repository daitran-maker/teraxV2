const pool = require('../../../server/db');

class ContractRepository {
  async findById(contractId) {
    const res = await pool.query(
      `SELECT * FROM "contract" WHERE contract_id = $1 AND deleted_at IS NULL`,
      [contractId]
    );
    return res.rows[0] || null;
  }

  async findByRequestId(requestId) {
    const res = await pool.query(
      `SELECT * FROM "contract" WHERE (request = $1 OR id__request = $1) AND deleted_at IS NULL ORDER BY contract_id ASC`,
      [requestId]
    );
    return res.rows;
  }

  async softDelete(contractId) {
    const res = await pool.query(
      `UPDATE "contract" SET deleted_at = CURRENT_TIMESTAMP WHERE contract_id = $1 AND deleted_at IS NULL RETURNING *`,
      [contractId]
    );
    return res.rows[0] || null;
  }
}

module.exports = new ContractRepository();
