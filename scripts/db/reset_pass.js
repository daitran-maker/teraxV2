require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function resetPass() {
  const hash = '$2b$10$MAUamIWKu1qH4t.KSYLxxOv0jzJKXrvpA/2F2nCgHANIjnt4wcdsu';
  await pool.query("UPDATE employee SET password = $1 WHERE username = 'leeanh100222'", [hash]);
  console.log("Password reset successfully for leeanh100222 to abc123456");
  pool.end();
}
resetPass();
