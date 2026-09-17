/**
 * CRC_app Server Migration Script (Bridge Method)
 * Migrates code and database from old server (100.70.140.42) to new server (10.91.1.51)
 * Run this locally from your project workspace:
 *   node scripts/deploy/migrate_servers.js
 */

const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Configuration
const CONFIG = {
  source: {
    host: '100.70.140.42',
    port: 8991,
    username: 'alui98hp',
    password: 'Lee@122598',
    dbContainer: 'crc_db_standalone',
    dbUser: 'crc_user',
    dbName: 'crc_db',
    appDir: '/home/alui98hp/crc_app'
  },
  target: {
    host: '10.91.1.51',
    port: 22,
    username: 'root',
    password: 'welcome1',
    fallbackUsername: 'terax',
    fallbackPassword: 'welcome1',
    appDir: '/opt/app/terax',
    postgresService: 'terax-postgres-service',
    postgresDb: 'teraxdb',
    postgresUser: 'teraxadmin',
    postgresPass: 'TeraX123!@#',
    postgresNodePort: 30543
  },
  localTempDir: path.join(os.tmpdir(), 'crc_migration')
};

// SSH Private Key Loader
function loadPrivateKey() {
  const keyPath = path.join(os.homedir(), '.ssh', 'id_ed25519');
  if (fs.existsSync(keyPath)) {
    console.log(`🔑 Loaded SSH private key from: ${keyPath}`);
    return fs.readFileSync(keyPath);
  }
  console.log('⚠️ No id_ed25519 private key found, relying on passwords.');
  return null;
}

const privateKey = loadPrivateKey();

// Helper: Run command on SSH client
function runCommand(conn, cmd, password = null) {
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

// Helper: SFTP Download File
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

// Helper: SFTP Upload File
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

// Create connection
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
  // Ensure local temp dir exists
  if (!fs.existsSync(CONFIG.localTempDir)) {
    fs.mkdirSync(CONFIG.localTempDir, { recursive: true });
  }

  const localDumpPath = path.join(CONFIG.localTempDir, 'crc_db_backup.dump');
  const localTarPath = path.join(CONFIG.localTempDir, 'crc_app_backup.tar.gz');

  console.log('\n==================================================');
  console.log('🏁 STARTING CRC_APP SERVER-TO-SERVER MIGRATION');
  console.log('==================================================\n');

  let sourceConn, targetConn;

  try {
    // -------------------------------------------------------------
    // PHASE 1: Connect to Source Server and Backup Database & Code
    // -------------------------------------------------------------
    console.log('Step 1: Connecting to Source Server (100.70.140.42)...');
    sourceConn = await connectServer(CONFIG.source, privateKey);
    console.log('✅ Connected to Source Server!');

    console.log('\nStep 2: Dumping PostgreSQL database inside Docker container...');
    const dbBackupCmd = `
      echo "${CONFIG.source.password}" | sudo -S docker exec ${CONFIG.source.dbContainer} pg_dump -U ${CONFIG.source.dbUser} -d ${CONFIG.source.dbName} -F c -b -f /tmp/crc_db_backup.dump
      echo "${CONFIG.source.password}" | sudo -S docker cp ${CONFIG.source.dbContainer}:/tmp/crc_db_backup.dump ~/crc_db_backup.dump
      echo "${CONFIG.source.password}" | sudo -S docker exec ${CONFIG.source.dbContainer} rm /tmp/crc_db_backup.dump
    `;
    await runCommand(sourceConn, dbBackupCmd);
    console.log('✅ Database dumped to ~/crc_db_backup.dump');

    console.log('\nStep 3: Archiving code directory (excluding node_modules)...');
    const tarCmd = `
      tar --exclude='node_modules' --exclude='.git' -czf ~/crc_app_backup.tar.gz -C ${path.dirname(CONFIG.source.appDir)} ${path.basename(CONFIG.source.appDir)}
    `;
    await runCommand(sourceConn, tarCmd);
    console.log('✅ Code archived to ~/crc_app_backup.tar.gz');

    // -------------------------------------------------------------
    // PHASE 2: Download Backups to Local Machine
    // -------------------------------------------------------------
    console.log('\nStep 4: Downloading database dump to local temp directory...');
    await downloadFile(sourceConn, `${os.userInfo().username === 'alui98hp' ? '~' : '/home/alui98hp'}/crc_db_backup.dump`, localDumpPath);

    console.log('\nStep 5: Downloading code archive to local temp directory...');
    await downloadFile(sourceConn, `${os.userInfo().username === 'alui98hp' ? '~' : '/home/alui98hp'}/crc_app_backup.tar.gz`, localTarPath);

    // Clean source temporary files
    console.log('\nCleaning up temporary backup files on Source Server...');
    await runCommand(sourceConn, 'rm -f ~/crc_db_backup.dump ~/crc_app_backup.tar.gz');
    sourceConn.end();
    console.log('✅ Source Server cleaned and connection closed.');

    // -------------------------------------------------------------
    // PHASE 3: Connect to Target Server and Upload Backups
    // -------------------------------------------------------------
    console.log('\nStep 6: Connecting to Target Server (10.91.1.51)...');
    let activeUser = CONFIG.target.username;
    try {
      targetConn = await connectServer(CONFIG.target, null); // Password only
      console.log(`✅ Connected to Target Server as ${activeUser}!`);
    } catch (err) {
      console.log(`⚠️ Connection as root failed: ${err.message}. Falling back to ${CONFIG.target.fallbackUsername}...`);
      activeUser = CONFIG.target.fallbackUsername;
      const fallbackConfig = {
        ...CONFIG.target,
        username: CONFIG.target.fallbackUsername,
        password: CONFIG.target.fallbackPassword
      };
      targetConn = await connectServer(fallbackConfig, null);
      console.log(`✅ Connected to Target Server as ${activeUser}!`);
    }

    const sudoPrefix = activeUser === 'root' ? '' : `echo "${CONFIG.target.fallbackPassword}" | sudo -S `;
    const remoteDumpPath = activeUser === 'root' ? '/root/crc_db_backup.dump' : '/home/terax/crc_db_backup.dump';
    const remoteTarPath = activeUser === 'root' ? '/root/crc_app_backup.tar.gz' : '/home/terax/crc_app_backup.tar.gz';

    console.log('\nStep 7: Uploading database dump to Target Server...');
    await uploadFile(targetConn, localDumpPath, remoteDumpPath);

    console.log('\nStep 8: Uploading code archive to Target Server...');
    await uploadFile(targetConn, localTarPath, remoteTarPath);

    // -------------------------------------------------------------
    // PHASE 4: Extract Code, Configure Environment, and Restore DB
    // -------------------------------------------------------------
    console.log('\nStep 9: Extracting code directory on Target Server...');
    const extractCmd = `
      ${sudoPrefix}mkdir -p ${CONFIG.target.appDir}
      ${sudoPrefix}chown -R ${activeUser}:${activeUser} ${CONFIG.target.appDir}
      ${sudoPrefix}tar -xzf ${remoteTarPath} -C ${CONFIG.target.appDir} --strip-components=1
      ${sudoPrefix}rm -f ${remoteTarPath}
    `;
    await runCommand(targetConn, extractCmd);
    console.log(`✅ Code extracted to ${CONFIG.target.appDir}`);

    console.log('\nStep 10: Updating .env file on Target Server...');
    const encodedPass = encodeURIComponent(CONFIG.target.postgresPass);
    const newDbUrl = `postgres://${CONFIG.target.postgresUser}:${encodedPass}@${CONFIG.target.host}:${CONFIG.target.postgresNodePort}/${CONFIG.target.postgresDb}`;
    const envUpdateCmd = `
      if [ -f ${CONFIG.target.appDir}/.env ]; then
        ${sudoPrefix}sed -i 's|^DATABASE_URL=.*|DATABASE_URL=${newDbUrl}|' ${CONFIG.target.appDir}/.env
        echo "✅ Updated existing .env file with new database URL."
      else
        ${sudoPrefix}cp ${CONFIG.target.appDir}/.env.example ${CONFIG.target.appDir}/.env
        ${sudoPrefix}sed -i 's|^DATABASE_URL=.*|DATABASE_URL=${newDbUrl}|' ${CONFIG.target.appDir}/.env
        echo "✅ Created .env from example and updated database URL."
      fi
    `;
    await runCommand(targetConn, envUpdateCmd);

    console.log('\nStep 11: Generating and Uploading Unified Kubernetes Manifest to Target Server...');
    const k8sManifestContent = `apiVersion: v1
kind: Secret
metadata:
  name: crc-app-env
  namespace: default
  labels:
    app: crc-web-app
type: Opaque
stringData:
  DATABASE_URL: "${newDbUrl}"
  PORT: "5221"
  JWT_SECRET: "f61b0048e7ecc1456badb69a872b51b6ad2f092041482dd5d19f3c3bafa8e25127aa6416bb88df3d0d44f157496184f195c3145014f20ac430f912cf14484400"
  TUNNEL_TOKEN: "eyJhIjoiN2NiYjQ2ZDllOTdkOGZlMmU2NTkwYWMwZTU1ODMzZTgiLCJ0IjoiM2Q2ZDMzNjEtMTBhYi00ODZkLWFlY2YtZWNkMzkyMTJhNzIwIiwicyI6Ik1tTmpZVFUxWVdJdE9ETTJNQzAwWkdJd0xUZzFZell0T0ROallUY3pORGt4WWpRMyJ9"
  CMS_HMAC_SECRET: "0a36c944128c6d1845b2d91ba26f4b62d1aa397469b0a7188858715984b54757"
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: crc-app-deployment
  namespace: default
  labels:
    app: crc-web-app
spec:
  replicas: 1
  selector:
    matchLabels:
      app: crc-web-app
  template:
    metadata:
      labels:
        app: crc-web-app
    spec:
      containers:
        - name: crc-web-app
          image: crc-web-app:latest
          imagePullPolicy: IfNotPresent
          ports:
            - containerPort: 5221
          envFrom:
            - secretRef:
                name: crc-app-env
          resources:
            limits:
              memory: "1Gi"
              cpu: "1000m"
            requests:
              memory: "256Mi"
              cpu: "100m"
---
apiVersion: v1
kind: Service
metadata:
  name: crc-app-service
  namespace: default
  labels:
    app: crc-web-app
spec:
  type: LoadBalancer
  selector:
    app: crc-web-app
  ports:
    - name: http
      port: 5221
      targetPort: 5221
      protocol: TCP
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: pod-viewer
  namespace: default
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: pod-viewer-role
rules:
- apiGroups: [""]
  resources: ["pods", "pods/log", "nodes"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["apps"]
  resources: ["deployments", "replicasets", "daemonsets", "statefulsets"]
  verbs: ["get"]
- apiGroups: ["batch"]
  resources: ["jobs", "cronjobs"]
  verbs: ["get"]
- apiGroups: ["metrics.k8s.io"]
  resources: ["pods"]
  verbs: ["get", "list"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: pod-viewer-binding
subjects:
- kind: ServiceAccount
  name: pod-viewer
  namespace: default
roleRef:
  kind: ClusterRole
  name: pod-viewer-role
  apiGroup: rbac.authorization.k8s.io
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: dozzle-deployment
  namespace: default
  labels:
    app: dozzle
spec:
  replicas: 1
  selector:
    matchLabels:
      app: dozzle
  template:
    metadata:
      labels:
        app: dozzle
    spec:
      serviceAccountName: pod-viewer
      containers:
      - name: dozzle
        image: amir20/dozzle:latest
        env:
        - name: DOZZLE_MODE
          value: "k8s"
        ports:
        - containerPort: 8080
        resources:
          limits:
            memory: "256Mi"
            cpu: "500m"
          requests:
            memory: "64Mi"
            cpu: "50m"
---
apiVersion: v1
kind: Service
metadata:
  name: dozzle-service
  namespace: default
  labels:
    app: dozzle
spec:
  type: LoadBalancer
  selector:
    app: dozzle
  ports:
    - name: http
      port: 8080
      targetPort: 8080
      protocol: TCP
`;
    const localManifestPath = path.join(CONFIG.localTempDir, 'k8s-manifest.yaml');
    fs.writeFileSync(localManifestPath, k8sManifestContent);

    // Clean up old k8s/ directory on target and ensure folder ownership
    await runCommand(targetConn, `${sudoPrefix}rm -rf ${CONFIG.target.appDir}/k8s && ${sudoPrefix}mkdir -p ${CONFIG.target.appDir} && ${sudoPrefix}chown -R ${activeUser}:${activeUser} ${CONFIG.target.appDir}`);

    // Upload unified manifest directly to app root directory
    await uploadFile(targetConn, localManifestPath, `${CONFIG.target.appDir}/k8s-manifest.yaml`);
    console.log('✅ Unified Kubernetes manifest uploaded to target.');

    console.log('\nStep 12: Restoring Database to Kubernetes PostgreSQL on Target Server...');
    const dbRestoreCmd = `
      # 1. Get Kubernetes postgres pod name
      POD_NAME=$(${sudoPrefix}kubectl get pods -l app=postgres -o jsonpath="{.items[0].metadata.name}")
      echo "Postgres Pod Name: $POD_NAME"
      
      # 2. Copy dump file into container
      ${sudoPrefix}kubectl cp ${remoteDumpPath} default/$POD_NAME:/tmp/crc_db_backup.dump
      
      # 3. Terminate active DB connections, recreate database to ensure completely clean slate
      ${sudoPrefix}kubectl exec -i $POD_NAME -- env PGPASSWORD="${CONFIG.target.postgresPass}" psql -U ${CONFIG.target.postgresUser} -d postgres -c "SELECT pg_terminate_backend(pg_stat_activity.pid) FROM pg_stat_activity WHERE pg_stat_activity.datname = '${CONFIG.target.postgresDb}' AND pid <> pg_backend_pid();"
      ${sudoPrefix}kubectl exec -i $POD_NAME -- env PGPASSWORD="${CONFIG.target.postgresPass}" psql -U ${CONFIG.target.postgresUser} -d postgres -c "DROP DATABASE IF EXISTS ${CONFIG.target.postgresDb};"
      ${sudoPrefix}kubectl exec -i $POD_NAME -- env PGPASSWORD="${CONFIG.target.postgresPass}" psql -U ${CONFIG.target.postgresUser} -d postgres -c "CREATE DATABASE ${CONFIG.target.postgresDb};"
      
      # 4. Restore custom dump
      echo "Restoring database structure & data..."
      ${sudoPrefix}kubectl exec -i $POD_NAME -- env PGPASSWORD="${CONFIG.target.postgresPass}" pg_restore -U ${CONFIG.target.postgresUser} -d ${CONFIG.target.postgresDb} --no-owner --no-privileges /tmp/crc_db_backup.dump
      
      # 5. Clean up temporary dump inside container and host
      ${sudoPrefix}kubectl exec -i $POD_NAME -- rm -f /tmp/crc_db_backup.dump
      ${sudoPrefix}rm -f ${remoteDumpPath}
      echo "✅ Database restored successfully!"
    `;
    await runCommand(targetConn, dbRestoreCmd);

    // -------------------------------------------------------------
    // PHASE 5: Build image and deploy on K3s
    // -------------------------------------------------------------
    console.log('\nStep 13: Building Docker image and importing to K3s containerd...');
    const buildAndImportCmd = `
      cd ${CONFIG.target.appDir}
      ${sudoPrefix}docker build -t crc-web-app:latest .
      ${sudoPrefix}docker save crc-web-app:latest -o /tmp/crc-web-app.tar
      ${sudoPrefix}k3s ctr -n k8s.io images import /tmp/crc-web-app.tar
      ${sudoPrefix}rm -f /tmp/crc-web-app.tar
    `;
    await runCommand(targetConn, buildAndImportCmd);
    console.log('✅ Image imported to containerd!');

    console.log('\nStep 14: Applying Kubernetes manifests...');
    const k8sDeployCmd = `
      ${sudoPrefix}kubectl apply -f ${CONFIG.target.appDir}/k8s-manifest.yaml
      ${sudoPrefix}kubectl rollout restart deployment/crc-app-deployment
    `;
    await runCommand(targetConn, k8sDeployCmd);
    console.log('✅ Kubernetes resources applied!');

    console.log('\n==================================================');
    console.log('🎉 KUBERNETES MIGRATION COMPLETED SUCCESSFULLY!');
    console.log('--------------------------------------------------');
    console.log(`🖥️  CRC_app is exposed on http://${CONFIG.target.host}:5221`);
    console.log(`📊 Dozzle log viewer is running on http://${CONFIG.target.host}:8080`);
    console.log(`🐘 pgAdmin is accessible on http://${CONFIG.target.host}:31764 (Public) / 5050 (Private)`);
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
    } catch (e) {
      // Ignore cleanup error
    }
  }
}

startMigration();
