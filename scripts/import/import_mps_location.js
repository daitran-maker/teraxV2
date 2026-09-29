/**
 * SCRIPT: Import MPS LOCATION → CRC my_location table
 * 
 * Chạy: node scripts/import/import_mps_location.js
 */

const fs = require('fs');
const { Pool } = require('pg');
require('dotenv').config();

const DRY_RUN = false; // Set to false to perform the actual import

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`LOCATION IMPORT — DRY_RUN=${DRY_RUN}`);
  console.log('='.repeat(60));

  // Read mymps.json
  console.log('\nReading mymps.json...');
  let raw;
  if (fs.existsSync('data/mymps.json')) {
    raw = fs.readFileSync('data/mymps.json', 'utf8');
  } else if (fs.existsSync('mymps.json')) {
    raw = fs.readFileSync('mymps.json', 'utf8');
  } else {
    throw new Error('Could not find mymps.json or data/mymps.json!');
  }
  const mymps = JSON.parse(raw);

  // 1. Build city details map
  const cityMap = {};
  if (mymps.tables['CITY']?.rows) {
    for (const row of mymps.tables['CITY'].rows) {
      cityMap[row.ID] = {
        name: row.NAME,
        code: row.CODE || row.NAME.substring(0, 3).toUpperCase(),
        countryId: row.IN__COUNTRY
      };
    }
  }

  // 2. Fetch location bases
  const locationBases = mymps.tables['LOCATION_BASE']?.rows || [];
  console.log(`Found ${locationBases.length} location bases in mymps.json`);

  // Helper mappings
  function getCompanyShortname(countryId) {
    if (countryId === 1) return 'VN-MPS';
    if (countryId === 10) return 'MM-MPS';
    if (countryId === 8) return 'KH-MPS';
    if (countryId === 4) return 'SG-MPS';
    if (countryId === 2) return 'THAI-MPS';
    return null;
  }

  function getAddress(cityName) {
    if (cityName === 'Hanoi') {
      return '2nd floor, 133 Thai Ha building, Dong Da Ward, Ha Noi, Vietnam';
    }
    if (cityName === 'Ho Chi Minh City') {
      return 'Tầng 4, Tòa nhà Diamond, Quận 1, TP. HCM';
    }
    if (cityName === 'Singapore') {
      return '36 Mount VernonRoad #02-19, Bartley Ridge Singapore';
    }
    if (cityName === 'Phnom Penh') {
      return 'No.22&24, St 281, Room No. 02, Sangkat Boeung Kok1, Khan Toulkork, Phnom Penh, Cambodia';
    }
    if (cityName === 'Yangon') {
      return 'Room 3, 5th Floor, Building No. 18 MICT Park New, Hlaing Township Yangon City, Myanmar';
    }
    return `${cityName}`;
  }

  // Map to target schema
  const mapped = [];
  for (const lb of locationBases) {
    const cityId = lb.PK__CITY;
    const city = cityMap[cityId];
    if (!city) {
      console.warn(`Warning: City with ID ${cityId} not found in CITY table.`);
      continue;
    }

    mapped.push({
      my_location_id: city.name, // City name acts as the unique location base string in employee records
      location_code: city.code,
      type: 'Office',
      address: getAddress(city.name),
      my_company: getCompanyShortname(city.countryId),
      responsible_employee: null,
      status: 'Active',
      created_by: 'mps_import',
      log: `imported_city_id:${cityId}`
    });
  }

  console.log(`\n===== SUMMARY =====`);
  console.log(`Total locations to INSERT: ${mapped.length}`);
  mapped.forEach((r, i) => console.log(`[${i}]`, JSON.stringify(r, null, 2)));

  if (DRY_RUN) {
    console.log('\n⚠️  DRY_RUN=true — No DB changes made.');
    await pool.end();
    return;
  }

  // ===== ACTUAL IMPORT =====
  console.log('\n🔴 TRUNCATING my_location table...');
  if (process.env.NO_TRUNCATE === 'true') {
    console.log('Skipping truncate for: my_location CASCADE');
  } else {
    await pool.query('TRUNCATE TABLE my_location CASCADE');
  }
  console.log('✅ Truncated.');

  console.log('\n📥 Inserting locations...');
  let inserted = 0;
  for (const r of mapped) {
    try {
      await pool.query(`
        INSERT INTO my_location (
          my_location_id, location_code, type, address,
          my_company, responsible_employee, status,
          created_by, log
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9
        ) ON CONFLICT (my_location_id) DO NOTHING
      `, [
        r.my_location_id, r.location_code, r.type, r.address,
        r.my_company, r.responsible_employee, r.status,
        r.created_by, r.log
      ]);
      inserted++;
    } catch (e) {
      console.error(`  ❌ Failed to insert location ${r.my_location_id}:`, e.message);
    }
  }

  console.log(`\n✅ DONE: ${inserted}/${mapped.length} locations successfully recovered.`);
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
