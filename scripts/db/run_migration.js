const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const sql = fs.readFileSync(path.join(__dirname, 'migrate_status_to_integer.sql'), 'utf8');

const targets = [
  { name: 'Local crcdevdb', url: 'postgres://teraxadmin:TeraX123!%40%23@10.91.1.51:30543/crcdevdb' },
  { name: 'Local crc_helpdesk_db', url: 'postgres://teraxadmin:TeraX123!%40%23@10.91.1.51:30543/crc_helpdesk_db' },
  { name: 'Remote .100 crcdevdb', url: 'postgres://teraxadmin:TeraX123!%40%23@10.91.1.100:30543/crcdevdb' },
  { name: 'Remote .100 crc_helpdesk_db', url: 'postgres://teraxadmin:TeraX123!%40%23@10.91.1.100:30543/crc_helpdesk_db' },
];

async function run() {
  for (const target of targets) {
    console.log(`\n=== Migrating ${target.name} ===`);
    const client = new Client({
      connectionString: target.url,
      connectionTimeoutMillis: 5000,
    });
    try {
      await client.connect();
      await client.query(sql);
      console.log(`✅ ${target.name} migrated successfully!`);
    } catch (err) {
      console.error(`❌ ${target.name} failed:`, err.message);
    } finally {
      await client.end();
    }
  }
  process.exit(0);
}

run();
