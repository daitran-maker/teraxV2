const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query(`SELECT table_name FROM information_schema.tables WHERE table_name LIKE '%menu%' OR table_name LIKE '%column%' OR table_name LIKE '%action%'`)
  .then(res => console.log('Found tables:', res.rows.map(r => r.table_name)))
  .catch(console.log)
  .finally(() => pool.end());
