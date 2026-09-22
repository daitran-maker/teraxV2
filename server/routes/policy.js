const express = require('express');
const router = express.Router();
const pool = require('../db');
const { generateSequentialId } = require('../helpers/idGenerator');
const { broadcastSSE } = require('../helpers/sseHelper');
const { getRecordAuditLogs } = require('../helpers/auditHelper');

// GET all
router.get('/', async (req, res) => {
  const { search, sort_by, sort_dir, ...filters } = req.query;
  const isSuperAdmin = req.user && req.user.role && req.user.role.toUpperCase() === 'SUPER ADMIN';
  try {
    let whereClauses = isSuperAdmin ? [] : ['p.deleted_at IS NULL'];
    let values = [];
    let valIdx = 1;

    for (const [key, value] of Object.entries(filters)) {
      if (['page', 'limit', 'slice', 'summary'].includes(key)) continue;
      whereClauses.push(`p.${key} = $${valIdx}`);
      values.push(value);
      valIdx++;
    }

    let orderBy = 'p.policy_name';
    if (sort_by) {
      const allowedCols = ['policy_id', 'policy_name', 'policy_type', 'description', 'request_count', 'department_name', 'company_shortname'];
      if (allowedCols.includes(sort_by)) {
        const dir = (sort_dir && sort_dir.toUpperCase() === 'ASC') ? 'ASC' : 'DESC';
        if (sort_by === 'request_count') {
          orderBy = `request_count ${dir}`;
        } else if (sort_by === 'department_name') {
          orderBy = `d.department_name ${dir}`;
        } else if (sort_by === 'company_shortname') {
          orderBy = `mc.company_shortname ${dir}`;
        } else {
          orderBy = `p."${sort_by}" ${dir}`;
        }
      }
    }

    if (search) {
      whereClauses.push(`"POLICY_AND_PROGRAM"::text ILIKE $${valIdx}`);
      values.push(`%${search}%`);
      valIdx++;
    }

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const query = `
      SELECT p.*,
        (CASE WHEN t1.status = 18 OR LOWER(CAST(t1.status AS text)) = 'inactive' THEN COALESCE(t1.email, t1.username, t1.full_name) ELSE CASE WHEN t1.email IS NOT NULL AND t1.email <> '' THEN t1.full_name || ' (' || t1.email || ')' ELSE t1.full_name END END) AS tier1_name,
        (CASE WHEN t2.status = 18 OR LOWER(CAST(t2.status AS text)) = 'inactive' THEN COALESCE(t2.email, t2.username, t2.full_name) ELSE CASE WHEN t2.email IS NOT NULL AND t2.email <> '' THEN t2.full_name || ' (' || t2.email || ')' ELSE t2.full_name END END) AS tier2_name,
        (CASE WHEN t3.status = 18 OR LOWER(CAST(t3.status AS text)) = 'inactive' THEN COALESCE(t3.email, t3.username, t3.full_name) ELSE CASE WHEN t3.email IS NOT NULL AND t3.email <> '' THEN t3.full_name || ' (' || t3.email || ')' ELSE t3.full_name END END) AS tier3_name,
        (CASE WHEN pl.status = 18 OR LOWER(CAST(pl.status AS text)) = 'inactive' THEN COALESCE(pl.email, pl.username, pl.full_name) ELSE CASE WHEN pl.email IS NOT NULL AND pl.email <> '' THEN pl.full_name || ' (' || pl.email || ')' ELSE pl.full_name END END) AS policy_lead_name,
        (
          SELECT string_agg(
            CASE 
              WHEN LOWER(COALESCE(sr.status::text, '')) IN ('inactive', '18') THEN COALESCE(sr.email, sr.username, sr.full_name, owner_item)
              WHEN sr.email IS NOT NULL AND sr.email <> '' THEN sr.full_name || ' (' || sr.email || ')'
              ELSE COALESCE(sr.full_name, owner_item)
            END, ', '
          )
          FROM unnest(string_to_array(replace(replace(COALESCE(p.sr_owner, ''), '[', ''), ']', ''), ',')) AS owner_item
          LEFT JOIN EMPLOYEE sr ON LOWER(TRIM(owner_item)) = LOWER(sr.employee_id) OR LOWER(TRIM(owner_item)) = LOWER(sr.email)
          WHERE TRIM(owner_item) <> ''
        ) AS sr_owner_name,
        mc.company_shortname,
        d.department_name,
        (SELECT COUNT(*)::int FROM request r WHERE r.request_type = p.policy_id AND r.deleted_at IS NULL) AS request_count
      FROM POLICY_AND_PROGRAM p
      LEFT JOIN EMPLOYEE t1 ON (p.tier1_approval = t1.employee_id OR p.tier1_approval = t1.email)
      LEFT JOIN EMPLOYEE t2 ON (p.tier2_approval = t2.employee_id OR p.tier2_approval = t2.email)
      LEFT JOIN EMPLOYEE t3 ON (p.tier3_approval = t3.employee_id OR p.tier3_approval = t3.email)
      LEFT JOIN EMPLOYEE pl ON (p.policy_lead = pl.employee_id OR p.policy_lead = pl.email)
      LEFT JOIN MY_COMPANY mc ON CAST(p.company_id AS text) = CAST(mc.my_company_id AS text)
      LEFT JOIN DEPARTMENT d ON CAST(p.department_id AS text) = CAST(d.department_id AS text)
      ${whereStr}
      ORDER BY ${orderBy}
    `;

    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  const isSuperAdmin = req.user && req.user.role && req.user.role.toUpperCase() === 'SUPER ADMIN';
  try {
    let query = `
      SELECT p.*,
        (CASE WHEN t1.status = 18 OR LOWER(CAST(t1.status AS text)) = 'inactive' THEN COALESCE(t1.email, t1.username, t1.full_name) ELSE CASE WHEN t1.email IS NOT NULL AND t1.email <> '' THEN t1.full_name || ' (' || t1.email || ')' ELSE t1.full_name END END) AS tier1_name,
        (CASE WHEN t2.status = 18 OR LOWER(CAST(t2.status AS text)) = 'inactive' THEN COALESCE(t2.email, t2.username, t2.full_name) ELSE CASE WHEN t2.email IS NOT NULL AND t2.email <> '' THEN t2.full_name || ' (' || t2.email || ')' ELSE t2.full_name END END) AS tier2_name,
        (CASE WHEN t3.status = 18 OR LOWER(CAST(t3.status AS text)) = 'inactive' THEN COALESCE(t3.email, t3.username, t3.full_name) ELSE CASE WHEN t3.email IS NOT NULL AND t3.email <> '' THEN t3.full_name || ' (' || t3.email || ')' ELSE t3.full_name END END) AS tier3_name,
        (CASE WHEN pl.status = 18 OR LOWER(CAST(pl.status AS text)) = 'inactive' THEN COALESCE(pl.email, pl.username, pl.full_name) ELSE CASE WHEN pl.email IS NOT NULL AND pl.email <> '' THEN pl.full_name || ' (' || pl.email || ')' ELSE pl.full_name END END) AS policy_lead_name,
        (
          SELECT string_agg(
            CASE 
              WHEN LOWER(COALESCE(sr.status::text, '')) IN ('inactive', '18') THEN COALESCE(sr.email, sr.username, sr.full_name, owner_item)
              WHEN sr.email IS NOT NULL AND sr.email <> '' THEN sr.full_name || ' (' || sr.email || ')'
              ELSE COALESCE(sr.full_name, owner_item)
            END, ', '
          )
          FROM unnest(string_to_array(replace(replace(COALESCE(p.sr_owner, ''), '[', ''), ']', ''), ',')) AS owner_item
          LEFT JOIN EMPLOYEE sr ON LOWER(TRIM(owner_item)) = LOWER(sr.employee_id) OR LOWER(TRIM(owner_item)) = LOWER(sr.email)
          WHERE TRIM(owner_item) <> ''
        ) AS sr_owner_name,
        mc.company_shortname,
        d.department_name,
        (SELECT COUNT(*)::int FROM request r WHERE r.request_type = p.policy_id AND r.deleted_at IS NULL) AS request_count
      FROM POLICY_AND_PROGRAM p
      LEFT JOIN EMPLOYEE t1 ON (p.tier1_approval = t1.employee_id OR p.tier1_approval = t1.email)
      LEFT JOIN EMPLOYEE t2 ON (p.tier2_approval = t2.employee_id OR p.tier2_approval = t2.email)
      LEFT JOIN EMPLOYEE t3 ON (p.tier3_approval = t3.employee_id OR p.tier3_approval = t3.email)
      LEFT JOIN EMPLOYEE pl ON (p.policy_lead = pl.employee_id OR p.policy_lead = pl.email)
      LEFT JOIN MY_COMPANY mc ON CAST(p.company_id AS text) = CAST(mc.my_company_id AS text)
      LEFT JOIN DEPARTMENT d ON CAST(p.department_id AS text) = CAST(d.department_id AS text)
      WHERE p.policy_id = $1
    `;
    if (!isSuperAdmin) {
      query += ` AND p.deleted_at IS NULL`;
    }
    const result = await pool.query(query, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const record = result.rows[0];
    try {
      record.log = await getRecordAuditLogs('policy_and_program', record.policy_id || req.params.id, record.log);
    } catch (e) {
      console.error('Error enriching policy audit logs:', e.message);
    }
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function normalizeMultiString(val) {
  if (val === null || val === undefined) return null;
  let items = [];
  if (Array.isArray(val)) {
    items = val.map(s => String(s).trim().replace(/^\[|\]$/g, '')).filter(Boolean);
  } else if (typeof val === 'string') {
    items = val.split(',').map(s => String(s).trim().replace(/^\[|\]$/g, '')).filter(Boolean);
  }
  return items.length > 0 ? items.join(', ') : null;
}

// POST create
router.post('/', async (req, res) => {
  const {
    policy_type, policy_name, description, procedure_file, procedure_link,
    tier1_approval, tier2_approval, tier3_approval, approval_level,
    policy_lead, sr_owner, elements, company_id, department_id, sla
  } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const id = await generateSequentialId('policy_and_program', client);
    const slaVal = (sla !== undefined && sla !== null && sla !== '') ? Number(sla) : null;
    const cleanSrOwner = normalizeMultiString(sr_owner);
    const cleanElements = normalizeMultiString(elements);
    const result = await client.query(
      `INSERT INTO POLICY_AND_PROGRAM (
        policy_id, policy_type, policy_name, description, procedure_file, procedure_link,
        tier1_approval, tier2_approval, tier3_approval, approval_level, policy_lead, sr_owner, elements,
        company_id, department_id, sla
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [id, policy_type, policy_name, description, procedure_file, procedure_link,
       tier1_approval || null, tier2_approval || null, tier3_approval || null,
       approval_level, policy_lead, cleanSrOwner, cleanElements,
       company_id || null, department_id || null, slaVal]
    );
    await client.query('COMMIT');
    broadcastSSE('db_change', { action: 'insert', table: 'policy_and_program', record: result.rows[0] });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.put('/:id', async (req, res) => {
  const {
    policy_type, policy_name, description, procedure_file, procedure_link,
    tier1_approval, tier2_approval, tier3_approval, approval_level,
    policy_lead, sr_owner, elements, company_id, department_id, sla
  } = req.body;
  const isSuperAdmin = req.user && req.user.role && req.user.role.toUpperCase() === 'SUPER ADMIN';
  try {
    const slaVal = (sla !== undefined && sla !== null && sla !== '') ? Number(sla) : null;
    const cleanSrOwner = normalizeMultiString(sr_owner);
    const cleanElements = normalizeMultiString(elements);
    let query = `UPDATE POLICY_AND_PROGRAM SET
        policy_type=$1, policy_name=$2, description=$3, procedure_file=$4, procedure_link=$5,
        tier1_approval=$6, tier2_approval=$7, tier3_approval=$8, approval_level=$9,
        policy_lead=$10, sr_owner=$11, elements=$12, company_id=$13, department_id=$14,
        sla=$15
       WHERE policy_id=$16`;
    if (!isSuperAdmin) {
      query += ` AND deleted_at IS NULL`;
    }
    query += ` RETURNING *`;
    const result = await pool.query(
      query,
      [policy_type, policy_name, description, procedure_file, procedure_link,
       tier1_approval || null, tier2_approval || null, tier3_approval || null,
       approval_level, policy_lead, cleanSrOwner, cleanElements,
       company_id || null, department_id || null, slaVal, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    broadcastSSE('db_change', { action: 'update', table: 'policy_and_program', record: result.rows[0] });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE
router.delete('/:id', async (req, res) => {
  try {
    const userRole = req.user && req.user.role ? req.user.role : '';
    const isSuperAdmin = userRole.toUpperCase() === 'SUPER ADMIN';

    if (req.query.hard === 'true') {
      if (!isSuperAdmin) {
        return res.status(403).json({ error: 'Access denied: Only Super Admin can perform permanent deletions.' });
      }
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('DELETE FROM policy_and_program WHERE policy_id = $1', [req.params.id]);
        await client.query('COMMIT');
        broadcastSSE('db_change', { action: 'delete', table: 'policy_and_program', id: req.params.id });
        return res.json({ message: 'Permanently deleted successfully' });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    const result = await pool.query('UPDATE POLICY_AND_PROGRAM SET deleted_at = CURRENT_TIMESTAMP WHERE policy_id = $1 AND deleted_at IS NULL RETURNING *', [req.params.id]);
    if (result.rows.length > 0) {
      broadcastSSE('db_change', { action: 'delete', table: 'policy_and_program', id: req.params.id, record: result.rows[0] });
    }
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

