const fs = require('fs');
const { Pool } = require('pg');
require('dotenv').config();

const DRY_RUN = false; // Set to false to perform the actual import

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`OPERATION_PROGRAM IMPORT — DRY_RUN=${DRY_RUN}`);
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
  const rows = mymps.tables['OPERATION_PROGRAM']?.rows || [];
  console.log(`Total MPS operation programs: ${rows.length}`);

  // Build mapped rows
  const mapped = rows.map(r => ({
    oper_id: String(r.ID),
    expense_code: r.EXPENSE_CODE || null,
    expense_name: r.EXPENSE_NAME || null,
    expense_type: r.EXPENSE_TYPE || null,
    description: r.DESCRIPTION || null,
    created_by: 'mps_import',
    created_date: r.CREATED_DATE ? new Date(r.CREATED_DATE) : new Date(),
    updated_by: null,
    updated_date: r.UPDATED_DATE ? new Date(r.UPDATED_DATE) : null,
    log: r.OLD_ID ? `MPS_OLD_ID:${r.OLD_ID}` : null
  }));

  console.log(`\n===== SUMMARY =====`);
  console.log(`Total to INSERT: ${mapped.length}`);

  if (DRY_RUN) {
    console.log('\n⚠️  DRY_RUN=true — No DB changes made.');
    await pool.end();
    return;
  }

  // ===== ACTUAL IMPORT =====
  console.log('\n🔴 TRUNCATING operation_program table...');
  if (process.env.NO_TRUNCATE === 'true') {
    console.log('Skipping truncate for: operation_program CASCADE');
  } else {
    await pool.query('TRUNCATE TABLE operation_program CASCADE');
  }
  console.log('✅ Truncated.');

  console.log('\n📥 Inserting operation programs...');
  let inserted = 0;
  for (const r of mapped) {
    try {
      await pool.query(`
        INSERT INTO operation_program (
          oper_id, expense_code, expense_name, expense_type, description,
          created_by, created_date, updated_by, updated_date, log
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
        ) ON CONFLICT (oper_id) DO NOTHING
      `, [
        r.oper_id, r.expense_code, r.expense_name, r.expense_type, r.description,
        r.created_by, r.created_date, r.updated_by, r.updated_date, r.log
      ]);
      inserted++;
    } catch (e) {
      console.error(`  ❌ Failed to insert operation program ${r.expense_name} (${r.oper_id}):`, e.message);
    }
  }

  console.log(`\n✅ DONE: ${inserted}/${mapped.length} operation programs inserted.`);
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
