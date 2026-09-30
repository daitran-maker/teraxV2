const service = require('./asset.service');
const repo = require('./asset.repository');

const pool = require('../../../server/db');

class AssetHandler {
  async beforeInsert(req, data, client) {
    if (data.office_asset_id) {
      let candidateId = String(data.office_asset_id).trim();
      const db = client || pool;
      const checkRes = await db.query('SELECT 1 FROM "asset" WHERE "office_asset_id" = $1', [candidateId]);
      if (checkRes.rows.length > 0) {
        let suffix = 1;
        let uniqueId = `${candidateId}-${suffix}`;
        while ((await db.query('SELECT 1 FROM "asset" WHERE "office_asset_id" = $1', [uniqueId])).rows.length > 0) {
          suffix++;
          uniqueId = `${candidateId}-${suffix}`;
        }
        data.office_asset_id = uniqueId;
      }
    }
    return data;
  }

  async beforeUpdate(req, id, data) {
    return data;
  }
}

module.exports = new AssetHandler();
