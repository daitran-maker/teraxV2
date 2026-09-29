const express = require('express');
const router = express.Router();
const pool = require('../db');
const { generateSequentialId } = require('../helpers/idGenerator');
const { broadcastSSE } = require('../helpers/sseHelper');
const { getRecordAuditLogs } = require('../helpers/auditHelper');

// GET all
router.get('/', async (req, res) => {
  const { page, limit, search, sort_by, sort_dir, ...filters } = req.query;
  const isSuperAdmin = req.user && req.user.role && req.user.role.toUpperCase() === 'SUPER ADMIN';
  try {
    let whereClauses = isSuperAdmin ? [] : ['deleted_at IS NULL'];
    let values = [];
    let valIdx = 1;

    // Build facet query filter structures
    const baseClauses = isSuperAdmin ? [] : ['deleted_at IS NULL'];
    const baseValues = [];
    let baseValIdx = 1;
    if (search) {
      baseClauses.push(`"COMPANY"::text ILIKE $${baseValIdx}`);
      baseValues.push(`%${search}%`);
      baseValIdx++;
    }

    const typeWhereClauses = [];
    const typeValues = [];
    const countryWhereClauses = [];
    const countryValues = [];
    const provinceWhereClauses = [];
    const provinceValues = [];
    const cityWhereClauses = [];
    const cityValues = [];

    for (const [key, value] of Object.entries(filters)) {
      if (['slice', 'summary'].includes(key)) continue;
      const isTypeFilter = key === 'type';
      const clause = isTypeFilter
        ? `COALESCE(NULLIF(TRIM("${key}"), ''), 'Unassigned') = ANY($VAL_PLACEHOLDER::text[])`
        : `"${key}" = $VAL_PLACEHOLDER`;

      if (key !== 'type') {
        typeWhereClauses.push(clause);
        typeValues.push(isTypeFilter ? String(value).split(',').filter(Boolean) : value);
      }
      if (key !== 'country') {
        countryWhereClauses.push(clause);
        countryValues.push(isTypeFilter ? String(value).split(',').filter(Boolean) : value);
      }
      if (key !== 'province') {
        provinceWhereClauses.push(clause);
        provinceValues.push(isTypeFilter ? String(value).split(',').filter(Boolean) : value);
      }
      if (key !== 'city') {
        cityWhereClauses.push(clause);
        cityValues.push(isTypeFilter ? String(value).split(',').filter(Boolean) : value);
      }

      // Add to main where clauses
      whereClauses.push(isTypeFilter
        ? `COALESCE(NULLIF(TRIM("${key}"), ''), 'Unassigned') = ANY($${valIdx}::text[])`
        : `"${key}" = $${valIdx}`);
      values.push(isTypeFilter ? String(value).split(',').filter(Boolean) : value);
      valIdx++;
    }

    let orderBy = 'company_id DESC';
    if (sort_by) {
      const allowedCols = ['company_id', 'company_shortname', 'company_fullname', 'country', 'city'];
      if (allowedCols.includes(sort_by)) {
        const dir = (sort_dir && sort_dir.toUpperCase() === 'ASC') ? 'ASC' : 'DESC';
        orderBy = `"${sort_by}" ${dir}`;
      }
    }

    if (search) {
      whereClauses.push(`"COMPANY"::text ILIKE $${valIdx}`);
      values.push(`%${search}%`);
      valIdx++;
    }

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    if (page || limit) {
      const p = parseInt(page) || 1;
      const l = parseInt(limit) || 50;
      const offset = (p - 1) * l;

      const buildFacetQuery = (groupKey, facetClauses, facetVals) => {
        const queryClauses = [...baseClauses];
        const queryVals = [...baseValues];
        let idx = queryVals.length + 1;
        
        facetClauses.forEach((c, i) => {
          queryClauses.push(c.replace(/\$VAL_PLACEHOLDER/g, `$${idx}`));
          queryVals.push(facetVals[i]);
          idx++;
        });

        const whereStr = queryClauses.length > 0 ? `WHERE ${queryClauses.join(' AND ')}` : '';
        return {
          sql: `SELECT COALESCE(NULLIF(TRIM("${groupKey}"), ''), 'Unassigned') AS key, COUNT(*)::int AS count
                FROM COMPANY ${whereStr}
                GROUP BY COALESCE(NULLIF(TRIM("${groupKey}"), ''), 'Unassigned')
                ORDER BY key`,
          values: queryVals
        };
      };

      const typeQuery = buildFacetQuery('type', typeWhereClauses, typeValues);
      const countryQuery = buildFacetQuery('country', countryWhereClauses, countryValues);
      const provinceQuery = buildFacetQuery('province', provinceWhereClauses, provinceValues);
      const cityQuery = buildFacetQuery('city', cityWhereClauses, cityValues);

      const [countResult, typeResult, countryResult, provinceResult, cityResult] = await Promise.all([
        pool.query(`SELECT COUNT(*) FROM COMPANY ${whereStr}`, values),
        pool.query(typeQuery.sql, typeQuery.values),
        pool.query(countryQuery.sql, countryQuery.values),
        pool.query(provinceQuery.sql, provinceQuery.values),
        pool.query(cityQuery.sql, cityQuery.values)
      ]);

      const totalCount = parseInt(countResult.rows[0].count);
      const type_counts = Object.fromEntries(typeResult.rows.map(row => [row.key, row.count]));
      const country_counts = Object.fromEntries(countryResult.rows.map(row => [row.key, row.count]));
      const province_counts = Object.fromEntries(provinceResult.rows.map(row => [row.key, row.count]));
      const city_counts = Object.fromEntries(cityResult.rows.map(row => [row.key, row.count]));

      const queryParams = [...values, l, offset];
      const result = await pool.query(`SELECT * FROM COMPANY ${whereStr} ORDER BY ${orderBy} LIMIT $${valIdx} OFFSET $${valIdx + 1}`, queryParams);

      return res.json({
        data: result.rows,
        meta: {
          total: totalCount,
          page: p,
          limit: l,
          totalPages: Math.ceil(totalCount / l),
          type_counts,
          faceted_summary: {
            type: type_counts,
            country: country_counts,
            province: province_counts,
            city: city_counts
          }
        }
      });
    }

    const result = await pool.query(`SELECT * FROM COMPANY ${whereStr} ORDER BY ${orderBy}`, values);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET by id
router.get('/:id', async (req, res) => {
  const isSuperAdmin = req.user && req.user.role && req.user.role.toUpperCase() === 'SUPER ADMIN';
  try {
    let query = 'SELECT * FROM COMPANY WHERE company_id = $1';
    if (!isSuperAdmin) {
      query += ' AND deleted_at IS NULL';
    }
    const result = await pool.query(query, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const record = result.rows[0];
    try {
      record.log = await getRecordAuditLogs('company', record.company_id || req.params.id, record.log);
    } catch (e) {
      console.error('Error enriching company audit logs:', e.message);
    }
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create
router.post('/', async (req, res) => {
  const { company_shortname, company_fullname, type, logo, website, address, country, city, tax_code, province } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const id = await generateSequentialId('company', client);
    const result = await client.query(
      `INSERT INTO COMPANY (company_id, company_shortname, company_fullname, type, logo, website, address, country, city, tax_code, province, state)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [id, company_shortname, company_fullname, type, logo, website, address, country, city, tax_code, province, province]
    );
    await client.query('COMMIT');
    broadcastSSE('db_change', { action: 'insert', table: 'company', record: result.rows[0] });
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
  const { company_shortname, company_fullname, type, logo, website, address, country, city, tax_code, province } = req.body;
  const isSuperAdmin = req.user && req.user.role && req.user.role.toUpperCase() === 'SUPER ADMIN';
  try {
    let query = `UPDATE COMPANY SET company_shortname=$1, company_fullname=$2, type=$3, logo=$4, website=$5, address=$6, country=$7, city=$8, tax_code=$9, province=$10, state=$11
       WHERE company_id=$12`;
    if (!isSuperAdmin) {
      query += ' AND deleted_at IS NULL';
    }
    query += ' RETURNING *';
    const result = await pool.query(
      query,
      [company_shortname, company_fullname, type, logo, website, address, country, city, tax_code, province, province, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    broadcastSSE('db_change', { action: 'update', table: 'company', record: result.rows[0] });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('UPDATE COMPANY SET deleted_at = CURRENT_TIMESTAMP WHERE company_id = $1 AND deleted_at IS NULL RETURNING *', [req.params.id]);
    if (result.rows.length > 0) {
      broadcastSSE('db_change', { action: 'delete', table: 'company', id: req.params.id, record: result.rows[0] });
    }
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
