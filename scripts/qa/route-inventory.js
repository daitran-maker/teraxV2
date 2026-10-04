#!/usr/bin/env node
/**
 * QA Phase 0 - Static route inventory.
 * Scans server code (no boot, no DB) and records every route registration.
 * Express matches routes by registration order, so order within a file is recorded too.
 *
 * Usage:
 *   node scripts/qa/route-inventory.js            -> prints summary
 *   node scripts/qa/route-inventory.js --write    -> (re)writes qa/routes.snapshot.json (baseline)
 *   node scripts/qa/route-inventory.js --check    -> compares with snapshot, exit 1 on diff
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const SNAPSHOT = path.join(ROOT, 'qa', 'routes.snapshot.json');
const SCAN_DIRS = ['server', 'modules'];
const SKIP = new Set(['node_modules', 'client', 'uploads']);
const RE = /\b(app|router|[A-Za-z_]*Router)\.(get|post|put|patch|delete|all|use)\(\s*(['"`])([^'"`]*)\3/g;

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, out);
    else if (ent.name.endsWith('.js')) out.push(full);
  }
  return out;
}

function collect() {
  const entries = [];
  for (const d of SCAN_DIRS) {
    const abs = path.join(ROOT, d);
    if (!fs.existsSync(abs)) continue;
    for (const file of walk(abs).sort()) {
      const rel = path.relative(ROOT, file).replace(/\\/g, '/');
      const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
      lines.forEach((line, i) => {
        if (/^\s*(\/\/|\*)/.test(line)) return;
        RE.lastIndex = 0;
        let m;
        while ((m = RE.exec(line))) {
          entries.push({ method: m[2].toUpperCase(), path: m[4], _rel: rel, _line: i + 1 });
        }
      });
    }
  }
  return entries;
}

/** Location-independent multiset: moving a route between files is not a regression. */
function signature(entries) {
  const multiset = {};
  for (const e of entries) {
    const k = `${e.method} ${e.path}`;
    multiset[k] = (multiset[k] || 0) + 1;
  }
  return multiset;
}

function perFileOrder(entries) {
  const byFile = {};
  for (const e of entries) (byFile[e._rel] = byFile[e._rel] || []).push(`${e.method} ${e.path}`);
  return byFile;
}

function main() {
  const args = new Set(process.argv.slice(2));
  const entries = collect();
  const snap = { total: entries.length, multiset: signature(entries), perFileOrder: perFileOrder(entries) };

  if (args.has('--write')) {
    fs.mkdirSync(path.dirname(SNAPSHOT), { recursive: true });
    fs.writeFileSync(SNAPSHOT, JSON.stringify(snap, null, 2) + '\n');
    console.log(`Baseline written: ${entries.length} route registrations -> ${path.relative(ROOT, SNAPSHOT)}`);
    return;
  }

  if (args.has('--check')) {
    if (!fs.existsSync(SNAPSHOT)) { console.error('No snapshot. Run with --write first.'); process.exit(2); }
    const base = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));
    const problems = [];
    const keys = new Set([...Object.keys(base.multiset), ...Object.keys(snap.multiset)]);
    for (const k of keys) {
      const a = base.multiset[k] || 0, b = snap.multiset[k] || 0;
      if (a !== b) problems.push(`${a > b ? 'MISSING' : 'EXTRA  '} ${k}  (baseline=${a}, now=${b})`);
    }
    if (problems.length) {
      console.error(`Route set changed (${problems.length}):\n` + problems.join('\n'));
      process.exit(1);
    }
    console.log(`OK: ${entries.length} route registrations match baseline.`);
    return;
  }

  const files = Object.keys(snap.perFileOrder);
  console.log(`Total registrations: ${entries.length} in ${files.length} files`);
  for (const f of files) console.log(`  ${String(snap.perFileOrder[f].length).padStart(4)}  ${f}`);
}

main();
