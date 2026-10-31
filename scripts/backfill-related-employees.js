/**
 * Re-compute related_employees for the request chain tables
 * (opportunity, contract, service delivery contract, service task request).
 *
 * Rule: related = own people + people of all ancestors + people of all descendants
 *       + everyone related to the linked request  -> parent/child visibility is consistent both ways.
 *
 * Usage: node scripts/backfill-related-employees.js [table ...]
 * Safe to run repeatedly (the column is fully recomputed from current data).
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Client } = require('pg');
const { backfillTable } = require('../modules/related_employees/server/related_employees.service');

(async () => {
  const argTables = process.argv.slice(2);
  const targets = argTables.length ? argTables : ['oppotunity', 'contract', 'service_delivery_contract', 'service_task_request'];
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    for (const t of targets) {
      const n = await backfillTable(t, client);
      console.log(`${t}: ${n} records recomputed`);
    }
  } finally {
    await client.end();
  }
})().catch(e => { console.error('Backfill failed:', e.message); process.exit(1); });
