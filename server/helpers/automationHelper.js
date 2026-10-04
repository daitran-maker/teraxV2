const pool = require('../db');

const AUTOMATIONS = [
  {
    id: 'app_request_approval_sync_payment_invoice',
    name: 'Request approval sync to Payment / Invoice',
    source: 'app',
    type: 'status_condition',
    tables: ['request', 'payment', 'invoice'],
    trigger: 'When request approval reaches Approved in action flow',
    condition: "request.approval_status becomes Approved; request_type is '5'/'RPM' for payment or '12' for invoice",
    schedule: 'No schedule',
    output: "Updates payment.payment_status to 'Ready for payment' or invoice.invoice_status to 'Ready to issue'",
    description: 'Keeps downstream finance documents ready once a request is fully approved.',
    code_location: 'server/routes/actions.js:980'
  },
  {
    id: 'app_request_start_sync_payment',
    name: 'Request start sync to Payment',
    source: 'app',
    type: 'status_condition',
    tables: ['request', 'payment'],
    trigger: 'When request action Start is executed',
    condition: "action_id is ACT-REQUEST-08 and request_type is '5' or 'RPM'",
    schedule: 'No schedule',
    output: "Updates payment.payment_status to 'Ready for payment'",
    description: 'Moves linked payment into payment-ready state when a payment request starts processing.',
    code_location: 'server/routes/actions.js:1077'
  },
  {
    id: 'app_dynamic_request_approval_sync_payment_invoice',
    name: 'Dynamic request approval sync to Payment / Invoice',
    source: 'app',
    type: 'data_change_condition',
    tables: ['request', 'payment', 'invoice'],
    trigger: 'When request is updated through dynamic CRUD',
    condition: "request.approval_status changes from non-Approved to Approved; request_type is '5'/'RPM' or '12'",
    schedule: 'No schedule',
    output: "Updates payment.payment_status to 'Ready for payment' or invoice.invoice_status to 'Ready to issue'",
    description: 'Catches approval status changes made through generic table updates.',
    code_location: 'server/routes/dynamic_crud.js:1987'
  },
  {
    id: 'db_audit_log_trigger',
    name: 'Database audit log trigger',
    source: 'database',
    type: 'database_trigger',
    tables: ['account', 'asset', 'column_permissions', 'company', 'contact', 'contract', 'customize', 'department', 'employee', 'invoice', 'mtr', 'my_company', 'my_location', 'my_product_and_service', 'operation_program', 'oppotunity', 'payment', 'permission_exceptions', 'permission_levels', 'permission_positions', 'permission_roles', 'policy_and_program', 'project', 'request', 'service', 'ticket'],
    trigger: 'PostgreSQL BEFORE INSERT OR UPDATE OR DELETE trigger',
    condition: 'Any insert, update, or delete on audited business tables',
    schedule: 'No schedule',
    output: 'Writes row-change history into audit logs',
    description: 'Provides database-level audit history for business data changes.',
    code_location: 'init.sql:44, init.sql:2323'
  },
  {
    id: 'db_cascade_soft_delete_trigger',
    name: 'Database cascade soft delete trigger',
    source: 'database',
    type: 'database_trigger',
    tables: ['account', 'action_rules', 'asset', 'audit_logs', 'cms_tenant_info', 'column_permissions', 'comment', 'company', 'contact', 'contract', 'customize', 'department', 'employee', 'exception_rules', 'finance', 'invoice', 'mtr', 'my_company', 'my_location', 'my_product_and_service', 'notification', 'operation_program', 'oppotunity', 'payment', 'permission_exceptions', 'permission_levels', 'permission_positions', 'permission_roles', 'policy_and_program', 'project', 'request', 'request_watches', 'service', 'system_setup', 'ticket', 'ticket_comment', 'ticket_type', 'uploaded_files'],
    trigger: 'PostgreSQL AFTER UPDATE trigger',
    condition: 'deleted_at changes from NULL to a timestamp on a parent row',
    schedule: 'No schedule',
    output: 'Propagates soft delete timestamps to configured child records',
    description: 'Keeps related records soft-deleted consistently at database level.',
    code_location: 'init.sql:142, init.sql:2512'
  },
  {
    id: 'db_request_submit_status_trigger',
    name: 'Request submit status enforcement',
    source: 'database',
    type: 'database_trigger',
    tables: ['request'],
    trigger: 'PostgreSQL request status trigger',
    condition: 'Request submit/update attempts must match the allowed submitted status rules',
    schedule: 'No schedule',
    output: 'Allows valid status changes and blocks invalid ones with a database exception',
    description: 'Protects request submission status consistency below the app layer.',
    code_location: 'migrations/2026-08-01_request_submit_status_trigger.sql:1'
  }
];

async function ensureAutomationTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS automation_registry (
      automation_id text PRIMARY KEY,
      active boolean NOT NULL DEFAULT true,
      updated_by text,
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    ALTER TABLE automation_registry ADD COLUMN IF NOT EXISTS updated_by text;
    ALTER TABLE automation_registry ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

    CREATE TABLE IF NOT EXISTS automation_run_logs (
      id bigserial PRIMARY KEY,
      automation_id text NOT NULL,
      source text NOT NULL,
      table_name text,
      record_id text,
      changed_columns text[],
      condition_snapshot jsonb,
      output_snapshot jsonb,
      status text NOT NULL DEFAULT 'success',
      message text,
      run_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_automation_run_logs_automation_id ON automation_run_logs (automation_id);
    CREATE INDEX IF NOT EXISTS idx_automation_run_logs_run_at ON automation_run_logs (run_at DESC);
  `);

  for (const automation of AUTOMATIONS) {
    await pool.query(
      `INSERT INTO automation_registry (automation_id, active)
       VALUES ($1, true)
       ON CONFLICT (automation_id) DO NOTHING`,
      [automation.id]
    );
  }
}

async function getAutomationRows() {
  await ensureAutomationTables();
  const registry = await pool.query('SELECT automation_id, active, updated_by, updated_at FROM automation_registry');
  const counts = await pool.query(`
    SELECT automation_id, COUNT(*)::int AS run_count, MAX(run_at) AS last_run_at
    FROM automation_run_logs
    GROUP BY automation_id
  `);
  const auditLogStats = await pool.query(`
    SELECT
      COUNT(*)::int AS run_count,
      MAX(created_at) AS last_run_at
    FROM audit_logs
    WHERE to_regclass('public.audit_logs') IS NOT NULL
  `).catch(() => ({ rows: [] }));
  const registryMap = new Map(registry.rows.map(row => [row.automation_id, row]));
  const countMap = new Map(counts.rows.map(row => [row.automation_id, row]));
  return AUTOMATIONS.map(item => ({
    ...item,
    active: registryMap.get(item.id)?.active !== false,
    updated_by: registryMap.get(item.id)?.updated_by || null,
    updated_at: registryMap.get(item.id)?.updated_at || null,
    run_count: item.id === 'db_audit_log_trigger'
      ? (auditLogStats.rows[0]?.run_count || 0)
      : (countMap.get(item.id)?.run_count || 0),
    last_run_at: item.id === 'db_audit_log_trigger'
      ? (auditLogStats.rows[0]?.last_run_at || null)
      : (countMap.get(item.id)?.last_run_at || null)
  }));
}

async function isAutomationActive(automationId) {
  await ensureAutomationTables();
  const res = await pool.query('SELECT active FROM automation_registry WHERE automation_id = $1', [automationId]);
  return res.rows.length === 0 || res.rows[0].active !== false;
}

async function setAutomationActive(automationId, active, userId) {
  await ensureAutomationTables();
  await pool.query(
    `INSERT INTO automation_registry (automation_id, active, updated_by, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (automation_id)
     DO UPDATE SET active = EXCLUDED.active, updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [automationId, !!active, userId || null]
  );
}

async function logAutomationRun(automationId, details = {}) {
  await ensureAutomationTables();
  const automation = AUTOMATIONS.find(item => item.id === automationId);
  await pool.query(
    `INSERT INTO automation_run_logs
      (automation_id, source, table_name, record_id, changed_columns, condition_snapshot, output_snapshot, status, message)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9)`,
    [
      automationId,
      automation ? automation.source : 'app',
      details.table_name || null,
      details.record_id == null ? null : String(details.record_id),
      details.changed_columns || null,
      JSON.stringify(details.condition_snapshot || {}),
      JSON.stringify(details.output_snapshot || {}),
      details.status || 'success',
      details.message || null
    ]
  );
}

module.exports = {
  AUTOMATIONS,
  ensureAutomationTables,
  getAutomationRows,
  isAutomationActive,
  setAutomationActive,
  logAutomationRun
};
