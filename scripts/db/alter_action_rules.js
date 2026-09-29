const pool = require('./server/db'); 
async function run() { 
  try {
    const q = `
      ALTER TABLE action_rules 
      ADD COLUMN IF NOT EXISTS description text;
    `;
    await pool.query(q);
    console.log("Altered action_rules successfully.");
  } catch(e) { console.error(e) }
  process.exit(0); 
} 
run();
