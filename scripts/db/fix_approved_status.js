/**
 * Migration: Fix requests where ALL tiers in approval_flow are "Approved"
 * but sr_status is still "Pending Approval" or "Submitted".
 * 
 * Root cause: MPS import script set all tiers to Approved but did not
 * update sr_status to 'Approved'. Also applies to cases where process policy
 * uses Tier 1 only but approval_flow was stored with total_levels = 3.
 *
 * Logic:
 *   - If ALL steps in approval_flow are "Approved" AND sr_status is still
 *     "Pending Approval" or "Submitted" → set sr_status = 'Approved'
 *     and process_status = 'Not started yet' (if process_status is null)
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || 'postgres://crc_user:crc2026@localhost:9999/crc_db';
const pool = new Pool({ connectionString });

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('Connected. Starting migration...\n');

    // Fetch all pending/submitted requests
    const res = await client.query(`
      SELECT request_id, sr_status, process_status, approval_flow
      FROM request
      WHERE sr_status IN ('Pending Approval', 'Submitted')
        AND approval_flow IS NOT NULL
    `);
    console.log(`Found ${res.rows.length} Pending Approval / Submitted requests to check.`);

    let fixedCount = 0;
    let skippedCount = 0;

    for (const row of res.rows) {
      let flow;
      try {
        flow = typeof row.approval_flow === 'string' ? JSON.parse(row.approval_flow) : row.approval_flow;
      } catch {
        continue;
      }

      if (!flow || !flow.steps || flow.steps.length === 0) {
        skippedCount++;
        continue;
      }

      // Check if ALL steps are "Approved"
      const allApproved = flow.steps.every(s => s.status && s.status.toLowerCase() === 'approved');

      if (allApproved) {
        // Update current_level to total_levels + 1 to signal fully approved
        flow.current_level = flow.total_levels + 1;

        const newProcessStatus = (row.process_status && row.process_status !== 'Not started yet')
          ? row.process_status
          : 'Not started yet';

        await client.query(`
          UPDATE request
          SET sr_status = 'Approved',
              process_status = $2,
              approval_flow = $3,
              updated_by = 'system_migration'
          WHERE request_id = $1
        `, [row.request_id, newProcessStatus, JSON.stringify(flow)]);

        fixedCount++;
        if (fixedCount <= 10) {
          console.log(`  ✅ Fixed: ${row.request_id} (was: ${row.sr_status}, process: ${row.process_status})`);
        }
      } else {
        skippedCount++;
      }
    }

    await client.query('COMMIT');
    console.log(`\n✅ Migration complete.`);
    console.log(`   Fixed:   ${fixedCount} records`);
    console.log(`   Skipped: ${skippedCount} records (not fully approved)`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed, rolled back:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
