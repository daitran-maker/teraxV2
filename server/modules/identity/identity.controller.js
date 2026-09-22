const express = require('express');
const authRouter = express.Router();
const permissionsRouter = express.Router();
const service = require('./identity.service');
const repo = require('./identity.repository');
const pool = require('../../db');

// ==================== AUTH CONTROLLER ====================

// POST /api/auth/login
authRouter.post('/login', async (req, res) => {
  try {
    const { credential, login_id, username, password } = req.body;

    if (credential) {
      const result = await service.loginWithGoogle(credential);
      return res.json(result);
    }

    const identifier = login_id || username;
    const result = await service.loginWithPassword(identifier, password);
    res.json(result);
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

// POST /api/auth/google-login
authRouter.post('/google-login', async (req, res) => {
  try {
    const { credential } = req.body;
    const result = await service.loginWithGoogle(credential);
    res.json(result);
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

// GET /api/auth/me
authRouter.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.query.token;
    if (!token) return res.status(401).json({ error: 'Auth token missing' });

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
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/change-password
authRouter.post('/change-password', async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { old_password, new_password } = req.body;
    await service.changePassword(user.employee_id, old_password, new_password);
    res.json({ success: true, message: 'Đổi mật khẩu thành công.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
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

module.exports = {
  authRouter,
  permissionsRouter
};
