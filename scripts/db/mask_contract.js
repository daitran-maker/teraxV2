const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  try {
    await pool.query(`
      UPDATE contract
      SET contract_name_or_description = 'Masked Contract ' || contract_id::text,
          contractspood_no = 'MASKED-NO'
      WHERE contract_name_or_description IS NOT NULL OR contractspood_no IS NOT NULL;
    `);
    console.log('Contract masked successfully.');
  } catch (e) {
    console.log(e);
  } finally {
    pool.end();
  }
}
main();
