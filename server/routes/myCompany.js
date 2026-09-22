const express = require('express');
const router = express.Router();
const pool = require('../db');
const { generateSequentialId } = require('../helpers/idGenerator');
const { broadcastSSE } = require('../helpers/sseHelper');
const { validateTableData } = require('../helpers/validation');
const { checkPermission } = require('../helpers/permissionHelper');
const { getRecordAuditLogs } = require('../helpers/auditHelper');

// GET all
router.get('/', async (req, res) => {
  const { page, limit, search, sort_by, sort_dir, summary, ...filters } = req.query;
  const isSuperAdmin = req.user && req.user.role && req.user.role.toUpperCase() === 'SUPER ADMIN';
  try {
    let whereClauses = isSuperAdmin ? [] : ['mc.deleted_at IS NULL'];
    let values = [];
    let valIdx = 1;

    for (const [key, value] of Object.entries(filters)) {
      if (['slice'].includes(key)) continue;
      whereClauses.push(`mc.${key} = $${valIdx}`);
      values.push(value);
      valIdx++;
    }

    let orderBy = 'mc.company_shortname';
    if (sort_by) {
      const allowedCols = ['my_company_id', 'company_shortname', 'company_fullname', 'country', 'city', 'department', 'employee', 'account', 'policy', 'my_location'];
      if (allowedCols.includes(sort_by)) {
        const dir = (sort_dir && sort_dir.toUpperCase() === 'ASC') ? 'ASC' : 'DESC';
        if (['department', 'employee', 'account', 'policy', 'my_location'].includes(sort_by)) {
          orderBy = `"${sort_by}" ${dir}`;
        } else {
          orderBy = `mc."${sort_by}" ${dir}`;
        }
      }
    }

    if (search) {
      whereClauses.push(`(mc.company_shortname ILIKE $${valIdx} OR mc.company_fullname ILIKE $${valIdx} OR mc.tax_code ILIKE $${valIdx})`);
      values.push(`%${search}%`);
      valIdx++;
    }

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const isLite = req.query.summary === 'false' || req.query.lite === 'true';
    const baseQuery = isLite ? `
      SELECT mc.my_company_id, mc.company_shortname, mc.company_fullname, mc.logo, mc.status, mc.country, mc.province, mc.city, mc.base_currency, mc.currency_list
      FROM MY_COMPANY mc
    ` : `
      SELECT mc.*,
        (SELECT COUNT(*)::int FROM "department" d WHERE (d."company_id" = mc."my_company_id" OR d."company_id" = mc."company_shortname")) as "department",
        (SELECT COUNT(*)::int FROM "employee" e WHERE (e."company_id" = mc."my_company_id" OR e."company_id" = mc."company_shortname")) as "employee",
        (SELECT COUNT(*)::int FROM "account" a WHERE (a."company_entity" = mc."my_company_id" OR a."company_entity" = mc."company_shortname")) as "account",
        (SELECT COUNT(*)::int FROM "policy_and_program" p WHERE (p."company_id" = mc."my_company_id" OR p."company_id" = mc."company_shortname" OR (p."company_id" IS NULL AND mc."my_company_id" = '1'))) as "policy",
        (SELECT COUNT(*)::int FROM "my_location" l WHERE (l."my_company" = mc."company_shortname" OR l."my_company" = mc."my_company_id")) as "my_location",
        (SELECT COUNT(*)::int FROM "operation_program" op WHERE (op."company_id" = mc."my_company_id" OR op."company_id" = mc."company_shortname")) as "operation_program"
      FROM MY_COMPANY mc
    `;

    if (page || limit) {
      const p = parseInt(page) || 1;
      const l = parseInt(limit) || 50;
      const offset = (p - 1) * l;

      const countResult = await pool.query(`SELECT COUNT(*) FROM MY_COMPANY mc ${whereStr}`, values);
      const totalCount = parseInt(countResult.rows[0].count);

      const queryParams = [...values, l, offset];
      const result = await pool.query(`${baseQuery} ${whereStr} ORDER BY ${orderBy} LIMIT $${valIdx} OFFSET $${valIdx + 1}`, queryParams);

      return res.json({
        data: result.rows,
        meta: {
          total: totalCount,
          page: p,
          limit: l,
          totalPages: Math.ceil(totalCount / l)
        }
      });
    }

    const result = await pool.query(`${baseQuery} ${whereStr} ORDER BY ${orderBy}`, values);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET by id
router.get('/:id', async (req, res) => {
  const isSuperAdmin = req.user && req.user.role && req.user.role.toUpperCase() === 'SUPER ADMIN';
  try {
    let query = 'SELECT * FROM MY_COMPANY WHERE my_company_id = $1';
    if (!isSuperAdmin) {
      query += ' AND deleted_at IS NULL';
    }
    const result = await pool.query(query, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const record = result.rows[0];
    try {
      record.log = await getRecordAuditLogs('my_company', record.my_company_id || req.params.id, record.log);
    } catch (e) {
      console.error('Error enriching my_company audit logs:', e.message);
    }
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create
router.post('/', async (req, res) => {
  const viewName = req.query.viewName || req.body.viewName || 'my_company';
  const isAllowed = await checkPermission('action_rules', 'add_my_company', req.user, viewName);
  if (!isAllowed) {
    return res.status(403).json({ error: 'Permission denied' });
  }

  const validationErrors = validateTableData('my_company', req.body, false);
  if (validationErrors) {
    return res.status(400).json({ error: 'Validation failed', details: validationErrors });
  }

  const { company_shortname, company_fullname, logo, tax_code, website, address, country, city, state, province, currency_list, status } = req.body;
  
  // Verify custom branding support
  try {
    const scaleRes = await pool.query('SELECT features FROM cms_tenant_info LIMIT 1');
    if (scaleRes.rows.length && scaleRes.rows[0].features) {
      const features = typeof scaleRes.rows[0].features === 'string' ? JSON.parse(scaleRes.rows[0].features) : scaleRes.rows[0].features;
      const branding = features.custom_branding || '❌';
      const isBrandingAllowed = branding !== '❌' && branding !== 'none' && branding !== 'Không';
      if (!isBrandingAllowed && logo) {
        return res.status(403).json({
          error: 'Gói dịch vụ hiện tại không hỗ trợ tải lên logo riêng. Vui lòng nâng cấp gói trên CMS.',
          error_code: 'my_company.error.branding_not_supported'
        });
      }
    }
  } catch (err) {
    console.error('Failed to verify custom branding support:', err.message);
  }

  // Get tenant system base currency from cms_tenant_info or existing company
  let systemBaseCurrency = req.body.base_currency;
  try {
    const tenantRes = await pool.query('SELECT base_currency FROM cms_tenant_info LIMIT 1');
    if (tenantRes.rows.length && tenantRes.rows[0].base_currency) {
      systemBaseCurrency = tenantRes.rows[0].base_currency;
    } else {
      const compRes = await pool.query('SELECT base_currency FROM my_company WHERE base_currency IS NOT NULL LIMIT 1');
      if (compRes.rows.length && compRes.rows[0].base_currency) {
        systemBaseCurrency = compRes.rows[0].base_currency;
      }
    }
  } catch (e) {}
  if (!systemBaseCurrency) systemBaseCurrency = 'VND';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const id = await generateSequentialId('my_company', client);
    const result = await client.query(
      `INSERT INTO MY_COMPANY (my_company_id, company_shortname, company_fullname, logo, tax_code, website, address, country, city, state, province, base_currency, currency_list, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [id, company_shortname, company_fullname, logo, tax_code, website, address, country, city, state, province, systemBaseCurrency, currency_list, status || 'Active']
    );
    await client.query('COMMIT');
    broadcastSSE('db_change', { action: 'insert', table: 'my_company', record: result.rows[0] });
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
  const viewName = req.query.viewName || req.body.viewName || 'my_company';
  const isAllowed = await checkPermission('action_rules', 'edit_my_company', req.user, viewName);
  if (!isAllowed) {
    return res.status(403).json({ error: 'Permission denied' });
  }

  const validationErrors = validateTableData('my_company', req.body, true);
  if (validationErrors) {
    return res.status(400).json({ error: 'Validation failed', details: validationErrors });
  }

  const { company_shortname, company_fullname, logo, tax_code, website, address, country, city, state, province, currency_list, status } = req.body;
  const isSuperAdmin = req.user && req.user.role && req.user.role.toUpperCase() === 'SUPER ADMIN';

  // Verify custom branding support
  try {
    const scaleRes = await pool.query('SELECT features FROM cms_tenant_info LIMIT 1');
    if (scaleRes.rows.length && scaleRes.rows[0].features) {
      const features = typeof scaleRes.rows[0].features === 'string' ? JSON.parse(scaleRes.rows[0].features) : scaleRes.rows[0].features;
      const branding = features.custom_branding || '❌';
      const isBrandingAllowed = branding !== '❌' && branding !== 'none' && branding !== 'Không';
      if (!isBrandingAllowed && logo) {
        return res.status(403).json({
          error: 'Gói dịch vụ hiện tại không hỗ trợ tải lên logo riêng. Vui lòng nâng cấp gói trên CMS.',
          error_code: 'my_company.error.branding_not_supported'
        });
      }
    }
  } catch (err) {
    console.error('Failed to verify custom branding support:', err.message);
  }
  try {
    // Preserve original base_currency from being modified by clients
    let query = `UPDATE MY_COMPANY SET company_shortname=$1, company_fullname=$2, logo=$3, tax_code=$4, website=$5, address=$6, country=$7, city=$8, state=$9, province=$10, currency_list=$11, status=$12
       WHERE my_company_id=$13`;
    if (!isSuperAdmin) {
      query += ' AND deleted_at IS NULL';
    }
    query += ' RETURNING *';
    const result = await pool.query(
      query,
      [company_shortname, company_fullname, logo, tax_code, website, address, country, city, state, province, currency_list, status || 'Active', req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    broadcastSSE('db_change', { action: 'update', table: 'my_company', record: result.rows[0] });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE
router.delete('/:id', async (req, res) => {
  const viewName = req.query.viewName || 'my_company';
  const isAllowed = await checkPermission('action_rules', 'delete_my_company', req.user, viewName);
  if (!isAllowed) {
    return res.status(403).json({ error: 'Permission denied' });
  }

  try {
    const result = await pool.query('UPDATE MY_COMPANY SET deleted_at = CURRENT_TIMESTAMP WHERE my_company_id = $1 AND deleted_at IS NULL RETURNING *', [req.params.id]);
    if (result.rows.length > 0) {
      broadcastSSE('db_change', { action: 'delete', table: 'my_company', id: req.params.id, record: result.rows[0] });
    }
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

