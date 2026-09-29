const pool = require('../../../server/db');

class AssetRepository {
  async findById(assetId) {
    const res = await pool.query(
      `SELECT * FROM "asset" WHERE office_asset_id = $1 AND deleted_at IS NULL`,
      [assetId]
    );
    return res.rows[0] || null;
  }

  async findByRequestId(requestId) {
    const res = await pool.query(
      `SELECT * FROM "asset" WHERE (request = $1 OR id__request = $1) AND deleted_at IS NULL ORDER BY office_asset_id ASC`,
      [requestId]
    );
    return res.rows;
  }
}

module.exports = new AssetRepository();
