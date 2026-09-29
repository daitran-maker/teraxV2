const express = require('express');
const router = express.Router();
const pool = require('../db');
const RequestModel = require('../models/requestModel');
const { checkPermission } = require('../helpers/permissionHelper');
const { enrichRecordWithStatusCatalog } = require('../helpers/statuses');

const DEBUG_MYVIEWS = process.env.DEBUG_MYVIEWS === 'true' || process.env.DEBUG_SQL === 'true';

let _auditFacetedCache = null;
let _auditFacetedCacheTime = 0;
const AUDIT_CACHE_TTL_MS = 60000;

router.get('/request-activity-log', async (req, res) => {
  const user = req.user;
  if (!user || !user.email) return res.status(401).json({ error: 'Unauthorized' });

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const offset = (page - 1) * limit;
  const search = req.query.search || '';

  // Dropdown filters
  const tableFilter = req.query.table_name;
  const monthFilter = req.query.month;
  const yearFilter = req.query.year;

  const ALLOWED_TABLES = [
    'employee', 'payment', 'expense', 'request', 'service', 'asset', 'mtr', 'account',
    'contract', 'invoice', 'department', 'my_company', 'company', 'contact',
    'policy_and_program', 'oppotunity', 'target_table', 'my_location', 'assigned_task',
    'task_subtask', 'operation_program', 'ticket', 'cms_tenant_info', 'request_rating'
  ];
  const allowedLogsTables = ALLOWED_TABLES.map(t => `'${t}'`).join(',');

  try {
    let whereConditions = [`a.table_name IN (${allowedLogsTables})`];
    let values = [];
    let paramIdx = 1;

    // Search condition
    if (search) {
      whereConditions.push(`(
        a.record_id ILIKE $${paramIdx} OR 
        a.changed_by ILIKE $${paramIdx} OR
        a.action ILIKE $${paramIdx} OR
        COALESCE(r.description, p.counter_party, ex.description) ILIKE $${paramIdx}
      )`);
      values.push(`%${search}%`);
      paramIdx++;
    }

    // Table filter
    if (tableFilter) {
      const tables = tableFilter.split(',').map(t => t.trim());
      if (tables.length > 0) {
        const placeHolders = tables.map((_, i) => `$${paramIdx + i}`).join(',');
        whereConditions.push(`a.table_name IN (${placeHolders})`);
        values.push(...tables);
        paramIdx += tables.length;
      }
    }

    // Month filter
    if (monthFilter) {
      const months = monthFilter.split(',').map(m => m.trim().padStart(2, '0'));
      if (months.length > 0) {
        const placeHolders = months.map((_, i) => `$${paramIdx + i}`).join(',');
        whereConditions.push(`to_char(a.created_at, 'MM') IN (${placeHolders})`);
        values.push(...months);
        paramIdx += months.length;
      }
    }

    // Year filter
    if (yearFilter) {
      const years = yearFilter.split(',').map(y => y.trim());
      if (years.length > 0) {
        const placeHolders = years.map((_, i) => `$${paramIdx + i}`).join(',');
        whereConditions.push(`to_char(a.created_at, 'YYYY') IN (${placeHolders})`);
        values.push(...years);
        paramIdx += years.length;
      }
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Total records count query - omit heavy JOINs if no search query
    const totalQuery = search ? `
      SELECT COUNT(*)
      FROM audit_logs a
      LEFT JOIN request r ON a.table_name = 'request' AND a.record_id = r.request_id
      LEFT JOIN payment p ON a.table_name = 'payment' AND a.record_id = p.payment_id
      ${whereClause}
    ` : `
      SELECT COUNT(*)
      FROM audit_logs a
      ${whereClause}
    `;
    const countRes = await pool.query(totalQuery, values);
    const total = parseInt(countRes.rows[0].count, 10) || 0;

    // Data query
    const dataQuery = `
      SELECT 
        a.id,
        a.table_name,
        a.record_id AS request_id,
        COALESCE(
          r.description,
          p.counter_party,
          a.table_name || ' #' || a.record_id
        ) AS description,
        a.changed_by AS username,
        a.action,
        to_char(a.created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS timestamp,
        a.changes,
        a.created_at AS log_time
      FROM audit_logs a
      LEFT JOIN request r ON a.table_name = 'request' AND a.record_id = r.request_id
      LEFT JOIN payment p ON a.table_name = 'payment' AND a.record_id = p.payment_id
      ${whereClause}
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `;
    const result = await pool.query(dataQuery, [...values, limit, offset]);

    // Faceted summary logic with caching
    let faceted_summary = {};
    if (page === 1) {
      const isCleanFilter = !search && !tableFilter && !monthFilter && !yearFilter;
      const now = Date.now();
      if (isCleanFilter && _auditFacetedCache && (now - _auditFacetedCacheTime < AUDIT_CACHE_TTL_MS)) {
        faceted_summary = _auditFacetedCache;
      } else {
        const [tableRes, monthRes, yearRes] = await Promise.all([
          pool.query(`SELECT table_name, COUNT(*)::int FROM audit_logs WHERE table_name IN (${allowedLogsTables}) GROUP BY table_name`),
          pool.query(`SELECT to_char(created_at, 'MM') AS m, COUNT(*)::int FROM audit_logs WHERE table_name IN (${allowedLogsTables}) GROUP BY to_char(created_at, 'MM')`),
          pool.query(`SELECT to_char(created_at, 'YYYY') AS y, COUNT(*)::int FROM audit_logs WHERE table_name IN (${allowedLogsTables}) GROUP BY to_char(created_at, 'YYYY')`)
        ]);

        const table_name = {};
        tableRes.rows.forEach(r => { table_name[r.table_name] = r.count; });
        faceted_summary.table_name = table_name;

        const month = {};
        monthRes.rows.forEach(r => { month[r.m] = r.count; });
        faceted_summary.month = month;

        const year = {};
        yearRes.rows.forEach(r => { year[r.y] = r.count; });
        faceted_summary.year = year;

        if (isCleanFilter) {
          _auditFacetedCache = faceted_summary;
          _auditFacetedCacheTime = now;
        }
      }
    }

    res.json({
      data: result.rows,
      meta: {
        total,
        page,
        limit,
        faceted_summary
      }
    });
  } catch (err) {
    console.error('Error in request-activity-log:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/request-activity-log/:id', async (req, res) => {
  const { id } = req.params;
  const user = req.user;
  if (!user || !user.email) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const logRes = await pool.query(
      `SELECT 
        a.id,
        a.table_name,
        a.record_id AS request_id,
        COALESCE(
          r.description,
          p.counter_party,
          a.table_name || ' #' || a.record_id
        ) AS description,
        a.changed_by AS username,
        a.action,
        to_char(a.created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS timestamp,
        a.changes,
        a.created_at AS log_time
      FROM audit_logs a
      LEFT JOIN request r ON a.table_name = 'request' AND a.record_id = r.request_id
      LEFT JOIN payment p ON a.table_name = 'payment' AND a.record_id = p.payment_id
      WHERE a.id = $1`,
      [id]
    );

    if (logRes.rows.length === 0) {
      return res.status(404).json({ error: 'Log entry not found' });
    }

    res.json(logRes.rows[0]);
  } catch (err) {
    console.error('Error fetching single log entry:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/my-views/stats/summary
 * Ultra-fast aggregate counts for Dashboard Stat Cards
 */
router.get('/stats/summary', async (req, res) => {
  const user = req.user;
  if (!user || !user.email) return res.status(401).json({ error: 'Unauthorized' });

  let empId = user.employee_id;
  if (!empId && (user.email || user.username)) {
    const resDb = await pool.query('SELECT employee_id FROM employee WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($2)', [user.email, user.username || '']);
    if (resDb.rows.length > 0) {
      empId = resDb.rows[0].employee_id;
    }
  }

  if (!empId) {
    return res.json({ my_request: 0, my_approval: 0, my_process_owner: 0, my_task: 0 });
  }

  const userEmpId = (empId || '').toLowerCase();
  const userEmail = (user.email || '').toLowerCase();
  const isSuperAdmin = user.role && user.role.toUpperCase() === 'SUPER ADMIN';

  try {
    const [reqCountRes, appCountRes, taskCountRes] = await Promise.all([
      // My Requests count
      pool.query(`
        SELECT COUNT(*)::int as count 
        FROM request r 
        WHERE (LOWER(r.sr_creater) = $1 OR LOWER(r.sr_creater) = $2 OR LOWER(r.requester) = $1 OR LOWER(r.requester) = $2)
          ${isSuperAdmin ? '' : 'AND r.deleted_at IS NULL'}
      `, [userEmpId, userEmail]),

      // My Approvals count (Pending)
      pool.query(`
        SELECT COUNT(*)::int as count 
        FROM request r 
        WHERE r.sr_status NOT IN (1, 4, 5, 6)
          ${isSuperAdmin ? '' : 'AND r.deleted_at IS NULL'}
          AND EXISTS (
            SELECT 1 
            FROM jsonb_array_elements(r.approval_flow->'steps') AS step 
            WHERE (LOWER(step->>'approver') = $1 OR LOWER(step->>'approver') = $2)
              AND (step->>'status' = '2' OR LOWER(step->>'status') IN ('pending', 'pending approval'))
          )
      `, [userEmpId, userEmail]),

      // My Tasks / Process Owner count (Active: Approved / In Progress)
      pool.query(`
        SELECT COUNT(*)::int as count 
        FROM request r 
        WHERE (EXISTS (SELECT 1 FROM unnest(r.sr_owner) AS o WHERE LOWER(o) = $1 OR LOWER(o) = $2))
          AND r.sr_status IN (3, 5)
          AND r.process_status NOT IN (9, 10, 16)
          ${isSuperAdmin ? '' : 'AND r.deleted_at IS NULL'}
      `, [userEmpId, userEmail])
    ]);

    res.json({
      my_request: reqCountRes.rows[0]?.count || 0,
      my_approval: appCountRes.rows[0]?.count || 0,
      my_process_owner: taskCountRes.rows[0]?.count || 0,
      my_task: taskCountRes.rows[0]?.count || 0
    });
  } catch (err) {
    console.error('Error in /my-views/stats/summary:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/my-views/:viewType
 * viewType: 'my-request' | 'my-approval' | 'my-task'
 * Returns all matching requests for the logged-in user
 */
router.get('/:viewType', async (req, res) => {
  try {
    const viewType = req.params.viewType; // e.g. "my-request", "my-approval", "my-task", "my-team"
    const user = req.user;
    const viewModuleMap = {
      'my-request': 'my_request',
      'my_request': 'my_request',
      'my-approval': 'my_approval',
      'my_approval': 'my_approval',
      'my-process-owner': 'my_process_owner',
      'my_process_owner': 'my_process_owner',
      'my-task': 'my_process_owner',
      'my_task': 'my_process_owner',
      'my-team': 'my_team',
      'my_team': 'my_team'
    };
    const sliceName = viewModuleMap[viewType];
    if (sliceName) {
      const hasSliceAccess = await checkPermission('exception_rules', sliceName, user);
      if (!hasSliceAccess) {
        return res.status(403).json({ error: 'You do not have permission to view this content.' });
      }
    }

    let empId = user.employee_id;
    if (!empId && (user.email || user.username)) {
      const resDb = await pool.query('SELECT employee_id FROM employee WHERE email = $1 OR username = $2', [user.email, user.username]);
      if (resDb.rows.length > 0) {
        empId = resDb.rows[0].employee_id;
      }
    }
    
    if (DEBUG_MYVIEWS) console.log(`[myViews] viewType=${viewType}, user=${JSON.stringify(user)}, resolved empId=${empId}`);

    if (!empId) {
      if (DEBUG_MYVIEWS) console.log(`[myViews] No empId found. Returning empty array.`);
      return res.json({ data: [] });
    }

    let query = '';
    let values = [];
    const isSuperAdmin = user.role && user.role.toUpperCase() === 'SUPER ADMIN';
    const userEmpId = (empId || '').toLowerCase();
    const userEmail = (user.email || '').toLowerCase();
    const userUsername = (user.username || '').toLowerCase();

    if (viewType === 'my-request' || viewType === 'my_request') {
      // My request: user is Requester or Sr creator (support employee_id and email)
      query = `
        SELECT r.*, 
          COALESCE(
            r.parent__id_request, 
            (SELECT COALESCE(p.request, c.request) FROM payment p LEFT JOIN contract c ON p.contract_id = c.contract_id WHERE p.payment_request = r.request_id AND (p.request IS NOT NULL OR c.request IS NOT NULL) LIMIT 1)
          ) AS parent_request_id,
          mc.company_shortname as company_id, p.policy_name, p.sla as policy_sla 
        FROM request r
        LEFT JOIN employee e ON r.requester = e.employee_id
        LEFT JOIN my_company mc ON e.company_id = mc.my_company_id
        LEFT JOIN policy_and_program p ON r.request_type = p.policy_id::text
        WHERE (
          LOWER(r.sr_creater) = $1 OR LOWER(r.sr_creater) = $2 OR
          LOWER(r.requester) = $1 OR LOWER(r.requester) = $2
        )
          ${isSuperAdmin ? '' : 'AND r.deleted_at IS NULL'}
        ORDER BY r.sr_created_date DESC NULLS LAST
        LIMIT 1000
      `;
      values = [userEmpId, userEmail];
    } else if (viewType === 'my-approval' || viewType === 'my_approval') {
      // My approvals: user is approver (ID or Email), excludes Draft (1), views pending and approved/rejected history
      query = `
        SELECT r.*, 
          COALESCE(
            r.parent__id_request, 
            (SELECT COALESCE(p.request, c.request) FROM payment p LEFT JOIN contract c ON p.contract_id = c.contract_id WHERE p.payment_request = r.request_id AND (p.request IS NOT NULL OR c.request IS NOT NULL) LIMIT 1)
          ) AS parent_request_id,
          mc.company_shortname as company_id, p.policy_name, p.sla as policy_sla 
        FROM request r
        LEFT JOIN employee e ON r.requester = e.employee_id
        LEFT JOIN my_company mc ON e.company_id = mc.my_company_id
        LEFT JOIN policy_and_program p ON r.request_type = p.policy_id::text
        WHERE r.sr_status != 1
          ${isSuperAdmin ? '' : 'AND r.deleted_at IS NULL'}
          AND (
            EXISTS (
              SELECT 1
              FROM jsonb_array_elements(r.approval_flow->'steps') AS step
              WHERE (LOWER(step->>'approver') = $1 OR LOWER(step->>'approver') = $2)
              AND (
                step->>'status' IN ('2', '3', '4', '7')
                OR LOWER(step->>'status') IN ('pending', 'pending approval', 'approved', 'rejected', 'not started yet', 'not started')
              )
            )
          )
        ORDER BY r.sr_created_date DESC NULLS LAST
        LIMIT 1000
      `;
      values = [userEmpId, userEmail];
    } else if (viewType === 'my-process-owner' || viewType === 'my_process_owner' || viewType === 'my-task' || viewType === 'my_task') {
      // My Process Owner: user is in sr_owner (ID or Email) and request is Approved (3) or Closed (5)
      query = `
        SELECT r.*, mc.company_shortname as company_id, p.policy_name, p.sla as policy_sla 
        FROM request r
        LEFT JOIN employee e ON r.requester = e.employee_id
        LEFT JOIN my_company mc ON e.company_id = mc.my_company_id
        LEFT JOIN policy_and_program p ON r.request_type = p.policy_id::text
        WHERE (
          EXISTS (SELECT 1 FROM unnest(r.sr_owner) AS o WHERE LOWER(o) = $1 OR LOWER(o) = $2)
        )
          AND r.sr_status IN (3, 5)
          ${isSuperAdmin ? '' : 'AND r.deleted_at IS NULL'}
        ORDER BY r.sr_created_date DESC NULLS LAST
        LIMIT 1000
      `;
      values = [userEmpId, userEmail];
    } else if (viewType === 'my-team') {
      // My Process / My Team: user is policy lead (ID or Email), prior steps Approved, excludes Draft (1), Rejected (4), Cancelled (6)
      query = `
        SELECT r.*, mc.company_shortname as company_id, p.policy_name, p.sla as policy_sla 
        FROM request r
        LEFT JOIN employee e ON r.requester = e.employee_id
        LEFT JOIN my_company mc ON e.company_id = mc.my_company_id
        LEFT JOIN policy_and_program p ON r.request_type = p.policy_id::text
        WHERE (LOWER(r.policy_lead) = $1 OR LOWER(r.policy_lead) = $2)
          AND NOT EXISTS (
            SELECT 1 
            FROM jsonb_array_elements(r.approval_flow->'steps') AS step 
            WHERE step->>'status' NOT IN ('3', '7')
              AND LOWER(step->>'status') NOT IN ('approved', 'not started yet', 'not started')
          )
          AND r.sr_status NOT IN (1, 4, 6)
          ${isSuperAdmin ? '' : 'AND r.deleted_at IS NULL'}
        ORDER BY r.sr_created_date DESC NULLS LAST
        LIMIT 1000
      `;
      values = [userEmpId, userEmail];
    } else {
      return res.status(400).json({ error: 'Invalid view type' });
    }

    const search = req.query.search;
    if (search) {
      const searchIdx = values.length + 1;
      query = `
        SELECT * FROM (
          ${query}
        ) as search_wrapper
        WHERE (
          request_id ILIKE $${searchIdx} OR
          description ILIKE $${searchIdx} OR
          policy_name ILIKE $${searchIdx} OR
          requester ILIKE $${searchIdx} OR
          EXISTS (SELECT 1 FROM UNNEST(COALESCE(sr_owner, ARRAY[]::text[])) x WHERE x ILIKE $${searchIdx})
        )
      `;
      values.push(`%${search}%`);
    }

    const { sort_by, sort_dir } = req.query;
    if (sort_by) {
      const allowedRequestSortCols = [
        'request_id', 'description', 'request_type', 'requester', 'sr_creater',
        'sr_status', 'sr_submitted_date', 'sr_owner', 'policy_lead', 'process_status',
        'company_id', 'policy_name', 'sr_created_date', 'sr_owner_fullname', 'direct_manager'
      ];
      if (allowedRequestSortCols.includes(sort_by)) {
        const dir = (sort_dir && sort_dir.toUpperCase() === 'ASC') ? 'ASC' : 'DESC';
        query = `
          SELECT * FROM (
            ${query}
          ) as sort_wrapper
          ORDER BY "${sort_by}" ${dir} NULLS LAST
        `;
      }
    }

    const result = await pool.query(query, values);
    let data = result.rows;

    // No post-processing filter needed as database query pre-filters duplicates and tier rejections

    data.forEach(r => {
      RequestModel.enrichRequest(r);
      enrichRecordWithStatusCatalog('request', r);
    });

    res.json({ data });
  } catch (err) {
    console.error('Error in my-views:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
