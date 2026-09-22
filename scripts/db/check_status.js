require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.query("SELECT username, email, status, app_user_enabled FROM employee WHERE username = 'leeanh100222'").then(res => {
  console.table(res.rows);
  pool.end();
});
