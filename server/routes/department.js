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
    let whereClauses = isSuperAdmin ? [] : ['d.deleted_at IS NULL'];
    let values = [];
    let valIdx = 1;

    for (const [key, value] of Object.entries(filters)) {
      if (['page', 'limit', 'slice', 'summary'].includes(key)) continue;
      // Handle the case where the key might be in the d. prefix or similar
      const dbKey = key === 'company_id' ? 'd.company_id' : `d.${key}`;
      whereClauses.push(`${dbKey} = $${valIdx}`);
      values.push(value);
      valIdx++;
    }

    let orderBy = `CASE WHEN d.department_id ~ '^[0-9]+$' THEN d.department_id::numeric ELSE 0 END DESC, d.department_id DESC`;
    if (sort_by) {
      const allowedCols = ['department_id', 'department_code', 'deparment_code', 'department_name', 'type', 'company_shortname', 'department_label', 'manager_email'];
      if (allowedCols.includes(sort_by)) {
        const dir = (sort_dir && sort_dir.toUpperCase() === 'ASC') ? 'ASC' : 'DESC';
        if (sort_by === 'company_shortname') {
          orderBy = `d.company_shortname ${dir}`;
        } else if (sort_by === 'department_id') {
          orderBy = `CASE WHEN d.department_id ~ '^[0-9]+$' THEN d.department_id::numeric ELSE 0 END ${dir}, d.department_id ${dir}`;
        } else {
          orderBy = `d."${sort_by}" ${dir}`;
        }
      }
    }

    if (search) {
      whereClauses.push(`(d.department_name ILIKE $${valIdx} OR d.department_code ILIKE $${valIdx} OR d.department_label ILIKE $${valIdx})`);
      values.push(`%${search}%`);
      valIdx++;
    }

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const query = `
      SELECT d.* 
      FROM v_department d
      ${whereStr}
      ORDER BY ${orderBy}
    `;

    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET by id
router.get('/:id', async (req, res) => {
  const isSuperAdmin = req.user && req.user.role && req.user.role.toUpperCase() === 'SUPER ADMIN';
  try {
    let query = `
      SELECT d.* 
      FROM v_department d
      WHERE d.department_id = $1
    `;
    if (!isSuperAdmin) {
      query += ' AND d.deleted_at IS NULL';
    }
    const result = await pool.query(query, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const record = result.rows[0];
    try {
      record.log = await getRecordAuditLogs('department', record.department_id || req.params.id, record.log);
    } catch (e) {
      console.error('Error enriching department audit logs:', e.message);
    }
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create
router.post('/', async (req, res) => {
  const { department_name, manager_email, company_id, type } = req.body;
  const department_code = req.body.department_code || req.body.deparment_code || null;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const id = await generateSequentialId('department', client);
    await client.query(
      `INSERT INTO department (department_id, department_name, manager_email, company_id, department_code, type)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, department_name, manager_email, company_id, department_code, type || null]
    );
    const viewRes = await client.query('SELECT * FROM v_department WHERE department_id = $1', [id]);
    const finalRecord = viewRes.rows[0] || { department_id: id, department_name, manager_email, company_id, department_code, type };
    await client.query('COMMIT');
    broadcastSSE('db_change', { action: 'insert', table: 'department', record: finalRecord });
    res.status(201).json(finalRecord);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PUT update
router.put('/:id', async (req, res) => {
  const { department_name, manager_email, company_id, type } = req.body;
  const department_code = req.body.department_code || req.body.deparment_code || null;
  const isSuperAdmin = req.user && req.user.role && req.user.role.toUpperCase() === 'SUPER ADMIN';
  try {
    let query = `UPDATE department SET department_name=$1, manager_email=$2, company_id=$3, department_code=$4, type=$5
       WHERE department_id=$6`;
    if (!isSuperAdmin) {
      query += ' AND deleted_at IS NULL';
    }
    query += ' RETURNING *';
    const result = await pool.query(
      query,
      [department_name, manager_email, company_id, department_code, type || null, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const viewRes = await pool.query('SELECT * FROM v_department WHERE department_id = $1', [req.params.id]);
    const finalRecord = viewRes.rows[0] || result.rows[0];
    broadcastSSE('db_change', { action: 'update', table: 'department', record: finalRecord });
    res.json(finalRecord);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('UPDATE DEPARTMENT SET deleted_at = CURRENT_TIMESTAMP WHERE department_id = $1 AND deleted_at IS NULL RETURNING *', [req.params.id]);
    if (result.rows.length > 0) {
      broadcastSSE('db_change', { action: 'delete', table: 'department', id: req.params.id, record: result.rows[0] });
    }
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

