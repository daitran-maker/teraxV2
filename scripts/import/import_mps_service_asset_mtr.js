const fs = require('fs');
const { Pool } = require('pg');
require('dotenv').config();

const DRY_RUN = false; // Set to false to perform actual import

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`SERVICE, ASSET, MTR IMPORT — DRY_RUN=${DRY_RUN}`);
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

  // Fetch active Request IDs from DB to ensure referential integrity if needed
  const reqRes = await pool.query('SELECT request_id FROM request');
  const validRequestIds = new Set(reqRes.rows.map(r => r.request_id));
  console.log(`Fetched ${validRequestIds.size} valid request IDs from DB.`);

  // Build employee UUID mapping
  const empRows = mymps.tables['EMPLOYEE']?.rows || [];
  const uuidToEmailMap = new Map();
  empRows.forEach(emp => {
    if (emp.ID && emp.EMAIL) {
      uuidToEmailMap.set(String(emp.ID).toUpperCase().trim(), emp.EMAIL.trim().toLowerCase());
    }
  });
  console.log(`Loaded ${uuidToEmailMap.size} employee UUID mappings.`);

  function resolveEmp(val) {
    if (!val) return null;
    const clean = String(val).toUpperCase().trim();
    if (uuidToEmailMap.has(clean)) {
      return uuidToEmailMap.get(clean);
    }
    return null;
  }

  // Helper mappings
  const currencyMap = {};
  mymps.tables['CURRENCY']?.rows.forEach(r => {
    currencyMap[r.ID] = r.SHORT_NAME;
  });

  const assetTypeMap = {};
  mymps.tables['ASSET_TYPE']?.rows.forEach(r => {
    assetTypeMap[r.ID] = r.NAME;
  });

  const assetStatusMap = {};
  mymps.tables['ASSET_STATUS']?.rows.forEach(r => {
    assetStatusMap[r.ID] = r.NAME;
  });

  const serviceTypeMap = {};
  mymps.tables['SERVICE_TYPE']?.rows.forEach(r => {
    serviceTypeMap[r.ID] = r.NAME;
  });

  const serviceStatusMap = {};
  mymps.tables['SERVICE_STATUS']?.rows.forEach(r => {
    serviceStatusMap[r.ID] = r.NAME;
  });

  const mtrTypeMap = {};
  mymps.tables['MTR_TYPE']?.rows.forEach(r => {
    mtrTypeMap[r.ID] = r.NAME;
  });

  const mtrStatusMap = {};
  mymps.tables['MTR_STATUS']?.rows.forEach(r => {
    mtrStatusMap[r.ID] = r.NAME;
  });

  // ==========================================
  // 1. IMPORT SERVICE
  // ==========================================
  const serviceRows = mymps.tables['SERVICE']?.rows || [];
  console.log(`\nProcessing ${serviceRows.length} services...`);
  const mappedServices = [];
  let skippedServiceNoRequest = 0;

  for (const r of serviceRows) {
    const requestId = r.REQUEST__ID_REQUEST ? String(r.REQUEST__ID_REQUEST) : null;
    // We can keep services even if request is null or not found, but let's log or set to null
    const validRequest = requestId && validRequestIds.has(requestId) ? requestId : null;
    if (requestId && !validRequest) {
      skippedServiceNoRequest++;
    }

    mappedServices.push({
      service_id: String(r.ID),
      request: validRequest,
      service_type: serviceTypeMap[r.TYPE__ID_SERVICE_TYPE] || null,
      service_name: r.SERVICE_NAME || null,
      status: serviceStatusMap[r.STATUS__ID_SERVICE_STATUS] || null,
      start_date: r.START_DATE ? r.START_DATE.split('T')[0] : null,
      end_date: r.END_DATE ? r.END_DATE.split('T')[0] : null,
      note: r.NOTE || null,
      fy: r.FY ? String(r.FY) : null,
      created_by: resolveEmp(r.CREATED_BY__EMPLOYEE) || 'mps_import',
      created_date: r.CREATED_DATE ? new Date(r.CREATED_DATE) : new Date(),
      updated_by: resolveEmp(r.UPDATED_BY__EMPLOYEE) || null,
      updated_date: r.UPDATED_DATE ? new Date(r.UPDATED_DATE) : null,
      log: r.OLD_ID ? `MPS_OLD_ID:${r.OLD_ID}` : null
    });
  }
  console.log(`Mapped services: ${mappedServices.length} (Skipped request matching: ${skippedServiceNoRequest})`);

  // ==========================================
  // 2. IMPORT ASSET
  // ==========================================
  const assetRows = mymps.tables['ASSET']?.rows || [];
  console.log(`\nProcessing ${assetRows.length} assets...`);
  const mappedAssets = [];
  let skippedAssetNoRequest = 0;

  for (const r of assetRows) {
    const requestId = r.REQUEST__ID_REQUEST ? String(r.REQUEST__ID_REQUEST) : null;
    const validRequest = requestId && validRequestIds.has(requestId) ? requestId : null;
    if (requestId && !validRequest) {
      skippedAssetNoRequest++;
    }

    mappedAssets.push({
      office_asset_id: String(r.ID),
      asset_name: r.ASSET_NAME || null,
      request: validRequest,
      identity_number: r.IDENTITY_NUMBER || null,
      type: assetTypeMap[r.TYPE__ID_ASSET_TYPE] || null,
      qty: r.QTY !== null ? parseInt(r.QTY) : 1,
      status: assetStatusMap[r.STATUS__ID_ASSET_STATUS] || null,
      purchase_date: r.PURCHASE_DATE ? r.PURCHASE_DATE.split('T')[0] : null,
      purchase_cost: r.PURCHASE_COST !== null ? String(r.PURCHASE_COST) : null,
      currency: currencyMap[r.CURRENCY__ID_CURRENCY] || 'VND',
      exchange_rate: r.EXCHANGE_RATE !== null ? String(r.EXCHANGE_RATE) : '1',
      current_owner: resolveEmp(r.CURRENT_OWNER__EMPLOYEE),
      location: r.LOCATION ? String(r.LOCATION) : null,
      created_by: resolveEmp(r.CREATED_BY__EMPLOYEE) || 'mps_import',
      created_date: r.CREATED_DATE ? new Date(r.CREATED_DATE) : new Date(),
      updated_by: resolveEmp(r.UPDATED_BY__EMPLOYEE) || null,
      updated_date: r.UPDATED_DATE ? new Date(r.UPDATED_DATE) : null,
      log: r.OLD_ID ? `MPS_OLD_ID:${r.OLD_ID}` : null
    });
  }
  console.log(`Mapped assets: ${mappedAssets.length} (Skipped request matching: ${skippedAssetNoRequest})`);

  // ==========================================
  // 3. IMPORT MTR
  // ==========================================
  const mtrRows = mymps.tables['MTR']?.rows || [];
  console.log(`\nProcessing ${mtrRows.length} MTR transactions...`);
  const mappedMtrs = [];
  let skippedMtrNoRequest = 0;

  for (const r of mtrRows) {
    const requestId = r.ID__REQUEST ? String(r.ID__REQUEST) : null;
    const validRequest = requestId && validRequestIds.has(requestId) ? requestId : null;
    if (requestId && !validRequest) {
      skippedMtrNoRequest++;
    }

    mappedMtrs.push({
      transaction_id: String(r.ID),
      account: r.ACCOUNT_ID__ACCOUNT ? String(r.ACCOUNT_ID__ACCOUNT) : null,
      transaction_date: r.TRANSACTION_DATE ? r.TRANSACTION_DATE.split('T')[0] : null,
      transaction_type: mtrTypeMap[r.TYPE__ID_TRANSACTION_TYPE] || null,
      description: r.DESCRIPTION || null,
      amount: r.AMOUNT !== null ? parseFloat(r.AMOUNT) : 0.0,
      exchange_rate: r.EXCHANGE_RATE !== null ? parseInt(r.EXCHANGE_RATE) : 1,
      note: r.NOTE || null,
      status: mtrStatusMap[r.STATUS__ID_MTR_STATUS] || null,
      created_by: 'mps_import',
      created_date: new Date(),
      updated_by: null,
      updated_date: null,
      log: r.OLD_ID ? `MPS_OLD_ID:${r.OLD_ID}` : null,
      request: validRequest
    });
  }
  console.log(`Mapped MTRs: ${mappedMtrs.length} (Skipped request matching: ${skippedMtrNoRequest})`);

  if (DRY_RUN) {
    console.log('\n⚠️ DRY_RUN=true — No DB changes made.');
    await pool.end();
    return;
  }

  // ==========================================
  // ACTUAL DB INSERTIONS
  // ==========================================
  // 1. Insert Service
  console.log('\n🔴 TRUNCATING service table...');
  if (process.env.NO_TRUNCATE === 'true') {
    console.log('Skipping truncate for: service CASCADE');
  } else {
    await pool.query('TRUNCATE TABLE service CASCADE');
  }
  console.log('✅ Service table truncated.');

  console.log('📥 Inserting services (batch of 100)...');
  let sInserted = 0;
  for (const r of mappedServices) {
    try {
      await pool.query(`
        INSERT INTO service (
          service_id, request, service_type, service_name, status,
          start_date, end_date, note, fy, created_by, created_date,
          updated_by, updated_date, log
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
        ) ON CONFLICT (service_id) DO NOTHING
      `, [
        r.service_id, r.request, r.service_type, r.service_name, r.status,
        r.start_date, r.end_date, r.note, r.fy, r.created_by, r.created_date,
        r.updated_by, r.updated_date, r.log
      ]);
      sInserted++;
    } catch (e) {
      console.error(`  ❌ Failed service ID ${r.service_id}:`, e.message);
    }
  }
  console.log(`✅ Services: ${sInserted}/${mappedServices.length} successfully inserted.`);

  // 2. Insert Asset
  console.log('\n🔴 TRUNCATING asset table...');
  if (process.env.NO_TRUNCATE === 'true') {
    console.log('Skipping truncate for: asset CASCADE');
  } else {
    await pool.query('TRUNCATE TABLE asset CASCADE');
  }
  console.log('✅ Asset table truncated.');

  console.log('📥 Inserting assets (batch of 100)...');
  let aInserted = 0;
  for (const r of mappedAssets) {
    try {
      await pool.query(`
        INSERT INTO asset (
          office_asset_id, asset_name, request, identity_number, type,
          qty, status, purchase_date, purchase_cost, currency,
          exchange_rate, current_owner, location, created_by, created_date,
          updated_by, updated_date, log
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
        ) ON CONFLICT (office_asset_id) DO NOTHING
      `, [
        r.office_asset_id, r.asset_name, r.request, r.identity_number, r.type,
        r.qty, r.status, r.purchase_date, r.purchase_cost, r.currency,
        r.exchange_rate, r.current_owner, r.location, r.created_by, r.created_date,
        r.updated_by, r.updated_date, r.log
      ]);
      aInserted++;
    } catch (e) {
      console.error(`  ❌ Failed asset ID ${r.office_asset_id}:`, e.message);
    }
  }
  console.log(`✅ Assets: ${aInserted}/${mappedAssets.length} successfully inserted.`);

  // 3. Insert MTR
  console.log('\n🔴 TRUNCATING mtr table...');
  if (process.env.NO_TRUNCATE === 'true') {
    console.log('Skipping truncate for: mtr CASCADE');
  } else {
    await pool.query('TRUNCATE TABLE mtr CASCADE');
  }
  console.log('✅ MTR table truncated.');

  console.log('📥 Inserting MTR (batch of 500)...');
  let mInserted = 0;
  const BATCH = 500;
  for (let i = 0; i < mappedMtrs.length; i += BATCH) {
    const batch = mappedMtrs.slice(i, i + BATCH);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const r of batch) {
        await client.query(`
          INSERT INTO mtr (
            transaction_id, account, transaction_date, transaction_type, description,
            amount, exchange_rate, note, status, created_by, created_date,
            updated_by, updated_date, log, request
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
          ) ON CONFLICT (transaction_id) DO NOTHING
        `, [
          r.transaction_id, r.account, r.transaction_date, r.transaction_type, r.description,
          r.amount, r.exchange_rate, r.note, r.status, r.created_by, r.created_date,
          r.updated_by, r.updated_date, r.log, r.request
        ]);
        mInserted++;
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      console.error(`  ❌ Failed in MTR batch starting at index ${i}:`, e.message);
    } finally {
      client.release();
    }
    if ((i / BATCH) % 2 === 0) {
      console.log(`  Progress: ${mInserted}/${mappedMtrs.length}...`);
    }
  }
  console.log(`✅ MTR: ${mInserted}/${mappedMtrs.length} successfully inserted.`);

  await pool.end();
  console.log('\n🎉 ALL IMPORTS SUCCESSFULLY COMPLETED!');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
