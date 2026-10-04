#!/usr/bin/env node
/**
 * QA helper - mint a short-lived (1h) JWT for an EXISTING employee in the DEV database.
 * Read-only DB lookup. Refuses to run unless DATABASE_URL host is localhost/127.0.0.1.
 *
 *   node scripts/qa/dev-token.js                 -> prefers an admin-like employee
 *   node scripts/qa/dev-token.js <employee_id>   -> specific employee
 * Prints only the token (so it can be captured: $env:TOKEN = node scripts/qa/dev-token.js).
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const host = new URL(process.env.DATABASE_URL).hostname;
if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
  console.error(`Refusing: DATABASE_URL host is "${host}", not local.`);
  process.exit(2);
}
if (!process.env.JWT_SECRET) { console.error('JWT_SECRET missing'); process.exit(2); }

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const id = process.argv[2];
    const q = id
      ? await pool.query('SELECT * FROM employee WHERE employee_id = $1 AND deleted_at IS NULL LIMIT 1', [id])
      : await pool.query(
          "SELECT * FROM employee WHERE deleted_at IS NULL ORDER BY (LOWER(COALESCE(role::text,'')) LIKE '%admin%') DESC, employee_id LIMIT 1"
        );
    const u = q.rows[0];
    if (!u) { console.error('No employee found'); process.exit(1); }
    console.log(
      jwt.sign(
        {
          employee_id: u.employee_id, username: u.username, email: u.email, role: u.role,
          employee_level: u.employee_level, position: u.position, company_id: u.company_id,
          department_id: u.department_id, full_name: u.full_name,
        },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      )
    );
  } finally {
    await pool.end();
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
