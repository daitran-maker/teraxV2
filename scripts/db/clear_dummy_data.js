require('dotenv').config();
const pool = require('./server/db');

async function clearDummyData() {
  try {
    console.log("Connecting to database:", process.env.DATABASE_URL);
    
    // Delete in correct order to respect foreign key constraints
    const tablesToClear = [
      'mtr',
      'payment',
      'invoice',
      'expense',
      'contract',
      'comment',
      'request'
    ];

    for (const table of tablesToClear) {
      console.log(`Clearing table: ${table}...`);
      await pool.query(`DELETE FROM "${table}";`);
      console.log(`✅ Cleared ${table}`);
    }

    console.log("All dummy request and related data cleared successfully.");
  } catch (err) {
    console.error("Error clearing data:", err);
  } finally {
    pool.end();
  }
}

clearDummyData();
