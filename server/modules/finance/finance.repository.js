const pool = require('../../db');

class FinanceRepository {
  async getDistinctAccountCurrencies() {
    const result = await pool.query(
      `SELECT DISTINCT currency FROM "account" 
       WHERE currency IS NOT NULL AND TRIM(currency) <> '' AND account_status = 19 
       ORDER BY currency ASC`
    );
    return result.rows.map(r => r.currency);
  }

  async getPaymentsByRequest(requestId) {
    const res = await pool.query(
      `SELECT * FROM payment WHERE (request = $1 OR id__request = $1) AND deleted_at IS NULL`,
      [requestId]
    );
    return res.rows;
  }

  async getExpensesByRequest(requestId) {
    const res = await pool.query(
      `SELECT * FROM expense WHERE (request = $1 OR id__request = $1) AND deleted_at IS NULL`,
      [requestId]
    );
    return res.rows;
  }

  async getInvoicesByRequest(requestId) {
    const res = await pool.query(
      `SELECT * FROM invoice WHERE (request = $1 OR id__request = $1) AND deleted_at IS NULL`,
      [requestId]
    );
    return res.rows;
  }
}

module.exports = new FinanceRepository();
