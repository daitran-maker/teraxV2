#!/usr/bin/env node
/**
 * QA Phase 0 - Static require graph + broken-require detector.
 *
 *  - Verifies every relative require('./x') / require('../x') resolves to a real file/dir.
 *    (Catches the #1 refactor bug: a moved file with a stale path, even inside lazy requires.)
 *  - Prints dependency stats per area (core / helpers / routes / modules / scripts).
 *
 * Usage:
 *   node scripts/qa/require-graph.js              -> report (exit 1 if broken in server/ or modules/)
 *   node scripts/qa/require-graph.js --scripts    -> also treat broken requires in scripts/ as errors
 *   node scripts/qa/require-graph.js --json       -> dump edges as JSON
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const AREAS = ['server', 'modules', 'scripts'];
const SKIP = new Set(['node_modules', 'client', 'uploads']);
const RE = /require\(\s*(['"`])(\.{1,2}\/[^'"`]*)\1\s*\)/g;

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, out);
    else if (ent.name.endsWith('.js')) out.push(full);
  }
  return out;
}

function resolves(from, spec) {
  const base = path.resolve(path.dirname(from), spec);
  const candidates = [base, base + '.js', base + '.json', path.join(base, 'index.js')];
  return candidates.some((c) => fs.existsSync(c) && (fs.statSync(c).isFile() || fs.existsSync(path.join(c, 'index.js'))));
}

function areaOf(rel) {
  const p = rel.split('/');
  if (p[0] === 'modules') return `modules/${p[1]}`;
  if (p[0] === 'server') return `server/${p[1] && !p[1].endsWith('.js') ? p[1] : '(root)'}`;
  return p[0];
}

const edges = [];
const broken = [];
for (const area of AREAS) {
  const abs = path.join(ROOT, area);
  if (!fs.existsSync(abs)) continue;
  for (const file of walk(abs)) {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    const src = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    src.forEach((line, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
      RE.lastIndex = 0;
      let m;
      while ((m = RE.exec(line))) {
        const spec = m[2];
        const ok = resolves(file, spec);
        edges.push({ from: rel, to: spec, ok });
        if (!ok) broken.push({ file: rel, line: i + 1, spec });
      }
    });
  }
}

const args = new Set(process.argv.slice(2));
if (args.has('--json')) {
  console.log(JSON.stringify(edges, null, 2));
  process.exit(0);
}

const stats = {};
for (const e of edges) {
  const key = `${areaOf(e.from)}`;
  stats[key] = (stats[key] || 0) + 1;
}
console.log(`Relative require() edges: ${edges.length}`);
Object.keys(stats).sort().forEach((k) => console.log(`  ${String(stats[k]).padStart(4)}  ${k}`));

const fatal = broken.filter((b) => args.has('--scripts') || !b.file.startsWith('scripts/'));
const warn = broken.filter((b) => !fatal.includes(b));
if (warn.length) {
  console.log(`\nWarnings (scripts/, pre-existing, not blocking): ${warn.length}`);
  warn.forEach((b) => console.log(`  ${b.file}:${b.line} -> ${b.spec}`));
}
if (fatal.length) {
  console.error(`\nBROKEN requires in server/modules: ${fatal.length}`);
  fatal.forEach((b) => console.error(`  ${b.file}:${b.line} -> ${b.spec}`));
  process.exit(1);
}
console.log('\nOK: all relative requires in server/ and modules/ resolve.');
