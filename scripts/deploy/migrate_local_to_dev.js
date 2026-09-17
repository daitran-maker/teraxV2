/**
 * CRC App & CMS Kubernetes Deployment Script
 * Code: Local -> Host -> Built to K3s Containerd
 * Database: K8s PostgreSQL (crc_dev_db & cms_terax)
 * Manifest: /opt/app/dev/k8s-dev-cms.yaml
 *
 * Usage:
 *   node scripts/deploy/migrate_local_to_dev.js
 */

const { execSync } = require('child_process');
const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG = {
  source: {
    host: '100.70.140.42',
    port: 8991,
    username: 'alui98hp',
    password: 'Lee@122598',
    volumes: {
      crc: 'crc_app_pgdata',
      cms: 'cms_terax_pgdata'
    }
  },
  target: {
    host: '10.91.1.51',
    port: 22,
    username: 'terax',
    password: 'welcome1',
    appDir: '/opt/app/dev/crc_app',
    cmsDir: '/opt/app/dev/cms_terax'
  },
  local: {
    workspaceDir: 'c:\\Users\\A Luis\\OneDrive\\Máy tính\\ggantigravity',
    tempDir: path.join(__dirname, '../../backups/local_temp')
  }
};

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
  if (!fs.existsSync(CONFIG.local.tempDir)) {
    fs.mkdirSync(CONFIG.local.tempDir, { recursive: true });
  }

  const localCrcDb = path.join(CONFIG.local.tempDir, 'crc_db.dump');
  const localCmsDb = path.join(CONFIG.local.tempDir, 'cms_db.dump');
  const localCrcTar = path.join(CONFIG.local.tempDir, 'crc_app.tar.gz');
  const localCmsTar = path.join(CONFIG.local.tempDir, 'cms_app.tar.gz');
  const localK8sYaml = path.join(CONFIG.local.workspaceDir, 'CRC_app\\k8s-dev-cms.yaml');

  console.log('\n==================================================');
  console.log('🏁 STARTING COMPLETE KUBERNETES DEPLOYMENT & MIGRATION');
  console.log('==================================================\n');

  let sourceConn, targetConn;

  try {
    // -------------------------------------------------------------
    // PHASE 1: Archive local workspace code
    // -------------------------------------------------------------
    console.log('Step 1: Archiving local codebases...');
    
    console.log(`- Archiving CRC_app -> ${localCrcTar}...`);
    execSync(`tar --exclude=node_modules --exclude=.git --exclude=backups -czf "${localCrcTar}" -C "${CONFIG.local.workspaceDir}" CRC_app`);
    
    console.log(`- Archiving CMS_app -> ${localCmsTar}...`);
    execSync(`tar --exclude=node_modules --exclude=.git -czf "${localCmsTar}" -C "${CONFIG.local.workspaceDir}" CMS_app`);
    
    console.log('✅ Local codebase packages created.');

    // -------------------------------------------------------------
    // PHASE 2: Connect to Source Server and Dump Database Volumes
    // -------------------------------------------------------------
    console.log('\nStep 2: Connecting to Source Server (100.70.140.42)...');
    sourceConn = await connectServer(CONFIG.source, privateKey);
    console.log('✅ Connected to Source Server.');

    console.log('\nStep 3: Creating database backups from source Docker volumes...');
    const sourceDbBackupCmd = `
      # Start temporary postgres containers mounting the data volumes
      echo "${CONFIG.source.password}" | sudo -S docker run -d --name temp_crc_db -v ${CONFIG.source.volumes.crc}:/var/lib/postgresql/data -e POSTGRES_PASSWORD=crc2026 postgres:16
      echo "${CONFIG.source.password}" | sudo -S docker run -d --name temp_cms_db -v ${CONFIG.source.volumes.cms}:/var/lib/postgresql/data -e POSTGRES_PASSWORD=cms_secure_2026_terax postgres:16
      
      echo "Waiting 8 seconds for database engines to start..."
      sleep 8

      # Dump databases inside the containers
      echo "${CONFIG.source.password}" | sudo -S docker exec temp_crc_db pg_dump -U crc_user -d crc_db -F c -b -f /tmp/crc_db.dump
      echo "${CONFIG.source.password}" | sudo -S docker exec temp_cms_db pg_dump -U cms_terax -d cms_terax -F c -b -f /tmp/cms_db.dump

      # Copy dump files from container to host's /tmp
      echo "${CONFIG.source.password}" | sudo -S docker cp temp_crc_db:/tmp/crc_db.dump /tmp/crc_db.dump
      echo "${CONFIG.source.password}" | sudo -S docker cp temp_cms_db:/tmp/cms_db.dump /tmp/cms_db.dump

      # Cleanup temporary containers
      echo "${CONFIG.source.password}" | sudo -S docker rm -f temp_crc_db temp_cms_db
    `;
    await runCommand(sourceConn, sourceDbBackupCmd);
    console.log('✅ Source database dumps completed.');

    // Download dumps to local
    console.log('\nStep 4: Downloading database dumps to local machine...');
    await downloadFile(sourceConn, '/tmp/crc_db.dump', localCrcDb);
    await downloadFile(sourceConn, '/tmp/cms_db.dump', localCmsDb);

    // Clean up tmp on source
    await runCommand(sourceConn, `echo "${CONFIG.source.password}" | sudo -S rm -f /tmp/crc_db.dump /tmp/cms_db.dump`);
    console.log('✅ Source server databases dumped and downloaded.');
    sourceConn.end();
    sourceConn = null;

    // -------------------------------------------------------------
    // PHASE 3: Connect to target server and clean up old setup
    // -------------------------------------------------------------
    console.log('\nStep 5: Connecting to target server 10.91.1.51...');
    targetConn = await connectServer(CONFIG.target);
    console.log('✅ Connected to target server.');

    console.log('\nStep 6: Cleaning up host standalone Docker containers...');
    const cleanupCmd = `
      # Stop existing host-level containers if directories exist
      if [ -d ${CONFIG.target.appDir} ]; then
        cd ${CONFIG.target.appDir} && echo "${CONFIG.target.password}" | sudo -S docker compose -f docker-compose.standalone.yml down || true
      fi
      if [ -d ${CONFIG.target.cmsDir} ]; then
        cd ${CONFIG.target.cmsDir} && echo "${CONFIG.target.password}" | sudo -S docker compose down || true
      fi

      # Force remove any remaining host containers
      echo "${CONFIG.target.password}" | sudo -S docker rm -f $(docker ps -a -q --filter name=crc_) 2>/dev/null || true
      echo "${CONFIG.target.password}" | sudo -S docker rm -f $(docker ps -a -q --filter name=cms_) 2>/dev/null || true

      # Clear old directory structure and old add_tenant.sh
      echo "${CONFIG.target.password}" | sudo -S rm -rf /opt/app/dev /home/terax/add_tenant.sh
    `;
    await runCommand(targetConn, cleanupCmd);

    // -------------------------------------------------------------
    // PHASE 4: Upload and Extract new codebases + K8s Manifest
    // -------------------------------------------------------------
    console.log('\nStep 7: Uploading codebase packages, manifests and database dumps...');
    await uploadFile(targetConn, localCrcTar, '/tmp/crc_app.tar.gz');
    await uploadFile(targetConn, localCmsTar, '/tmp/cms_app.tar.gz');
    await uploadFile(targetConn, localCrcDb, '/tmp/crc_db.dump');
    await uploadFile(targetConn, localCmsDb, '/tmp/cms_db.dump');
    await uploadFile(targetConn, localK8sYaml, '/tmp/k8s-dev-cms.yaml');

    console.log('\nStep 8: Extracting codebases to /opt/app/dev...');
    const extractCmd = `
      echo "${CONFIG.target.password}" | sudo -S mkdir -p /opt/app/dev
      echo "${CONFIG.target.password}" | sudo -S chown -R terax:terax /opt/app/dev
      
      mkdir -p ${CONFIG.target.appDir}
      tar -xzf /tmp/crc_app.tar.gz -C ${CONFIG.target.appDir} --strip-components=1
      rm -f /tmp/crc_app.tar.gz

      mkdir -p ${CONFIG.target.cmsDir}
      tar -xzf /tmp/cms_app.tar.gz -C ${CONFIG.target.cmsDir} --strip-components=1
      rm -f /tmp/cms_app.tar.gz

      # Move K8s manifest
      mv /tmp/k8s-dev-cms.yaml /opt/app/dev/k8s-dev-cms.yaml

      # Copy add_tenant.sh to user home directory
      cp ${CONFIG.target.appDir}/scripts/add_tenant.sh /home/terax/add_tenant.sh
      chmod +x /home/terax/add_tenant.sh
      chown terax:terax /home/terax/add_tenant.sh
      
      # Make sure docker network exists on host for add_tenant
      echo "${CONFIG.target.password}" | sudo -S docker network create crc_app_default || true
      
      chown -R terax:terax /opt/app/dev
    `;
    await runCommand(targetConn, extractCmd);
    console.log('✅ Codebases extracted and environment prepared.');

    // -------------------------------------------------------------
    // PHASE 5: Build Docker images and import into K3s containerd
    // -------------------------------------------------------------
    console.log('\nStep 9: Building and importing Docker images into K3s runtime...');
    const buildImportCmd = `
      # Build CRC Dev Image
      cd ${CONFIG.target.appDir}
      echo "Building crc-dev-app:latest Docker image..."
      docker build -t crc-dev-app:latest .
      echo "Saving and importing crc-dev-app:latest..."
      docker save crc-dev-app:latest -o /tmp/crc-dev-app.tar
      echo "${CONFIG.target.password}" | sudo -S k3s ctr images import /tmp/crc-dev-app.tar
      rm -f /tmp/crc-dev-app.tar

      # Build CMS Image
      cd ${CONFIG.target.cmsDir}
      echo "Building cms-app:latest Docker image..."
      docker build -t cms-app:latest .
      echo "Saving and importing cms-app:latest..."
      docker save cms-app:latest -o /tmp/cms-app.tar
      echo "${CONFIG.target.password}" | sudo -S k3s ctr images import /tmp/cms-app.tar
      rm -f /tmp/cms-app.tar
    `;
    await runCommand(targetConn, buildImportCmd);
    console.log('✅ Docker images built and loaded to K3s successfully.');

    // -------------------------------------------------------------
    // PHASE 6: Restore databases to Kubernetes PostgreSQL
    // -------------------------------------------------------------
    console.log('\nStep 10: Restoring databases to Kubernetes PostgreSQL...');
    const restoreCmd = `
      # Grant read permissions so postgres containers can read the host /tmp files
      chmod 644 /tmp/crc_db.dump /tmp/cms_db.dump

      # 1. Restore CRC Dev Database to crc_dev_db
      echo "--- Restoring CRC -> crc_dev_db on K8s ---"
      # Drop and recreate database crc_dev_db
      docker run --rm postgres:16 sh -c 'PGPASSWORD="TeraX123!@#" psql -h 10.91.1.51 -p 30543 -U teraxadmin -d postgres -c "DROP DATABASE IF EXISTS crc_dev_db; CREATE DATABASE crc_dev_db;"'
      # Restore dump
      docker run --rm -v /tmp:/tmp postgres:16 sh -c 'PGPASSWORD="TeraX123!@#" pg_restore -h 10.91.1.51 -p 30543 -U teraxadmin -d crc_dev_db --no-owner --no-privileges /tmp/crc_db.dump'

      # 2. Restore CMS Database to cms_terax
      echo "--- Restoring CMS -> cms_terax on K8s ---"
      # Drop and recreate cms_terax database
      docker run --rm postgres:16 sh -c 'PGPASSWORD="TeraX123!@#" psql -h 10.91.1.51 -p 30543 -U teraxadmin -d postgres -c "DROP DATABASE IF EXISTS cms_terax; CREATE DATABASE cms_terax;"'
      # Restore dump
      docker run --rm -v /tmp:/tmp postgres:16 sh -c 'PGPASSWORD="TeraX123!@#" pg_restore -h 10.91.1.51 -p 30543 -U teraxadmin -d cms_terax --no-owner --no-privileges /tmp/cms_db.dump'

      # Cleanup host backups
      rm -f /tmp/crc_db.dump /tmp/cms_db.dump
    `;
    await runCommand(targetConn, restoreCmd);
    console.log('✅ Databases structure and data restored to Kubernetes.');

    // -------------------------------------------------------------
    // PHASE 7: Update domain names inside K8s databases
    // -------------------------------------------------------------
    console.log('\nStep 11: Updating domain redirects inside Kubernetes databases...');
    const updateDomains = `
      # Update CMS database domain mappings
      docker run --rm -i postgres:16 sh -c 'PGPASSWORD="TeraX123!@#" psql -h 10.91.1.51 -p 30543 -U teraxadmin -d cms_terax' << 'EOF'
UPDATE subscriptions SET domain = REPLACE(domain, 'rqc.terax.ai', 'dev.terax.ai') WHERE domain LIKE '%rqc.terax.ai%';
UPDATE subscriptions SET domain = REPLACE(domain, 'livatech.site', 'dev.terax.ai') WHERE domain LIKE '%livatech.site%';
EOF

      # Update CRC Dev database domain mappings directly
      docker run --rm -i postgres:16 sh -c 'PGPASSWORD="TeraX123!@#" psql -h 10.91.1.51 -p 30543 -U teraxadmin -d crc_dev_db' << 'EOF'
UPDATE cms_tenant_info SET tenant_domain = REPLACE(tenant_domain, 'rqc.terax.ai', 'dev.terax.ai') WHERE tenant_domain LIKE '%rqc.terax.ai%';
UPDATE cms_tenant_info SET tenant_domain = REPLACE(tenant_domain, 'livatech.site', 'dev.terax.ai') WHERE tenant_domain LIKE '%livatech.site%';
EOF
    `;
    await runCommand(targetConn, updateDomains);
    console.log('✅ Domain mappings updated in databases.');

    // -------------------------------------------------------------
    // PHASE 8: Deploy K8s manifests
    // -------------------------------------------------------------
    console.log('\nStep 12: Applying K8s manifests...');
    const applyK8sManifest = `
      echo "${CONFIG.target.password}" | sudo -S kubectl apply -f /opt/app/dev/k8s-dev-cms.yaml
    `;
    await runCommand(targetConn, applyK8sManifest);
    console.log('✅ K8s manifests applied successfully.');

    // -------------------------------------------------------------
    // PHASE 9: Verify running K8s components
    // -------------------------------------------------------------
    console.log('\nStep 13: Verifying active K8s pods and services...');
    await runCommand(targetConn, 'echo "welcome1" | sudo -S kubectl get pods -A -o wide');
    await runCommand(targetConn, 'echo "welcome1" | sudo -S kubectl get svc -A -o wide');

    console.log('\n==================================================');
    console.log('🎉 COMPLETE KUBERNETES DEPLOYMENT COMPLETED SUCCESSFULLY!');
    console.log('--------------------------------------------------');
    console.log(`🖥️  CRC Dev App -> http://${CONFIG.target.host}:5222 (Internal K8s LoadBalancer, mapped to dev.terax.ai)`);
    console.log(`📊 CMS App -> http://${CONFIG.target.host}:5300 (Internal K8s LoadBalancer, mapped to cms.terax.ai)`);
    console.log(`🗄️  Database -> Kubernetes PostgreSQL (crc_dev_db on 30543)`);
    console.log(`📁 Deployment path: /opt/app/dev`);
    console.log('==================================================\n');

  } catch (error) {
    console.error('\n❌ Complete migration failed:', error);
  } finally {
    if (sourceConn) sourceConn.end();
    if (targetConn) targetConn.end();
    
    // Clean up local temp archives
    try {
      if (fs.existsSync(CONFIG.local.tempDir)) {
        fs.rmSync(CONFIG.local.tempDir, { recursive: true, force: true });
        console.log('🧹 Cleaned up local temporary directory.');
      }
    } catch (e) {}
  }
}

startMigration();
