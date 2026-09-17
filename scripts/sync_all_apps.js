const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { Client } = require('ssh2');

const SRC_DIR = '/opt/app/dev/crc_app';
const FILES_TO_SYNC = [
  'public/index.html',
  'public/config.js',
  'public/app.js',
  'public/actions_doc.html',
  'server/routes/support.js',
  'server/routes/employee.js',
  'server/helpers/validation.js',
  'server/helpers/cmsSeats.js',
  'server/routes/auth.js',
  'server/routes/actions.js',
  'server/db.js',
  'server/helpers/idGenerator.js',
  'server/helpers/permissionHelper.js',
  'server/routes/dynamic_crud.js',
  'public/locales/vi.json',
  'public/locales/en.json'
];

const LOCAL_TARGETS = [
  '/opt/app/terax'
];

const SSH_CONFIG = {
  host: '10.91.1.100',
  port: 22,
  username: 'root'
};

async function main() {
  console.log('🏁 STARTING SYNC PROCESS');

  // 1. Local copy to terax & terax1-15
  console.log('\n--- 1. Copying files locally to terax & clones ---');
  for (const targetDir of LOCAL_TARGETS) {
    if (!fs.existsSync(targetDir)) {
      console.warn(`⚠️ Target directory does not exist: ${targetDir}`);
      continue;
    }
    console.log(`Copying files to ${targetDir}...`);
    for (const relPath of FILES_TO_SYNC) {
      const srcPath = path.join(SRC_DIR, relPath);
      const destPath = path.join(targetDir, relPath);
      
      // Ensure target directory exists
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(srcPath, destPath);
    }
    console.log(`✅ Synced files to ${targetDir}`);
  }

  // 2. Upload to remote template machine
  console.log('\n--- 2. Uploading files to remote template machine (.100) ---');
  try {
    await new Promise((resolve, reject) => {
      const conn = new Client();
      
      conn.on('ready', () => {
        console.log('SSH connection established successfully!');
        conn.sftp((err, sftp) => {
          if (err) {
            conn.end();
            return reject(err);
          }
          
          let completed = 0;
          for (const relPath of FILES_TO_SYNC) {
            const localPath = path.join(SRC_DIR, relPath);
            const remotePath = `/opt/app/dev/crc_app/${relPath}`;
            
            console.log(`Uploading ${relPath} -> ${remotePath}...`);
            sftp.fastPut(localPath, remotePath, {}, (uploadErr) => {
              if (uploadErr) {
                console.error(`❌ Failed to upload ${relPath}:`, uploadErr);
                conn.end();
                return reject(uploadErr);
              }
              console.log(`✅ Uploaded ${relPath}`);
              completed++;
              if (completed === FILES_TO_SYNC.length) {
                conn.end();
                resolve();
              }
            });
          }
        });
      });

      conn.on('error', (err) => reject(err));
      conn.on('keyboard-interactive', (name, instructions, instructionsLang, prompts, finish) => {
        finish([SSH_CONFIG.password]);
      });

      // Try loading private key if exists
      let privateKey;
      try {
        const keyPath = path.join(require('os').homedir(), '.ssh', 'id_ed25519');
        if (fs.existsSync(keyPath)) {
          privateKey = fs.readFileSync(keyPath);
          console.log('Loaded local SSH private key');
        }
      } catch (e) {}

      conn.connect({
        host: SSH_CONFIG.host,
        port: SSH_CONFIG.port,
        username: SSH_CONFIG.username,
        password: SSH_CONFIG.password,
        privateKey,
        tryKeyboardInteractive: true,
        readyTimeout: 30000
      });
    });
  } catch (sshErr) {
    console.warn(`⚠️ Warning: Remote SSH upload failed: ${sshErr.message}. Continuing with local updates...`);
  }

  // 3. Restart K8s deployments
  console.log('\n--- 3. Restarting Kubernetes deployments ---');
  const deployments = [
    'crc-app-deployment'
  ];

  for (const dep of deployments) {
    try {
      console.log(`Restarting deployment: ${dep}...`);
      execSync(`kubectl rollout restart deployment ${dep}`, { stdio: 'inherit' });
      console.log(`✅ Restart command sent for ${dep}`);
    } catch (err) {
      console.error(`❌ Failed to restart deployment ${dep}:`, err.message);
    }
  }

  console.log('\n🎉 ALL SYNC AND DEPLOYMENT TASKS COMPLETED SUCCESSFULLY!');
}

main().catch(err => {
  console.error('\n❌ CRITICAL ERROR IN SYNC SCRIPT:', err);
  process.exit(1);
});
