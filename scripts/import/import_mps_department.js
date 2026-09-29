const fs = require('fs');
const { Pool } = require('pg');
require('dotenv').config();

const DRY_RUN = false; // Set to false to perform the actual import

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`DEPARTMENT IMPORT — DRY_RUN=${DRY_RUN}`);
  console.log('='.repeat(60));

  console.log('\nReading mymps.json...');
  let raw;
  if (fs.existsSync('data/mymps.json')) {
    raw = fs.readFileSync('data/mymps.json', 'utf8');
  } else if (fs.existsSync('mymps.json')) {
    raw = fs.readFileSync('mymps.json', 'utf8');
  } else {
    throw new Error('Could not find mymps.json!');
  }
  const mymps = JSON.parse(raw);
  const deptRows = mymps.tables['DEPARTMENT']?.rows || [];
  console.log(`Total MPS departments: ${deptRows.length}`);

  // Fetch valid company IDs from DB to ensure integrity
  const compRes = await pool.query('SELECT my_company_id FROM my_company');
  const validCompanyIds = new Set(compRes.rows.map(r => r.my_company_id));

  // Build mapped rows
  const mapped = deptRows.map(r => {
    // DEPARTMENT ID in MPS: "Technical", "Finance", "Sale", etc.
    // In employee table, ID__DEPARTMENT is used. Let's make sure the ID matches.
    // Sometimes it's a number like "1", "2", or name like "Technical"
    return {
      department_id: String(r.ID),
      department_name: r.NAME || r.DEPARTMENT_NAME || String(r.ID),
      manager_email: r.MANAGER__EMPLOYEE || null, // Can resolve later if needed
      company_id: r.MY_COMPANY && validCompanyIds.has(String(r.MY_COMPANY)) ? String(r.MY_COMPANY) : null,
      created_by: 'mps_import',
      created_date: r.CREATED_DATE ? new Date(r.CREATED_DATE) : new Date(),
      updated_by: null,
      updated_date: r.UPDATED_DATE ? new Date(r.UPDATED_DATE) : null,
      log: r.OLD_ID ? `MPS_OLD_ID:${r.OLD_ID}` : null
    };
  });

  console.log(`\n===== SUMMARY =====`);
  console.log(`Total to INSERT: ${mapped.length}`);

  if (DRY_RUN) {
    console.log('\n⚠️  DRY_RUN=true — No DB changes made.');
    await pool.end();
    return;
  }

  // ===== ACTUAL IMPORT =====
  console.log('\n🔴 TRUNCATING department table...');
  if (process.env.NO_TRUNCATE === 'true') {
    console.log('Skipping truncate for: department CASCADE');
  } else {
    await pool.query('TRUNCATE TABLE department CASCADE');
  }
  console.log('✅ Truncated.');

  console.log('\n📥 Inserting departments...');
  let inserted = 0;
  for (const r of mapped) {
    try {
      await pool.query(`
        INSERT INTO department (
          department_id, department_name, manager_email, company_id,
          created_by, created_date, updated_by, updated_date, log
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9
        ) ON CONFLICT (department_id) DO NOTHING
      `, [
        r.department_id, r.department_name, r.manager_email, r.company_id,
        r.created_by, r.created_date, r.updated_by, r.updated_date, r.log
      ]);
      inserted++;
    } catch (e) {
      console.error(`  ❌ Failed to insert department ${r.department_name} (${r.department_id}):`, e.message);
    }
  }

  console.log(`\n✅ DONE: ${inserted}/${mapped.length} departments inserted.`);
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
