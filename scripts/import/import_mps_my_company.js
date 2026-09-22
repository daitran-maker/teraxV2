const fs = require('fs');
const { Pool } = require('pg');
require('dotenv').config();

const DRY_RUN = false; // Set to false to perform the actual import

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`MY_COMPANY IMPORT — DRY_RUN=${DRY_RUN}`);
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
  const companyRows = mymps.tables['MY_COMPANY']?.rows || [];
  console.log(`Total MPS my_companies: ${companyRows.length}`);

  const countryMap = {};
  if (mymps.tables['COUNTRY']?.rows) {
    for (const row of mymps.tables['COUNTRY'].rows) {
      countryMap[row.ID] = row.NAME;
    }
  }

  // Build mapped rows
  const mapped = companyRows.map(r => ({
    my_company_id: String(r.ID),
    company_shortname: r.COMPANY_SHORTNAME || null,
    company_fullname: r.COMPANY_FULLNAME || null,
    logo: null, // bytea
    tax_code: r.TAX_CODE || null,
    website: r.WEBSITE || null,
    address: r.ADDRESS || null,
    country: r.ID__COUNTRY ? (countryMap[r.ID__COUNTRY] || String(r.ID__COUNTRY)) : null,
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
  console.log('\n🔴 TRUNCATING my_company table...');
  if (process.env.NO_TRUNCATE === 'true') {
    console.log('Skipping truncate for: my_company CASCADE');
  } else {
    await pool.query('TRUNCATE TABLE my_company CASCADE');
  }
  console.log('✅ Truncated.');

  console.log('\n📥 Inserting my_companies...');
  let inserted = 0;
  for (const r of mapped) {
    try {
      await pool.query(`
        INSERT INTO my_company (
          my_company_id, company_shortname, company_fullname, logo,
          tax_code, website, address, country,
          created_by, created_date, updated_by, updated_date, log
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
        ) ON CONFLICT (my_company_id) DO NOTHING
      `, [
        r.my_company_id, r.company_shortname, r.company_fullname, r.logo,
        r.tax_code, r.website, r.address, r.country,
        r.created_by, r.created_date, r.updated_by, r.updated_date, r.log
      ]);
      inserted++;
    } catch (e) {
      console.error(`  ❌ Failed to insert my_company ${r.company_shortname} (${r.my_company_id}):`, e.message);
    }
  }

  console.log(`\n✅ DONE: ${inserted}/${mapped.length} my_companies inserted.`);
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
