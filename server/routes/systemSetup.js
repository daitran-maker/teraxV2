const express = require('express');
const router = express.Router();
const pool = require('../db');

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
      `, [company_fullname, company_shortname, tax_code, country, address, website, base_currency, logo, compId]);
    } else {
      await client.query(`
        INSERT INTO my_company (my_company_id, company_fullname, company_shortname, tax_code, country, address, website, base_currency, logo, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE((SELECT id FROM status_catalog WHERE table_name='my_company' AND status_key='active' LIMIT 1), 67))
      `, [compId, company_fullname, company_shortname, tax_code, country, address, website, base_currency, logo]);
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

      // Check if code or name already exists for company
      const check = await client.query(
        'SELECT department_id FROM department WHERE company_id = $1 AND (LOWER(department_code) = LOWER($2) OR LOWER(department_name) = LOWER($3))',
        [companyId, code, name]
      );

      if (check.rows.length === 0) {
        const id = await generateSequentialId('department', client);
        await client.query(`
          INSERT INTO department (department_id, department_name, department_code, type, company_id)
          VALUES ($1, $2, $3, $4, $5)
        `, [id, name, code, type, companyId]);
        created.push({ department_id: id, department_name: name, department_code: code, type });
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

      const check = await client.query(
        'SELECT policy_id FROM POLICY_AND_PROGRAM WHERE LOWER(policy_name) = LOWER($1)',
        [name]
      );

      if (check.rows.length === 0) {
        const id = await generateSequentialId('policy_and_program', client);
        await client.query(`
          INSERT INTO POLICY_AND_PROGRAM (
            policy_id, policy_name, policy_type, description,
            tier1_approval, approval_level, policy_lead, sr_owner,
            elements, company_id, sla
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
          id,
          name,
          pType,
          desc,
          'Direct Manager', // Tier 1 Direct Manager
          'Tier 1',
          defaultLead,
          defaultLead,
          elements,
          companyId,
          p.sla || 3
        ]);
        created.push({ policy_id: id, policy_name: name });
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
      const username = email.split('@')[0];
      const position = (emp.position || '').trim() || 'Nhân viên';

      // Map department
      let deptId = null;
      if (emp.department_code && deptMap.has(emp.department_code.trim().toLowerCase())) {
        deptId = deptMap.get(emp.department_code.trim().toLowerCase());
      } else if (emp.department_name && deptMap.has(emp.department_name.trim().toLowerCase())) {
        deptId = deptMap.get(emp.department_name.trim().toLowerCase());
      }

      await client.query(`
        INSERT INTO employee (
          employee_id, username, full_name, email, position,
          department_id, company_id, role, status, start_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'Staff', 17, CURRENT_DATE)
      `, [empId, username, fullName, email, position, deptId, companyId]);

      created.push({ employee_id: empId, full_name: fullName, email, direct_manager_raw: emp.direct_manager });
    }

    // Second pass: Link direct managers by email or full name if provided
    for (const c of created) {
      if (c.direct_manager_raw) {
        const mgrKey = String(c.direct_manager_raw).trim().toLowerCase();
        const mgrRes = await client.query(
          'SELECT employee_id FROM employee WHERE LOWER(email) = $1 OR LOWER(full_name) = $1 LIMIT 1',
          [mgrKey]
        );
        if (mgrRes.rows.length > 0) {
          await client.query('UPDATE employee SET direct_manager = $1 WHERE employee_id = $2', [mgrRes.rows[0].employee_id, c.employee_id]);
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
