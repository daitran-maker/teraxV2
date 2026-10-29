/**
 * patch_core.js - idempotent installer of the small GENERIC core seams used by the Service Delivery extension.
 * Called by install.js, so "run install" is enough to wire the extension into an app that does not have them yet.
 *
 * Rules:
 *  - a file is skipped when its marker is already present (safe to run many times);
 *  - every anchor must match exactly once, otherwise NOTHING is written for that file and a warning is printed
 *    (the manual list in INSTALL.md then applies);
 *  - the file's own line endings (CRLF / LF) are preserved.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');

const REGISTRY_METHODS = [
  '',
  '  /**',
  '   * Register a list extension: lets a module add computed (virtual) columns to the list query',
  '   * of existing tables without touching core code.',
  '   * @param {string|string[]} tableNames',
  '   * @param {{ columns?: string[], wrap: (tableName: string, baseSql: string) => string }} extension',
  '   *   columns: computed column names that can be used for server-side sorting',
  '   *   wrap: returns a FROM-item (aliased as the table name) exposing the extra columns',
  '   */',
  '  registerListExtension(tableNames, extension) {',
  '    const names = Array.isArray(tableNames) ? tableNames : [tableNames];',
  '    for (const name of names) {',
  '      const key = String(name).toLowerCase().trim();',
  '      if (!this.listExtensions.has(key)) this.listExtensions.set(key, []);',
  '      this.listExtensions.get(key).push(extension);',
  '    }',
  '  }',
  '',
  '  /** Apply every registered list extension to the base FROM-item of a table. */',
  '  applyListExtension(tableName, baseSql) {',
  "    const exts = this.listExtensions.get(String(tableName || '').toLowerCase().trim()) || [];",
  '    return exts.reduce((sql, ext) => ext.wrap(tableName, sql), baseSql);',
  '  }',
  '',
  '  /** Computed column names exposed by list extensions (allowed for sorting). */',
  '  getListExtensionColumns(tableName) {',
  "    const exts = this.listExtensions.get(String(tableName || '').toLowerCase().trim()) || [];",
  '    return exts.flatMap(ext => ext.columns || []);',
  '  }'
];

const PATCHES = [
  {
    file: 'server/core/tableRegistry.js',
    marker: 'registerListExtension',
    edits: [{
      find: ['    this.fallbackHandler = null;', '  }'],
      replace: ['    this.fallbackHandler = null;', '    this.listExtensions = new Map();', '  }'].concat(REGISTRY_METHODS)
    }]
  },
  {
    file: 'server/routes/dynamic_crud.js',
    marker: 'applyListExtension',
    edits: [
      {
        find: ["tableRegistry.register(['service_delivery_contract', 'service_task_request'], serviceDeliveryModule.serviceDeliveryHandler);"],
        replace: [
          "tableRegistry.register(['service_delivery_contract', 'service_task_request'], serviceDeliveryModule.serviceDeliveryHandler);",
          'serviceDeliveryModule.registerMetrics(tableRegistry);'
        ]
      },
      {
        find: ["    const countTarget = (tableName === 'finance' || tableName === 'v_finance') ? baseTableOrCTE : `\"${tableName}\"`;"],
        replace: [
          '    // Computed columns contributed by modules (list extensions)',
          '    baseTableOrCTE = tableRegistry.applyListExtension(tableName, baseTableOrCTE);',
          '',
          "    const countTarget = (tableName === 'finance' || tableName === 'v_finance') ? baseTableOrCTE : `\"${tableName}\"`;"
        ]
      },
      {
        find: ['      const customCols = customColsMap[tableName] || [];'],
        replace: ['      const customCols = [...(customColsMap[tableName] || []), ...tableRegistry.getListExtensionColumns(tableName)];']
      }
    ]
  },
  {
    file: 'public/js/views/tableView.js',
    marker: 'cardsMod',
    edits: [{
      find: ['function buildTableStatusCards(moduleKey, data) {'],
      replace: [
        'function buildTableStatusCards(moduleKey, data) {',
        '  // Generic hook: modules can opt out of the badge cards or provide their own builder (see module config).',
        "  const cardsMod = (typeof MODULES !== 'undefined' && MODULES) ? MODULES[moduleKey] : null;",
        '  if (cardsMod && cardsMod.statusCards === false) return \'\';',
        "  if (cardsMod && typeof cardsMod.buildStatusCards === 'function') return cardsMod.buildStatusCards(data) || '';"
      ]
    }]
  },
  {
    file: 'public/js/views/tableView.js',
    marker: 'col.renderCell(row, col)',
    edits: [{
      find: ["    if (col.type === 'child_count') {", '      const v = Number(val) || 0;'],
      replace: [
        "    if (typeof col.renderCell === 'function') {",
        '      // Generic extension hook: a module can render a custom cell (HTML must be escaped by the module)',
        '      const tdStyle = getStickyTableColumnStyle(moduleKey, col.key, false, mod);',
        '      return `<td class="col-${col.key}${pinnedClass}" data-label="${escapeHTML(col.label || \'\')}" style="${tdStyle} vertical-align:middle; min-width:170px;">${col.renderCell(row, col)}</td>`;',
        '    }',
        '',
        "    if (col.type === 'child_count') {",
        '      const v = Number(val) || 0;'
      ]
    }]
  },
  {
    file: 'public/js/views/childTableView.js',
    marker: 'c.renderCell(row, c)',
    edits: [
      {
        find: ['                             ${cols.map((c, colIdx) => {'],
        replace: [
          '                             ${cols.map((c, colIdx) => {',
          "                if (typeof c.renderCell === 'function') {",
          '                  return `<td style="padding: 12px 14px; min-width: 170px; vertical-align: middle;">${c.renderCell(row, c)}</td>`;',
          '                }'
        ]
      },
      {
        find: ['                               ${cols.map(c => {'],
        replace: [
          '                               ${cols.map(c => {',
          "                if (typeof c.renderCell === 'function') {",
          '                  return `<td style="padding: 10px 14px; min-width: 170px; vertical-align: middle;">${c.renderCell(row, c)}</td>`;',
          '                }'
        ]
      }
    ]
  },
  {
    // Opportunity <-> Request share ONE comment thread: a comment written on an Opportunity is stored as a comment of
    // the Opportunity's Request; the Opportunity view lists every comment of that Request.
    file: 'server/routes/dynamic_crud.js',
    marker: 'oppotunity_comment_link',
    edits: [
      {
        find: ["      if (key === 'project' && ['contract', 'payment', 'invoice', 'service', 'asset', 'service_delivery_contract'].includes(tableName)) {"],
        replace: [
          "      if (key === 'oppotunity' && tableName === 'comment') { // oppotunity_comment_link",
          '        // Comments of the Opportunity = every comment of its Request (see POST).',
          '        const oppoVal = String(value).trim();',
          "        addFacetClause('oppotunity', (idx) => ({",
          '          sql: `("comment"."request" IN (SELECT "id__request" FROM "oppotunity" WHERE "project_id"::text = $${idx} AND "id__request" IS NOT NULL) OR "comment"."request" IN (SELECT "request_id" FROM "request" WHERE "id__oppotunity"::text = $${idx}))`,',
          '          values: [oppoVal]',
          '        }));',
          '        continue;',
          '      }',
          '',
          "      if (key === 'project' && ['contract', 'payment', 'invoice', 'service', 'asset', 'service_delivery_contract'].includes(tableName)) {"
        ]
      },
      {
        find: [
          "    if (tableName === 'comment' || tableName === 'ticket_comment') {",
          '      if (!data.comment_by) data.comment_by = userEmployeeId;'
        ],
        replace: [
          "    if (tableName === 'comment' && data.oppotunity !== undefined) { // oppotunity_comment_link",
          "      // Comment written on an Opportunity => counted as a comment of the Opportunity's Request.",
          '      if (!data.request) {',
          '        const oppoReq = await client.query(',
          "          `SELECT COALESCE(NULLIF(o.id__request, ''), (SELECT r.request_id FROM request r WHERE r.id__oppotunity::text = o.project_id::text LIMIT 1)) AS request_id",
          '           FROM oppotunity o WHERE o.project_id::text = $1::text AND o.deleted_at IS NULL LIMIT 1`,',
          '          [String(data.oppotunity)]',
          '        );',
          '        if (!oppoReq.rows.length || !oppoReq.rows[0].request_id) {',
          "          return res.status(400).json({ error: 'Opportunity chưa liên kết Request nên chưa thể bình luận.' });",
          '        }',
          '        data.request = oppoReq.rows[0].request_id;',
          '      }',
          '      delete data.oppotunity;',
          '    }',
          '',
          "    if (tableName === 'comment' || tableName === 'ticket_comment') {",
          '      if (!data.comment_by) data.comment_by = userEmployeeId;'
        ]
      }
    ]
  }
];

function countOccurrences(text, needle) {
  let n = 0; let i = 0;
  while ((i = text.indexOf(needle, i)) !== -1) { n++; i += needle.length; }
  return n;
}

/** Apply all patches. `root` can be overridden for tests. Returns [{file, status}] */
function patchCore(root = ROOT, log = console) {
  const results = [];
  // group by file so several patches on one file are applied sequentially
  for (const p of PATCHES) {
    const abs = path.join(root, p.file);
    if (!fs.existsSync(abs)) { results.push({ file: p.file, status: 'missing' }); log.warn(`! core patch skipped, file not found: ${p.file}`); continue; }
    const raw = fs.readFileSync(abs, 'utf8');
    if (raw.includes(p.marker)) { results.push({ file: p.file, status: 'already' }); continue; }
    const eol = raw.includes('\r\n') ? '\r\n' : '\n';
    let text = raw;
    let ok = true;
    for (const e of p.edits) {
      const find = e.find.join(eol);
      const n = countOccurrences(text, find);
      if (n !== 1) { ok = false; log.warn(`! core patch NOT applied to ${p.file}: anchor matched ${n}x ("${e.find[0].trim().slice(0, 60)}"). Apply INSTALL.md manually.`); break; }
      text = text.replace(find, () => e.replace.join(eol));
    }
    if (!ok) { results.push({ file: p.file, status: 'anchor-mismatch' }); continue; }
    fs.writeFileSync(abs, text, 'utf8');
    results.push({ file: p.file, status: 'patched' });
    log.log(`✓ core seam applied: ${p.file}`);
  }
  return results;
}

module.exports = { patchCore, PATCHES };
