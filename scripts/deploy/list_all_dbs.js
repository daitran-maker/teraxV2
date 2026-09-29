const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const cmd = `
    docker run --rm postgres:16 sh -c "PGPASSWORD='TeraX123!@#' psql -h 10.91.1.51 -p 30543 -U teraxadmin -d postgres -t -A -c 'SELECT datname FROM pg_database;'"
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
