const express = require('express');
const router = express.Router();
const pool = require('../db');
const {
  AUTOMATIONS,
  ensureAutomationTables,
  getAutomationRows,
  setAutomationActive
} = require('../helpers/automationHelper');

router.get('/', async (req, res) => {
  try {
    const rows = await getAutomationRows();
    res.json(rows);
  } catch (err) {
    console.error('[Automations] list failed:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const rows = await getAutomationRows();
    const automation = rows.find(item => item.id === req.params.id);
    if (!automation) return res.status(404).json({ error: 'Automation not found' });
    let logs;
    if (req.params.id === 'db_audit_log_trigger') {
      logs = await pool.query(
        `SELECT
           id,
           'db_audit_log_trigger' AS automation_id,
           'database' AS source,
           table_name,
           record_id,
           CASE
             WHEN changes IS NULL THEN ARRAY[]::text[]
             WHEN jsonb_typeof(changes) = 'object' THEN ARRAY(SELECT jsonb_object_keys(changes))
             ELSE ARRAY[]::text[]
           END AS changed_columns,
           jsonb_build_object('action', action, 'changed_by', changed_by) AS condition_snapshot,
           changes AS output_snapshot,
           'success' AS status,
           NULL::text AS message,
           created_at AS run_at
         FROM audit_logs
         ORDER BY created_at DESC
         LIMIT 100`
      ).catch(() => ({ rows: [] }));
    } else {
      logs = await pool.query(
      `SELECT id, automation_id, source, table_name, record_id, changed_columns,
              condition_snapshot, output_snapshot, status, message, run_at
       FROM automation_run_logs
       WHERE automation_id = $1
       ORDER BY run_at DESC
       LIMIT 100`,
      [req.params.id]
      );
    }
    res.json({ ...automation, logs: logs.rows });
  } catch (err) {
    console.error('[Automations] detail failed:', err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/active', async (req, res) => {
  try {
    await ensureAutomationTables();
    if (!AUTOMATIONS.some(item => item.id === req.params.id)) {
      return res.status(404).json({ error: 'Automation not found' });
    }
    await setAutomationActive(req.params.id, req.body.active, req.user?.employee_id || req.user?.email || req.user?.username);
    const rows = await getAutomationRows();
    res.json(rows.find(item => item.id === req.params.id));
  } catch (err) {
    console.error('[Automations] active update failed:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
