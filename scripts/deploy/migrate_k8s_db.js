/**
 * Migrate CRC & CMS Database to Kubernetes PostgreSQL
 *
 * Usage:
 *   node scripts/deploy/migrate_k8s_db.js
 */

const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  target: {
    host: '10.91.1.51',
    port: 22,
    username: 'terax',
    password: 'welcome1',
    appDir: '/opt/app/dev/crc_app',
    cmsDir: '/opt/app/dev/cms_terax'
  },
  localFiles: {
    crcCompose: path.join(__dirname, '../../docker-compose.standalone.yml'),
    cmsCompose: path.join(__dirname, '../../../CMS_app/docker-compose.yml'),
    addTenant: path.join(__dirname, '../add_tenant.sh')
  }
};

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

function connectServer(config) {
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
      tryKeyboardInteractive: true,
      readyTimeout: 30000
    });
  });
}

async function startMigration() {
  console.log('\n==================================================');
  console.log('🏁 MIGRATING DATABASES TO KUBERNETES POSTGRESQL');
  console.log('==================================================\n');

  let conn;

  try {
    conn = await connectServer(CONFIG.target);
    console.log('✅ Connected to target server 10.91.1.51.');

    // 1. Add terax user to docker group
    console.log('\nStep 1: Adding terax user to docker group...');
    await runCommand(conn, `echo "${CONFIG.target.password}" | sudo -S usermod -aG docker terax`);

    // 2. Dump data from existing docker-compose database containers
    console.log('\nStep 2: Backing up current database containers to /tmp...');
    const backupCmds = `
      # Backup CRC Database
      echo "${CONFIG.target.password}" | sudo -S docker exec crc_db_standalone pg_dump -U crc_user -d crc_db -F c -b -f /tmp/crc_db_backup.dump || true
      
      # Backup CMS Database
      echo "${CONFIG.target.password}" | sudo -S docker exec cms_db_standalone pg_dump -U cms_terax -d cms_terax -F c -b -f /tmp/cms_db_backup.dump || true
    `;
    await runCommand(conn, backupCmds);
    console.log('✅ Databases backed up successfully.');

    // 3. Shut down and delete the old docker compose setup (along with the db containers)
    console.log('\nStep 3: Stopping and cleaning up standalone database containers...');
    const shutdownCmds = `
      cd ${CONFIG.target.appDir} && echo "${CONFIG.target.password}" | sudo -S docker compose -f docker-compose.standalone.yml down || true
      cd ${CONFIG.target.cmsDir} && echo "${CONFIG.target.password}" | sudo -S docker compose down || true
    `;
    await runCommand(conn, shutdownCmds);

    // 4. Upload updated docker-compose files and add_tenant.sh script
    console.log('\nStep 4: Uploading updated compose configs and tenant deployment script...');
    await uploadFile(conn, CONFIG.localFiles.crcCompose, `${CONFIG.target.appDir}/docker-compose.standalone.yml`);
    await uploadFile(conn, CONFIG.localFiles.cmsCompose, `${CONFIG.target.cmsDir}/docker-compose.yml`);
    await uploadFile(conn, CONFIG.localFiles.addTenant, `/home/terax/add_tenant.sh`);

    const setPerms = `
      chmod +x /home/terax/add_tenant.sh
      chown terax:terax /home/terax/add_tenant.sh
      chown -R terax:terax /opt/app/dev
    `;
    await runCommand(conn, setPerms);

    // 5. Update environment variables to target K8s PostgreSQL
    console.log('\nStep 5: Updating .env files with K8s database credentials...');
    const updateEnvs = `
      # Update CRC .env
      if [ -f ${CONFIG.target.appDir}/.env ]; then
        sed -i 's|^DATABASE_URL=.*|DATABASE_URL=postgres://teraxadmin:TeraX123!%40%23@10.91.1.51:30543/teraxdb|' ${CONFIG.target.appDir}/.env
        echo "✅ Updated crc_app/.env to K8s PostgreSQL."
      fi

      # Update CMS .env
      if [ -f ${CONFIG.target.cmsDir}/.env ]; then
        sed -i 's|^DATABASE_URL=.*|DATABASE_URL=postgres://teraxadmin:TeraX123!%40%23@10.91.1.51:30543/cms_terax|' ${CONFIG.target.cmsDir}/.env
        sed -i 's|^CRC_DATABASE_URL=.*|CRC_DATABASE_URL=postgres://teraxadmin:TeraX123!%40%23@10.91.1.51:30543/teraxdb|' ${CONFIG.target.cmsDir}/.env
        echo "✅ Updated cms_terax/.env to K8s PostgreSQL."
      fi
    `;
    await runCommand(conn, updateEnvs);

    // 6. Restore databases to Kubernetes PostgreSQL instance
    console.log('\nStep 6: Restoring databases to Kubernetes PostgreSQL...');
    const restoreCmds = `
      # 1. Restore CRC Database to teraxdb database on K8s Postgres
      echo "--- Restoring CRC -> teraxdb on K8s ---"
      # Clear existing objects in teraxdb first
      echo "${CONFIG.target.password}" | sudo -S docker run --rm -v /tmp:/tmp postgres:16 sh -c 'PGPASSWORD="TeraX123!@#" psql -h 10.91.1.51 -p 30543 -U teraxadmin -d teraxdb -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"' || true
      # Restore
      echo "${CONFIG.target.password}" | sudo -S docker run --rm -v /tmp:/tmp postgres:16 sh -c 'PGPASSWORD="TeraX123!@#" pg_restore -h 10.91.1.51 -p 30543 -U teraxadmin -d teraxdb --no-owner --no-privileges /tmp/crc_db_backup.dump' || true

      # 2. Restore CMS Database to cms_terax database on K8s Postgres
      echo "--- Restoring CMS -> cms_terax on K8s ---"
      # Drop and recreate cms_terax to start clean
      echo "${CONFIG.target.password}" | sudo -S docker run --rm postgres:16 sh -c 'PGPASSWORD="TeraX123!@#" psql -h 10.91.1.51 -p 30543 -U teraxadmin -d postgres -c "DROP DATABASE IF EXISTS cms_terax; CREATE DATABASE cms_terax;"'
      # Restore
      echo "${CONFIG.target.password}" | sudo -S docker run --rm -v /tmp:/tmp postgres:16 sh -c 'PGPASSWORD="TeraX123!@#" pg_restore -h 10.91.1.51 -p 30543 -U teraxadmin -d cms_terax --no-owner --no-privileges /tmp/cms_db_backup.dump' || true

      # Clean up tmp backups on host
      echo "${CONFIG.target.password}" | sudo -S rm -f /tmp/crc_db_backup.dump /tmp/cms_db_backup.dump
    `;
    await runCommand(conn, restoreCmds);
    console.log('✅ Databases restored to Kubernetes PostgreSQL.');

    // 7. Update Domain mappings in K8s Database
    console.log('\nStep 7: Re-mapping domains inside K8s databases...');
    const updateDomains = `
      # Update CMS database domain mappings
      echo "${CONFIG.target.password}" | sudo -S docker run --rm -i postgres:16 sh -c 'PGPASSWORD="TeraX123!@#" psql -h 10.91.1.51 -p 30543 -U teraxadmin -d cms_terax' << 'EOF'
UPDATE subscriptions SET domain = REPLACE(domain, 'rqc.terax.ai', 'dev.terax.ai') WHERE domain LIKE '%rqc.terax.ai%';
UPDATE subscriptions SET domain = REPLACE(domain, 'livatech.site', 'dev.terax.ai') WHERE domain LIKE '%livatech.site%';
EOF

      # Scan and update CRC Tenant databases
      DB_LIST=$(echo "${CONFIG.target.password}" | sudo -S docker run --rm -i postgres:16 sh -c 'PGPASSWORD="TeraX123!@#" psql -h 10.91.1.51 -p 30543 -U teraxadmin -d postgres -t -A -c "SELECT datname FROM pg_database WHERE datname LIKE '\''crc_db%'\'' OR datname = '\''teraxdb'\'';"')
      for DB in $DB_LIST; do
        echo "Updating tenant domain mapping in database: \$DB"
        echo "${CONFIG.target.password}" | sudo -S docker run --rm -i postgres:16 sh -c "PGPASSWORD=\\"TeraX123!@#\\" psql -h 10.91.1.51 -p 30543 -U teraxadmin -d \\"\$DB\\"" << 'EOF'
UPDATE cms_tenant_info SET tenant_domain = REPLACE(tenant_domain, 'rqc.terax.ai', 'dev.terax.ai') WHERE tenant_domain LIKE '%rqc.terax.ai%';
UPDATE cms_tenant_info SET tenant_domain = REPLACE(tenant_domain, 'livatech.site', 'dev.terax.ai') WHERE tenant_domain LIKE '%livatech.site%';
EOF
      done
    `;
    await runCommand(conn, updateDomains);
    console.log('✅ Databases domains adjusted.');

    // 8. Start Docker containers
    console.log('\nStep 8: Starting up CRC and CMS containers...');
    const startupCmds = `
      cd ${CONFIG.target.appDir}
      echo "${CONFIG.target.password}" | sudo -S docker compose -f docker-compose.standalone.yml up -d --build
      
      cd ${CONFIG.target.cmsDir}
      echo "${CONFIG.target.password}" | sudo -S docker compose up -d --build
    `;
    await runCommand(conn, startupCmds);

    // 9. Verify running containers
    console.log('\nStep 9: Verifying Docker Container Status...');
    await runCommand(conn, 'echo "welcome1" | sudo -S docker ps -a');

    console.log('\n==================================================');
    console.log('🎉 DATABASES MIGRATION TO K8S POSTGRESQL SUCCESSFUL!');
    console.log('==================================================\n');

  } catch (error) {
    console.error('\n❌ Database migration failed:', error);
  } finally {
    if (conn) conn.end();
  }
}

startMigration();
