const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`)
  .then(res => {
    console.log(res.rows.map(r => r.table_name));
  })
  .finally(() => pool.end());
