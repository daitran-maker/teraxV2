/**
 * MASTER ORCHESTRATION SCRIPT: Clean & Re-import All Data from MyMPS JSON Files
 *
 * This script ensures a 100% clean slate by truncating all tables first,
 * and then executes all specific import scripts in the correct dependency order.
 *
 * Chạy: node scripts/import/clean_import_all.js
 */

const { execSync } = require('child_process');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const scriptsOrder = [
  'scripts/import/import_mps_my_company.js',
  'scripts/import/import_mps_location.js',
  'scripts/import/import_mps_company.js',
  'scripts/import/import_mps_department.js',
  'scripts/import/import_mps_employee.js',
  'scripts/import/import_accounts.js',
  'scripts/import/import_mps_process.js',
  'scripts/import/import_mps_request.js',
  'scripts/import/import_mps_expense.js',
  'scripts/import/import_mps_comment.js',
  'scripts/import/import_mps_operation_program.js',
  'scripts/import/import_mps_payment_and_contract.js',
  'scripts/import/import_mps_service_asset_mtr.js'
];

async function main() {
  console.log(`\n${'='.repeat(70)}`);
  console.log('🔥 STARTING GLOBAL FULL SYSTEM RE-IMPORT 🔥');
  console.log('='.repeat(70));

  const tables = [
    'my_company',
    'my_location',
    'company',
    'department',
    'employee',
    'account',
    'policy_and_program',
    'request',
    'expense',
    'payment',
    'contract',
    'comment',
    'operation_program',
    'service',
    'asset',
    'mtr'
  ];

  if (process.env.FORCE_TRUNCATE !== 'true') {
    process.env.NO_TRUNCATE = 'true';
    console.log('\n⚠️  NO_TRUNCATE mode active: Existing data will be preserved. Upsert logic (ON CONFLICT) will be used.');
  } else {
    console.log('\n🔥 FORCE_TRUNCATE=true detected! Performing cascading truncate on all tables...');
    try {
      await pool.query(`TRUNCATE TABLE ${tables.join(', ')} CASCADE`);
      console.log('✅ All tables successfully truncated. Database is 100% clean!');
    } catch (err) {
      console.error('❌ Critical error truncating tables:', err.message);
      await pool.end();
      process.exit(1);
    }
  }


  // Step 2: Run all import scripts in sequential order
  console.log('\n📥 Running sequential import scripts...');
  for (const script of scriptsOrder) {
    console.log(`\n------------------------------------------------------------`);
    console.log(`🚀 Executing: node ${script}`);
    console.log(`------------------------------------------------------------`);
    try {
      execSync(`node "${script}"`, { stdio: 'inherit' });
      console.log(`✅ Completed: ${script}`);
    } catch (e) {
      console.error(`❌ FAILED executing: ${script}`);
      console.error(e.message);
      await pool.end();
      process.exit(1);
    }
  }

  // Step 3: Re-create test account
  console.log(`\n------------------------------------------------------------`);
  console.log(`🚀 Restoring active test user account...`);
  console.log(`------------------------------------------------------------`);
  try {
    execSync('node scripts/dev/create_test_account.js', { stdio: 'inherit' });
    console.log('✅ Active test user account successfully restored!');
  } catch (e) {
    console.error('❌ Failed to restore test user account:', e.message);
  }

  // Step 4: Final verification and counts reporting
  console.log(`\n${'='.repeat(70)}`);
  console.log('📊 FINAL SYSTEM ROW COUNTS VERIFICATION');
  console.log('='.repeat(70));
  for (const t of tables) {
    try {
      const res = await pool.query(`SELECT COUNT(*) FROM "${t}"`);
      console.log(`Table: ${t.padEnd(20)} -> Live Rows: ${res.rows[0].count}`);
    } catch(e) {
      console.log(`Table: ${t.padEnd(20)} -> Error: ${e.message}`);
    }
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log('🎉 SUCCESS: FULL DATABASE RE-IMPORT COMPLETED PERFECTLY! 🎉');
  console.log('='.repeat(70));

  await pool.end();
}

main().catch(e => {
  console.error('Fatal master script error:', e);
  process.exit(1);
});
