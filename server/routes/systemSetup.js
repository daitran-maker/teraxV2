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
      const result = await cmsGet('/api/public/currencies').catch(() => null);
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
      return res.json({ data: list.map(c => ({ code: c.code, label: c.code })) });
    }
    return res.json({ data: POPULAR_5_CURRENCIES.map(code => ({ code, label: code })) });
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

// Helper: format logo buffer or string to safe data URL
function formatLogo(logo) {
  if (!logo) return null;
  if (Buffer.isBuffer(logo)) {
    const first4 = logo.slice(0, 4);
    if (first4[0] === 0x89 && first4[1] === 0x50 && first4[2] === 0x4e && first4[3] === 0x47) {
      return `data:image/png;base64,${logo.toString('base64')}`;
    }
    if (first4[0] === 0xff && first4[1] === 0xd8 && first4[2] === 0xff) {
      return `data:image/jpeg;base64,${logo.toString('base64')}`;
    }
    const str = logo.toString('utf8');
    if (str.startsWith('data:') || str.startsWith('http') || str.startsWith('/') || str.startsWith('[')) {
      return str;
    }
    return `data:image/png;base64,${logo.toString('base64')}`;
  }
  if (typeof logo === 'object' && Array.isArray(logo.data)) {
    return formatLogo(Buffer.from(logo.data));
  }
  if (typeof logo === 'string') {
    if (logo.startsWith('data:') || logo.startsWith('http') || logo.startsWith('/')) return logo;
    return `data:image/png;base64,${logo}`;
  }
  return null;
}

// GET /api/system-setup/data (Prefill company & admin for Step 1)
router.get('/data', async (req, res) => {
  try {
    await ensureSetupTable();
    const setupRes = await pool.query(`SELECT "value" FROM "system_setup" WHERE "key" = 'setup_completed'`);
    const setupCompleted = setupRes.rows[0] ? setupRes.rows[0].value === 'true' : false;

    const compRes = await pool.query('SELECT * FROM my_company ORDER BY my_company_id ASC LIMIT 1');
    const compRaw = compRes.rows[0] || null;
    const company = compRaw ? { ...compRaw, logo: formatLogo(compRaw.logo) } : null;

    const adminRes = await pool.query(`
      SELECT employee_id, username, full_name, email, role, status 
      FROM employee 
      WHERE role = 'Super Admin' OR employee_id = 'EMP-001' 
      ORDER BY employee_id ASC LIMIT 1
    `);

    res.json({
      setupCompleted,
      company,
      admin: adminRes.rows[0] || null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/system-setup/tax-payer/:taxCode → Lookup via VietQR Business API
router.get('/tax-payer/:taxCode', async (req, res) => {
  const { taxCode } = req.params;
  const cleanCode = String(taxCode || '').trim().replace(/[^a-zA-Z0-9-]/g, '');
  if (!cleanCode) {
    return res.status(400).json({ success: false, message: 'Mã số thuế không hợp lệ' });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(`https://api.vietqr.io/v2/business/${encodeURIComponent(cleanCode)}`, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });
    clearTimeout(timeoutId);

    const json = await response.json();
    if (!response.ok || json.code !== '00' || !json.data) {
      return res.status(404).json({ success: false, message: json.desc || 'Không tìm thấy thông tin cho mã số thuế này' });
    }

    const d = json.data;
    const fullName = d.name || '';
    let shortName = d.shortName || '';
    if (!shortName && fullName) {
      shortName = fullName
        .replace(/^(CÔNG TY CỔ PHẦN|CÔNG TY TNHH MTV|CÔNG TY TNHH|TẬP ĐOÀN|TỔNG CÔNG TY|DOANH NGHIỆP TƯ NHÂN|CHI NHÁNH|VĂN PHÒNG ĐẠI DIỆN)\s+/i, '')
        .trim();
    }

    res.json({
      success: true,
      data: {
        fullname: fullName,
        shortname: shortName || fullName,
        address: d.address || '',
        taxCode: d.id || cleanCode,
        status: d.status || ''
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi kết nối tra cứu thuế: ' + err.message });
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
    timezone,
    logo
  } = req.body;

  let logoParam = null;
  if (logo) {
    if (Buffer.isBuffer(logo)) {
      logoParam = formatLogo(logo);
    } else if (typeof logo === 'string') {
      logoParam = logo;
    } else if (typeof logo === 'object' && Array.isArray(logo.data)) {
      logoParam = formatLogo(Buffer.from(logo.data));
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("ALTER TABLE my_company ADD COLUMN IF NOT EXISTS timezone VARCHAR(100) DEFAULT 'Asia/Ho_Chi_Minh'");

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
            timezone = COALESCE($9, timezone),
            status = COALESCE((SELECT id FROM status_catalog WHERE table_name='my_company' AND status_key='active' LIMIT 1), 67)
        WHERE my_company_id = $10
      `, [company_fullname, company_shortname, tax_code, country, address, website, base_currency, logoParam, timezone || 'Asia/Ho_Chi_Minh', compId]);
    } else {
      await client.query(`
        INSERT INTO my_company (my_company_id, company_fullname, company_shortname, tax_code, country, address, website, base_currency, logo, timezone, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE((SELECT id FROM status_catalog WHERE table_name='my_company' AND status_key='active' LIMIT 1), 67))
      `, [compId, company_fullname, company_shortname, tax_code, country, address, website, base_currency, logoParam, timezone || 'Asia/Ho_Chi_Minh']);
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
      const code = String(d.department_code != null ? d.department_code : '').trim();
      const name = String(d.department_name != null ? d.department_name : '').trim();
      const type = String(d.type != null ? d.type : 'Operation').trim();
      const managerEmail = String(d.manager_email || d.manager || '').trim() || null;

      const targetCompanyId = String(d.company_id != null ? d.company_id : '').trim() || companyId;

      // Check if code or name already exists for company
      const check = await client.query(
        'SELECT department_id FROM department WHERE company_id = $1 AND (LOWER(department_code) = LOWER($2) OR LOWER(department_name) = LOWER($3))',
        [targetCompanyId, code, name]
      );

      if (check.rows.length === 0) {
        const id = await generateSequentialId('department', client);
        await client.query(`
          INSERT INTO department (department_id, department_name, department_code, type, manager_email, company_id)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [id, name, code, type, managerEmail, targetCompanyId]);
        created.push({ department_id: id, department_name: name, department_code: code, type, manager_email: managerEmail, company_id: targetCompanyId });
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

    // Fetch all employees to lookup email/username -> employee_id for approval tiers
    const empRes = await client.query('SELECT employee_id, email, username FROM employee');
    const emailToEmpId = new Map();
    empRes.rows.forEach(e => {
      if (e.employee_id) {
        const empId = e.employee_id.trim();
        emailToEmpId.set(empId.toLowerCase(), empId);
        if (e.email) {
          const cleanEmail = e.email.trim().toLowerCase();
          emailToEmpId.set(cleanEmail, empId);
          const prefix = cleanEmail.split('@')[0];
          if (prefix && !emailToEmpId.has(prefix)) {
            emailToEmpId.set(prefix, empId);
          }
        }
        if (e.username) {
          const cleanUser = e.username.trim().toLowerCase();
          if (!emailToEmpId.has(cleanUser)) {
            emailToEmpId.set(cleanUser, empId);
          }
        }
      }
    });

    // Fetch departments to resolve department_code/name -> department_id
    const deptRes = await client.query('SELECT department_id, department_code, department_name FROM department');
    const deptMap = new Map();
    deptRes.rows.forEach(d => {
      if (d.department_id) deptMap.set(String(d.department_id).trim().toLowerCase(), d.department_id);
      if (d.department_code) deptMap.set(String(d.department_code).trim().toLowerCase(), d.department_id);
      if (d.department_name) deptMap.set(String(d.department_name).trim().toLowerCase(), d.department_id);
    });

    const resolveEmployeeVal = (val, isTier1 = false) => {
      if (!val || typeof val !== 'string') return isTier1 ? 'Direct Manager' : null;
      const trimmed = val.trim();
      if (!trimmed) return isTier1 ? 'Direct Manager' : null;
      if (trimmed.toLowerCase() === 'direct manager' || trimmed.toLowerCase() === 'quản lý trực tiếp') {
        return 'Direct Manager';
      }
      if (trimmed.includes(',')) {
        return trimmed.split(',').map(item => resolveEmployeeVal(item, false)).filter(Boolean).join(',');
      }
      const lower = trimmed.toLowerCase();
      if (emailToEmpId.has(lower)) {
        return emailToEmpId.get(lower);
      }
      return trimmed;
    };

    const created = [];
    for (const p of policies) {
      const name = String(p.policy_name != null ? p.policy_name : '').trim();
      const pType = String(p.policy_type != null ? p.policy_type : 'Operation').trim();
      const desc = String(p.description != null ? p.description : name).trim();
      const elements = p.elements || 'ASSIGN_TASK';
      const tier1 = resolveEmployeeVal(p.tier1_approval, true);
      const tier2 = resolveEmployeeVal(p.tier2_approval, false);
      const tier3 = resolveEmployeeVal(p.tier3_approval, false);
      const approvalLevel = String(p.approval_level || (tier3 ? 'Tier 3' : tier2 ? 'Tier 2' : 'Tier 1')).trim();
      const lead = resolveEmployeeVal(p.policy_lead, false) || defaultLead;
      const owner = resolveEmployeeVal(p.sr_owner, false) || defaultLead;
      const rawDept = p.department_id || p.department || '';
      let deptId = null;
      if (rawDept) {
        const cleanDept = String(rawDept).trim().toLowerCase();
        deptId = deptMap.get(cleanDept) || String(rawDept).trim();
      }

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
            policy_lead, sr_owner, department_id, elements, company_id, sla
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        `, [
          id,
          name,
          pType,
          desc,
          tier1,
          tier2,
          tier3,
          approvalLevel,
          lead,
          owner,
          deptId,
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

// POST /api/system-setup/quick-account (Step 5 bank and petty cash creation - supports multiple accounts)
router.post('/quick-account', async (req, res) => {
  const {
    account_name,
    bank_name,
    account_number,
    currency,
    create_cash,
    accounts
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const compRes = await client.query('SELECT my_company_id, base_currency FROM my_company ORDER BY my_company_id ASC LIMIT 1');
    const companyId = compRes.rows[0] ? compRes.rows[0].my_company_id : '1';
    const defaultCur = (compRes.rows[0] ? compRes.rows[0].base_currency : 'VND') || 'VND';

    const created = [];

    // Support multiple accounts array if passed
    if (Array.isArray(accounts) && accounts.length > 0) {
      for (const acc of accounts) {
        const aName = String(acc.account_name != null ? acc.account_name : '').trim();
        const bName = String(acc.bank_name != null ? acc.bank_name : '').trim();
        const aNum = String(acc.account_number != null ? acc.account_number : '').trim();
        const aCur = String(acc.currency != null ? acc.currency : defaultCur).trim();
        const aType = String(acc.type != null ? acc.type : 'Bank').trim();

        if (aName || bName || aNum) {
          const bId = await generateSequentialId('account', client);
          const finalAccName = aName || `${bName || 'Ngân hàng'} (${aCur})`;
          const aEntity = String(acc.company_entity || companyId).trim() || companyId;
          const txMgr = acc.transaction_managed_by || null;
          const finCtrl = acc.finance_control || null;
          await client.query(`
            INSERT INTO account (
              account_id, account_name, type, currency, exchange_rate,
              account_number, bank_name, account_status, company_entity,
              transaction_managed_by, finance_control
            ) VALUES ($1, $2, $3, $4, 1, $5, $6, 19, $7, $8, $9)
          `, [bId, finalAccName, aType, aCur, aNum || null, bName || null, aEntity, txMgr, finCtrl]);
          created.push({ account_id: bId, account_name: finalAccName, type: aType });
        }
      }
    } else if (account_name || bank_name) {
      // Single account backward compatibility
      const baseCur = currency || defaultCur;
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
      const baseCur = currency || defaultCur;
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
      const fullName = String(emp.full_name != null ? emp.full_name : '').trim();
      const email = String(emp.email != null ? emp.email : '').trim().toLowerCase();
      if (!fullName || !email) continue;

      // Check if employee already exists by email
      const check = await client.query('SELECT employee_id FROM employee WHERE LOWER(email) = LOWER($1)', [email]);
      if (check.rows.length > 0) continue;

      const empId = await generateSequentialId('employee', client);
      const username = String(emp.username != null ? emp.username : '').trim() || email.split('@')[0];
      const position = String(emp.position != null ? emp.position : '').trim() || 'Nhân viên';
      const startDate = String(emp.start_date != null ? emp.start_date : '').trim() || new Date().toISOString().split('T')[0];
      const emgName = String(emp.emergency_contact_name != null ? emp.emergency_contact_name : '').trim() || null;
      const emgPhone = String(emp.emergency_contact_phone != null ? emp.emergency_contact_phone : '').trim() || null;
      const directMgr = String(emp.direct_manager != null ? emp.direct_manager : '').trim() || null;
      const headMgr = String(emp.head_manager != null ? emp.head_manager : '').trim() || null;

      // Map department
      let deptId = null;
      const empDeptCode = String(emp.department_code != null ? emp.department_code : '').trim().toLowerCase();
      const empDeptName = String(emp.department_name != null ? emp.department_name : '').trim().toLowerCase();
      if (empDeptCode && deptMap.has(empDeptCode)) {
        deptId = deptMap.get(empDeptCode);
      } else if (empDeptName && deptMap.has(empDeptName)) {
        deptId = deptMap.get(empDeptName);
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

// POST /api/system-setup/commit-draft (Final step: commit all wizard draft data into database atomically)
router.post('/commit-draft', async (req, res) => {
  const { company, departments, employees, policies, accounts } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await ensureSetupTable();
    await client.query("ALTER TABLE my_company ADD COLUMN IF NOT EXISTS timezone VARCHAR(100) DEFAULT 'Asia/Ho_Chi_Minh'");

    let primaryCompanyId = '1';

    // 1. COMMIT COMPANY
    if (company) {
      const companyList = Array.isArray(company) ? company : [company];
      for (const comp of companyList) {
        if (!comp) continue;
        const cId = String(comp.my_company_id || comp.company_id || primaryCompanyId || '1').trim();
        if (!primaryCompanyId) primaryCompanyId = cId;
        const cFullName = comp.company_fullname || comp.fullname || comp.name || '';
        const cShortName = comp.company_shortname || comp.shortname || cFullName;
        const cTaxCode = comp.tax_code ? String(comp.tax_code).trim() : null;
        const cCountry = comp.country || 'Vietnam';
        const cCity = comp.city || null;
        const cAddress = comp.address || null;
        const cBaseCurr = comp.base_currency || comp.currency || 'VND';
        const cTz = comp.timezone || 'Asia/Ho_Chi_Minh';
        const cWebsite = comp.website || null;

        let logoParam = null;
        if (comp.logo) {
          if (Buffer.isBuffer(comp.logo)) {
            logoParam = formatLogo(comp.logo);
          } else if (typeof comp.logo === 'string') {
            logoParam = comp.logo;
          } else if (typeof comp.logo === 'object' && Array.isArray(comp.logo.data)) {
            logoParam = formatLogo(Buffer.from(comp.logo.data));
          }
        }

        await client.query(`
          INSERT INTO my_company (
            my_company_id, company_fullname, company_shortname, tax_code, country, city, address, website, base_currency, logo, timezone, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, COALESCE((SELECT id FROM status_catalog WHERE table_name='my_company' AND status_key='active' LIMIT 1), 67))
          ON CONFLICT (my_company_id) DO UPDATE SET
            company_fullname = COALESCE(EXCLUDED.company_fullname, my_company.company_fullname),
            company_shortname = COALESCE(EXCLUDED.company_shortname, my_company.company_shortname),
            tax_code = COALESCE(EXCLUDED.tax_code, my_company.tax_code),
            country = COALESCE(EXCLUDED.country, my_company.country),
            city = COALESCE(EXCLUDED.city, my_company.city),
            address = COALESCE(EXCLUDED.address, my_company.address),
            website = COALESCE(EXCLUDED.website, my_company.website),
            base_currency = COALESCE(EXCLUDED.base_currency, my_company.base_currency),
            logo = COALESCE(EXCLUDED.logo, my_company.logo),
            timezone = COALESCE(EXCLUDED.timezone, my_company.timezone),
            status = EXCLUDED.status
        `, [cId, cFullName, cShortName, cTaxCode, cCountry, cCity, cAddress, cWebsite, cBaseCurr, logoParam, cTz]);
      }
    }

    // 2. COMMIT DEPARTMENTS
    const deptIdMap = new Map();
    if (Array.isArray(departments) && departments.length > 0) {
      for (const d of departments) {
        const dCode = String(d.department_code != null ? d.department_code : '').trim();
        const dName = String(d.department_name != null ? d.department_name : '').trim();
        const dType = String(d.type != null ? d.type : 'Operation').trim();
        const dMgr = String(d.manager_email || d.manager || '').trim() || null;
        const dComp = String(d.company_id != null ? d.company_id : '').trim() || primaryCompanyId;
        const rawId = d.department_id != null ? String(d.department_id).trim() : null;

        if (!dCode && !dName) continue;

        let targetId = rawId;
        if (targetId) {
          const existRes = await client.query('SELECT department_id FROM department WHERE department_id = $1', [targetId]);
          if (existRes.rows.length > 0) {
            await client.query(`
              UPDATE department
              SET department_name = $2, department_code = $3, type = $4, manager_email = $5, company_id = $6
              WHERE department_id = $1
            `, [targetId, dName, dCode, dType, dMgr, dComp]);
          } else {
            await client.query(`
              INSERT INTO department (department_id, department_name, department_code, type, manager_email, company_id)
              VALUES ($1, $2, $3, $4, $5, $6)
            `, [targetId, dName, dCode, dType, dMgr, dComp]);
          }
        } else {
          const existRes = await client.query(
            'SELECT department_id FROM department WHERE company_id = $1 AND (LOWER(department_code) = LOWER($2) OR LOWER(department_name) = LOWER($3))',
            [dComp, dCode, dName]
          );
          if (existRes.rows.length > 0) {
            targetId = existRes.rows[0].department_id;
            await client.query(`
              UPDATE department
              SET department_name = $2, department_code = $3, type = $4, manager_email = $5
              WHERE department_id = $1
            `, [targetId, dName, dCode, dType, dMgr]);
          } else {
            targetId = await generateSequentialId('department', client);
            await client.query(`
              INSERT INTO department (department_id, department_name, department_code, type, manager_email, company_id)
              VALUES ($1, $2, $3, $4, $5, $6)
            `, [targetId, dName, dCode, dType, dMgr, dComp]);
          }
        }

        if (rawId) deptIdMap.set(rawId.toLowerCase(), targetId);
        if (dCode) deptIdMap.set(dCode.toLowerCase(), targetId);
        if (dName) deptIdMap.set(dName.toLowerCase(), targetId);
      }
    }

    // 3. COMMIT EMPLOYEES
    const createdEmployees = [];
    if (Array.isArray(employees) && employees.length > 0) {
      for (const emp of employees) {
        const fName = String(emp.full_name || '').trim();
        const uName = String(emp.username || emp.user_name || '').trim();
        let email = String(emp.email || '').trim().toLowerCase() || null;
        if (!fName && !uName && !email) continue;

        const rawEmpId = emp.employee_id != null ? String(emp.employee_id).trim() : null;
        const empCode = String(emp.employee_code || '').trim() || null;
        const nickName = String(emp.nick_name || '').trim() || null;
        const gen = String(emp.gen || '').trim() || null;
        const pos = String(emp.position || 'Nhân viên').trim();
        const role = String(emp.role || 'Staff').trim() || 'Staff';
        const loc = String(emp.location_base || '').trim() || null;
        let phone = String(emp.phone || '').trim() || null;
        if (phone && phone.length === 9) phone = '0' + phone;
        const address = String(emp.address || '').trim() || null;
        const startDate = String(emp.start_date || '').trim() || new Date().toISOString().split('T')[0];
        const status = Number(emp.status) === 18 ? 18 : 17;
        const empComp = String(emp.company_id || primaryCompanyId).trim() || primaryCompanyId;

        // Resolve department_id
        let resolvedDeptId = null;
        const rawDept = String(emp.department_id || emp.department_name || emp.department_code || '').trim().toLowerCase();
        if (rawDept && deptIdMap.has(rawDept)) {
          resolvedDeptId = deptIdMap.get(rawDept);
        } else if (emp.department_id) {
          resolvedDeptId = String(emp.department_id).trim();
        }

        let targetEmpId = rawEmpId;
        let existEmp = null;
        if (targetEmpId) {
          const check = await client.query('SELECT employee_id FROM employee WHERE employee_id = $1', [targetEmpId]);
          if (check.rows.length > 0) existEmp = check.rows[0];
        }
        if (!existEmp && email) {
          const check = await client.query('SELECT employee_id FROM employee WHERE LOWER(email) = LOWER($1)', [email]);
          if (check.rows.length > 0) existEmp = check.rows[0];
        }
        if (!existEmp && uName) {
          const check = await client.query('SELECT employee_id FROM employee WHERE LOWER(username) = LOWER($1)', [uName]);
          if (check.rows.length > 0) existEmp = check.rows[0];
        }

        if (existEmp) {
          targetEmpId = existEmp.employee_id;
          await client.query(`
            UPDATE employee SET
              full_name = COALESCE($2, full_name),
              username = COALESCE($3, username),
              email = COALESCE($4, email),
              employee_code = COALESCE($5, employee_code),
              nick_name = COALESCE($6, nick_name),
              gen = COALESCE($7, gen),
              position = COALESCE($8, position),
              role = COALESCE($9, role),
              location_base = COALESCE($10, location_base),
              phone = COALESCE($11, phone),
              address = COALESCE($12, address),
              department_id = COALESCE($13, department_id),
              company_id = COALESCE($14, company_id),
              status = $15
            WHERE employee_id = $1
          `, [targetEmpId, fName, uName || null, email, empCode, nickName, gen, pos, role, loc, phone, address, resolvedDeptId, empComp, status]);
        } else {
          if (!targetEmpId) targetEmpId = await generateSequentialId('employee', client);
          await client.query(`
            INSERT INTO employee (
              employee_id, full_name, username, email, employee_code, nick_name, gen, position,
              role, location_base, phone, address, department_id, company_id, status, start_date, app_user_enabled
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, true)
          `, [targetEmpId, fName, uName || (email ? email.split('@')[0] : targetEmpId), email, empCode, nickName, gen, pos, role, loc, phone, address, resolvedDeptId, empComp, status, startDate]);
        }

        createdEmployees.push({
          employee_id: targetEmpId,
          direct_manager_raw: emp.direct_manager != null ? String(emp.direct_manager).trim() : null,
          head_manager_raw: emp.head_manager != null ? String(emp.head_manager).trim() : null
        });
      }

      // Second pass for direct_manager and head_manager
      for (const ce of createdEmployees) {
        if (ce.direct_manager_raw) {
          const mgrKey = ce.direct_manager_raw.toLowerCase();
          const mgrRes = await client.query(
            'SELECT employee_id FROM employee WHERE employee_id = $1 OR employee_code = $1 OR LOWER(email) = $1 OR LOWER(username) = $1 OR LOWER(full_name) = $1 LIMIT 1',
            [mgrKey]
          );
          if (mgrRes.rows.length > 0) {
            await client.query('UPDATE employee SET direct_manager = $1 WHERE employee_id = $2', [mgrRes.rows[0].employee_id, ce.employee_id]);
          }
        }
        if (ce.head_manager_raw) {
          const hrKey = ce.head_manager_raw.toLowerCase();
          const hrRes = await client.query(
            'SELECT employee_id FROM employee WHERE employee_id = $1 OR employee_code = $1 OR LOWER(email) = $1 OR LOWER(username) = $1 OR LOWER(full_name) = $1 LIMIT 1',
            [hrKey]
          );
          if (hrRes.rows.length > 0) {
            await client.query('UPDATE employee SET head_manager = $1 WHERE employee_id = $2', [hrRes.rows[0].employee_id, ce.employee_id]);
          }
        }
      }
    }

    // 4. COMMIT POLICIES
    if (pool.ensureSystemPoliciesSeed) {
      await pool.ensureSystemPoliciesSeed(client);
    }

    if (Array.isArray(policies) && policies.length > 0) {
      const adminRes = await client.query(`
        SELECT employee_id FROM employee WHERE role = 'Super Admin' OR employee_id = 'EMP-001' ORDER BY employee_id ASC LIMIT 1
      `);
      const defaultLead = adminRes.rows[0] ? adminRes.rows[0].employee_id : 'EMP-001';

      const resolveEmp = async (val) => {
        if (!val || typeof val !== 'string') return val;
        const clean = val.trim();
        if (!clean || clean.toLowerCase() === 'direct manager') return clean;
        const eCheck = await client.query('SELECT employee_id FROM employee WHERE employee_id = $1 OR LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($1) LIMIT 1', [clean]);
        return eCheck.rows.length > 0 ? eCheck.rows[0].employee_id : clean;
      };

      for (const p of policies) {
        const pName = String(p.policy_name || '').trim();
        if (!pName) continue;
        const pType = String(p.policy_type || 'Operation').trim();
        const pDesc = String(p.description || pName).trim();
        const pSla = p.sla || 3;
        const tier1 = await resolveEmp(p.tier1_approval || 'Direct Manager');
        const tier2 = await resolveEmp(p.tier2_approval || null);
        const tier3 = await resolveEmp(p.tier3_approval || null);
        const appLevel = String(p.approval_level || (tier3 ? 'Tier 3' : tier2 ? 'Tier 2' : 'Tier 1')).trim();
        const lead = await resolveEmp(p.policy_lead || defaultLead);
        let owner = p.sr_owner || defaultLead;
        if (typeof owner === 'string' && owner.includes(',')) {
          owner = (await Promise.all(owner.split(',').map(s => resolveEmp(s.trim())))).join(',');
        } else {
          owner = await resolveEmp(owner);
        }
        const dept = p.department_id ? (deptIdMap.get(String(p.department_id).toLowerCase()) || p.department_id) : null;
        const elem = p.elements || 'ASSIGN_TASK';

        const pCheck = await client.query('SELECT policy_id FROM POLICY_AND_PROGRAM WHERE LOWER(policy_name) = LOWER($1)', [pName]);
        if (pCheck.rows.length === 0) {
          const pId = await generateSequentialId('policy_and_program', client);
          await client.query(`
            INSERT INTO POLICY_AND_PROGRAM (
              policy_id, policy_name, policy_type, description,
              tier1_approval, tier2_approval, tier3_approval, approval_level,
              policy_lead, sr_owner, department_id, elements, company_id, sla
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          `, [pId, pName, pType, pDesc, tier1, tier2, tier3, appLevel, lead, owner, dept, elem, primaryCompanyId, pSla]);
        }
      }
    }

    // 5. COMMIT ACCOUNTS
    if (Array.isArray(accounts) && accounts.length > 0) {
      for (const acc of accounts) {
        const aName = String(acc.account_name || '').trim();
        const bName = String(acc.bank_name || '').trim();
        const aNum = String(acc.account_number || '').trim();
        const aCur = String(acc.currency || 'VND').trim();
        const aType = String(acc.type || 'Bank').trim();
        const rawAcctId = acc.account_id != null ? String(acc.account_id).trim() : null;
        const aStatus = (acc.account_status === 'active' || Number(acc.account_status) === 19) ? 19 : (Number(acc.account_status) || 19);
        const aRate = acc.exchange_rate != null && !isNaN(Number(acc.exchange_rate)) ? Number(acc.exchange_rate) : 1;
        const aEntity = String(acc.company_entity || primaryCompanyId).trim() || primaryCompanyId;
        const txMgr = acc.transaction_managed_by || null;
        const finCtrl = acc.finance_control || null;

        if (!aName && !bName && !aNum) continue;

        let targetAcctId = rawAcctId;
        if (targetAcctId) {
          const aCheck = await client.query('SELECT account_id FROM account WHERE account_id = $1', [targetAcctId]);
          if (aCheck.rows.length > 0) {
            await client.query(`
              UPDATE account SET
                account_name = COALESCE($2, account_name),
                type = COALESCE($3, type),
                currency = COALESCE($4, currency),
                account_number = COALESCE($5, account_number),
                bank_name = COALESCE($6, bank_name),
                account_status = $7,
                exchange_rate = $8,
                company_entity = $9,
                transaction_managed_by = COALESCE($10, transaction_managed_by),
                finance_control = COALESCE($11, finance_control)
              WHERE account_id = $1
            `, [targetAcctId, aName || `${bName} (${aCur})`, aType, aCur, aNum || null, bName || null, aStatus, aRate, aEntity, txMgr, finCtrl]);
          } else {
            await client.query(`
              INSERT INTO account (
                account_id, account_name, type, currency, account_number, bank_name,
                account_status, exchange_rate, company_entity, transaction_managed_by, finance_control
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            `, [targetAcctId, aName || `${bName} (${aCur})`, aType, aCur, aNum || null, bName || null, aStatus, aRate, aEntity, txMgr, finCtrl]);
          }
        } else {
          targetAcctId = await generateSequentialId('account', client);
          await client.query(`
            INSERT INTO account (
              account_id, account_name, type, currency, account_number, bank_name,
              account_status, exchange_rate, company_entity, transaction_managed_by, finance_control
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          `, [targetAcctId, aName || `${bName} (${aCur})`, aType, aCur, aNum || null, bName || null, aStatus, aRate, aEntity, txMgr, finCtrl]);
        }
      }
    }

    // 6. FINISH SETUP
    await client.query(`
      UPDATE "system_setup"
      SET "value" = 'true', "updated_at" = CURRENT_TIMESTAMP
      WHERE "key" = 'setup_completed'
    `);

    await client.query('COMMIT');
    res.json({ success: true, message: 'All draft data committed and setup completed successfully!' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[commit-draft] error:', err);
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
