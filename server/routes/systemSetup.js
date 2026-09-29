const express = require('express');
const router = express.Router();
const pool = require('../db');
const https = require('https');
const http = require('http');

const CMS_BASE_URL = process.env.CMS_BASE_URL || 'http://cms.terax.ai';

// Helper: fetch from CMS with timeout
function cmsGet(path) {
  return new Promise((resolve, reject) => {
    const url = CMS_BASE_URL + path;
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { timeout: 5000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error('Invalid JSON from CMS')); }
      });
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('CMS timeout')); });
    req.on('error', reject);
  });
}

const cmsLookups = require('./cmsLookups');

const POPULAR_5_COUNTRIES = ['VN', 'US', 'SG', 'JP', 'KR'];
const POPULAR_5_CURRENCIES = ['VND', 'USD', 'EUR', 'SGD', 'JPY'];

// GET /api/system-setup/lookups/countries  → proxy CMS DB
router.get('/lookups/countries', async (req, res) => {
  try {
    let list = [];
    if (typeof cmsLookups.getCachedCountries === 'function') {
      list = await cmsLookups.getCachedCountries();
    }
    if (!list || !list.length) {
      const result = await cmsGet('/api/public/countries?popular=true').catch(() => null);
      list = (result && result.data) ? result.data : [];
    }
    if (list && list.length) {
      const pMap = new Map(POPULAR_5_COUNTRIES.map((c, i) => [c.toUpperCase(), i]));
      list = [...list].sort((a, b) => {
        const aCode = String(a.code || '').toUpperCase().trim();
        const bCode = String(b.code || '').toUpperCase().trim();
        const aHas = pMap.has(aCode);
        const bHas = pMap.has(bCode);
        if (aHas && bHas) return pMap.get(aCode) - pMap.get(bCode);
        if (aHas && !bHas) return -1;
        if (!aHas && bHas) return 1;
        return (a.name || '').localeCompare(b.name || '');
      });
      return res.json({ data: list });
    }
    // Fallback hardcoded popular
    return res.json({ data: [
      {code:'VN', name:'Việt Nam', display_name:'VN - Việt Nam', popular:true},
      {code:'US', name:'United States', display_name:'US - United States', popular:true},
      {code:'SG', name:'Singapore', display_name:'SG - Singapore', popular:true},
      {code:'JP', name:'Japan', display_name:'JP - Japan', popular:true},
      {code:'KR', name:'South Korea', display_name:'KR - South Korea', popular:true},
    ]});
  } catch (err) {
    console.warn('[Setup] CMS countries error:', err.message);
    return res.json({ data: [] });
  }
});

// GET /api/system-setup/lookups/currencies → proxy CMS DB
router.get('/lookups/currencies', async (req, res) => {
  try {
    let list = [];
    if (typeof cmsLookups.getCachedCurrencies === 'function') {
      list = await cmsLookups.getCachedCurrencies();
    }
    if (!list || !list.length) {
      const result = await cmsGet('/api/public/currencies?popular=true').catch(() => null);
      list = (result && result.data) ? result.data : [];
    }
    if (list && list.length) {
      const pMap = new Map(POPULAR_5_CURRENCIES.map((c, i) => [c.toUpperCase(), i]));
      list = [...list].sort((a, b) => {
        const aCode = String(a.code || '').toUpperCase().trim();
        const bCode = String(b.code || '').toUpperCase().trim();
        const aHas = pMap.has(aCode);
        const bHas = pMap.has(bCode);
        if (aHas && bHas) return pMap.get(aCode) - pMap.get(bCode);
        if (aHas && !bHas) return -1;
        if (!aHas && bHas) return 1;
        return (a.code || '').localeCompare(b.code || '');
      });
      return res.json({ data: list });
    }
    return res.json({ data: [
      {code:'VND', label:'VND', popular:true},
      {code:'USD', label:'USD', popular:true},
      {code:'EUR', label:'EUR', popular:true},
      {code:'SGD', label:'SGD', popular:true},
      {code:'JPY', label:'JPY', popular:true},
    ]});
  } catch (err) {
    console.warn('[Setup] CMS currencies error:', err.message);
    return res.json({ data: [] });
  }
});

// Helper to ensure setup table and default values exist
async function ensureSetupTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "system_setup" (
      "key" TEXT PRIMARY KEY,
      "value" TEXT,
      "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  await pool.query(`
    INSERT INTO "system_setup" ("key", "value")
    VALUES ('setup_completed', 'false')
    ON CONFLICT ("key") DO NOTHING;
  `);
}

const { generateSequentialId } = require('../helpers/idGenerator');
const { broadcastSSE } = require('../helpers/sseHelper');


// GET /api/system-setup/status
router.get('/status', async (req, res) => {
  try {
    await ensureSetupTable();
    
    // Get setup_completed state
    const setupRes = await pool.query(`SELECT "value" FROM "system_setup" WHERE "key" = 'setup_completed'`);
    const setupCompleted = setupRes.rows[0] ? setupRes.rows[0].value === 'true' : false;
    
    // Get row counts for setup tables
    const tables = [
      { key: 'my_company', query: 'SELECT COUNT(*)::int FROM "my_company"' },
      { key: 'my_location', query: 'SELECT COUNT(*)::int FROM "my_location"' },
      { key: 'department', query: 'SELECT COUNT(*)::int FROM "department"' },
      { key: 'employee', query: 'SELECT COUNT(*)::int FROM "employee"' },
      { key: 'policy_and_program', query: 'SELECT COUNT(*)::int FROM "policy_and_program"' },
      { key: 'account', query: 'SELECT COUNT(*)::int FROM "account"' },
      { key: 'company', query: 'SELECT COUNT(*)::int FROM "company"' },
      { key: 'contact', query: 'SELECT COUNT(*)::int FROM "contact"' },
      { key: 'service', query: 'SELECT COUNT(*)::int FROM "service"' },
      { key: 'asset', query: 'SELECT COUNT(*)::int FROM "asset"' }
    ];
    
    const tableCounts = {};
    for (const t of tables) {
      try {
        const countRes = await pool.query(t.query);
        tableCounts[t.key] = countRes.rows[0] ? countRes.rows[0].count : 0;
      } catch (err) {
        tableCounts[t.key] = 0;
      }
    }
    
    res.json({
      setupCompleted,
      tableCounts,
      isHelpdesk: process.env.IS_HELPDESK === 'true'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/system-setup/data (Prefill company & admin for Step 1)
router.get('/data', async (req, res) => {
  try {
    await ensureSetupTable();
    const setupRes = await pool.query(`SELECT "value" FROM "system_setup" WHERE "key" = 'setup_completed'`);
    const setupCompleted = setupRes.rows[0] ? setupRes.rows[0].value === 'true' : false;

    const compRes = await pool.query('SELECT * FROM my_company ORDER BY my_company_id ASC LIMIT 1');
    const adminRes = await pool.query(`
      SELECT employee_id, username, full_name, email, role, status 
      FROM employee 
      WHERE role = 'Super Admin' OR employee_id = 'EMP-001' 
      ORDER BY employee_id ASC LIMIT 1
    `);

    res.json({
      setupCompleted,
      company: compRes.rows[0] || null,
      admin: adminRes.rows[0] || null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/system-setup/company (Step 1 save)
router.post('/company', async (req, res) => {
  const {
    company_fullname,
    company_shortname,
    tax_code,
    country,
    address,
    website,
    base_currency,
    logo
  } = req.body;

  let logoParam = null;
  if (logo) {
    try {
      if (typeof logo === 'string' && logo.startsWith('data:')) {
        logoParam = Buffer.from(logo.split(',')[1], 'base64');
      } else {
        logoParam = logo;
      }
    } catch (e) {
      logoParam = logo;
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query('SELECT my_company_id FROM my_company ORDER BY my_company_id ASC LIMIT 1');
    let compId = '1';

    if (existing.rows.length > 0) {
      compId = existing.rows[0].my_company_id;
      await client.query(`
        UPDATE my_company
        SET company_fullname = COALESCE($1, company_fullname),
            company_shortname = COALESCE($2, company_shortname),
            tax_code = COALESCE($3, tax_code),
            country = COALESCE($4, country),
            address = COALESCE($5, address),
            website = COALESCE($6, website),
            base_currency = COALESCE($7, base_currency),
            logo = COALESCE($8, logo),
            status = COALESCE((SELECT id FROM status_catalog WHERE table_name='my_company' AND status_key='active' LIMIT 1), 67)
        WHERE my_company_id = $9
      `, [company_fullname, company_shortname, tax_code, country, address, website, base_currency, logoParam, compId]);
    } else {
      await client.query(`
        INSERT INTO my_company (my_company_id, company_fullname, company_shortname, tax_code, country, address, website, base_currency, logo, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE((SELECT id FROM status_catalog WHERE table_name='my_company' AND status_key='active' LIMIT 1), 67))
      `, [compId, company_fullname, company_shortname, tax_code, country, address, website, base_currency, logoParam]);
    }

    const saved = await client.query('SELECT * FROM my_company WHERE my_company_id = $1', [compId]);
    await client.query('COMMIT');
    broadcastSSE('db_change', { action: 'update', table: 'my_company', record: saved.rows[0] });
    res.json({ success: true, company: saved.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// POST /api/system-setup/presets/departments (Step 2 preset create)
router.post('/presets/departments', async (req, res) => {
  const departments = req.body.departments;
  if (!Array.isArray(departments) || departments.length === 0) {
    return res.status(400).json({ error: 'departments array is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const compRes = await client.query('SELECT my_company_id FROM my_company ORDER BY my_company_id ASC LIMIT 1');
    const companyId = compRes.rows[0] ? compRes.rows[0].my_company_id : '1';

    const created = [];
    for (const d of departments) {
      const code = (d.department_code || '').trim();
      const name = (d.department_name || '').trim();
      const type = (d.type || 'Operation').trim();
      const managerEmail = (d.manager_email || d.manager || '').trim() || null;

      // Check if code or name already exists for company
      const check = await client.query(
        'SELECT department_id FROM department WHERE company_id = $1 AND (LOWER(department_code) = LOWER($2) OR LOWER(department_name) = LOWER($3))',
        [companyId, code, name]
      );

      if (check.rows.length === 0) {
        const id = await generateSequentialId('department', client);
        await client.query(`
          INSERT INTO department (department_id, department_name, department_code, type, manager_email, company_id)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [id, name, code, type, managerEmail, companyId]);
        created.push({ department_id: id, department_name: name, department_code: code, type, manager_email: managerEmail });
      }
    }

    await client.query('COMMIT');
    broadcastSSE('db_change', { action: 'bulk_insert', table: 'department', count: created.length });
    res.json({ success: true, count: created.length, departments: created });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// POST /api/system-setup/presets/policies (Step 4 preset create with Tier 1 Direct Manager)
router.post('/presets/policies', async (req, res) => {
  const policies = req.body.policies;
  if (!Array.isArray(policies) || policies.length === 0) {
    return res.status(400).json({ error: 'policies array is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const compRes = await client.query('SELECT my_company_id FROM my_company ORDER BY my_company_id ASC LIMIT 1');
    const companyId = compRes.rows[0] ? compRes.rows[0].my_company_id : '1';

    const adminRes = await client.query(`
      SELECT employee_id FROM employee WHERE role = 'Super Admin' OR employee_id = 'EMP-001' ORDER BY employee_id ASC LIMIT 1
    `);
    const defaultLead = adminRes.rows[0] ? adminRes.rows[0].employee_id : 'EMP-001';

    const created = [];
    for (const p of policies) {
      const name = (p.policy_name || '').trim();
      const pType = (p.policy_type || 'Operation').trim();
      const desc = (p.description || name).trim();
      const elements = p.elements || 'ASSIGN_TASK';
      const tier1 = (p.tier1_approval || 'Direct Manager').trim();
      const tier2 = (p.tier2_approval || '').trim() || null;
      const tier3 = (p.tier3_approval || '').trim() || null;
      const approvalLevel = (p.approval_level || (tier3 ? 'Tier 3' : tier2 ? 'Tier 2' : 'Tier 1')).trim();

      const check = await client.query(
        'SELECT policy_id FROM POLICY_AND_PROGRAM WHERE LOWER(policy_name) = LOWER($1)',
        [name]
      );

      if (check.rows.length === 0) {
        const id = await generateSequentialId('policy_and_program', client);
        await client.query(`
          INSERT INTO POLICY_AND_PROGRAM (
            policy_id, policy_name, policy_type, description,
            tier1_approval, tier2_approval, tier3_approval, approval_level,
            policy_lead, sr_owner, elements, company_id, sla
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `, [
          id,
          name,
          pType,
          desc,
          tier1,
          tier2,
          tier3,
          approvalLevel,
          defaultLead,
          defaultLead,
          elements,
          companyId,
          p.sla || 3
        ]);
        created.push({ policy_id: id, policy_name: name, approval_level: approvalLevel });
      }
    }

    await client.query('COMMIT');
    broadcastSSE('db_change', { action: 'bulk_insert', table: 'policy_and_program', count: created.length });
    res.json({ success: true, count: created.length, policies: created });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// POST /api/system-setup/quick-account (Step 5 bank and petty cash creation)
router.post('/quick-account', async (req, res) => {
  const {
    account_name,
    bank_name,
    account_number,
    currency,
    create_cash
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const compRes = await client.query('SELECT my_company_id, base_currency FROM my_company ORDER BY my_company_id ASC LIMIT 1');
    const companyId = compRes.rows[0] ? compRes.rows[0].my_company_id : '1';
    const baseCur = currency || (compRes.rows[0] ? compRes.rows[0].base_currency : 'VND') || 'VND';

    const created = [];

    // 1. Bank Account
    if (account_name || bank_name) {
      const bId = await generateSequentialId('account', client);
      const accName = account_name || `${bank_name || 'Ngân hàng'} (${baseCur})`;
      await client.query(`
        INSERT INTO account (
          account_id, account_name, type, currency, exchange_rate,
          account_number, bank_name, account_status, company_entity
        ) VALUES ($1, $2, 'Bank', $3, 1, $4, $5, 19, $6)
      `, [bId, accName, baseCur, account_number || null, bank_name || null, companyId]);
      created.push({ account_id: bId, account_name: accName, type: 'Bank' });
    }

    // 2. Petty cash account if requested
    if (create_cash !== false) {
      const cId = await generateSequentialId('account', client);
      const cashName = `Quỹ tiền mặt (${baseCur})`;
      await client.query(`
        INSERT INTO account (
          account_id, account_name, type, currency, exchange_rate,
          account_status, company_entity
        ) VALUES ($1, $2, 'Cash', $3, 1, 19, $4)
      `, [cId, cashName, baseCur, companyId]);
      created.push({ account_id: cId, account_name: cashName, type: 'Cash' });
    }

    await client.query('COMMIT');
    broadcastSSE('db_change', { action: 'bulk_insert', table: 'account', count: created.length });
    res.json({ success: true, count: created.length, accounts: created });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// POST /api/system-setup/import-employees (Step 3 employee import from 5 core columns)
router.post('/import-employees', async (req, res) => {
  const employees = req.body.employees;
  if (!Array.isArray(employees) || employees.length === 0) {
    return res.status(400).json({ error: 'employees array is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const compRes = await client.query('SELECT my_company_id FROM my_company ORDER BY my_company_id ASC LIMIT 1');
    const companyId = compRes.rows[0] ? compRes.rows[0].my_company_id : '1';

    // Fetch existing departments to map
    const deptRows = await client.query('SELECT department_id, department_code, department_name FROM department WHERE company_id = $1', [companyId]);
    const deptMap = new Map();
    for (const d of deptRows.rows) {
      if (d.department_code) deptMap.set(d.department_code.trim().toLowerCase(), d.department_id);
      if (d.department_name) deptMap.set(d.department_name.trim().toLowerCase(), d.department_id);
    }

    const created = [];
    for (const emp of employees) {
      const fullName = (emp.full_name || '').trim();
      const email = (emp.email || '').trim().toLowerCase();
      if (!fullName || !email) continue;

      // Check if employee already exists by email
      const check = await client.query('SELECT employee_id FROM employee WHERE LOWER(email) = LOWER($1)', [email]);
      if (check.rows.length > 0) continue;

      const empId = await generateSequentialId('employee', client);
      const username = (emp.username || '').trim() || email.split('@')[0];
      const position = (emp.position || '').trim() || 'Nhân viên';
      const startDate = (emp.start_date || '').trim() || new Date().toISOString().split('T')[0];
      const emgName = (emp.emergency_contact_name || '').trim() || null;
      const emgPhone = (emp.emergency_contact_phone || '').trim() || null;
      const directMgr = (emp.direct_manager || '').trim() || null;
      const headMgr = (emp.head_manager || '').trim() || null;

      // Map department
      let deptId = null;
      if (emp.department_code && deptMap.has(emp.department_code.trim().toLowerCase())) {
        deptId = deptMap.get(emp.department_code.trim().toLowerCase());
      } else if (emp.department_name && deptMap.has(emp.department_name.trim().toLowerCase())) {
        deptId = deptMap.get(emp.department_name.trim().toLowerCase());
      } else if (emp.department_id) {
        deptId = emp.department_id;
      }

      await client.query(`
        INSERT INTO employee (
          employee_id, username, full_name, email, position,
          department_id, company_id, role, status, start_date,
          emergency_contact_name, emergency_contact_phone
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'Staff', 17, $8, $9, $10)
      `, [empId, username, fullName, email, position, deptId, companyId, startDate, emgName, emgPhone]);

      created.push({
        employee_id: empId,
        full_name: fullName,
        email,
        direct_manager_raw: directMgr,
        head_manager_raw: headMgr
      });
    }

    // Second pass: Link direct managers and head managers by email or full name if provided
    for (const c of created) {
      if (c.direct_manager_raw) {
        const mgrKey = String(c.direct_manager_raw).trim().toLowerCase();
        const mgrRes = await client.query(
          'SELECT employee_id FROM employee WHERE LOWER(email) = $1 OR LOWER(full_name) = $1 OR LOWER(employee_id) = $1 LIMIT 1',
          [mgrKey]
        );
        if (mgrRes.rows.length > 0) {
          await client.query('UPDATE employee SET direct_manager = $1 WHERE employee_id = $2', [mgrRes.rows[0].employee_id, c.employee_id]);
        }
      }
      if (c.head_manager_raw) {
        const hrKey = String(c.head_manager_raw).trim().toLowerCase();
        const hrRes = await client.query(
          'SELECT employee_id FROM employee WHERE LOWER(email) = $1 OR LOWER(full_name) = $1 OR LOWER(employee_id) = $1 LIMIT 1',
          [hrKey]
        );
        if (hrRes.rows.length > 0) {
          await client.query('UPDATE employee SET head_manager = $1 WHERE employee_id = $2', [hrRes.rows[0].employee_id, c.employee_id]);
        }
      }
    }

    await client.query('COMMIT');
    broadcastSSE('db_change', { action: 'bulk_insert', table: 'employee', count: created.length });
    res.json({ success: true, count: created.length, employees: created });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// POST /api/system-setup/complete
router.post('/complete', async (req, res) => {
  try {
    await ensureSetupTable();
    await pool.query(`
      UPDATE "system_setup"
      SET "value" = 'true', "updated_at" = CURRENT_TIMESTAMP
      WHERE "key" = 'setup_completed'
    `);
    res.json({ success: true, message: 'Setup completed successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/system-setup/reset (For developer/testing use)
router.post('/reset', async (req, res) => {
  try {
    await ensureSetupTable();
    await pool.query(`
      UPDATE "system_setup"
      SET "value" = 'false', "updated_at" = CURRENT_TIMESTAMP
      WHERE "key" = 'setup_completed'
    `);
    res.json({ success: true, message: 'Setup status reset to incomplete' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
