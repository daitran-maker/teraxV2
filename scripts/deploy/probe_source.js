const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');
const os = require('os');

const conn = new Client();
conn.on('ready', () => {
  const cmd = `
    echo "=== Docker Volumes on 100.70.140.42 ==="
    echo "Lee@122598" | sudo -S docker volume ls || true
  `;
  conn.exec(cmd, (err, stream) => {
    stream.on('close', () => conn.end())
      .on('data', (data) => process.stdout.write(data.toString()))
      .stderr.on('data', (data) => process.stderr.write(data.toString()));
  });
});

const keyPath = path.join(os.homedir(), '.ssh', 'id_ed25519');
const privateKey = fs.existsSync(keyPath) ? fs.readFileSync(keyPath) : null;

conn.connect({
  host: '100.70.140.42',
  port: 8991,
  username: 'alui98hp',
  password: 'Lee@122598',
  privateKey: privateKey,
  tryKeyboardInteractive: true,
  readyTimeout: 30000
});
