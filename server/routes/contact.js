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
    let whereClauses = isSuperAdmin ? [] : ['c.deleted_at IS NULL'];
    let values = [];
    let valIdx = 1;

    for (const [key, value] of Object.entries(filters)) {
      if (['page', 'limit', 'slice', 'summary'].includes(key)) continue;
      const dbKey = key === 'company_id' ? 'c.company_id' : `c.${key}`;
      whereClauses.push(`${dbKey} = $${valIdx}`);
      values.push(value);
      valIdx++;
    }

    let orderBy = 'c.name';
    if (sort_by) {
      const allowedCols = ['contact_id', 'name', 'email', 'phone', 'company_shortname'];
      if (allowedCols.includes(sort_by)) {
        const dir = (sort_dir && sort_dir.toUpperCase() === 'ASC') ? 'ASC' : 'DESC';
        if (sort_by === 'company_shortname') {
          orderBy = `co.company_shortname ${dir}`;
        } else {
          orderBy = `c."${sort_by}" ${dir}`;
        }
      }
    }

    if (search) {
      whereClauses.push(`"CONTACT"::text ILIKE $${valIdx}`);
      values.push(`%${search}%`);
      valIdx++;
    }

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const query = `
      SELECT c.*, co.company_shortname
      FROM CONTACT c
      LEFT JOIN COMPANY co ON c.company_id = co.company_id
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
      SELECT c.*, co.company_shortname
      FROM CONTACT c
      LEFT JOIN COMPANY co ON c.company_id = co.company_id
      WHERE c.contact_id = $1
    `;
    if (!isSuperAdmin) {
      query += ' AND c.deleted_at IS NULL';
    }
    const result = await pool.query(query, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const record = result.rows[0];
    try {
      record.log = await getRecordAuditLogs('contact', record.contact_id || req.params.id, record.log);
    } catch (e) {
      console.error('Error enriching contact audit logs:', e.message);
    }
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create
router.post('/', async (req, res) => {
  const { name, title, email, mobile_no, gen, birthday, company_id } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const id = await generateSequentialId('contact', client);
    const result = await client.query(
      `INSERT INTO CONTACT (contact_id, name, title, email, mobile_no, gen, birthday, company_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [id, name, title, email, mobile_no, gen, birthday, company_id]
    );
    await client.query('COMMIT');
    broadcastSSE('db_change', { action: 'insert', table: 'contact', record: result.rows[0] });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PUT update
router.put('/:id', async (req, res) => {
  const { name, title, email, mobile_no, gen, birthday, company_id } = req.body;
  const isSuperAdmin = req.user && req.user.role && req.user.role.toUpperCase() === 'SUPER ADMIN';
  try {
    let query = `UPDATE CONTACT SET name=$1, title=$2, email=$3, mobile_no=$4, gen=$5, birthday=$6, company_id=$7
       WHERE contact_id=$8`;
    if (!isSuperAdmin) {
      query += ' AND deleted_at IS NULL';
    }
    query += ' RETURNING *';
    const result = await pool.query(
      query,
      [name, title, email, mobile_no, gen, birthday, company_id, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    broadcastSSE('db_change', { action: 'update', table: 'contact', record: result.rows[0] });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('UPDATE CONTACT SET deleted_at = CURRENT_TIMESTAMP WHERE contact_id = $1 AND deleted_at IS NULL RETURNING *', [req.params.id]);
    if (result.rows.length > 0) {
      broadcastSSE('db_change', { action: 'delete', table: 'contact', id: req.params.id, record: result.rows[0] });
    }
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

