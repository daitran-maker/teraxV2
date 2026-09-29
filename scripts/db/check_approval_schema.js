require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.query(`
  SELECT column_name, data_type, is_nullable 
  FROM information_schema.columns 
  WHERE table_name = 'approval';
`).then(res => {
  console.table(res.rows);
  pool.end();
}).catch(err => {
  console.error(err);
  pool.end();
});
