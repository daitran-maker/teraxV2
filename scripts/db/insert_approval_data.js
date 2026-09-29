require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function insertData() {
  try {
    const res = await pool.query(`
      INSERT INTO "request" (
        request_id, 
        request_type, 
        requester, 
        description, 
        sr_status, 
        tier_1_approval, 
        tier_1_status, 
        sr_created_date, 
        created_by
      ) VALUES 
      (gen_random_uuid()::varchar, '1', 'cuong.ngo', 'Test Request for Approval 1', 'Pending Approval', 'leeanh100222', 'Pending', NOW(), 'cuong.ngo'),
      (gen_random_uuid()::varchar, '2', 'admin_hcm', 'Test Request for Approval 2', 'Pending Approval', 'leeanh100222', 'Pending', NOW(), 'admin_hcm')
      RETURNING request_id;
    `);
    console.log("Inserted request IDs:", res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
insertData();
