require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  try {
    const res = await pool.query(`
      SELECT id, action_id, view_name, display_name, roles, exceptions, display, description
      FROM action_rules 
      WHERE action_id ILIKE 'add%' OR action_id ILIKE 'edit%' OR action_id ILIKE 'delete%'
      ORDER BY action_id, view_name
    `);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
