require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fixData() {
  try {
    const res = await pool.query(`
      UPDATE "request" 
      SET tier_1_approval = 'leeanh1002@gmail.com' 
      WHERE tier_1_approval = 'leeanh100222'
    `);
    console.log("Updated rows:", res.rowCount);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
fixData();
