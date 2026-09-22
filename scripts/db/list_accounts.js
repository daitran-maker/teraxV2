require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  try {
    const res = await pool.query("SELECT password FROM employee WHERE username = 'leeanh100222'");
    const hash = res.rows[0]?.password;
    if (!hash) {
      console.log('No password hash found for leeanh100222');
      return;
    }

    const testPasses = ['123456', '12345678', 'admin', 'admin123', 'leeanh', 'leeanh100222', 'TeraX123!', 'password', '123456789'];
    for (const pass of testPasses) {
      const match = await bcrypt.compare(pass, hash);
      if (match) {
        console.log(`✅ MATCHED PASSWORD for leeanh100222: "${pass}"`);
        return;
      }
    }
    console.log('❌ Password not in common test list.');
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

check();
