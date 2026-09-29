const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const cmd = `
    echo "=== Granting global read permissions to dumps ==="
    echo "welcome1" | sudo -S chmod 644 /tmp/crc_db.dump /tmp/cms_db.dump || true
    
    echo "=== Running CRC restore ==="
    docker run --rm -v /tmp:/tmp postgres:16 sh -c 'PGPASSWORD="TeraX123!@#" pg_restore -h 10.91.1.51 -p 30543 -U teraxadmin -d crc_dev_db --no-owner --no-privileges /tmp/crc_db.dump'
  `;
  conn.exec(cmd, (err, stream) => {
    stream.on('close', () => conn.end())
      .on('data', (data) => process.stdout.write(data.toString()))
      .stderr.on('data', (data) => process.stderr.write(data.toString()));
  });
});
conn.connect({
  host: '10.91.1.51',
  port: 22,
  username: 'terax',
  password: 'welcome1',
  tryKeyboardInteractive: true,
  readyTimeout: 30000
});
