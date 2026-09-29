const { Client } = require('pg');

const teraxClient = new Client({ connectionString: 'postgres://teraxadmin:TeraX123!%40%23@10.91.1.51:30543/teraxdb' });
const targetClient = new Client({ connectionString: 'postgres://helpdesk_admin:Helpdesk123!%40%23@10.91.1.51:30543/crc_helpdesk_db' });

async function restoreFullData() {
  console.log('Connecting to databases...');
  await teraxClient.connect();
  await targetClient.connect();

  const tablesToSync = [
    'my_company',
    'department',
    'employee',
    'company',
    'contact',
    'policy_and_program',
    'request',
    'comment',
    'expense',
    'payment',
    'contract',
    'invoice',
    'mtr',
    'service',
    'asset'
  ];

  for (const table of tablesToSync) {
    try {
      console.log(`Syncing table ${table}...`);
      const srcRes = await teraxClient.query(`SELECT * FROM "${table}"`);
      if (srcRes.rows.length === 0) {
        console.log(`Table ${table} has 0 rows in teraxdb, skipping.`);
        continue;
      }

      const columns = Object.keys(srcRes.rows[0]);
      const colNames = columns.map(c => `"${c}"`).join(', ');

      // Find primary key
      const pkRes = await teraxClient.query(`
        SELECT a.attname
        FROM   pg_index i
        JOIN   pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE  i.indrelid = '${table}'::regclass AND i.indisprimary;
      `);

      const pkCol = pkRes.rows.length > 0 ? pkRes.rows[0].attname : columns[0];

      let count = 0;
      for (const row of srcRes.rows) {
        const valuePlaceholders = columns.map((_, idx) => `$${idx + 1}`).join(', ');
        const values = columns.map(col => row[col]);

        const updateAssignments = columns
          .filter(col => col !== pkCol)
          .map(col => `"${col}" = EXCLUDED."${col}"`)
          .join(', ');

        const sql = `
          INSERT INTO "${table}" (${colNames})
          VALUES (${valuePlaceholders})
          ON CONFLICT ("${pkCol}") DO UPDATE SET ${updateAssignments};
        `;

        await targetClient.query(sql, values);
        count++;
      }
      console.log(`✅ Synced ${count} rows for table ${table}.`);
    } catch (err) {
      console.error(`⚠️ Failed syncing table ${table}:`, err.message);
    }
  }

  console.log('\n🎉 Complete CRC data restoration finished successfully!');
  await teraxClient.end();
  await targetClient.end();
  process.exit(0);
}

restoreFullData().catch(err => {
  console.error('Fatal error restoring CRC data:', err);
  process.exit(1);
});
