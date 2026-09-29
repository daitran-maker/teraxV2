const pool = require('./server/db'); 
async function run() { 
  try {
    const q = `
      ALTER TABLE column_permissions 
      ADD COLUMN IF NOT EXISTS levels text,
      ADD COLUMN IF NOT EXISTS positions text,
      ADD COLUMN IF NOT EXISTS roles text,
      ADD COLUMN IF NOT EXISTS exceptions text;
    `;
    await pool.query(q);
    console.log("Altered column_permissions successfully.");
  } catch(e) { console.error(e) }
  process.exit(0); 
} 
run();
