const pool = require('../../server/db');

async function main() {
  try {
    const res = await pool.query("SELECT id, action_id, view_name, display_name FROM action_rules ORDER BY action_id, view_name");
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
