const jwt = require('jsonwebtoken');
const pool = require('../../db');

const JWT_SECRET = process.env.JWT_SECRET;

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  let token;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query.token) {
    token = req.query.token;
  }

  if (!token) return res.status(401).json({ error: 'Auth token missing' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;

    if (decoded && (!decoded.employee_id || decoded.employee_id === 'system' || decoded.employee_id.includes('@'))) {
      const searchKey = decoded.employee_id || decoded.email || decoded.username;
      if (searchKey) {
        try {
          const empRes = await pool.query(
            'SELECT employee_id FROM employee WHERE (LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($1) OR LOWER(employee_id) = LOWER($1)) AND deleted_at IS NULL LIMIT 1',
            [searchKey]
          );
          if (empRes.rows.length > 0) {
            req.user.employee_id = empRes.rows[0].employee_id;
          }
        } catch (dbErr) {
          console.error('[IdentityMiddleware] Error resolving employee_id:', dbErr.message);
        }
      }
    }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

module.exports = {
  authenticate
};
