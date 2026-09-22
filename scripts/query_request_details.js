const pool = require('../server/db');

async function run() {
  try {
    const res = await pool.query(`
      SELECT request_id, sr_status,
             tier_1_status, tier_2_status, tier_3_status
      FROM request 
      WHERE (tier_3_status = 'Approved' AND tier_2_status <> 'Approved')
         OR (tier_2_status = 'Approved' AND tier_1_status <> 'Approved')
    `);
    console.log("=== REQUESTS WITH BYPASSED TIERS ===");
    console.log("Count:", res.rows.length);
    res.rows.forEach(r => {
      console.log(JSON.stringify(r));
    });
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
