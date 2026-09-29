const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  try {
    await pool.query(`
      UPDATE invoice
      SET description = 'Masked invoice description ' || invoice_id::text
      WHERE description IS NOT NULL;
    `);
    console.log('Invoice descriptions masked.');
    
    await pool.query(`
      UPDATE contract
      SET description = 'Masked contract description ' || contract_id::text
      WHERE description IS NOT NULL;
    `);
    console.log('Contract descriptions masked.');
  } catch (e) {
    console.log(e);
  } finally {
    pool.end();
  }
}
main();
