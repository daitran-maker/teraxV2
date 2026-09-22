const express = require('express');
const router = express.Router();
const pool = require('../db');
const { clearPermissionCache } = require('../helpers/permissionHelper');

// ==================== column_permissions ====================

router.get('/column-permissions', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM column_permissions WHERE deleted_at IS NULL ORDER BY table_name, column_name');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/column-permissions/:id', async (req, res) => {
  try {
    const cp = await pool.query('SELECT * FROM column_permissions WHERE id = $1 AND deleted_at IS NULL', [req.params.id]);
    if (cp.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const levels = await pool.query('SELECT * FROM permission_levels WHERE permission_id = $1 AND deleted_at IS NULL', [req.params.id]);
    const positions = await pool.query('SELECT * FROM permission_positions WHERE permission_id = $1 AND deleted_at IS NULL', [req.params.id]);
    const roles = await pool.query('SELECT * FROM permission_roles WHERE permission_id = $1 AND deleted_at IS NULL', [req.params.id]);
    const exceptions = await pool.query('SELECT * FROM permission_exceptions WHERE permission_id = $1 AND deleted_at IS NULL', [req.params.id]);
    res.json({
      ...cp.rows[0],
      levels: levels.rows,
      positions: positions.rows,
      roles: roles.rows,
      exceptions: exceptions.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/column-permissions', async (req, res) => {
  const { table_name, column_name, levels = [], positions = [], roles = [], exceptions = [] } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const cp = await client.query(
      'INSERT INTO column_permissions (table_name, column_name) VALUES ($1,$2) RETURNING *',
      [table_name, column_name]
    );
    const pid = cp.rows[0].id;
    for (const level of levels) {
      await client.query('INSERT INTO permission_levels (permission_id, level) VALUES ($1,$2)', [pid, level]);
    }
    for (const pos of positions) {
      await client.query('INSERT INTO permission_positions (permission_id, position) VALUES ($1,$2)', [pid, pos]);
    }
    for (const role of roles) {
      await client.query('INSERT INTO permission_roles (permission_id, role) VALUES ($1,$2)', [pid, role]);
    }
    for (const ex of exceptions) {
      await client.query('INSERT INTO permission_exceptions (permission_id, email) VALUES ($1,$2)', [pid, ex]);
    }
    await client.query('COMMIT');
    clearPermissionCache();
    res.status(201).json(cp.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.put('/column-permissions/:id', async (req, res) => {
  const { table_name, column_name, levels = [], positions = [], roles = [], exceptions = [] } = req.body;
  const pid = req.params.id;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const cp = await client.query(
      'UPDATE column_permissions SET table_name=$1, column_name=$2 WHERE id=$3 AND deleted_at IS NULL RETURNING *',
      [table_name, column_name, pid]
    );
    if (cp.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Not found' }); }
    await client.query('DELETE FROM permission_levels WHERE permission_id=$1', [pid]);
    await client.query('DELETE FROM permission_positions WHERE permission_id=$1', [pid]);
    await client.query('DELETE FROM permission_roles WHERE permission_id=$1', [pid]);
    await client.query('DELETE FROM permission_exceptions WHERE permission_id=$1', [pid]);
    for (const level of levels) {
      await client.query('INSERT INTO permission_levels (permission_id, level) VALUES ($1,$2)', [pid, level]);
    }
    for (const pos of positions) {
      await client.query('INSERT INTO permission_positions (permission_id, position) VALUES ($1,$2)', [pid, pos]);
    }
    for (const role of roles) {
      await client.query('INSERT INTO permission_roles (permission_id, role) VALUES ($1,$2)', [pid, role]);
    }
    for (const ex of exceptions) {
      await client.query('INSERT INTO permission_exceptions (permission_id, email) VALUES ($1,$2)', [pid, ex]);
    }
    await client.query('COMMIT');
    clearPermissionCache();
    res.json(cp.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.delete('/column-permissions/:id', async (req, res) => {
  try {
    await pool.query('UPDATE column_permissions SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND deleted_at IS NULL', [req.params.id]);
    clearPermissionCache();
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== exception_rules & action_rules check ====================

router.get('/my-slices', async (req, res) => {
  const user = req.user;
  const { checkPermission } = require('../helpers/permissionHelper');
  try {
    const result = await pool.query('SELECT DISTINCT name FROM exception_rules');
    const slices = result.rows.map(r => r.name);
    const permissionsMap = {};
    for (const sliceName of slices) {
      permissionsMap[sliceName] = await checkPermission('exception_rules', sliceName, user);
    }
    res.json(permissionsMap);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/my-action-permissions', async (req, res) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const rulesResult = await pool.query('SELECT * FROM action_rules');
    const rules = rulesResult.rows;

    const match = (allowedStr, userVal) => {
      if (!allowedStr || !userVal) return false;
      const cleanVal = String(userVal).trim().replace(/^\[|\]$/g, '').toLowerCase();
      const allowed = (Array.isArray(allowedStr) ? allowedStr : allowedStr.split(','))
        .map(s => String(s).trim().replace(/^\[|\]$/g, '').toLowerCase());
      return allowed.includes(cleanVal);
    };

    const permissions = {};

    for (const rule of rules) {
      const rawActionId = (rule.action_id || '').trim();
      if (!rawActionId) continue;

      let hasAccess = false;
      if (rule.display === false || String(rule.display).toLowerCase() === 'false') {
        hasAccess = false;
      } else if (user.role && user.role.toUpperCase() === 'SUPER ADMIN') {
        hasAccess = true;
      } else {
        const exceptions = rule.exceptions ? rule.exceptions.split(',').map(s => s.trim()) : [];
        const levels = rule.levels ? rule.levels.split(',').map(s => s.trim()) : [];
        const positions = rule.positions ? rule.positions.split(',').map(s => s.trim()) : [];
        const roles = rule.roles ? rule.roles.split(',').map(s => s.trim()) : [];

        if (match(rule.exceptions, user.email) || match(rule.exceptions, user.employee_id) || match(rule.exceptions, user.username)) hasAccess = true;
        else if (match(rule.roles, user.role)) hasAccess = true;
        else if (rule.roles && (Array.isArray(rule.roles) ? rule.roles : rule.roles.split(',')).some(r => {
          const clean = r.trim().toLowerCase();
          return clean === '[requester]' || clean === '[sr_creater]' || clean === 'requester' || clean === 'sr_creater';
        })) hasAccess = true;
        else if (match(rule.levels, user.employee_level)) hasAccess = true;
        else if (match(rule.positions, user.position)) hasAccess = true;
        else if (exceptions.length === 0 && levels.length === 0 && positions.length === 0 && roles.length === 0) {
          hasAccess = true;
        }
      }

      // Detect CRUD action_id format: add_viewname, edit_viewname, delete_viewname
      const crudMatch = rawActionId.match(/^(add|edit|delete)_(.+)$/i);
      if (crudMatch) {
        const verb = crudMatch[1].toLowerCase();      // 'add', 'edit', 'delete'
        const viewSuffix = crudMatch[2].toLowerCase(); // e.g. 'employee', 'payment'

        if (!permissions[verb]) permissions[verb] = {};

        // Map the view_name column: it may differ from suffix (e.g. multi-view rules)
        let views = [viewSuffix];
        if (rule.view_name) {
          views = rule.view_name.split(',').map(v => v.trim().replace(/^\[|\]$/g, '').toLowerCase());
        }

        const childTables = ['payment', 'invoice', 'mtr', 'service', 'asset', 'contract', 'target_table', 'assigned_task'];
        for (const view of views) {
          if (view === viewSuffix) {
            if (permissions[verb][view] !== true) {
              permissions[verb][view] = hasAccess;
            }
            const contextKey = `${viewSuffix}@${view}`;
            if (permissions[verb][contextKey] !== true) {
              permissions[verb][contextKey] = hasAccess;
            }
          } else {
            // For child tables, store under viewSuffix (e.g., 'payment') instead of view (e.g., 'request')
            // to avoid polluting parent view permissions and to enable direct child editing.
            if (childTables.includes(viewSuffix)) {
              if (permissions[verb][viewSuffix] !== true) {
                permissions[verb][viewSuffix] = hasAccess;
              }
            } else {
              if (permissions[verb][view] !== true) {
                permissions[verb][view] = hasAccess;
              }
            }
            const contextKey = `${viewSuffix}@${view}`;
            if (permissions[verb][contextKey] !== true) {
              permissions[verb][contextKey] = hasAccess;
            }
          }
        }
      } else {
        // Custom action (e.g. ACT-REQUEST-03) — use action_id as key directly
        const actionId = rawActionId.toLowerCase();

        let views = ['*'];
        if (rule.view_name) {
          views = rule.view_name.split(',').map(v => v.trim().replace(/^\[|\]$/g, '').toLowerCase());
        }

        if (!permissions[actionId]) permissions[actionId] = {};

        for (const view of views) {
          if (permissions[actionId][view] === true) continue;
          permissions[actionId][view] = hasAccess;
        }
      }
    }

    res.json(permissions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/my-columns', async (req, res) => {
  const user = req.user;
  
  // If Super Admin, bypass all column restrictions (all columns allowed)
  if (user.role && user.role.toUpperCase() === 'SUPER ADMIN') {
    return res.json({});
  }

  try {
    // Fetch all column permissions and their associations
    const cpResult = await pool.query('SELECT * FROM column_permissions WHERE deleted_at IS NULL');
    const cols = cpResult.rows;

    const levelsResult = await pool.query('SELECT * FROM permission_levels WHERE deleted_at IS NULL');
    const positionsResult = await pool.query('SELECT * FROM permission_positions WHERE deleted_at IS NULL');
    const rolesResult = await pool.query('SELECT * FROM permission_roles WHERE deleted_at IS NULL');
    const exceptionsResult = await pool.query('SELECT * FROM permission_exceptions WHERE deleted_at IS NULL');

    // Group relations by permission_id
    const levelsMap = {};
    levelsResult.rows.forEach(r => {
      if (!levelsMap[r.permission_id]) levelsMap[r.permission_id] = [];
      levelsMap[r.permission_id].push(r.level);
    });

    const positionsMap = {};
    positionsResult.rows.forEach(r => {
      if (!positionsMap[r.permission_id]) positionsMap[r.permission_id] = [];
      positionsMap[r.permission_id].push(r.position);
    });

    const rolesMap = {};
    rolesResult.rows.forEach(r => {
      if (!rolesMap[r.permission_id]) rolesMap[r.permission_id] = [];
      rolesMap[r.permission_id].push(r.role);
    });

    const exceptionsMap = {};
    exceptionsResult.rows.forEach(r => {
      if (!exceptionsMap[r.permission_id]) exceptionsMap[r.permission_id] = [];
      exceptionsMap[r.permission_id].push(r.email);
    });

    const deniedColumns = {};

    const match = (allowedArr, userVal) => {
      if (!allowedArr || !userVal) return false;
      const cleanVal = String(userVal).trim().replace(/^\[|\]$/g, '').toLowerCase();
      return allowedArr.map(s => String(s).trim().replace(/^\[|\]$/g, '').toLowerCase()).includes(cleanVal);
    };

    for (const col of cols) {
      const pid = col.id;
      const allowedLevels = levelsMap[pid] || [];
      const allowedPositions = positionsMap[pid] || [];
      const allowedRoles = rolesMap[pid] || [];
      const allowedExceptions = exceptionsMap[pid] || [];

      // If no permission criteria is defined for this column, it is allowed by default.
      if (allowedLevels.length === 0 && allowedPositions.length === 0 && allowedRoles.length === 0 && allowedExceptions.length === 0) {
        continue;
      }

      // Check if user matches any criteria
      let hasAccess = false;
      if (match(allowedExceptions, user.email) || match(allowedExceptions, user.employee_id) || match(allowedExceptions, user.username)) hasAccess = true;
      else if (match(allowedRoles, user.role)) hasAccess = true;
      else if (match(allowedLevels, user.employee_level)) hasAccess = true;
      else if (match(allowedPositions, user.position)) hasAccess = true;

      if (!hasAccess) {
        if (!deniedColumns[col.table_name]) {
          deniedColumns[col.table_name] = [];
        }
        deniedColumns[col.table_name].push(col.column_name);
      }
    }

    res.json(deniedColumns);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/check-action/:actionId', async (req, res) => {
  const { actionId } = req.params;
  const user = req.user; // from authenticate middleware
  const { checkPermission } = require('../helpers/permissionHelper');
  
  const hasAccess = await checkPermission('action_rules', actionId, user);
  res.json({ hasAccess });
});

router.get('/check-slice/:sliceName', async (req, res) => {
  const { sliceName } = req.params;
  const user = req.user;
  const { checkPermission } = require('../helpers/permissionHelper');
  
  const hasAccess = await checkPermission('exception_rules', sliceName, user);
  res.json({ hasAccess });
});

module.exports = router;
