const path = require('path');
try {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
} catch (e) {
  try {
    require(path.join(__dirname, '../node_modules/dotenv')).config({ path: path.join(__dirname, '../.env') });
  } catch (e2) { }
}

let Pool;
try {
  Pool = require('pg').Pool;
} catch (e) {
  Pool = require(path.join(__dirname, '../node_modules/pg')).Pool;
}

const connectionString = process.argv[2] || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ Error: DATABASE_URL not found in .env and not provided as argument.');
  console.error('Usage: node scripts/clear_unwanted_elements.js [optional_database_url]');
  process.exit(1);
}

const pool = new Pool({
  connectionString
});

async function run() {
  const client = await pool.connect();
  try {
    console.log('🚀 Starting cleanup of "MONEY TRANSACTION" and "DEVICE AND ASSET" elements...');
    await client.query('BEGIN');

    // 1. Update request table
    const updateReqRes = await client.query(`
      UPDATE request
      SET elements = ARRAY(
        SELECT elem
        FROM unnest(elements) AS elem
        WHERE UPPER(TRIM(elem)) NOT IN ('MONEY TRANSACTION', 'DEVICE AND ASSET')
      )
      WHERE elements IS NOT NULL 
        AND ('MONEY TRANSACTION' = ANY(elements) OR 'DEVICE AND ASSET' = ANY(elements))
      RETURNING request_id;
    `);
    console.log(`✅ Updated ${updateReqRes.rowCount} requests in 'request' table.`);

    // 2. Update policy_and_program table
    const policiesRes = await client.query(`
      SELECT policy_id, elements 
      FROM policy_and_program 
      WHERE elements ILIKE '%MONEY%TRANSACTION%' OR elements ILIKE '%DEVICE%ASSET%'
    `);

    let polUpdatedCount = 0;
    for (const pol of policiesRes.rows) {
      const raw = pol.elements || '';
      const parts = raw.split(',').map(s => s.trim().replace(/^\[|\]$/g, '')).filter(Boolean);
      const cleaned = parts.filter(p => {
        const u = p.trim().toUpperCase();
        return u !== 'MONEY TRANSACTION' && u !== 'DEVICE AND ASSET';
      });
      const newElementsVal = cleaned.length > 0 ? `[${cleaned.join(', ')}]` : null;

      await client.query(`
        UPDATE policy_and_program
        SET elements = $1
        WHERE policy_id = $2
      `, [newElementsVal, pol.policy_id]);

      polUpdatedCount++;
    }
    console.log(`✅ Updated ${polUpdatedCount} policies in 'policy_and_program' table.`);

    // 3. Verification queries
    const verifyReq = await client.query(`
      SELECT count(*) FROM request 
      WHERE 'MONEY TRANSACTION' = ANY(elements) OR 'DEVICE AND ASSET' = ANY(elements)
    `);

    const verifyPol = await client.query(`
      SELECT count(*) FROM policy_and_program 
      WHERE elements ILIKE '%MONEY%TRANSACTION%' OR elements ILIKE '%DEVICE%ASSET%'
    `);

    if (parseInt(verifyReq.rows[0].count) === 0 && parseInt(verifyPol.rows[0].count) === 0) {
      await client.query('COMMIT');
      console.log('🎉 Cleanup committed successfully! Zero unwanted elements remaining.');
    } else {
      throw new Error(`Verification failed: ${verifyReq.rows[0].count} requests and ${verifyPol.rows[0].count} policies still have unwanted elements.`);
    }

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error during cleanup, rolled back:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
