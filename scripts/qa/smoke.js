#!/usr/bin/env node
/**
 * QA Phase 0 - HTTP smoke test against a RUNNING server (read-only GETs).
 * Records status code + JSON top-level shape, and compares with a baseline.
 *
 *   BASE_URL=http://localhost:5221 TOKEN=<jwt> node scripts/qa/smoke.js --write   # capture baseline BEFORE refactor
 *   BASE_URL=http://localhost:5221 TOKEN=<jwt> node scripts/qa/smoke.js            # compare AFTER each phase
 *
 * Add more endpoints in qa/smoke.endpoints.json (array of "/api/..." GET paths).
 * Only GET requests are issued, so it is safe on a dev database.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const BASE = process.env.BASE_URL || 'http://localhost:5221';
const TOKEN = process.env.TOKEN || '';
const BASELINE = path.join(ROOT, 'qa', 'smoke.baseline.json');
const ENDPOINTS_FILE = path.join(ROOT, 'qa', 'smoke.endpoints.json');

const DEFAULTS = [
  '/api/branding',
  '/api/system-status',
  '/api/schema',
  '/api/permissions',
  '/api/my-company',
  '/api/departments',
  '/api/employees',
  '/api/companies',
  '/api/contacts',
  '/api/policies',
  '/api/notifications',
  '/api/my-views',
  '/api/cms-lookups',
  '/api/actions',
  '/api/nonexistent-route-check',
];

function shape(v, depth = 0) {
  if (Array.isArray(v)) return depth > 1 ? 'array' : { array: v.length ? shape(v[0], depth + 1) : 'empty' };
  if (v && typeof v === 'object') {
    if (depth > 1) return 'object';
    const o = {};
    Object.keys(v).sort().forEach((k) => { o[k] = shape(v[k], depth + 1); });
    return o;
  }
  return v === null ? 'null' : typeof v;
}

async function hit(p) {
  try {
    const res = await fetch(BASE + p, { headers: TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {} });
    const text = await res.text();
    let body; try { body = shape(JSON.parse(text)); } catch { body = 'non-json'; }
    return { status: res.status, shape: body };
  } catch (e) {
    return { status: 'ERR', shape: e.message };
  }
}

(async () => {
  const extra = fs.existsSync(ENDPOINTS_FILE) ? JSON.parse(fs.readFileSync(ENDPOINTS_FILE, 'utf8')) : [];
  const endpoints = [...new Set([...DEFAULTS, ...extra])];
  const result = {};
  for (const p of endpoints) result[p] = await hit(p);

  if (process.argv.includes('--write')) {
    fs.mkdirSync(path.dirname(BASELINE), { recursive: true });
    fs.writeFileSync(BASELINE, JSON.stringify(result, null, 2) + '\n');
    console.log(`Smoke baseline written (${endpoints.length} endpoints).`);
    return;
  }
  if (!fs.existsSync(BASELINE)) { console.error('No baseline. Run with --write first.'); process.exit(2); }
  const base = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  let bad = 0;
  for (const p of endpoints) {
    const a = JSON.stringify(base[p]), b = JSON.stringify(result[p]);
    if (a !== b) { bad++; console.error(`DIFF ${p}\n  baseline: ${a}\n  now:      ${b}`); }
  }
  if (bad) process.exit(1);
  console.log(`OK: ${endpoints.length} endpoints match baseline.`);
})();
