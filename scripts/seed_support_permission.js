const { Client } = require('pg');

const PASSWORD_ENCODED = 'TeraX123!%40%23';

const TARGETS = [
  { name: 'crcdevdb', url: `postgres://teraxadmin:${PASSWORD_ENCODED}@terax-postgres-service:5432/crcdevdb` },
  { name: 'crc_dev_db', url: `postgres://teraxadmin:${PASSWORD_ENCODED}@terax-postgres-service:5432/crc_dev_db` },
  { name: 'crc_helpdesk_db', url: `postgres://helpdesk_admin:Helpdesk123!%40%23@terax-postgres-service:5432/crc_helpdesk_db` },
  { name: 'teraxdb', url: `postgres://teraxadmin:${PASSWORD_ENCODED}@terax-postgres-service:5432/teraxdb` },
  ...Array.from({ length: 15 }, (_, i) => {
    const num = i + 1;
    return {
      name: `teraxdb${num}`,
      url: `postgres://teraxadmin:${PASSWORD_ENCODED}@terax${num}-postgres-service:5432/teraxdb${num}`
    };
  })
];

const SEED_SQL = `
  INSERT INTO exception_rules (name, roles)
  VALUES ('support', '[Staff]')
  ON CONFLICT (name) DO UPDATE SET roles = EXCLUDED.roles;
`;

async function run() {
  console.log('🏁 Seeding support menu exception rule for all 18 databases...');
  for (const t of TARGETS) {
    console.log(`Seeding support rule for ${t.name}...`);
    const client = new Client({ connectionString: t.url });
    try {
      await client.connect();
      await client.query(SEED_SQL);
      console.log(`✅ ${t.name} successfully seeded.`);
      await client.end();
    } catch (err) {
      console.error(`❌ Failed to seed ${t.name}:`, err.message);
      try { await client.end(); } catch (e) {}
    }
  }
  console.log('🎉 Seeding finished.');
}

run().catch(console.error);
