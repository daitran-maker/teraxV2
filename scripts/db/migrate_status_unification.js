require('dotenv').config();
const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL || 'postgres://crc_user:crc2026@localhost:9999/crc_db';
const client = new Client({ connectionString });

async function run() {
  try {
    await client.connect();
    console.log("Connected to database for status consolidation migration.");

    // 1. Update request status 'Submitted' to 'Pending Approval'
    console.log("Updating request.sr_status from 'Submitted' to 'Pending Approval'...");
    const reqRes = await client.query(`
      UPDATE request 
      SET sr_status = 'Pending Approval' 
      WHERE sr_status = 'Submitted'
    `);
    console.log(`Updated ${reqRes.rowCount} request records.`);

    // 2. Update action_rules descriptions
    console.log("Updating action_rules descriptions to refer to 'Pending Approval' instead of 'Submitted'...");
    const ruleRes = await client.query(`
      UPDATE action_rules 
      SET description = REPLACE(description, 'SR Status = ''Submitted''', 'Status = ''Pending Approval''')
      WHERE description LIKE '%SR Status = ''Submitted''%'
    `);
    console.log(`Updated ${ruleRes.rowCount} action rules.`);

    console.log("Migration completed successfully.");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}

run();
