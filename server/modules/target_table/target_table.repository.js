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

  async findActiveConfigs({ tableName, actionType, recordId = null, requestId = null, targetTableId = null }) {
    let query = `
      SELECT t.*, r.requester, r.sr_creater, r.policy_lead, r.sr_owner, r.process_status
      FROM target_table t
      JOIN request r ON t.request = r.request_id
      WHERE t.deleted_at IS NULL AND r.process_status = 8
    `;
    const params = [];

    if (tableName) {
      params.push(tableName);
      query += ` AND (t.table_name = $${params.length} OR (t.table_name = 'policy' AND $${params.length} = 'policy_and_program') OR (t.table_name = 'policy_and_program' AND $${params.length} = 'policy'))`;
    }

    if (actionType) {
      params.push(actionType);
      query += ` AND t.type = $${params.length}`;
    }

    if (recordId) {
      params.push(String(recordId));
      query += ` AND $${params.length} = ANY(t.record_ids)`;
    }

    if (requestId) {
      params.push(requestId);
      query += ` AND t.request = $${params.length}`;
    }

    if (targetTableId) {
      params.push(targetTableId);
      query += ` AND t.target_table_id = $${params.length}`;
    }

    const res = await pool.query(query, params);
    return res.rows;
  }

  async appendRecordAndLog(targetTableId, recordId, action, userEmployeeId) {
    const row = await this.findById(targetTableId);
    if (!row) return null;

    let recordIds = Array.isArray(row.record_ids) ? [...row.record_ids] : [];
    const strRecordId = String(recordId);
    if (!recordIds.includes(strRecordId)) {
      recordIds.push(strRecordId);
    }

    let logs = [];
    try {
      logs = typeof row.log === 'string' ? JSON.parse(row.log) : (Array.isArray(row.log) ? [...row.log] : []);
    } catch (e) {
      logs = [];
    }

    logs = logs.filter(l => String(l.record_id) !== strRecordId);
    logs.push({
      record_id: strRecordId,
      action: action,
      user: userEmployeeId,
      timestamp: new Date().toISOString()
    });

    const res = await pool.query(
      `UPDATE target_table SET record_ids = $1, log = $2 WHERE target_table_id = $3 RETURNING *`,
      [recordIds, JSON.stringify(logs), targetTableId]
    );
    return res.rows[0];
  }

  async updateLogOnly(targetTableId, recordId, action, userEmployeeId) {
    const row = await this.findById(targetTableId);
    if (!row) return null;

    const strRecordId = String(recordId);
    let logs = [];
    try {
      logs = typeof row.log === 'string' ? JSON.parse(row.log) : (Array.isArray(row.log) ? [...row.log] : []);
    } catch (e) {
      logs = [];
    }

    logs = logs.filter(l => String(l.record_id) !== strRecordId);
    logs.push({
      record_id: strRecordId,
      action: action,
      user: userEmployeeId,
      timestamp: new Date().toISOString()
    });

    const res = await pool.query(
      `UPDATE target_table SET log = $1 WHERE target_table_id = $2 RETURNING *`,
      [JSON.stringify(logs), targetTableId]
    );
    return res.rows[0];
  }
}

module.exports = new TargetTableRepository();
