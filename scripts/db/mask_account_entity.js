const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  try {
    const myCompanies = await pool.query('SELECT my_company_id FROM "my_company" ORDER BY my_company_id');
    const myCompIds = myCompanies.rows.map(r => r.my_company_id);
    if (myCompIds.length === 0) {
      console.log('No my_company records found. Cannot mask company_entity.');
      return;
    }

    const accounts = await pool.query('SELECT account_id FROM "account"');
    for (let i = 0; i < accounts.rows.length; i++) {
      const targetId = myCompIds[i % myCompIds.length];
      await pool.query('UPDATE "account" SET company_entity = $1 WHERE account_id = $2', [targetId, accounts.rows[i].account_id]);
    }
    console.log('Masked company_entity in account with valid my_company IDs.');
  } catch (err) {
    console.error('Masking failed:', err);
  } finally {
    pool.end();
  }
}

main();

