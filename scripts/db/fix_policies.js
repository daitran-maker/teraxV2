require('dotenv').config();
const XLSX = require('xlsx');
const pool = require('./server/db');

async function fixPolicies() {
  const workbook = XLSX.readFile('RQC-CP-Database.xlsx');
  const sheet = workbook.Sheets['PROCESS'];
  const data = XLSX.utils.sheet_to_json(sheet, { defval: null });
  
  try {
    for (const row of data) {
      if (!row['PROCESS ID']) continue;
      await pool.query(`
        UPDATE policy_and_program 
        SET tier1_approval = $1, tier2_approval = $2, tier3_approval = $3, approval_level = $4
        WHERE policy_id = $5
      `, [
        row['TIER 1 APPROVAL'], 
        row['TIER 2 APPROVAL'], 
        row['TIER 3 APPROVAL'], 
        row['APPROVAL LEVEL'], 
        row['PROCESS ID']
      ]);
    }
    console.log('✅ Successfully updated policy_and_program with exact tiers and approval_level.');
  } catch (err) {
    console.error('Error updating policies:', err);
  } finally {
    pool.end();
  }
}

fixPolicies();
