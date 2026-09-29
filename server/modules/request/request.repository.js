const pool = require('../../db');

const _userReqIdsCache = new Map();
const USER_REQ_CACHE_TTL_MS = 30000;

class RequestRepository {
  clearCache() {
    _userReqIdsCache.clear();
  }

  /**
   * Fast RLS check to get all request IDs accessible by an employee
   */
  async getUserAccessibleRequestIds(empId) {
    if (!empId) return [];
    const normalizedId = String(empId).toLowerCase().trim();
    const cached = _userReqIdsCache.get(normalizedId);
    const now = Date.now();
    if (cached && (now - cached.time < USER_REQ_CACHE_TTL_MS)) {
      return cached.ids;
    }

    try {
      const subRes = await pool.query('SELECT LOWER(employee_id) as id FROM employee WHERE LOWER(direct_manager) = $1', [normalizedId]);
      const userAndSubIds = [normalizedId, ...subRes.rows.map(r => r.id)];
      const allVariants = Array.from(new Set([
        ...userAndSubIds.map(x => x.toLowerCase()),
        ...userAndSubIds.map(x => x.toUpperCase()),
        ...userAndSubIds
      ]));

      const q = `
        SELECT LOWER(request_id) as id
        FROM "request"
        WHERE
          LOWER(requester) = ANY($1::text[]) OR
          LOWER(sr_creater) = ANY($1::text[]) OR
          LOWER(policy_lead) = $2 OR
          sr_owner && $3::text[] OR
          EXISTS (SELECT 1 FROM jsonb_array_elements(approval_flow->'steps') AS step WHERE LOWER(step->>'approver') = $2) OR
          EXISTS (SELECT 1 FROM "comment" c WHERE LOWER(c.request) = LOWER(request_id) AND LOWER(c.tag) LIKE LOWER('%' || $2 || '%'))
      `;
      const res = await pool.query(q, [userAndSubIds, normalizedId, allVariants]);
      const ids = res.rows.map(r => r.id);
      _userReqIdsCache.set(normalizedId, { ids, time: now });
      return ids;
    } catch (err) {
      console.error('[RequestRepository] Error fetching accessible request IDs:', err);
      return [];
    }
  }

  async getRequestById(requestId) {
    const res = await pool.query('SELECT * FROM "request" WHERE request_id = $1 AND deleted_at IS NULL LIMIT 1', [requestId]);
    return res.rows[0] || null;
  }

  async getCommentsByRequest(requestId) {
    const res = await pool.query('SELECT * FROM "comment" WHERE LOWER(request) = LOWER($1) AND deleted_at IS NULL ORDER BY created_date ASC', [requestId]);
    return res.rows;
  }

  async getTasksByRequest(requestId) {
    const res = await pool.query('SELECT * FROM "assigned_task" WHERE request_id = $1 AND deleted_at IS NULL ORDER BY task_id ASC', [requestId]);
    return res.rows;
  }
}

module.exports = new RequestRepository();
