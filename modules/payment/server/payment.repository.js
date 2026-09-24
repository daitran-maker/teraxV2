const pool = require('../../../server/db');

class PaymentRepository {
  async findById(paymentId) {
    const res = await pool.query(
      `SELECT * FROM "payment" WHERE payment_id = $1 AND deleted_at IS NULL`,
      [paymentId]
    );
    return res.rows[0] || null;
  }

  async findByRequestId(requestId) {
    const res = await pool.query(
      `SELECT * FROM "payment" WHERE (request = $1 OR id__request = $1) AND deleted_at IS NULL ORDER BY payment_id ASC`,
      [requestId]
    );
    return res.rows;
  }

  async findByContractId(contractId) {
    const res = await pool.query(
      `SELECT * FROM "payment" WHERE contract = $1 AND deleted_at IS NULL ORDER BY payment_id ASC`,
      [contractId]
    );
    return res.rows;
  }
}

module.exports = new PaymentRepository();
