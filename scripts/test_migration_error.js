const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const PASSWORD_ENCODED = 'TeraX123!%40%23';

async function main() {
  const dbUrl = `postgres://teraxadmin:${PASSWORD_ENCODED}@terax1-postgres-service:5432/teraxdb1`;
  const client = new Client({ connectionString: dbUrl });
  
  // Read migration SQL from server/db.js or read the file and extract the pool.query parameter
  const dbJsPath = path.join(__dirname, '../server/db.js');
  const dbJsContent = fs.readFileSync(dbJsPath, 'utf8');
  
  // Extract the SQL string between pool.query(` and `)
  const match = dbJsContent.match(/pool\.query\(`([\s\S]+?)`\)/);
  if (!match) {
    console.error('Could not extract migration SQL from db.js');
    return;
  }
  const sql = match[1];
  
  await client.connect();
  try {
    console.log('Running extracted migration SQL on teraxdb1...');
    await client.query(sql);
    console.log('✅ Migration completed successfully!');
  } catch (err) {
    console.error('❌ Migration failed!');
    console.error('Error Message:', err.message);
    console.error('Error Code:', err.code);
    console.error('Error Detail:', err.detail);
    console.error('Error Position:', err.position);
    console.error('Error Stack:', err.stack);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
