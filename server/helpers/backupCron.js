const cron = require('node-cron');
const path = require('path');
const fs = require('fs');
const pool = require('../db');

// Backup Directory
const BACKUP_DIR = path.join(__dirname, '../../backups');

function parseBackupRetentionDays(backupVal) {
  const str = String(backupVal || '').toLowerCase();
  if (str.includes('30') || str.includes('30 ngày')) return 30;
  if (str.includes('90') || str.includes('90 ngày')) return 90;
  if (str.includes('180') || str.includes('180 ngày')) return 180;
  if (str.includes('không') || str.includes('no')) return 0; // Delete immediately or keep 0 days
  return 36500; // Enterprise / Custom / Theo chính sách -> default keep (100 years)
}

async function runBackupRotation() {
  console.log('[BackupRotation] Starting scheduled rotation...');
  try {
    const res = await pool.query('SELECT features FROM cms_tenant_info LIMIT 1');
    if (res.rows.length === 0) {
      console.log('[BackupRotation] No tenant info found, skipping rotation.');
      return;
    }

    const features = typeof res.rows[0].features === 'string' ? JSON.parse(res.rows[0].features) : res.rows[0].features || {};
    const backupPolicy = features.backup || '';
    const retentionDays = parseBackupRetentionDays(backupPolicy);

    console.log(`[BackupRotation] Current backup policy: "${backupPolicy}". Retention: ${retentionDays} days.`);

    if (!fs.existsSync(BACKUP_DIR)) {
      console.log('[BackupRotation] Backups directory does not exist.');
      return;
    }

    const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.dump'));
    const now = Date.now();
    const retentionMs = retentionDays * 24 * 60 * 60 * 1000;

    let deleteCount = 0;
    for (const file of files) {
      const filePath = path.join(BACKUP_DIR, file);
      try {
        const stats = fs.statSync(filePath);
        const ageMs = now - stats.birthtimeMs; // Use birthtime (creation time)
        
        if (ageMs > retentionMs) {
          console.log(`[BackupRotation] Deleting old backup: ${file} (Age: ${(ageMs / (24 * 60 * 60 * 1000)).toFixed(1)} days)`);
          fs.unlinkSync(filePath);
          deleteCount++;
        }
      } catch (err) {
        console.error(`[BackupRotation] Failed to process file ${file}:`, err.message);
      }
    }
    console.log(`[BackupRotation] Completed. Deleted ${deleteCount} old backup files.`);
  } catch (err) {
    console.error('[BackupRotation] Error during backup rotation:', err.message);
  }
}

// Schedule daily check at 1:00 AM
cron.schedule('0 1 * * *', () => {
  runBackupRotation();
});

module.exports = { runBackupRotation };
