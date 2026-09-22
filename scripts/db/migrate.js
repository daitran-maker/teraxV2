const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgres://crc_user:crc2026@localhost:9999/crc_db'
});

async function run() {
  try {
    await client.connect();
    
    // Rename table
    console.log("Renaming table request_detail to comment...");
    await client.query('ALTER TABLE IF EXISTS request_detail RENAME TO "comment";');
    
    // Rename column
    console.log("Renaming column 'to' to 'tag'...");
    await client.query('ALTER TABLE IF EXISTS "comment" RENAME COLUMN "to" TO "tag";');
    
    // Check if the PK sequence and constraint needs renaming (optional but good practice)
    try {
      await client.query('ALTER TABLE "comment" RENAME CONSTRAINT request_detail_pkey TO comment_pkey;');
    } catch (e) { console.log("Constraint rename failed, ignoring", e.message); }
    
    try {
      await client.query('ALTER TABLE "comment" RENAME COLUMN request_detail_id TO comment_id;');
    } catch (e) { console.log("Column rename failed, ignoring", e.message); }

    console.log("Migration complete.");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}

run();
