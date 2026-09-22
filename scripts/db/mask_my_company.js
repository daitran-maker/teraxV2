const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query(`UPDATE my_company SET company_shortname = 'My Company ' || left(my_company_id::text, 6)`)
  .then(() => console.log('Masked my_company shortnames.'))
  .catch(console.log)
  .finally(() => pool.end());
