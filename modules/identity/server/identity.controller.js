const express = require('express');
const authRouter = express.Router();
const permissionsRouter = express.Router();
const service = require('./identity.service');
const repo = require('./identity.repository');
const pool = require('../../../server/db');
const { checkPermission, clearPermissionCache } = require('../../../server/helpers/permissionHelper');
const v = require('./identity.validation');

// ==================== AUTH CONTROLLER ====================

/** Respond with a safe error: AuthError messages are shown, everything else is generic. */
function sendAuthError(res, err, fallbackStatus = 500) {
  if (err && err.expose) {
    return res.status(err.status || 401).json({ error: err.message });
  }
  console.error('[Auth] Unexpected error:', err);
  return res.status(fallbackStatus).json({ error: 'Lỗi hệ thống. Vui lòng thử lại sau.' });
}

// POST /api/auth/login
authRouter.post('/login', async (req, res) => {
  try {
    const body = v.parseOrReject(v.loginSchema, req.body, res);
    if (!body) return;

    if (body.credential) {
      const result = await service.loginWithGoogle(body.credential);
      return res.json(result);
    }

    const identifier = (body.login_id || body.username || body.email || '').trim();
    const result = await service.loginWithPassword(identifier, body.password);
    res.json(result);
  } catch (err) {
    sendAuthError(res, err, 401);
  }
});

// POST /api/auth/google-login
authRouter.post('/google-login', async (req, res) => {
  try {
    const body = v.parseOrReject(v.googleLoginSchema, req.body, res);
    if (!body) return;
    const result = await service.loginWithGoogle(body.credential);
    res.json(result);
  } catch (err) {
    sendAuthError(res, err, 401);
  }
});

function getTokenFromReq(req) {
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) return authHeader.split(' ')[1];
  return req.query.token || null;
}

function requireCurrentToken(req, res) {
  const token = getTokenFromReq(req);
  if (!token || typeof token !== 'string') {
    res.status(401).json({ error: 'Auth token missing' });
    return null;
  }
  const decoded = service.verifyToken(token);
  if (!decoded) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return null;
  }
  return decoded;
}

// GET /api/auth/me
authRouter.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.query.token;
    if (!token || typeof token !== 'string') return res.status(401).json({ error: 'Auth token missing' });

    const decoded = service.verifyToken(token);
    if (!decoded) return res.status(401).json({ error: 'Invalid or expired token' });

    const user = await repo.findEmployeeForAuth(decoded.employee_id || decoded.email || decoded.username);
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      employee_id: user.employee_id,
      username: user.username,
      email: user.email,
      full_name: user.full_name,
      nick_name: user.nick_name,
      role: user.role,
      employee_level: user.employee_level,
      position: user.position,
      company_id: user.company_id,
      department_id: user.department_id,
      avatar: user.avatar
    });
  } catch (err) {
    sendAuthError(res, err);
  }
});

// GET /api/auth/switch-users  (Super Admin, or a session started by a Super Admin)
authRouter.get('/switch-users', async (req, res) => {
  const decoded = requireCurrentToken(req, res);
  if (!decoded) return;
  if (!service.canSwitchUsers(decoded)) {
    return res.status(403).json({ error: 'Chỉ Super Admin mới được chuyển đổi người dùng.' });
  }

  try {
    const users = await service.getSwitchUsers();
    res.json({ data: users });
  } catch (err) {
    console.error('Switch users list error:', err);
    res.status(500).json({ error: 'Could not load users.' });
  }
});

// POST /api/auth/switch-user  (Super Admin, or a session started by a Super Admin)
authRouter.post('/switch-user', async (req, res) => {
  const decoded = requireCurrentToken(req, res);
  if (!decoded) return;
  if (!service.canSwitchUsers(decoded)) {
    return res.status(403).json({ error: 'Chỉ Super Admin mới được chuyển đổi người dùng.' });
  }

  const body = v.parseOrReject(v.switchUserSchema, req.body, res, 'Missing employee_id.');
  if (!body) return;

  try {
    const result = await service.switchUser(body.employee_id, decoded);
    res.json(result);
  } catch (err) {
    if (err && err.expose) return res.status(err.status || 500).json({ error: err.message });
    console.error('Switch user error:', err);
    res.status(500).json({ error: 'Could not switch user.' });
  }
});

// POST /api/auth/change-password
authRouter.post('/change-password', async (req, res) => {
  try {
    const user = req.user || requireCurrentToken(req, res);
    if (!user) return;

    const body = v.parseOrReject(v.changePasswordSchema, req.body, res);
    if (!body) return;
    const oldPassword = body.oldPassword || body.old_password;
    const newPassword = body.newPassword || body.new_password;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: 'Vui lòng cung cấp mật khẩu cũ và mật khẩu mới.' });
    }

    await service.changePassword(user.employee_id, oldPassword, newPassword);
    res.json({ success: true, message: 'Đổi mật khẩu thành công.' });
  } catch (err) {
    if (err && err.expose) return res.status(err.status === 401 ? 400 : (err.status || 400)).json({ error: err.message });
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Lỗi hệ thống. Vui lòng thử lại sau.' });
  }
});

// GET /api/auth/magic-login  (dedicated short-lived token with purpose = "magic")
authRouter.get('/magic-login', async (req, res) => {
  const q = v.parseOrReject(v.magicQuerySchema, req.query, res, 'Magic link token missing');
  if (!q) return;

  try {
    const decoded = service.verifyMagicToken(q.token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid or expired magic link' });
    }

    const user = await repo.findEmployeeForAuth(decoded.email);
    if (!user || user.status === 'Inactive' || user.app_user_enabled === false) {
      return res.status(401).json({ error: 'Invalid or expired magic link' });
    }

    const authToken = service.createAuthToken(user);
    res.json({
      message: 'Magic Link login successful',
      token: authToken,
      user: {
        employee_id: user.employee_id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        employee_level: user.employee_level,
        position: user.position,
        department_id: user.department_id,
        company_id: user.company_id
      }
    });
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired magic link' });
  }
});

// GET /api/auth/google/sso-callback  (token is HMAC-signed by the CMS, bound to this host, single-use)
authRouter.get('/google/sso-callback', async (req, res) => {
  const q = v.ssoQuerySchema.safeParse(req.query || {});
  if (!q.success) {
    return res.status(400).send('<h3>SSO Token missing</h3>');
  }

  try {
    const targetEmail = service.verifySsoToken(q.data.sso_token, q.data.sso_sig, req.hostname);

    const user = await repo.findEmployeeForAuth(targetEmail);
    if (!user || (user.status && user.status !== 17 && user.status !== '17' && user.status !== 'Active') || user.app_user_enabled === false) {
      return res.status(401).send(`
        <div style="font-family: sans-serif; text-align: center; padding: 50px;">
          <h2 style="color: #EF4444;">Tài Khoản Chưa Được Cấp Quyền</h2>
          <p>Email <strong>${v.escapeHtml(targetEmail)}</strong> chưa được tạo trong hệ thống của công ty này.</p>
          <a href="/login.html" style="color: #2563EB;">Quay lại trang đăng nhập</a>
        </div>
      `);
    }

    const authToken = service.createAuthToken(user);
    const userPayload = encodeURIComponent(JSON.stringify({
      employee_id: user.employee_id,
      username: user.username,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      employee_level: user.employee_level,
      position: user.position,
      company_id: user.company_id,
      department_id: user.department_id
    }));
    res.redirect(`/#token=${encodeURIComponent(authToken)}&user=${userPayload}`);
  } catch (err) {
    if (err && err.expose) {
      return res.status(err.status || 401).send(`<h3>Lỗi xác thực SSO: ${v.escapeHtml(err.message)}</h3>`);
    }
    console.error('SSO Callback error:', err);
    res.status(500).send('<h3>Lỗi xác thực SSO.</h3>');
  }
});

// ==================== PERMISSIONS CONTROLLER ====================

// GET /api/permissions/column-permissions
permissionsRouter.get('/column-permissions', async (req, res) => {
  try {
    const rows = await repo.getAllColumnPermissions();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/permissions/column-permissions/:id
permissionsRouter.get('/column-permissions/:id', async (req, res) => {
  try {
    const result = await repo.getColumnPermissionById(req.params.id);
    if (!result) return res.status(404).json({ error: 'Not found' });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/permissions/column-permissions
permissionsRouter.post('/column-permissions', async (req, res) => {
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
    service.clearPermissions();
    res.status(201).json({ success: true, id: pid });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PUT /api/permissions/column-permissions/:id
permissionsRouter.put('/column-permissions/:id', async (req, res) => {
  const { table_name, column_name, levels = [], positions = [], roles = [], exceptions = [] } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'UPDATE column_permissions SET table_name = $1, column_name = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
      [table_name, column_name, req.params.id]
    );
    await client.query('DELETE FROM permission_levels WHERE permission_id = $1', [req.params.id]);
    await client.query('DELETE FROM permission_positions WHERE permission_id = $1', [req.params.id]);
    await client.query('DELETE FROM permission_roles WHERE permission_id = $1', [req.params.id]);
    await client.query('DELETE FROM permission_exceptions WHERE permission_id = $1', [req.params.id]);

    for (const level of levels) {
      await client.query('INSERT INTO permission_levels (permission_id, level) VALUES ($1,$2)', [req.params.id, level]);
    }
    for (const pos of positions) {
      await client.query('INSERT INTO permission_positions (permission_id, position) VALUES ($1,$2)', [req.params.id, pos]);
    }
    for (const role of roles) {
      await client.query('INSERT INTO permission_roles (permission_id, role) VALUES ($1,$2)', [req.params.id, role]);
    }
    for (const ex of exceptions) {
      await client.query('INSERT INTO permission_exceptions (permission_id, email) VALUES ($1,$2)', [req.params.id, ex]);
    }
    await client.query('COMMIT');
    service.clearPermissions();
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// DELETE /api/permissions/column-permissions/:id
permissionsRouter.delete('/column-permissions/:id', async (req, res) => {
  try {
    await pool.query('UPDATE column_permissions SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1', [req.params.id]);
    service.clearPermissions();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/permissions/exception-rules
permissionsRouter.get('/exception-rules', async (req, res) => {
  try {
    const rules = await repo.getAllExceptionRules();
    res.json(rules);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/permissions/my-slices
permissionsRouter.get('/my-slices', async (req, res) => {
  const user = req.user;
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

// GET /api/permissions/my-action-permissions
permissionsRouter.get('/my-action-permissions', async (req, res) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const rulesResult = await pool.query('SELECT * FROM action_rules ORDER BY id ASC');
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
      const crudMatch = rawActionId.match(/^(add|edit|delete|hard_delete)_(.+)$/i);
      if (crudMatch) {
        const verb = crudMatch[1].toLowerCase();      // 'add', 'edit', 'delete'
        const viewSuffix = crudMatch[2].toLowerCase(); // e.g. 'employee', 'payment', 'request'

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
            if (childTables.includes(viewSuffix)) {
              if (permissions[verb][viewSuffix] !== true) {
                permissions[verb][viewSuffix] = hasAccess;
              }
            } else {
              if (permissions[verb][view] !== true) {
                permissions[verb][view] = hasAccess;
              }
              // Also populate viewSuffix (e.g., 'request') when rule is for virtual views like 'my_request'
              if (permissions[verb][viewSuffix] !== true) {
                permissions[verb][viewSuffix] = hasAccess;
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

// GET /api/permissions/my-columns
permissionsRouter.get('/my-columns', async (req, res) => {
  const user = req.user;

  // If Super Admin, bypass all column restrictions (all columns allowed)
  if (user && user.role && user.role.toUpperCase() === 'SUPER ADMIN') {
    return res.json({});
  }

  try {
    const cpResult = await pool.query('SELECT * FROM column_permissions WHERE deleted_at IS NULL');
    const cols = cpResult.rows;

    const levelsResult = await pool.query('SELECT * FROM permission_levels WHERE deleted_at IS NULL');
    const positionsResult = await pool.query('SELECT * FROM permission_positions WHERE deleted_at IS NULL');
    const rolesResult = await pool.query('SELECT * FROM permission_roles WHERE deleted_at IS NULL');
    const exceptionsResult = await pool.query('SELECT * FROM permission_exceptions WHERE deleted_at IS NULL');

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

      if (allowedLevels.length === 0 && allowedPositions.length === 0 && allowedRoles.length === 0 && allowedExceptions.length === 0) {
        continue;
      }

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

// GET /api/permissions/check-action/:actionId
permissionsRouter.get('/check-action/:actionId', async (req, res) => {
  const { actionId } = req.params;
  const user = req.user;
  const hasAccess = await checkPermission('action_rules', actionId, user);
  res.json({ hasAccess });
});

// GET /api/permissions/check-slice/:sliceName
permissionsRouter.get('/check-slice/:sliceName', async (req, res) => {
  const { sliceName } = req.params;
  const user = req.user;
  const hasAccess = await checkPermission('exception_rules', sliceName, user);
  res.json({ hasAccess });
});

module.exports = {
  authRouter,
  permissionsRouter
};
