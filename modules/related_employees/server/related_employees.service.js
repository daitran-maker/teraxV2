/**
 * Related Employees Extension - Service
 * 
 * Manages extraction, synchronization, and RLS clause generation.
 */

const { tableConfigs, registerRelatedEmployeesTable } = require('./related_employees.config');
const { collectRelations, rootsOf } = require('./related_employees.chain');

let _empLookupCache = null;
let _empLookupTs = 0;
const EMP_CACHE_TTL = 60 * 1000; // 1 minute

async function getEmployeeLookup(client) {
  const now = Date.now();
  if (_empLookupCache && now - _empLookupTs < EMP_CACHE_TTL) {
    return _empLookupCache;
  }
  const res = await client.query('SELECT employee_id, email, username FROM "employee" WHERE deleted_at IS NULL');
  const map = new Map();
  res.rows.forEach(e => {
    if (e.employee_id) {
      const canonical = String(e.employee_id).toLowerCase().trim();
      map.set(canonical, canonical);
      if (e.email) map.set(String(e.email).toLowerCase().trim(), canonical);
      if (e.username) map.set(String(e.username).toLowerCase().trim(), canonical);
    }
  });
  _empLookupCache = map;
  _empLookupTs = now;
  return map;
}

function parseEmployeeValues(rawVal) {
  if (!rawVal) return [];
  if (Array.isArray(rawVal)) {
    return rawVal.flatMap(parseEmployeeValues);
  }
  if (typeof rawVal === 'object') {
    return [rawVal.employee_id || rawVal.id || rawVal.email || rawVal.username].filter(Boolean);
  }
  const s = String(rawVal).trim();
  if (s.startsWith('[') && s.endsWith(']')) {
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parseEmployeeValues(parsed);
    } catch (e) {}
    return s.slice(1, -1).split(',').map(x => x.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
  }
  if (s.includes(',')) {
    return s.split(',').map(x => x.trim().replace(/^\[|\]$/g, '').replace(/^["']|["']$/g, '')).filter(Boolean);
  }
  return [s];
}

/**
 * Compute the deduplicated list of lowercase employee IDs for a record
 */
async function computeRelatedEmployees(tableName, record, client) {
  if (!tableName || !record) return [];
  const cleanTable = String(tableName).toLowerCase().trim();
  const config = tableConfigs.get(cleanTable);
  if (!config) return [];

  const empMap = await getEmployeeLookup(client);
  const resolveEmpId = (val) => {
    if (!val) return null;
    const clean = String(val).toLowerCase().trim();
    return empMap.get(clean) || clean;
  };

  const rawList = [];

  // 1. Gather from declared source columns
  if (Array.isArray(config.sources)) {
    for (const src of config.sources) {
      if (record[src] !== undefined && record[src] !== null) {
        rawList.push(...parseEmployeeValues(record[src]));
      }
    }
  }

  // 2. Gather from custom resolver
  if (typeof config.resolveCustom === 'function') {
    try {
      const extra = await config.resolveCustom(record, client, resolveEmpId);
      if (Array.isArray(extra)) {
        rawList.push(...parseEmployeeValues(extra));
      }
    } catch (e) {
      console.warn(`[related_employees] Custom resolver error for ${tableName}:`, e.message);
    }
  }

  // 3. Normalize & Deduplicate
  const result = new Set();
  for (const item of rawList) {
    const canonical = resolveEmpId(item);
    if (canonical && canonical.length >= 2) {
      result.add(canonical);
    }
  }

  return Array.from(result);
}

/**
 * Check if table is registered with related_employees
 */
function hasTable(tableName) {
  if (!tableName) return false;
  return tableConfigs.has(String(tableName).toLowerCase().trim());
}

/**
 * Generate Row-Level Security WHERE clause for a table query.
 * Only Super Admin bypasses.
 * Non-Super Admin only sees records where user.employee_id is in related_employees.
 */
function buildRlsClause(tableName, user, valIdx = 1) {
  if (!hasTable(tableName)) return null;

  // 1. Super Admin bypass (ONLY Super Admin as requested)
  const isSuperAdmin = user && user.role && user.role.toUpperCase() === 'SUPER ADMIN';
  if (isSuperAdmin) {
    return null;
  }

  // 2. Regular user must match their employee_id
  const empId = user && user.employee_id ? String(user.employee_id).toLowerCase().trim() : null;
  if (!empId) {
    // User without employee_id cannot view any records
    return {
      sql: '1 = 0',
      values: []
    };
  }

  const cleanTable = String(tableName).toLowerCase().trim();
  const sqlTable = (cleanTable === 'opportunity' || cleanTable === 'oppo') ? 'oppotunity' : cleanTable;

  return {
    sql: `("${sqlTable}"."related_employees" @> ARRAY[$${valIdx}]::text[])`,
    values: [empId]
  };
}

/**
 * Backfill related_employees column for a given table
 */
async function backfillTable(tableName, client, shouldProcess) {
  const cleanTable = String(tableName).toLowerCase().trim();
  const sqlTable = (cleanTable === 'opportunity' || cleanTable === 'oppo') ? 'oppotunity' : cleanTable;
  const config = tableConfigs.get(cleanTable);
  if (!config) return 0;

  let pk = 'id';
  if (sqlTable === 'oppotunity') pk = 'project_id';
  else if (sqlTable === 'contract') pk = 'contract_id';
  else if (sqlTable === 'request') pk = 'request_id';

  console.log(`[related_employees] Starting backfill for table: ${sqlTable}...`);
  const rowsRes = await client.query(`SELECT * FROM "${sqlTable}" WHERE deleted_at IS NULL`);
  const rows = rowsRes.rows;
  let updatedCount = 0;

  for (const row of rows) {
    if (typeof shouldProcess === 'function' && !shouldProcess(row[pk])) continue;
    try {
      const related = await computeRelatedEmployees(cleanTable, row, client);
      await client.query(
        `UPDATE "${sqlTable}" SET "related_employees" = $1 WHERE "${pk}" = $2`,
        [related, row[pk]]
      );
      updatedCount++;
    } catch (err) {
      console.warn(`[related_employees] Failed backfill row ${row[pk]} in ${sqlTable}:`, err.message);
    }
  }

  console.log(`[related_employees] Backfill completed for ${sqlTable}: ${updatedCount}/${rows.length} records updated.`);
  return updatedCount;
}

/**
 * Re-compute and update related_employees for a single request
 */
async function syncRequestRelatedEmployees(requestId, client) {
  if (!requestId || !client) return;
  try {
    const reqRes = await client.query('SELECT * FROM "request" WHERE request_id = $1 LIMIT 1', [String(requestId)]);
    if (reqRes.rows.length === 0) return;
    const related = await computeRelatedEmployees('request', reqRes.rows[0], client);
    await client.query('UPDATE "request" SET "related_employees" = $1 WHERE request_id = $2', [related, String(requestId)]);
  } catch (err) {
    console.warn(`[related_employees] Failed to sync request ${requestId}:`, err.message);
    return;
  }
  await syncChain(client, { requestId });
}


/**
 * Normalise a raw list of employee identifiers (ids / emails / usernames / arrays) to canonical lowercase ids
 */
async function normalizePeople(raw, client) {
  const empMap = await getEmployeeLookup(client);
  const result = new Set();
  for (const item of parseEmployeeValues(raw)) {
    const key = String(item).toLowerCase().trim();
    const canonical = empMap.get(key) || key;
    if (canonical && canonical.length >= 2) result.add(canonical);
  }
  return Array.from(result);
}

const CHAIN_PK = {
  oppotunity: 'project_id',
  contract: 'contract_id',
  service_delivery_contract: 'id',
  service_task_request: 'id'
};

const canonicalChainTable = (t) => {
  const n = String(t || '').toLowerCase().trim();
  if (n === 'opportunity' || n === 'oppo') return 'oppotunity';
  if (n === 'service_contract') return 'contract';
  return n;
};

/**
 * Re-compute related_employees of the given chain records ({table, row}) and store them.
 */
async function recomputeRecords(client, items) {
  const seen = new Set();
  for (const { table, row } of items) {
    const pk = CHAIN_PK[table];
    if (!pk || !row || row[pk] === undefined || row[pk] === null) continue;
    const key = table + ':' + row[pk];
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      const related = await computeRelatedEmployees(table, row, client);
      await client.query(`UPDATE "${table}" SET "related_employees" = $1 WHERE "${pk}" = $2`, [related, row[pk]]);
    } catch (err) {
      console.warn(`[related_employees] Failed to recompute ${table} ${row[pk]}:`, err.message);
    }
  }
}

/**
 * After a chain record is saved, re-compute that record and every ancestor / descendant,
 * because their people flow into each other (see related_employees.chain.js).
 */
async function syncChainForRecord(tableName, record, client) {
  if (!client || !record) return;
  const table = canonicalChainTable(tableName);
  if (!CHAIN_PK[table]) return;
  try {
    // Everyone in the tree below the top record(s) share the same people: re-compute the whole tree
    const rel = await collectRelations(client, table, record);
    const items = [{ table, row: record }];
    const addRel = (r) => {
      r.oppos.forEach(row => items.push({ table: 'oppotunity', row: { ...row } }));
      r.contracts.forEach(row => items.push({ table: 'contract', row: { ...row } }));
      r.sdcs.forEach(row => items.push({ table: 'service_delivery_contract', row: { ...row } }));
      r.strs.forEach(row => items.push({ table: 'service_task_request', row: { ...row } }));
    };
    addRel(rel);
    for (const root of rootsOf(table, record, rel)) {
      items.push({ table: root.table, row: { ...root.row } });
      addRel(await collectRelations(client, root.table, root.row));
    }
    // Partial rows from the collector are not enough for computing: reload full rows
    const full = [];
    for (const it of items) {
      const pk = CHAIN_PK[it.table];
      if (it.table === table && it.row === record) { full.push(it); continue; }
      const r = await client.query(`SELECT * FROM "${it.table}" WHERE "${pk}" = $1 LIMIT 1`, [it.row[pk]]);
      if (r.rows[0]) full.push({ table: it.table, row: r.rows[0] });
    }
    await recomputeRecords(client, full);
  } catch (err) {
    console.warn('[related_employees] Failed to sync request chain:', err.message);
  }
}

/**
 * After a request changes (SR owner, approvers, requester, tags...), re-compute every chain record linked to it
 * (and their ancestors / descendants).
 */
async function syncChain(client, seed) {
  if (!client || !seed || !seed.requestId) return;
  try {
    const requestId = String(seed.requestId);
    const direct = [];
    const o = await client.query('SELECT * FROM "oppotunity" WHERE deleted_at IS NULL AND id__request = $1', [requestId]);
    o.rows.forEach(row => direct.push({ table: 'oppotunity', row }));
    const c = await client.query('SELECT * FROM "contract" WHERE deleted_at IS NULL AND (request = $1 OR id__request = $1)', [requestId]);
    c.rows.forEach(row => direct.push({ table: 'contract', row }));
    const d = await client.query('SELECT * FROM "service_delivery_contract" WHERE deleted_at IS NULL AND id__service_request = $1', [requestId]);
    d.rows.forEach(row => direct.push({ table: 'service_delivery_contract', row }));
    for (const it of direct) {
      await syncChainForRecord(it.table, it.row, client);
    }
  } catch (err) {
    console.warn('[related_employees] Failed to sync request chain:', err.message);
  }
}

/**
 * Can this user see the record? (Super Admin or listed in related_employees)
 */
function isUserRelated(record, user) {
  if (!record || !user) return false;
  if (user.role && String(user.role).toUpperCase() === 'SUPER ADMIN') return true;
  const empId = user.employee_id ? String(user.employee_id).toLowerCase().trim() : null;
  if (!empId) return false;
  const rel = Array.isArray(record.related_employees) ? record.related_employees : [];
  return rel.some(x => String(x).toLowerCase().trim() === empId);
}

module.exports = {
  tableConfigs,
  registerRelatedEmployeesTable,
  getEmployeeLookup,
  computeRelatedEmployees,
  hasTable,
  buildRlsClause,
  backfillTable,
  syncRequestRelatedEmployees,
  syncChain,
  syncChainForRecord,
  isUserRelated
};

