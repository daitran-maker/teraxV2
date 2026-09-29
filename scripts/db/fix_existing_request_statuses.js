const pool = require('../../server/db');

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('Starting status cleanup transaction...');
    await client.query('BEGIN');

    // Rule 1: For any request that is not yet Approved (Draft, Pending Approval, Rejected),
    // their process_status MUST be 'Not started yet'.
    const res1 = await client.query(`
      UPDATE request 
      SET process_status = 'Not started yet' 
      WHERE sr_status IN ('Draft', 'Pending Approval', 'Rejected') 
        AND process_status IS DISTINCT FROM 'Not started yet'
    `);
    console.log(`- Rule 1: Reset process_status to 'Not started yet' for ${res1.rowCount} unapproved requests.`);

    // Rule 2: For any request where process_status is Canceled, the request MUST be Closed (sr_status = 'Closed').
    // Also unify 'Cancelled' to 'Canceled' in process_status.
    const res2 = await client.query(`
      UPDATE request 
      SET sr_status = 'Closed', 
          process_status = 'Canceled' 
      WHERE process_status IN ('Canceled', 'Cancelled')
        AND (sr_status IS DISTINCT FROM 'Closed' OR process_status IS DISTINCT FROM 'Canceled')
    `);
    console.log(`- Rule 2: Synced sr_status = 'Closed' and process_status = 'Canceled' for ${res2.rowCount} requests.`);

    // Rule 3: For any request where sr_status is Closed, their process_status should be either 'Completed' or 'Canceled'.
    // If it is in any other state (e.g. 'Processing', 'Not started yet', or 'Closed'), we default it to 'Completed'.
    const res3 = await client.query(`
      UPDATE request 
      SET process_status = 'Completed' 
      WHERE sr_status = 'Closed' 
        AND process_status NOT IN ('Completed', 'Canceled')
    `);
    console.log(`- Rule 3: Set process_status = 'Completed' for ${res3.rowCount} Closed requests that had other process states (including 'Closed').`);

    await client.query('COMMIT');
    console.log('✅ Status cleanup transaction committed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error executing status cleanup transaction:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
