require('dotenv').config();

const pg = require('pg');
pg.types.setTypeParser(pg.types.builtins.TIMESTAMP, (val) => {
  return val ? new Date(val + 'Z') : null;
});
pg.types.setTypeParser(pg.types.builtins.TIMESTAMPTZ, (val) => {
  return val ? new Date(val) : null;
});
pg.types.setTypeParser(pg.types.builtins.DATE, (val) => val);

const { Pool } = require('pg');
const DEBUG_SQL = process.env.DEBUG_SQL === 'true';
// Chỉ bật SSL khi URL chứa 'sslmode=require' (VPS public thật sự).
// LAN, VPN (100.x.x.x), và localhost đều không dùng SSL.
const needsSSL = process.env.DATABASE_URL && process.env.DATABASE_URL.includes('sslmode=require');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 30, // Tối đa 30 kết nối đồng thời từ 1 instance Node.js
  idleTimeoutMillis: 30000, // Đóng kết nối nhàn rỗi sau 30 giây
  connectionTimeoutMillis: 10000, // Timeout nếu không kết nối được sau 10 giây
  ssl: needsSSL ? { rejectUnauthorized: false } : false
});

// Force UTC on all PostgreSQL connections
pool.on('connect', (client) => {
  client.query("SET timezone = 'UTC'").catch(() => {});
});

module.exports = pool;
