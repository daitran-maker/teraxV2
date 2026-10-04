require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgres://crc_user:crc2026@100.70.140.42:9999/crc_db'
});

async function run() {
  try {
    const result = await pool.query(
      "UPDATE payment SET payment_status = 'Draft' WHERE payment_status = 'Pending' OR payment_status = 'Pending payment' OR payment_status IS NULL RETURNING payment_id"
    );
    console.log(`✅ Updated ${result.rowCount} payment(s) to Draft`);
    if (result.rows.length > 0) {
      result.rows.slice(0, 20).forEach(r => console.log('  -', r.payment_id));
      if (result.rowCount > 20) console.log(`  ...and ${result.rowCount - 20} more`);
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await pool.end();
  }
}

run();
