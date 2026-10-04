const pool = require('../../db');

class ServiceRepository {
  async findById(serviceId) {
    const res = await pool.query(
      `SELECT * FROM "service" WHERE service_id = $1 AND deleted_at IS NULL`,
      [serviceId]
    );
    return res.rows[0] || null;
  }

  async findByRequestId(requestId) {
    const res = await pool.query(
      `SELECT * FROM "service" WHERE (request = $1 OR id__request = $1) AND deleted_at IS NULL ORDER BY service_id ASC`,
      [requestId]
    );
    return res.rows;
  }
}

module.exports = new ServiceRepository();
