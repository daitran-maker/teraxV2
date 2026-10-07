// Backward-compatible entrypoint exporting PostgreSQL connection pool.
// Connection pool is defined in server/core/db.js.
// Database migrations and startup seeds are organized in server/migrations/.
const pool = require('./core/db');
const { initDb, ensureSystemPoliciesSeed } = require('./migrations');

initDb();
ensureSystemPoliciesSeed().catch(err => console.error('[init] ensureSystemPoliciesSeed error:', err));

module.exports = pool;
