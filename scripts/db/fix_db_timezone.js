const pool = require('./server/db');

async function fixDB() {
  try {
    await pool.query("ALTER TABLE request ALTER COLUMN tier_1_update_date TYPE timestamp without time zone");
    await pool.query("ALTER TABLE request ALTER COLUMN tier_2_update_date TYPE timestamp without time zone");
    await pool.query("ALTER TABLE request ALTER COLUMN tier_3_update_date TYPE timestamp without time zone");
    console.log("Altered successfully");
  } catch (err) {
    console.log("Error:", err.message);
  } finally {
    pool.end();
  }
}

fixDB();
