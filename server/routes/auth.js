const express = require('express');
const router = express.Router();
const pool = require('../db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const { pushLoginToCMS } = require('../helpers/cmsSeats');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('FATAL ERROR: JWT_SECRET is not defined in environment variables.');
}

const CLIENT_ID = '57927835497-1sv59lihil921e8cg3vpp1fr7oeef7pc.apps.googleusercontent.com';
const client = new OAuth2Client(CLIENT_ID);

/**
 * Generate JWT token for user
 */
function createAuthToken(user) {
  return jwt.sign(
    {
      employee_id: user.employee_id,
      username: user.username,
      email: user.email,
      role: user.role,
      employee_level: user.employee_level,
      position: user.position,
      company_id: user.company_id,
      department_id: user.department_id,
      full_name: user.full_name
    },
    JWT_SECRET,
    { expiresIn: '365d' }
  );
}

function getTokenFromReq(req) {
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) return authHeader.split(' ')[1];
  return req.query.token || null;
}

function requireCurrentToken(req, res) {
  const token = getTokenFromReq(req);
  if (!token) {
    res.status(401).json({ error: 'Auth token missing' });
    return null;
  }
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return null;
  }
}

/**
 * POST: /api/auth/login
 * Hybrid login using Username / Email / Employee ID and Password (or Google SSO fallback)
 */
router.post('/login', async (req, res) => {
  const { credential, login_id, password } = req.body;

  // Case A: Google SSO Credential
  if (credential) {
    try {
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: CLIENT_ID,
      });
      const payload = ticket.getPayload();
      const email = payload['email'];

      const result = await pool.query(
        `SELECT employee_id, username, full_name, nick_name, email, role, employee_level, position, department_id, company_id, password, app_user_enabled
         FROM EMPLOYEE 
         WHERE (LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($1)) AND (status = 17 OR status IS NULL)`,
        [email]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Account does not exist or has been locked.', error_code: 'login.error.not_found' });
      }

      const user = result.rows[0];

      // Check app_user_enabled — false means access revoked
      if (user.app_user_enabled === false) {
        return res.status(403).json({ error: 'Your account has been disabled. Please contact your administrator.', error_code: 'login.error.app_disabled' });
      }

      const token = createAuthToken(user);

      // Push login event to CMS async (non-blocking)
      const seatInfo = await pushLoginToCMS({
        email:     user.email,
        username:  user.username,
        full_name: user.full_name
      }).catch(() => null);

      return res.json({
        message: 'Đăng nhập thành công',
        token,
        user: {
          employee_id:    user.employee_id,
          username:       user.username,
          full_name:      user.full_name,
          nick_name:      user.nick_name,
          email:          user.email,
          role:           user.role,
          employee_level: user.employee_level,
          position:       user.position,
          company_id:     user.company_id,
          department_id:  user.department_id
        },
        ...(seatInfo?.over_limit ? {
          seat_warning: true,
          seat_count:   seatInfo.seat_count,
          seat_limit:   seatInfo.seat_limit
        } : {})
      });
    } catch (err) {
      console.error('Google Auth error:', err);
      return res.status(500).json({ error: 'Google authentication failed.', error_code: 'login.error.google_fail' });
    }
  }

  // Case B: Username / Email + Password Login
  const targetId = (login_id || req.body.email || req.body.username || '').trim();
  if (!targetId) {
    return res.status(400).json({ error: 'Vui lòng nhập Username hoặc Email đăng nhập.' });
  }

  try {
    const result = await pool.query(
      `SELECT employee_id, username, full_name, nick_name, email, role, employee_level, position, department_id, company_id, password, app_user_enabled
       FROM EMPLOYEE 
       WHERE (LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($1) OR LOWER(employee_id) = LOWER($1)) AND (status = 17 OR status IS NULL)`,
      [targetId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Account does not exist or has been locked.', error_code: 'login.error.not_found' });
    }

    const user = result.rows[0];

    // Check app_user_enabled — false means access revoked
    if (user.app_user_enabled === false) {
      return res.status(403).json({ error: 'Your account has been disabled. Please contact your administrator.', error_code: 'login.error.app_disabled' });
    }

    // Password verification if password is set on user
    if (password && user.password) {
      const isMatch = await bcrypt.compare(password, user.password).catch(() => false);
      const isPlainMatch = user.password === password;
      if (!isMatch && !isPlainMatch) {
        return res.status(401).json({ error: 'Incorrect password.', error_code: 'login.error.wrong_password' });
      }
    }

    const token = createAuthToken(user);

    // Push login event to CMS async (non-blocking)
    const seatInfo = await pushLoginToCMS({
      email:     user.email,
      username:  user.username,
      full_name: user.full_name
    }).catch(() => null);

    return res.json({
      message: 'Đăng nhập thành công',
      token,
      user: {
        employee_id:    user.employee_id,
        username:       user.username,
        full_name:      user.full_name,
        nick_name:      user.nick_name,
        email:          user.email,
        role:           user.role,
        employee_level: user.employee_level,
        position:       user.position,
        company_id:     user.company_id,
        department_id:  user.department_id
      },
      ...(seatInfo?.over_limit ? {
        seat_warning: true,
        seat_count:   seatInfo.seat_count,
        seat_limit:   seatInfo.seat_limit
      } : {})
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Lỗi server khi xử lý đăng nhập.' });
  }
});

router.get('/switch-users', async (req, res) => {
  if (!requireCurrentToken(req, res)) return;

  try {
    const result = await pool.query(
      `SELECT employee_id, username, full_name, email, role, position, employee_level
       FROM EMPLOYEE
       WHERE (status = 17 OR status IS NULL)
         AND deleted_at IS NULL
         AND COALESCE(app_user_enabled, true) = true
       ORDER BY full_name NULLS LAST, employee_id`
    );

    res.json({ data: result.rows });
  } catch (err) {
    console.error('Switch users list error:', err);
    res.status(500).json({ error: 'Could not load users.' });
  }
});

router.post('/switch-user', async (req, res) => {
  if (!requireCurrentToken(req, res)) return;

  const { employee_id } = req.body || {};
  if (!employee_id) {
    return res.status(400).json({ error: 'Missing employee_id.' });
  }

  try {
    const result = await pool.query(
      `SELECT employee_id, username, full_name, nick_name, email, role, employee_level, position, department_id, company_id, app_user_enabled
       FROM EMPLOYEE
       WHERE employee_id = $1
         AND (status = 17 OR status IS NULL)
         AND deleted_at IS NULL`,
      [employee_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found or inactive.' });
    }

    const user = result.rows[0];
    if (user.app_user_enabled === false) {
      return res.status(403).json({ error: 'This account has been disabled.' });
    }

    const token = createAuthToken(user);
    res.json({
      token,
      user: {
        employee_id: user.employee_id,
        username: user.username,
        full_name: user.full_name,
        nick_name: user.nick_name,
        email: user.email,
        role: user.role,
        employee_level: user.employee_level,
        position: user.position,
        company_id: user.company_id,
        department_id: user.department_id
      }
    });
  } catch (err) {
    console.error('Switch user error:', err);
    res.status(500).json({ error: 'Could not switch user.' });
  }
});

/**
 * POST: /api/auth/change-password
 * Change password for user
 */
router.post('/change-password', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Chưa đăng nhập.' });
  
  const token = authHeader.split(' ')[1];
  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Phiên làm việc hết hạn hoặc không hợp lệ.' });
  }

  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: 'Vui lòng cung cấp mật khẩu cũ và mật khẩu mới.' });
  }

  try {
    const userRes = await pool.query(
      `SELECT employee_id, password FROM EMPLOYEE WHERE employee_id = $1 AND (status = 17 OR status IS NULL)`,
      [decoded.employee_id]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy thông tin nhân viên.' });
    }

    const employee = userRes.rows[0];
    
    const isMatch = await bcrypt.compare(oldPassword, employee.password || '');
    if (!isMatch) {
      return res.status(400).json({ error: 'Mật khẩu cũ không chính xác.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(newPassword, salt);

    await pool.query(
      `UPDATE EMPLOYEE SET password = $2 WHERE employee_id = $1`,
      [employee.employee_id, hashed]
    );

    return res.json({ success: true, message: 'Đổi mật khẩu thành công!' });
  } catch (err) {
    console.error('Change password error:', err);
    return res.status(500).json({ error: 'Lỗi server khi đổi mật khẩu.' });
  }
});

/**
 * GET: /api/auth/magic-login
 * Instant Master Admin access token verification route
 */
router.get('/magic-login', async (req, res) => {
  const { token } = req.query;
  if (!token) {
    return res.status(400).json({ error: 'Magic link token missing' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const targetEmail = decoded.email;

    const result = await pool.query(
      `SELECT employee_id, username, full_name, email, role, employee_level, position, department_id, company_id
       FROM EMPLOYEE WHERE (LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($1) OR LOWER(employee_id) = LOWER($1))`,
      [targetEmail]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User for magic link not found' });
    }

    const user = result.rows[0];
    const authToken = createAuthToken(user);

    res.json({
      message: 'Magic Link login successful',
      token: authToken,
      user
    });
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired magic link' });
  }
});

/**
 * GET: /api/auth/google/sso-callback
 * Centralized Google SSO Callback handler
 */
router.get('/google/sso-callback', async (req, res) => {
  const { sso_token } = req.query;
  if (!sso_token) {
    return res.status(400).send('<h3>SSO Token missing</h3>');
  }

  try {
    const ssoData = JSON.parse(Buffer.from(sso_token, 'base64').toString('utf-8'));
    const targetEmail = ssoData.email;

    if (!targetEmail) {
      return res.status(400).send('<h3>Invalid SSO Payload</h3>');
    }

    const result = await pool.query(
      `SELECT employee_id, username, full_name, email, role, employee_level, position, department_id, company_id
       FROM EMPLOYEE 
       WHERE (LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($1)) AND (status = 17 OR status IS NULL)`,
      [targetEmail]
    );

    if (result.rows.length === 0) {
      return res.status(401).send(`
        <div style="font-family: sans-serif; text-align: center; padding: 50px;">
          <h2 style="color: #EF4444;">Tài Khoản Chưa Được Cấp Quyền</h2>
          <p>Email <strong>${targetEmail}</strong> chưa được tạo trong hệ thống của công ty này.</p>
          <a href="/login.html" style="color: #2563EB;">Quay lại trang đăng nhập</a>
        </div>
      `);
    }

    const user = result.rows[0];
    const authToken = createAuthToken(user);

    // Redirect to app index with Auth Token and User Info in URL hash
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
    console.error('SSO Callback error:', err);
    res.status(500).send(`<h3>Lỗi xác thực SSO: ${err.message}</h3>`);
  }
});

module.exports = router;
