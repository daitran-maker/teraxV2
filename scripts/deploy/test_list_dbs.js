const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const cmd = `
    echo "=== Listing Databases via K8s Postgres ==="
    DB_LIST=\$(docker run --rm postgres:16 sh -c "PGPASSWORD='TeraX123!@#' psql -h 10.91.1.51 -p 30543 -U teraxadmin -d postgres -t -A -c \\"SELECT datname FROM pg_database WHERE datname LIKE 'crc_db%' OR datname = 'crc_dev_db';\\"")
    echo "Databases found: \$DB_LIST"
    
    for DB in \$DB_LIST; do
      echo "Updating database: \$DB"
      docker run --rm postgres:16 sh -c "PGPASSWORD=\\"TeraX123!@#\\" psql -h 10.91.1.51 -p 30543 -U teraxadmin -d \\"\$DB\\"" << 'EOF'
UPDATE cms_tenant_info SET tenant_domain = REPLACE(tenant_domain, 'rqc.terax.ai', 'dev.terax.ai') WHERE tenant_domain LIKE '%rqc.terax.ai%';
UPDATE cms_tenant_info SET tenant_domain = REPLACE(tenant_domain, 'livatech.site', 'dev.terax.ai') WHERE tenant_domain LIKE '%livatech.site%';
EOF
    done
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
