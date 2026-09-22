const { Client } = require('pg');

const BASE_URL = 'postgres://teraxadmin:TeraX123!%40%23@terax-postgres-service:5432';

const TABLES = [
  { name: 'my_company', pk: 'my_company_id' },
  { name: 'my_location', pk: 'my_location_id' },
  { name: 'department', pk: 'department_id' },
  { name: 'employee', pk: 'email' }
];

async function syncTable(srcClient, destClient, tableName, pkColumn) {
  console.log(`Syncing table: ${tableName}...`);

  // 1. Get columns list in public schema
  const colsRes = await srcClient.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND table_schema = 'public'",
    [tableName]
  );
  const columns = colsRes.rows.map(r => r.column_name);
  if (columns.length === 0) {
    throw new Error(`Table ${tableName} not found or has no columns in source database.`);
  }

  // 2. Fetch all source rows
  const rowsRes = await srcClient.query(`SELECT * FROM "${tableName}"`);
  const rows = rowsRes.rows;
  console.log(`Fetched ${rows.length} rows from source for ${tableName}.`);

  // 3. Construct upsert query
  const colsList = columns.map(c => `"${c}"`).join(', ');
  const placeholders = columns.map((_, idx) => `$${idx + 1}`).join(', ');
  
  const updateAssignments = columns
    .filter(c => c !== pkColumn)
    .map(c => `"${c}" = EXCLUDED."${c}"`)
    .join(', ');

  let insertQuery = `
    INSERT INTO "${tableName}" (${colsList})
    VALUES (${placeholders})
  `;
  if (updateAssignments.length > 0) {
    insertQuery += `
      ON CONFLICT ("${pkColumn}")
      DO UPDATE SET ${updateAssignments}
    `;
  } else {
    insertQuery += `
      ON CONFLICT ("${pkColumn}")
      DO NOTHING
    `;
  }

  // 4. Execute inserts in destination (Pass 1: set direct_manager to NULL)
  let inserted = 0;
  for (const r of rows) {
    const values = columns.map(c => {
      let val = r[c];
      if (tableName === 'employee' && c === 'direct_manager') {
        val = null; // Set to NULL in Pass 1 to prevent FK constraint violation
      }
      if (val !== null && typeof val === 'object' && !(val instanceof Date)) {
        return JSON.stringify(val);
      }
      return val;
    });
    await destClient.query(insertQuery, values);
    inserted++;
  }
  console.log(`✅ Successfully synced Pass 1 for ${tableName}.`);

  // 5. Restore self-referential direct_manager values (Pass 2)
  if (tableName === 'employee') {
    console.log(`Running Pass 2 to restore direct_manager values for ${tableName}...`);
    let updated = 0;
    for (const r of rows) {
      if (r.direct_manager !== null && r.direct_manager !== undefined) {
        await destClient.query(
          `UPDATE "${tableName}" SET direct_manager = $1 WHERE "${pkColumn}" = $2`,
          [r.direct_manager, r[pkColumn]]
        );
        updated++;
      }
    }
    console.log(`✅ Successfully updated direct_manager values for ${updated}/${rows.length} rows.`);
  }
}

async function main() {
  const srcClient = new Client({ connectionString: `${BASE_URL}/crcdevdb` });
  const destClient = new Client({ connectionString: `${BASE_URL}/crc_helpdesk_db` });

  try {
    await srcClient.connect();
    await destClient.connect();
    console.log('Connected to source and destination databases.');

    for (const t of TABLES) {
      await syncTable(srcClient, destClient, t.name, t.pk);
    }

  } catch (err) {
    console.error('Error during synchronization:', err.stack);
  } finally {
    await srcClient.end();
    await destClient.end();
  }
}

main().catch(console.error);
