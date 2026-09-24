const pool = require('../../../server/db');

class InvoiceRepository {
  async findById(invoiceId) {
    const res = await pool.query(
      `SELECT * FROM "invoice" WHERE invoice_id = $1 AND deleted_at IS NULL`,
      [invoiceId]
    );
    return res.rows[0] || null;
  }

  async findByRequestId(requestId) {
    const res = await pool.query(
      `SELECT * FROM "invoice" WHERE (request = $1 OR id__request = $1) AND deleted_at IS NULL ORDER BY invoice_id ASC`,
      [requestId]
    );
    return res.rows;
  }

  async findByContractId(contractId) {
    const res = await pool.query(
      `SELECT * FROM "invoice" WHERE contract = $1 AND deleted_at IS NULL ORDER BY invoice_id ASC`,
      [contractId]
    );
    return res.rows;
  }
}

module.exports = new InvoiceRepository();
