#!/usr/bin/env node
/**
 * QA - A/B behaviour comparison (read-only GETs, full-data, not just shape).
 *
 * Creates TWO throwaway databases from the SAME snapshot (CREATE DATABASE ... TEMPLATE <dev db>),
 * boots the BASELINE code on DB-A and the CURRENT code on DB-B, mints a token, calls the same GET
 * endpoints on both and compares the normalized JSON bodies + status codes.
 * Nothing touches the source database. Refuses non-local DB hosts.
 *
 *   node scripts/qa/ab-compare.js [--base scratch/terax_base] [--cur .] [--template crcdevdb]
 *
 * Requires: no other connection open on the template DB (stop the dev server first).
 * Endpoints: DEFAULTS below + qa/smoke.endpoints.json.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, spawnSync } = require('child_process');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const ROOT = path.resolve(__dirname, '../..');
const arg = (name, def) => { const i = process.argv.indexOf('--' + name); return i > -1 ? process.argv[i + 1] : def; };
const baseDir = path.resolve(ROOT, arg('base', 'scratch/terax_base'));
const curDir = path.resolve(ROOT, arg('cur', '.'));
const adminUrl = new URL(process.env.DATABASE_URL);
if (!['localhost', '127.0.0.1', '::1'].includes(adminUrl.hostname)) { console.error('Refusing: non-local DB host'); process.exit(2); }
const template = arg('template', adminUrl.pathname.slice(1));
const SECRET = 'qa_ab_compare_secret';
const stamp = Date.now().toString(36);
const dbA = `qa_ab_a_${stamp}`, dbB = `qa_ab_b_${stamp}`;
const PORT_A = 5311, PORT_B = 5312;

const DEFAULTS = [
  '/api/health', '/api/public/brand-info', '/api/system-status', '/api/schema', '/api/permissions', '/api/my-company', '/api/departments',
  '/api/employees', '/api/companies', '/api/contacts', '/api/policies', '/api/notifications', '/api/my-views', '/api/cms-lookups',
  '/api/actions', '/api/automations', '/api/nonexistent-route-check',
];
const extraFile = path.join(ROOT, 'qa', 'smoke.endpoints.json');
const endpoints = [...new Set([...DEFAULTS, ...(fs.existsSync(extraFile) ? JSON.parse(fs.readFileSync(extraFile, 'utf8')) : [])])];

const VOLATILE_KEY = /(^|_)(created|updated|deleted|modified|last|login|synced|expires?|timestamp|now|uptime|date|time)(_|$)|_at$|token|Bytes$|^run_count$/i;
function normalize(v) {
  // Arrays are compared order-insensitively: unordered SQL with ties returns rows in a different order per run.
  if (Array.isArray(v)) return v.map(normalize).sort((x, y) => { const a = JSON.stringify(x), b = JSON.stringify(y); return a < b ? -1 : a > b ? 1 : 0; });
  if (v && typeof v === 'object') {
    const o = {};
    Object.keys(v).sort().forEach((k) => { o[k] = VOLATILE_KEY.test(k) ? '<volatile>' : normalize(v[k]); });
    return o;
  }
  return v;
}

function dbUrl(name) { const u = new URL(adminUrl); u.pathname = '/' + name; return u.toString(); }
const TIMEOUT_MS = Number(process.env.QA_TIMEOUT_MS || 8 * 60 * 1000); // global watchdog
const poolFor = (name) => new Pool({ connectionString: dbUrl(name), connectionTimeoutMillis: 10000, query_timeout: 120000, statement_timeout: 120000 });

/** First differing path between two JSON values (for readable reports). */
function firstDiff(a, b, p = '$') {
  if (JSON.stringify(a) === JSON.stringify(b)) return null;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return `${p}: array length ${a.length} vs ${b.length}`;
    for (let i = 0; i < a.length; i++) { const d = firstDiff(a[i], b[i], `${p}[${i}]`); if (d) return d; }
  } else if (a && b && typeof a === 'object' && typeof b === 'object') {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) { const d = firstDiff(a[k], b[k], `${p}.${k}`); if (d) return d; }
  }
  return `${p}: ${JSON.stringify(a)?.slice(0, 120)} vs ${JSON.stringify(b)?.slice(0, 120)}`;
}

function bin(name) {
  const dir = process.env.PG_BIN || 'C:\\Program Files\\PostgreSQL\\18\\bin';
  const exe = path.join(dir, name + (process.platform === 'win32' ? '.exe' : ''));
  return fs.existsSync(exe) ? exe : name;
}

function boot(dir, db, port) {
  const child = spawn(process.execPath, ['server/index.js'], {
    cwd: dir,
    env: { ...process.env, DATABASE_URL: dbUrl(db), PORT: String(port), JWT_SECRET: SECRET, SUBDOMAIN: 'qaab', TZ: 'UTC' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const st = { child, log: '', last: Date.now(), exited: false };
  child.on('exit', () => { st.exited = true; });
  const on = (d) => { st.log += d.toString(); st.last = Date.now(); };
  child.stdout.on('data', on); child.stderr.on('data', on);
  return st;
}

async function waitReady(st, port) {
  const start = Date.now();
  while (Date.now() - start < 180000) {
    if (st.exited) throw new Error('server exited early:\n' + st.log.slice(-800));
    try { const r = await fetch(`http://localhost:${port}/api/health`, { signal: AbortSignal.timeout(5000) }); if (r.ok) break; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  // let startup migrations/seeds settle (quiet for 10s)
  while (Date.now() - st.last < 10000 && Date.now() - start < 180000) await new Promise((r) => setTimeout(r, 1000));
}

async function hit(port, token, p) {
  try {
    const res = await fetch(`http://localhost:${port}${p}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000) });
    const text = await res.text();
    let body; try { body = normalize(JSON.parse(text)); } catch { body = text.length > 2000 ? `non-json len=${text.length}` : text; }
    return { status: res.status, body };
  } catch (e) { return { status: 'ERR', body: e.message }; }
}

async function retry(fn, n = 3) {
  for (let i = 1; ; i++) { try { return await fn(); } catch (e) { if (i >= n) throw e; await new Promise((r) => setTimeout(r, 1500 * i)); } }
}

async function main() {
  const admin = new Pool({ connectionString: dbUrl('postgres'), connectionTimeoutMillis: 10000, query_timeout: 120000 });
  admin.on('error', () => {});
  const created = [];
  const servers = [];
  // Global watchdog: never let a QA run hang the machine.
  const dog = setTimeout(() => {
    console.error(`[ab] TIMEOUT after ${TIMEOUT_MS / 1000}s -> killing servers and exiting (stale qa_ab_* DBs are dropped on next run)`);
    servers.forEach((s) => { try { s.child.kill('SIGKILL'); } catch { /* ignore */ } });
    process.exit(3);
  }, TIMEOUT_MS);
  try {
    // Drop stale throwaway DBs left by a previously killed run.
    const stale = await retry(() => admin.query("SELECT datname FROM pg_database WHERE datname LIKE 'qa\\_ab\\_%'"));
    for (const { datname } of stale.rows) {
      await admin.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${datname}'`);
      await admin.query(`DROP DATABASE IF EXISTS "${datname}" WITH (FORCE)`);
      console.log(`[ab] dropped stale ${datname}`);
    }
    let dumpFile = null;
    for (const db of [dbA, dbB]) {
      console.log(`[ab] creating ${db} from ${template}`);
      try {
        await admin.query(`CREATE DATABASE "${db}" TEMPLATE "${template}"`);
        created.push(db);
      } catch (e) {
        if (!/being accessed by other users/.test(e.message)) throw e;
        // Source DB in use (e.g. dev server running): non-locking dump/restore instead.
        if (!dumpFile) {
          dumpFile = path.join(os.tmpdir(), `qa_ab_${stamp}.sql`);
          console.log('[ab] template busy -> pg_dump snapshot');
          const d = spawnSync(bin('pg_dump'), ['--dbname', dbUrl(template), '--no-owner', '--no-privileges', '-f', dumpFile], { encoding: 'utf8', timeout: 180000 });
          if (d.status !== 0) throw new Error('pg_dump failed: ' + d.stderr);
        }
        await admin.query(`CREATE DATABASE "${db}"`);
        created.push(db);
        spawnSync(bin('psql'), ['--dbname', dbUrl(db), '-q', '-v', 'ON_ERROR_STOP=0', '-f', dumpFile], { encoding: 'utf8', timeout: 180000 });
      }
    }
    if (dumpFile) { try { fs.unlinkSync(dumpFile); } catch { /* ignore */ } }
    const u = await retry(async () => {
      const pa = poolFor(dbA);
      pa.on('error', () => {});
      try { return (await pa.query("SELECT * FROM employee WHERE deleted_at IS NULL ORDER BY (LOWER(COALESCE(role::text,'')) LIKE '%admin%') DESC, employee_id LIMIT 1")).rows[0]; }
      finally { await pa.end().catch(() => {}); }
    });
    if (!u) throw new Error('no employee in template DB');
    const token = jwt.sign({ employee_id: u.employee_id, username: u.username, email: u.email, role: u.role, employee_level: u.employee_level, position: u.position, company_id: u.company_id, department_id: u.department_id, full_name: u.full_name }, SECRET, { expiresIn: '1h' });

    console.log(`[ab] booting BASE (${baseDir}) :${PORT_A} and CUR (${curDir}) :${PORT_B}`);
    const A = boot(baseDir, dbA, PORT_A); servers.push(A);
    const B = boot(curDir, dbB, PORT_B); servers.push(B);
    await Promise.all([waitReady(A, PORT_A), waitReady(B, PORT_B)]);

    let bad = 0;
    for (const p of endpoints) {
      const [ra, rb] = [await hit(PORT_A, token, p), await hit(PORT_B, token, p)];
      const sa = JSON.stringify(ra), sb = JSON.stringify(rb);
      if (sa !== sb) {
        bad++;
        console.error(`DIFF ${p} [${ra.status} vs ${rb.status}]\n  ${firstDiff(ra.body, rb.body)}`);
      }
    }
    if (bad) { console.error(`\n[ab] ${bad}/${endpoints.length} endpoints differ`); process.exitCode = 1; }
    else console.log(`[ab] OK: ${endpoints.length} endpoints identical (status + full normalized body)`);
  } finally {
    servers.forEach((s) => { try { s.child.kill(); } catch { /* ignore */ } });
    await new Promise((r) => setTimeout(r, 2000));
    for (const db of created) {
      try {
        await admin.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${db}'`);
        await admin.query(`DROP DATABASE IF EXISTS "${db}" WITH (FORCE)`);
        console.log(`[ab] dropped ${db}`);
      } catch (e) { console.error('cleanup failed:', e.message); }
    }
    clearTimeout(dog);
    await admin.end().catch(() => {});
  }
}

main().catch((e) => { console.error('[ab] FAILED:', e.stack); process.exitCode = 1; });
