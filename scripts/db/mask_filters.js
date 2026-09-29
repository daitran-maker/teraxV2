const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  try {
    await pool.query(`UPDATE my_product_and_service SET ps_name = 'Masked PS ' || psid::text WHERE ps_name IS NOT NULL;`);
    console.log('Masked my_product_and_service.ps_name.');

    // Removed contract.contractor because it's a numeric ID
    
    // Also mask department_name just to be completely safe
    await pool.query(`UPDATE department SET department_name = 'Masked Dept ' || department_id::text WHERE department_name NOT IN ('OPERATION', 'SALES AND MARKETING', 'FINANCE');`);
    console.log('Masked department_name.');
    
  } catch (e) {
    console.log(e);
  } finally {
    pool.end();
  }
}
main();
