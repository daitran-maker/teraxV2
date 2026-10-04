#!/usr/bin/env node
/**
 * QA - Simulate "clone a new app" on a LOCAL machine and fingerprint the result.
 * Mirrors scripts/clone_apps.sh: fresh EMPTY database -> load init.sql -> start the app
 * (which runs db.js migrations + seeds) -> fingerprint -> drop the temporary database.
 *
 *   node scripts/qa/clone-test.js <codeDir> <out.json> [port]
 *
 * <codeDir> may be this repo, or a git worktree of an older commit (to get the "before" fingerprint).
 * Safe: only touches a throwaway database named qa_clone_<random>; refuses non-local DB hosts.
 */
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { Pool } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const codeDir = path.resolve(process.argv[2] || '.');
const outFile = path.resolve(process.argv[3] || 'clone-fingerprint.json');
const port = process.argv[4] || '5298';

const adminUrl = new URL(process.env.DATABASE_URL);
if (!['localhost', '127.0.0.1', '::1'].includes(adminUrl.hostname)) { console.error('Refusing: non-local DB host'); process.exit(2); }
const dbName = `qa_clone_${Date.now().toString(36)}`;
const adminPool = new Pool({ connectionString: process.env.DATABASE_URL });
const cloneUrl = new URL(adminUrl); cloneUrl.pathname = '/' + dbName;

const psql = [process.env.PSQL, 'C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe', 'psql'].filter(Boolean).find((p) => p === 'psql' || fs.existsSync(p));

async function main() {
  const initSql = path.join(codeDir, 'init.sql');
  if (!fs.existsSync(initSql)) throw new Error('init.sql not found in ' + codeDir);
  console.log(`[clone-test] code: ${codeDir}\n[clone-test] creating empty database ${dbName}`);
  await adminPool.query(`CREATE DATABASE "${dbName}"`);

  const load = spawnSync(psql, ['--dbname', cloneUrl.toString(), '-q', '-v', 'ON_ERROR_STOP=0', '-f', initSql], { encoding: 'utf8' });
  const initErrors = (load.stderr || '').split(/\r?\n/).filter((l) => /ERROR/.test(l));
  console.log(`[clone-test] init.sql loaded (${initErrors.length} errors)`);
  initErrors.slice(0, 5).forEach((l) => console.log('   ' + l));

  console.log('[clone-test] starting app to run its startup migrations/seeds...');
  const child = spawn(process.execPath, ['server/index.js'], {
    cwd: codeDir,
    env: { ...process.env, DATABASE_URL: cloneUrl.toString(), PORT: port, JWT_SECRET: 'qa_clone_test_secret', SUBDOMAIN: 'qaclone' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '', lastData = Date.now(), exited = false;
  child.on('exit', () => { exited = true; });
  const onData = (d) => { log += d.toString(); lastData = Date.now(); };
  child.stdout.on('data', onData); child.stderr.on('data', onData);

  // wait until output has been quiet for 12s (migrations done) or 150s max
  const start = Date.now();
  while (!exited && Date.now() - start < 150000) {
    await new Promise((r) => setTimeout(r, 1000));
    if (/utc0_standardization applied|Server running/.test(log) && Date.now() - lastData > 12000) break;
  }
  child.kill();
  await new Promise((r) => setTimeout(r, 1500));
  fs.writeFileSync(outFile.replace(/\.json$/, '.applog.txt'), log);
  const errs = log.split(/\r?\n/).filter((l) => /\b(error|failed|cannot find)\b/i.test(l) && !/DeprecationWarning/.test(l));
  console.log(`[clone-test] app log lines with errors: ${errs.length}`);
  errs.slice(0, 8).forEach((l) => console.log('   ' + l.slice(0, 200)));

  const fpScript = path.resolve(__dirname, 'clone-fingerprint.js');
  const fp = spawnSync(process.execPath, [fpScript, outFile], { env: { ...process.env, DATABASE_URL: cloneUrl.toString() }, encoding: 'utf8' });
  console.log('[clone-test] ' + (fp.stdout || fp.stderr).trim());
}

main()
  .catch((e) => { console.error('[clone-test] FAILED:', e.message); process.exitCode = 1; })
  .finally(async () => {
    try {
      await adminPool.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${dbName}'`);
      await adminPool.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
      console.log(`[clone-test] dropped ${dbName}`);
    } catch (e) { console.error('cleanup failed:', e.message); }
    await adminPool.end();
  });
