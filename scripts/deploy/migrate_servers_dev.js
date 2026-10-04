/**
 * CRC App & CMS Server Migration Script to /opt/app/dev
 *
 * Usage:
 *   node scripts/deploy/migrate_servers_dev.js
 */

const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Migration configurations
const CONFIG = {
  source: {
    host: '100.70.140.42',
    port: 8991,
    username: 'alui98hp',
    password: 'Lee@122598',
    appDir: '/home/alui98hp/crc_app',
    cmsDir: '/home/alui98hp/cms_terax',
    dbContainers: {
      crc: 'crc_db_standalone',
      cms: 'cms_db_standalone'
    },
    databases: {
      crc: 'crc_db',
      cms: 'cms_terax'
    }
  },
  target: {
    host: '10.91.1.51',
    port: 22,
    username: 'terax',
    password: 'welcome1',
    appDir: '/opt/app/dev/crc_app',
    cmsDir: '/opt/app/dev/cms_terax',
    oldAppDir: '/opt/app/terax'
  },
  localTempDir: path.join(__dirname, '../../backups/migration_temp')
};

// SSH Private Key Loader
function loadPrivateKey() {
  const keyPath = path.join(os.homedir(), '.ssh', 'id_ed25519');
  if (fs.existsSync(keyPath)) {
    console.log(`🔑 Loaded SSH private key from: ${keyPath}`);
    return fs.readFileSync(keyPath);
  }
  return null;
}

const privateKey = loadPrivateKey();

function runCommand(conn, cmd) {
  return new Promise((resolve, reject) => {
    console.log(`Executing remote command:\n  ${cmd.trim().split('\n').join('\n  ')}`);
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      
      let stdout = '';
      let stderr = '';
      
      stream.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Command failed with exit code ${code}.\nSTDERR: ${stderr}`));
        }
      });
      
      stream.on('data', (data) => {
        const str = data.toString();
        stdout += str;
        process.stdout.write(str);
      });
      
      stream.stderr.on('data', (data) => {
        const str = data.toString();
        stderr += str;
        process.stderr.write(str);
      });
    });
  });
}

function downloadFile(conn, remotePath, localPath) {
  return new Promise((resolve, reject) => {
    console.log(`📥 Downloading ${remotePath} -> ${localPath}`);
    conn.sftp((err, sftp) => {
      if (err) return reject(err);
      sftp.fastGet(remotePath, localPath, {}, (err2) => {
        if (err2) return reject(err2);
        console.log(`✅ Downloaded successfully.`);
        resolve();
      });
    });
  });
}

function uploadFile(conn, localPath, remotePath) {
  return new Promise((resolve, reject) => {
    console.log(`📤 Uploading ${localPath} -> ${remotePath}`);
    conn.sftp((err, sftp) => {
      if (err) return reject(err);
      sftp.fastPut(localPath, remotePath, {}, (err2) => {
        if (err2) return reject(err2);
        console.log(`✅ Uploaded successfully.`);
        resolve();
      });
    });
  });
}

function connectServer(config, key) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on('ready', () => resolve(conn));
    conn.on('error', (err) => reject(err));
    conn.on('keyboard-interactive', (name, inst, instLang, prompts, finish) => {
      finish([config.password]);
    });
    conn.connect({
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      privateKey: key,
      tryKeyboardInteractive: true,
      readyTimeout: 30000
    });
  });
}

async function startMigration() {
  if (!fs.existsSync(CONFIG.localTempDir)) {
    fs.mkdirSync(CONFIG.localTempDir, { recursive: true });
  }

  const localCrcDbPath = path.join(CONFIG.localTempDir, 'crc_db.dump');
  const localCmsDbPath = path.join(CONFIG.localTempDir, 'cms_db.dump');
  const localCrcTarPath = path.join(CONFIG.localTempDir, 'crc_app.tar.gz');
  const localCmsTarPath = path.join(CONFIG.localTempDir, 'cms_app.tar.gz');
  const localTenantScriptPath = path.join(CONFIG.localTempDir, 'add_tenant.sh');
  const localPrivateKeyPath = path.join(CONFIG.localTempDir, 'id_ed25519');
  const localPublicKeyPath = path.join(CONFIG.localTempDir, 'id_ed25519.pub');

  console.log('\n==================================================');
  console.log('🏁 STARTING DEV APP MIGRATION TO /opt/app/dev');
  console.log('==================================================\n');

  let sourceConn, targetConn;

  try {
    // -------------------------------------------------------------
    // PHASE 1: Connect to Source Server and Backup Databases & Codebases
    // -------------------------------------------------------------
    console.log('Step 1: Connecting to Source Server (100.70.140.42)...');
    sourceConn = await connectServer(CONFIG.source, privateKey);
    console.log('✅ Connected to Source Server!');

    // Start database containers on source if stopped, to dump data
    console.log('\nEnsuring source database containers are running for pg_dump...');
    const startSourceDb = `
      cd ${CONFIG.source.appDir}
      echo "${CONFIG.source.password}" | sudo -S docker compose -f docker-compose.standalone.yml up -d db
      cd ${CONFIG.source.cmsDir}
      echo "${CONFIG.source.password}" | sudo -S docker compose up -d db
    `;
    await runCommand(sourceConn, startSourceDb);
    console.log('Waiting 10 seconds for containers to initialize...');
    await new Promise(r => setTimeout(r, 10000));

    console.log('\nStep 2: Dumping databases inside Docker containers on Source...');
    const dbDumpCmds = `
      # Dump CRC database
      echo "${CONFIG.source.password}" | sudo -S docker exec ${CONFIG.source.dbContainers.crc} pg_dump -U crc_user -d ${CONFIG.source.databases.crc} -F c -b -f /tmp/crc_db.dump
      echo "${CONFIG.source.password}" | sudo -S docker cp ${CONFIG.source.dbContainers.crc}:/tmp/crc_db.dump /tmp/crc_db.dump
      echo "${CONFIG.source.password}" | sudo -S docker exec ${CONFIG.source.dbContainers.crc} rm -f /tmp/crc_db.dump

      # Dump CMS database
      echo "${CONFIG.source.password}" | sudo -S docker exec ${CONFIG.source.dbContainers.cms} pg_dump -U cms_terax -d ${CONFIG.source.databases.cms} -F c -b -f /tmp/cms_db.dump
      echo "${CONFIG.source.password}" | sudo -S docker cp ${CONFIG.source.dbContainers.cms}:/tmp/cms_db.dump /tmp/cms_db.dump
      echo "${CONFIG.source.password}" | sudo -S docker exec ${CONFIG.source.dbContainers.cms} rm -f /tmp/cms_db.dump
    `;
    await runCommand(sourceConn, dbDumpCmds);
    console.log('✅ Databases dumped successfully on Source Server.');

    console.log('\nStep 3: Archiving code directories (excluding node_modules and .git)...');
    const archiveCmds = `
      tar --exclude='node_modules' --exclude='.git' -czf /tmp/crc_app.tar.gz -C ${path.dirname(CONFIG.source.appDir)} ${path.basename(CONFIG.source.appDir)}
      tar --exclude='node_modules' --exclude='.git' -czf /tmp/cms_app.tar.gz -C ${path.dirname(CONFIG.source.cmsDir)} ${path.basename(CONFIG.source.cmsDir)}
    `;
    await runCommand(sourceConn, archiveCmds);
    console.log('✅ Codebases archived successfully on Source Server.');

    // -------------------------------------------------------------
    // PHASE 2: Download files to local temp dir
    // -------------------------------------------------------------
    console.log('\nStep 4: Downloading database dumps and archives to local temp directory...');
    await downloadFile(sourceConn, '/tmp/crc_db.dump', localCrcDbPath);
    await downloadFile(sourceConn, '/tmp/cms_db.dump', localCmsDbPath);
    await downloadFile(sourceConn, '/tmp/crc_app.tar.gz', localCrcTarPath);
    await downloadFile(sourceConn, '/tmp/cms_app.tar.gz', localCmsTarPath);
    await downloadFile(sourceConn, '/home/alui98hp/add_tenant.sh', localTenantScriptPath);
    await downloadFile(sourceConn, '/home/alui98hp/.ssh/id_ed25519', localPrivateKeyPath);
    await downloadFile(sourceConn, '/home/alui98hp/.ssh/id_ed25519.pub', localPublicKeyPath);

    // Stop and clean up source temporary files
    console.log('\nShutting down containers and cleaning up temporary backup files on Source Server...');
    const sourceCleanup = `
      cd ${CONFIG.source.appDir} && echo "${CONFIG.source.password}" | sudo -S docker compose -f docker-compose.standalone.yml down
      cd ${CONFIG.source.cmsDir} && echo "${CONFIG.source.password}" | sudo -S docker compose down
      echo "${CONFIG.source.password}" | sudo -S rm -f /tmp/crc_db.dump /tmp/cms_db.dump /tmp/crc_app.tar.gz /tmp/cms_app.tar.gz
    `;
    await runCommand(sourceConn, sourceCleanup);
    console.log('✅ Source Server stopped and cleaned of temporary archives.');

    // -------------------------------------------------------------
    // PHASE 3: Connect to Destination Server and Stop/Cleanup Old Work
    // -------------------------------------------------------------
    console.log('\nStep 5: Connecting to Destination Server (10.91.1.51)...');
    targetConn = await connectServer(CONFIG.target, null);
    console.log('✅ Connected to Destination Server!');

    console.log('\nStep 6: Cleaning up previous containers and directories on Destination Server...');
    const cleanupDestCmds = `
      # 1. Stop all containers in /home/terax folders
      if [ -d /home/terax/crc_app ]; then
        cd /home/terax/crc_app
        echo "${CONFIG.target.password}" | sudo -S docker compose -f docker-compose.standalone.yml down || true
      fi
      if [ -d /home/terax/cms_terax ]; then
        cd /home/terax/cms_terax
        echo "${CONFIG.target.password}" | sudo -S docker compose down || true
      fi

      # 2. Stop any other containers matching crc_ or cms_
      echo "${CONFIG.target.password}" | sudo -S docker rm -f $(docker ps -a -q --filter name=crc_) 2>/dev/null || true
      echo "${CONFIG.target.password}" | sudo -S docker rm -f $(docker ps -a -q --filter name=cms_) 2>/dev/null || true

      # 3. Delete directories
      echo "${CONFIG.target.password}" | sudo -S rm -rf /home/terax/crc_app /home/terax/cms_terax
      echo "${CONFIG.target.password}" | sudo -S rm -rf ${CONFIG.target.oldAppDir}
      echo "${CONFIG.target.password}" | sudo -S rm -rf /opt/app/dev

      # 4. Remove Docker networks
      echo "${CONFIG.target.password}" | sudo -S docker network rm crc_app_default || true
      echo "${CONFIG.target.password}" | sudo -S docker network rm cms_terax_default || true
    `;
    await runCommand(targetConn, cleanupDestCmds);
    console.log('✅ Old target environments, networks, and containers cleaned.');

    // -------------------------------------------------------------
    // PHASE 4: Create Destination Paths and Upload files
    // -------------------------------------------------------------
    console.log('\nStep 7: Uploading backups to Destination Server...');
    const setupDirCmd = `
      echo "${CONFIG.target.password}" | sudo -S mkdir -p /opt/app/dev /home/terax/.ssh
      echo "${CONFIG.target.password}" | sudo -S chown -R terax:terax /opt/app/dev /home/terax/.ssh
      chmod 700 /home/terax/.ssh
    `;
    await runCommand(targetConn, setupDirCmd);

    await uploadFile(targetConn, localCrcDbPath, '/tmp/crc_db.dump');
    await uploadFile(targetConn, localCmsDbPath, '/tmp/cms_db.dump');
    await uploadFile(targetConn, localCrcTarPath, '/tmp/crc_app.tar.gz');
    await uploadFile(targetConn, localCmsTarPath, '/tmp/cms_app.tar.gz');
    await uploadFile(targetConn, localTenantScriptPath, '/home/terax/add_tenant.sh');
    await uploadFile(targetConn, localPrivateKeyPath, '/home/terax/.ssh/id_ed25519');
    await uploadFile(targetConn, localPublicKeyPath, '/home/terax/.ssh/id_ed25519.pub');

    // -------------------------------------------------------------
    // PHASE 5: Configure SSH, extract Codebase to /opt/app/dev
    // -------------------------------------------------------------
    console.log('\nStep 8: Configuring SSH authorized keys on Destination Server...');
    const sshSetupCmd = `
      cat /home/terax/.ssh/id_ed25519.pub >> /home/terax/.ssh/authorized_keys
      chmod 600 /home/terax/.ssh/id_ed25519
      chmod 644 /home/terax/.ssh/id_ed25519.pub
      chmod 600 /home/terax/.ssh/authorized_keys
      chown -R terax:terax /home/terax/.ssh
    `;
    await runCommand(targetConn, sshSetupCmd);
    console.log('✅ SSH keys authorized.');

    console.log('\nStep 9: Extracting codebases to /opt/app/dev on Destination Server...');
    const extractCmds = `
      mkdir -p ${CONFIG.target.appDir}
      tar -xzf /tmp/crc_app.tar.gz -C ${CONFIG.target.appDir} --strip-components=1
      rm -f /tmp/crc_app.tar.gz

      mkdir -p ${CONFIG.target.cmsDir}
      tar -xzf /tmp/cms_app.tar.gz -C ${CONFIG.target.cmsDir} --strip-components=1
      rm -f /tmp/cms_app.tar.gz

      chmod +x /home/terax/add_tenant.sh
      chown -R terax:terax /opt/app/dev /home/terax/add_tenant.sh
    `;
    await runCommand(targetConn, extractCmds);
    console.log('✅ Codebases extracted to /opt/app/dev.');

    // -------------------------------------------------------------
    // PHASE 6: Update environment configurations
    // -------------------------------------------------------------
    console.log('\nStep 10: Updating configuration files on Target Server...');
    
    // Update crc_app env file: set DATABASE_URL
    const updateCrcEnv = `
      if [ -f ${CONFIG.target.appDir}/.env ]; then
        sed -i 's|^DATABASE_URL=.*|DATABASE_URL=postgres://crc_user:crc2026@db:5432/crc_db|' ${CONFIG.target.appDir}/.env
        echo "✅ Updated crc_app/.env database URL."
      fi
    `;
    await runCommand(targetConn, updateCrcEnv);

    // Update cms_terax configuration (.env and docker-compose.yml)
    const updateCmsEnv = `
      # Update .env
      if [ -f ${CONFIG.target.cmsDir}/.env ]; then
        sed -i 's|^DATABASE_URL=.*|DATABASE_URL=postgres://cms_terax:cms_secure_2026_terax@db:5432/cms_terax|' ${CONFIG.target.cmsDir}/.env
        sed -i 's|^CRC_DATABASE_URL=.*|CRC_DATABASE_URL=postgres://crc_user:crc2026@10.91.1.51:9999/crc_db|' ${CONFIG.target.cmsDir}/.env
        sed -i 's|^VPS_HOST=.*|VPS_HOST=10.91.1.51|' ${CONFIG.target.cmsDir}/.env
        sed -i 's|^VPS_PORT=.*|VPS_PORT=22|' ${CONFIG.target.cmsDir}/.env
        sed -i 's|^VPS_USER=.*|VPS_USER=terax|' ${CONFIG.target.cmsDir}/.env
        sed -i 's|^VPS_SSH_KEY_PATH=.*|VPS_SSH_KEY_PATH=/root/.ssh/id_ed25519|' ${CONFIG.target.cmsDir}/.env
        sed -i 's|^CRC_TENANT_SYNC_URL=.*|CRC_TENANT_SYNC_URL=https://dev.terax.ai/api/cms/tenant-sync|' ${CONFIG.target.cmsDir}/.env
        echo "✅ Updated cms_terax/.env variables."
      fi

      # Update docker-compose.yml volume mount path from alui98hp to terax
      if [ -f ${CONFIG.target.cmsDir}/docker-compose.yml ]; then
        sed -i 's|/home/alui98hp/.ssh|/home/terax/.ssh|g' ${CONFIG.target.cmsDir}/docker-compose.yml
        echo "✅ Updated cms_terax/docker-compose.yml SSH volume mount path."
      fi
    `;
    await runCommand(targetConn, updateCmsEnv);

    // Update paths in add_tenant.sh on Destination
    const updateAddTenantScript = `
      sed -i 's|/home/alui98hp/crc_app|/opt/app/dev/crc_app|g' /home/terax/add_tenant.sh
      sed -i 's|/home/alui98hp/crc_app/init.sql|/opt/app/dev/crc_app/init.sql|g' /home/terax/add_tenant.sh
      echo "✅ Updated add_tenant.sh script paths."
    `;
    await runCommand(targetConn, updateAddTenantScript);

    // -------------------------------------------------------------
    // PHASE 7: Start Docker Containers sequentially to avoid network label issue
    // -------------------------------------------------------------
    console.log('\nStep 11: Starting CRC containers (which automatically creates network)...');
    const startCrcCmd = `
      cd ${CONFIG.target.appDir}
      echo "${CONFIG.target.password}" | sudo -S docker compose -f docker-compose.standalone.yml up -d --build
    `;
    await runCommand(targetConn, startCrcCmd);

    console.log('\nStep 12: Starting CMS containers (links to created network)...');
    const startCmsCmd = `
      cd ${CONFIG.target.cmsDir}
      echo "${CONFIG.target.password}" | sudo -S docker compose up -d --build
    `;
    await runCommand(targetConn, startCmsCmd);

    // Wait for databases to initialize
    console.log('\nWaiting 15 seconds for PostgreSQL containers to fully start...');
    await new Promise(r => setTimeout(r, 15000));

    // -------------------------------------------------------------
    // PHASE 8: Restore databases inside Destination containers
    // -------------------------------------------------------------
    console.log('\nStep 13: Restoring databases inside target containers...');
    const dbRestoreCmds = `
      # Copy dumps into containers
      echo "${CONFIG.target.password}" | sudo -S docker cp /tmp/crc_db.dump crc_db_standalone:/tmp/crc_db.dump
      echo "${CONFIG.target.password}" | sudo -S docker cp /tmp/cms_db.dump cms_db_standalone:/tmp/cms_db.dump

      # Restore CRC Database
      echo "--- Restoring CRC database ---"
      echo "${CONFIG.target.password}" | sudo -S docker exec crc_db_standalone psql -U crc_user -d postgres -c "SELECT pg_terminate_backend(pg_stat_activity.pid) FROM pg_stat_activity WHERE pg_stat_activity.datname = 'crc_db' AND pid <> pg_backend_pid();"
      echo "${CONFIG.target.password}" | sudo -S docker exec crc_db_standalone psql -U crc_user -d postgres -c "DROP DATABASE IF EXISTS crc_db;"
      echo "${CONFIG.target.password}" | sudo -S docker exec crc_db_standalone psql -U crc_user -d postgres -c "CREATE DATABASE crc_db;"
      echo "${CONFIG.target.password}" | sudo -S docker exec crc_db_standalone pg_restore -U crc_user -d crc_db --no-owner --no-privileges /tmp/crc_db.dump
      echo "${CONFIG.target.password}" | sudo -S docker exec crc_db_standalone rm -f /tmp/crc_db.dump

      # Restore CMS Database
      echo "--- Restoring CMS database ---"
      echo "${CONFIG.target.password}" | sudo -S docker exec cms_db_standalone psql -U cms_terax -d postgres -c "SELECT pg_terminate_backend(pg_stat_activity.pid) FROM pg_stat_activity WHERE pg_stat_activity.datname = 'cms_terax' AND pid <> pg_backend_pid();"
      echo "${CONFIG.target.password}" | sudo -S docker exec cms_db_standalone psql -U cms_terax -d postgres -c "DROP DATABASE IF EXISTS cms_terax;"
      echo "${CONFIG.target.password}" | sudo -S docker exec cms_db_standalone psql -U cms_terax -d postgres -c "CREATE DATABASE cms_terax;"
      echo "${CONFIG.target.password}" | sudo -S docker exec cms_db_standalone pg_restore -U cms_terax -d cms_terax --no-owner --no-privileges /tmp/cms_db.dump
      echo "${CONFIG.target.password}" | sudo -S docker exec cms_db_standalone rm -f /tmp/cms_db.dump

      # Cleanup host temporary dumps
      echo "${CONFIG.target.password}" | sudo -S rm -f /tmp/crc_db.dump /tmp/cms_db.dump
    `;
    await runCommand(targetConn, dbRestoreCmds);
    console.log('✅ Databases structure and data restored.');

    // -------------------------------------------------------------
    // PHASE 9: Update Domain names in Databases
    // -------------------------------------------------------------
    console.log('\nStep 14: Migrating domains to dev.terax.ai / cms.terax.ai...');
    const updateDomainsCmd = `
      # Update CMS database domain mappings
      echo "${CONFIG.target.password}" | sudo -S docker exec cms_db_standalone psql -U cms_terax -d cms_terax -c "
        UPDATE subscriptions SET domain = REPLACE(domain, 'rqc.terax.ai', 'dev.terax.ai') WHERE domain LIKE '%rqc.terax.ai%';
        UPDATE subscriptions SET domain = REPLACE(domain, 'livatech.site', 'dev.terax.ai') WHERE domain LIKE '%livatech.site%';
      "

      # Scan and update CRC Tenant databases
      DB_LIST=$(echo "${CONFIG.target.password}" | sudo -S docker exec -i crc_db_standalone psql -U crc_user -d postgres -t -A -c "SELECT datname FROM pg_database WHERE datname LIKE 'crc_db%';")
      for DB in $DB_LIST; do
        echo "Updating tenant domain mapping in database: \$DB"
        echo "${CONFIG.target.password}" | sudo -S docker exec -i crc_db_standalone psql -U crc_user -d "\$DB" -c "
          UPDATE cms_tenant_info SET tenant_domain = REPLACE(tenant_domain, 'rqc.terax.ai', 'dev.terax.ai') WHERE tenant_domain LIKE '%rqc.terax.ai%';
          UPDATE cms_tenant_info SET tenant_domain = REPLACE(tenant_domain, 'livatech.site', 'dev.terax.ai') WHERE tenant_domain LIKE '%livatech.site%';
        " 2>/dev/null || echo "cms_tenant_info table not present in \$DB"
      done
    `;
    await runCommand(targetConn, updateDomainsCmd);
    console.log('✅ Domains updated successfully in databases.');

    // Restart containers to reload environment variables and apply DB migrations
    console.log('\nStep 15: Restarting app containers to apply changes...');
    const restartCmds = `
      cd ${CONFIG.target.appDir} && echo "${CONFIG.target.password}" | sudo -S docker compose -f docker-compose.standalone.yml restart app
      cd ${CONFIG.target.cmsDir} && echo "${CONFIG.target.password}" | sudo -S docker compose restart app
    `;
    await runCommand(targetConn, restartCmds);
    console.log('✅ Apps restarted.');

    // -------------------------------------------------------------
    // PHASE 10: Verify the new containers are running
    // -------------------------------------------------------------
    console.log('\nStep 16: Verifying container status on Destination Server...');
    await runCommand(targetConn, 'echo "welcome1" | sudo -S docker ps -a');

    console.log('\n==================================================');
    console.log('🎉 DEV SERVER MIGRATION COMPLETED SUCCESSFULLY!');
    console.log('--------------------------------------------------');
    console.log(`🖥️  CRC Web App is running on http://${CONFIG.target.host}:5221 (mapped to dev.terax.ai)`);
    console.log(`📊 CMS Web App is running on http://${CONFIG.target.host}:5300 (mapped to cms.terax.ai)`);
    console.log(`📁 Deployment path: /opt/app/dev`);
    console.log('==================================================\n');

  } catch (error) {
    console.error('\n❌ Migration failed with error:', error);
  } finally {
    if (sourceConn) sourceConn.end();
    if (targetConn) targetConn.end();
    
    // Clean up local temp files
    try {
      if (fs.existsSync(CONFIG.localTempDir)) {
        fs.rmSync(CONFIG.localTempDir, { recursive: true, force: true });
        console.log('🧹 Cleaned up local temporary directory.');
      }
    } catch (e) {}
  }
}

startMigration();
