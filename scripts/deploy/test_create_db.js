const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const cmd = `
    docker run --rm postgres:16 sh -c "PGPASSWORD='TeraX123!@#' psql -h 10.91.1.51 -p 30543 -U teraxadmin -d postgres -c 'DROP DATABASE IF EXISTS crc_dev_db;'"
    docker run --rm postgres:16 sh -c "PGPASSWORD='TeraX123!@#' psql -h 10.91.1.51 -p 30543 -U teraxadmin -d postgres -c 'CREATE DATABASE crc_dev_db;'"
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
