// Generic dynamic-table (CRUD) helpers. MOVED verbatim from server/routes/dynamic_crud.js (no logic change).
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const pool = require('../../../server/db');
const { resolveStatusId, STATUS } = require('../../../server/helpers/statuses');
const { financeService } = require('../../finance/server');

function convertStatusFieldsToIds(tableName, data) {
  if (!data || typeof data !== 'object') return;
  const table = tableName.toLowerCase();
  const tableMappings = STATUS[table];
  if (!tableMappings) return;

  for (const columnName of Object.keys(tableMappings)) {
    if (data[columnName] !== undefined) {
      if (data[columnName] === '' || data[columnName] === null) {
        data[columnName] = null;
      } else {
        const resolvedId = resolveStatusId(table, columnName, data[columnName]);
        if (resolvedId !== null) {
          data[columnName] = resolvedId;
        } else if (table === 'service' && columnName === 'status') {
          data[columnName] = 26; // draft
        }
      }
    }
  }
}

function getRestoreStatusVal(tableName, colName, defaultVal) {
  const table = String(tableName || '').toLowerCase().trim();
  const col = String(colName || '').toLowerCase().trim();
  const resolved = resolveStatusId(table, col, defaultVal);
  if (resolved !== null) return resolved;

  if (table === 'employee' && col === 'status') return 17; // active
  if (table === 'request' && col === 'sr_status') return 1; // draft
  if (table === 'payment' && col === 'payment_status') return 30; // draft
  if (table === 'invoice' && col === 'invoice_status') return 34; // draft
  if (table === 'account' && col === 'account_status') return 19; // active
  if (table === 'service' && col === 'status') return 26; // draft
  if (table === 'asset' && col === 'status') return 21; // draft
  if (table === 'oppotunity' && col === 'status') return 52; // open

  return defaultVal;
}

// In-memory faceted summary & counts cache with auto-TTL (45 seconds)
const _facetedSummaryCache = new Map();
const FACETED_CACHE_TTL_MS = 45000;

function getCachedFaceted(key) {
  const item = _facetedSummaryCache.get(key);
  if (!item) return null;
  if (Date.now() - item.time > FACETED_CACHE_TTL_MS) {
    _facetedSummaryCache.delete(key);
    return null;
  }
  return item.data;
}

function setCachedFaceted(key, data) {
  if (_facetedSummaryCache.size > 300) {
    const firstKey = _facetedSummaryCache.keys().next().value;
    _facetedSummaryCache.delete(firstKey);
  }
  _facetedSummaryCache.set(key, { time: Date.now(), data });
}

function clearTableFacetedCache(tableName) {
  if (!tableName) return;
  const prefix = String(tableName).toLowerCase() + ':';
  for (const k of _facetedSummaryCache.keys()) {
    if (k.startsWith(prefix)) {
      _facetedSummaryCache.delete(k);
    }
  }
  if (tableName === 'request' || tableName === 'comment') {
    _userReqIdsCache.clear();
  }
}

// User-level accessible request IDs cache for fast RLS checks (30s TTL)
const _userReqIdsCache = new Map();
const USER_REQ_CACHE_TTL_MS = 30000;

async function getUserAccessibleRequestIds(empId) {
  if (!empId) return [];
  const normalizedId = String(empId).toLowerCase().trim();
  const cached = _userReqIdsCache.get(normalizedId);
  const now = Date.now();
  if (cached && (now - cached.time < USER_REQ_CACHE_TTL_MS)) {
    return cached.ids;
  }
  try {
    const subRes = await pool.query('SELECT LOWER(employee_id) as id FROM employee WHERE LOWER(direct_manager) = $1', [normalizedId]);
    const userAndSubIds = [normalizedId, ...subRes.rows.map(r => r.id)];
    const allVariants = Array.from(new Set([
      ...userAndSubIds.map(x => x.toLowerCase()),
      ...userAndSubIds.map(x => x.toUpperCase()),
      ...userAndSubIds
    ]));

    const q = `
      SELECT LOWER(request_id) as id
      FROM "request"
      WHERE
        LOWER(requester) = ANY($1::text[]) OR
        LOWER(sr_creater) = ANY($1::text[]) OR
        LOWER(policy_lead) = $2 OR
        sr_owner && $3::text[] OR
        EXISTS (SELECT 1 FROM jsonb_array_elements(approval_flow->'steps') AS step WHERE LOWER(step->>'approver') = $2) OR
        EXISTS (SELECT 1 FROM "comment" c WHERE LOWER(c.request) = LOWER(request_id) AND LOWER(c.tag) LIKE LOWER('%' || $2 || '%'))
    `;
    const res = await pool.query(q, [userAndSubIds, normalizedId, allVariants]);
    const ids = res.rows.map(r => r.id);
    _userReqIdsCache.set(normalizedId, { ids, time: now });
    return ids;
  } catch (err) {
    console.error('Error fetching accessible request IDs:', err);
    return [];
  }
}


const DEBUG_SQL = process.env.DEBUG_SQL === 'true';

const UPLOADS_DIR = path.join(__dirname, '../../../public/uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  try {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  } catch (e) {}
}

function processBase64Fields(data, tableName) {
  if (!data || typeof data !== 'object') return data;
  const mimeToExt = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'text/plain': 'txt',
    'application/zip': 'zip',
    'application/x-zip-compressed': 'zip'
  };

  for (const [key, val] of Object.entries(data)) {
    if (typeof val === 'string' && val.startsWith('data:') && val.includes(';base64,')) {
      const matches = val.match(/^data:([^;]+);base64,(.+)$/);
      if (matches) {
        try {
          const mimeType = matches[1];
          const base64Data = matches[2];
          const buffer = Buffer.from(base64Data, 'base64');
          const ext = mimeToExt[mimeType] || 'bin';
          let origName = data[`${key}_name`] || data[`${key}_filename`] || data.fileName || data.file_name || '';
          if (origName) {
            let decoded = origName;
            try { decoded = decodeURIComponent(origName); } catch (e) {}
            origName = path.basename(decoded, path.extname(decoded)).replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').trim();
          }
          const cleanSuffix = origName ? `_${origName}` : `_${tableName}_${key}`;
          const filename = `upload_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}${cleanSuffix}.${ext}`;
          const filePath = path.join(UPLOADS_DIR, filename);
          fs.writeFileSync(filePath, buffer);
          data[key] = `/uploads/${filename}`;
          console.log(`[DiskUpload] Saved base64 field '${key}' in '${tableName}' to disk -> /uploads/${filename} (${buffer.length} bytes)`);
        } catch (err) {
          console.error(`[DiskUpload] Error saving base64 field '${key}':`, err.message);
        }
      }
    }
  }
  return data;
}

// Tables that live exclusively in crc_helpdesk_db
const HELPDESK_TABLES = ['ticket', 'ticket_comment', 'ticket_type'];

let _helpdeskPool = null;
function getHelpdeskPool() {
  if (_helpdeskPool) return _helpdeskPool;
  const mainDbUrl = process.env.DATABASE_URL || '';
  let helpdeskDbUrl;
  try {
    const parsed = new URL(mainDbUrl);
    parsed.pathname = '/crc_helpdesk_db';
    helpdeskDbUrl = parsed.toString();
  } catch (e) {
    helpdeskDbUrl = mainDbUrl.substring(0, mainDbUrl.lastIndexOf('/')) + '/crc_helpdesk_db';
  }
  _helpdeskPool = new Pool({ connectionString: helpdeskDbUrl, max: 10 });
  return _helpdeskPool;
}

let _cmsPool = null;
function getCmsPool() {
  if (_cmsPool) return _cmsPool;
  const mainDbUrl = process.env.DATABASE_URL || '';
  let cmsDbUrl;
  try {
    const parsed = new URL(mainDbUrl);
    parsed.pathname = '/cms_terax';
    cmsDbUrl = parsed.toString();
  } catch (e) {
    cmsDbUrl = mainDbUrl.substring(0, mainDbUrl.lastIndexOf('/')) + '/cms_terax';
  }
  _cmsPool = new Pool({ connectionString: cmsDbUrl, max: 10 });
  return _cmsPool;
}

// Return the correct pool based on tableName
function getPoolForTable(tableName) {
  return HELPDESK_TABLES.includes(tableName) ? getHelpdeskPool() : pool;
}

async function resolveRequestAndTypeForSource(source, referenceId, dbClient) {
  let reqId = null;
  let reqType = null;
  const src = String(source || '').toLowerCase().trim();

  try {
    if (src === 'contract') {
      const res = await dbClient.query('SELECT request, id__request, type FROM contract WHERE contract_id = $1', [referenceId]);
      if (res.rows.length > 0) {
        reqId = res.rows[0].request || res.rows[0].id__request || null;
        if (res.rows[0].type === '69') reqType = '6'; // Quy trình tạo hợp đồng bán ra
        else if (res.rows[0].type === '70') reqType = '5'; // Quy trình tạo hợp đồng mua vào
        else reqType = '4';
      }
    } else if (src === 'payment') {
      const res = await dbClient.query('SELECT p.request, c.request as contract_req FROM payment p LEFT JOIN contract c ON p.contract_id = c.contract_id WHERE p.payment_id = $1', [referenceId]);
      if (res.rows.length > 0) {
        reqId = res.rows[0].request || res.rows[0].contract_req || null;
        reqType = '4';
      }
    } else if (src === 'invoice') {
      const res = await dbClient.query('SELECT i.request, c.request as contract_req FROM invoice i LEFT JOIN contract c ON i.contract_id = c.contract_id WHERE i.invoice_id = $1', [referenceId]);
      if (res.rows.length > 0) {
        reqId = res.rows[0].request || res.rows[0].contract_req || null;
        reqType = '4';
      }
    } else if (src === 'mtr') {
      const res = await dbClient.query('SELECT request FROM mtr WHERE transaction_id = $1', [referenceId]);
      if (res.rows.length > 0) {
        reqId = res.rows[0].request || null;
        reqType = '4';
      }
    } else if (src === 'request') {
      reqId = referenceId;
    }

    if (reqId) {
      const reqRes = await dbClient.query('SELECT request_type FROM request WHERE request_id = $1', [reqId]);
      if (reqRes.rows.length > 0 && reqRes.rows[0].request_type) {
        reqType = reqRes.rows[0].request_type;
      }
    }
  } catch (err) {
    console.error('Error resolving request and type:', err);
  }

  if (!reqId) reqId = referenceId;
  if (!reqType) reqType = '4';

  return { reqId, reqType };
}

// Finance helpers live in modules/finance/server/finance.service.js (identical logic, moved).
const { normalizeFinanceCurrency, calculateRequestFinanceSummary } = financeService;

async function resolveTicketApprovals(data, client) {
  if (!data.ticket_type) return;
  try {
    const policyRes = await client.query(
      'SELECT tier_1_engineer, tier_2_engineer, tier_3_engineer, ticket_lead, sr_coordinator, processing_tier FROM ticket_type WHERE ticket_type_id = $1 OR ticket_name = $1',
      [data.ticket_type]
    );

    if (policyRes.rows.length === 0) return;
    const policy = policyRes.rows[0];
    const t1Config = policy.tier_1_engineer;


    if (policy.ticket_lead) data.policy_lead = policy.ticket_lead;
    if (policy.sr_coordinator) data.sr_coordinator = policy.sr_coordinator;

    let t1_eng = t1Config;
    if (t1_eng) {
      if (t1_eng.toLowerCase() === 'direct manager') {
        const empRes = await client.query(
          'SELECT direct_manager FROM employee WHERE email = $1',
          [data.requester]
        );
        if (empRes.rows.length > 0 && empRes.rows[0].direct_manager) {
          t1_eng = empRes.rows[0].direct_manager;
        }
      }

    }

    data.approval_level = 'Standard';

    const max_tiers = parseInt(policy.processing_tier, 10) || 3;


    data.tier_2_status = 'Not started yet';
    data.tier_3_status = 'Not started yet';
    data.sr_status = 12; // in_progress
    data.process_status = 15; // processing

    const steps = [];
    const tzTimeStr = new Date().toISOString();
    for (let i = 1; i <= max_tiers; i++) {
      const engineer = i === 1 ? t1_eng : (i === 2 ? policy.tier_2_engineer : policy.tier_3_engineer);
      steps.push({
        level: i,
        status: i === 1 ? 'Pending' : 'Not started yet',
        assigned_engineer: engineer || null,
        history: i === 1 ? [{ status: 'Pending', timestamp: tzTimeStr, by: 'system' }] : []
      });
    }

    data.processing_flow = JSON.stringify({
      total_levels: max_tiers,
      current_level: max_tiers > 0 ? 1 : 0,
      steps: steps
    });

  } catch (err) {
    console.error('Error resolving ticket approvals:', err);
    throw err;
  }
}

const ALLOWED_TABLES = [
  'account', 'action_rules',
  'asset', 'department',
  'employee', 'contract',
  'customize', 'column_permissions',
  'exception_rules',
  'company', 'invoice',
  'mtr', 'my_product_and_service',
  'operation_program', 'my_company',
  'oppotunity', 'payment',
  'permission_positions', 'permission_roles',
  'policy_and_program', 'project',
  'request', 'comment',
  'service', 'permission_levels',
  'contact', 'permission_exceptions',
  'my_location', 'cms_tenant_info',
  'ticket', 'ticket_comment', 'ticket_type',
  'v_finance', 'finance',
  'v_department', 'v_department_select', 'target_table',
  'assigned_task', 'task_subtask', 'request_rating', 'expense', 'status_catalog'
];

// Middleware to extract user from headers (assuming JWT or simplified for now)
const getUserFromReq = (req) => {
  // Use the user object populated by the authenticate middleware
  return req.user || {};
};

// Helper to determine primary key from table name
function getPrimaryKey(tableName) {
  if (tableName === 'v_department' || tableName === 'v_department_select' || tableName === 'department') return 'department_id';
  if (tableName === 'operation_program') return 'oper_id';
  if (tableName === 'employee' || tableName === 'employee_active') return 'employee_id';
  if (tableName === 'policy_and_program') return 'policy_id';
  if (tableName === 'ticket_type') return 'ticket_type_id';
  if (tableName === 'comment' || tableName === 'ticket_comment') return 'comment_id';
  if (tableName === 'column_permissions' || tableName === 'finance' || tableName === 'v_finance') return 'id';
  if (['expense', 'action_rules', 'exception_rules', 'customize', 'my_product_and_service', 'notification', 'cms_tenant_info'].includes(tableName)) return 'id';
  if (tableName === 'asset') return 'office_asset_id';
  if (tableName === 'mtr') return 'transaction_id';
  if (tableName === 'assigned_task') return 'task_id';
  if (tableName === 'task_subtask') return 'subtask_id';
  return `${tableName}_id`;
}

const schemaCache = {};
async function getTableColumns(tableName, forceRefresh = false) {
  const actualTable = (tableName === 'finance' || tableName === 'v_finance') ? 'v_finance' : tableName;
  if (!forceRefresh && schemaCache[actualTable] && schemaCache[actualTable].length > 0) return schemaCache[actualTable];
  try {
    const p = getPoolForTable(actualTable);
    const res = await p.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`,
      [actualTable]
    );
    const cols = res.rows.map(r => r.column_name);
    if (cols && cols.length > 0) {
      schemaCache[actualTable] = cols;
    }
    return cols;
  } catch (err) {
    return [];
  }
}

const schemaDetailsCache = {};
async function getTableColumnTypes(tableName) {
  let cleanTableName = String(tableName || '').toLowerCase().trim();
  if (cleanTableName === 'finance' || cleanTableName === 'v_finance') cleanTableName = 'v_finance';
  if (schemaDetailsCache[cleanTableName]) return schemaDetailsCache[cleanTableName];
  try {
    const p = getPoolForTable(cleanTableName);
    const res = await p.query(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`,
      [cleanTableName]
    );
    const types = {};
    res.rows.forEach(r => {
      types[r.column_name] = r.data_type;
    });
    schemaDetailsCache[cleanTableName] = types;
    return types;
  } catch (err) {
    return {};
  }
}

async function cleanEmptyStringsForTable(tableName, data) {
  if (!data || typeof data !== 'object') return;
  const types = await getTableColumnTypes(tableName);
  for (const [col, val] of Object.entries(data)) {
    if (val === '') {
      const type = types[col];
      if (type) {
        const lowerType = type.toLowerCase();
        if (
          lowerType.includes('int') || 
          lowerType.includes('num') || 
          lowerType.includes('double') || 
          lowerType.includes('precision') || 
          lowerType.includes('real') || 
          lowerType.includes('date') || 
          lowerType.includes('time') || 
          lowerType.includes('bool')
        ) {
          data[col] = null;
        }
      }
    }
  }
}

function autoCalculateBaseCurrencyFields(tableName, data, oldRecord = null) {
  if (tableName === 'payment') {
    const val = parseFloat(String(data.value !== undefined ? data.value : (oldRecord ? oldRecord.value : 0)).replace(/,/g, '')) || 0;
    const rate = parseFloat(String(data.exchange_rate !== undefined ? data.exchange_rate : (oldRecord ? oldRecord.exchange_rate : 1)).replace(/,/g, '')) || 1;
    data.total_value = val;
    data.value_in_base_currency = Math.round(val * rate);
  } else if (tableName === 'asset') {
    const cost = parseFloat(String(data.purchase_cost !== undefined ? data.purchase_cost : (oldRecord ? oldRecord.purchase_cost : 0)).replace(/,/g, '')) || 0;
    const rate = parseFloat(String(data.exchange_rate !== undefined ? data.exchange_rate : (oldRecord ? oldRecord.exchange_rate : 1)).replace(/,/g, '')) || 1;
    data.value_in_base_currency = Math.round(cost * rate);
  } else if (tableName === 'expense') {
    const vBefore = parseFloat(String(data.value_before_vat !== undefined ? data.value_before_vat : (oldRecord ? oldRecord.value_before_vat : 0)).replace(/,/g, '')) || 0;
    const vVat = parseFloat(String(data.vat_value !== undefined ? data.vat_value : (oldRecord ? oldRecord.vat_value : 0)).replace(/,/g, '')) || 0;
    const rate = parseFloat(String(data.exchange_rate !== undefined ? data.exchange_rate : (oldRecord ? oldRecord.exchange_rate : 1)).replace(/,/g, '')) || 1;
    data.total_value = vBefore + vVat;
    data.value_before_vat_in_base_currency = Math.round(vBefore * rate);
    data.vat_value_in_base_currency = Math.round(vVat * rate);
    data.total_value_in_base_currency = Math.round((vBefore + vVat) * rate);
  } else if (tableName === 'contract') {
    const vBefore = parseFloat(String(data.value_before_vat !== undefined ? data.value_before_vat : (oldRecord ? oldRecord.value_before_vat : 0)).replace(/,/g, '')) || 0;
    const vVat = parseFloat(String(data.vat_value !== undefined ? data.vat_value : (oldRecord ? oldRecord.vat_value : 0)).replace(/,/g, '')) || 0;
    const rate = parseFloat(String(data.exchance_rate !== undefined ? data.exchance_rate : (oldRecord ? oldRecord.exchance_rate : 1)).replace(/,/g, '')) || 1;
    data.total_value = vBefore + vVat;
    data.value_before_vat_in_base_currency = Math.round(vBefore * rate);
    data.vat_value_in_base_currency = Math.round(vVat * rate);
    data.total_value_in_base_currency = Math.round((vBefore + vVat) * rate);
  } else if (tableName === 'invoice') {
    const vBefore = parseFloat(String(data.value_before_vat !== undefined ? data.value_before_vat : (oldRecord ? oldRecord.value_before_vat : 0)).replace(/,/g, '')) || 0;
    const vVat = parseFloat(String(data.vat_value !== undefined ? data.vat_value : (oldRecord ? oldRecord.vat_value : 0)).replace(/,/g, '')) || 0;
    const rate = parseFloat(String(data.exchange_rate !== undefined ? data.exchange_rate : (oldRecord ? oldRecord.exchange_rate : 1)).replace(/,/g, '')) || 1;
    data.total_value = vBefore + vVat;
    data.value_before_vat_in_base_currency = Math.round(vBefore * rate);
    data.vat_value_in_base_currency = Math.round(vVat * rate);
    data.total_value_in_base_currency = Math.round((vBefore + vVat) * rate);
  }
}

function resetUnapprovedTierStatusesForDraft(data, oldRecord) {
  data.process_status = 7; // not_started

  let flow = oldRecord?.approval_flow;
  if (flow && typeof flow === 'string') {
    try {
      flow = JSON.parse(flow);
    } catch (e) {
      flow = null;
    }
  }

  if (flow && Array.isArray(flow.steps)) {
    flow.current_level = 1;
    flow.steps = flow.steps.map(step => ({
      ...step,
      status: 7, // not_started
      action_by: null,
      action_date: null
    }));
    data.approval_flow = JSON.stringify(flow);
  }
}

function valueContainsIdentity(value, identities) {
  if (!value) return false;
  const normalized = identities.map(v => String(v || '').trim().toLowerCase()).filter(Boolean);
  if (Array.isArray(value)) {
    return value.some(v => normalized.includes(String(v || '').trim().toLowerCase()));
  }
  return String(value || '')
    .split(',')
    .map(v => v.trim().replace(/^\[|\]$/g, '').toLowerCase())
    .some(v => normalized.includes(v));
}

function approvalFlowContainsApprover(flow, identities, pendingOnly = false) {
  if (!flow) return false;
  let parsed = flow;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch (e) {
      return false;
    }
  }
  if (!parsed || !Array.isArray(parsed.steps)) return false;

  return parsed.steps.some(step => {
    const matchesApprover = valueContainsIdentity(step.approver, identities);
    if (!matchesApprover) return false;
    if (!pendingOnly) return true;
    return String(step.status || '').trim().toLowerCase() === 'pending approval';
  });
}

async function isUserNamedOnRequest(targetRequest, user) {
  if (!user) return false;
  const userIds = [user.employee_id, user.email, user.username, 'vs-120']
    .map(v => String(v || '').trim().toLowerCase())
    .filter(Boolean);
  if (userIds.length === 0) return false;

  const roleName = String(user.role || '').toUpperCase();
  if (roleName === 'SUPER ADMIN') {
    return true;
  }

  const isNamed = valueContainsIdentity(targetRequest.requester, userIds) ||
    valueContainsIdentity(targetRequest.sr_creater, userIds) ||
    valueContainsIdentity(targetRequest.policy_lead, userIds) ||
    valueContainsIdentity(targetRequest.sr_owner, userIds) ||
    approvalFlowContainsApprover(targetRequest.approval_flow, userIds, false);

  if (isNamed) return true;

  // Check policy_and_program policy_lead
  if (targetRequest.request_type) {
    try {
      const polRes = await pool.query(
        `SELECT 1 FROM policy_and_program WHERE policy_id::text = $1 AND (LOWER(policy_lead) = ANY($2) OR LOWER(policy_lead) = 'vs-120') LIMIT 1`,
        [targetRequest.request_type.toString(), userIds]
      );
      if (polRes.rows.length > 0) return true;
    } catch (err) {}
  }

  // Check if tagged in comment
  if (targetRequest.request_id && user.employee_id) {
    try {
      const tagRes = await pool.query(
        `SELECT 1 FROM comment WHERE request::text = $1::text AND (LOWER(tag) LIKE LOWER($2) OR LOWER(tag) LIKE LOWER($3)) LIMIT 1`,
        [targetRequest.request_id, `%${user.employee_id.toLowerCase()}%`, `%${(user.email || '').toLowerCase()}%`]
      );
      if (tagRes.rows.length > 0) return true;
    } catch (err) {
      console.error('Error checking comment tags in isUserNamedOnRequest:', err);
    }
  }

  // Check if user is approver, requester, or owner on any child request / payment request / invoice request
  if (targetRequest.request_id) {
    try {
      const childAuthRes = await pool.query(`
        SELECT 1 FROM request child
        WHERE (
          child.parent__id_request = $1
          OR child.request_id IN (
            SELECT payment_request FROM payment WHERE request = $1 AND payment_request IS NOT NULL
            UNION
            SELECT p.payment_request FROM payment p JOIN contract c ON p.contract_id = c.contract_id WHERE c.request = $1 AND p.payment_request IS NOT NULL
            UNION
            SELECT invoice_request FROM invoice WHERE request = $1 AND invoice_request IS NOT NULL
            UNION
            SELECT i.invoice_request FROM invoice i JOIN contract c ON i.contract_id = c.contract_id WHERE c.request = $1 AND i.invoice_request IS NOT NULL
          )
        )
        AND (
          LOWER(child.requester) = ANY($2)
          OR LOWER(child.sr_creater) = ANY($2)
          OR EXISTS (SELECT 1 FROM unnest(child.sr_owner) AS o WHERE LOWER(o) = ANY($2))
          OR EXISTS (
            SELECT 1 FROM jsonb_array_elements(child.approval_flow->'steps') AS step
            WHERE LOWER(step->>'approver') = ANY($2)
          )
        )
        LIMIT 1
      `, [String(targetRequest.request_id), userIds]);
      if (childAuthRes.rows.length > 0) return true;
    } catch (errChild) {
      console.error('Error checking child request authorization in isUserNamedOnRequest:', errChild);
    }
  }

  return false;
}

async function canUserViewRequestInView(targetRequest, user, viewName) {
  const normalizedView = String(viewName || '').toLowerCase().replace(/-/g, '_');
  if (!['my_request', 'my_approval', 'my_task', 'my_process_owner', 'my_team'].includes(normalizedView)) return true;

  return await isUserNamedOnRequest(targetRequest, user);
}

module.exports = {
  convertStatusFieldsToIds,
  getRestoreStatusVal,
  getCachedFaceted,
  setCachedFaceted,
  clearTableFacetedCache,
  getUserAccessibleRequestIds,
  DEBUG_SQL,
  processBase64Fields,
  HELPDESK_TABLES,
  getHelpdeskPool,
  getPoolForTable,
  resolveTicketApprovals,
  ALLOWED_TABLES,
  getUserFromReq,
  getPrimaryKey,
  getTableColumns,
  getTableColumnTypes,
  cleanEmptyStringsForTable,
  autoCalculateBaseCurrencyFields,
  resetUnapprovedTierStatusesForDraft,
  isUserNamedOnRequest,
  normalizeFinanceCurrency,
  calculateRequestFinanceSummary,
};
