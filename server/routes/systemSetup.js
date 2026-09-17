const express = require('express');
const router = express.Router();
const pool = require('../db');

// Helper to ensure setup table and default values exist
async function ensureSetupTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "system_setup" (
      "key" TEXT PRIMARY KEY,
      "value" TEXT,
      "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  await pool.query(`
    INSERT INTO "system_setup" ("key", "value")
    VALUES ('setup_completed', 'false')
    ON CONFLICT ("key") DO NOTHING;
  `);
}

// GET /api/system-setup/status
router.get('/status', async (req, res) => {
  try {
    await ensureSetupTable();
    
    // Get setup_completed state
    const setupRes = await pool.query(`SELECT "value" FROM "system_setup" WHERE "key" = 'setup_completed'`);
    const setupCompleted = setupRes.rows[0] ? setupRes.rows[0].value === 'true' : false;
    
    // Get row counts for setup tables
    // We run queries sequentially or using Promise.all to handle potential table name case/existence issues
    const tables = [
      { key: 'my_company', query: 'SELECT COUNT(*)::int FROM "my_company"' },
      { key: 'my_location', query: 'SELECT COUNT(*)::int FROM "my_location"' },
      { key: 'department', query: 'SELECT COUNT(*)::int FROM "department"' },
      { key: 'employee', query: 'SELECT COUNT(*)::int FROM "employee"' },
      { key: 'policy_and_program', query: 'SELECT COUNT(*)::int FROM "policy_and_program"' },
      { key: 'account', query: 'SELECT COUNT(*)::int FROM "account"' },
      { key: 'company', query: 'SELECT COUNT(*)::int FROM "company"' },
      { key: 'contact', query: 'SELECT COUNT(*)::int FROM "contact"' },
      { key: 'service', query: 'SELECT COUNT(*)::int FROM "service"' },
      { key: 'asset', query: 'SELECT COUNT(*)::int FROM "asset"' }
    ];
    
    const tableCounts = {};
    for (const t of tables) {
      try {
        const countRes = await pool.query(t.query);
        tableCounts[t.key] = countRes.rows[0] ? countRes.rows[0].count : 0;
      } catch (err) {
        console.error(`Error querying count for ${t.key}:`, err.message);
        tableCounts[t.key] = 0; // default to 0 if table doesn't exist yet
      }
    }
    
    res.json({
      setupCompleted,
      tableCounts,
      isHelpdesk: process.env.IS_HELPDESK === 'true'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/system-setup/complete
router.post('/complete', async (req, res) => {
  try {
    await ensureSetupTable();
    await pool.query(`
      UPDATE "system_setup"
      SET "value" = 'true', "updated_at" = CURRENT_TIMESTAMP
      WHERE "key" = 'setup_completed'
    `);
    res.json({ success: true, message: 'Setup completed successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/system-setup/reset (For developer/testing use)
router.post('/reset', async (req, res) => {
  try {
    await ensureSetupTable();
    await pool.query(`
      UPDATE "system_setup"
      SET "value" = 'false', "updated_at" = CURRENT_TIMESTAMP
      WHERE "key" = 'setup_completed'
    `);
    res.json({ success: true, message: 'Setup status reset to incomplete' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
