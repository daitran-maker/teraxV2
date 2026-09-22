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

const MIGRATION_SQL = `
  DO $$
  BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'employee' AND column_name = 'employee_id') THEN
      ALTER TABLE "employee" ADD COLUMN employee_id VARCHAR(50);
      WITH ranked AS (SELECT email, ROW_NUMBER() OVER(ORDER BY email) as rnum FROM employee)
      UPDATE employee SET employee_id = 'EMP-' || LPAD(ranked.rnum::text, 4, '0') FROM ranked WHERE employee.email = ranked.email AND employee.employee_id IS NULL;
      ALTER TABLE "employee" ALTER COLUMN employee_id SET NOT NULL;
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'employee' AND column_name = 'username') THEN
      ALTER TABLE "employee" ADD COLUMN username VARCHAR(100);
      UPDATE "employee" SET username = split_part(email, '@', 1) WHERE username IS NULL;
    END IF;
  END $$;
`;

async function run() {
  console.log('🏁 Starting DB schema migration for all 18 databases...');
  for (const t of TARGETS) {
    console.log(`Running migration for ${t.name}...`);
    const client = new Client({ connectionString: t.url });
    try {
      await client.connect();
      await client.query(MIGRATION_SQL);
      console.log(`✅ ${t.name} successfully migrated.`);
      await client.end();
    } catch (err) {
      console.error(`❌ Failed to migrate ${t.name}:`, err.message);
      try { await client.end(); } catch (e) {}
    }
  }
  console.log('🎉 DB Migration finished.');
}

run().catch(console.error);
