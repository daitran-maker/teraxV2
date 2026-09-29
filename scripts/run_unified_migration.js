const fs = require('fs');
const path = require('path');
const { Client } = require('/app/node_modules/pg');

const PASSWORD_ENCODED = 'TeraX123!%40%23';

const TARGETS = [
  { name: 'crcdevdb', url: `postgres://teraxadmin:${PASSWORD_ENCODED}@terax-postgres-service:5432/crcdevdb` },
  { name: 'crc_helpdesk_db', url: `postgres://helpdesk_admin:Helpdesk123!%40%23@terax-postgres-service:5432/crc_helpdesk_db` },
  ...Array.from({ length: 15 }, (_, i) => {
    const num = i + 1;
    return {
      name: `teraxdb${num}`,
      url: `postgres://teraxadmin:${PASSWORD_ENCODED}@terax${num}-postgres-service:5432/teraxdb${num}`
    };
  })
];

const sql1 = fs.readFileSync(path.join(__dirname, '../migrations/2026-07-28_migrate_identity_to_employee_id_fixed.sql'), 'utf8');
const sql2 = fs.readFileSync(path.join(__dirname, '../migrations/2026-07-28_patch_department_manager.sql'), 'utf8');
const sql = sql1 + '\n' + sql2;

async function run() {
  console.log('🏁 Starting DB migration...');
  for (const t of TARGETS) {
    console.log(`Running migration for ${t.name}...`);
    const client = new Client({ connectionString: t.url });
    try {
      await client.connect();
      await client.query(sql);
      console.log(`✅ ${t.name} migrated successfully.`);
      await client.end();
    } catch (err) {
      console.error(`❌ Failed to migrate ${t.name}:`, err.message);
      try { await client.end(); } catch (e) {}
    }
  }
  console.log('🎉 All migrations completed.');
}

run().catch(console.error);
