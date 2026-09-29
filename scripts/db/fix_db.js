const pool = require('./server/db');
const data = require('./action_cl_data.json');

async function fix() {
  try {
    await pool.query('UPDATE action_rules SET display_name = $1 WHERE action_id = $2', ['Change SR Owner', 'change_sr_owner']);
    for (const item of data) {
      const id = item['ACTION ID'];
      const dn = item['ACTION'] || '';
      const desc = item['DESCRIPTION'] || '';
      await pool.query('UPDATE action_rules SET display_name = $1, description = $2 WHERE action_id = $3', [dn, desc, id]);
    }
    console.log('Fixed');
  } catch(e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
fix();
