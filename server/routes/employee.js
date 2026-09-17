const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcryptjs');
const { validateTableData } = require('../helpers/validation');
const { broadcastSSE } = require('../helpers/sseHelper');
const { generateSequentialId } = require('../helpers/idGenerator');
const { pushAppAccessToCMS } = require('../helpers/cmsSeats');
const { getRecordAuditLogs } = require('../helpers/auditHelper');
const crypto = require('crypto');

const CMS_BASE_URL = process.env.CMS_BASE_URL || 'http://cms.terax.ai';
const HMAC_SECRET = process.env.CMS_HMAC_SECRET;
const TENANT_SUBDOMAIN = process.env.TENANT_SUBDOMAIN || process.env.SUBDOMAIN || '';

function buildSignedHeaders(body) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = HMAC_SECRET
    ? crypto.createHmac('sha256', HMAC_SECRET).update(JSON.stringify(body)).digest('hex')
    : 'no-secret';
  return {
    'Content-Type': 'application/json',
    'x-cms-signature': signature,
    'x-cms-timestamp': timestamp
  };
}

// GET tenant login user seats from CMS
router.get('/tenant-seats', async (req, res) => {
  if (!CMS_BASE_URL || !HMAC_SECRET || !TENANT_SUBDOMAIN) {
    return res.json({ data: [] });
  }

  const body = { subdomain: TENANT_SUBDOMAIN };
  try {
    const response = await fetch(`${CMS_BASE_URL}/api/user-seats/tenant/list`, {
      method: 'POST',
      headers: buildSignedHeaders(body),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: errText });
    }

    const data = await response.json();
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST release a tenant seat on CMS and update local employee app_user_enabled status
router.post('/tenant-seats/release', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'email is required' });
  }

  if (!CMS_BASE_URL || !HMAC_SECRET || !TENANT_SUBDOMAIN) {
    return res.status(400).json({ error: 'CMS sync is not configured' });
  }

  const body = { subdomain: TENANT_SUBDOMAIN, email };
  try {
    const response = await fetch(`${CMS_BASE_URL}/api/user-seats/tenant/release`, {
      method: 'POST',
      headers: buildSignedHeaders(body),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: errText });
    }

    // Toggle local status of this user to false (Disabled) since seat is released
    await pool.query(
      `UPDATE EMPLOYEE SET app_user_enabled = false, updated_date = NOW() WHERE email = $1 OR username = $1`,
      [email]
    );

    const data = await response.json();
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET all employees
router.get('/', async (req, res) => {
  let { page, limit, status, company_id, department_id, search, my_company, department_name, app_user_enabled, sort_by, sort_dir } = req.query;
  
  const isSuperAdmin = req.user && req.user.role && req.user.role.toUpperCase() === 'SUPER ADMIN';
  let whereClauses = isSuperAdmin ? [] : ['e.deleted_at IS NULL'];
  let values = [];
  let paramIndex = 1;

  let orderBy = 'e.full_name';
  if (sort_by) {
    const allowedCols = ['employee_id', 'full_name', 'email', 'username', 'status', 'company_shortname', 'department_name', 'app_user_enabled'];
    if (allowedCols.includes(sort_by)) {
      const dir = (sort_dir && sort_dir.toUpperCase() === 'ASC') ? 'ASC' : 'DESC';
      if (sort_by === 'company_shortname') {
        orderBy = `mc.company_shortname ${dir}`;
      } else if (sort_by === 'department_name') {
        orderBy = `d.department_name ${dir}`;
      } else {
        orderBy = `e."${sort_by}" ${dir}`;
      }
    }
  }

  if (status) { whereClauses.push(`e.status = $${paramIndex++}`); values.push(status); }
  if (company_id) { whereClauses.push(`e.company_id = $${paramIndex++}`); values.push(company_id); }
  if (department_id) { whereClauses.push(`e.department_id = $${paramIndex++}`); values.push(department_id); }
  if (search) { whereClauses.push(`(e.full_name ILIKE $${paramIndex} OR e.email ILIKE $${paramIndex} OR e.username ILIKE $${paramIndex} OR e.employee_id ILIKE $${paramIndex})`); values.push(`%${search}%`); paramIndex++; }

  if (my_company) {
    const companyNames = my_company.split(',');
    const inPlaceholders = companyNames.map((_, i) => `$${paramIndex + i}`).join(', ');
    whereClauses.push(`e.company_id IN (SELECT my_company_id FROM my_company WHERE company_shortname IN (${inPlaceholders}) OR company_fullname IN (${inPlaceholders}))`);
    values.push(...companyNames);
    paramIndex += companyNames.length;
  }
  if (department_name) {
    const deptNames = department_name.split(',');
    const inPlaceholders = deptNames.map((_, i) => `$${paramIndex + i}`).join(', ');
    whereClauses.push(`e.department_id IN (SELECT department_id FROM department WHERE department_name IN (${inPlaceholders}))`);
    values.push(...deptNames);
    paramIndex += deptNames.length;
  }

  if (app_user_enabled) {
    const valArr = app_user_enabled.split(',').map(v => v.trim().toLowerCase());
    let boolVals = [];
    if (valArr.includes('enabled') || valArr.includes('true')) boolVals.push(true);
    if (valArr.includes('disabled') || valArr.includes('false')) boolVals.push(false);
    
    if (boolVals.length > 0) {
      const placeholders = boolVals.map((_, i) => `$${paramIndex + i}`).join(', ');
      whereClauses.push(`e.app_user_enabled IN (${placeholders})`);
      values.push(...boolVals);
      paramIndex += boolVals.length;
    }
  }

  const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  try {
    if (page || limit) {
      page = parseInt(page) || 1;
      limit = parseInt(limit) || 50;
      const offset = (page - 1) * limit;

      const countResult = await pool.query(`SELECT COUNT(*) FROM EMPLOYEE e ${whereString}`, values);
      const totalCount = parseInt(countResult.rows[0].count);

      const queryStr = `
        SELECT e.employee_id, e.employee_code, e.username, e.full_name, e.nick_name, e.email, e.gen, e.phone, e.position, e.employee_level, e.role, e.status, e.location_base, e.direct_manager, e.head_manager, e.department_id, e.company_id, e.app_user_enabled, e.avatar, e.deleted_at, e.full_name || ' (' || e.username || ' - ' || e.email || ')' AS display_label, d.department_name, mc.company_shortname,
               (CASE WHEN m.status = 18 OR LOWER(CAST(m.status AS text)) = 'inactive' THEN COALESCE(m.email, m.username, m.full_name) ELSE CASE WHEN m.email IS NOT NULL AND m.email <> '' THEN m.full_name || ' (' || m.email || ')' ELSE m.full_name END END) AS manager_name
        FROM EMPLOYEE e
        LEFT JOIN DEPARTMENT d ON e.department_id = d.department_id
        LEFT JOIN MY_COMPANY mc ON e.company_id = mc.my_company_id
        LEFT JOIN EMPLOYEE m ON e.direct_manager = m.employee_id
        ${whereString}
        ORDER BY ${orderBy}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      const result = await pool.query(queryStr, [...values, limit, offset]);

      const statusRes = await pool.query(`
        SELECT COALESCE(status::text, 'Unknown') as name, COUNT(*)::int as count 
        FROM EMPLOYEE e 
        ${whereString} 
        GROUP BY status
      `, values);
      let statusSummary = {};
      statusRes.rows.forEach(r => { statusSummary[r.name] = r.count; });

      const companyRes = await pool.query(`
        SELECT COALESCE(mc.company_shortname, 'Unknown') as name, COUNT(e.*)::int as count
        FROM EMPLOYEE e
        LEFT JOIN MY_COMPANY mc ON e.company_id = mc.my_company_id
        ${whereString}
        GROUP BY mc.company_shortname
      `, values);
      let companySummary = {};
      companyRes.rows.forEach(r => { companySummary[r.name] = r.count; });

      const deptRes = await pool.query(`
        SELECT COALESCE(d.department_name, 'Unknown') as name, COUNT(e.*)::int as count
        FROM EMPLOYEE e
        LEFT JOIN DEPARTMENT d ON e.department_id = d.department_id
        ${whereString}
        GROUP BY d.department_name
      `, values);
      let deptSummary = {};
      deptRes.rows.forEach(r => { deptSummary[r.name] = r.count; });

      const seatRes = await pool.query(`
        SELECT COALESCE(app_user_enabled::text, 'false') as name, COUNT(*)::int as count
        FROM EMPLOYEE e
        ${whereString}
        GROUP BY app_user_enabled
      `, values);
      let seatSummary = {};
      seatRes.rows.forEach(r => { seatSummary[r.name] = r.count; });

      return res.json({
        data: result.rows,
        meta: {
          total: totalCount,
          page,
          limit,
          totalPages: Math.ceil(totalCount / limit),
          summary: statusSummary,
          faceted_summary: {
            status: statusSummary,
            company_shortname: companySummary,
            department_name: deptSummary,
            app_user_enabled: seatSummary
          }
        }
      });
    }

    const queryStr = `
      SELECT e.employee_id, e.employee_code, e.username, e.full_name, e.nick_name, e.email, e.gen, e.phone, e.position, e.employee_level, e.role, e.status, e.location_base, e.direct_manager, e.head_manager, e.department_id, e.company_id, e.app_user_enabled, e.avatar, e.deleted_at, e.full_name || ' (' || e.username || ' - ' || e.email || ')' AS display_label, d.department_name, mc.company_shortname,
             (CASE WHEN m.status = 18 OR LOWER(CAST(m.status AS text)) = 'inactive' THEN COALESCE(m.email, m.username, m.full_name) ELSE CASE WHEN m.email IS NOT NULL AND m.email <> '' THEN m.full_name || ' (' || m.email || ')' ELSE m.full_name END END) AS manager_name
      FROM EMPLOYEE e
      LEFT JOIN DEPARTMENT d ON e.department_id = d.department_id
      LEFT JOIN MY_COMPANY mc ON e.company_id = mc.my_company_id
      LEFT JOIN EMPLOYEE m ON (e.direct_manager = m.employee_id OR e.direct_manager = m.email)
      ${whereString}
      ORDER BY ${orderBy}
    `;
    const result = await pool.query(queryStr, values);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET seat summary (limits and active counts)
router.get('/seat-summary', async (req, res) => {
  try {
    const requestHost = (req.headers.host || '').split(':')[0].toLowerCase();
    const infoRes = await pool.query(
      `SELECT plan_name, user_limit FROM cms_tenant_info WHERE tenant_domain = $1 LIMIT 1`,
      [requestHost]
    );
    const tenantInfo = infoRes.rows[0] || { plan_name: 'Unknown', user_limit: -1 };
    const limit = tenantInfo.user_limit !== null && tenantInfo.user_limit !== undefined ? tenantInfo.user_limit : -1;

    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM employee WHERE app_user_enabled = true AND deleted_at IS NULL`
    );
    const enabledCount = countRes.rows[0].cnt;

    res.json({
      seat_count: enabledCount,
      seat_limit: limit,
      plan_name: tenantInfo.plan_name
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET by employee_id or email
router.get('/:id', async (req, res) => {
  const isSuperAdmin = req.user && req.user.role && req.user.role.toUpperCase() === 'SUPER ADMIN';
  try {
    let query = `
      SELECT e.*, e.full_name || ' (' || e.username || ' - ' || e.email || ')' AS display_label, d.department_name, mc.company_shortname,
             (CASE WHEN m.status = 18 OR LOWER(CAST(m.status AS text)) = 'inactive' THEN COALESCE(m.email, m.username, m.full_name) ELSE CASE WHEN m.email IS NOT NULL AND m.email <> '' THEN m.full_name || ' (' || m.email || ')' ELSE m.full_name END END) AS manager_name
      FROM EMPLOYEE e
      LEFT JOIN DEPARTMENT d ON e.department_id = d.department_id
      LEFT JOIN MY_COMPANY mc ON e.company_id = mc.my_company_id
      LEFT JOIN EMPLOYEE m ON (e.direct_manager = m.employee_id OR e.direct_manager = m.email)
      WHERE (e.employee_id = $1 OR e.email = $1 OR e.username = $1)
    `;
    if (!isSuperAdmin) {
      query += ' AND e.deleted_at IS NULL';
    }
    const result = await pool.query(query, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const record = result.rows[0];
    try {
      record.log = await getRecordAuditLogs('employee', record.employee_id || req.params.id, record.log);
    } catch (e) {
      console.error('Error enriching employee audit logs:', e.message);
    }
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create employee
router.post('/', async (req, res) => {
  const data = { ...req.body };
  const userEmail = req.user && req.user.employee_id ? req.user.employee_id : 'system';

  const validationErrors = validateTableData('employee', data, false);
  if (validationErrors) {
    const errorDetails = Object.entries(validationErrors).map(([k, v]) => `${k}: ${v}`).join(', ');
    return res.status(400).json({ error: `Dữ liệu không hợp lệ: ${errorDetails}`, details: validationErrors });
  }

  const { cleanEmptyStringsForTable, convertStatusFieldsToIds } = require('./dynamic_crud');
  await cleanEmptyStringsForTable('employee', data);
  convertStatusFieldsToIds('employee', data);

  let {
    employee_id, employee_code, username, password, full_name, nick_name, avatar, gen, position, employee_level, company_id, department_id,
    status, direct_manager, head_manager, role, location_base, email, phone, address,
    emergency_contact_name, emergency_contact_phone, social_insurance_code,
    pit_code, start_date, end_date, bank_account, bank_name, bank_city, bank_info, sow,
    app_user_enabled
  } = data;

  // Auto generate employee_id if missing
  if (!employee_id) {
    const client = await pool.connect();
    try {
      employee_id = await generateSequentialId('employee', client);
    } catch (err) {
      console.error('Error generating employee ID sequential prefix:', err);
      const countRes = await client.query("SELECT COUNT(*) FROM EMPLOYEE");
      const nextNum = parseInt(countRes.rows[0].count, 10) + 1;
      employee_id = `EMP-${String(nextNum).padStart(4, '0')}`;
    } finally {
      client.release();
    }
  }

  // Check duplicate employee_id before insert
  const dupCheck = await pool.query('SELECT 1 FROM employee WHERE LOWER(employee_id) = LOWER($1)', [employee_id]);
  if (dupCheck.rows.length > 0) {
    return res.status(400).json({ error: `Mã nhân viên "${employee_id}" đã tồn tại. Vui lòng nhập mã khác.` });
  }

  // Enforce employee_scale limit (total active employees)
  try {
    const scaleRes = await pool.query('SELECT features FROM cms_tenant_info LIMIT 1');
    if (scaleRes.rows.length && scaleRes.rows[0].features) {
      const features = typeof scaleRes.rows[0].features === 'string' ? JSON.parse(scaleRes.rows[0].features) : scaleRes.rows[0].features;
      let employeeScaleLimit = -1;
      if (features.employee_scale !== undefined && features.employee_scale !== null) {
        const scaleVal = features.employee_scale;
        if (typeof scaleVal === 'number') {
          employeeScaleLimit = scaleVal;
        } else {
          const parsedScale = parseInt(String(scaleVal).replace(/[^0-9]/g, ''), 10);
          employeeScaleLimit = isNaN(parsedScale) ? -1 : parsedScale;
        }
      }
      if (employeeScaleLimit > 0) {
        const totalEmpRes = await pool.query('SELECT COUNT(*)::int AS cnt FROM employee WHERE deleted_at IS NULL');
        if (totalEmpRes.rows[0].cnt >= employeeScaleLimit) {
          return res.status(400).json({
            error: `Vượt quá giới hạn quy mô nhân viên của gói dịch vụ (${totalEmpRes.rows[0].cnt}/${employeeScaleLimit} nhân viên). Vui lòng nâng cấp gói trên CMS.`,
            error_code: 'employee.error.scale_limit_exceeded'
          });
        }
      }
    }
  } catch (err) {
    console.error('Failed to enforce employee scale limit:', err.message);
  }

  const enabledVal = (app_user_enabled === undefined || app_user_enabled === null || app_user_enabled === '' || app_user_enabled === true || app_user_enabled === 'true');

  if (enabledVal) {
    const requestHost = (req.headers.host || '').split(':')[0].toLowerCase();
    const infoRes = await pool.query(
      `SELECT user_limit FROM cms_tenant_info WHERE tenant_domain = $1 LIMIT 1`,
      [requestHost]
    );
    const limit = infoRes.rows[0] ? (infoRes.rows[0].user_limit ?? -1) : -1;
    if (limit !== -1) {
      const countRes = await pool.query(`SELECT COUNT(*)::int AS cnt FROM employee WHERE app_user_enabled = true AND deleted_at IS NULL`);
      if (countRes.rows[0].cnt >= limit) {
        return res.status(400).json({
          error: `Vượt quá giới hạn số lượng tài khoản đăng nhập (${countRes.rows[0].cnt}/${limit}). Vui lòng nâng cấp gói dịch vụ trên CMS.`,
          error_code: 'employee.error.seat_limit_exceeded'
        });
      }
    }
  }

  // Auto generate username from email or full_name if missing
  if (!username) {
    if (email) {
      username = email.split('@')[0].toLowerCase();
    } else if (full_name) {
      username = full_name.toLowerCase().replace(/\s+/g, '.');
    } else {
      username = employee_id.toLowerCase();
    }
  }

  // Hash password if provided
  let passwordHash = password;
  if (password && !password.startsWith('$2a$') && !password.startsWith('$2b$')) {
    passwordHash = await bcrypt.hash(password, 10);
  }

  let resolvedRole = role || 'Staff';

  const tzTimeStr = new Date().toISOString();
  const logEntry = { timestamp: tzTimeStr, user: userEmail, action: 'created employee' };

  try {
    const insertQuery = `INSERT INTO EMPLOYEE (
        employee_id, employee_code, username, password, full_name, nick_name, avatar, gen, position, employee_level, company_id, department_id,
        status, direct_manager, head_manager, role, location_base, email, phone, address,
        emergency_contact_name, emergency_contact_phone, social_insurance_code,
        pit_code, start_date, end_date, bank_account, bank_name, bank_city, bank_info, sow,
        created_by, log, app_user_enabled
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33::jsonb,$34)
      RETURNING *`;
    const insertParams = [
      employee_id, employee_code, username, passwordHash, full_name, nick_name, avatar, gen, position, employee_level, company_id, department_id,
      status, direct_manager, head_manager, resolvedRole, location_base, email, phone, address,
      emergency_contact_name, emergency_contact_phone, social_insurance_code,
      pit_code, start_date, end_date, bank_account, bank_name, bank_city, bank_info, sow,
      userEmail, JSON.stringify([logEntry]), enabledVal
    ];

    let result;
    try {
      result = await pool.query(insertQuery, insertParams);
    } catch (dbErr) {
      if (dbErr.message && (dbErr.message.includes('employee_code') || dbErr.message.includes('bank_info'))) {
        await pool.query('ALTER TABLE "employee" ADD COLUMN IF NOT EXISTS "employee_code" VARCHAR(100)');
        await pool.query('ALTER TABLE "employee" ADD COLUMN IF NOT EXISTS "bank_info" TEXT');
        result = await pool.query(insertQuery, insertParams);
      } else {
        throw dbErr;
      }
    }

    const emp = result.rows[0];
    broadcastSSE('db_change', { action: 'insert', table: 'employee', record: emp });

    // Sync to CMS async
    if (enabledVal) {
      pushAppAccessToCMS({
        email:     emp.email,
        username:  emp.username,
        full_name: emp.full_name,
        action:    'activate'
      }).catch(err => console.warn('[AppAccess] CMS push failed:', err.message));
    }

    res.status(201).json(emp);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update employee
router.put('/:id', async (req, res) => {
  const data = { ...req.body };
  const userEmail = req.user && req.user.employee_id ? req.user.employee_id : 'system';

  const validationErrors = validateTableData('employee', data, true);
  if (validationErrors) {
    const errorDetails = Object.entries(validationErrors).map(([k, v]) => `${k}: ${v}`).join(', ');
    return res.status(400).json({ error: `Dữ liệu không hợp lệ: ${errorDetails}`, details: validationErrors });
  }

  const { cleanEmptyStringsForTable, convertStatusFieldsToIds } = require('./dynamic_crud');
  await cleanEmptyStringsForTable('employee', data);
  convertStatusFieldsToIds('employee', data);

  let {
    employee_id, employee_code, username, password, full_name, nick_name, avatar, gen, position, employee_level, company_id, department_id,
    status, direct_manager, head_manager, role, location_base, email, phone, address,
    emergency_contact_name, emergency_contact_phone, social_insurance_code,
    pit_code, start_date, end_date, bank_account, bank_name, bank_city, bank_info, sow,
    app_user_enabled
  } = data;

  // Hash password if updated and provided as plaintext
  let passwordHash = password;
  if (password && !password.startsWith('$2a$') && !password.startsWith('$2b$')) {
    passwordHash = await bcrypt.hash(password, 10);
  }

  let resolvedRole = role || 'Staff';
  
  const tzTimeStr = new Date().toISOString();
  const logEntry = { timestamp: tzTimeStr, user: userEmail, action: 'updated employee details' };

  const isSuperAdmin = req.user && req.user.role && req.user.role.toUpperCase() === 'SUPER ADMIN';
  
  let enabledVal = undefined;
  if (app_user_enabled !== undefined && app_user_enabled !== null && app_user_enabled !== '') {
    enabledVal = (app_user_enabled === true || app_user_enabled === 'true');
  }

  try {
    // Fetch old value first to verify if changed
    const currentRes = await pool.query(
      `SELECT app_user_enabled FROM EMPLOYEE WHERE (employee_id=$1 OR email=$1 OR username=$1) AND deleted_at IS NULL`,
      [req.params.id]
    );
    const oldEnabled = currentRes.rows[0] ? currentRes.rows[0].app_user_enabled : true;

    if (enabledVal === true && oldEnabled !== true) {
      const requestHost = (req.headers.host || '').split(':')[0].toLowerCase();
      const infoRes = await pool.query(
        `SELECT user_limit FROM cms_tenant_info WHERE tenant_domain = $1 LIMIT 1`,
        [requestHost]
      );
      const limit = infoRes.rows[0] ? (infoRes.rows[0].user_limit ?? -1) : -1;
      if (limit !== -1) {
        const countRes = await pool.query(`SELECT COUNT(*)::int AS cnt FROM employee WHERE app_user_enabled = true AND deleted_at IS NULL`);
        if (countRes.rows[0].cnt >= limit) {
          return res.status(400).json({
            error: `Vượt quá giới hạn số lượng tài khoản đăng nhập (${countRes.rows[0].cnt}/${limit}). Vui lòng nâng cấp gói dịch vụ trên CMS.`,
            error_code: 'employee.error.seat_limit_exceeded'
          });
        }
      }
    }

    let query = `UPDATE EMPLOYEE SET
        employee_id=COALESCE($1, employee_id),
        username=COALESCE($2, username),
        password=COALESCE($3, password),
        full_name=$4, nick_name=$5, avatar=$6, gen=$7, position=$8, employee_level=$9, company_id=$10, department_id=$11,
        status=$12, direct_manager=$13, head_manager=$33, role=$14, location_base=$15, email=$16, phone=$17, address=$18,
        emergency_contact_name=$19, emergency_contact_phone=$20, social_insurance_code=$21, pit_code=$22, start_date=$23, end_date=$24, bank_account=$25, bank_name=$26, bank_city=$27, sow=$28,
        log=COALESCE(log, '[]'::jsonb) || $29::jsonb,
        app_user_enabled=COALESCE($31, app_user_enabled),
        employee_code=$32,
        bank_info=$34
       WHERE (employee_id=$30 OR email=$30 OR username=$30)`;
    if (!isSuperAdmin) {
      query += ' AND deleted_at IS NULL';
    }
    query += ' RETURNING *';
    const updateParams = [
      employee_id, username, passwordHash, full_name, nick_name, avatar, gen, position, employee_level, company_id, department_id,
      status, direct_manager, resolvedRole, location_base, email, phone, address,
      emergency_contact_name, emergency_contact_phone, social_insurance_code,
      pit_code, start_date, end_date, bank_account, bank_name, bank_city, sow,
      JSON.stringify([logEntry]), req.params.id, enabledVal !== undefined ? enabledVal : null, employee_code,
      head_manager, bank_info !== undefined ? bank_info : null
    ];

    let result;
    try {
      result = await pool.query(query, updateParams);
    } catch (dbErr) {
      if (dbErr.message && (dbErr.message.includes('employee_code') || dbErr.message.includes('bank_info'))) {
        await pool.query('ALTER TABLE "employee" ADD COLUMN IF NOT EXISTS "employee_code" VARCHAR(100)');
        await pool.query('ALTER TABLE "employee" ADD COLUMN IF NOT EXISTS "bank_info" TEXT');
        result = await pool.query(query, updateParams);
      } else {
        throw dbErr;
      }
    }

    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    
    const emp = result.rows[0];
    broadcastSSE('db_change', { action: 'update', table: 'employee', record: emp });

    // Push state update to CMS if it changed
    if (enabledVal !== undefined && enabledVal !== oldEnabled) {
      const action = enabledVal ? 'activate' : 'deactivate';
      pushAppAccessToCMS({
        email:     emp.email,
        username:  emp.username,
        full_name: emp.full_name,
        action
      }).catch(err => console.warn('[AppAccess] CMS push failed:', err.message));
    }

    res.json(emp);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /:id/app-access — Toggle app_user_enabled (Super Admin only)
router.patch('/:id/app-access', async (req, res) => {
  const isSuperAdmin = req.user && req.user.role && req.user.role.toUpperCase() === 'SUPER ADMIN';
  if (!isSuperAdmin) {
    return res.status(403).json({ error: 'Chỉ Super Admin mới có thể thay đổi quyền sử dụng app.' });
  }

  const { app_user_enabled } = req.body;
  if (typeof app_user_enabled !== 'boolean') {
    return res.status(400).json({ error: 'app_user_enabled phải là boolean (true/false)' });
  }

  if (app_user_enabled === true) {
    try {
      const currentRes = await pool.query(
        `SELECT app_user_enabled FROM EMPLOYEE WHERE (employee_id=$1 OR email=$1 OR username=$1) AND deleted_at IS NULL`,
        [req.params.id]
      );
      const oldEnabled = currentRes.rows[0] ? currentRes.rows[0].app_user_enabled : false;
      if (!oldEnabled) {
        const requestHost = (req.headers.host || '').split(':')[0].toLowerCase();
        const infoRes = await pool.query(
          `SELECT user_limit FROM cms_tenant_info WHERE tenant_domain = $1 LIMIT 1`,
          [requestHost]
        );
        const limit = infoRes.rows[0] ? (infoRes.rows[0].user_limit ?? -1) : -1;
        if (limit !== -1) {
          const countRes = await pool.query(`SELECT COUNT(*)::int AS cnt FROM employee WHERE app_user_enabled = true AND deleted_at IS NULL`);
          if (countRes.rows[0].cnt >= limit) {
            return res.status(400).json({
              error: `Vượt quá giới hạn số lượng tài khoản đăng nhập (${countRes.rows[0].cnt}/${limit}). Vui lòng nâng cấp gói dịch vụ trên CMS.`,
              error_code: 'employee.error.seat_limit_exceeded'
            });
          }
        }
      }
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  try {
    const result = await pool.query(
      `UPDATE EMPLOYEE
       SET app_user_enabled = $1,
           log = COALESCE(log, '[]'::jsonb) || $2::jsonb
       WHERE (employee_id = $3 OR email = $3 OR username = $3)
         AND deleted_at IS NULL
       RETURNING employee_id, username, full_name, email, role, app_user_enabled`,
      [
        app_user_enabled,
        JSON.stringify([{
          timestamp: new Date().toISOString(),
          user: req.user.employee_id,
          action: `app_user_enabled set to ${app_user_enabled}`
        }]),
        req.params.id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy nhân viên.' });
    }

    const emp = result.rows[0];
    broadcastSSE('db_change', { action: 'update', table: 'employee', record: emp });

    // Push to CMS async — update user_active.is_active
    const action = app_user_enabled ? 'activate' : 'deactivate';
    pushAppAccessToCMS({
      email:     emp.email,
      username:  emp.username,
      full_name: emp.full_name,
      action
    }).then(cmsResult => {
      if (cmsResult) {
        console.log(`[AppAccess] CMS sync: ${action} for ${emp.email || emp.username}. Active seats: ${cmsResult.seat_count}`);
      }
    }).catch(err => {
      console.warn('[AppAccess] CMS push failed (non-critical):', err.message);
    });

    return res.json({
      success: true,
      employee: emp,
      message: `Quyền sử dụng app đã được ${app_user_enabled ? 'bật' : 'tắt'} cho ${emp.full_name}`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST deactivate quick action
router.post('/:id/deactivate', async (req, res) => {
  const userEmail = req.user && req.user.employee_id ? req.user.employee_id : 'system';
  try {
    const checkRes = await pool.query(
      `SELECT employee_id FROM EMPLOYEE WHERE (employee_id=$1 OR email=$1 OR username=$1) AND deleted_at IS NULL`,
      [req.params.id]
    );
    if (checkRes.rows.length === 0) return res.status(404).json({ error: 'Employee not found' });
    const empId = checkRes.rows[0].employee_id;

    const tzTimeStr = new Date().toISOString();
    const logEntry = { timestamp: tzTimeStr, user: userEmail, action: 'deactivated app user via quick action' };

    const updateRes = await pool.query(
      `UPDATE EMPLOYEE SET app_user_enabled = false, log = log::jsonb || $2::jsonb, updated_at = CURRENT_TIMESTAMP WHERE employee_id = $1 RETURNING *`,
      [empId, JSON.stringify(logEntry)]
    );

    broadcastSSE('db_change', { action: 'update', table: 'employee', record: updateRes.rows[0] });
    res.json({ success: true, message: 'Đã hủy kích hoạt đăng nhập cho nhân viên.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('UPDATE EMPLOYEE SET deleted_at = CURRENT_TIMESTAMP WHERE (employee_id = $1 OR email = $1 OR username = $1) AND deleted_at IS NULL RETURNING *', [req.params.id]);
    if (result.rows.length > 0) {
      broadcastSSE('db_change', { action: 'delete', table: 'employee', id: req.params.id, record: result.rows[0] });
    }
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
