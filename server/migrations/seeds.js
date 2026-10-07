const pool = require('../core/db');
const DEBUG_SQL = process.env.DEBUG_SQL === 'true';

/**
 * Ensure system automation policies (Payment ID 5 / RPM, Assign Task) always exist
 * with correct configuration and reserved IDs so tenant custom processes never overwrite them.
 */
async function ensureSystemPoliciesSeed(client = pool) {
  try {
    const tableExists = await client.query(`
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = current_schema() AND table_name = 'policy_and_program'
    `);
    if (tableExists.rows.length === 0) return;

    // Get default admin / employee
    let defaultEmp = 'EMP-001';
    let defaultEmp2 = 'EMP-001';
    try {
      const empRes = await client.query(`
        SELECT employee_id FROM employee 
        WHERE role = 'Super Admin' OR employee_id = 'EMP-001' 
        ORDER BY employee_id ASC LIMIT 2
      `);
      if (empRes.rows.length > 0) defaultEmp = empRes.rows[0].employee_id;
      if (empRes.rows.length > 1) defaultEmp2 = empRes.rows[1].employee_id;
      else defaultEmp2 = defaultEmp;
    } catch (e) {}

    // Get primary company id
    let compId = '1';
    try {
      const compRes = await client.query(`SELECT my_company_id FROM my_company ORDER BY my_company_id ASC LIMIT 1`);
      if (compRes.rows.length > 0) compId = compRes.rows[0].my_company_id;
    } catch (e) {}

    const systemPolicies = [
      {
        policy_id: '5',
        policy_type: 'Finance',
        policy_name: 'Payment',
        description: 'Yêu cầu thực hiện thanh toán (Payment Request)',
        approval_level: 'Tier 2',
        tier1_approval: defaultEmp,
        tier2_approval: defaultEmp2,
        policy_lead: defaultEmp,
        sr_owner: defaultEmp,
        elements: 'CONTRACT, PAYMENT, EXPENSE, FINANCE'
      },
      {
        policy_id: 'ASSIGN_TASK',
        policy_type: 'Workspace',
        policy_name: 'Assign Task',
        description: 'Yêu cầu thực hiện giao việc (Assign Task)',
        approval_level: 'Tier 0',
        tier1_approval: defaultEmp,
        tier2_approval: defaultEmp,
        policy_lead: defaultEmp,
        sr_owner: defaultEmp,
        elements: 'ASSIGN_TASK'
      }
    ];

    for (const p of systemPolicies) {
      await client.query(`
        INSERT INTO policy_and_program (
          policy_id, policy_type, policy_name, description, 
          approval_level, company_id, 
          tier1_approval, tier2_approval, policy_lead, sr_owner, elements
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (policy_id) DO UPDATE SET
          policy_type = EXCLUDED.policy_type,
          policy_name = CASE 
            WHEN policy_and_program.policy_name IS NULL OR policy_and_program.policy_name = '' 
            THEN EXCLUDED.policy_name 
            ELSE policy_and_program.policy_name 
          END,
          elements = COALESCE(policy_and_program.elements, EXCLUDED.elements)
      `, [p.policy_id, p.policy_type, p.policy_name, p.description, p.approval_level, compId, p.tier1_approval, p.tier2_approval, p.policy_lead, p.sr_owner, p.elements]);
    }

    // Clean up redundant RPM process if exists
    await client.query("DELETE FROM policy_and_program WHERE policy_id = 'RPM'");
    console.log('[Migration] ensureSystemPoliciesSeed completed successfully.');
  } catch (err) {
    console.error('[Migration] Error in ensureSystemPoliciesSeed:', err);
  }
}
pool.ensureSystemPoliciesSeed = ensureSystemPoliciesSeed;
pool.cleanLegacyEmails = cleanLegacyEmails;

async function cleanLegacyEmails() {
  const client = await pool.connect();
  try {
    console.log('[Migration] Starting cleanLegacyEmails to replace email -> employee_id...');
    
    // Fetch all employees for mapping
    const empRes = await client.query('SELECT employee_id, email, username FROM employee');
    const employees = empRes.rows.filter(e => e.employee_id);
    
    if (employees.length === 0) {
      console.log('[Migration] No employee records found, skipping cleanLegacyEmails.');
      return;
    }

    await client.query('BEGIN');

    const resolveEmailOrUsername = (val) => {
      if (typeof val !== 'string' || !val.includes('@')) {
        return val;
      }
      const clean = val.trim().toLowerCase();
      const prefix = clean.split('@')[0];
      const match = employees.find(e => 
        (e.email && typeof e.email === 'string' && e.email.trim().toLowerCase() === clean) ||
        (e.username && typeof e.username === 'string' && e.username.trim().toLowerCase() === prefix) ||
        (e.email && typeof e.email === 'string' && e.email.trim().toLowerCase().split('@')[0] === prefix)
      );
      return match ? match.employee_id : val;
    };

    const resolveTextValue = (val) => {
      if (typeof val !== 'string') return val;
      if (val.includes(',')) {
        return val.split(',').map(item => resolveEmailOrUsername(item.trim())).join(',');
      }
      return resolveEmailOrUsername(val);
    };

    const resolveArray = (arr) => {
      if (!Array.isArray(arr)) return arr;
      return arr.map(item => resolveTextValue(item));
    };

    const resolveJson = (obj) => {
      if (obj === null || obj === undefined) return obj;
      if (typeof obj === 'string') {
        return resolveTextValue(obj);
      }
      if (Array.isArray(obj)) {
        return obj.map(item => resolveJson(item));
      }
      if (typeof obj === 'object') {
        const newObj = {};
        for (const [k, v] of Object.entries(obj)) {
          newObj[k] = resolveJson(v);
        }
        return newObj;
      }
      return obj;
    };

    // 1. policy_and_program
    const papRes = await client.query(`
      SELECT policy_id, tier1_approval, tier2_approval, tier3_approval, policy_lead, sr_owner
      FROM policy_and_program
      WHERE tier1_approval LIKE '%@%'
         OR tier2_approval LIKE '%@%'
         OR tier3_approval LIKE '%@%'
         OR policy_lead LIKE '%@%'
         OR sr_owner LIKE '%@%'
    `);
    let papCount = 0;
    for (const row of papRes.rows) {
      const uTier1 = resolveTextValue(row.tier1_approval);
      const uTier2 = resolveTextValue(row.tier2_approval);
      const uTier3 = resolveTextValue(row.tier3_approval);
      const uLead = resolveTextValue(row.policy_lead);
      const uOwner = resolveTextValue(row.sr_owner);
      await client.query(`
        UPDATE policy_and_program
        SET tier1_approval = $1, tier2_approval = $2, tier3_approval = $3, policy_lead = $4, sr_owner = $5
        WHERE policy_id = $6
      `, [uTier1, uTier2, uTier3, uLead, uOwner, row.policy_id]);
      papCount++;
    }
    if (papCount > 0) {
      console.log(`[Migration] Updated policy_and_program: ${papCount} rows`);
    }

    // 2. comment
    const commentRes = await client.query(`
      SELECT comment_id, tag
      FROM comment
      WHERE tag LIKE '%@%'
    `);
    let commentCount = 0;
    for (const row of commentRes.rows) {
      const uTag = resolveTextValue(row.tag);
      await client.query(`
        UPDATE comment
        SET tag = $1
        WHERE comment_id = $2
      `, [uTag, row.comment_id]);
      commentCount++;
    }
    if (commentCount > 0) {
      console.log(`[Migration] Updated comment: ${commentCount} rows`);
    }

    // 3. request
    const requestRes = await client.query(`
      SELECT request_id, sr_creater, requester, policy_lead, sr_owner, approval_flow
      FROM request
      WHERE sr_creater LIKE '%@%'
         OR requester LIKE '%@%'
         OR policy_lead LIKE '%@%'
         OR array_to_string(sr_owner, ',') LIKE '%@%'
         OR approval_flow::text LIKE '%@%'
    `);
    let requestCount = 0;
    for (const row of requestRes.rows) {
      const uCreater = resolveTextValue(row.sr_creater);
      const uRequester = resolveTextValue(row.requester);
      const uLead = resolveTextValue(row.policy_lead);
      const uOwner = resolveArray(row.sr_owner);
      const uFlow = resolveJson(row.approval_flow);
      await client.query(`
        UPDATE request
        SET sr_creater = $1, requester = $2, policy_lead = $3, sr_owner = $4, approval_flow = $5
        WHERE request_id = $6
      `, [uCreater, uRequester, uLead, uOwner, uFlow, row.request_id]);
      requestCount++;
    }
    if (requestCount > 0) {
      console.log(`[Migration] Updated request: ${requestCount} rows`);
    }

    // 4. ticket
    const ticketRes = await client.query(`
      SELECT ticket_id, sr_creater, requester, policy_lead, sr_coordinator, processing_flow
      FROM ticket
      WHERE sr_creater LIKE '%@%'
         OR requester LIKE '%@%'
         OR policy_lead LIKE '%@%'
         OR array_to_string(sr_coordinator, ',') LIKE '%@%'
         OR processing_flow::text LIKE '%@%'
    `);
    let ticketCount = 0;
    for (const row of ticketRes.rows) {
      const uCreater = resolveTextValue(row.sr_creater);
      const uRequester = resolveTextValue(row.requester);
      const uLead = resolveTextValue(row.policy_lead);
      const uCoordinator = resolveArray(row.sr_coordinator);
      const uFlow = resolveJson(row.processing_flow);
      await client.query(`
        UPDATE ticket
        SET sr_creater = $1, requester = $2, policy_lead = $3, sr_coordinator = $4, processing_flow = $5
        WHERE ticket_id = $6
      `, [uCreater, uRequester, uLead, uCoordinator, uFlow, row.ticket_id]);
      ticketCount++;
    }
    if (ticketCount > 0) {
      console.log(`[Migration] Updated ticket: ${ticketCount} rows`);
    }

    // 5. ticket_comment
    const tcRes = await client.query(`
      SELECT comment_id, tag, comment_by
      FROM ticket_comment
      WHERE tag LIKE '%@%'
         OR comment_by LIKE '%@%'
    `);
    let tcCount = 0;
    for (const row of tcRes.rows) {
      const uTag = resolveTextValue(row.tag);
      const uCommentBy = resolveTextValue(row.comment_by);
      await client.query(`
        UPDATE ticket_comment
        SET tag = $1, comment_by = $2
        WHERE comment_id = $3
      `, [uTag, uCommentBy, row.comment_id]);
      tcCount++;
    }
    if (tcCount > 0) {
      console.log(`[Migration] Updated ticket_comment: ${tcCount} rows`);
    }

    // 6. ticket_type
    const ttRes = await client.query(`
      SELECT ticket_type_id, ticket_lead, sr_owner, coordinator, tier_1_engineer, tier_2_engineer, tier_3_engineer
      FROM ticket_type
      WHERE ticket_lead LIKE '%@%'
         OR sr_owner LIKE '%@%'
         OR coordinator LIKE '%@%'
         OR tier_1_engineer LIKE '%@%'
         OR tier_2_engineer LIKE '%@%'
         OR tier_3_engineer LIKE '%@%'
    `);
    let ttCount = 0;
    for (const row of ttRes.rows) {
      const uLead = resolveTextValue(row.ticket_lead);
      const uOwner = resolveTextValue(row.sr_owner);
      const uCoord = resolveTextValue(row.coordinator);
      const uT1 = resolveTextValue(row.tier_1_engineer);
      const uT2 = resolveTextValue(row.tier_2_engineer);
      const uT3 = resolveTextValue(row.tier_3_engineer);
      await client.query(`
        UPDATE ticket_type
        SET ticket_lead = $1, sr_owner = $2, coordinator = $3, tier_1_engineer = $4, tier_2_engineer = $5, tier_3_engineer = $6
        WHERE ticket_type_id = $7
      `, [uLead, uOwner, uCoord, uT1, uT2, uT3, row.ticket_type_id]);
      ttCount++;
    }
    if (ttCount > 0) {
      console.log(`[Migration] Updated ticket_type: ${ttCount} rows`);
    }

    await client.query('COMMIT');
    console.log('[Migration] Finished cleanLegacyEmails successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Migration] Error in cleanLegacyEmails:', err);
  } finally {
    client.release();
  }
}

async function migrateEmptyEmployeeRoles() {
  const client = await pool.connect();
  try {
    console.log('[Migration] Starting migrateEmptyEmployeeRoles...');
    const res = await client.query(`
      UPDATE employee
      SET role = 'staff'
      WHERE role IS NULL OR TRIM(role) = '';
    `);
    if (res.rowCount > 0) {
      console.log(`[Migration] Updated ${res.rowCount} employee records to role='staff'.`);
    } else {
      console.log('[Migration] No employee records with empty role found.');
    }
  } catch (e) {
    console.error('[Migration] Error in migrateEmptyEmployeeRoles:', e);
  } finally {
    client.release();
  }
}

async function migrateLegacyTaskPolicyElements() {
  const client = await pool.connect();
  try {
    console.log('[Migration] Starting migrateLegacyTaskPolicyElements...');
    const res = await client.query(`
      UPDATE policy_and_program 
      SET elements = 'ASSIGN_TASK' 
      WHERE policy_id = '5969' AND (elements IS NULL OR elements = '' OR elements NOT LIKE '%ASSIGN_TASK%');
    `);
    if (res.rowCount > 0) {
      console.log(`[Migration] Updated ${res.rowCount} policy records with ASSIGN_TASK element.`);
    }
  } catch (e) {
    console.error('[Migration] Error in migrateLegacyTaskPolicyElements:', e);
  } finally {
    client.release();
  }
}

async function migrateCompanyData() {
  try {
    // 1. Fetch all my_company records ordered by their ID
    const myCompanies = await pool.query('SELECT my_company_id, company_shortname, company_fullname FROM "my_company" ORDER BY my_company_id');
    const myCompIds = myCompanies.rows.map(r => r.my_company_id);
    
    if (myCompIds.length === 0) {
      console.log('No my_company records found. Skipping company migration.');
      return;
    }

    console.log('Initializing empty my_company shortnames/fullnames to sequential names...');
    for (let i = 0; i < myCompanies.rows.length; i++) {
      const row = myCompanies.rows[i];
      if (!row.company_shortname || !row.company_fullname) {
        const targetShortname = row.company_shortname || `My Company ${i + 1}`;
        const targetFullname = row.company_fullname || `My Company Full Name ${i + 1}`;
        await pool.query(
          'UPDATE "my_company" SET company_shortname = $1, company_fullname = $2 WHERE my_company_id = $3',
          [targetShortname, targetFullname, row.my_company_id]
        );
      }
    }

    // 2. Fetch all accounts
    const accounts = await pool.query('SELECT account_id, company_entity FROM "account"');
    let updatedCount = 0;
    for (const account of accounts.rows) {
      const rawEntity = account.company_entity;
      
      // If it is already a valid my_company_id, leave it alone
      if (myCompIds.includes(rawEntity)) {
        continue;
      }

      // Map it to a valid my_company_id
      let targetId = myCompIds[0];
      if (rawEntity && (rawEntity.includes('Mock') || rawEntity.includes('Masked') || rawEntity.includes('Company') || rawEntity.includes('Entity'))) {
        const match = rawEntity.match(/\d+/);
        if (match) {
          const num = parseInt(match[0], 10);
          const idx = (num - 1) % myCompIds.length;
          targetId = myCompIds[idx >= 0 ? idx : 0];
        } else {
          targetId = myCompIds[updatedCount % myCompIds.length];
        }
      } else {
        targetId = myCompIds[updatedCount % myCompIds.length];
      }

      await pool.query('UPDATE "account" SET company_entity = $1 WHERE account_id = $2', [targetId, account.account_id]);
      updatedCount++;
    }
    console.log(`✅ Successfully migrated ${updatedCount} account records to valid my_company IDs.`);

    // Migrate operation_program records where company_id = '3' to '1'
    const opRes = await pool.query('UPDATE "operation_program" SET company_id = \'1\' WHERE company_id = \'3\'');
    console.log(`✅ Migrated ${opRes.rowCount} operation program records from company 3 to 1.`);
  } catch (err) {
    console.error('Failed to run company data migration:', err);
  }
}

async function seedDefaultPermissions() {
  // ── 1. exception_rules: seed ALL module/view names (no roles set) ──────────
  // Admin configures roles via UI. Empty row = visible to everyone by default.
  const ALL_VIEWS = [
    'my_company', 'department', 'employee', 'employee_active',
    'company', 'contact', 'policy', 'opportunity_list',
    'permissions', 'request', 'comment', 'payment',
    'invoice', 'mtr', 'operation_program', 'account', 'service',
    'asset', 'exception_rules', 'action_rules', 'my_location',
    'request_activity_log', 'logs', 'finance',
    'target_table', 'request_rating',
    // Virtual dashboard views
    'my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team',
    'cms_tenant_info', 'support', 'assigned_task', 'task_subtask',
  ];

  for (const name of ALL_VIEWS) {
    if (name === 'cms_tenant_info') {
      await pool.query(
        `INSERT INTO exception_rules (name, roles) VALUES ($1, 'Super Admin,Admin')
         ON CONFLICT (name) DO UPDATE SET roles = COALESCE(exception_rules.roles, 'Super Admin,Admin')`,
        [name]
      );
    } else if (name === 'assigned_task' || name === 'task_subtask') {
      await pool.query(
        `INSERT INTO exception_rules (name, roles) VALUES ($1, 'Super Admin,Admin,HR,Staff')
         ON CONFLICT (name) DO UPDATE SET roles = COALESCE(exception_rules.roles, 'Super Admin,Admin,HR,Staff')`,
        [name]
      );
    } else {
      await pool.query(
        `INSERT INTO exception_rules (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
        [name]
      );
    }
  }

  // ── 2. column_permissions: seed ALL columns from ALL public tables ──────────
  // No roles set — admin configures via UI. Empty = no column restriction.
  const EXCLUDED_TABLES = [
    'permission_levels', 'permission_positions', 'permission_roles',
    'permission_exceptions', 'column_permissions', 'exception_rules',
    'action_rules', 'customize', 'logs', 'pg_stat_statements',
  ];

  const placeholders = EXCLUDED_TABLES.map((_, i) => `$${i + 1}`).join(',');
  const colsRes = await pool.query(
    `SELECT table_name, column_name
     FROM information_schema.columns
     WHERE table_schema = current_schema()
       AND table_name NOT IN (${placeholders})
     ORDER BY table_name, ordinal_position`,
    EXCLUDED_TABLES
  );

  for (const { table_name, column_name } of colsRes.rows) {
    await pool.query(
      `INSERT INTO column_permissions (table_name, column_name) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [table_name, column_name]
    );
  }

  // ── 2b. Ensure all column_permissions have 'Staff' role allowed by default ──
  await pool.query(`
    INSERT INTO permission_roles (permission_id, role)
    SELECT cp.id, 'Staff'
    FROM column_permissions cp
    WHERE cp.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM permission_roles pr 
        WHERE pr.permission_id = cp.id 
          AND pr.role = 'Staff' 
          AND pr.deleted_at IS NULL
      )
  `);

  // ── 3. Clean up obsolete columns from column_permissions ──────────────────
  await pool.query(
    `DELETE FROM column_permissions
     WHERE id IN (
       SELECT cp.id
       FROM column_permissions cp
       LEFT JOIN information_schema.columns c
         ON cp.table_name = c.table_name
         AND cp.column_name = c.column_name
         AND c.table_schema = current_schema()
       WHERE c.column_name IS NULL
         AND cp.table_name NOT IN (${placeholders})
     )`,
    EXCLUDED_TABLES
  );
}

async function migrateTaskInfoComment() {
  const client = await pool.connect();
  try {
    console.log('[Migration] Checking and adding task_info_comment column to assigned_task...');
    await client.query(`
      ALTER TABLE assigned_task 
      ADD COLUMN IF NOT EXISTS task_info_comment TEXT;
    `);
    console.log('[Migration] task_info_comment column check/addition complete.');
  } catch (err) {
    console.error('Failed to run migrateTaskInfoComment:', err);
  } finally {
    client.release();
  }
}

async function migrateHeadManagerColumn() {
  const client = await pool.connect();
  try {
    console.log('[Migration] Checking and adding head_manager column to employee...');
    await client.query(`
      ALTER TABLE public.employee ADD COLUMN IF NOT EXISTS head_manager character varying(50);
    `);
    // Drop old constraint if exists, then re-add
    await client.query(`
      ALTER TABLE public.employee DROP CONSTRAINT IF EXISTS employee_head_manager_fkey;
    `);
    await client.query(`
      ALTER TABLE public.employee ADD CONSTRAINT employee_head_manager_fkey
        FOREIGN KEY (head_manager) REFERENCES employee(employee_id) ON DELETE SET NULL;
    `);
    console.log('[Migration] head_manager column check/addition complete.');
  } catch (err) {
    console.error('Failed to run migrateHeadManagerColumn:', err);
  } finally {
    client.release();
  }
}

async function migrateFinanceView() {
  const client = await pool.connect();
  try {
    console.log('[Migration] Dropping finance_logs table, ensuring v_finance view and permissions...');
    await client.query(`
      DROP TABLE IF EXISTS public.finance_logs CASCADE;
      DROP VIEW IF EXISTS public.v_finance CASCADE;
      CREATE OR REPLACE VIEW public.v_finance AS
      WITH contract_agg AS (
        SELECT 
          COALESCE(c.request, c.id__request) AS request_id,
          COUNT(CASE WHEN c.type = 69 OR c.type::text = '69' OR LOWER(c.type::text) LIKE '%sell%' OR LOWER(c.type::text) LIKE '%bán%' THEN 1 END) AS selling_contract_count,
          SUM(CASE WHEN c.type = 69 OR c.type::text = '69' OR LOWER(c.type::text) LIKE '%sell%' OR LOWER(c.type::text) LIKE '%bán%' 
              THEN COALESCE(c.total_value_in_base_currency, c.total_value * COALESCE(c.exchance_rate, 1.0), COALESCE(c.value_before_vat_in_base_currency, c.value_before_vat * COALESCE(c.exchance_rate, 1.0), 0) + COALESCE(c.vat_value_in_base_currency, c.vat_value * COALESCE(c.exchance_rate, 1.0), 0)) 
              ELSE 0 END) AS selling,
          SUM(CASE WHEN c.type = 69 OR c.type::text = '69' OR LOWER(c.type::text) LIKE '%sell%' OR LOWER(c.type::text) LIKE '%bán%' 
              THEN COALESCE(c.vat_value_in_base_currency, c.vat_value * COALESCE(c.exchance_rate, 1.0), 0) 
              ELSE 0 END) AS vat_selling,
          SUM(CASE WHEN c.type = 69 OR c.type::text = '69' OR LOWER(c.type::text) LIKE '%sell%' OR LOWER(c.type::text) LIKE '%bán%' 
              THEN COALESCE(c.value_before_vat_in_base_currency, c.value_before_vat * COALESCE(c.exchance_rate, 1.0), 0) 
              ELSE 0 END) AS selling_wo_vat,
          COUNT(CASE WHEN c.type = 70 OR c.type::text = '70' OR LOWER(c.type::text) LIKE '%buy%' OR LOWER(c.type::text) LIKE '%mua%' THEN 1 END) AS buying_contract_count,
          SUM(CASE WHEN c.type = 70 OR c.type::text = '70' OR LOWER(c.type::text) LIKE '%buy%' OR LOWER(c.type::text) LIKE '%mua%' 
              THEN COALESCE(c.total_value_in_base_currency, c.total_value * COALESCE(c.exchance_rate, 1.0), COALESCE(c.value_before_vat_in_base_currency, c.value_before_vat * COALESCE(c.exchance_rate, 1.0), 0) + COALESCE(c.vat_value_in_base_currency, c.vat_value * COALESCE(c.exchance_rate, 1.0), 0)) 
              ELSE 0 END) AS buying,
          SUM(CASE WHEN c.type = 70 OR c.type::text = '70' OR LOWER(c.type::text) LIKE '%buy%' OR LOWER(c.type::text) LIKE '%mua%' 
              THEN COALESCE(c.vat_value_in_base_currency, c.vat_value * COALESCE(c.exchance_rate, 1.0), 0) 
              ELSE 0 END) AS vat_buying,
          SUM(CASE WHEN c.type = 70 OR c.type::text = '70' OR LOWER(c.type::text) LIKE '%buy%' OR LOWER(c.type::text) LIKE '%mua%' 
              THEN COALESCE(c.value_before_vat_in_base_currency, c.value_before_vat * COALESCE(c.exchance_rate, 1.0), 0) 
              ELSE 0 END) AS buying_wo_vat
        FROM contract c
        WHERE c.deleted_at IS NULL AND COALESCE(c.request, c.id__request) IS NOT NULL
        GROUP BY COALESCE(c.request, c.id__request)
      ),
      payment_agg AS (
        SELECT
          COALESCE(p.request, c.request, c.id__request) AS request_id,
          COUNT(CASE WHEN (c.type = 69 OR p.payment_type = 60) THEN 1 END) AS incoming_pm_count,
          SUM(CASE WHEN (c.type = 69 OR p.payment_type = 60) 
              THEN COALESCE(p.value_in_base_currency, p.value * COALESCE(p.exchange_rate, 1.0), 0) ELSE 0 END) AS incoming_payment,
          SUM(CASE WHEN (c.type = 69 OR p.payment_type = 60) AND (p.payment_status = 32 OR LOWER(p.payment_status::text) = 'paid') 
              THEN COALESCE(p.value_in_base_currency, p.value * COALESCE(p.exchange_rate, 1.0), 0) ELSE 0 END) AS incoming_payment_paid,
          SUM(CASE WHEN (c.type = 69 OR p.payment_type = 60) AND NOT (p.payment_status = 32 OR LOWER(p.payment_status::text) = 'paid') AND (p.due_date IS NOT NULL AND p.due_date::date > CURRENT_DATE) 
              THEN COALESCE(p.value_in_base_currency, p.value * COALESCE(p.exchange_rate, 1.0), 0) ELSE 0 END) AS incoming_pm_not_due_yet,
          SUM(CASE WHEN (c.type = 69 OR p.payment_type = 60) AND NOT (p.payment_status = 32 OR LOWER(p.payment_status::text) = 'paid') AND (p.due_date IS NULL OR p.due_date::date <= CURRENT_DATE) 
              THEN COALESCE(p.value_in_base_currency, p.value * COALESCE(p.exchange_rate, 1.0), 0) ELSE 0 END) AS incoming_pm_pending_pm,
          COUNT(CASE WHEN (c.type = 70 OR p.payment_type = 61) THEN 1 END) AS outgoing_pm_count,
          SUM(CASE WHEN (c.type = 70 OR p.payment_type = 61) 
              THEN COALESCE(p.value_in_base_currency, p.value * COALESCE(p.exchange_rate, 1.0), 0) ELSE 0 END) AS outgoing_payment,
          SUM(CASE WHEN (c.type = 70 OR p.payment_type = 61) AND (p.payment_status = 32 OR LOWER(p.payment_status::text) = 'paid') 
              THEN COALESCE(p.value_in_base_currency, p.value * COALESCE(p.exchange_rate, 1.0), 0) ELSE 0 END) AS outgoing_payment_paid,
          SUM(CASE WHEN (c.type = 70 OR p.payment_type = 61) AND NOT (p.payment_status = 32 OR LOWER(p.payment_status::text) = 'paid') AND (p.due_date IS NOT NULL AND p.due_date::date > CURRENT_DATE) 
              THEN COALESCE(p.value_in_base_currency, p.value * COALESCE(p.exchange_rate, 1.0), 0) ELSE 0 END) AS outgoing_pm_not_due_yet,
          SUM(CASE WHEN (c.type = 70 OR p.payment_type = 61) AND NOT (p.payment_status = 32 OR LOWER(p.payment_status::text) = 'paid') AND (p.due_date IS NULL OR p.due_date::date <= CURRENT_DATE) 
              THEN COALESCE(p.value_in_base_currency, p.value * COALESCE(p.exchange_rate, 1.0), 0) ELSE 0 END) AS outgoing_pm_pending_pm
        FROM payment p
        LEFT JOIN contract c ON p.contract_id = c.contract_id
        WHERE p.deleted_at IS NULL AND COALESCE(p.request, c.request, c.id__request) IS NOT NULL
        GROUP BY COALESCE(p.request, c.request, c.id__request)
      ),
      invoice_agg AS (
        SELECT
          COALESCE(i.request, c.request, c.id__request) AS request_id,
          COUNT(CASE WHEN (c.type = 69 OR i.invoice_type = '71' OR LOWER(i.invoice_type::text) = 'selling') THEN 1 END) AS selling_invoice_count,
          SUM(CASE WHEN (c.type = 69 OR i.invoice_type = '71' OR LOWER(i.invoice_type::text) = 'selling') 
              THEN COALESCE(i.total_value_in_base_currency, i.total_value * COALESCE(i.exchange_rate, 1.0), 0) ELSE 0 END) AS selling_invoice_total_value,
          COUNT(CASE WHEN (c.type = 70 OR i.invoice_type = '72' OR LOWER(i.invoice_type::text) = 'buying') THEN 1 END) AS buying_invoice_count,
          SUM(CASE WHEN (c.type = 70 OR i.invoice_type = '72' OR LOWER(i.invoice_type::text) = 'buying') 
              THEN COALESCE(i.total_value_in_base_currency, i.total_value * COALESCE(i.exchange_rate, 1.0), 0) ELSE 0 END) AS buying_invoice_total_value
        FROM invoice i
        LEFT JOIN contract c ON i.contract_id = c.contract_id
        WHERE i.deleted_at IS NULL AND COALESCE(i.request, c.request, c.id__request) IS NOT NULL
        GROUP BY COALESCE(i.request, c.request, c.id__request)
      ),
      expense_agg AS (
        SELECT
          e.id__request AS request_id,
          SUM(CASE WHEN e.id__expense_type = 106 OR LOWER(e.id__expense_type::text) = 'expense' 
              THEN COALESCE(e.total_value_in_base_currency, e.total_value * COALESCE(e.exchange_rate, 1.0), COALESCE(e.value_before_vat, 0) * COALESCE(e.exchange_rate, 1.0), 0) 
              ELSE COALESCE(e.total_value_in_base_currency, e.total_value * COALESCE(e.exchange_rate, 1.0), COALESCE(e.value_before_vat, 0) * COALESCE(e.exchange_rate, 1.0), 0) END) AS expense,
          SUM(CASE WHEN e.id__expense_type = 107 OR LOWER(e.id__expense_type::text) = 'non expense' 
              THEN COALESCE(e.total_value_in_base_currency, e.total_value * COALESCE(e.exchange_rate, 1.0), COALESCE(e.value_before_vat, 0) * COALESCE(e.exchange_rate, 1.0), 0) 
              ELSE 0 END) AS non_expense,
          MAX(e.fy) AS exp_fy
        FROM expense e
        WHERE e.deleted_at IS NULL AND e.id__request IS NOT NULL
        GROUP BY e.id__request
      ),
      asset_agg AS (
        SELECT
          a.request AS request_id,
          SUM(COALESCE(
            a.value_in_base_currency,
            COALESCE(NULLIF(regexp_replace(a.purchase_cost, '[^0-9.]', '', 'g'), '')::numeric, 0) * COALESCE(NULLIF(regexp_replace(a.exchange_rate, '[^0-9.]', '', 'g'), '')::numeric, 1.0)
          )) AS asset
        FROM asset a
        WHERE a.deleted_at IS NULL AND a.request IS NOT NULL
        GROUP BY a.request
      ),
      request_financials AS (
        SELECT 
          r.request_id,
          r.request_type,
          (CASE 
            WHEN ea.exp_fy IS NOT NULL AND ea.exp_fy <> '' THEN 
              (CASE WHEN ea.exp_fy LIKE 'FY%' THEN ea.exp_fy ELSE 'FY' || ea.exp_fy END)
            ELSE 'FY' || EXTRACT(YEAR FROM COALESCE(r.sr_submitted_date, r.sr_created_date, CURRENT_TIMESTAMP))::text 
          END) AS fy,
          COALESCE(ca.selling_contract_count, 0) AS selling_contract_count,
          COALESCE(ca.selling, 0) AS selling,
          COALESCE(ca.vat_selling, 0) AS vat_selling,
          COALESCE(ca.selling_wo_vat, 0) AS selling_wo_vat,
          COALESCE(ca.buying_contract_count, 0) AS buying_contract_count,
          COALESCE(ca.buying, 0) AS buying,
          COALESCE(ca.vat_buying, 0) AS vat_buying,
          COALESCE(ca.buying_wo_vat, 0) AS buying_wo_vat,
          COALESCE(pa.incoming_pm_count, 0) AS incoming_pm_count,
          COALESCE(pa.incoming_payment, 0) AS incoming_payment,
          COALESCE(pa.incoming_payment_paid, 0) AS incoming_payment_paid,
          COALESCE(pa.incoming_pm_not_due_yet, 0) AS incoming_pm_not_due_yet,
          COALESCE(pa.incoming_pm_pending_pm, 0) AS incoming_pm_pending_pm,
          COALESCE(pa.outgoing_pm_count, 0) AS outgoing_pm_count,
          COALESCE(pa.outgoing_payment, 0) AS outgoing_payment,
          COALESCE(pa.outgoing_payment_paid, 0) AS outgoing_payment_paid,
          COALESCE(pa.outgoing_pm_not_due_yet, 0) AS outgoing_pm_not_due_yet,
          COALESCE(pa.outgoing_pm_pending_pm, 0) AS outgoing_pm_pending_pm,
          COALESCE(ia.selling_invoice_count, 0) AS selling_invoice_count,
          COALESCE(ia.selling_invoice_total_value, 0) AS selling_invoice_total_value,
          COALESCE(ia.buying_invoice_count, 0) AS buying_invoice_count,
          COALESCE(ia.buying_invoice_total_value, 0) AS buying_invoice_total_value,
          COALESCE(ea.expense, 0) AS expense,
          COALESCE(ea.non_expense, 0) AS non_expense,
          COALESCE(aa.asset, 0) AS asset
        FROM request r
        LEFT JOIN contract_agg ca ON r.request_id = ca.request_id
        LEFT JOIN payment_agg pa ON r.request_id = pa.request_id
        LEFT JOIN invoice_agg ia ON r.request_id = ia.request_id
        LEFT JOIN expense_agg ea ON r.request_id = ea.request_id
        LEFT JOIN asset_agg aa ON r.request_id = aa.request_id
        WHERE r.deleted_at IS NULL
      ),
      process_summary AS (
        SELECT
          rf.request_type AS process_id,
          rf.fy,
          COUNT(rf.request_id) AS total_requests,
          SUM(rf.selling_contract_count) AS selling_contract_count,
          SUM(rf.selling) AS selling,
          SUM(rf.vat_selling) AS vat_selling,
          SUM(rf.selling_wo_vat) AS selling_wo_vat,
          SUM(rf.buying_contract_count) AS buying_contract_count,
          SUM(rf.buying) AS buying,
          SUM(rf.vat_buying) AS vat_buying,
          SUM(rf.buying_wo_vat) AS buying_wo_vat,
          (SUM(rf.selling) - SUM(rf.buying)) AS gm,
          (SUM(rf.selling_wo_vat) - SUM(rf.buying_wo_vat)) AS gm_wo_vat,
          SUM(rf.incoming_pm_count) AS incoming_pm_count,
          SUM(rf.incoming_payment) AS incoming_payment,
          SUM(rf.incoming_payment_paid) AS incoming_payment_paid,
          SUM(rf.incoming_pm_not_due_yet) AS incoming_pm_not_due_yet,
          SUM(rf.incoming_pm_pending_pm) AS incoming_pm_pending_pm,
          SUM(rf.outgoing_pm_count) AS outgoing_pm_count,
          SUM(rf.outgoing_payment) AS outgoing_payment,
          SUM(rf.outgoing_payment_paid) AS outgoing_payment_paid,
          SUM(rf.outgoing_pm_not_due_yet) AS outgoing_pm_not_due_yet,
          SUM(rf.outgoing_pm_pending_pm) AS outgoing_pm_pending_pm,
          SUM(rf.selling_invoice_count) AS selling_invoice_count,
          SUM(rf.selling_invoice_total_value) AS selling_invoice_total_value,
          SUM(rf.buying_invoice_count) AS buying_invoice_count,
          SUM(rf.buying_invoice_total_value) AS buying_invoice_total_value,
          SUM(rf.expense) AS expense,
          SUM(rf.non_expense) AS non_expense,
          SUM(rf.asset) AS asset
        FROM request_financials rf
        WHERE (
          rf.selling <> 0 OR rf.buying <> 0 OR rf.incoming_payment <> 0 OR 
          rf.outgoing_payment <> 0 OR rf.expense <> 0 OR rf.non_expense <> 0 OR rf.asset <> 0
        )
        GROUP BY rf.request_type, rf.fy
      )
      SELECT 
        (p.policy_id || '__' || COALESCE(ps.fy, 'N/A')) AS id,
        p.policy_id AS process_id,
        p.policy_name AS process,
        p.policy_type,
        p.description,
        p.policy_lead,
        COALESCE(mc.country, '') AS country,
        p.company_id,
        COALESCE(ps.fy, '') AS fy,
        COALESCE(ps.selling_contract_count, 0) AS selling_contract_count,
        COALESCE(ps.selling, 0) AS selling,
        COALESCE(ps.buying_contract_count, 0) AS buying_contract_count,
        COALESCE(ps.buying, 0) AS buying,
        COALESCE(ps.gm, 0) AS gm,
        COALESCE(ps.vat_selling, 0) AS vat_selling,
        COALESCE(ps.selling_wo_vat, 0) AS selling_wo_vat,
        COALESCE(ps.vat_buying, 0) AS vat_buying,
        COALESCE(ps.buying_wo_vat, 0) AS buying_wo_vat,
        COALESCE(ps.gm_wo_vat, 0) AS gm_wo_vat,
        COALESCE(ps.incoming_pm_count, 0) AS incoming_pm_count,
        COALESCE(ps.incoming_payment, 0) AS incoming_payment,
        COALESCE(ps.incoming_payment_paid, 0) AS incoming_payment_paid,
        COALESCE(ps.incoming_pm_not_due_yet, 0) AS incoming_pm_not_due_yet,
        COALESCE(ps.incoming_pm_pending_pm, 0) AS incoming_pm_pending_pm,
        COALESCE(ps.outgoing_pm_count, 0) AS outgoing_pm_count,
        COALESCE(ps.outgoing_payment, 0) AS outgoing_payment,
        COALESCE(ps.outgoing_payment_paid, 0) AS outgoing_payment_paid,
        COALESCE(ps.outgoing_pm_not_due_yet, 0) AS outgoing_pm_not_due_yet,
        COALESCE(ps.outgoing_pm_pending_pm, 0) AS outgoing_pm_pending_pm,
        COALESCE(ps.selling_invoice_count, 0) AS selling_invoice_count,
        COALESCE(ps.selling_invoice_total_value, 0) AS selling_invoice_total_value,
        COALESCE(ps.buying_invoice_count, 0) AS buying_invoice_count,
        COALESCE(ps.buying_invoice_total_value, 0) AS buying_invoice_total_value,
        COALESCE(ps.expense, 0) AS expense,
        COALESCE(ps.non_expense, 0) AS non_expense,
        COALESCE(ps.asset, 0) AS asset,
        COALESCE(ps.total_requests, 0) AS total_requests
      FROM policy_and_program p
      LEFT JOIN my_company mc ON p.company_id = mc.my_company_id
      JOIN process_summary ps ON p.policy_id::text = ps.process_id::text OR p.policy_name = ps.process_id::text
      WHERE p.deleted_at IS NULL;

      INSERT INTO column_permissions (table_name, column_name)
      SELECT 'finance', col FROM unnest(ARRAY[
        'process', 'policy_type', 'selling_contract_count', 'selling', 'buying_contract_count', 'buying',
        'gm', 'vat_selling', 'selling_wo_vat', 'vat_buying', 'buying_wo_vat', 'gm_wo_vat',
        'incoming_pm_count', 'incoming_payment', 'incoming_payment_paid', 'incoming_pm_not_due_yet', 'incoming_pm_pending_pm',
        'outgoing_pm_count', 'outgoing_payment', 'outgoing_payment_paid', 'outgoing_pm_not_due_yet', 'outgoing_pm_pending_pm',
        'selling_invoice_count', 'selling_invoice_total_value', 'buying_invoice_count', 'buying_invoice_total_value',
        'expense', 'non_expense', 'asset', 'fy'
      ]) AS col
      ON CONFLICT DO NOTHING;
    `);
    console.log('[Migration] Finance view and permissions verified and finance_logs table removed.');
  } catch (err) {
    console.error('[Migration] Failed to run migrateFinanceView:', err);
  } finally {
    client.release();
  }
}

async function dropDeprecatedFinanceColumns() {
  const client = await pool.connect();
  try {
    console.log('[Migration] Dropping deprecated columns and legacy physical finance table...');
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'expense' AND column_name = 'id__finance_category') THEN
          ALTER TABLE public.expense DROP COLUMN IF EXISTS id__finance_category;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'contract' AND column_name = 'operation_program_id') THEN
          ALTER TABLE public.contract DROP COLUMN IF EXISTS operation_program_id;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'invoice' AND column_name = 'operation_program_id') THEN
          ALTER TABLE public.invoice DROP COLUMN IF EXISTS operation_program_id;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payment' AND column_name = 'operation_program_id') THEN
          ALTER TABLE public.payment DROP COLUMN IF EXISTS operation_program_id;
        END IF;
        DELETE FROM public.column_permissions WHERE column_name IN ('id__finance_category', 'operation_program_id');
        DELETE FROM public.operation_program;
        DELETE FROM public.action_rules WHERE view_name = 'operation_program' OR action_id LIKE '%operation_program%';
        DROP TABLE IF EXISTS public.finance CASCADE;
        DROP TABLE IF EXISTS public.finance_logs CASCADE;
      END $$;
    `);
    console.log('[Migration] Deprecated columns and legacy finance table cleaned up successfully.');
  } catch (err) {
    console.error('[Migration] Failed to run dropDeprecatedFinanceColumns:', err);
  } finally {
    client.release();
  }
}


module.exports = {
  ensureSystemPoliciesSeed,
  cleanLegacyEmails,
  migrateEmptyEmployeeRoles,
  migrateLegacyTaskPolicyElements,
  migrateCompanyData,
  seedDefaultPermissions,
  migrateTaskInfoComment,
  migrateHeadManagerColumn,
  migrateFinanceView,
  dropDeprecatedFinanceColumns
};
