const express = require('express');
const router = express.Router();
const pool = require('../db');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const ALLOWED_TABLES = [
  'account',               'action_rules',
  'asset',                 'department',
  'employee',              'contract',
  'customize',             'column_permissions',
  'exception_rules',
  'company',               'invoice',
  'mtr',                   'my_product_and_service',
  'operation_program',     'my_company',
  'oppotunity',            'payment',
  'permission_positions',  'permission_roles',
  'policy_and_program',    'project',
  'request',               'comment',
  'service',               'permission_levels',     
  'contact',               'permission_exceptions',
  'my_location',           'cms_tenant_info',
  'ticket',                'ticket_comment',        'ticket_type',
  'assigned_task',         'task_subtask',          'expense'
];

// Helper to determine primary key from table name
function getPrimaryKey(tableName) {
  if (tableName === 'employee' || tableName === 'employee_active') return 'employee_id';
  if (tableName === 'policy_and_program') return 'policy_id';
  if (tableName === 'ticket_type') return 'ticket_type_id';
  if (tableName === 'comment' || tableName === 'ticket_comment') return 'comment_id';
  if (tableName === 'column_permissions') return 'id';
  if (['action_rules', 'exception_rules', 'customize', 'my_product_and_service', 'notification', 'cms_tenant_info'].includes(tableName)) return 'id';
  if (tableName === 'asset') return 'office_asset_id';
  if (tableName === 'mtr') return 'transaction_id';
  if (tableName === 'assigned_task') return 'task_id';
  if (tableName === 'task_subtask') return 'subtask_id';
  return `${tableName}_id`; 
}

// Backup Directory Setup
const BACKUP_DIR = path.join(__dirname, '../../backups');
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Parse DATABASE_URL for pg_dump / pg_restore
const dbUrl = process.env.DATABASE_URL;
let dbConfig = null;
if (dbUrl) {
  try {
    const parsed = new URL(dbUrl);
    dbConfig = {
      user: parsed.username,
      password: decodeURIComponent(parsed.password),
      host: parsed.hostname,
      port: parsed.port || '5432',
      database: parsed.pathname.substring(1)
    };
  } catch (e) {
    console.error('[Backup Init] Failed to parse DATABASE_URL:', e.message);
  }
}

/**
 * 1. POST /api/backup/revert
 * Reverts a specific row in tableName to the state recorded at targetLogId
 * by replaying subsequent audit log changes in reverse order.
 */
router.post('/revert', async (req, res) => {
  const { tableName, recordId, targetLogId } = req.body;
  const userEmail = req.user?.email || 'system';

  if (!tableName || !recordId || !targetLogId) {
    return res.status(400).json({ error: 'Missing tableName, recordId, or targetLogId.' });
  }

  if (!ALLOWED_TABLES.includes(tableName)) {
    return res.status(403).json({ error: `Table '${tableName}' is restricted or invalid.` });
  }

  const pkCol = getPrimaryKey(tableName);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Verify and fetch the target log entry from audit_logs
    const logRes = await client.query(
      `SELECT * FROM audit_logs WHERE id = $1 AND table_name = $2 AND record_id = $3`,
      [targetLogId, tableName, recordId]
    );

    if (logRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Target log entry ${targetLogId} not found for ${tableName} (${recordId}).` });
    }

    const targetLog = logRes.rows[0];

    // 2. Fetch the current row state
    const fetchRes = await client.query(
      `SELECT * FROM "${tableName}" WHERE "${pkCol}" = $1`,
      [recordId]
    );

    if (fetchRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Current record with id ${recordId} not found in ${tableName}.` });
    }

    const currentRecord = fetchRes.rows[0];

    // 3. Query all subsequent logs for this record (id > targetLogId) ordered by id DESC (newest first)
    const subsequentLogsRes = await client.query(
      `SELECT * FROM audit_logs WHERE table_name = $1 AND record_id = $2 AND id > $3 ORDER BY id DESC`,
      [tableName, recordId, targetLogId]
    );
    const subsequentLogs = subsequentLogsRes.rows;

    // 4. Reconstruct the record state at targetLogId by rolling back subsequent logs
    const revertedData = { ...currentRecord };
    const excludedKeys = ['log', 'created_date', 'created_by', 'updated_date', 'updated_by'];

    for (const entry of subsequentLogs) {
      if (entry.changes) {
        for (const key of Object.keys(entry.changes)) {
          if (excludedKeys.includes(key)) continue;
          // Apply the 'old' value to roll back this change
          revertedData[key] = entry.changes[key].old;
        }
      }
    }

    // 5. Build dynamic UPDATE query
    const updateKeys = Object.keys(revertedData).filter(
      k => k !== pkCol && !excludedKeys.includes(k)
    );

    if (updateKeys.length === 0) {
      await client.query('COMMIT');
      return res.json({ message: 'No fields needed to be changed for this revert.', row: currentRecord });
    }

    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    for (const key of updateKeys) {
      setClauses.push(`"${key}" = $${paramIndex}`);
      values.push(revertedData[key]);
      paramIndex++;
    }

    // Add PK as final parameter
    values.push(recordId);

    const updateQuery = `
      UPDATE "${tableName}"
      SET ${setClauses.join(', ')}
      WHERE "${pkCol}" = $${paramIndex}
      RETURNING *
    `;

    // Set transaction-level user context variable for the trigger
    await client.query("SELECT set_config('app.current_user', $1, true)", [userEmail]);

    const updateRes = await client.query(updateQuery, values);
    await client.query('COMMIT');

    res.json({
      message: `Successfully reverted record to log ID ${targetLogId}.`,
      row: updateRes.rows[0]
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Revert Error]', err);
    res.status(500).json({ error: `Revert failed: ${err.message}` });
  } finally {
    client.release();
  }
});

/**
 * 2. POST /api/backup/snapshot
 * Creates a pg_dump backup snapshot file.
 */
router.post('/snapshot', async (req, res) => {
  if (!dbConfig) {
    return res.status(500).json({ error: 'Database configuration not available.' });
  }

  const filename = `snapshot_${Date.now()}.dump`;
  const filepath = path.join(BACKUP_DIR, filename);

  const dumpCmd = `pg_dump -h "${dbConfig.host}" -p "${dbConfig.port}" -U "${dbConfig.user}" -d "${dbConfig.database}" -Fc -f "${filepath}"`;

  exec(dumpCmd, { env: { ...process.env, PGPASSWORD: dbConfig.password } }, (err, stdout, stderr) => {
    if (err) {
      console.error('[pg_dump Error]', stderr);
      return res.status(500).json({ error: `pg_dump failed: ${stderr || err.message}` });
    }

    const stats = fs.statSync(filepath);
    res.json({
      message: 'Database backup snapshot created successfully.',
      filename,
      sizeBytes: stats.size,
      createdAt: new Date()
    });
  });
});

/**
 * 3. GET /api/backup/snapshots
 * Lists all available snapshot files.
 */
router.get('/snapshots', (req, res) => {
  fs.readdir(BACKUP_DIR, (err, files) => {
    if (err) {
      return res.status(500).json({ error: `Failed to read backups directory: ${err.message}` });
    }

    const dumps = files
      .filter(f => f.endsWith('.dump'))
      .map(f => {
        const filepath = path.join(BACKUP_DIR, f);
        const stats = fs.statSync(filepath);
        return {
          filename: f,
          sizeBytes: stats.size,
          createdAt: stats.birthtime
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt);

    res.json({ snapshots: dumps });
  });
});

/**
 * 4. POST /api/backup/snapshot/:filename/restore
 * Restores the database from a snapshot using pg_restore.
 */
router.post('/snapshot/:filename/restore', async (req, res) => {
  const { filename } = req.params;

  if (!/^[a-zA-Z0-9_\-\.]+\.dump$/.test(filename)) {
    return res.status(400).json({ error: 'Invalid file name format.' });
  }

  const filepath = path.join(BACKUP_DIR, filename);
  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ error: 'Snapshot file not found.' });
  }

  if (!dbConfig) {
    return res.status(500).json({ error: 'Database configuration not available.' });
  }

  const restoreCmd = `pg_restore -h "${dbConfig.host}" -p "${dbConfig.port}" -U "${dbConfig.user}" -d "${dbConfig.database}" --clean --no-owner "${filepath}"`;

  exec(restoreCmd, { env: { ...process.env, PGPASSWORD: dbConfig.password } }, (err, stdout, stderr) => {
    if (err) {
      console.error('[pg_restore Error]', stderr);
      return res.status(500).json({ error: `pg_restore failed: ${stderr || err.message}` });
    }

    res.json({
      message: `Database successfully restored to snapshot: ${filename}.`
    });
  });
});

module.exports = router;
