#!/usr/bin/env node
/**
 * QA - Clone-contract static check (no DB, no server).
 * scripts/clone_apps.sh rewrites files with `sed` using FIXED strings. If a refactor renames or
 * edits any of them, the clone silently diverges. This check guarantees they still exist, that
 * the entrypoint is intact, and that no NEW tracked file contains '/opt/app/terax'
 * (clone_apps.sh rewrites that string in every file).
 *
 *   node scripts/qa/clone-strings.js          -> check (exit 1 on violation)
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

/** file -> strings/regexes that scripts/clone_apps.sh depends on */
const CONTRACT = {
  '.env.example': [/^PORT=/m, /^DATABASE_URL=/m],
  'init.sql': [/CREATE TABLE/],
  'docker-compose.yml': ['container_name: crc_web_app', 'container_name: crc_tunnel', 'container_name: crc_dozzle', '"5221:5221"', '"8080:8080"'],
  'docker-compose.standalone.yml': ['container_name: crc_web_app_standalone', '"5221:5221"'],
  'k8s-manifest.yaml': ['crc-app-env', 'crc-app-deployment', 'crc-app-service', 'app: crc-web-app', 'name: crc-web-app', 'containerPort: 5221', 'port: 5221', 'targetPort: 5221', 'PORT: "5221"', /DATABASE_URL: /],
  'k8s-dev-cms.yaml': ['crc-dev-env', 'crc-dev-deployment', 'crc-dev-service', 'app: crc-dev-app', 'name: crc-dev-app'],
};

/** Files allowed to contain '/opt/app/terax' (captured at baseline-pre-modular + deploy tooling). */
const ALLOWED_TERAX_PATH = new Set([
  'scripts/qa/clone-strings.js',
  'deploy.sh',
  'scripts/clone_apps.sh',
  'scripts/copy_settings_to_clones.sh',
  'scripts/sync_all_apps.js',
  'scripts/switch_terax_to_standalone_dbs.sh',
  'scripts/deploy_tenant_app.sh',
  'scripts/add_tenant.sh',
  'scripts/deploy/MIGRATION_GUIDE.md',
  'scripts/deploy/migrate_servers.js',
  'scripts/deploy/migrate_servers_dev.js',
]);

const errors = [];

for (const [file, needles] of Object.entries(CONTRACT)) {
  if (!fs.existsSync(path.join(ROOT, file))) { errors.push(`MISSING file required by clone_apps.sh: ${file}`); continue; }
  const text = read(file);
  for (const n of needles) {
    const ok = n instanceof RegExp ? n.test(text) : text.includes(n);
    if (!ok) errors.push(`${file}: clone contract string missing: ${n}`);
  }
}

// Entrypoint
if (!fs.existsSync(path.join(ROOT, 'server/index.js'))) errors.push('MISSING server/index.js (entrypoint)');
try {
  const pkg = JSON.parse(read('package.json'));
  if (pkg.main !== 'server/index.js') errors.push(`package.json main must be server/index.js (is ${pkg.main})`);
  if (!pkg.scripts || pkg.scripts.start !== 'node server/index.js') errors.push('package.json scripts.start must be "node server/index.js"');
} catch (e) { errors.push('package.json unreadable: ' + e.message); }

// No new file may contain /opt/app/terax
let tracked = [];
try { tracked = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split(/\r?\n/).filter(Boolean); } catch (e) { errors.push('git ls-files failed: ' + e.message); }
for (const f of tracked) {
  if (/\.(png|jpg|jpeg|gif|webp|ico|pdf|woff2?|ttf|zip|gz|lock)$/i.test(f) || f.endsWith('package-lock.json') || f.endsWith('pnpm-lock.yaml')) continue;
  if (ALLOWED_TERAX_PATH.has(f)) continue;
  const abs = path.join(ROOT, f);
  if (!fs.existsSync(abs) || fs.statSync(abs).size > 5 * 1024 * 1024) continue;
  if (fs.readFileSync(abs, 'utf8').includes('/opt/app/terax')) errors.push(`${f}: contains '/opt/app/terax' (clone_apps.sh would rewrite it)`);
}

if (errors.length) {
  console.error(`CLONE CONTRACT VIOLATIONS: ${errors.length}`);
  errors.forEach((e) => console.error('  ' + e));
  process.exit(1);
}
console.log(`OK: clone contract intact (${Object.keys(CONTRACT).length} files, entrypoint, ${tracked.length} tracked files scanned).`);
