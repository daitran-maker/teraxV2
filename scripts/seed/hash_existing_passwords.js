const pool = require('./server/db');
const bcrypt = require('bcryptjs');

async function hashPasswords() {
  console.log('Starting password hash migration...');
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT email, independent_id FROM EMPLOYEE WHERE independent_id IS NOT NULL');
    console.log(`Found ${res.rows.length} employees.`);

    for (const row of res.rows) {
      if (row.independent_id.startsWith('$2a$') || row.independent_id.startsWith('$2b$')) {
        console.log(`Skipping ${row.email}, already hashed.`);
        continue;
      }
      
      const hashed = await bcrypt.hash(row.independent_id, 10);
      await client.query('UPDATE EMPLOYEE SET independent_id = $1 WHERE email = $2', [hashed, row.email]);
      console.log(`Updated ${row.email}`);
    }
    console.log('Migration complete.');
  } catch (err) {
    console.error('Error during migration:', err);
  } finally {
    client.release();
    pool.end();
  }
}

hashPasswords();
