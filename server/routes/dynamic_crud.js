const tableRegistry = require('../core/tableRegistry');
const { requestHandler, requestService } = require('../modules/request');
const { financeHandler, financeService } = require('../modules/finance');
const { paymentHandler } = require('../modules/payment');
const { invoiceHandler } = require('../modules/invoice');
const { expenseHandler } = require('../modules/expense');
const { contractHandler } = require('../modules/contract');
const { assetHandler } = require('../modules/asset');
const { serviceHandler } = require('../modules/service');
const { targetTableHandler } = require('../modules/target_table');

tableRegistry.register(['request', 'ticket', 'assigned_task', 'task_subtask', 'comment', 'ticket_comment'], requestHandler);
tableRegistry.register(['payment'], paymentHandler);
tableRegistry.register(['invoice'], invoiceHandler);
tableRegistry.register(['expense'], expenseHandler);
tableRegistry.register(['mtr', 'account', 'v_finance'], financeHandler);
tableRegistry.register(['contract'], contractHandler);
tableRegistry.register(['asset'], assetHandler);
tableRegistry.register(['service'], serviceHandler);
tableRegistry.register(['target_table'], targetTableHandler);
const queryBuilder = require('../core/queryBuilder');
const { eventBus, EVENTS } = require('../core/events');
const express = require('express');
const fs = require('fs');
const path = require('path');
const supportSync = require('./support');
const router = express.Router();
const pool = require('../db');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const RequestModel = require('../models/requestModel');
const { checkPermission, clearPermissionCache } = require('../helpers/permissionHelper');
const { broadcastSSE } = require('../helpers/sseHelper');
const { triggerNotifications } = require('../helpers/notificationHelper');
const { isAutomationActive, logAutomationRun } = require('../helpers/automationHelper');
const { validateTableData } = require('../helpers/validation');
const { generateSequentialId, tableConfigs } = require('../helpers/idGenerator');
const hashidHelper = require('../helpers/hashidHelper');
const { getRecordAuditLogs } = require('../helpers/auditHelper');

const { resolveStatusId, STATUS, enrichRecordWithStatusKeys, getStatusKey, enrichRecordWithStatusCatalog, getRecordStatusId, getRecordStatusKey } = require('../helpers/statuses');

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

const UPLOADS_DIR = path.join(__dirname, '../../public/uploads');
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

function normalizeFinanceCurrency(curr) {
  if (!curr) return '';
  const s = String(curr).trim().toUpperCase();
  if (s === '1') return 'VND';
  if (s === '2') return 'USD';
  if (s === '3') return 'EUR';
  if (s === '4') return 'MMK';
  if (s === '5') return 'SGD';
  if (s === '6') return 'THB';
  if (/^\d+$/.test(s)) return 'VND';
  return s;
}

async function calculateRequestFinanceSummary(requestId, dbClient) {
  const client = dbClient || pool;
  if (!requestId) return null;

  // 1. Request Info
  const reqRes = await client.query(
    `SELECT r.request_id, r.request_type, r.sr_submitted_date, r.sr_created_date, r.deleted_at,
            p.policy_name, p.elements as policy_elements, r.elements as request_elements
     FROM request r
     LEFT JOIN policy_and_program p ON r.request_type = p.policy_id::text OR r.request_type = p.policy_name
     WHERE r.request_id = $1`,
    [requestId]
  );
  if (reqRes.rows.length === 0) return null;
  const reqRow = reqRes.rows[0];

  // 2. Contracts
  const conRes = await client.query(
    `SELECT contract_id, type, 
            COALESCE(value_before_vat, 0) as val_wo_vat,
            COALESCE(vat_value, 0) as vat_val,
            COALESCE(total_value, COALESCE(value_before_vat, 0) + COALESCE(vat_value, 0)) as total_val,
            COALESCE(exchance_rate, 1.0) as rate, currency,
            value_before_vat_in_base_currency, vat_value_in_base_currency, total_value_in_base_currency
     FROM contract
     WHERE (request = $1 OR id__request = $1) AND deleted_at IS NULL`,
    [requestId]
  );

  const sellingConIds = [];
  const buyingConIds = [];

  let sellingContractCount = 0;
  let sellingTotalBase = 0;
  let sellingTotalOrig = 0;
  let vatSellingBase = 0;
  let vatSellingOrig = 0;
  let sellingWoVatBase = 0;
  let sellingWoVatOrig = 0;
  let sellingCurrencies = new Set();

  let buyingContractCount = 0;
  let buyingTotalBase = 0;
  let buyingTotalOrig = 0;
  let vatBuyingBase = 0;
  let vatBuyingOrig = 0;
  let buyingWoVatBase = 0;
  let buyingWoVatOrig = 0;
  let buyingCurrencies = new Set();

  for (const c of conRes.rows) {
    const rawType = String(c.type || '').trim().toLowerCase();
    const t = Number(c.type);
    const isSelling = t === 69 || rawType === '69' || rawType.includes('sell') || rawType.includes('bán');
    const isBuying = t === 70 || rawType === '70' || rawType.includes('buy') || rawType.includes('mua');

    const rate = parseFloat(c.rate) || 1.0;
    const curr = normalizeFinanceCurrency(c.currency);

    let valOrigVat = parseFloat(c.vat_val) || 0;
    let valOrigWoVat = parseFloat(c.val_wo_vat) || 0;
    let valOrigTotal = parseFloat(c.total_val) || 0;

    // WO VAT ALWAYS has value:
    // If valOrigWoVat is not set or 0, but total exists: WO VAT = total - VAT (or total if VAT is 0)
    if (valOrigWoVat === 0 && valOrigTotal > 0) {
      valOrigWoVat = Math.max(0, valOrigTotal - valOrigVat);
    }
    // If total is 0 or not set, but valOrigWoVat exists: total = WO VAT + VAT
    if (valOrigTotal === 0 && valOrigWoVat > 0) {
      valOrigTotal = valOrigWoVat + valOrigVat;
    }

    // Base currency values:
    let vatBase = c.vat_value_in_base_currency != null && c.vat_value_in_base_currency !== ''
      ? parseFloat(c.vat_value_in_base_currency)
      : (valOrigVat * rate);
    let woVatBase = c.value_before_vat_in_base_currency != null && c.value_before_vat_in_base_currency !== ''
      ? parseFloat(c.value_before_vat_in_base_currency)
      : (valOrigWoVat * rate);
    let totBase = c.total_value_in_base_currency != null && c.total_value_in_base_currency !== ''
      ? parseFloat(c.total_value_in_base_currency)
      : (valOrigTotal * rate);

    if (woVatBase === 0 && totBase > 0) {
      woVatBase = Math.max(0, totBase - vatBase);
    }
    if (totBase === 0 && woVatBase > 0) {
      totBase = woVatBase + vatBase;
    }

    if (isSelling) {
      sellingContractCount++;
      if (c.contract_id) sellingConIds.push(c.contract_id);
      sellingTotalBase += totBase;
      sellingTotalOrig += valOrigTotal;
      vatSellingBase += vatBase;
      vatSellingOrig += valOrigVat;
      sellingWoVatBase += woVatBase;
      sellingWoVatOrig += valOrigWoVat;
      if (curr) sellingCurrencies.add(curr);
    } else if (isBuying) {
      buyingContractCount++;
      if (c.contract_id) buyingConIds.push(c.contract_id);
      buyingTotalBase += totBase;
      buyingTotalOrig += valOrigTotal;
      vatBuyingBase += vatBase;
      vatBuyingOrig += valOrigVat;
      buyingWoVatBase += woVatBase;
      buyingWoVatOrig += valOrigWoVat;
      if (curr) buyingCurrencies.add(curr);
    }
  }
  const allConIds = [...sellingConIds, ...buyingConIds];

  // 3. Payments
  let payRes;
  if (allConIds.length > 0) {
    payRes = await client.query(
      `SELECT payment_id, contract_id, payment_type, payment_status, due_date, payment_date,
              COALESCE(value, 0) as val, COALESCE(exchange_rate, 1.0) as rate, currency,
              value_in_base_currency
       FROM payment
       WHERE (request = $1 OR contract_id = ANY($2)) AND deleted_at IS NULL`,
      [requestId, allConIds]
    );
  } else {
    payRes = await client.query(
      `SELECT payment_id, contract_id, payment_type, payment_status, due_date, payment_date,
              COALESCE(value, 0) as val, COALESCE(exchange_rate, 1.0) as rate, currency,
              value_in_base_currency
       FROM payment
       WHERE request = $1 AND deleted_at IS NULL`,
      [requestId]
    );
  }

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  let incomingPmCount = 0;
  let incomingPaidCount = 0;
  let incomingNotDueYetCount = 0;
  let incomingPendingCount = 0;
  let incomingPaymentBase = 0;
  let incomingPaymentOrig = 0;
  let incomingPaymentPaidBase = 0;
  let incomingPaymentPaidOrig = 0;
  let incomingPmNotDueYetBase = 0;
  let incomingPmNotDueYetOrig = 0;
  let incomingPmPendingPmBase = 0;
  let incomingPmPendingPmOrig = 0;
  let incomingCurrencies = new Set();

  let outgoingPmCount = 0;
  let outgoingPaidCount = 0;
  let outgoingNotDueYetCount = 0;
  let outgoingPendingCount = 0;
  let outgoingPaymentBase = 0;
  let outgoingPaymentOrig = 0;
  let outgoingPaymentPaidBase = 0;
  let outgoingPaymentPaidOrig = 0;
  let outgoingPmNotDueYetBase = 0;
  let outgoingPmNotDueYetOrig = 0;
  let outgoingPmPendingPmBase = 0;
  let outgoingPmPendingPmOrig = 0;
  let outgoingCurrencies = new Set();

  for (const p of payRes.rows) {
    const pType = Number(p.payment_type);
    const pStatus = Number(p.payment_status);
    const isPaid = (pStatus === 32 || String(p.payment_status || '').toLowerCase() === 'paid');
    const rate = parseFloat(p.rate) || 1.0;
    const valOrig = parseFloat(p.val) || 0;
    const valBase = p.value_in_base_currency != null ? parseFloat(p.value_in_base_currency) : (valOrig * rate);
    const curr = normalizeFinanceCurrency(p.currency);

    const isIncoming = (p.contract_id && sellingConIds.includes(p.contract_id)) || pType === 60;
    const isOutgoing = (p.contract_id && buyingConIds.includes(p.contract_id)) || pType === 61;

    const dDateStr = p.due_date ? new Date(p.due_date).toISOString().split('T')[0] : '';
    const isNotDueYet = !isPaid && dDateStr && dDateStr > todayStr;

    if (isIncoming) {
      incomingPmCount++;
      incomingPaymentBase += valBase;
      incomingPaymentOrig += valOrig;
      if (curr) incomingCurrencies.add(curr);
      if (isPaid) {
        incomingPaidCount++;
        incomingPaymentPaidBase += valBase;
        incomingPaymentPaidOrig += valOrig;
      } else if (isNotDueYet) {
        incomingNotDueYetCount++;
        incomingPmNotDueYetBase += valBase;
        incomingPmNotDueYetOrig += valOrig;
      } else {
        incomingPendingCount++;
        incomingPmPendingPmBase += valBase;
        incomingPmPendingPmOrig += valOrig;
      }
    } else if (isOutgoing) {
      outgoingPmCount++;
      outgoingPaymentBase += valBase;
      outgoingPaymentOrig += valOrig;
      if (curr) outgoingCurrencies.add(curr);
      if (isPaid) {
        outgoingPaidCount++;
        outgoingPaymentPaidBase += valBase;
        outgoingPaymentPaidOrig += valOrig;
      } else if (isNotDueYet) {
        outgoingNotDueYetCount++;
        outgoingPmNotDueYetBase += valBase;
        outgoingPmNotDueYetOrig += valOrig;
      } else {
        outgoingPendingCount++;
        outgoingPmPendingPmBase += valBase;
        outgoingPmPendingPmOrig += valOrig;
      }
    }
  }

  // 4. Invoices
  let invRes;
  if (allConIds.length > 0) {
    invRes = await client.query(
      `SELECT invoice_id, contract_id, invoice_type, invoice_status,
              COALESCE(value_before_vat, 0) as val_wo_vat,
              COALESCE(NULLIF(regexp_replace(COALESCE(vat_value, '0'), '[^0-9.]', '', 'g'), '')::numeric, 0) as vat_val,
              COALESCE(total_value, 0) as total_val,
              COALESCE(exchange_rate, 1) as rate, currency,
              value_before_vat_in_base_currency, vat_value_in_base_currency, total_value_in_base_currency
       FROM invoice
       WHERE (request = $1 OR contract_id = ANY($2)) AND deleted_at IS NULL`,
      [requestId, allConIds]
    );
  } else {
    invRes = await client.query(
      `SELECT invoice_id, contract_id, invoice_type, invoice_status,
              COALESCE(value_before_vat, 0) as val_wo_vat,
              COALESCE(NULLIF(regexp_replace(COALESCE(vat_value, '0'), '[^0-9.]', '', 'g'), '')::numeric, 0) as vat_val,
              COALESCE(total_value, 0) as total_val,
              COALESCE(exchange_rate, 1) as rate, currency,
              value_before_vat_in_base_currency, vat_value_in_base_currency, total_value_in_base_currency
       FROM invoice
       WHERE request = $1 AND deleted_at IS NULL`,
      [requestId]
    );
  }

  let sellingInvoiceCount = 0;
  let sellingInvoiceTotalBase = 0;
  let sellingInvoiceTotalOrig = 0;
  let sellingInvoiceCurrencies = new Set();

  let buyingInvoiceCount = 0;
  let buyingInvoiceTotalBase = 0;
  let buyingInvoiceTotalOrig = 0;
  let buyingInvoiceCurrencies = new Set();

  for (const inv of invRes.rows) {
    const rate = parseFloat(inv.rate) || 1.0;
    let valVatOrig = parseFloat(inv.vat_val) || 0;
    let valWoVatOrig = parseFloat(inv.val_wo_vat) || 0;
    let totOrig = parseFloat(inv.total_val) || 0;

    if (valWoVatOrig === 0 && totOrig > 0) {
      valWoVatOrig = Math.max(0, totOrig - valVatOrig);
    }
    if (totOrig === 0 && valWoVatOrig > 0) {
      totOrig = valWoVatOrig + valVatOrig;
    }

    let vatBase = inv.vat_value_in_base_currency != null && inv.vat_value_in_base_currency !== ''
      ? parseFloat(inv.vat_value_in_base_currency)
      : (valVatOrig * rate);
    let woVatBase = inv.value_before_vat_in_base_currency != null && inv.value_before_vat_in_base_currency !== ''
      ? parseFloat(inv.value_before_vat_in_base_currency)
      : (valWoVatOrig * rate);
    let totBase = inv.total_value_in_base_currency != null && inv.total_value_in_base_currency !== ''
      ? parseFloat(inv.total_value_in_base_currency)
      : (totOrig * rate);

    if (woVatBase === 0 && totBase > 0) {
      woVatBase = Math.max(0, totBase - vatBase);
    }
    if (totBase === 0 && woVatBase > 0) {
      totBase = woVatBase + vatBase;
    }
    const curr = normalizeFinanceCurrency(inv.currency);

    const isSelling = (inv.contract_id && sellingConIds.includes(inv.contract_id)) || String(inv.invoice_type).toLowerCase() === 'selling';
    if (isSelling) {
      sellingInvoiceCount++;
      sellingInvoiceTotalBase += totBase;
      sellingInvoiceTotalOrig += totOrig;
      if (curr) sellingInvoiceCurrencies.add(curr);
    } else {
      buyingInvoiceCount++;
      buyingInvoiceTotalBase += totBase;
      buyingInvoiceTotalOrig += totOrig;
      if (curr) buyingInvoiceCurrencies.add(curr);
    }
  }

  // 5. Expenses
  const expRes = await client.query(
    `SELECT id, id__expense_type, id__expense_cost, fy,
            COALESCE(value_before_vat, 0) as val_wo_vat,
            COALESCE(vat_value, 0) as vat_val,
            COALESCE(total_value, COALESCE(value_before_vat, 0) + COALESCE(vat_value, 0)) as total_val,
            COALESCE(exchange_rate, 1.0) as rate, id__currency as currency,
            value_before_vat_in_base_currency, vat_value_in_base_currency, total_value_in_base_currency
     FROM expense
     WHERE id__request = $1 AND deleted_at IS NULL`,
    [requestId]
  );

  let expenseBase = 0;
  let expenseOrig = 0;
  let expenseVatBase = 0;
  let expenseCount = 0;
  let nonExpenseBase = 0;
  let nonExpenseOrig = 0;
  let nonExpenseCount = 0;
  let expenseCurrencies = new Set();
  let fyValues = new Set();

  for (const e of expRes.rows) {
    const rate = parseFloat(e.rate) || 1.0;
    let valWoVatOrig = parseFloat(e.val_wo_vat) || 0;
    let valVatOrig = parseFloat(e.vat_val) || 0;
    let valTotalOrig = parseFloat(e.total_val) || 0;

    if (valWoVatOrig === 0 && valTotalOrig > 0) {
      valWoVatOrig = Math.max(0, valTotalOrig - valVatOrig);
    }
    if (valTotalOrig === 0 && valWoVatOrig > 0) {
      valTotalOrig = valWoVatOrig + valVatOrig;
    }

    let valWoVatBase = e.value_before_vat_in_base_currency != null && e.value_before_vat_in_base_currency !== ''
      ? parseFloat(e.value_before_vat_in_base_currency)
      : (valWoVatOrig * rate);
    let vatBase = e.vat_value_in_base_currency != null && e.vat_value_in_base_currency !== ''
      ? parseFloat(e.vat_value_in_base_currency)
      : (valVatOrig * rate);
    let valTotalBase = e.total_value_in_base_currency != null && e.total_value_in_base_currency !== ''
      ? parseFloat(e.total_value_in_base_currency)
      : (valTotalOrig * rate);

    if (valWoVatBase === 0 && valTotalBase > 0) {
      valWoVatBase = Math.max(0, valTotalBase - vatBase);
    }
    if (valTotalBase === 0 && valWoVatBase > 0) {
      valTotalBase = valWoVatBase + vatBase;
    }

    const curr = normalizeFinanceCurrency(e.currency);
    if (e.fy) fyValues.add(e.fy);

    const typeStr = String(e.id__expense_type || '').toLowerCase();
    if (typeStr === 'non-expense' || typeStr === 'non expense' || typeStr === '73' || typeStr === 'non_expense') {
      nonExpenseCount++;
      nonExpenseBase += valWoVatBase;
      nonExpenseOrig += valWoVatOrig;
    } else {
      expenseCount++;
      expenseBase += valWoVatBase;
      expenseOrig += valWoVatOrig;
      expenseVatBase += vatBase;
    }
    if (curr) expenseCurrencies.add(curr);
  }

  // 6. Assets
  const assetRes = await client.query(
    `SELECT office_asset_id, purchase_cost, exchange_rate, currency, value_in_base_currency
     FROM asset
     WHERE request = $1 AND deleted_at IS NULL`,
    [requestId]
  );

  let assetCount = 0;
  let assetBase = 0;
  let assetOrig = 0;
  let assetCurrencies = new Set();

  for (const a of assetRes.rows) {
    assetCount++;
    const costNum = parseFloat(String(a.purchase_cost || '').replace(/[^0-9.]/g, '')) || 0;
    const rate = parseFloat(String(a.exchange_rate || '').replace(/[^0-9.]/g, '')) || 1.0;
    const valBase = a.value_in_base_currency != null ? parseFloat(a.value_in_base_currency) : (costNum * rate);
    assetBase += valBase;
    assetOrig += costNum;
    if (a.currency) assetCurrencies.add(normalizeFinanceCurrency(a.currency));
  }

  // Profitability (strictly based on contract selling and buying)
  const gmBase = sellingTotalBase - buyingTotalBase;
  const gmWoVatBase = sellingWoVatBase - buyingWoVatBase;

  let fy = Array.from(fyValues)[0];
  if (!fy) {
    const txDate = reqRow.sr_submitted_date || reqRow.sr_created_date || now;
    fy = 'FY' + new Date(txDate).getFullYear();
  }
  if (fy && !String(fy).startsWith('FY')) {
    fy = 'FY' + fy;
  }

  return {
    request_id: requestId,
    process_name: reqRow.policy_name || reqRow.request_type,
    fy: fy,
    base_currency: 'VND',

    // The 28 requested fields (Base Currency Values)
    selling_contract_count: sellingContractCount,
    selling: sellingTotalBase,
    buying_contract_count: buyingContractCount,
    buying: buyingTotalBase,
    gm: gmBase,
    vat_selling: vatSellingBase,
    selling_wo_vat: sellingWoVatBase,
    vat_buying: vatBuyingBase,
    buying_wo_vat: buyingWoVatBase,
    gm_wo_vat: gmWoVatBase,
    incoming_pm_count: incomingPmCount,
    incoming_payment: incomingPaymentBase,
    incoming_payment_paid: incomingPaymentPaidBase,
    incoming_pm_not_due_yet: incomingPmNotDueYetBase,
    incoming_pm_pending_pm: incomingPmPendingPmBase,
    outgoing_pm_count: outgoingPmCount,
    outgoing_payment: outgoingPaymentBase,
    outgoing_payment_paid: outgoingPaymentPaidBase,
    outgoing_pm_not_due_yet: outgoingPmNotDueYetBase,
    outgoing_pm_pending_pm: outgoingPmPendingPmBase,
    selling_invoice_count: sellingInvoiceCount,
    selling_invoice_total_value: sellingInvoiceTotalBase,
    buying_invoice_count: buyingInvoiceCount,
    buying_invoice_total_value: buyingInvoiceTotalBase,
    expense: expenseBase,
    non_expense: nonExpenseBase,
    asset: assetBase,
    fy_col: fy,

    // Detailed metrics for Borderless Column View
    details: {
      contract_selling: {
        count: sellingContractCount,
        value_orig: sellingTotalOrig,
        value_base: sellingTotalBase,
        currency: Array.from(sellingCurrencies)[0] || ''
      },
      vat_selling: {
        count: null,
        value_orig: vatSellingOrig,
        value_base: vatSellingBase,
        currency: Array.from(sellingCurrencies)[0] || ''
      },
      selling_wo_vat: {
        count: null,
        value_orig: sellingWoVatOrig,
        value_base: sellingWoVatBase,
        currency: Array.from(sellingCurrencies)[0] || ''
      },
      selling_invoice: {
        count: sellingInvoiceCount,
        value_orig: sellingInvoiceTotalOrig,
        value_base: sellingInvoiceTotalBase,
        currency: Array.from(sellingInvoiceCurrencies)[0] || ''
      },
      contract_buying: {
        count: buyingContractCount,
        value_orig: buyingTotalOrig,
        value_base: buyingTotalBase,
        currency: Array.from(buyingCurrencies)[0] || ''
      },
      vat_buying: {
        count: null,
        value_orig: vatBuyingOrig,
        value_base: vatBuyingBase,
        currency: Array.from(buyingCurrencies)[0] || ''
      },
      buying_wo_vat: {
        count: null,
        value_orig: buyingWoVatOrig,
        value_base: buyingWoVatBase,
        currency: Array.from(buyingCurrencies)[0] || ''
      },
      buying_invoice: {
        count: buyingInvoiceCount,
        value_orig: buyingInvoiceTotalOrig,
        value_base: buyingInvoiceTotalBase,
        currency: Array.from(buyingInvoiceCurrencies)[0] || ''
      },
      incoming_payment: {
        count: incomingPmCount,
        value_orig: incomingPaymentOrig,
        value_base: incomingPaymentBase,
        currency: Array.from(incomingCurrencies)[0] || ''
      },
      incoming_payment_paid: {
        count: incomingPaidCount,
        value_orig: incomingPaymentPaidOrig,
        value_base: incomingPaymentPaidBase,
        currency: Array.from(incomingCurrencies)[0] || ''
      },
      incoming_pm_not_due_yet: {
        count: incomingNotDueYetCount,
        value_orig: incomingPmNotDueYetOrig,
        value_base: incomingPmNotDueYetBase,
        currency: Array.from(incomingCurrencies)[0] || ''
      },
      incoming_pm_pending_pm: {
        count: incomingPendingCount,
        value_orig: incomingPmPendingPmOrig,
        value_base: incomingPmPendingPmBase,
        currency: Array.from(incomingCurrencies)[0] || ''
      },
      outgoing_payment: {
        count: outgoingPmCount,
        value_orig: outgoingPaymentOrig,
        value_base: outgoingPaymentBase,
        currency: Array.from(outgoingCurrencies)[0] || ''
      },
      outgoing_payment_paid: {
        count: outgoingPaidCount,
        value_orig: outgoingPaymentPaidOrig,
        value_base: outgoingPaymentPaidBase,
        currency: Array.from(outgoingCurrencies)[0] || ''
      },
      outgoing_pm_not_due_yet: {
        count: outgoingNotDueYetCount,
        value_orig: outgoingPmNotDueYetOrig,
        value_base: outgoingPmNotDueYetBase,
        currency: Array.from(outgoingCurrencies)[0] || ''
      },
      outgoing_pm_pending_pm: {
        count: outgoingPendingCount,
        value_orig: outgoingPmPendingPmOrig,
        value_base: outgoingPmPendingPmBase,
        currency: Array.from(outgoingCurrencies)[0] || ''
      },
      expense: {
        count: expenseCount,
        value_orig: expenseOrig,
        value_base: expenseBase,
        currency: Array.from(expenseCurrencies)[0] || ''
      },
      non_expense: {
        count: nonExpenseCount,
        value_orig: nonExpenseOrig,
        value_base: nonExpenseBase,
        currency: Array.from(expenseCurrencies)[0] || ''
      },
      asset: {
        count: assetCount,
        value_orig: assetOrig,
        value_base: assetBase,
        currency: Array.from(assetCurrencies)[0] || ''
      },
      gm: {
        count: null,
        value_orig: null,
        value_base: gmBase,
        currency: ''
      },
      gm_wo_vat: {
        count: null,
        value_orig: null,
        value_base: gmWoVatBase,
        currency: ''
      }
    }
  };
}



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
  'assigned_task', 'task_subtask', 'request_rating', 'expense'
];

// Validate dynamic table names to prevent SQL Injection and unauthorized table access
router.param('tableName', (req, res, next, tableName) => {
  if (!ALLOWED_TABLES.includes(tableName)) {
    return res.status(403).json({ error: `Access denied: table '${tableName}' is invalid or restricted.` });
  }
  next();
});

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

// Invalidate faceted cache on any successful write mutation (POST, PUT, PATCH, DELETE)
router.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const rawPath = req.path.replace(/^\//, '');
    const tableName = (rawPath.split('/')[0] || '').toLowerCase();
    if (tableName) {
      res.on('finish', () => {
        if (res.statusCode >= 200 && res.statusCode < 400) {
          clearTableFacetedCache(tableName);
          if (['contract', 'payment', 'expense', 'invoice', 'asset', 'service'].includes(tableName)) {
            clearTableFacetedCache('finance');
            clearTableFacetedCache('v_finance');
            clearTableFacetedCache('request');
          }
        }
      });
    }
  }
  next();
});

// POST /api/table/:tableName/bulk (CSV Import Route)
router.post('/:tableName/bulk', async (req, res) => {
  const { tableName } = req.params;
  const records = req.body;
  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: 'Expected an array of records' });
  }

  const client = await getPoolForTable(tableName).connect();
  const userEmployeeId = req.user && req.user.employee_id ? req.user.employee_id : 'system';

  try {
    const dbCols = await getTableColumns(tableName);
    const pk = getPrimaryKey(tableName);

    // Helper to find exact column name regardless of case/spacing
    const findCol = (name) => dbCols.find(c => c.toLowerCase().replace(/\s+/g, '_') === name);

    const colCreatedBy = findCol('created_by');
    const colCreatedDate = findCol('created_date');
    const colUpdatedBy = findCol('updated_by');
    const colUpdatedDate = findCol('updated_date');
    const colLogs = findCol('logs') || findCol('log');

    const userEmployeeId = req.user && req.user.employee_id ? req.user.employee_id : (req.user && req.user.email ? req.user.email : 'system');
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.current_user', $1, true)", [userEmployeeId]);

    let bulkIdCounter = null;
    let tableConfig = tableConfigs[tableName];
    if (tableConfig) {
      await client.query(`LOCK TABLE "${tableName}" IN SHARE ROW EXCLUSIVE MODE`);
      const result = await client.query(`SELECT "${pk}" FROM "${tableName}"`);
      let maxSeq = 0;
      result.rows.forEach(row => {
        const val = row[pk];
        if (val) {
          const match = String(val).match(tableConfig.regex);
          if (match) {
            const num = parseInt(match[1], 10);
            if (!isNaN(num) && num > maxSeq) {
              maxSeq = num;
            }
          }
        }
      });
      bulkIdCounter = maxSeq;
    }

    for (const record of records) {
      let data = { ...record };
      let finalData = {};

      // 1. Alias Mapping & Cleaning
      for (const [key, val] of Object.entries(data)) {
        let cleanKey = key.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

        // Smart Aliases
        if (cleanKey === 'company' && !findCol('company')) cleanKey = 'company_id';
        if (cleanKey === 'department' && !findCol('department')) cleanKey = 'department_id';

        const dbKey = findCol(cleanKey);
        if (dbKey) {
          finalData[dbKey] = (val === '' ? null : val);
        }
      }

      // 2. PK Generation
      if (!finalData[pk]) {
        if (bulkIdCounter !== null) {
          bulkIdCounter++;
          const seqStr = tableConfig.padding ? String(bulkIdCounter).padStart(tableConfig.padding, '0') : String(bulkIdCounter);
          finalData[pk] = `${tableConfig.prefix}${seqStr}`;
        } else {
          finalData[pk] = uuidv4();
        }
      }

      // 3. Audit Fields
      // We only set created_by/updated_by if necessary, DB trigger handles dates and logs.
      if (colCreatedBy && !finalData[colCreatedBy]) finalData[colCreatedBy] = userEmployeeId;
      if (colUpdatedBy && !finalData[colUpdatedBy]) finalData[colUpdatedBy] = userEmployeeId;

      const keys = Object.keys(finalData);
      if (keys.length === 0) continue;

      const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
      const query = `INSERT INTO "${tableName}" (${keys.join(', ')}) VALUES (${placeholders})`;
      await client.query(query, keys.map(k => finalData[k]));
    }
    await client.query('COMMIT');
    res.json({ message: `Successfully imported ${records.length} records into ${tableName}` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`Error bulk inserting into ${tableName}:`, err);
    res.status(500).json({ error: `Database error during bulk insert: ${err.message}` });
  } finally {
    client.release();
  }
});

// GET /api/table/account-currencies/all
router.get('/account-currencies/all', async (req, res) => {
  try {
    const result = await pool.query('SELECT DISTINCT currency FROM "account" WHERE currency IS NOT NULL AND TRIM(currency) <> \'\' AND account_status = 19 ORDER BY currency ASC');
    const currencies = result.rows.map(row => row.currency);
    res.json(currencies);
  } catch (err) {
    console.error('Error fetching unique currencies:', err);
    res.status(500).json({ error: 'Failed to fetch currencies' });
  }
});

// GET /api/table/finance/request-summary/:requestId
router.get('/finance/request-summary/:requestId', async (req, res) => {
  try {
    const { requestId } = req.params;
    const summary = await calculateRequestFinanceSummary(requestId);
    if (!summary) {
      return res.status(404).json({ error: 'Request not found' });
    }
    res.json({ success: true, data: summary });
  } catch (err) {
    console.error('Error calculating request finance summary:', err);
    res.status(500).json({ error: 'Failed to calculate finance summary: ' + err.message });
  }
});


router.get('/:tableName', async (req, res) => {
  let { tableName } = req.params;
  if (tableName === 'comment' && req.query.ticket) {
    tableName = 'ticket_comment';
  }
  const { page = 1, limit = 50, search, summary: reqSummary, sort_by, sort_dir, ...filters } = req.query;
  const fromDateVal = filters.from_date || null;
  const toDateVal = filters.to_date || null;
  delete filters.from_date;
  delete filters.to_date;
  const offset = (page - 1) * limit;

  try {
    const user = getUserFromReq(req);
    // Backward compatibility interceptor: If frontend sends email or username in query, convert to employee_id
    if (user && user.employee_id) {
      const emailLower = (user.email || '').toLowerCase();
      const usernameLower = (user.username || '').toLowerCase();
      for (const key of Object.keys(filters)) {
        const val = filters[key];
        if (typeof val === 'string') {
          const valLower = val.toLowerCase();
          if (valLower === emailLower || valLower === usernameLower) {
            filters[key] = user.employee_id;
            req.query[key] = user.employee_id; // Just in case it's used elsewhere
          }
        }
      }
    }
    const isSuperAdmin = user && user.role && user.role.toUpperCase() === 'SUPER ADMIN';
    const dbCols = await getTableColumns(tableName);
    const colTypes = await getTableColumnTypes(tableName);
    let whereClauses = [];
    let values = [];
    let valIdx = 1;

    if (dbCols.includes('deleted_at') && !isSuperAdmin) {
      whereClauses.push(`"${tableName}"."deleted_at" IS NULL`);
    }

    if (search) {
      whereClauses.push(`("${tableName}".*)::text ILIKE $${valIdx}`);
      values.push(`%${search}%`);
      valIdx++;
    }

    // Special interceptor for employee_related on request
    if (tableName === 'request' && filters.employee_related) {
      whereClauses.push(`(
        "request"."requester" = $${valIdx} OR
        "request"."sr_creater" = $${valIdx} OR
        "request"."policy_lead" = $${valIdx} OR
        $${valIdx} = ANY(COALESCE("request"."sr_owner", ARRAY[]::text[])) OR
        EXISTS (
          SELECT 1 FROM jsonb_array_elements(COALESCE("request"."approval_flow"->'steps', '[]'::jsonb)) AS step 
          WHERE LOWER(step->>'approver') = LOWER($${valIdx})
        )
      )`);
      values.push(filters.employee_related);
      valIdx++;
      delete filters.employee_related;
    }

    // Special interceptor for employee_related on asset
    if (tableName === 'asset' && filters.employee_related) {
      whereClauses.push(`(
        "asset"."current_owner" = $${valIdx} OR
        "asset"."request" IN (
          SELECT "request"."request_id"
          FROM "request"
          WHERE
            "request"."requester" = $${valIdx} OR
            "request"."sr_creater" = $${valIdx} OR
            "request"."policy_lead" = $${valIdx} OR
            $${valIdx} = ANY(COALESCE("request"."sr_owner", ARRAY[]::text[])) OR
            EXISTS (
              SELECT 1 FROM jsonb_array_elements(COALESCE("request"."approval_flow"->'steps', '[]'::jsonb)) AS step 
              WHERE LOWER(step->>'approver') = LOWER($${valIdx})
            )
        )
      )`);
      values.push(filters.employee_related);
      valIdx++;
      delete filters.employee_related;
    }

    // Special interceptor for employee_related on service
    if (tableName === 'service' && filters.employee_related) {
      whereClauses.push(`(
        "service"."request" IN (
          SELECT "request"."request_id"
          FROM "request"
          WHERE
            "request"."requester" = $${valIdx} OR
            "request"."sr_creater" = $${valIdx} OR
            "request"."policy_lead" = $${valIdx} OR
            $${valIdx} = ANY(COALESCE("request"."sr_owner", ARRAY[]::text[])) OR
            EXISTS (
              SELECT 1 FROM jsonb_array_elements(COALESCE("request"."approval_flow"->'steps', '[]'::jsonb)) AS step 
              WHERE LOWER(step->>'approver') = LOWER($${valIdx})
            )
        )
      )`);
      values.push(filters.employee_related);
      valIdx++;
      delete filters.employee_related;
    }



    // Special interceptor for employee_related on payment
    if (tableName === 'payment' && filters.employee_related) {
      whereClauses.push(`(
        "payment"."employee" = $${valIdx} OR
        "payment"."request" IN (
          SELECT "request"."request_id"
          FROM "request"
          WHERE
            "request"."requester" = $${valIdx} OR
            "request"."sr_creater" = $${valIdx} OR
            "request"."policy_lead" = $${valIdx} OR
            $${valIdx} = ANY(COALESCE("request"."sr_owner", ARRAY[]::text[])) OR
            EXISTS (
              SELECT 1 FROM jsonb_array_elements(COALESCE("request"."approval_flow"->'steps', '[]'::jsonb)) AS step 
              WHERE LOWER(step->>'approver') = LOWER($${valIdx})
            )
        )
      )`);
      values.push(filters.employee_related);
      valIdx++;
      delete filters.employee_related;
    }

    // Special interceptor for employee_related on expense
    if (tableName === 'expense' && filters.employee_related) {
      whereClauses.push(`(
        "expense"."id__employee" = $${valIdx} OR
        "expense"."id__request" IN (
          SELECT "request"."request_id"
          FROM "request"
          WHERE
            "request"."requester" = $${valIdx} OR
            "request"."sr_creater" = $${valIdx} OR
            "request"."policy_lead" = $${valIdx} OR
            $${valIdx} = ANY(COALESCE("request"."sr_owner", ARRAY[]::text[])) OR
            EXISTS (
              SELECT 1 FROM jsonb_array_elements(COALESCE("request"."approval_flow"->'steps', '[]'::jsonb)) AS step 
              WHERE LOWER(step->>'approver') = LOWER($${valIdx})
            )
        )
      )`);
      values.push(filters.employee_related);
      valIdx++;
      delete filters.employee_related;
    }

    // Dynamic WHERE based on query params (for Slices & Master-Detail)
    for (let [key, value] of Object.entries(filters)) {
      if (key === 'slice' || key === 'pk') continue; // Exclude system parameters

      if (tableName === 'expense') {
        if (key === 'request' || key === 'request_id' || key === 'id_request') key = 'id__request';
        if (key === 'employee' || key === 'employee_id') key = 'id__employee';
        if (key === 'my_company' || key === 'company_id') key = 'id__my_company';
        if (key === 'expense_cost') key = 'id__expense_cost';
        if (key === 'expense_type') key = 'id__expense_type';
      }

      if (tableName === 'request_rating') {
        if (key === 'request' || key === 'id_request' || key === 'id__request') key = 'request_id';
      }

      if (tableName === 'assigned_task') {
        if (key === 'request' || key === 'id_request' || key === 'id__request') key = 'request_id';
      }

      if (tableName === 'asset') {
        if (key === 'my_company' || key === 'company_id') key = 'id__my_company';
      }

      const specialFilters = ['employee_related', 'my_company', 'contract_owner', 'fy', 'overdue', 'request_type', 'policy_name', 'payment_id', 'status', 'country', 'policy_type', 'finance_id'];
      if (!dbCols.includes(key) && !specialFilters.includes(key)) {
        continue;
      }

      // Handle country filter for finance
      if (key === 'country' && (tableName === 'finance' || tableName === 'v_finance')) {
        const countries = typeof value === 'string' ? value.split(',') : [value];
        const inPlaceholders = countries.map((_, i) => `$${valIdx + i}`).join(', ');
        whereClauses.push(`("${tableName}"."country" IN (${inPlaceholders}) OR "${tableName}"."company_id" IN (SELECT "my_company_id" FROM "my_company" WHERE "country" IN (${inPlaceholders})))`);
        values.push(...countries);
        valIdx += countries.length;
        continue;
      }

      // Handle policy_type filter for finance
      if (key === 'policy_type' && (tableName === 'finance' || tableName === 'v_finance')) {
        const types = typeof value === 'string' ? value.split(',') : [value];
        const inPlaceholders = types.map((_, i) => `$${valIdx + i}`).join(', ');
        whereClauses.push(`"${tableName}"."policy_type" IN (${inPlaceholders})`);
        values.push(...types);
        valIdx += types.length;
        continue;
      }

      // Handle fy filter for finance
      if (key === 'fy' && (tableName === 'finance' || tableName === 'v_finance')) {
        const fys = typeof value === 'string' ? value.split(',') : [value];
        const inPlaceholders = fys.map((_, i) => `$${valIdx + i}`).join(', ');
        whereClauses.push(`("${tableName}"."fy" IN (${inPlaceholders}) OR REPLACE("${tableName}"."fy", 'FY', '') IN (${inPlaceholders}) OR ('FY' || "${tableName}"."fy") IN (${inPlaceholders}))`);
        values.push(...fys);
        valIdx += fys.length;
        continue;
      }

      // Handle lookup field filtering from frontend (policy_name -> request_type)
      if (key === 'policy_name' && ['request', 'my_request', 'my_approval', 'my_task', 'my_process_owner'].includes(tableName)) {
        key = 'request_type';
        const policyNames = typeof value === 'string' ? value.split(',') : [value];
        if (policyNames.includes('Opportunity')) {
          const otherPolicies = policyNames.filter(p => p !== 'Opportunity');
          let conditions = [`"policy_name" ILIKE 'OPPORTUNITY%'`];
          if (otherPolicies.length > 0) {
            const inPlaceholders = otherPolicies.map((_, i) => `$${valIdx + i}`).join(', ');
            conditions.push(`"policy_name" IN (${inPlaceholders})`);
            values.push(...otherPolicies);
            valIdx += otherPolicies.length;
          }
          whereClauses.push(`"${tableName}"."${key}" IN (SELECT "policy_id" FROM "policy_and_program" WHERE ${conditions.join(' OR ')})`);
        } else {
          const inPlaceholders = policyNames.map((_, i) => `$${valIdx + i}`).join(', ');
          whereClauses.push(`"${tableName}"."${key}" IN (SELECT "policy_id" FROM "policy_and_program" WHERE "policy_name" IN (${inPlaceholders}))`);
          values.push(...policyNames);
          valIdx += policyNames.length;
        }
        continue;
      }

      // Remap status to sr_status for request
      if (key === 'status' && tableName === 'request') {
        key = 'sr_status';
      }

      // Handle lookup field filtering from frontend (my_company -> company_id)
      if (key === 'my_company' && ['payment', 'employee', 'service', 'asset', 'mtr', 'account', 'contract'].includes(tableName)) {
        const companyNames = typeof value === 'string' ? value.split(',') : [value];
        const isNumeric = companyNames.every(val => !isNaN(parseInt(val, 10)) && String(parseInt(val, 10)) === String(val).trim());

        if (isNumeric) {
          const inPlaceholders = companyNames.map((_, i) => `$${valIdx + i}`).join(', ');
          
          if (tableName === 'employee') {
            whereClauses.push(`"${tableName}"."company_id" IN (${inPlaceholders})`);
          } else if (tableName === 'account') {
            whereClauses.push(`"${tableName}"."company_entity" IN (${inPlaceholders})`);
          } else if (tableName === 'contract' || tableName === 'payment' || tableName === 'service') {
            whereClauses.push(`"${tableName}"."my_company"::text IN (${inPlaceholders})`);
          } else {
            whereClauses.push(`"${tableName}"."company_id" IN (${inPlaceholders})`);
          }
          values.push(...companyNames);
          valIdx += companyNames.length;
        } else {
          const hasNA = companyNames.some(v => v === 'N/A' || v === 'NA' || v === 'Unknown');
          const nonNACompanies = companyNames.filter(v => v !== 'N/A' && v !== 'NA' && v !== 'Unknown');

          let companyConditions = [];
          if (hasNA) {
            if (tableName === 'payment' || tableName === 'contract' || tableName === 'service') {
              companyConditions.push(`("${tableName}"."my_company" IS NULL OR "${tableName}"."my_company"::text = '' OR "${tableName}"."my_company"::text = 'N/A')`);
            } else if (tableName === 'account') {
              companyConditions.push(`("${tableName}"."company_entity" IS NULL OR "${tableName}"."company_entity"::text = '')`);
            } else {
              companyConditions.push(`("${tableName}"."company_id" IS NULL OR "${tableName}"."company_id"::text = '')`);
            }
          }

          if (nonNACompanies.length > 0) {
            const inPlaceholders = nonNACompanies.map((_, i) => `$${valIdx + i}`).join(', ');
            if (tableName === 'employee') {
              companyConditions.push(`"${tableName}"."company_id" IN (SELECT "my_company_id" FROM "my_company" WHERE "company_shortname" IN (${inPlaceholders}) OR "company_fullname" IN (${inPlaceholders}))`);
            } else if (tableName === 'account') {
              companyConditions.push(`"${tableName}"."company_entity" IN (SELECT "my_company_id" FROM "my_company" WHERE "company_shortname" IN (${inPlaceholders}) OR "company_fullname" IN (${inPlaceholders}))`);
            } else if (tableName === 'contract' || tableName === 'payment' || tableName === 'service') {
              companyConditions.push(`("${tableName}"."my_company"::text IN (SELECT "my_company_id"::text FROM "my_company" WHERE "company_shortname" IN (${inPlaceholders}) OR "company_fullname" IN (${inPlaceholders})) OR "${tableName}"."my_company"::text IN (${inPlaceholders}))`);
            } else if (tableName === 'expense') {
              companyConditions.push(`("${tableName}"."id__my_company"::text IN (${inPlaceholders}) OR "${tableName}"."id__my_company"::text IN (SELECT "my_company_id"::text FROM "my_company" WHERE "company_shortname" IN (${inPlaceholders}) OR "company_fullname" IN (${inPlaceholders})))`);
            } else {
              companyConditions.push(`"${tableName}"."company_id" IN (${inPlaceholders})`);
            }
            values.push(...nonNACompanies);
            valIdx += nonNACompanies.length;
          }

          if (companyConditions.length > 0) {
            whereClauses.push(`(${companyConditions.join(' OR ')})`);
          }
        }
        continue;
      }

      // Handle contract_owner filter for contract module
      if (key === 'contract_owner' && tableName === 'contract') {
        const ownerNames = typeof value === 'string' ? value.split(',') : [value];
        const inPlaceholders = ownerNames.map((_, i) => `$${valIdx + i}`).join(', ');
        whereClauses.push(`"${tableName}"."contract_owner" IN (SELECT "employee_id" FROM "employee" WHERE "full_name" IN (${inPlaceholders}) OR "email" IN (${inPlaceholders}))`);
        values.push(...ownerNames);
        valIdx += ownerNames.length;
        continue;
      }

      // Handle fy (Fiscal Year) filter for payment
      if (key === 'fy' && tableName === 'payment') {
        const fys = typeof value === 'string' ? value.split(',') : [value];
        const fyConditions = fys.map(fy => {
          const year = parseInt(fy, 10);
          if (!isNaN(year)) {
            return `EXTRACT(YEAR FROM "${tableName}"."due_date") = ${year}`;
          }
          return false;
        }).filter(Boolean);
        if (fyConditions.length > 0) {
          whereClauses.push(`(${fyConditions.join(' OR ')})`);
        }
        continue;
      }

      // Handle fy (Fiscal Year) filter for contract
      if (key === 'fy' && tableName === 'contract') {
        const fys = typeof value === 'string' ? value.split(',') : [value];
        const fyConditions = fys.map(fy => {
          const year = parseInt(fy, 10);
          if (!isNaN(year)) {
            return `EXTRACT(YEAR FROM "${tableName}"."contract_signed_date") = ${year}`;
          }
          return false;
        }).filter(Boolean);
        if (fyConditions.length > 0) {
          whereClauses.push(`(${fyConditions.join(' OR ')})`);
        }
        continue;
      }

      // Handle fy (Fiscal Year) filter for expense
      if (key === 'fy' && tableName === 'expense') {
        const fys = typeof value === 'string' ? value.split(',') : [value];
        const inPlaceholders = fys.map((_, i) => `$${valIdx + i}`).join(', ');
        whereClauses.push(`("${tableName}"."fy" IN (${inPlaceholders}) OR EXTRACT(YEAR FROM "${tableName}"."created_at")::text IN (${inPlaceholders}))`);
        values.push(...fys);
        valIdx += fys.length;
        continue;
      }

      // Handle overdue filter for payment
      if (key === 'overdue' && tableName === 'payment') {
        const overdueRanges = typeof value === 'string' ? value.split(',') : [value];
        const overdueConditions = overdueRanges.map(range => {
          const r = range.trim();
          const unpaidCond = `"${tableName}"."payment_status" <> 32 AND "${tableName}"."due_date" < CURRENT_DATE`;
          if (r === '0 - 30 days') {
            return `(${unpaidCond} AND CURRENT_DATE - "${tableName}"."due_date" <= 30)`;
          } else if (r === '30 - 60 days') {
            return `(${unpaidCond} AND CURRENT_DATE - "${tableName}"."due_date" > 30 AND CURRENT_DATE - "${tableName}"."due_date" <= 60)`;
          } else if (r === '60 - 90 days') {
            return `(${unpaidCond} AND CURRENT_DATE - "${tableName}"."due_date" > 60 AND CURRENT_DATE - "${tableName}"."due_date" <= 90)`;
          } else if (r === 'Over 90 days') {
            return `(${unpaidCond} AND CURRENT_DATE - "${tableName}"."due_date" > 90)`;
          }
          return 'FALSE';
        }).filter(Boolean);
        if (overdueConditions.length > 0) {
          whereClauses.push(`(${overdueConditions.join(' OR ')})`);
        }
        continue;
      }

      if (key === 'request_type' && tableName === 'request') {
        const arrValues = typeof value === 'string' ? value.split(',') : [value];
        if (arrValues.includes('VIRTUAL_OPPORTUNITY')) {
          const otherValues = arrValues.filter(p => p !== 'VIRTUAL_OPPORTUNITY');
          let conditions = [`"${tableName}"."request_type" IN (SELECT "policy_id" FROM "policy_and_program" WHERE "policy_name" ILIKE 'OPPORTUNITY%')`];
          if (otherValues.length > 0) {
            const inPlaceholders = otherValues.map((_, i) => `$${valIdx + i}`).join(', ');
            conditions.push(`"${tableName}"."request_type" IN (${inPlaceholders})`);
            values.push(...otherValues);
            valIdx += otherValues.length;
          }
          whereClauses.push(`(${conditions.join(' OR ')})`);
          continue;
        }
      }

      const colType = (colTypes && colTypes[key] ? colTypes[key] : '').toLowerCase();
      const isIntCol = ['integer', 'smallint', 'bigint'].includes(colType);

      if (typeof value === 'string' && value.includes(',')) {
        // Support bulk lookup via IN operator
        const rawValues = value.split(',');
        const inValues = rawValues.map(v => {
          const resolved = resolveStatusId(tableName, key, v.trim());
          return (resolved !== null && resolved !== undefined) ? resolved : v.trim();
        });
        if (isIntCol) {
          const validInts = inValues.filter(v => !isNaN(Number(v)) && String(v).trim() !== '');
          if (validInts.length === 0) {
            whereClauses.push('1 = 0');
          } else {
            const inPlaceholders = validInts.map((_, i) => `$${valIdx + i}`).join(', ');
            whereClauses.push(`"${tableName}"."${key}" IN (${inPlaceholders})`);
            values.push(...validInts.map(v => parseInt(v, 10)));
            valIdx += validInts.length;
          }
        } else {
          const inPlaceholders = inValues.map((_, i) => `$${valIdx + i}`).join(', ');
          whereClauses.push(`"${tableName}"."${key}" IN (${inPlaceholders})`);
          values.push(...inValues);
          valIdx += inValues.length;
        }
      } else {
        const resolved = resolveStatusId(tableName, key, value);
        const finalVal = (resolved !== null && resolved !== undefined) ? resolved : value;
        if (isIntCol) {
          if (isNaN(Number(finalVal)) || String(finalVal).trim() === '') {
            whereClauses.push('1 = 0');
          } else {
            whereClauses.push(`"${tableName}"."${key}" = $${valIdx}`);
            values.push(parseInt(finalVal, 10));
            valIdx++;
          }
        } else {
          whereClauses.push(`"${tableName}"."${key}" = $${valIdx}`);
          values.push(finalVal);
          valIdx++;
        }
      }
    }

    // === SUBDOMAIN ISOLATION FOR MULTI-TENANCY ===
    const requestHost = (req.headers.host || '').split(':')[0].toLowerCase();
    const isHelpdeskHost = requestHost === 'support.terax.ai';
    const isMainHost = requestHost === 'terax.ai' || requestHost === 'localhost' || requestHost === '127.0.0.1' || !requestHost;
    if (!isHelpdeskHost && !isMainHost) {
      if (tableName === 'cms_tenant_info') {
        whereClauses.push(`("${tableName}"."tenant_domain" = $${valIdx})`);
        values.push(requestHost);
        valIdx++;
      } else if (tableName === 'ticket') {
        whereClauses.push(`("${tableName}"."subdomain" = $${valIdx} OR "${tableName}"."subdomain" IS NULL OR "${tableName}"."subdomain" = '')`);
        values.push(requestHost);
        valIdx++;
      } else {
        const hasTicketCol = dbCols.includes('ticket');
        const hasRequestCol = dbCols.includes('request');
        if (hasTicketCol) {
          whereClauses.push(`("${tableName}"."ticket" IN (SELECT "ticket_id" FROM "ticket" WHERE "subdomain" = $${valIdx} OR "subdomain" IS NULL OR "subdomain" = ''))`);
          values.push(requestHost);
          valIdx++;
        }
      }
    }

    // === ROW-LEVEL SECURITY: Restrict request and child tables visibility by user identity ===
    const tablesWithRequestCol = ['mtr', 'payment', 'comment', 'service', 'contract', 'asset', 'invoice', 'expense'];
    if (tableName === 'account') {
      const userForFilter = getUserFromReq(req);
      if (userForFilter.employee_id) {
        const userEmpId = (userForFilter.employee_id || '').toLowerCase();
        whereClauses.push(`(
          string_to_array(REPLACE(LOWER(COALESCE("account"."finance_control", '')), ' ', ''), ',') @> ARRAY[$${valIdx}] OR
          string_to_array(REPLACE(LOWER(COALESCE("account"."transaction_managed_by", '')), ' ', ''), ',') @> ARRAY[$${valIdx}]
        )`);
        values.push(userEmpId);
        valIdx++;
      } else {
        whereClauses.push('1 = 0');
      }
    } else if (tableName === 'request' || tablesWithRequestCol.includes(tableName)) {
      const userForFilter = getUserFromReq(req);
      const isGlobalAdmin = userForFilter.role && (
        userForFilter.role.toUpperCase() === 'SUPER ADMIN' ||
        userForFilter.role.toUpperCase() === 'HR' ||
        userForFilter.role.toUpperCase() === 'ADMINISTRATOR' ||
        userForFilter.role.toUpperCase() === 'ADMIN'
      );
      if (!isGlobalAdmin && userForFilter.employee_id) {
        const userEmpId = (userForFilter.employee_id || '').toLowerCase();
        if (tableName === 'request') {
          whereClauses.push(`(
            LOWER("request"."requester") = $${valIdx} OR
            LOWER("request"."sr_creater") = $${valIdx} OR
            $${valIdx} = ANY(SELECT LOWER(x) FROM UNNEST("request"."sr_owner") x) OR
            LOWER("request"."policy_lead") = $${valIdx} OR
            EXISTS (SELECT 1 FROM jsonb_array_elements("request".approval_flow->'steps') AS step WHERE LOWER(step->>'approver') = $${valIdx}) OR
            EXISTS (SELECT 1 FROM "employee" mgr WHERE LOWER(mgr.employee_id) = $${valIdx} AND LOWER(mgr.employee_id) = (SELECT LOWER(emp.direct_manager) FROM "employee" emp WHERE LOWER(emp.employee_id) = ANY(SELECT LOWER(x) FROM UNNEST("request"."sr_owner") x) LIMIT 1)) OR
            EXISTS (SELECT 1 FROM "comment" c WHERE LOWER(c.request) = LOWER("request".request_id) AND LOWER(c.tag) LIKE LOWER('%' || $${valIdx} || '%'))
          )`);
          values.push(userEmpId);
          valIdx++;
        } else if (tableName === 'mtr') {
          const accessibleReqIds = await getUserAccessibleRequestIds(userEmpId);
          let extraOwnerConds = [];
          if (dbCols.includes('employee')) extraOwnerConds.push(`LOWER(COALESCE("${tableName}"."employee", '')) = $${valIdx + 1}`);
          if (dbCols.includes('created_by')) extraOwnerConds.push(`LOWER(COALESCE("${tableName}"."created_by", '')) = $${valIdx + 1}`);
          const extraStr = extraOwnerConds.length > 0 ? ' OR ' + extraOwnerConds.join(' OR ') : '';

          whereClauses.push(`(
            "${tableName}"."request" IS NULL OR
            NOT EXISTS (SELECT 1 FROM "request" r WHERE LOWER(r.request_id) = LOWER("${tableName}"."request")) OR
            LOWER("${tableName}"."request") = ANY($${valIdx}::text[]) OR
            EXISTS (
              SELECT 1 FROM "account" acc
              WHERE acc.account_id = "${tableName}"."account" AND (
                string_to_array(REPLACE(REPLACE(LOWER(COALESCE(acc.finance_control, '')), ' ', ''), '@mps-aisa.com', '@mps-asia.com'), ',') @> ARRAY[$${valIdx + 1}] OR
                string_to_array(REPLACE(REPLACE(LOWER(COALESCE(acc.transaction_managed_by, '')), ' ', ''), '@mps-aisa.com', '@mps-asia.com'), ',') @> ARRAY[$${valIdx + 1}]
              )
            )${extraStr}
          )`);
          values.push(accessibleReqIds, userEmpId);
          valIdx += 2;
        } else {
          const accessibleReqIds = await getUserAccessibleRequestIds(userEmpId);
          let reqCol = dbCols.includes('id__request') ? 'id__request' : (dbCols.includes('id_request') ? 'id_request' : 'request');
          let extraOwnerConds = [];
          if (dbCols.includes('employee')) extraOwnerConds.push(`LOWER(COALESCE("${tableName}"."employee", '')) = $${valIdx + 1}`);
          if (dbCols.includes('id__employee')) extraOwnerConds.push(`LOWER(COALESCE("${tableName}"."id__employee", '')) = $${valIdx + 1}`);
          if (dbCols.includes('created_by')) extraOwnerConds.push(`LOWER(COALESCE("${tableName}"."created_by", '')) = $${valIdx + 1}`);
          if (dbCols.includes('contract_owner')) extraOwnerConds.push(`LOWER(COALESCE("${tableName}"."contract_owner", '')) = $${valIdx + 1}`);
          const extraStr = extraOwnerConds.length > 0 ? ' OR ' + extraOwnerConds.join(' OR ') : '';

          whereClauses.push(`(
            "${tableName}"."${reqCol}" IS NULL OR
            NOT EXISTS (SELECT 1 FROM "request" r WHERE LOWER(r.request_id) = LOWER("${tableName}"."${reqCol}")) OR
            LOWER("${tableName}"."${reqCol}") = ANY($${valIdx}::text[])
            ${extraStr}
          )`);
          values.push(accessibleReqIds);
          valIdx++;
          if (extraOwnerConds.length > 0) {
            values.push(userEmpId);
            valIdx++;
          }
        }
      }
    }

    if (tableName === 'assigned_task' || tableName === 'task_subtask') {
      const userForFilter = getUserFromReq(req);
      if (userForFilter.employee_id) {
        const userEmpId = (userForFilter.employee_id || '').toLowerCase();
        const isGlobalAdmin = userForFilter.role && (
          userForFilter.role.toUpperCase() === 'SUPER ADMIN' ||
          userForFilter.role.toUpperCase() === 'HR' ||
          userForFilter.role.toUpperCase() === 'ADMINISTRATOR' ||
          userForFilter.role.toUpperCase() === 'ADMIN'
        );

        if (tableName === 'assigned_task') {
          const hasRequestFilter = req.query.request_id || req.query.request;
          if (hasRequestFilter) {
            if (!isGlobalAdmin) {
              const accessibleReqIds = await getUserAccessibleRequestIds(userEmpId);
              whereClauses.push(`(
                LOWER("assigned_task"."employee_id") = $${valIdx} OR
                LOWER("assigned_task"."request_id") = ANY($${valIdx + 1}::text[])
              )`);
              values.push(userEmpId, accessibleReqIds);
              valIdx += 2;
            }
          } else {
            // General view (My Tasks list): EVERYONE (including Super Admin) only sees their own tasks
            whereClauses.push(`LOWER("assigned_task"."employee_id") = $${valIdx}`);
            values.push(userEmpId);
            valIdx++;
            whereClauses.push(`"assigned_task"."request_status" IN (8, 9)`);
          }
        } else if (tableName === 'task_subtask') {
          const hasTaskFilter = req.query.task_id || req.query.task;
          if (hasTaskFilter) {
            if (!isGlobalAdmin) {
              whereClauses.push(`(
                LOWER("task_subtask"."task_id") IN (
                  SELECT LOWER(task_id)
                  FROM "assigned_task"
                  WHERE
                    LOWER(employee_id) = $${valIdx} OR
                    LOWER(request_id) IN (
                      SELECT LOWER(request_id)
                      FROM "request"
                      WHERE
                        LOWER(requester) = $${valIdx} OR
                        LOWER(sr_creater) = $${valIdx} OR
                        $${valIdx} = ANY(SELECT LOWER(x) FROM UNNEST(sr_owner) x) OR
                        LOWER(policy_lead) = $${valIdx} OR
                        EXISTS (SELECT 1 FROM jsonb_array_elements(approval_flow->'steps') AS step WHERE LOWER(step->>'approver') = $${valIdx})
                    )
                )
              )`);
              values.push(userEmpId);
              valIdx++;
            }
          } else {
            // General view: only show subtasks of tasks assigned to the user
            whereClauses.push(`(
              LOWER("task_subtask"."task_id") IN (
                SELECT LOWER(task_id)
                FROM "assigned_task"
                WHERE LOWER(employee_id) = $${valIdx}
              )
            )`);
            values.push(userEmpId);
            valIdx++;
          }
        }
      }
    }
    // ====================================================================

    // Check Slice Permissions
    const sliceName = req.query.slice || tableName;
    const hasAccess = await checkPermission('exception_rules', sliceName, user);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied: You do not have permission to view this slice.' });
    }

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    let baseTableOrCTE = `"${tableName}"`;
    if (tableName === 'contract') {
      baseTableOrCTE = `(
        SELECT c.*, sc.status_key AS type_key, sc.color_code AS type_color,
          COALESCE(c.total_value, (COALESCE(c.value_before_vat, 0) + COALESCE(c.vat_value, 0))) as total_value,
          COALESCE(c.value_before_vat_in_base_currency, ROUND(COALESCE(c.value_before_vat, 0) * COALESCE(c.exchance_rate, 1))) as value_before_vat_in_base_currency,
          COALESCE(c.vat_value_in_base_currency, ROUND(COALESCE(c.vat_value, 0) * COALESCE(c.exchance_rate, 1))) as vat_value_in_base_currency,
          COALESCE(c.total_value_in_base_currency, ROUND((COALESCE(c.value_before_vat, 0) + COALESCE(c.vat_value, 0)) * COALESCE(c.exchance_rate, 1))) as total_value_in_base_currency
        FROM "contract" c
        LEFT JOIN status_catalog sc ON c.type = sc.id
      ) as "${tableName}"`;
    } else if (tableName === 'invoice') {
      baseTableOrCTE = `(
        SELECT i.*, sc.status_key AS invoice_status_key, sc.color_code AS invoice_status_color,
          COALESCE(i.total_value, (COALESCE(i.value_before_vat, 0) + COALESCE(NULLIF(regexp_replace(i.vat_value::text, '[^0-9.]', '', 'g'), '')::numeric, 0))) as total_value,
          COALESCE(i.value_before_vat_in_base_currency, ROUND(COALESCE(i.value_before_vat, 0) * COALESCE(i.exchange_rate, 1))) as value_before_vat_in_base_currency,
          COALESCE(i.vat_value_in_base_currency, ROUND(COALESCE(NULLIF(regexp_replace(i.vat_value::text, '[^0-9.]', '', 'g'), '')::numeric, 0) * COALESCE(i.exchange_rate, 1))) as vat_value_in_base_currency,
          COALESCE(i.total_value_in_base_currency, ROUND((COALESCE(i.value_before_vat, 0) + COALESCE(NULLIF(regexp_replace(i.vat_value::text, '[^0-9.]', '', 'g'), '')::numeric, 0)) * COALESCE(i.exchange_rate, 1))) as total_value_in_base_currency
        FROM "invoice" i
        LEFT JOIN status_catalog sc ON i.invoice_status = sc.id
      ) as "${tableName}"`;
    } else if (tableName === 'account') {
      baseTableOrCTE = `(
        WITH mtr_stats AS (
          SELECT 
            account,
            SUM(CASE WHEN transaction_type = 'Incoming payment' THEN amount WHEN transaction_type = 'Outgoing payment' THEN -amount ELSE 0 END) as balance,
            MAX(transaction_date) as latest_transaction_date
          FROM "mtr"
          GROUP BY account
        )
        SELECT a.*, sc.status_key AS account_status_key, sc.color_code AS account_status_color,
          COALESCE(ms.balance, 0) as balance,
          COALESCE(ms.balance, 0) * COALESCE(a.exchange_rate, 1) as balance_in_base_currency,
          ms.latest_transaction_date as latest_transaction_date
        FROM "account" a
        LEFT JOIN mtr_stats ms ON a.account_id = ms.account
        LEFT JOIN status_catalog sc ON a.account_status = sc.id
      ) as "${tableName}"`;
    } else if (tableName === 'asset') {
      baseTableOrCTE = `(
        SELECT a.*, sc.status_key AS status_key, sc.color_code AS status_color, COALESCE(mc_owner.company_shortname, mc_req.company_shortname) as company_id, 
               (CASE WHEN LOWER(COALESCE(e.status::text, '')) IN ('inactive', '18') THEN COALESCE(e.email, e.username, e.full_name) ELSE CASE WHEN e.email IS NOT NULL AND e.email <> '' THEN e.full_name || ' (' || e.email || ')' ELSE e.full_name END END) as current_owner_name,
               COALESCE(a.value_in_base_currency, ROUND(COALESCE(NULLIF(regexp_replace(a.purchase_cost, '[^0-9.]', '', 'g'), '')::numeric, 0) * COALESCE(NULLIF(regexp_replace(a.exchange_rate, '[^0-9.]', '', 'g'), '')::numeric, 1))) as value_in_base_currency
        FROM "asset" a
        LEFT JOIN "employee" e ON a.current_owner = e.employee_id
        LEFT JOIN "my_company" mc_owner ON e.company_id = mc_owner.my_company_id
        LEFT JOIN "request" r ON a.request = r.request_id
        LEFT JOIN "employee" e_req ON r.requester = e_req.employee_id
        LEFT JOIN "my_company" mc_req ON e_req.company_id = mc_req.my_company_id
        LEFT JOIN status_catalog sc ON a.status = sc.id
      ) as "${tableName}"`;
    } else if (tableName === 'service') {
      baseTableOrCTE = `(
        SELECT s.*, sc.status_key AS status_key, sc.color_code AS status_color,
               sc_type.status_key AS service_type_key, sc_type.color_code AS service_type_color,
               COALESCE(s.my_company, mc.company_shortname) as company_id, 
               (CASE WHEN LOWER(COALESCE(e.status::text, '')) IN ('inactive', '18') THEN COALESCE(e.email, e.username, e.full_name) ELSE CASE WHEN e.email IS NOT NULL AND e.email <> '' THEN e.full_name || ' (' || e.email || ')' ELSE e.full_name END END) as requester,
          0::numeric as value,
          null::text as currency,
          0::numeric as value_in_base_currency
        FROM "service" s
        LEFT JOIN "request" r ON s.request = r.request_id
        LEFT JOIN "employee" e ON r.requester = e.employee_id
        LEFT JOIN "my_company" mc ON e.company_id = mc.my_company_id
        LEFT JOIN status_catalog sc ON s.status = sc.id
        LEFT JOIN status_catalog sc_type ON s.service_type = sc_type.id
      ) as "${tableName}"`;
    } else if (tableName === 'mtr') {
      baseTableOrCTE = `(
        SELECT m.*, sc.status_key AS status_key, sc.color_code AS status_color, mc.company_shortname as company_id,
          acc.currency, acc.account_number, acc.account_status as account_status,
          m.amount * COALESCE(m.exchange_rate, acc.exchange_rate, 1) as value_in_base_currency,
          (SELECT p.payment_id FROM "payment" p WHERE p.transaction_id = m.transaction_id LIMIT 1) as payment_id
        FROM "mtr" m
        LEFT JOIN "account" acc ON m.account = acc.account_id
        LEFT JOIN "my_company" mc ON acc.company_entity = mc.my_company_id
        LEFT JOIN status_catalog sc ON m.status = sc.id
      ) as "${tableName}"`;
    } else if (tableName === 'payment') {
      baseTableOrCTE = `(
        SELECT p.*, sc.status_key AS payment_status_key, sc.color_code AS payment_status_color,
               COALESCE(mc_pay.company_shortname, mc.company_shortname) as company_id,
               COALESCE(mc_pay.company_shortname, mc.company_shortname) as company_shortname, 
               (CASE WHEN LOWER(COALESCE(e.status::text, '')) IN ('inactive', '18') THEN COALESCE(e.email, e.username, e.full_name) ELSE CASE WHEN e.email IS NOT NULL AND e.email <> '' THEN e.full_name || ' (' || e.email || ')' ELSE e.full_name END END) as requester,
          COALESCE(p.value_in_base_currency, ROUND(COALESCE(p.value, 0) * COALESCE(p.exchange_rate, 1))) as value_in_base_currency
        FROM "payment" p
        LEFT JOIN "my_company" mc_pay ON (CAST(p.my_company AS text) = CAST(mc_pay.my_company_id AS text) OR p.my_company = mc_pay.company_shortname)
        LEFT JOIN "request" r ON p.request = r.request_id
        LEFT JOIN "employee" e ON r.requester = e.employee_id
        LEFT JOIN "my_company" mc ON e.company_id = mc.my_company_id
        LEFT JOIN status_catalog sc ON p.payment_status = sc.id
      ) as "${tableName}"`;
    } else if (tableName === 'expense') {
      baseTableOrCTE = `(
        SELECT ex.*,
               sc_type.status_key AS id__expense_type_key, sc_type.color_code AS id__expense_type_color,
               sc_cost.status_key AS id__expense_cost_key, sc_cost.color_code AS id__expense_cost_color,
               ex.id__request AS request,
               ex.id__employee AS employee,
               ex.id__my_company AS my_company,
               ex.value_before_vat AS value,
               (CASE WHEN LOWER(COALESCE(e.status::text, '')) IN ('inactive', '18') THEN COALESCE(e.email, e.username, e.full_name) ELSE CASE WHEN e.email IS NOT NULL AND e.email <> '' THEN e.full_name || ' (' || e.email || ')' ELSE e.full_name END END) as requester,
               COALESCE(ex.total_value, (COALESCE(ex.value_before_vat, 0) + COALESCE(ex.vat_value, 0))) as total_value,
               COALESCE(ex.value_before_vat_in_base_currency, ROUND(COALESCE(ex.value_before_vat, 0) * COALESCE(ex.exchange_rate, 1))) as value_before_vat_in_base_currency,
               COALESCE(ex.vat_value_in_base_currency, ROUND(COALESCE(ex.vat_value, 0) * COALESCE(ex.exchange_rate, 1))) as vat_value_in_base_currency,
               COALESCE(ex.total_value_in_base_currency, ROUND((COALESCE(ex.value_before_vat, 0) + COALESCE(ex.vat_value, 0)) * COALESCE(ex.exchange_rate, 1))) as total_value_in_base_currency
        FROM "expense" ex
        LEFT JOIN "request" r ON ex.id__request = r.request_id
        LEFT JOIN "employee" e ON r.requester = e.employee_id
        LEFT JOIN status_catalog sc_type ON ex.id__expense_type = sc_type.id
        LEFT JOIN status_catalog sc_cost ON ex.id__expense_cost = sc_cost.id
      ) as "${tableName}"`;
    } else if (tableName === 'assigned_task') {
      baseTableOrCTE = `(
        SELECT t.*, r.process_status AS request_status, sc.status_key AS request_status_key, sc.color_code AS request_status_color
        FROM "assigned_task" t
        LEFT JOIN "request" r ON t.request_id = r.request_id
        LEFT JOIN status_catalog sc ON r.process_status = sc.id
      ) AS "${tableName}"`;
    } else if (tableName === 'request') {
      baseTableOrCTE = `(
        SELECT r.*, mc.company_shortname as company_shortname, p.policy_name, p.approval_level as policy_approval_level, p.elements as policy_elements, p.sla as policy_sla,
          sc_sr.status_key AS sr_status_key, sc_sr.color_code AS sr_status_color,
          sc_proc.status_key AS process_status_key, sc_proc.color_code AS process_status_color,
          (CASE WHEN LOWER(COALESCE(e.status::text, '')) IN ('inactive', '18') THEN COALESCE(e.email, e.username, e.full_name) ELSE CASE WHEN e.email IS NOT NULL AND e.email <> '' THEN e.full_name || ' (' || e.email || ')' ELSE e.full_name END END) as requester_name, 
          (CASE WHEN LOWER(COALESCE(e2.status::text, '')) IN ('inactive', '18') THEN COALESCE(e2.email, e2.username, e2.full_name) ELSE CASE WHEN e2.email IS NOT NULL AND e2.email <> '' THEN e2.full_name || ' (' || e2.email || ')' ELSE e2.full_name END END) as sr_creater_name, 
          (CASE WHEN LOWER(COALESCE(e6.status::text, '')) IN ('inactive', '18') THEN COALESCE(e6.email, e6.username, e6.full_name) ELSE CASE WHEN e6.email IS NOT NULL AND e6.email <> '' THEN e6.full_name || ' (' || e6.email || ')' ELSE e6.full_name END END) as policy_lead_name,
          (
            SELECT array_agg(CASE WHEN LOWER(COALESCE(e7.status::text, '')) IN ('inactive', '18') THEN COALESCE(e7.email, e7.username, e7.full_name, owner_id) ELSE CASE WHEN e7.email IS NOT NULL AND e7.email <> '' THEN e7.full_name || ' (' || e7.email || ')' ELSE COALESCE(e7.full_name, owner_id) END END) 
            FROM unnest(r.sr_owner) AS owner_id 
            LEFT JOIN employee e7 ON LOWER(e7.employee_id) = LOWER(owner_id) OR LOWER(e7.email) = LOWER(owner_id)
          ) as sr_owner_name
        FROM "request" r
        LEFT JOIN "employee" e ON r.requester = e.employee_id OR LOWER(r.requester) = LOWER(e.email)
        LEFT JOIN "employee" e2 ON r.sr_creater = e2.employee_id OR LOWER(r.sr_creater) = LOWER(e2.email)
        LEFT JOIN "employee" e6 ON r.policy_lead = e6.employee_id OR LOWER(r.policy_lead) = LOWER(e6.email)
        LEFT JOIN "my_company" mc ON e.company_id = mc.my_company_id
        LEFT JOIN "policy_and_program" p ON r.request_type = p.policy_id::text
        LEFT JOIN status_catalog sc_sr ON r.sr_status = sc_sr.id
        LEFT JOIN status_catalog sc_proc ON r.process_status = sc_proc.id
      ) as "${tableName}"`;
    } else if (tableName === 'my_company') {
      baseTableOrCTE = `(
        SELECT mc.*, sc.status_key AS status_key, sc.color_code AS status_color,
          (SELECT COUNT(*)::int FROM "department" d WHERE (d."company_id" = mc."my_company_id" OR d."company_id" = mc."company_shortname")) as "department",
          (SELECT COUNT(*)::int FROM "employee" e WHERE (e."company_id" = mc."my_company_id" OR e."company_id" = mc."company_shortname")) as "employee",
          (SELECT COUNT(*)::int FROM "account" a WHERE (a."company_entity" = mc."my_company_id" OR a."company_entity" = mc."company_shortname")) as "account",
          (SELECT COUNT(*)::int FROM "policy_and_program" p WHERE (p."company_id" = mc."my_company_id" OR p."company_id" = mc."company_shortname" OR (p."company_id" IS NULL AND mc."my_company_id" = '1'))) as "policy",
          (SELECT COUNT(*)::int FROM "my_location" l WHERE (l."my_company" = mc."company_shortname" OR l."my_company" = mc."my_company_id")) as "my_location",
          (SELECT COUNT(*)::int FROM "operation_program" op WHERE (op."company_id" = mc."my_company_id" OR op."company_id" = mc."company_shortname")) as "operation_program"
        FROM "my_company" mc
        LEFT JOIN status_catalog sc ON mc.status = sc.id
      ) as "${tableName}"`;
    } else if (tableName === 'employee' || tableName === 'employee_active') {
      baseTableOrCTE = `(
        SELECT e.employee_id, e.employee_code, e.username, e.full_name, e.nick_name, e.email, e.gen, e.phone, e.position, e.employee_level, e.role, e.status, e.location_base, e.direct_manager, e.head_manager, e.department_id, e.company_id, e.app_user_enabled, e.avatar, e.deleted_at, mc.company_shortname as company_shortname, d.department_name as department_name,
               sc.status_key AS status_key, sc.color_code AS status_color
        FROM "${tableName === 'employee' ? 'employee' : 'employee_active'}" e
        LEFT JOIN "my_company" mc ON e.company_id = mc.my_company_id
        LEFT JOIN "department" d ON e.department_id = d.department_id
        LEFT JOIN status_catalog sc ON e.status = sc.id
      ) as "${tableName}"`;
    } else if (tableName === 'department') {
      baseTableOrCTE = `(
        SELECT d.*, mc.company_shortname as company_shortname
        FROM "department" d
        LEFT JOIN "my_company" mc ON d.company_id = mc.my_company_id
      ) as "${tableName}"`;
    } else if (tableName === 'finance' || tableName === 'v_finance') {
      const fdIdx = valIdx;
      const tdIdx = valIdx + 1;
      valIdx += 2;
      values.push(fromDateVal, toDateVal);

      baseTableOrCTE = `(
        WITH contract_agg AS (
          SELECT 
            COALESCE(c.request, c.id__request) AS request_id,
            COUNT(CASE WHEN c.type = 69 OR c.type::text = '69' OR LOWER(c.type::text) LIKE '%sell%' OR LOWER(c.type::text) LIKE '%bán%' THEN 1 END) AS selling_contract_count,
            SUM(CASE WHEN c.type = 69 OR c.type::text = '69' OR LOWER(c.type::text) LIKE '%sell%' OR LOWER(c.type::text) LIKE '%bán%' 
                THEN COALESCE(c.total_value_in_base_currency, c.total_value * COALESCE(c.exchance_rate, 1.0), COALESCE(c.value_before_vat_in_base_currency, c.value_before_vat * COALESCE(c.exchance_rate, 1.0), 0) + COALESCE(c.vat_value_in_base_currency, c.vat_value * COALESCE(c.exchance_rate, 1.0), 0)) 
                ELSE 0 END) AS selling,
            SUM(CASE WHEN c.type = 69 OR c.type::text = '69' OR LOWER(c.type::text) LIKE '%sell%' OR LOWER(c.type::text) LIKE '%bán%' 
                THEN COALESCE(c.vat_value_in_base_currency, c.vat_value * COALESCE(c.exchance_rate, 1.0), 0) 
                ELSE 0 END) AS vat_selling,
            SUM(CASE WHEN c.type = 69 OR c.type::text = '69' OR LOWER(c.type::text) LIKE '%sell%' OR LOWER(c.type::text) LIKE '%bán%' 
                THEN COALESCE(c.value_before_vat_in_base_currency, c.value_before_vat * COALESCE(c.exchance_rate, 1.0), 0) 
                ELSE 0 END) AS selling_wo_vat,
            COUNT(CASE WHEN c.type = 70 OR c.type::text = '70' OR LOWER(c.type::text) LIKE '%buy%' OR LOWER(c.type::text) LIKE '%mua%' THEN 1 END) AS buying_contract_count,
            SUM(CASE WHEN c.type = 70 OR c.type::text = '70' OR LOWER(c.type::text) LIKE '%buy%' OR LOWER(c.type::text) LIKE '%mua%' 
                THEN COALESCE(c.total_value_in_base_currency, c.total_value * COALESCE(c.exchance_rate, 1.0), COALESCE(c.value_before_vat_in_base_currency, c.value_before_vat * COALESCE(c.exchance_rate, 1.0), 0) + COALESCE(c.vat_value_in_base_currency, c.vat_value * COALESCE(c.exchance_rate, 1.0), 0)) 
                ELSE 0 END) AS buying,
            SUM(CASE WHEN c.type = 70 OR c.type::text = '70' OR LOWER(c.type::text) LIKE '%buy%' OR LOWER(c.type::text) LIKE '%mua%' 
                THEN COALESCE(c.vat_value_in_base_currency, c.vat_value * COALESCE(c.exchance_rate, 1.0), 0) 
                ELSE 0 END) AS vat_buying,
            SUM(CASE WHEN c.type = 70 OR c.type::text = '70' OR LOWER(c.type::text) LIKE '%buy%' OR LOWER(c.type::text) LIKE '%mua%' 
                THEN COALESCE(c.value_before_vat_in_base_currency, c.value_before_vat * COALESCE(c.exchance_rate, 1.0), 0) 
                ELSE 0 END) AS buying_wo_vat
          FROM contract c
          WHERE c.deleted_at IS NULL AND COALESCE(c.request, c.id__request) IS NOT NULL
          GROUP BY COALESCE(c.request, c.id__request)
        ),
        payment_agg AS (
          SELECT
            COALESCE(p.request, c.request, c.id__request) AS request_id,
            COUNT(CASE WHEN (c.type = 69 OR p.payment_type = 60) THEN 1 END) AS incoming_pm_count,
            SUM(CASE WHEN (c.type = 69 OR p.payment_type = 60) 
                THEN COALESCE(p.value_in_base_currency, p.value * COALESCE(p.exchange_rate, 1.0), 0) ELSE 0 END) AS incoming_payment,
            SUM(CASE WHEN (c.type = 69 OR p.payment_type = 60) AND (p.payment_status = 32 OR LOWER(p.payment_status::text) = 'paid') 
                THEN COALESCE(p.value_in_base_currency, p.value * COALESCE(p.exchange_rate, 1.0), 0) ELSE 0 END) AS incoming_payment_paid,
            SUM(CASE WHEN (c.type = 69 OR p.payment_type = 60) AND NOT (p.payment_status = 32 OR LOWER(p.payment_status::text) = 'paid') AND (p.due_date IS NOT NULL AND p.due_date::date > CURRENT_DATE) 
                THEN COALESCE(p.value_in_base_currency, p.value * COALESCE(p.exchange_rate, 1.0), 0) ELSE 0 END) AS incoming_pm_not_due_yet,
            SUM(CASE WHEN (c.type = 69 OR p.payment_type = 60) AND NOT (p.payment_status = 32 OR LOWER(p.payment_status::text) = 'paid') AND (p.due_date IS NULL OR p.due_date::date <= CURRENT_DATE) 
                THEN COALESCE(p.value_in_base_currency, p.value * COALESCE(p.exchange_rate, 1.0), 0) ELSE 0 END) AS incoming_pm_pending_pm,
            COUNT(CASE WHEN (c.type = 70 OR p.payment_type = 61) THEN 1 END) AS outgoing_pm_count,
            SUM(CASE WHEN (c.type = 70 OR p.payment_type = 61) 
                THEN COALESCE(p.value_in_base_currency, p.value * COALESCE(p.exchange_rate, 1.0), 0) ELSE 0 END) AS outgoing_payment,
            SUM(CASE WHEN (c.type = 70 OR p.payment_type = 61) AND (p.payment_status = 32 OR LOWER(p.payment_status::text) = 'paid') 
                THEN COALESCE(p.value_in_base_currency, p.value * COALESCE(p.exchange_rate, 1.0), 0) ELSE 0 END) AS outgoing_payment_paid,
            SUM(CASE WHEN (c.type = 70 OR p.payment_type = 61) AND NOT (p.payment_status = 32 OR LOWER(p.payment_status::text) = 'paid') AND (p.due_date IS NOT NULL AND p.due_date::date > CURRENT_DATE) 
                THEN COALESCE(p.value_in_base_currency, p.value * COALESCE(p.exchange_rate, 1.0), 0) ELSE 0 END) AS outgoing_pm_not_due_yet,
            SUM(CASE WHEN (c.type = 70 OR p.payment_type = 61) AND NOT (p.payment_status = 32 OR LOWER(p.payment_status::text) = 'paid') AND (p.due_date IS NULL OR p.due_date::date <= CURRENT_DATE) 
                THEN COALESCE(p.value_in_base_currency, p.value * COALESCE(p.exchange_rate, 1.0), 0) ELSE 0 END) AS outgoing_pm_pending_pm
          FROM payment p
          LEFT JOIN contract c ON p.contract_id = c.contract_id AND c.deleted_at IS NULL
          WHERE p.deleted_at IS NULL AND COALESCE(p.request, c.request, c.id__request) IS NOT NULL
          GROUP BY COALESCE(p.request, c.request, c.id__request)
        ),
        invoice_agg AS (
          SELECT
            COALESCE(i.request, c.request, c.id__request) AS request_id,
            COUNT(CASE WHEN (c.type = 69 OR i.invoice_type = '71' OR LOWER(i.invoice_type::text) = 'selling') THEN 1 END) AS selling_invoice_count,
            SUM(CASE WHEN (c.type = 69 OR i.invoice_type = '71' OR LOWER(i.invoice_type::text) = 'selling') 
                THEN COALESCE(i.total_value_in_base_currency, i.total_value * COALESCE(i.exchange_rate, 1.0), 0) ELSE 0 END) AS selling_invoice_total_value,
            COUNT(CASE WHEN NOT (c.type = 69 OR i.invoice_type = '71' OR LOWER(i.invoice_type::text) = 'selling') THEN 1 END) AS buying_invoice_count,
            SUM(CASE WHEN NOT (c.type = 69 OR i.invoice_type = '71' OR LOWER(i.invoice_type::text) = 'selling') 
                THEN COALESCE(i.total_value_in_base_currency, i.total_value * COALESCE(i.exchange_rate, 1.0), 0) ELSE 0 END) AS buying_invoice_total_value
          FROM invoice i
          LEFT JOIN contract c ON i.contract_id = c.contract_id AND c.deleted_at IS NULL
          WHERE i.deleted_at IS NULL AND COALESCE(i.request, c.request, c.id__request) IS NOT NULL
          GROUP BY COALESCE(i.request, c.request, c.id__request)
        ),
        expense_agg AS (
          SELECT
            e.id__request AS request_id,
            SUM(CASE WHEN e.id__expense_type = 107 OR LOWER(e.id__expense_type::text) = 'non expense' 
                THEN 0 
                ELSE COALESCE(e.total_value_in_base_currency, e.total_value * COALESCE(e.exchange_rate, 1.0), COALESCE(e.value_before_vat, 0) * COALESCE(e.exchange_rate, 1.0), 0) END) AS expense,
            SUM(CASE WHEN e.id__expense_type = 107 OR LOWER(e.id__expense_type::text) = 'non expense' 
                THEN COALESCE(e.total_value_in_base_currency, e.total_value * COALESCE(e.exchange_rate, 1.0), COALESCE(e.value_before_vat, 0) * COALESCE(e.exchange_rate, 1.0), 0) 
                ELSE 0 END) AS non_expense,
            MAX(e.fy) AS exp_fy
          FROM expense e
          WHERE e.deleted_at IS NULL AND e.id__request IS NOT NULL
          GROUP BY e.id__request
        ),
        asset_agg AS (
          SELECT
            a.request AS request_id,
            SUM(COALESCE(
              a.value_in_base_currency,
              COALESCE(NULLIF(regexp_replace(a.purchase_cost, '[^0-9.]', '', 'g'), '')::numeric, 0) * COALESCE(NULLIF(regexp_replace(a.exchange_rate, '[^0-9.]', '', 'g'), '')::numeric, 1.0)
            )) AS asset
          FROM asset a
          WHERE a.deleted_at IS NULL AND a.request IS NOT NULL
          GROUP BY a.request
        ),
        request_financials AS (
          SELECT 
            r.request_id,
            r.request_type,
            (CASE 
              WHEN ea.exp_fy IS NOT NULL AND ea.exp_fy <> '' THEN 
                (CASE WHEN ea.exp_fy LIKE 'FY%' THEN ea.exp_fy ELSE 'FY' || ea.exp_fy END)
              ELSE 'FY' || EXTRACT(YEAR FROM COALESCE(r.sr_submitted_date, r.sr_created_date, CURRENT_TIMESTAMP))::text 
            END) AS fy,
            COALESCE(ca.selling_contract_count, 0) AS selling_contract_count,
            COALESCE(ca.selling, 0) AS selling,
            COALESCE(ca.vat_selling, 0) AS vat_selling,
            COALESCE(ca.selling_wo_vat, 0) AS selling_wo_vat,
            COALESCE(ca.buying_contract_count, 0) AS buying_contract_count,
            COALESCE(ca.buying, 0) AS buying,
            COALESCE(ca.vat_buying, 0) AS vat_buying,
            COALESCE(ca.buying_wo_vat, 0) AS buying_wo_vat,
            COALESCE(pa.incoming_pm_count, 0) AS incoming_pm_count,
            COALESCE(pa.incoming_payment, 0) AS incoming_payment,
            COALESCE(pa.incoming_payment_paid, 0) AS incoming_payment_paid,
            COALESCE(pa.incoming_pm_not_due_yet, 0) AS incoming_pm_not_due_yet,
            COALESCE(pa.incoming_pm_pending_pm, 0) AS incoming_pm_pending_pm,
            COALESCE(pa.outgoing_pm_count, 0) AS outgoing_pm_count,
            COALESCE(pa.outgoing_payment, 0) AS outgoing_payment,
            COALESCE(pa.outgoing_payment_paid, 0) AS outgoing_payment_paid,
            COALESCE(pa.outgoing_pm_not_due_yet, 0) AS outgoing_pm_not_due_yet,
            COALESCE(pa.outgoing_pm_pending_pm, 0) AS outgoing_pm_pending_pm,
            COALESCE(ia.selling_invoice_count, 0) AS selling_invoice_count,
            COALESCE(ia.selling_invoice_total_value, 0) AS selling_invoice_total_value,
            COALESCE(ia.buying_invoice_count, 0) AS buying_invoice_count,
            COALESCE(ia.buying_invoice_total_value, 0) AS buying_invoice_total_value,
            COALESCE(ea.expense, 0) AS expense,
            COALESCE(ea.non_expense, 0) AS non_expense,
            COALESCE(aa.asset, 0) AS asset
          FROM request r
          LEFT JOIN contract_agg ca ON r.request_id = ca.request_id
          LEFT JOIN payment_agg pa ON r.request_id = pa.request_id
          LEFT JOIN invoice_agg ia ON r.request_id = ia.request_id
          LEFT JOIN expense_agg ea ON r.request_id = ea.request_id
          LEFT JOIN asset_agg aa ON r.request_id = aa.request_id
          WHERE r.deleted_at IS NULL
            AND ($${fdIdx}::date IS NULL OR COALESCE(r.sr_submitted_date, r.sr_created_date)::date >= $${fdIdx}::date)
            AND ($${tdIdx}::date IS NULL OR COALESCE(r.sr_submitted_date, r.sr_created_date)::date <= $${tdIdx}::date)
        ),
        process_summary AS (
          SELECT
            rf.request_type AS process_id,
            rf.fy,
            COUNT(rf.request_id) AS total_requests,
            SUM(rf.selling_contract_count) AS selling_contract_count,
            SUM(rf.selling) AS selling,
            SUM(rf.vat_selling) AS vat_selling,
            SUM(rf.selling_wo_vat) AS selling_wo_vat,
            SUM(rf.buying_contract_count) AS buying_contract_count,
            SUM(rf.buying) AS buying,
            SUM(rf.vat_buying) AS vat_buying,
            SUM(rf.buying_wo_vat) AS buying_wo_vat,
            (SUM(rf.selling) - SUM(rf.buying)) AS gm,
            (SUM(rf.selling_wo_vat) - SUM(rf.buying_wo_vat)) AS gm_wo_vat,
            SUM(rf.incoming_pm_count) AS incoming_pm_count,
            SUM(rf.incoming_payment) AS incoming_payment,
            SUM(rf.incoming_payment_paid) AS incoming_payment_paid,
            SUM(rf.incoming_pm_not_due_yet) AS incoming_pm_not_due_yet,
            SUM(rf.incoming_pm_pending_pm) AS incoming_pm_pending_pm,
            SUM(rf.outgoing_pm_count) AS outgoing_pm_count,
            SUM(rf.outgoing_payment) AS outgoing_payment,
            SUM(rf.outgoing_payment_paid) AS outgoing_payment_paid,
            SUM(rf.outgoing_pm_not_due_yet) AS outgoing_pm_not_due_yet,
            SUM(rf.outgoing_pm_pending_pm) AS outgoing_pm_pending_pm,
            SUM(rf.selling_invoice_count) AS selling_invoice_count,
            SUM(rf.selling_invoice_total_value) AS selling_invoice_total_value,
            SUM(rf.buying_invoice_count) AS buying_invoice_count,
            SUM(rf.buying_invoice_total_value) AS buying_invoice_total_value,
            SUM(rf.expense) AS expense,
            SUM(rf.non_expense) AS non_expense,
            SUM(rf.asset) AS asset
          FROM request_financials rf
          WHERE (
            rf.selling <> 0 OR rf.buying <> 0 OR rf.incoming_payment <> 0 OR 
            rf.outgoing_payment <> 0 OR rf.expense <> 0 OR rf.non_expense <> 0 OR rf.asset <> 0
          )
          GROUP BY rf.request_type, rf.fy
        )
        SELECT 
          (p.policy_id || '__' || COALESCE(ps.fy, 'N/A')) AS id,
          p.policy_id AS process_id,
          p.policy_name AS process,
          p.policy_type,
          p.description,
          p.policy_lead,
          COALESCE(mc.country, '') AS country,
          p.company_id,
          COALESCE(ps.fy, '') AS fy,
          COALESCE(ps.selling_contract_count, 0) AS selling_contract_count,
          COALESCE(ps.selling, 0) AS selling,
          COALESCE(ps.buying_contract_count, 0) AS buying_contract_count,
          COALESCE(ps.buying, 0) AS buying,
          COALESCE(ps.gm, 0) AS gm,
          COALESCE(ps.vat_selling, 0) AS vat_selling,
          COALESCE(ps.selling_wo_vat, 0) AS selling_wo_vat,
          COALESCE(ps.vat_buying, 0) AS vat_buying,
          COALESCE(ps.buying_wo_vat, 0) AS buying_wo_vat,
          COALESCE(ps.gm_wo_vat, 0) AS gm_wo_vat,
          COALESCE(ps.incoming_pm_count, 0) AS incoming_pm_count,
          COALESCE(ps.incoming_payment, 0) AS incoming_payment,
          COALESCE(ps.incoming_payment_paid, 0) AS incoming_payment_paid,
          COALESCE(ps.incoming_pm_not_due_yet, 0) AS incoming_pm_not_due_yet,
          COALESCE(ps.incoming_pm_pending_pm, 0) AS incoming_pm_pending_pm,
          COALESCE(ps.outgoing_pm_count, 0) AS outgoing_pm_count,
          COALESCE(ps.outgoing_payment, 0) AS outgoing_payment,
          COALESCE(ps.outgoing_payment_paid, 0) AS outgoing_payment_paid,
          COALESCE(ps.outgoing_pm_not_due_yet, 0) AS outgoing_pm_not_due_yet,
          COALESCE(ps.outgoing_pm_pending_pm, 0) AS outgoing_pm_pending_pm,
          COALESCE(ps.selling_invoice_count, 0) AS selling_invoice_count,
          COALESCE(ps.selling_invoice_total_value, 0) AS selling_invoice_total_value,
          COALESCE(ps.buying_invoice_count, 0) AS buying_invoice_count,
          COALESCE(ps.buying_invoice_total_value, 0) AS buying_invoice_total_value,
          COALESCE(ps.expense, 0) AS expense,
          COALESCE(ps.non_expense, 0) AS non_expense,
          COALESCE(ps.asset, 0) AS asset,
          COALESCE(ps.total_requests, 0) AS total_requests,
          p.deleted_at AS deleted_at
        FROM policy_and_program p
        LEFT JOIN my_company mc ON p.company_id = mc.my_company_id
        JOIN process_summary ps ON p.policy_id::text = ps.process_id::text OR p.policy_name = ps.process_id::text
        WHERE p.deleted_at IS NULL
      ) as "${tableName}"`;
    } else if (tableName === 'oppotunity') {
      baseTableOrCTE = `(
        SELECT op.*, sc.status_key AS status_key, sc.color_code AS status_color
        FROM "oppotunity" op
        LEFT JOIN status_catalog sc ON op.status = sc.id
      ) as "${tableName}"`;
    } else if (tableName === 'my_location') {
      baseTableOrCTE = `(
        SELECT l.*, sc.status_key AS status_key, sc.color_code AS status_color
        FROM "my_location" l
        LEFT JOIN status_catalog sc ON l.status = sc.id
      ) as "${tableName}"`;
    } else if (tableName === 'task_subtask') {
      baseTableOrCTE = `(
        SELECT ts.*, sc.status_key AS status_key, sc.color_code AS status_color
        FROM "task_subtask" ts
        LEFT JOIN status_catalog sc ON (ts.status::text ~ '^[0-9]+$' AND ts.status::text::int = sc.id) OR LOWER(ts.status::text) = LOWER(sc.status_key)
      ) as "${tableName}"`;
    } else if (tableName === 'ticket') {
      baseTableOrCTE = `(
        SELECT tk.*, sc_sr.status_key AS sr_status_key, sc_sr.color_code AS sr_status_color,
               sc_proc.status_key AS process_status_key, sc_proc.color_code AS process_status_color
        FROM "ticket" tk
        LEFT JOIN status_catalog sc_sr ON tk.sr_status = sc_sr.id
        LEFT JOIN status_catalog sc_proc ON tk.process_status = sc_proc.id
      ) as "${tableName}"`;
    } else if (tableName === 'cms_tenant_info') {
      baseTableOrCTE = `(
        SELECT ti.*, sc_bill.status_key AS billing_status_key, sc_bill.color_code AS billing_status_color,
               sc_sub.status_key AS subscription_status_key, sc_sub.color_code AS subscription_status_color
        FROM "cms_tenant_info" ti
        LEFT JOIN status_catalog sc_bill ON (ti.billing_status::text ~ '^[0-9]+$' AND ti.billing_status::text::int = sc_bill.id) OR LOWER(ti.billing_status::text) = LOWER(sc_bill.status_key)
        LEFT JOIN status_catalog sc_sub ON (ti.subscription_status::text ~ '^[0-9]+$' AND ti.subscription_status::text::int = sc_sub.id) OR LOWER(ti.subscription_status::text) = LOWER(sc_sub.status_key)
      ) as "${tableName}"`;
    }

    const countTarget = (tableName === 'finance' || tableName === 'v_finance') ? baseTableOrCTE : `"${tableName}"`;
    const countQuery = `SELECT COUNT(*) FROM ${countTarget} ${whereStr}`;
    if (DEBUG_SQL) {
      console.log('[dynamic_crud] TABLE:', tableName);
      console.log('[dynamic_crud] COUNT QUERY:', countQuery);
      console.log('[dynamic_crud] VALUES:', JSON.stringify(values));
    }
    const activePool = getPoolForTable(tableName);
    const resultCount = await activePool.query(countQuery, values);
    const totalRecords = parseInt(resultCount.rows[0].count, 10);
    let orderBy = dbCols.includes('created_date') ? 'created_date DESC NULLS LAST' : '1 DESC';

    if (tableName === 'payment') {
      orderBy = 'due_date DESC NULLS LAST, payment_id DESC';

    } else if (tableName === 'invoice') {
      orderBy = 'invoice_date DESC NULLS LAST';
    } else if (tableName === 'service') {
      orderBy = 'end_date DESC NULLS LAST';
    } else if (tableName === 'asset') {
      orderBy = 'purchase_date DESC NULLS LAST';
    } else if (tableName === 'mtr') {
      orderBy = 'transaction_date DESC NULLS LAST';
    } else if (tableName === 'account') {
      orderBy = 'latest_transaction_date DESC NULLS LAST';
    } else if (tableName === 'finance' || tableName === 'v_finance') {
      orderBy = 'fy DESC NULLS LAST, (COALESCE(selling, 0) + COALESCE(buying, 0) + COALESCE(expense, 0)) DESC, process ASC';
    }

    const { sort_by, sort_dir } = req.query;
    if (sort_by) {
      const customColsMap = {
        account: ['balance', 'balance_in_base_currency', 'latest_transaction_date'],
        asset: ['company_id', 'current_owner_name', 'value_in_base_currency'],
        service: ['company_id', 'requester', 'value', 'currency', 'value_in_base_currency'],
        mtr: ['company_id', 'currency', 'account_number', 'account_status', 'value_in_base_currency', 'payment_id'],
        payment: ['company_id', 'company', 'requester', 'value_in_base_currency'],
        contract: ['contract_label', 'company_shortname', 'total_value', 'value_before_vat_in_base_currency', 'vat_value_in_base_currency', 'total_value_in_base_currency', 'company_id'],
        expense: ['total_value', 'value_before_vat_in_base_currency', 'vat_value_in_base_currency', 'total_value_in_base_currency', 'company_id', 'requester'],
        invoice: ['company_shortname', 'company_id', 'total_value', 'value_before_vat_in_base_currency', 'vat_value_in_base_currency', 'total_value_in_base_currency'],
        request: ['company_id', 'policy_name', 'policy_approval_level', 'policy_elements', 'requester_name', 'sr_creater_name', 'policy_lead_name', 'sr_owner_name'],
        my_company: ['department', 'employee', 'account', 'policy', 'my_location', 'operation_program'],
        employee: ['company_shortname', 'department_name', 'display_label'],
        employee_active: ['company_shortname', 'department_name', 'display_label'],
        department: ['company_shortname', 'type', 'department_label'],
        finance: [
          'id', 'process', 'policy_type', 'country', 'fy', 'total_requests',
          'selling_contract_count', 'selling', 'vat_selling', 'selling_wo_vat',
          'buying_contract_count', 'buying', 'vat_buying', 'buying_wo_vat',
          'gm', 'gm_wo_vat',
          'incoming_pm_count', 'incoming_payment', 'incoming_payment_paid', 'incoming_pm_not_due_yet', 'incoming_pm_pending_pm',
          'outgoing_pm_count', 'outgoing_payment', 'outgoing_payment_paid', 'outgoing_pm_not_due_yet', 'outgoing_pm_pending_pm',
          'selling_invoice_count', 'selling_invoice_total_value',
          'buying_invoice_count', 'buying_invoice_total_value',
          'expense', 'non_expense', 'asset',
          'vat_selling_contract', 'payment_selling', 'paid_selling',
          'vat_buying_contract', 'payment_buying', 'paid_buying', 'expense_value'
        ]
      };
      const customCols = customColsMap[tableName] || [];
      const allowedSortColumns = [...dbCols, ...customCols];
      if (allowedSortColumns.includes(sort_by)) {
        const dir = (sort_dir && sort_dir.toUpperCase() === 'ASC') ? 'ASC' : 'DESC';
        if (tableName === 'payment') {
          orderBy = `"${sort_by}" ${dir} NULLS LAST, payment_id DESC`;
        } else {
          orderBy = `"${sort_by}" ${dir} NULLS LAST`;
        }
      }
    }
    const dataQuery = `SELECT * FROM ${baseTableOrCTE} ${whereStr} ORDER BY ${orderBy} LIMIT $${valIdx} OFFSET $${valIdx + 1}`;
    const resultQueryValues = [...values, limit, offset];
    const resultData = await activePool.query(dataQuery, resultQueryValues);

    let summary = {};
    let faceted_summary = {};
    let statusCol = null;
    const isLookupOrBulk = parseInt(limit, 10) > 100 || reqSummary === 'false';
    let facetCacheKey = null;
    let facetCacheHit = false;

    if (parseInt(page, 10) === 1 && !isLookupOrBulk) {
      facetCacheKey = `${tableName}:${whereStr}:${JSON.stringify(values)}`;
      const cachedFacetData = getCachedFaceted(facetCacheKey);
      if (cachedFacetData) {
        summary = cachedFacetData.summary || {};
        faceted_summary = cachedFacetData.faceted_summary || {};
        facetCacheHit = true;
      }
    }

    if (parseInt(page, 10) === 1 && !isLookupOrBulk && !facetCacheHit) {
      if (tableName === 'employee') {
        statusCol = 'status';
      } else if (tableName === 'payment') {
        statusCol = 'payment_status';

      } else if (tableName === 'invoice') {
        statusCol = 'invoice_status';
      } else if (tableName === 'request') {
        statusCol = 'sr_status';
      } else if (tableName === 'service') {
        statusCol = 'status';
      } else if (tableName === 'asset') {
        statusCol = 'status';
      } else if (tableName === 'mtr') {
        statusCol = 'transaction_type';
      } else if (tableName === 'account') {
        statusCol = 'account_status';
      } else if (tableName === 'company') {
        statusCol = 'type';
      }

      if (statusCol) {
        const targetFrom = dbCols.includes(statusCol) ? `"${tableName}"` : baseTableOrCTE;
        const summaryQuery = `
          SELECT COALESCE("${statusCol}"::text, 'Unknown') as name, COUNT(*)::int as count 
          FROM ${targetFrom} 
          ${whereStr} 
          GROUP BY "${statusCol}"
        `;
        const resultSummary = await pool.query(summaryQuery, values);
        resultSummary.rows.forEach(r => {
          const key = getStatusKey(tableName, statusCol, r.name) || r.name;
          summary[key] = r.count;
        });
      }

      const getFacetedCounts = async (col) => {
        try {
          const targetFrom = (tableName === 'finance' || tableName === 'v_finance') ? baseTableOrCTE : (dbCols.includes(col) ? `"${tableName}"` : baseTableOrCTE);
          const q = `SELECT COALESCE("${col}"::text, 'Unknown') as name, COUNT(*)::int as count FROM ${targetFrom} ${whereStr} GROUP BY "${col}"`;
          const res = await pool.query(q, values);
          return res.rows.reduce((acc, r) => {
            const key = getStatusKey(tableName, col, r.name) || r.name;
            acc[key] = r.count;
            return acc;
          }, {});
        } catch (e) { return {}; }
      };

      if (tableName === 'employee' || tableName === 'employee_active') {
        const [company_shortname, department_name, status] = await Promise.all([
          getFacetedCounts('company_shortname'),
          getFacetedCounts('department_name'),
          getFacetedCounts('status')
        ]);
        faceted_summary.company_shortname = company_shortname;
        faceted_summary.department_name = department_name;
        faceted_summary.status = status;
      } else if (tableName === 'company') {
        const [type, country] = await Promise.all([
          getFacetedCounts('type'),
          getFacetedCounts('country')
        ]);
        faceted_summary.type = type;
        faceted_summary.country = country;
      } else if (tableName === 'payment') {
        const getPaymentFyCounts = async () => {
          try {
            const qFy = `
                SELECT EXTRACT(YEAR FROM "due_date")::text as name, COUNT(*)::int as count 
                FROM "payment" 
                ${whereStr} 
                GROUP BY name
              `;
            const res = await pool.query(qFy, values);
            return res.rows.reduce((acc, row) => { if (row.name) acc[row.name] = row.count; return acc; }, {});
          } catch (e) { console.log('Payment FY Facet Error:', e.message); return {}; }
        };
        const getOverdueCounts = async () => {
          try {
            const q = `
                SELECT 
                  COALESCE(SUM(CASE WHEN "payment_status" <> 32 AND "due_date" < CURRENT_DATE AND CURRENT_DATE - "due_date" <= 30 THEN 1 ELSE 0 END), 0)::int as "0 - 30 days",
                  COALESCE(SUM(CASE WHEN "payment_status" <> 32 AND "due_date" < CURRENT_DATE AND CURRENT_DATE - "due_date" > 30 AND CURRENT_DATE - "due_date" <= 60 THEN 1 ELSE 0 END), 0)::int as "30 - 60 days",
                  COALESCE(SUM(CASE WHEN "payment_status" <> 32 AND "due_date" < CURRENT_DATE AND CURRENT_DATE - "due_date" > 60 AND CURRENT_DATE - "due_date" <= 90 THEN 1 ELSE 0 END), 0)::int as "60 - 90 days",
                  COALESCE(SUM(CASE WHEN "payment_status" <> 32 AND "due_date" < CURRENT_DATE AND CURRENT_DATE - "due_date" > 90 THEN 1 ELSE 0 END), 0)::int as "Over 90 days"
                FROM "payment"
                ${whereStr}
              `;
            const res = await pool.query(q, values);
            return res.rows[0] || {};
          } catch (e) { console.log('Payment Overdue Facet Error:', e.message); return {}; }
        };

        const [company_id, payment_type, payment_status, payment_method, fy, overdue] = await Promise.all([
          getFacetedCounts('company_id'),
          getFacetedCounts('payment_type'),
          getFacetedCounts('payment_status'),
          getFacetedCounts('payment_method'),
          getPaymentFyCounts(),
          getOverdueCounts()
        ]);
        faceted_summary.company_id = company_id;
        faceted_summary.payment_type = payment_type;
        faceted_summary.payment_status = payment_status;
        faceted_summary.payment_method = payment_method;
        faceted_summary.fy = fy;
        faceted_summary.overdue = overdue;

      } else if (tableName === 'invoice') {
        const getInvoiceFinancials = async () => {
          try {
            const q = `
              SELECT 
                COALESCE(SUM(COALESCE("total_value_in_base_currency"::numeric, COALESCE("value_before_vat_in_base_currency"::numeric, 0) + COALESCE("vat_value_in_base_currency"::numeric, 0), COALESCE("value_before_vat"::numeric, 0) + COALESCE("vat_value"::numeric, 0))), 0) as total_base_val
              FROM "invoice"
              ${whereStr}
            `;
            const res = await pool.query(q, values);
            return parseFloat(res.rows[0]?.total_base_val) || 0;
          } catch (e) { console.log('Invoice Financials Facet Error:', e.message); return 0; }
        };
        const [invoice_status, invoice_type, currency, total_base_val] = await Promise.all([
          getFacetedCounts('invoice_status'),
          getFacetedCounts('invoice_type'),
          getFacetedCounts('currency'),
          getInvoiceFinancials()
        ]);
        faceted_summary.invoice_status = invoice_status;
        faceted_summary.invoice_type = invoice_type;
        faceted_summary.currency = currency;
        faceted_summary.total_base_val = total_base_val;
      } else if (tableName === 'request') {
        const getRequestPolicyCounts = async () => {
          try {
            const qPolicy = `
                   SELECT p.policy_name as name, COUNT("${tableName}".*)::int as count 
                   FROM "${tableName}"
                   JOIN "policy_and_program" p ON "${tableName}".request_type = p.policy_id
                   ${whereStr}
                   GROUP BY p.policy_name
               `;
            const res = await pool.query(qPolicy, values);
            return res.rows.reduce((acc, row) => { acc[row.name] = row.count; return acc; }, {});
          } catch (e) {
            console.error('qPolicy Error:', e);
            return {};
          }
        };

        const [policy_name, sr_status] = await Promise.all([
          getRequestPolicyCounts(),
          getFacetedCounts('sr_status')
        ]);
        faceted_summary.policy_name = policy_name;
        faceted_summary.sr_status = sr_status;
      } else if (tableName === 'service') {
        const getServiceFyCounts = async () => {
          try {
            const qFy = `
                   SELECT "fy" as name, COUNT(*)::int as count 
                   FROM "${tableName}" 
                   ${whereStr} 
                   GROUP BY name
               `;
            const res = await pool.query(qFy, values);
            return res.rows.reduce((acc, row) => { if (row.name) acc[row.name] = row.count; return acc; }, {});
          } catch (e) { return {}; }
        };

        const [status, service_type, fy, company_id] = await Promise.all([
          getFacetedCounts('status'),
          getFacetedCounts('service_type'),
          getServiceFyCounts(),
          getFacetedCounts('company_id')
        ]);
        faceted_summary.status = status;
        faceted_summary.service_type = service_type;
        faceted_summary.fy = fy;
        faceted_summary.company_id = company_id;
      } else if (tableName === 'asset') {
        const [status, type, location, company_id] = await Promise.all([
          getFacetedCounts('status'),
          getFacetedCounts('type'),
          getFacetedCounts('location'),
          getFacetedCounts('company_id')
        ]);
        faceted_summary.status = status;
        faceted_summary.type = type;
        faceted_summary.location = location;
        faceted_summary.company_id = company_id;
      } else if (tableName === 'mtr') {
        const [status, transaction_type, company_id, account_status, currency] = await Promise.all([
          getFacetedCounts('status'),
          getFacetedCounts('transaction_type'),
          getFacetedCounts('company_id'),
          getFacetedCounts('account_status'),
          getFacetedCounts('currency')
        ]);
        faceted_summary.status = status;
        faceted_summary.transaction_type = transaction_type;
        faceted_summary.company_id = company_id;
        faceted_summary.account_status = account_status;
        faceted_summary.currency = currency;
      } else if (tableName === 'account') {
        const getAccountCurrencyBalances = async () => {
          try {
            const q = `
              SELECT COALESCE(TRIM(UPPER("currency")), 'VND') as curr,
                     COALESCE(SUM("balance"::numeric), 0) as total_balance,
                     COALESCE(SUM(COALESCE("balance_in_base_currency"::numeric, "balance"::numeric * COALESCE("exchange_rate"::numeric, 1.0))), 0) as total_base_balance
              FROM ${baseTableOrCTE}
              ${whereStr}
              GROUP BY curr
            `;
            const res = await pool.query(q, values);
            let totalBase = 0;
            const balances = res.rows.reduce((acc, row) => {
              if (row.curr) acc[row.curr] = parseFloat(row.total_balance) || 0;
              totalBase += parseFloat(row.total_base_balance) || 0;
              return acc;
            }, {});
            return { balances, totalBase };
          } catch (e) { console.log('Account Currency Balances Facet Error:', e.message); return { balances: {}, totalBase: 0 }; }
        };
        const [account_status, type, company_id, currency, accountBalances] = await Promise.all([
          getFacetedCounts('account_status'),
          getFacetedCounts('type'),
          getFacetedCounts('company_entity'),
          getFacetedCounts('currency'),
          getAccountCurrencyBalances()
        ]);
        faceted_summary.account_status = account_status;
        faceted_summary.type = type;
        faceted_summary.company_id = company_id;
        faceted_summary.currency = currency;
        faceted_summary.currency_balances = accountBalances.balances;
        faceted_summary.total_base_balance = accountBalances.totalBase;
      } else if (tableName === 'contract') {
        const getContractFyCounts = async () => {
          try {
            const qFy = `
              SELECT EXTRACT(YEAR FROM "contract_signed_date")::text as name, COUNT(*)::int as count 
              FROM "contract" 
              ${whereStr} 
              GROUP BY name
            `;
            const res = await pool.query(qFy, values);
            return res.rows.reduce((acc, row) => { if (row.name) acc[row.name] = row.count; return acc; }, {});
          } catch (e) { console.log('Contract FY Facet Error:', e.message); return {}; }
        };
        const getContractTypeFinancials = async () => {
          try {
            const q = `
              SELECT COALESCE("type"::text, 'Unknown') as type_key,
                     COALESCE(TRIM(UPPER("currency")), 'VND') as curr,
                     COALESCE(SUM(COALESCE("total_value_in_base_currency"::numeric, COALESCE("value_before_vat_in_base_currency"::numeric, 0) + COALESCE("vat_value_in_base_currency"::numeric, 0), COALESCE("value_before_vat"::numeric, 0) + COALESCE("vat_value"::numeric, 0))), 0) as total_base_val,
                     COALESCE(SUM(COALESCE("value_before_vat"::numeric, 0) + COALESCE("vat_value"::numeric, 0)), 0) as total_val,
                     COUNT(*)::int as count
              FROM "contract"
              ${whereStr}
              GROUP BY "type", curr
            `;
            const res = await pool.query(q, values);
            const result = {};
            res.rows.forEach(r => {
              const numType = Number(r.type_key);
              const label = numType === 69 ? 'Selling' : (numType === 70 ? 'Buying' : (numType === 71 ? 'Internal' : r.type_key));
              if (!result[label]) result[label] = { total: 0, total_base_val: 0, currencies: {}, count: 0 };
              result[label].total += parseFloat(r.total_val) || 0;
              result[label].total_base_val += parseFloat(r.total_base_val) || 0;
              result[label].count += parseInt(r.count, 10) || 0;
              result[label].currencies[r.curr] = (result[label].currencies[r.curr] || 0) + (parseFloat(r.total_val) || 0);
            });
            return result;
          } catch (e) { console.log('Contract Type Financials Error:', e.message); return {}; }
        };
        const [type, my_company, contract_owner, fy, type_financials] = await Promise.all([
          getFacetedCounts('type'),
          getFacetedCounts('my_company'),
          getFacetedCounts('contract_owner'),
          getContractFyCounts(),
          getContractTypeFinancials()
        ]);
        faceted_summary.type = type;
        faceted_summary.my_company = my_company;
        faceted_summary.contract_owner = contract_owner;
        faceted_summary.fy = fy;
        faceted_summary.type_financials = type_financials;
      } else if (tableName === 'finance' || tableName === 'v_finance') {
        const getFinanceCountryCounts = async () => {
          try {
            const q = `
              SELECT COALESCE(NULLIF(TRIM("country"), ''), 'Unassigned') as name, COUNT(*)::int as count
              FROM ${baseTableOrCTE}
              ${whereStr}
              GROUP BY name
              ORDER BY count DESC
            `;
            const res = await pool.query(q, values);
            return res.rows.reduce((acc, row) => { if (row.name) acc[row.name] = row.count; return acc; }, {});
          } catch (e) { console.log('Finance Country Facet Error:', e.message); return {}; }
        };
        const getFinanceFyCounts = async () => {
          try {
            const q = `
              SELECT fy as name, COUNT(DISTINCT process_id)::int as count
              FROM ${baseTableOrCTE}
              WHERE fy IS NOT NULL AND fy <> ''
              GROUP BY fy
              ORDER BY fy DESC
            `;
            const res = await pool.query(q, values);
            return res.rows.reduce((acc, row) => { if (row.name) acc[row.name] = row.count; return acc; }, {});
          } catch (e) { console.log('Finance FY Facet Error:', e.message); return {}; }
        };
        const getFinanceFinancials = async () => {
          try {
            const q = `
              SELECT 
                COALESCE(SUM(selling), 0) as total_selling,
                COALESCE(SUM(COALESCE(buying, 0) + COALESCE(expense, 0) + COALESCE(asset, 0)), 0) as total_cost,
                COALESCE(SUM(COALESCE(incoming_payment_paid, 0)), 0) as total_paid_selling,
                COALESCE(SUM(COALESCE(outgoing_payment_paid, 0)), 0) as total_paid_buying
              FROM ${baseTableOrCTE}
              ${whereStr}
            `;
            const res = await pool.query(q, values);
            return res.rows[0] || {};
          } catch (e) { console.log('Finance Financials Error:', e.message); return {}; }
        };
        const [policy_type, country, fy, finance_financials] = await Promise.all([
          getFacetedCounts('policy_type'),
          getFinanceCountryCounts(),
          getFinanceFyCounts(),
          getFinanceFinancials()
        ]);
        faceted_summary.policy_type = policy_type;
        faceted_summary.country = country;
        faceted_summary.fy = fy;
        faceted_summary.finance_financials = finance_financials;
      } else if (tableName === 'expense') {
        const getExpenseFyCounts = async () => {
          try {
            const qFy = `
              SELECT COALESCE(NULLIF(TRIM("fy"), ''), EXTRACT(YEAR FROM "created_at")::text, 'N/A') as name,
                     COUNT(*)::int as count
              FROM "expense"
              ${whereStr}
              GROUP BY name
              ORDER BY name DESC
            `;
            const res = await pool.query(qFy, values);
            return res.rows.reduce((acc, row) => { if (row.name) acc[row.name] = row.count; return acc; }, {});
          } catch (e) { console.log('Expense FY Facet Error:', e.message); return {}; }
        };
        const getExpenseCostFinancials = async () => {
          try {
            const q = `
              SELECT COALESCE(NULLIF(TRIM("id__expense_cost"::text), ''), 'Unassigned') as cost_key,
                     COALESCE(TRIM(UPPER("id__currency")), 'VND') as curr,
                     COALESCE(SUM(COALESCE("value_before_vat"::numeric, 0)), 0) as total_val_ex_vat,
                     COALESCE(SUM(COALESCE("total_value_in_base_currency"::numeric, "value_before_vat_in_base_currency"::numeric, COALESCE("value_before_vat"::numeric, 0) * COALESCE("exchange_rate"::numeric, 1.0))), 0) as total_base_val,
                     COUNT(*)::int as count
              FROM "expense"
              ${whereStr}
              GROUP BY cost_key, curr
            `;
            const res = await pool.query(q, values);
            const result = {};
            res.rows.forEach(r => {
              const label = r.cost_key;
              if (!result[label]) result[label] = { total_ex_vat: 0, total_base_val: 0, currencies: {}, count: 0 };
              result[label].total_ex_vat += parseFloat(r.total_val_ex_vat) || 0;
              result[label].total_base_val += parseFloat(r.total_base_val) || 0;
              result[label].count += parseInt(r.count, 10) || 0;
              result[label].currencies[r.curr] = (result[label].currencies[r.curr] || 0) + (parseFloat(r.total_val_ex_vat) || 0);
            });
            return result;
          } catch (e) { console.log('Expense Cost Financials Error:', e.message); return {}; }
        };
        const [id__expense_cost, id__expense_type, id__my_company, fy, expense_cost_financials] = await Promise.all([
          getFacetedCounts('id__expense_cost'),
          getFacetedCounts('id__expense_type'),
          getFacetedCounts('id__my_company'),
          getExpenseFyCounts(),
          getExpenseCostFinancials()
        ]);
        faceted_summary.id__expense_cost = id__expense_cost;
        faceted_summary.id__expense_type = id__expense_type;
        faceted_summary.id__my_company = id__my_company;
        faceted_summary.fy = fy;
        faceted_summary.expense_cost_financials = expense_cost_financials;
      }

      if (facetCacheKey && !facetCacheHit) {
        setCachedFaceted(facetCacheKey, { summary, faceted_summary });
      }
    }

    if (tableName === 'request') {
      resultData.rows.forEach(r => RequestModel.enrichRequest(r));
    }

    let responseDataRows = resultData.rows;
    responseDataRows.forEach(r => enrichRecordWithStatusCatalog(tableName, r));
    if (tableName === 'ticket_comment') {
      responseDataRows = await maskTicketComments(responseDataRows);
    } else if (tableName === 'request_rating') {
      responseDataRows = responseDataRows.map(r => {
        const { from_user, ...rest } = r;
        return rest;
      });
    }

    res.json({
      data: responseDataRows,
      meta: {
        total: totalRecords,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil(totalRecords / limit),
        summary,
        faceted_summary
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/table/:tableName/:id/audit-logs
router.get('/:tableName/:id/audit-logs', async (req, res) => {
  const { tableName, id } = req.params;
  try {
    const rawId = String(id);
    const decodedId = String(hashidHelper.decode(id));
    const logs = await getRecordAuditLogs(tableName, rawId);
    if ((!logs || logs.length === 0) && decodedId && decodedId !== rawId) {
      const decodedLogs = await getRecordAuditLogs(tableName, decodedId);
      return res.json({ data: decodedLogs });
    }
    res.json({ data: logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/table/:tableName/:id
router.get('/:tableName/:id', async (req, res) => {
  let { tableName, id } = req.params;
  const rawId = String(id);
  const decodedId = String(hashidHelper.decode(id));
  if (tableName === 'comment') {
    try {
      const checkTbl = await getHelpdeskPool().query('SELECT 1 FROM ticket_comment WHERE comment_id = $1 OR comment_id = $2', [rawId, decodedId]);
      if (checkTbl.rows.length > 0) {
        tableName = 'ticket_comment';
      }
    } catch (e) { }
  }
  const { pk: queryPk } = req.query;
  const pk = queryPk || getPrimaryKey(tableName);
  const dbCols = await getTableColumns(tableName);
  if (queryPk && !dbCols.includes(queryPk)) {
    return res.status(400).json({ error: 'Invalid primary key column name' });
  }
  const hasIdCol = dbCols.includes('id');

  try {
    const user = getUserFromReq(req);
    const isSuperAdmin = user && user.role && user.role.toUpperCase() === 'SUPER ADMIN';
    let query;
    let record;
    if (tableName === 'finance' || tableName === 'v_finance') {
      const result = await pool.query(
        `SELECT * FROM public.v_finance WHERE id::text = $1 OR id::text = $2 OR process_id::text = $1 OR process_id::text = $2 LIMIT 1`,
        [rawId, decodedId]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Record not found' });
      record = result.rows[0];
    } else if (tableName === 'assigned_task') {
      query = `SELECT t.*, r.process_status AS request_status FROM "${tableName}" t LEFT JOIN "request" r ON t.request_id = r.request_id WHERE (t.${pk}::text = $1 OR t.${pk}::text = $2`;
      if (hasIdCol && pk !== 'id') {
        query += ` OR t.id::text = $1 OR t.id::text = $2`;
      }
      query += `)`;
      if (dbCols.includes('deleted_at') && !isSuperAdmin) {
        query += ` AND t.deleted_at IS NULL`;
      }
      const result = await getPoolForTable(tableName).query(query, [rawId, decodedId]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Record not found' });
      record = result.rows[0];
    } else if (tableName === 'account') {
      query = `
        WITH mtr_stats AS (
          SELECT 
            account,
            SUM(CASE WHEN transaction_type = 'Incoming payment' THEN amount WHEN transaction_type = 'Outgoing payment' THEN -amount ELSE 0 END) as balance,
            MAX(transaction_date) as latest_transaction_date
          FROM "mtr"
          GROUP BY account
        )
        SELECT a.*, sc.status_key AS account_status_key, sc.color_code AS account_status_color,
          COALESCE(ms.balance, 0) as balance,
          COALESCE(ms.balance, 0) * COALESCE(a.exchange_rate, 1) as balance_in_base_currency,
          ms.latest_transaction_date as latest_transaction_date
        FROM "account" a
        LEFT JOIN mtr_stats ms ON a.account_id = ms.account
        LEFT JOIN status_catalog sc ON a.account_status = sc.id
        WHERE (a.${pk}::text = $1 OR a.${pk}::text = $2`;
      if (hasIdCol && pk !== 'id') {
        query += ` OR a.id::text = $1 OR a.id::text = $2`;
      }
      query += `)`;
      if (dbCols.includes('deleted_at') && !isSuperAdmin) {
        query += ` AND a.deleted_at IS NULL`;
      }
      const result = await getPoolForTable(tableName).query(query, [rawId, decodedId]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Record not found' });
      record = result.rows[0];
    } else {
      query = `SELECT * FROM "${tableName}" WHERE (${pk}::text = $1 OR ${pk}::text = $2`;
      if (hasIdCol && pk !== 'id') {
        query += ` OR id::text = $1 OR id::text = $2`;
      }
      if (tableName === 'action_rules') {
        query += ` OR action_id = $1 OR action_id = $2`;
      }
      query += `)`;
      if (dbCols.includes('deleted_at') && !isSuperAdmin) {
        query += ` AND deleted_at IS NULL`;
      }
      const result = await getPoolForTable(tableName).query(query, [rawId, decodedId]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Record not found' });
      record = result.rows[0];
    }

    // === SUBDOMAIN ISOLATION FOR MULTI-TENANCY ===
    const requestHost = (req.headers.host || '').split(':')[0].toLowerCase();
    const isHelpdeskHost = requestHost === 'support.terax.ai';
    if (!isHelpdeskHost && requestHost && requestHost !== 'localhost' && requestHost !== '127.0.0.1') {
      let recordSubdomain = null;
      if (tableName === 'cms_tenant_info') {
        recordSubdomain = record.tenant_domain;
      } else if (tableName === 'ticket') {
        recordSubdomain = record.subdomain;
      } else {
        const ticketId = record.ticket || record.request;
        if (ticketId) {
          const tRes = await getHelpdeskPool().query('SELECT subdomain FROM "ticket" WHERE ticket_id = $1', [ticketId]);
          if (tRes.rows.length > 0) {
            recordSubdomain = tRes.rows[0].subdomain;
          }
        }
      }
      if (recordSubdomain && recordSubdomain.toLowerCase() !== requestHost) {
        return res.status(403).json({ error: 'Access denied: record does not belong to this tenant.' });
      }
    }

    // === ROW-LEVEL SECURITY for request and child records ===
    const tablesWithRequestCol = ['mtr', 'payment', 'comment', 'service', 'contract', 'asset', 'invoice'];
    if (tableName === 'account') {
      const userForCheck = getUserFromReq(req);
      const userEmployeeId = (userForCheck.employee_id || '').toLowerCase();
      if (!userEmployeeId) {
        return res.status(403).json({ error: 'Access denied: You do not have permission to view this account.' });
      }
      const fc = (record.finance_control || '').toLowerCase().split(',').map(s => s.trim());
      const tmb = (record.transaction_managed_by || '').toLowerCase().split(',').map(s => s.trim());
      if (!fc.includes(userEmployeeId) && !tmb.includes(userEmployeeId)) {
        return res.status(403).json({ error: 'Access denied: You do not have permission to view this account.' });
      }
    } else if (tableName === 'request' || tablesWithRequestCol.includes(tableName)) {
      const userForCheck = getUserFromReq(req);
      const roleName = String(userForCheck.role || '').toUpperCase();
      const isSuperAdmin = roleName === 'SUPER ADMIN';
      const isAdmin = roleName === 'HR' || roleName === 'ADMINISTRATOR' || roleName === 'ADMIN';
      if (userForCheck.employee_id) {
        const userEmployeeId = userForCheck.employee_id.toLowerCase();
        let targetRequest = null;

        if (tableName === 'request') {
          targetRequest = record;
        } else if (record.request) {
          const reqRes = await pool.query('SELECT * FROM "request" WHERE request_id = $1', [record.request]);
          if (reqRes.rows.length > 0) {
            targetRequest = reqRes.rows[0];
          }
        }

        if (targetRequest) {
          const hasAccess = await isUserNamedOnRequest(targetRequest, userForCheck);
          if (!hasAccess) {
            return res.status(403).json({ error: 'You do not have permission to view this content.' });
          }
        } else if (tablesWithRequestCol.includes(tableName) && record.request) {
          // If request does not exist in the DB (legacy record), bypass restriction to allow access
        }
      }
    } else if (tableName === 'assigned_task' || tableName === 'task_subtask') {
      const userForCheck = getUserFromReq(req);
          if (userForCheck.employee_id) {
            const userEmpId = userForCheck.employee_id.toLowerCase();
            let isAssignee = false;
            let isRequestParty = false;
                        if (tableName === 'assigned_task') {
              isAssignee = (record.employee_id || '').toLowerCase() === userEmpId;
              if (record.request_id) {
                const reqRes = await pool.query('SELECT * FROM "request" WHERE request_id = $1', [record.request_id]);
                if (reqRes.rows.length > 0) {
                  isRequestParty = await isUserNamedOnRequest(reqRes.rows[0], userForCheck);
                }
              }
             } else if (tableName === 'task_subtask') {
              const taskRes = await pool.query('SELECT * FROM "assigned_task" WHERE task_id = $1', [record.task_id]);
              if (taskRes.rows.length > 0) {
                const taskRec = taskRes.rows[0];
                isAssignee = (taskRec.employee_id || '').toLowerCase() === userEmpId;
                if (taskRec.request_id) {
                  const reqRes = await pool.query('SELECT * FROM "request" WHERE request_id = $1', [taskRec.request_id]);
                  if (reqRes.rows.length > 0) {
                    isRequestParty = await isUserNamedOnRequest(reqRes.rows[0], userForCheck);
                  }
                }
              }
            }

            if (!isAssignee && !isRequestParty) {
              return res.status(403).json({ error: 'Access denied: You do not have permission to view this task/subtask.' });
            }
          }
        }
    // =============================================

    if (tableName === 'request') {
      RequestModel.enrichRequest(record);
      try {
        const pRes = await pool.query('SELECT elements, approval_level FROM policy_and_program WHERE policy_id::text = $1', [record.request_type]);
        if (pRes.rows.length > 0) {
          record.policy_elements = pRes.rows[0].elements;
          record.policy_approval_level = pRes.rows[0].approval_level;
          if (!record.approval_level) {
            record.approval_level = pRes.rows[0].approval_level;
          }
        }
      } catch (errPolicy) {
        console.error('Error fetching policy elements:', errPolicy);
      }

      // Query parent request ID if this is a sub-request (referenced as payment_request or invoice_request)
      try {
        let parentReqId = record.parent__id_request;
        if (!parentReqId) {
          const parentRes = await pool.query(
            `SELECT COALESCE(p.request, c.request) AS parent_req
             FROM payment p
             LEFT JOIN contract c ON p.contract_id = c.contract_id
             WHERE p.payment_request = $1
             UNION
             SELECT COALESCE(i.request, c.request) AS parent_req
             FROM invoice i
             LEFT JOIN contract c ON i.contract_id = c.contract_id
             WHERE i.invoice_request = $1`,
            [record.request_id]
          );
          const validRow = parentRes.rows.find(row => !!row.parent_req);
          if (validRow) {
            parentReqId = validRow.parent_req;
          }
        }
        if (parentReqId) {
          record.parent_request_id = parentReqId;
          record.parent__id_request = parentReqId;
        }
      } catch (errParent) {
        console.error('Error fetching parent request:', errParent);
      }
    }
    try {
      const recordPk = (record && record[pk]) ? record[pk] : id;
      // Skip heavy audit log querying for request modules on single record GET
      // The frontend logs tab fetches audit logs independently via /:tableName/:id/audit-logs
      if (tableName !== 'request' && tableName !== 'v_request' && !tableName.startsWith('my_')) {
        record.log = await getRecordAuditLogs(tableName, recordPk, record ? record.log : null);
      }
    } catch (logErr) {
      console.error(`Error enriching record with audit logs:`, logErr.message);
    }
    if (tableName === 'ticket_comment') {
      const masked = await maskTicketComments([record]);
      record = masked[0];
    } else if (tableName === 'request_rating') {
      const { from_user, ...rest } = record;
      record = rest;
    }
    enrichRecordWithStatusCatalog(tableName, record);
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/table/:tableName
router.post('/:tableName', async (req, res) => {
  let { tableName } = req.params;
  if (tableName === 'comment' && req.body.ticket) {
    tableName = 'ticket_comment';
  }
  if (tableName === 'cms_tenant_info') {
    return res.status(403).json({ error: 'Access denied: cms_tenant_info is read-only from the CRC app.' });
  }
  const user = getUserFromReq(req);
  const viewName = req.query.view || tableName;
  const isAllowed = await checkPermission('action_rules', `add_${tableName}`, user, viewName);
  if (!isAllowed) {
    return res.status(403).json({ error: 'Access denied: You do not have permission to add records.' });
  }

  const data = { ...req.body };
  processBase64Fields(data, tableName);

  // Validate incoming data using Zod schema (if defined for the table)
  const validationErrors = validateTableData(tableName, data, false);
  if (validationErrors) {
    const errorDetails = Object.entries(validationErrors).map(([field, msg]) => `${field}: ${msg}`).join(', ');
    console.warn(`[validation] tableName=${tableName} validationErrors:`, validationErrors, `data:`, data);
    return res.status(400).json({ error: `Dữ liệu không hợp lệ: ${errorDetails}`, details: validationErrors });
  }
  const pk = getPrimaryKey(tableName);
  let dbCols = await getTableColumns(tableName);
  const bodyKeys = Object.keys(data);
  if (bodyKeys.some(k => !dbCols.includes(k))) {
    dbCols = await getTableColumns(tableName, true);
  }
  const userEmployeeId = req.user && req.user.employee_id ? req.user.employee_id : 'system';

  const activePool = getPoolForTable(tableName);
  const client = await activePool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.current_user', $1, true)", [userEmployeeId]);

    if (tableName === 'target_table') {
      if (data.record_ids !== undefined && data.record_ids !== null) {
        if (Array.isArray(data.record_ids)) {
          data.record_ids = data.record_ids.map(s => s.trim().replace(/^\[|\]$/g, '')).filter(Boolean);
        } else if (typeof data.record_ids === 'string') {
          data.record_ids = data.record_ids.split(',').map(s => s.trim().replace(/^\[|\]$/g, '')).filter(Boolean);
        }
      }
    }

    if (tableName === 'request') {
      if (!data.requester) data.requester = userEmployeeId;
      if (!data.sr_creater) data.sr_creater = userEmployeeId;
      data.sr_created_date = new Date();

      // Validate request type restrictions
      await validateRequestTypeRestrictions(data.requester, data.request_type, client);

      if ((!data.elements || data.elements.length === 0) && data.request_type) {
        try {
          const pRes = await client.query('SELECT elements FROM policy_and_program WHERE policy_id::text = $1', [data.request_type]);
          if (pRes.rows.length > 0 && pRes.rows[0].elements) {
            data.elements = pRes.rows[0].elements;
          }
        } catch (errPolicy) {
          console.error('Error fetching policy elements in POST request creation:', errPolicy);
        }
      }

      // Default statuses using status catalog IDs
      if (Number(data.sr_status) === 2 || String(data.sr_status || '').toLowerCase().includes('submit')) data.sr_status = 2; // 2=Pending Approval
      if (!data.sr_status) data.sr_status = 1; // 1=Draft

      const isSubmittedStatus = Number(data.sr_status) === 2;
      if (isSubmittedStatus) {
        data.sr_submitted_date = new Date();
      }
      if (!data.process_status) data.process_status = 7; // 7=Not started yet

      // Setup audit log column
      const tzTimeStr = new Date().toISOString();
      const logEntries = [{ timestamp: tzTimeStr, user: userEmployeeId, action: 'created request' }];
      if (isSubmittedStatus) {
        logEntries.push({ timestamp: tzTimeStr, user: userEmployeeId, action: 'submitted request' });
      }
      data.log = JSON.stringify(logEntries);

      // Resolve Tier 1 Approval based on Policy/Manager logic
      await RequestModel.resolveApprovals(data, client);

      // Normalize elements and sr_owner to array if present
      if (data.elements !== undefined && data.elements !== null) {
        if (Array.isArray(data.elements)) {
          data.elements = data.elements.map(s => s.trim().replace(/^\[|\]$/g, '').toUpperCase()).filter(Boolean);
        } else if (typeof data.elements === 'string') {
          data.elements = data.elements.split(',').map(s => s.trim().replace(/^\[|\]$/g, '').toUpperCase()).filter(Boolean);
        }
      }
      if (data.sr_owner !== undefined && data.sr_owner !== null) {
        if (Array.isArray(data.sr_owner)) {
          data.sr_owner = data.sr_owner.map(s => s.trim().replace(/^\[|\]$/g, '').toLowerCase()).filter(Boolean);
        } else if (typeof data.sr_owner === 'string') {
          data.sr_owner = data.sr_owner.split(',').map(s => s.trim().replace(/^\[|\]$/g, '').toLowerCase()).filter(Boolean);
        }
      }

      // LOCK request table to prevent duplicate IDs during concurrent inserts
      await client.query('LOCK TABLE request IN SHARE ROW EXCLUSIVE MODE');

      // Generate request_id in format: [Process] - [ddmmyy] - [Initials] - [Seq] (UTC date)
      const nowUtc = new Date();
      const dd = String(nowUtc.getUTCDate()).padStart(2, '0');
      const mm = String(nowUtc.getUTCMonth() + 1).padStart(2, '0');
      const yy = String(nowUtc.getUTCFullYear()).slice(-2);
      const dateStr = `${dd}${mm}${yy}`;

      const requesterEmail = data.requester || userEmployeeId;
      const prefixEmail = requesterEmail.split('@')[0];
      const initials = prefixEmail.slice(0, 2).toUpperCase() || 'XX';

      const processCode = data.request_type || 'REQ';
      const prefix = `${processCode}-${dateStr}-${initials}-`;

      const seqResult = await client.query(
        `SELECT request_id FROM request WHERE request_id LIKE $1`,
        [`${prefix}%`]
      );
      let maxSeq = 0;
      seqResult.rows.forEach(row => {
        const parts = row.request_id.split('-');
        const seqPart = parts[parts.length - 1];
        const seqNum = parseInt(seqPart, 10);
        if (!isNaN(seqNum) && seqNum > maxSeq) {
          maxSeq = seqNum;
        }
      });
      data[pk] = `${prefix}${maxSeq + 1}`;
    } else {
      if (!data[pk]) {
        if (tableName === 'payment') {
          await client.query('LOCK TABLE payment IN SHARE ROW EXCLUSIVE MODE');
          const nowPayUtc = new Date();
          const dd = String(nowPayUtc.getUTCDate()).padStart(2, '0');
          const mm = String(nowPayUtc.getUTCMonth() + 1).padStart(2, '0');
          const yy = String(nowPayUtc.getUTCFullYear()).slice(-2);
          const dateStr = `${dd}${mm}${yy}`;

          const requesterEmail = data.employee || userEmployeeId;
          const prefixEmail = requesterEmail.includes('@') ? requesterEmail.split('@')[0] : requesterEmail;
          const initials = prefixEmail.slice(0, 2).toUpperCase() || 'XX';
          const prefix = `PAY-${dateStr}-${initials}-`;

          const seqResult = await client.query(
            `SELECT payment_id FROM payment WHERE payment_id LIKE $1`,
            [`${prefix}%`]
          );
          let maxSeq = 0;
          seqResult.rows.forEach(row => {
            const parts = row.payment_id.split('-');
            const seqPart = parts[parts.length - 1];
            const seqNum = parseInt(seqPart, 10);
            if (!isNaN(seqNum) && seqNum > maxSeq) {
              maxSeq = seqNum;
            }
          });
          data[pk] = `${prefix}${maxSeq + 1}`;
        } else if (tableConfigs[tableName]) {
          data[pk] = await generateSequentialId(tableName, client);
        } else if (tableName === 'expense') {
          if (!data.id) {
            const nextRes = await client.query("SELECT nextval('expense_id_seq') as next_id");
            data.id = nextRes.rows[0].next_id;
          }
        } else {
          data[pk] = uuidv4();
        }
      }

      // ── Modular tableRegistry beforeInsert hook ────────────────────────
      const insertHandler = tableRegistry.resolveHandler(tableName);
      if (insertHandler && typeof insertHandler.beforeInsert === 'function') {
        try {
          await insertHandler.beforeInsert(req, data, client);
        } catch (handlerErr) {
          return res.status(400).json({ error: handlerErr.message });
        }
      }
      // ── Contract validations ──────────────────────────────────────────
      if (tableName === 'contract') {
        // Contract No (contractspood_no) is required when Signed Date is set
        const hasSignedDate = data.contract_signed_date && String(data.contract_signed_date).trim() !== '';
        const hasContractNo = data.contractspood_no && String(data.contractspood_no).trim() !== '';
        if (hasSignedDate && !hasContractNo) {
          return res.status(400).json({ error: 'Contract No (contractspood_no) is required when Signed Date is set.' });
        }
        // Contract type must not be Internal (71)
        if (Number(data.type) === 71) {
          return res.status(400).json({ error: 'Contract type "Internal" is no longer supported. Please select Selling or Buying.' });
        }
      }

      // ── Payment validations ───────────────────────────────────────────
      if (tableName === 'payment') {
        // payment_term is required
        if (!data.payment_term || String(data.payment_term).trim() === '') {
          return res.status(400).json({ error: 'Payment Condition (payment_term) is required.' });
        }
        // payment_period must be a positive integer
        if (data.payment_period !== undefined && data.payment_period !== null && data.payment_period !== '') {
          const ppVal = Number(data.payment_period);
          if (!Number.isInteger(ppVal) || ppVal < 1) {
            return res.status(400).json({ error: 'Payment Period must be a positive whole number.' });
          }
          data.payment_period = ppVal;
        }
        if (!data.payment_status) {
          data.payment_status = 30; // 30=Draft
        }
        if (data.contract_id) {
          const contractRes = await client.query('SELECT type, COALESCE(total_value_in_base_currency, (COALESCE(value_before_vat, 0) + COALESCE(vat_value, 0)) * COALESCE(exchance_rate, 1)) as contract_total FROM contract WHERE contract_id = $1 AND deleted_at IS NULL', [data.contract_id]);
          if (contractRes.rows.length > 0) {
            const contractTotal = parseFloat(contractRes.rows[0].contract_total) || 0;
            let newTotal = 0;
            if (data.value_in_base_currency !== undefined && data.value_in_base_currency !== null && data.value_in_base_currency !== '') {
              newTotal = parseFloat(String(data.value_in_base_currency).replace(/,/g, '')) || 0;
            } else {
              const val = parseFloat(String(data.value || 0).replace(/,/g, '')) || 0;
              const rate = parseFloat(String(data.exchange_rate || 1).replace(/,/g, '')) || 1;
              newTotal = Math.round(val * rate);
            }
            
            const existingRes = await client.query('SELECT SUM(COALESCE(value_in_base_currency, (COALESCE(value, 0) + COALESCE(vat, 0)) * COALESCE(exchange_rate, 1))) as existing_total FROM payment WHERE contract_id = $1 AND deleted_at IS NULL', [data.contract_id]);
            const existingTotal = parseFloat(existingRes.rows[0].existing_total) || 0;
            if (existingTotal + newTotal > contractTotal) {
              throw new Error(`Tổng giá trị các thanh toán (${(existingTotal + newTotal).toLocaleString()}) vượt quá tổng giá trị hợp đồng (${contractTotal.toLocaleString()})`);
            }
          }
        }
      }

      if (tableName === 'invoice') {
        if (!data.description || !String(data.description).trim()) {
          return res.status(400).json({ error: 'Description is required for invoice.' });
        }
        if (data.contract_id) {
          const contractRes = await client.query('SELECT COALESCE(total_value_in_base_currency, (COALESCE(value_before_vat, 0) + COALESCE(vat_value, 0)) * COALESCE(exchance_rate, 1)) as contract_total FROM contract WHERE contract_id = $1 AND deleted_at IS NULL', [data.contract_id]);
          if (contractRes.rows.length > 0) {
            const contractTotal = parseFloat(contractRes.rows[0].contract_total) || 0;
            let newTotal = 0;
            if (data.total_value_in_base_currency !== undefined && data.total_value_in_base_currency !== null && data.total_value_in_base_currency !== '') {
              newTotal = parseFloat(String(data.total_value_in_base_currency).replace(/,/g, '')) || 0;
            } else {
              const valBefore = parseFloat(String(data.value_before_vat || 0).replace(/,/g, '')) || 0;
              const valVat = parseFloat(String(data.vat_value || 0).replace(/,/g, '')) || 0;
              const rate = parseFloat(String(data.exchange_rate || 1).replace(/,/g, '')) || 1;
              newTotal = Math.round((valBefore + valVat) * rate);
            }
            
            const existingRes = await client.query('SELECT SUM(COALESCE(total_value_in_base_currency, (COALESCE(value_before_vat, 0) + COALESCE(vat_value, 0)) * COALESCE(exchange_rate, 1))) as existing_total FROM invoice WHERE contract_id = $1 AND deleted_at IS NULL', [data.contract_id]);
            const existingTotal = parseFloat(existingRes.rows[0].existing_total) || 0;
            if (existingTotal + newTotal > contractTotal) {
              throw new Error(`Tổng giá trị các hóa đơn (${(existingTotal + newTotal).toLocaleString()}) vượt quá tổng giá trị hợp đồng (${contractTotal.toLocaleString()})`);
            }
          }
        }
      }
      const requestChildren = ['payment', 'invoice', 'service', 'asset', 'contract', 'expense', 'target_table'];
      if (requestChildren.includes(tableName)) {
        const userRole = req.user && req.user.role ? req.user.role : '';
        const reqId = data.request || data.id__request || data.id_request;
        await validateRequestChildPermissions(tableName, reqId, userEmployeeId, userRole, client);
      }

      // Validate permissions for assigned_task insert
      if (tableName === 'assigned_task') {
        const userRole = req.user && req.user.role ? req.user.role : '';
        if (userRole.toUpperCase() !== 'SUPER ADMIN') {
          const reqId = data.request_id;
          if (!reqId) throw new Error('Yêu cầu ID Request để giao task.');
          const reqRes = await client.query(
            `SELECT sr_creater, requester, sr_owner, policy_lead, process_status FROM request WHERE request_id = $1`,
            [reqId]
          );
          if (reqRes.rows.length === 0) throw new Error('Không tìm thấy Request tương ứng.');
          const reqRow = reqRes.rows[0];
          const srOwnerArr = Array.isArray(reqRow.sr_owner)
            ? reqRow.sr_owner.map(s => s.toLowerCase())
            : (reqRow.sr_owner ? [reqRow.sr_owner.toLowerCase()] : []);
          const policyLead = (reqRow.policy_lead || '').toLowerCase();
          const callerEmpId = (userEmployeeId || '').toLowerCase();
          const creator = (reqRow.sr_creater || '').toLowerCase();
          const requester = (reqRow.requester || '').toLowerCase();

          const isAuthorized = srOwnerArr.includes(callerEmpId) || callerEmpId === policyLead || callerEmpId === creator || callerEmpId === requester;
          if (!isAuthorized) {
            throw new Error('Chỉ Người tạo (Requester), SR Owner hoặc Policy Lead mới được phép giao task cho Request này.');
          }
        }
      }
    }

    // Helper to find exact column name regardless of case/spacing
    const findCol = (name) => dbCols.find(c => c.toLowerCase().replace(/\s+/g, '_') === name);

    if (tableName === 'contract') {
      if (data.request && !data.id__request) data.id__request = data.request;
      if (data.id__request && !data.request) data.request = data.id__request;
    }

    const colCreatedBy = findCol('created_by');
    const colCreatedDate = findCol('created_date');
    const colUpdatedBy = findCol('updated_by');
    const colUpdatedDate = findCol('updated_date');
    const colLog = findCol('logs') || findCol('log');

    if (tableName === 'comment' || tableName === 'ticket_comment') {
      if (!data.comment_by) data.comment_by = userEmployeeId;
      if (!data.comment_date) data.comment_date = new Date().toISOString();
      if (tableName === 'ticket_comment') {
        data.logs = { origin: 'client' };
      }
    }

    // We let the database trigger handle created_date, updated_date, and logs.
    if (colCreatedBy && !data[colCreatedBy]) data[colCreatedBy] = userEmployeeId;
    if (colUpdatedBy && !data[colUpdatedBy]) data[colUpdatedBy] = userEmployeeId;

    if (tableName === 'ticket') {
      const requestHost = (req.headers.host || '').split(':')[0].toLowerCase();
      if (requestHost && requestHost !== 'localhost' && requestHost !== '127.0.0.1') {
        data.subdomain = requestHost;
      } else {
        data.subdomain = 'dev.terax.ai';
      }
      if (tableName === 'ticket') {
        if (!data.requester) data.requester = userEmployeeId;
        if (!data.sr_creater) data.sr_creater = userEmployeeId;
        await resolveTicketApprovals(data, client);
      }
    }

    autoCalculateBaseCurrencyFields(tableName, data);
    await cleanEmptyStringsForTable(tableName, data);
    convertStatusFieldsToIds(tableName, data);

    // Stringify JSON/JSONB columns if passed as objects/arrays to avoid PG binding errors
    const jsonColumns = ['approval_flow', 'processing_flow', 'log', 'finance_mappings', 'menu_icons'];
    Object.keys(data).forEach(k => {
      if (jsonColumns.includes(k) && typeof data[k] === 'object' && data[k] !== null) {
        data[k] = JSON.stringify(data[k]);
      }
    });

    const keys = Object.keys(data).filter(k => dbCols.includes(k));
    const values = keys.map(k => data[k]);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

    const result = await client.query(
      `INSERT INTO "${tableName}" ("${keys.join('", "')}") VALUES (${placeholders}) RETURNING *`,
      values
    );

    if (tableName === 'request') {
      const reqId = result.rows[0].request_id;
      const commentText = req.body.comment !== undefined ? req.body.comment : data.comment;
      let fileText = req.body.file !== undefined ? req.body.file : data.file;
      if (typeof fileText === 'object' && fileText !== null) {
        fileText = JSON.stringify(fileText);
      }
      if ((commentText && String(commentText).trim()) || (fileText && String(fileText).trim())) {
        const commId = uuidv4();
        await client.query(
          `INSERT INTO "comment" ("comment_id", "request", "comment", "file", "comment_by", "comment_date") 
           VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
          [commId, reqId, commentText || null, fileText || null, userEmployeeId]
        );
      }
    }

    let responseData = result.rows[0];

    if (tableName === 'request') {
      RequestModel.enrichRequest(responseData);
      try {
        const pRes = await client.query('SELECT elements, approval_level FROM policy_and_program WHERE policy_id::text = $1', [responseData.request_type]);
        if (pRes.rows.length > 0) {
          responseData.policy_elements = pRes.rows[0].elements;
          responseData.policy_approval_level = pRes.rows[0].approval_level;
          if (!responseData.approval_level) {
            responseData.approval_level = pRes.rows[0].approval_level;
          }
        }
      } catch (errPolicy) {
        console.error('Error fetching policy elements in POST:', errPolicy);
      }
    }

    if (tableName === 'ticket') {
      const commentText = req.body.comment;
      const fileText = req.body.file;
      if ((commentText && commentText.trim()) || (fileText && fileText.trim())) {
        const cmtId = uuidv4();
        await client.query(`
          INSERT INTO ticket_comment (comment_id, ticket, comment, file, comment_by, comment_date)
          VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        `, [cmtId, responseData.ticket_id, commentText || null, fileText || null, userEmployeeId]);
      }
    }

    if (tableName === 'policy_and_program') {
      const userEmail = req.user && req.user.employee_id ? req.user.employee_id : 'system';
      await syncUploadedFiles(client, 'policy_and_program', responseData.policy_id, 'procedure_file', data.procedure_file, userEmail);
    } else if (tableName === 'invoice') {
      const userEmail = req.user && req.user.employee_id ? req.user.employee_id : 'system';
      await syncUploadedFiles(client, 'invoice', responseData.invoice_id, 'attached_file', data.attached_file, userEmail);
    }

    let pendingBroadcasts = [];

    await client.query('COMMIT');

    if (['action_rules', 'exception_rules', 'column_permissions'].includes(tableName)) {
      clearPermissionCache();
    }

    for (const b of pendingBroadcasts) {
      broadcastSSE('db_change', b);
    }
    broadcastSSE('db_change', { action: 'insert', table: tableName, record: responseData });
    triggerNotifications(tableName, null, responseData);
    enrichRecordWithStatusCatalog(tableName, responseData);
    res.json(responseData);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('POST Error:', err);
    const statusCode = err.message.includes('vượt quá') ? 400 : 500;
    res.status(statusCode).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PUT /api/table/:tableName/:id
router.put('/:tableName/:id', async (req, res) => {
  let { tableName, id } = req.params;
  if (tableName === 'comment') {
    try {
      const checkTbl = await getHelpdeskPool().query('SELECT 1 FROM ticket_comment WHERE comment_id = $1', [id]);
      if (checkTbl.rows.length > 0) {
        tableName = 'ticket_comment';
      }
    } catch (e) { }
  }
  const user = getUserFromReq(req);
  const isSuperAdmin = user && (String(user.role).toUpperCase() === 'SUPER ADMIN' || user.role === '1' || user.role === 1 || user.is_super_admin);
  if (tableName === 'cms_tenant_info') {
    if (!isSuperAdmin) {
      return res.status(403).json({ error: 'Access denied: Only Super Admin can edit subscription information.' });
    }
  }
  const viewName = req.query.view || tableName;
  let isAllowed = isSuperAdmin || await checkPermission('action_rules', `edit_${tableName}`, user, viewName);
  if (!isAllowed) {
    const targetTablesToCheck = ['employee', 'my_company', 'company', 'asset', 'service', 'contact', 'policy_and_program'];
    const checkTable = tableName === 'policy' ? 'policy_and_program' : tableName;
    if (targetTablesToCheck.includes(checkTable)) {
      try {
        const activeRequestsRes = await pool.query(
          `SELECT t.request FROM target_table t
           JOIN request r ON t.request = r.request_id
           WHERE t.table_name = $1 AND $2 = ANY(t.record_ids) AND t.type = 'Edit' AND r.process_status = 8`,
          [tableName, id]
        );
        let foundAuthorizedRequest = false;
        for (const row of activeRequestsRes.rows) {
          const reqId = row.request;
          const reqRes = await pool.query(
            `SELECT requester, sr_creater, policy_lead, sr_owner FROM request WHERE request_id = $1`,
            [reqId]
          );
          if (reqRes.rows.length > 0) {
            const request = reqRes.rows[0];
            const requester = (request.requester || '').toLowerCase();
            const srCreater = (request.sr_creater || '').toLowerCase();
            const policyLead = (request.policy_lead || '').toLowerCase();
            const uId = (user.employee_id || '').toLowerCase();
            const uEmail = (user.email || '').toLowerCase();
            const srOwnerArr = Array.isArray(request.sr_owner)
              ? request.sr_owner.map(s => s.toLowerCase())
              : (request.sr_owner ? [request.sr_owner.toLowerCase()] : []);
            if (requester === uId || requester === uEmail ||
                srCreater === uId || srCreater === uEmail ||
                policyLead === uId || policyLead === uEmail ||
                srOwnerArr.includes(uId) || srOwnerArr.includes(uEmail)) {
              foundAuthorizedRequest = true;
              break;
            }
          }
        }
        if (foundAuthorizedRequest) {
          isAllowed = true;
        }
      } catch (err) {
        console.error('[target_table authorization check error]', err);
      }
    }
    if (!isAllowed) {
      return res.status(403).json({ error: 'Access denied: You do not have permission to edit records.' });
    }
  }

  const { pk: queryPk } = req.query;
  const pk = queryPk || getPrimaryKey(tableName);
  const data = { ...req.body };

  // Validate incoming data using Zod schema (if defined for the table)
  const validationErrors = validateTableData(tableName, data, true);
  if (validationErrors) {
    const errorDetails = Object.entries(validationErrors).map(([field, msg]) => `${field}: ${msg}`).join(', ');
    console.warn(`[validation] tableName=${tableName} (update) validationErrors:`, validationErrors, `data:`, data);
    return res.status(400).json({ error: `Dữ liệu không hợp lệ: ${errorDetails}`, details: validationErrors });
  }

  let dbCols = await getTableColumns(tableName);
  const bodyKeys = Object.keys(data);
  if (bodyKeys.some(k => !dbCols.includes(k))) {
    dbCols = await getTableColumns(tableName, true);
  }
  if (queryPk && !dbCols.includes(queryPk)) {
    return res.status(400).json({ error: 'Invalid primary key column name' });
  }
  const hasIdCol = dbCols.includes('id');
  const userEmployeeId = req.user && req.user.employee_id ? req.user.employee_id : 'system';

  const findCol = (name) => dbCols.find(c => c.toLowerCase().replace(/\s+/g, '_') === name);
  const colCreatedBy = findCol('created_by');
  const colCreatedDate = findCol('created_date');
  const colUpdatedBy = findCol('updated_by');
  const colUpdatedDate = findCol('updated_date');
  const colLog = findCol('log');

  // Fetch old record for logging and permission check
  let oldRecord = null;
  let oldLog = '';
  const rawId = String(id);
  const decodedId = String(hashidHelper.decode(id));
  const requestChildren = ['payment', 'invoice', 'service', 'asset', 'contract', 'expense', 'target_table'];
  if (colLog || colUpdatedBy || requestChildren.includes(tableName) || tableName === 'request' || tableName === 'assigned_task' || tableName === 'task_subtask') {
    try {
      let query = `SELECT * FROM "${tableName}" WHERE (${pk}::text = $1 OR ${pk}::text = $2`;
      if (hasIdCol && pk !== 'id') {
        query += ` OR id::text = $1 OR id::text = $2`;
      }
      if (tableName === 'action_rules') {
        query += ` OR action_id = $1 OR action_id = $2`;
      }
      query += `)`;
      if (dbCols.includes('deleted_at')) {
        query += ` AND deleted_at IS NULL`;
      }
      const oldRes = await getPoolForTable(tableName).query(query, [rawId, decodedId]);
      if (oldRes.rows.length > 0) {
        oldRecord = oldRes.rows[0];
        enrichRecordWithStatusKeys(tableName, oldRecord);
        oldLog = (colLog && oldRecord[colLog]) ? oldRecord[colLog] : '';
      }
    } catch (e) { }
  }

  if (requestChildren.includes(tableName) && oldRecord) {
    const userRole = req.user && req.user.role ? req.user.role : '';
    const reqId = data.request || data.id__request || data.id_request || oldRecord.request || oldRecord.id__request || oldRecord.id_request;
    try {
      await validateRequestChildPermissions(tableName, reqId, userEmployeeId, userRole);
    } catch (authErr) {
      return res.status(403).json({ error: authErr.message });
    }
  }

  if (tableName === 'assigned_task' && oldRecord) {
    const isGlobalAdmin = user.role && user.role.toUpperCase() === 'SUPER ADMIN';
    const isAssignee = String(oldRecord.employee_id).toLowerCase() === String(user.employee_id).toLowerCase();
    let isParentRequestOwner = false;
    try {
      const parentReqRes = await pool.query(
        'SELECT requester, sr_creater, policy_lead, sr_owner FROM request WHERE request_id = $1',
        [oldRecord.request_id]
      );
      if (parentReqRes.rows.length > 0) {
        const r = parentReqRes.rows[0];
        const uId = String(user.employee_id).toLowerCase();
        const uEmail = String(user.email || '').toLowerCase();
        const owners = Array.isArray(r.sr_owner) ? r.sr_owner.map(x => String(x).toLowerCase()) : (r.sr_owner ? [String(r.sr_owner).toLowerCase()] : []);
        if (
          String(r.requester).toLowerCase() === uId || String(r.requester).toLowerCase() === uEmail ||
          String(r.sr_creater).toLowerCase() === uId || String(r.sr_creater).toLowerCase() === uEmail ||
          String(r.policy_lead).toLowerCase() === uId || String(r.policy_lead).toLowerCase() === uEmail ||
          owners.includes(uId) || owners.includes(uEmail)
        ) {
          isParentRequestOwner = true;
        }
      }
    } catch (e) {
      console.error('[assigned_task auth check error]', e);
    }
    if (!isGlobalAdmin && !isAssignee && !isParentRequestOwner) {
      return res.status(403).json({ error: 'Access denied: You are not authorized to update this task.' });
    }
  }

  if (tableName === 'task_subtask' && oldRecord) {
    const isGlobalAdmin = user.role && user.role.toUpperCase() === 'SUPER ADMIN';
    let isAuthorized = isGlobalAdmin;
    if (!isAuthorized) {
      try {
        const parentTaskRes = await pool.query(
          'SELECT employee_id, request_id FROM assigned_task WHERE task_id = $1',
          [oldRecord.task_id]
        );
        if (parentTaskRes.rows.length > 0) {
          const t = parentTaskRes.rows[0];
          const isAssignee = String(t.employee_id).toLowerCase() === String(user.employee_id).toLowerCase();
          let isParentRequestOwner = false;
          const parentReqRes = await pool.query(
            'SELECT requester, sr_creater, policy_lead, sr_owner FROM request WHERE request_id = $1',
            [t.request_id]
          );
          if (parentReqRes.rows.length > 0) {
            const r = parentReqRes.rows[0];
            const uId = String(user.employee_id).toLowerCase();
            const uEmail = String(user.email || '').toLowerCase();
            const owners = Array.isArray(r.sr_owner) ? r.sr_owner.map(x => String(x).toLowerCase()) : (r.sr_owner ? [String(r.sr_owner).toLowerCase()] : []);
            if (
              String(r.requester).toLowerCase() === uId || String(r.requester).toLowerCase() === uEmail ||
              String(r.sr_creater).toLowerCase() === uId || String(r.sr_creater).toLowerCase() === uEmail ||
              String(r.policy_lead).toLowerCase() === uId || String(r.policy_lead).toLowerCase() === uEmail ||
              owners.includes(uId) || owners.includes(uEmail)
            ) {
              isParentRequestOwner = true;
            }
          }
          if (isAssignee || isParentRequestOwner) {
            isAuthorized = true;
          }
        }
      } catch (e) {
        console.error('[task_subtask auth check error]', e);
      }
    }
    if (!isAuthorized) {
      return res.status(403).json({ error: 'Access denied: You are not authorized to update this subtask.' });
    }
  }

  // Enforce payment edit restrictions to Draft status only
  if (tableName === 'payment' && oldRecord) {
    const oldStatus = getStatusKey('payment', 'payment_status', oldRecord.payment_status) || String(oldRecord.payment_status || 'draft').toLowerCase();
    if (oldStatus !== 'draft' && Number(oldRecord.payment_status) !== 30) {
      return res.status(400).json({ error: 'Chỉ có thể chỉnh sửa thanh toán ở trạng thái Draft.' });
    }
  }

  // Enforce MTR edit permission: only Super Admin or users assigned in action_rules
  if (tableName === 'mtr') {
    const isSuperAdmin = user && (String(user.role).toUpperCase() === 'SUPER ADMIN' || user.role === '1' || user.role === 1 || user.is_super_admin);
    if (!isSuperAdmin) {
      const hasActionRule = await checkPermission('action_rules', 'edit_mtr', user, viewName) ||
                            await checkPermission('action_rules', 'edit_mtr', user, 'account');
      if (!hasActionRule) {
        return res.status(403).json({ error: 'Chỉ Super Admin hoặc người được phân công trong action rule mới được phép chỉnh sửa Transaction.' });
      }
    }
  }

  // Enforce status and user authorization restrictions for request edits
  if (tableName === 'request' && oldRecord) {
    const statusId = getRecordStatusId(oldRecord, 'request', 'sr_status') || Number(oldRecord._sr_status_id || oldRecord.sr_status);
    const statusKey = getRecordStatusKey(oldRecord, 'request', 'sr_status') || String(oldRecord.sr_status || '').toLowerCase();
    let isTier1Approved = false;
    if (oldRecord.approval_flow && typeof oldRecord.approval_flow === 'string') {
      try {
        const fl = JSON.parse(oldRecord.approval_flow);
        if (fl.steps && fl.steps.length > 0 && String(fl.steps[0].status || '').toLowerCase().startsWith('approved')) {
          isTier1Approved = true;
        }
      } catch (e) { }
    } else if (oldRecord.approval_flow && oldRecord.approval_flow.steps && oldRecord.approval_flow.steps.length > 0) {
      if (String(oldRecord.approval_flow.steps[0].status || '').toLowerCase().startsWith('approved')) {
        isTier1Approved = true;
      }
    }
    const isDraftOrRejected = [1, 4].includes(statusId) || ['draft', 'rejected'].includes(statusKey);
    const isPendingApproval = statusId === 2 || statusKey === 'pending_approval';
    const isEditableStatus = isDraftOrRejected || (isPendingApproval && !isTier1Approved);

    if (!isEditableStatus) {
      return res.status(400).json({ error: 'Chỉ có thể chỉnh sửa yêu cầu ở trạng thái Draft hoặc Pending Approval (khi chưa có cấp nào duyệt).' });
    }

    const userRole = req.user && req.user.role ? req.user.role : '';
    if (userRole.toUpperCase() !== 'SUPER ADMIN') {
      const creator = oldRecord.sr_creater;
      const requester = oldRecord.requester;
      // sr_owner is TEXT[] — normalize to array
      const srOwnerArr = Array.isArray(oldRecord.sr_owner)
        ? oldRecord.sr_owner.map(s => s.toLowerCase())
        : (oldRecord.sr_owner ? [oldRecord.sr_owner.toLowerCase()] : []);
      const policyLead = oldRecord.policy_lead;

      const isAuthorizedUser = (
        userEmployeeId.toLowerCase() === (creator || '').toLowerCase() ||
        userEmployeeId.toLowerCase() === (requester || '').toLowerCase() ||
        srOwnerArr.includes(userEmployeeId.toLowerCase()) ||
        userEmployeeId.toLowerCase() === (policyLead || '').toLowerCase()
      );

      if (!isAuthorizedUser) {
        return res.status(403).json({ error: 'Bạn không có quyền chỉnh sửa yêu cầu này.' });
      }
    }
  }

  // Validate request type restrictions on update
  if (tableName === 'request') {
    const currentRequester = data.requester !== undefined ? data.requester : (oldRecord ? oldRecord.requester : null);
    const currentRequestType = data.request_type !== undefined ? data.request_type : (oldRecord ? oldRecord.request_type : null);
    if (currentRequester && currentRequestType) {
      try {
        await validateRequestTypeRestrictions(currentRequester, currentRequestType);
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }
    }
  }

  if (tableName === 'request' && oldRecord) {
    const oldStatusId = getRecordStatusId(oldRecord, 'request', 'sr_status') || Number(oldRecord._sr_status_id || oldRecord.sr_status);
    let newStatusId = Number(data.sr_status);
    if (isNaN(newStatusId) && data.sr_status) {
      newStatusId = resolveStatusId('request', 'sr_status', data.sr_status);
    }

    if (newStatusId === 2) {
      data.sr_status = 2;
    }
    if (newStatusId === 1) {
      data.sr_status = 1;
      resetUnapprovedTierStatusesForDraft(data, oldRecord);
    }
    if ([1, 4].includes(oldStatusId) && newStatusId === 2) {
      data.sr_submitted_date = new Date();

      const tzTimeStr = new Date().toISOString();
      const submitLog = { timestamp: tzTimeStr, user: userEmployeeId, action: 'submitted request' };

      let currentLogs = [];
      try {
        currentLogs = typeof oldRecord.log === 'string' ? JSON.parse(oldRecord.log) : (oldRecord.log || []);
      } catch (e) {
        currentLogs = [];
      }
      currentLogs.push(submitLog);
      data.log = JSON.stringify(currentLogs);
    } else {
      const tzTimeStr = new Date().toISOString();
      const editLog = { timestamp: tzTimeStr, user: userEmployeeId, action: 'updated request' };
      let currentLogs = [];
      try {
        currentLogs = typeof oldRecord.log === 'string' ? JSON.parse(oldRecord.log) : (oldRecord.log || []);
      } catch (e) {
        currentLogs = [];
      }
      currentLogs.push(editLog);
      data.log = JSON.stringify(currentLogs);
    }
      const fullData = { ...oldRecord, ...data };
      await RequestModel.resolveApprovals(fullData, pool);
      const resolvedFields = [
        'policy_lead', 'sr_owner', 'approval_flow', 'approval_level', 'elements', 'sr_status', 'process_status'
      ];
      resolvedFields.forEach(f => {
        if (fullData[f] !== undefined) {
          data[f] = fullData[f];
        }
      });
    }

  if (tableName === 'request') {
    if (data.elements !== undefined && data.elements !== null) {
      if (Array.isArray(data.elements)) {
        data.elements = data.elements.map(s => s.trim().replace(/^\[|\]$/g, '').toUpperCase()).filter(Boolean);
      } else if (typeof data.elements === 'string') {
        data.elements = data.elements.split(',').map(s => s.trim().replace(/^\[|\]$/g, '').toUpperCase()).filter(Boolean);
      }
    }
    if (data.sr_owner !== undefined && data.sr_owner !== null) {
      if (Array.isArray(data.sr_owner)) {
        data.sr_owner = data.sr_owner.map(s => s.trim().replace(/^\[|\]$/g, '').toLowerCase()).filter(Boolean);
      } else if (typeof data.sr_owner === 'string') {
        data.sr_owner = data.sr_owner.split(',').map(s => s.trim().replace(/^\[|\]$/g, '').toLowerCase()).filter(Boolean);
      }
    }
  }

  if (tableName === 'target_table') {
    if (data.record_ids !== undefined && data.record_ids !== null) {
      if (Array.isArray(data.record_ids)) {
        data.record_ids = data.record_ids.map(s => s.trim().replace(/^\[|\]$/g, '')).filter(Boolean);
      } else if (typeof data.record_ids === 'string') {
        data.record_ids = data.record_ids.split(',').map(s => s.trim().replace(/^\[|\]$/g, '')).filter(Boolean);
      }
    }
  }

  // Prevent overriding creation fields
  if (colCreatedBy) delete data[colCreatedBy];
  if (colCreatedDate) delete data[colCreatedDate];

  if (colUpdatedBy) data[colUpdatedBy] = userEmployeeId;
  // Let the DB trigger handle updated_date and diff logs

  autoCalculateBaseCurrencyFields(tableName, data, oldRecord);
  await cleanEmptyStringsForTable(tableName, data);
  convertStatusFieldsToIds(tableName, data);

  // Stringify JSON/JSONB columns if passed as objects/arrays to avoid PG binding errors
  const jsonColumns = ['approval_flow', 'processing_flow', 'log', 'finance_mappings', 'menu_icons'];
  Object.keys(data).forEach(k => {
    if (jsonColumns.includes(k) && typeof data[k] === 'object' && data[k] !== null) {
      data[k] = JSON.stringify(data[k]);
    }
  });

  const keys = Object.keys(data).filter(k => dbCols.includes(k));
  const values = keys.map(k => data[k]);

  const setString = keys.map((key, i) => `"${key}" = $${i + 1}`).join(', ');

  // ── Modular tableRegistry beforeUpdate hook ────────────────────────
  const updateHandler = tableRegistry.resolveHandler(tableName);
  if (updateHandler && typeof updateHandler.beforeUpdate === 'function') {
    try {
      await updateHandler.beforeUpdate(req, id, data, oldRecord);
    } catch (handlerErr) {
      return res.status(400).json({ error: handlerErr.message });
    }
  }

  // ── Contract validations (PUT) ──────────────────────────────────────
  if (tableName === 'contract') {
    // Merge with oldRecord to check effective values
    const effectiveSignedDate = data.contract_signed_date !== undefined ? data.contract_signed_date : (oldRecord && oldRecord.contract_signed_date);
    const effectiveContractNo = data.contractspood_no !== undefined ? data.contractspood_no : (oldRecord && oldRecord.contractspood_no);
    const hasSignedDate = effectiveSignedDate && String(effectiveSignedDate).trim() !== '';
    const hasContractNo = effectiveContractNo && String(effectiveContractNo).trim() !== '';
    if (hasSignedDate && !hasContractNo) {
      return res.status(400).json({ error: 'Contract No (contractspood_no) is required when Signed Date is set.' });
    }
    // Contract type must not be Internal (71)
    if (data.type !== undefined && Number(data.type) === 71) {
      return res.status(400).json({ error: 'Contract type "Internal" is no longer supported. Please select Selling or Buying.' });
    }
  }

  // ── Payment validations (PUT) ─────────────────────────────────────────
  if (tableName === 'payment') {
    // payment_term required (check if being explicitly cleared)
    const effectivePaymentTerm = data.payment_term !== undefined ? data.payment_term : (oldRecord && oldRecord.payment_term);
    if (effectivePaymentTerm !== undefined && (!effectivePaymentTerm || String(effectivePaymentTerm).trim() === '')) {
      return res.status(400).json({ error: 'Payment Condition (payment_term) is required.' });
    }
    // payment_period must be positive integer
    if (data.payment_period !== undefined && data.payment_period !== null && data.payment_period !== '') {
      const ppVal = Number(data.payment_period);
      if (!Number.isInteger(ppVal) || ppVal < 1) {
        return res.status(400).json({ error: 'Payment Period must be a positive whole number.' });
      }
      data.payment_period = ppVal;
    }
  }

  // ── Invoice validations (PUT) ─────────────────────────────────────────
  if (tableName === 'invoice') {
    const effectiveDescription = data.description !== undefined ? data.description : (oldRecord && oldRecord.description);
    if (effectiveDescription !== undefined && (!effectiveDescription || !String(effectiveDescription).trim())) {
      return res.status(400).json({ error: 'Description is required for invoice.' });
    }
  }

  try {
    if (tableName === 'payment' && (data.contract_id !== undefined || (oldRecord && oldRecord.contract_id))) {
      const contractId = data.contract_id !== undefined ? data.contract_id : (oldRecord ? oldRecord.contract_id : null);
      if (contractId) {
        const contractRes = await getPoolForTable(tableName).query('SELECT COALESCE(total_value_in_base_currency, (COALESCE(value_before_vat, 0) + COALESCE(vat_value, 0)) * COALESCE(exchance_rate, 1)) as contract_total FROM contract WHERE contract_id = $1 AND deleted_at IS NULL', [contractId]);
        if (contractRes.rows.length > 0) {
          const contractTotal = parseFloat(contractRes.rows[0].contract_total) || 0;
          let newTotal = 0;
          if (data.value_in_base_currency !== undefined && data.value_in_base_currency !== null && data.value_in_base_currency !== '') {
            newTotal = parseFloat(String(data.value_in_base_currency).replace(/,/g, '')) || 0;
          } else if (data.value !== undefined || data.exchange_rate !== undefined) {
            const val = parseFloat(String(data.value !== undefined ? data.value : (oldRecord ? oldRecord.value : 0)).replace(/,/g, '')) || 0;
            const rate = parseFloat(String(data.exchange_rate !== undefined ? data.exchange_rate : (oldRecord ? oldRecord.exchange_rate : 1)).replace(/,/g, '')) || 1;
            newTotal = Math.round(val * rate);
          } else {
            newTotal = oldRecord ? (parseFloat(oldRecord.value_in_base_currency) || (parseFloat(oldRecord.value || 0) * parseFloat(oldRecord.exchange_rate || 1))) : 0;
          }

          const existingRes = await getPoolForTable(tableName).query('SELECT SUM(COALESCE(value_in_base_currency, (COALESCE(value, 0) + COALESCE(vat, 0)) * COALESCE(exchange_rate, 1))) as existing_total FROM payment WHERE contract_id = $1 AND deleted_at IS NULL AND payment_id <> $2', [contractId, id]);
          const existingTotal = parseFloat(existingRes.rows[0].existing_total) || 0;
          if (existingTotal + newTotal > contractTotal) {
            throw new Error(`Tổng giá trị các thanh toán (${(existingTotal + newTotal).toLocaleString()}) vượt quá tổng giá trị hợp đồng (${contractTotal.toLocaleString()})`);
          }
        }
      }
    }

    if (tableName === 'invoice' && (data.contract_id !== undefined || (oldRecord && oldRecord.contract_id))) {
      const contractId = data.contract_id !== undefined ? data.contract_id : (oldRecord ? oldRecord.contract_id : null);
      if (contractId) {
        const contractRes = await getPoolForTable(tableName).query('SELECT COALESCE(total_value_in_base_currency, (COALESCE(value_before_vat, 0) + COALESCE(vat_value, 0)) * COALESCE(exchance_rate, 1)) as contract_total FROM contract WHERE contract_id = $1 AND deleted_at IS NULL', [contractId]);
        if (contractRes.rows.length > 0) {
          const contractTotal = parseFloat(contractRes.rows[0].contract_total) || 0;
          let newTotal = 0;
          if (data.total_value_in_base_currency !== undefined && data.total_value_in_base_currency !== null && data.total_value_in_base_currency !== '') {
            newTotal = parseFloat(String(data.total_value_in_base_currency).replace(/,/g, '')) || 0;
          } else if (data.value_before_vat !== undefined || data.vat_value !== undefined || data.exchange_rate !== undefined) {
            const valBefore = parseFloat(String(data.value_before_vat !== undefined ? data.value_before_vat : (oldRecord ? oldRecord.value_before_vat : 0)).replace(/,/g, '')) || 0;
            const valVat = parseFloat(String(data.vat_value !== undefined ? data.vat_value : (oldRecord ? oldRecord.vat_value : 0)).replace(/,/g, '')) || 0;
            const rate = parseFloat(String(data.exchange_rate !== undefined ? data.exchange_rate : (oldRecord ? oldRecord.exchange_rate : 1)).replace(/,/g, '')) || 1;
            newTotal = Math.round((valBefore + valVat) * rate);
          } else {
            newTotal = oldRecord ? (parseFloat(oldRecord.total_value_in_base_currency) || ((parseFloat(oldRecord.value_before_vat || 0) + parseFloat(oldRecord.vat_value || 0)) * parseFloat(oldRecord.exchange_rate || 1))) : 0;
          }

          const existingRes = await getPoolForTable(tableName).query('SELECT SUM(COALESCE(total_value_in_base_currency, (COALESCE(value_before_vat, 0) + COALESCE(vat_value, 0)) * COALESCE(exchange_rate, 1))) as existing_total FROM invoice WHERE contract_id = $1 AND deleted_at IS NULL AND invoice_id <> $2', [contractId, id]);
          const existingTotal = parseFloat(existingRes.rows[0].existing_total) || 0;
          if (existingTotal + newTotal > contractTotal) {
            throw new Error(`Tổng giá trị các hóa đơn (${(existingTotal + newTotal).toLocaleString()}) vượt quá tổng giá trị hợp đồng (${contractTotal.toLocaleString()})`);
          }
        }
      }
    }

    let whereClause = `(${pk}::text = $${values.length + 1} OR ${pk}::text = $${values.length + 2}`;
    if (hasIdCol && pk !== 'id') {
      whereClause += ` OR id::text = $${values.length + 1} OR id::text = $${values.length + 2}`;
    }
    if (tableName === 'action_rules') {
      whereClause += ` OR action_id = $${values.length + 1} OR action_id = $${values.length + 2}`;
    }
    whereClause += `)`;
    if (dbCols.includes('deleted_at')) {
      whereClause += ` AND deleted_at IS NULL`;
    }
    values.push(rawId, decodedId);
    const updatePool = getPoolForTable(tableName);
    const updateClient = await updatePool.connect();
    let result;
    try {
      await updateClient.query('BEGIN');
      await updateClient.query("SELECT set_config('app.current_user', $1, true)", [userEmployeeId]);
      result = await updateClient.query(
        `UPDATE "${tableName}" SET ${setString} WHERE ${whereClause} RETURNING *`,
        values
      );
      await updateClient.query('COMMIT');
    } catch (uErr) {
      await updateClient.query('ROLLBACK');
      throw uErr;
    } finally {
      updateClient.release();
    }
    if (result.rows.length === 0) return res.status(404).json({ error: 'Record not found' });

    // Update target_table configuration log if this record is a target of an active request
    try {
      const activeConfigs = await pool.query(
        `SELECT t.target_table_id, t.log FROM target_table t
         JOIN request r ON t.request = r.request_id
         WHERE t.table_name = $1 AND $2 = ANY(t.record_ids) AND t.type = 'Edit' AND r.process_status = 8`,
        [tableName, id]
      );
      for (const row of activeConfigs.rows) {
        let currentLogs = [];
        try {
          currentLogs = typeof row.log === 'string' ? JSON.parse(row.log) : (Array.isArray(row.log) ? row.log : []);
        } catch (e) {
          currentLogs = [];
        }
        // Avoid duplicates: remove previous log entry for this record if exists
        currentLogs = currentLogs.filter(l => String(l.record_id) !== String(id));
        currentLogs.push({
          record_id: id,
          action: 'Edit',
          user: userEmployeeId,
          timestamp: new Date().toISOString()
        });
        await pool.query(
          `UPDATE target_table SET log = $1 WHERE target_table_id = $2`,
          [JSON.stringify(currentLogs), row.target_table_id]
        );
      }
    } catch (logErr) {
      console.error('[target_table edit logging error]', logErr);
    }

    if (tableName === 'cms_tenant_info' && data.base_currency) {
      await pool.query('UPDATE public.my_company SET base_currency = $1', [data.base_currency]);
    }

    // Automation: Data Change Trigger for Request (Payment / Invoice)
    if (tableName === 'request') {
      const updatedRecord = RequestModel.enrichRequest(result.rows[0]);
      const oldApproval = oldRecord ? RequestModel.enrichRequest(oldRecord).approval_status : null;
      const newApproval = updatedRecord.approval_status;

      const isNowApproved = Number(updatedRecord.sr_status) === 3;
      const wasApproved = oldRecord && Number(oldRecord.sr_status) === 3;

      const dynamicApprovalAutomationId = 'app_dynamic_request_approval_sync_payment_invoice';
      if (isNowApproved && !wasApproved && await isAutomationActive(dynamicApprovalAutomationId)) {
        const requestType = String(updatedRecord.request_type || '');
        if (requestType === '5' || requestType.toUpperCase() === 'RPM') {
          try {
            // Auto-complete request if not already completed
            if (Number(updatedRecord.process_status) !== 9) {
              await pool.query(
                `UPDATE request SET process_status = 9, process_start_date = COALESCE(process_start_date, CURRENT_TIMESTAMP), process_end_date = CURRENT_TIMESTAMP WHERE request_id = $1`,
                [updatedRecord.request_id]
              );
            }
            const automationRes = await pool.query(
              `UPDATE "payment" 
               SET payment_status = 31, updated_by = $2, updated_date = CURRENT_TIMESTAMP 
               WHERE payment_request = $1 OR (request = $1 AND payment_status IN (30, 121))
               RETURNING payment_id, request, contract_id`,
              [updatedRecord.request_id, userEmployeeId]
            );
            automationRes.rows.forEach(pRow => {
              try {
                broadcastSSE('db_change', {
                  action: 'update',
                  table: 'payment',
                  id: pRow.payment_id,
                  record: { payment_id: pRow.payment_id, payment_status: 31, request: pRow.request || updatedRecord.request_id, contract_id: pRow.contract_id }
                });
              } catch (bErr) {}
            });
            await logAutomationRun(dynamicApprovalAutomationId, {
              table_name: 'payment',
              record_id: updatedRecord.request_id,
              changed_columns: ['payment_status', 'updated_by'],
              condition_snapshot: { request_id: updatedRecord.request_id, request_type: requestType, old_approval: oldApproval, new_approval: newApproval },
              output_snapshot: { payment_status: 31, affected_rows: automationRes.rowCount }
            });
          } catch (e) {
            await logAutomationRun(dynamicApprovalAutomationId, {
              table_name: 'payment',
              record_id: updatedRecord.request_id,
              status: 'failed',
              message: e.message,
              condition_snapshot: { request_id: updatedRecord.request_id, request_type: requestType, old_approval: oldApproval, new_approval: newApproval }
            }).catch(() => {});
            console.error('[Automation Error] Payment update failed:', e);
          }
        } else if (requestType === '12') {
          try {
            const automationRes = await pool.query(
              `UPDATE "invoice" SET invoice_status = 35 WHERE invoice_request = $1`,
              [updatedRecord.request_id]
            );
            await logAutomationRun(dynamicApprovalAutomationId, {
              table_name: 'invoice',
              record_id: updatedRecord.request_id,
              changed_columns: ['invoice_status'],
              condition_snapshot: { request_id: updatedRecord.request_id, request_type: requestType, old_approval: oldApproval, new_approval: newApproval },
              output_snapshot: { invoice_status: 35, affected_rows: automationRes.rowCount }
            });
          } catch (e) {
            await logAutomationRun(dynamicApprovalAutomationId, {
              table_name: 'invoice',
              record_id: updatedRecord.request_id,
              status: 'failed',
              message: e.message,
              condition_snapshot: { request_id: updatedRecord.request_id, request_type: requestType, old_approval: oldApproval, new_approval: newApproval }
            }).catch(() => {});
            console.error('[Automation Error] Invoice update failed:', e);
          }
        }
      }
    }

    if (tableName === 'request') {
      const reqId = result.rows[0].request_id;
      const commentText = req.body.comment !== undefined ? req.body.comment : data.comment;
      let fileText = req.body.file !== undefined ? req.body.file : data.file;
      if (typeof fileText === 'object' && fileText !== null) {
        fileText = JSON.stringify(fileText);
      }
      if ((commentText && String(commentText).trim()) || (fileText && String(fileText).trim())) {
        const commId = uuidv4();
        await pool.query(
          `INSERT INTO "comment" ("comment_id", "request", "comment", "file", "comment_by", "comment_date") 
            VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
          [commId, reqId, commentText || null, fileText || null, userEmployeeId]
        );
      }
    }

    if (['action_rules', 'exception_rules', 'column_permissions'].includes(tableName)) {
      clearPermissionCache();
    }
    let responseData = result.rows[0];
    if (tableName === 'request') {
      RequestModel.enrichRequest(responseData);
      try {
        const pRes = await pool.query('SELECT elements, approval_level FROM policy_and_program WHERE policy_id::text = $1', [responseData.request_type]);
        if (pRes.rows.length > 0) {
          responseData.policy_elements = pRes.rows[0].elements;
          responseData.policy_approval_level = pRes.rows[0].approval_level;
          if (!responseData.approval_level) {
            responseData.approval_level = pRes.rows[0].approval_level;
          }
        }
      } catch (errPolicy) {
        console.error('Error fetching policy elements in PUT:', errPolicy);
      }
    }



    if (tableName === 'policy_and_program') {
      const userEmail = req.user && req.user.employee_id ? req.user.employee_id : 'system';
      await syncUploadedFiles(getPoolForTable(tableName), 'policy_and_program', id, 'procedure_file', data.procedure_file, userEmail);
    } else if (tableName === 'invoice') {
      const userEmail = req.user && req.user.employee_id ? req.user.employee_id : 'system';
      await syncUploadedFiles(getPoolForTable(tableName), 'invoice', id, 'attached_file', data.attached_file, userEmail);
    }

    broadcastSSE('db_change', { action: 'update', table: tableName, record: responseData });
    triggerNotifications(tableName, oldRecord, responseData);
    enrichRecordWithStatusCatalog(tableName, responseData);
    res.json(responseData);
  } catch (err) {
    console.error('PUT Error:', err);
    const statusCode = err.message.includes('vượt quá') ? 400 : 500;
    res.status(statusCode).json({ error: err.message });
  }
});

// Helper function to handle permanent cascade deletion of parent and child records
async function executeCascadeHardDelete(client, tableName, id) {
  if (tableName === 'request') {
    await client.query(`DELETE FROM comment WHERE request = $1`, [id]);

    await client.query(`DELETE FROM payment WHERE request = $1`, [id]);
    await client.query(`DELETE FROM invoice WHERE request = $1`, [id]);
    await client.query(`DELETE FROM mtr WHERE request = $1`, [id]);
    await client.query(`DELETE FROM service WHERE request = $1`, [id]);
    await client.query(`DELETE FROM asset WHERE request = $1`, [id]);
    await client.query(`DELETE FROM contract WHERE request = $1`, [id]);
    await client.query(`DELETE FROM request_watches WHERE request_id = $1`, [id]);
    await client.query(`DELETE FROM policy_and_program WHERE id__request = $1`, [id]);
    await client.query(`UPDATE account SET id__request = NULL WHERE id__request = $1`, [id]);
  } else if (tableName === 'my_company') {
    const compRes = await client.query(`SELECT company_shortname FROM my_company WHERE my_company_id = $1`, [id]);
    if (compRes.rows.length > 0) {
      const shortname = compRes.rows[0].company_shortname;
      await client.query(`DELETE FROM account WHERE company_entity = $1`, [shortname]);
    }
    await client.query(`DELETE FROM department WHERE company_id = $1`, [id]);
    await client.query(`DELETE FROM employee WHERE company_id = $1`, [id]);
    await client.query(`DELETE FROM my_location WHERE company_id = $1`, [id]);
    await client.query(`DELETE FROM operation_program WHERE company_id = $1`, [id]);
    await client.query(`DELETE FROM policy_and_program WHERE company_id = $1`, [id]);
  } else if (tableName === 'department') {
    await client.query(`DELETE FROM employee WHERE department_id = $1`, [id]);
  } else if (tableName === 'contract') {
    await client.query(`DELETE FROM payment WHERE contract_id = $1`, [id]);
  }

  // Helper to determine primary key from table name (since getPrimaryKey is defined above, we can call it)
  const pk = getPrimaryKey(tableName);
  const dbCols = await getTableColumns(tableName);
  const hasIdCol = dbCols.includes('id');
  let deleteQuery = `DELETE FROM "${tableName}" WHERE (${pk}::text = $1`;
  if (hasIdCol && pk !== 'id') {
    deleteQuery += ` OR id::text = $1`;
  }
  if (tableName === 'action_rules') {
    deleteQuery += ` OR action_id = $1`;
  }
  deleteQuery += `) RETURNING *`;
  return await client.query(deleteQuery, [id]);
}

// DELETE /api/table/:tableName/:id
router.delete('/:tableName/:id', async (req, res) => {
  let { tableName, id } = req.params;
  if (tableName === 'comment') {
    try {
      const checkTbl = await getHelpdeskPool().query('SELECT 1 FROM ticket_comment WHERE comment_id = $1', [id]);
      if (checkTbl.rows.length > 0) {
        tableName = 'ticket_comment';
      }
    } catch (e) { }
  }
  if (tableName === 'cms_tenant_info') {
    return res.status(403).json({ error: 'Access denied: cms_tenant_info is read-only from the CRC app.' });
  }
  const user = getUserFromReq(req);
  const userRole = req.user && req.user.role ? req.user.role : '';
  const isSuperAdmin = userRole.toUpperCase() === 'SUPER ADMIN';

  if (req.query.hard === 'true') {
    if (!isSuperAdmin) {
      return res.status(403).json({ error: 'Access denied: Only Super Admin can perform permanent deletions.' });
    }
    const client = await getPoolForTable(tableName).connect();
    try {
      await client.query('BEGIN');
      const result = await executeCascadeHardDelete(client, tableName, id);
      await client.query('COMMIT');
      if (['action_rules', 'exception_rules', 'column_permissions'].includes(tableName)) {
        clearPermissionCache();
      }
      if (result.rows.length > 0) {
        broadcastSSE('db_change', { action: 'delete', table: tableName, id: id, record: result.rows[0] });
      }
      return res.json({ message: 'Permanently deleted successfully' });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Error in hard delete:', err);
      return res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  }

  const viewName = req.query.view || tableName;
  let isAllowed = await checkPermission('action_rules', `delete_${tableName}`, user, viewName);
  if (!isAllowed) {
    if (tableName === 'request') {
      try {
        const reqCheck = await pool.query('SELECT requester, sr_creater, policy_lead, sr_owner FROM request WHERE request_id = $1', [id]);
        if (reqCheck.rows.length > 0) {
          const r = reqCheck.rows[0];
          const uId = String(user.employee_id || '').toLowerCase();
          const uEmail = String(user.email || '').toLowerCase();
          const owners = Array.isArray(r.sr_owner) ? r.sr_owner.map(x => String(x).toLowerCase()) : (r.sr_owner ? [String(r.sr_owner).toLowerCase()] : []);
          if (
            (uId && String(r.requester || '').toLowerCase() === uId) || (uEmail && String(r.requester || '').toLowerCase() === uEmail) ||
            (uId && String(r.sr_creater || '').toLowerCase() === uId) || (uEmail && String(r.sr_creater || '').toLowerCase() === uEmail) ||
            (uId && String(r.policy_lead || '').toLowerCase() === uId) || (uEmail && String(r.policy_lead || '').toLowerCase() === uEmail) ||
            (uId && owners.includes(uId)) || (uEmail && owners.includes(uEmail))
          ) {
            isAllowed = true;
          }
        }
      } catch (e) {
        console.error('[request delete owner check error]', e);
      }
    }
    const targetTablesToCheck = ['employee', 'my_company', 'company', 'asset', 'service', 'contact', 'policy_and_program'];
    const checkTable = tableName === 'policy' ? 'policy_and_program' : tableName;
    if (targetTablesToCheck.includes(checkTable)) {
      try {
        const activeRequestsRes = await pool.query(
          `SELECT t.request FROM target_table t
           JOIN request r ON t.request = r.request_id
           WHERE t.table_name = $1 AND $2 = ANY(t.record_ids) AND t.type = 'Delete' AND r.process_status = 8`,
          [tableName, id]
        );
        let foundAuthorizedRequest = false;
        for (const row of activeRequestsRes.rows) {
          const reqId = row.request;
          const reqRes = await pool.query(
            `SELECT requester, sr_creater, policy_lead, sr_owner FROM request WHERE request_id = $1`,
            [reqId]
          );
          if (reqRes.rows.length > 0) {
            const request = reqRes.rows[0];
            const requester = (request.requester || '').toLowerCase();
            const srCreater = (request.sr_creater || '').toLowerCase();
            const policyLead = (request.policy_lead || '').toLowerCase();
            const uId = (user.employee_id || '').toLowerCase();
            const uEmail = (user.email || '').toLowerCase();
            const srOwnerArr = Array.isArray(request.sr_owner)
              ? request.sr_owner.map(s => s.toLowerCase())
              : (request.sr_owner ? [request.sr_owner.toLowerCase()] : []);
            if (requester === uId || requester === uEmail ||
                srCreater === uId || srCreater === uEmail ||
                policyLead === uId || policyLead === uEmail ||
                srOwnerArr.includes(uId) || srOwnerArr.includes(uEmail)) {
              foundAuthorizedRequest = true;
              break;
            }
          }
        }
        if (foundAuthorizedRequest) {
          isAllowed = true;
        }
      } catch (err) {
        console.error('[target_table delete authorization check error]', err);
      }
    }
    if (!isAllowed) {
      return res.status(403).json({ error: 'Access denied: You do not have permission to delete records.' });
    }
  }

  const pk = getPrimaryKey(tableName);
  const dbCols = await getTableColumns(tableName);
  const hasIdCol = dbCols.includes('id');
  const userEmployeeId = req.user && req.user.employee_id ? req.user.employee_id : '';
  // userRole is already defined in the upper scope of this handler

  try {
    if (tableName === 'contract') {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query("SELECT set_config('app.current_user', $1, true)", [userEmployeeId || 'system']);
        const conRes = await client.query(
          `UPDATE "contract" SET deleted_at = CURRENT_TIMESTAMP WHERE contract_id = $1 AND deleted_at IS NULL RETURNING *`,
          [id]
        );
        if (conRes.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: 'Contract not found or already deleted' });
        }
        const payRes = await client.query(
          `SELECT payment_id FROM "payment" WHERE contract_id = $1 AND deleted_at IS NULL`,
          [id]
        );
        const payIds = payRes.rows.map(r => r.payment_id);
        let deletedPayments = [];
        if (payIds.length > 0) {
          const payUpdateRes = await client.query(
            `UPDATE "payment" SET deleted_at = CURRENT_TIMESTAMP, payment_status = 33 WHERE contract_id = $1 AND deleted_at IS NULL RETURNING *`,
            [id]
          );
          deletedPayments = payUpdateRes.rows;
        }

        // Soft delete associated invoices
        const invRes = await client.query(
          `SELECT invoice_id FROM "invoice" WHERE contract_id = $1 AND deleted_at IS NULL`,
          [id]
        );
        const invIds = invRes.rows.map(r => r.invoice_id);
        let deletedInvoices = [];
        if (invIds.length > 0) {
          const invUpdateRes = await client.query(
            `UPDATE "invoice" SET deleted_at = CURRENT_TIMESTAMP, invoice_status = 39 WHERE contract_id = $1 AND deleted_at IS NULL RETURNING *`,
            [id]
          );
          deletedInvoices = invUpdateRes.rows;
        }

        await client.query('COMMIT');
        broadcastSSE('db_change', { action: 'delete', table: 'contract', id: id, record: conRes.rows[0] });
        for (const p of deletedPayments) {
          broadcastSSE('db_change', { action: 'delete', table: 'payment', id: p.payment_id, record: p });
        }
        for (const inv of deletedInvoices) {
          broadcastSSE('db_change', { action: 'delete', table: 'invoice', id: inv.invoice_id, record: inv });
        }
        return res.json({ message: 'Contract, associated payments, and invoices soft deleted successfully' });
      } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error soft deleting contract:', err);
        return res.status(500).json({ error: err.message });
      } finally {
        client.release();
      }
    }

    if (tableName === 'request') {
      const checkRes = await pool.query('SELECT sr_status FROM "request" WHERE request_id = $1 AND deleted_at IS NULL', [id]);
      if (checkRes.rows.length > 0) {
        const srStatusId = Number(checkRes.rows[0].sr_status);
        if (![1, 6].includes(srStatusId)) {
          return res.status(400).json({ error: 'Chỉ có thể xóa yêu cầu ở trạng thái Draft hoặc Cancelled.' });
        }
      }
    }
    if (tableName === 'payment') {
      const checkRes = await pool.query('SELECT payment_status FROM "payment" WHERE payment_id = $1 AND deleted_at IS NULL', [id]);
      if (checkRes.rows.length > 0) {
        const payStatusId = Number(checkRes.rows[0].payment_status);
        if (payStatusId !== 30) {
          return res.status(400).json({ error: 'Chỉ có thể xóa thanh toán ở trạng thái Draft.' });
        }
      }
    }
    if (tableName === 'assigned_task') {
      const checkRes = await pool.query('SELECT * FROM "assigned_task" WHERE task_id = $1 AND deleted_at IS NULL', [id]);
      if (checkRes.rows.length > 0) {
        const record = checkRes.rows[0];
        const isGlobalAdmin = user.role && user.role.toUpperCase() === 'SUPER ADMIN';
        let isParentRequestOwner = false;
        try {
          const parentReqRes = await pool.query(
            'SELECT requester, sr_creater, policy_lead, sr_owner FROM request WHERE request_id = $1',
            [record.request_id]
          );
          if (parentReqRes.rows.length > 0) {
            const r = parentReqRes.rows[0];
            const uId = String(user.employee_id).toLowerCase();
            const uEmail = String(user.email || '').toLowerCase();
            const owners = Array.isArray(r.sr_owner) ? r.sr_owner.map(x => String(x).toLowerCase()) : (r.sr_owner ? [String(r.sr_owner).toLowerCase()] : []);
            if (
              String(r.requester).toLowerCase() === uId || String(r.requester).toLowerCase() === uEmail ||
              String(r.sr_creater).toLowerCase() === uId || String(r.sr_creater).toLowerCase() === uEmail ||
              String(r.policy_lead).toLowerCase() === uId || String(r.policy_lead).toLowerCase() === uEmail ||
              owners.includes(uId) || owners.includes(uEmail)
            ) {
              isParentRequestOwner = true;
            }
          }
        } catch (e) {
          console.error('[assigned_task delete auth check error]', e);
        }
        if (!isGlobalAdmin && !isParentRequestOwner) {
          return res.status(403).json({ error: 'Access denied: You are not authorized to delete this task.' });
        }
      }
    }

    if (tableName === 'task_subtask') {
      const checkRes = await pool.query('SELECT * FROM "task_subtask" WHERE subtask_id = $1 AND deleted_at IS NULL', [id]);
      if (checkRes.rows.length > 0) {
        const record = checkRes.rows[0];
        const isGlobalAdmin = user.role && user.role.toUpperCase() === 'SUPER ADMIN';
        let isAuthorized = isGlobalAdmin;
        if (!isAuthorized) {
          try {
            const parentTaskRes = await pool.query(
              'SELECT employee_id, request_id FROM assigned_task WHERE task_id = $1',
              [record.task_id]
            );
            if (parentTaskRes.rows.length > 0) {
              const t = parentTaskRes.rows[0];
              const isAssignee = String(t.employee_id).toLowerCase() === String(user.employee_id).toLowerCase();
              let isParentRequestOwner = false;
              const parentReqRes = await pool.query(
                'SELECT requester, sr_creater, policy_lead, sr_owner FROM request WHERE request_id = $1',
                [t.request_id]
              );
              if (parentReqRes.rows.length > 0) {
                const r = parentReqRes.rows[0];
                const uId = String(user.employee_id).toLowerCase();
                const uEmail = String(user.email || '').toLowerCase();
                const owners = Array.isArray(r.sr_owner) ? r.sr_owner.map(x => String(x).toLowerCase()) : (r.sr_owner ? [String(r.sr_owner).toLowerCase()] : []);
                if (
                  String(r.requester).toLowerCase() === uId || String(r.requester).toLowerCase() === uEmail ||
                  String(r.sr_creater).toLowerCase() === uId || String(r.sr_creater).toLowerCase() === uEmail ||
                  String(r.policy_lead).toLowerCase() === uId || String(r.policy_lead).toLowerCase() === uEmail ||
                  owners.includes(uId) || owners.includes(uEmail)
                ) {
                  isParentRequestOwner = true;
                }
              }
              if (isAssignee || isParentRequestOwner) {
                isAuthorized = true;
              }
            }
          } catch (e) {
            console.error('[task_subtask delete auth check error]', e);
          }
        }
        if (!isAuthorized) {
          return res.status(403).json({ error: 'Access denied: You are not authorized to delete this subtask.' });
        }
      }
    }

    const requestChildren = ['payment', 'invoice', 'service', 'asset', 'target_table', 'expense'];
    if (requestChildren.includes(tableName)) {
      let reqCol = dbCols.includes('id__request') ? 'id__request' : (dbCols.includes('id_request') ? 'id_request' : 'request');
      let selectQuery = `SELECT ${reqCol} AS request FROM "${tableName}" WHERE (${pk}::text = $1`;
      if (hasIdCol && pk !== 'id') {
        selectQuery += ` OR id::text = $1`;
      }
      selectQuery += `)`;
      if (dbCols.includes('deleted_at')) {
        selectQuery += ` AND deleted_at IS NULL`;
      }
      const existingRes = await pool.query(selectQuery, [id]);
      if (existingRes.rows.length > 0) {
        const reqId = existingRes.rows[0].request;
        try {
          await validateRequestChildPermissions(tableName, reqId, userEmployeeId, userRole);
        } catch (authErr) {
          return res.status(403).json({ error: authErr.message });
        }
      }
    }
    let query;
    if (dbCols.includes('deleted_at')) {
      let statusColToUpdate = null;
      let statusValToUpdate = null;
      if (dbCols.includes('sr_status')) {
        // sr_status is integer. Do NOT set string 'Deleted'
      } else if (dbCols.includes('payment_status')) {
        statusColToUpdate = 'payment_status';
        statusValToUpdate = 33; // deleted
      } else if (dbCols.includes('invoice_status')) {
        statusColToUpdate = 'invoice_status';
        statusValToUpdate = 39; // deleted
      } else if (dbCols.includes('account_status')) {
        statusColToUpdate = 'account_status';
        statusValToUpdate = 20; // inactive
      } else if (dbCols.includes('subscription_status')) {
        statusColToUpdate = 'subscription_status';
        statusValToUpdate = 48; // canceled
      } else if (dbCols.includes('billing_status')) {
        statusColToUpdate = 'billing_status';
        statusValToUpdate = 43; // canceled
      } else if (dbCols.includes('status')) {
        statusColToUpdate = 'status';
        statusValToUpdate = 'Deleted';
      }

      if (statusColToUpdate && statusValToUpdate !== null) {
        query = `UPDATE "${tableName}" SET deleted_at = CURRENT_TIMESTAMP, "${statusColToUpdate}" = '${statusValToUpdate}' WHERE (${pk}::text = $1`;
      } else {
        query = `UPDATE "${tableName}" SET deleted_at = CURRENT_TIMESTAMP WHERE (${pk}::text = $1`;
      }
      if (hasIdCol && pk !== 'id') {
        query += ` OR id::text = $1`;
      }
      if (tableName === 'action_rules') {
        query += ` OR action_id = $1`;
      }
      query += `) AND deleted_at IS NULL RETURNING *`;
    } else {
      query = `DELETE FROM "${tableName}" WHERE (${pk}::text = $1`;
      if (hasIdCol && pk !== 'id') {
        query += ` OR id::text = $1`;
      }
      if (tableName === 'action_rules') {
        query += ` OR action_id = $1`;
      }
      query += `) RETURNING *`;
    }
    const delPool = getPoolForTable(tableName);
    const delClient = await delPool.connect();
    let result;
    try {
      await delClient.query('BEGIN');
      await delClient.query("SELECT set_config('app.current_user', $1, true)", [userEmployeeId || 'system']);
      result = await delClient.query(query, [id]);
      await delClient.query('COMMIT');
    } catch (delErr) {
      await delClient.query('ROLLBACK');
      throw delErr;
    } finally {
      delClient.release();
    }

    // Update target_table configuration log if this record is deleted under an active request
    if (result.rows.length > 0) {
      try {
        const activeConfigs = await pool.query(
          `SELECT t.target_table_id, t.log FROM target_table t
           JOIN request r ON t.request = r.request_id
           WHERE t.table_name = $1 AND $2 = ANY(t.record_ids) AND t.type = 'Delete' AND r.process_status = 8`,
          [tableName, id]
        );
        for (const row of activeConfigs.rows) {
          let currentLogs = [];
          try {
            currentLogs = typeof row.log === 'string' ? JSON.parse(row.log) : (Array.isArray(row.log) ? row.log : []);
          } catch (e) {
            currentLogs = [];
          }
          // Avoid duplicates
          currentLogs = currentLogs.filter(l => String(l.record_id) !== String(id));
          currentLogs.push({
            record_id: id,
            action: 'Delete',
            user: userEmployeeId,
            timestamp: new Date().toISOString()
          });
          await pool.query(
            `UPDATE target_table SET log = $1 WHERE target_table_id = $2`,
            [JSON.stringify(currentLogs), row.target_table_id]
          );
        }
      } catch (logErr) {
        console.error('[target_table delete logging error]', logErr);
      }
    }

    if (['action_rules', 'exception_rules', 'column_permissions'].includes(tableName)) {
      clearPermissionCache();
    }
    if (result.rows.length > 0) {
      broadcastSSE('db_change', { action: 'delete', table: tableName, id: id, record: result.rows[0] });
    }
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/table/:tableName/bulk-delete
router.post('/:tableName/bulk-delete', async (req, res) => {
  const { tableName } = req.params;
  if (tableName === 'cms_tenant_info') {
    return res.status(403).json({ error: 'Access denied: cms_tenant_info is read-only from the CRC app.' });
  }
  const user = getUserFromReq(req);
  const viewName = req.query.view || tableName;
  const isAllowed = await checkPermission('action_rules', `delete_${tableName}`, user, viewName);
  if (!isAllowed) {
    return res.status(403).json({ error: 'Access denied: You do not have permission to delete records.' });
  }

  const { ids, pk: customPk } = req.body;
  const pk = customPk || getPrimaryKey(tableName);
  const dbCols = await getTableColumns(tableName);
  if (customPk && !dbCols.includes(customPk)) {
    return res.status(400).json({ error: 'Invalid primary key column name' });
  }
  const hasIdCol = dbCols.includes('id');

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Expected an array of IDs' });
  }

  // Support hard delete in bulk delete
  if (req.query.hard === 'true') {
    const userRole = req.user && req.user.role ? req.user.role : '';
    const isSuperAdmin = userRole.toUpperCase() === 'SUPER ADMIN';
    if (!isSuperAdmin) {
      return res.status(403).json({ error: 'Access denied: Only Super Admin can perform permanent deletions.' });
    }
    const client = await getPoolForTable(tableName).connect();
    const userEmployeeId = user && user.employee_id ? user.employee_id : (req.user && req.user.employee_id ? req.user.employee_id : 'system');
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.current_user', $1, true)", [userEmployeeId]);
      const deletedRecords = [];
      for (const id of ids) {
        const result = await executeCascadeHardDelete(client, tableName, id);
        if (result.rows.length > 0) {
          deletedRecords.push(result.rows[0]);
        }
      }
      await client.query('COMMIT');
      if (['action_rules', 'exception_rules', 'column_permissions'].includes(tableName)) {
        clearPermissionCache();
      }
      for (const record of deletedRecords) {
        broadcastSSE('db_change', { action: 'delete', table: tableName, id: record[pk] || record.id || ids[0], record });
      }
      return res.json({ message: `Successfully permanently deleted ${ids.length} records from ${tableName}` });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Error in bulk hard delete:', err);
      return res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  }

  try {
    if (tableName === 'request') {
      const checkRes = await pool.query('SELECT request_id, sr_status FROM "request" WHERE request_id = ANY($1) AND deleted_at IS NULL', [ids]);
      const invalidRequests = checkRes.rows.filter(r => ![1, 6].includes(Number(r.sr_status)));
      if (invalidRequests.length > 0) {
        return res.status(400).json({
          error: 'Chỉ có thể xóa yêu cầu ở trạng thái Draft hoặc Cancelled.',
          details: invalidRequests.map(r => r.request_id)
        });
      }
    }
    if (tableName === 'payment') {
      const checkRes = await pool.query('SELECT payment_id, payment_status FROM "payment" WHERE payment_id = ANY($1) AND deleted_at IS NULL', [ids]);
      const invalidPayments = checkRes.rows.filter(r => Number(r.payment_status) !== 30);
      if (invalidPayments.length > 0) {
        return res.status(400).json({
          error: 'Chỉ có thể xóa thanh toán ở trạng thái Draft.',
          details: invalidPayments.map(r => r.payment_id)
        });
      }
    }
    let query;
    if (dbCols.includes('deleted_at')) {
      let statusColToUpdate = null;
      let statusValToUpdate = null;
      if (dbCols.includes('sr_status')) {
        // sr_status is integer. Soft delete uses deleted_at
      } else if (dbCols.includes('payment_status')) {
        statusColToUpdate = 'payment_status';
        statusValToUpdate = 33; // deleted
      } else if (dbCols.includes('invoice_status')) {
        statusColToUpdate = 'invoice_status';
        statusValToUpdate = 39; // deleted
      } else if (dbCols.includes('account_status')) {
        statusColToUpdate = 'account_status';
        statusValToUpdate = 20; // inactive
      } else if (dbCols.includes('subscription_status')) {
        statusColToUpdate = 'subscription_status';
        statusValToUpdate = 48; // canceled
      } else if (dbCols.includes('billing_status')) {
        statusColToUpdate = 'billing_status';
        statusValToUpdate = 43; // canceled
      } else if (dbCols.includes('status')) {
        statusColToUpdate = 'status';
        statusValToUpdate = 'Deleted';
      }

      if (statusColToUpdate && statusValToUpdate !== null) {
        query = `UPDATE "${tableName}" SET deleted_at = CURRENT_TIMESTAMP, "${statusColToUpdate}" = '${statusValToUpdate}' WHERE (${pk} = ANY($1)`;
      } else {
        query = `UPDATE "${tableName}" SET deleted_at = CURRENT_TIMESTAMP WHERE (${pk} = ANY($1)`;
      }
      if (hasIdCol && pk !== 'id') {
        query += ` OR id::text = ANY($1::text[])`;
      }
      query += `) AND deleted_at IS NULL`;
    } else {
      query = `DELETE FROM "${tableName}" WHERE ${pk} = ANY($1)`;
      if (hasIdCol && pk !== 'id') {
        query += ` OR id::text = ANY($1::text[])`;
      }
    }
    const userEmployeeId = user && user.employee_id ? user.employee_id : (req.user && req.user.employee_id ? req.user.employee_id : 'system');
    const bulkDelPool = getPoolForTable(tableName);
    const bulkDelClient = await bulkDelPool.connect();
    try {
      await bulkDelClient.query('BEGIN');
      await bulkDelClient.query("SELECT set_config('app.current_user', $1, true)", [userEmployeeId]);
      await bulkDelClient.query(query, [ids]);
      await bulkDelClient.query('COMMIT');
    } catch (bErr) {
      await bulkDelClient.query('ROLLBACK');
      throw bErr;
    } finally {
      bulkDelClient.release();
    }
    if (['action_rules', 'exception_rules', 'column_permissions'].includes(tableName)) {
      clearPermissionCache();
    }
    res.json({ message: `Successfully deleted ${ids.length} records from ${tableName}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function validateRequestTypeRestrictions(requesterEmail, requestType, client = pool) {
  return; // Bypass validation to make REQUESTER, MY COMPANY, and PROCESS TYPE independent
  if (!requestType) return;
  const policyRes = await client.query(
    `SELECT company_id, department_id, policy_name 
     FROM policy_and_program 
     WHERE policy_id::text = $1`,
    [requestType]
  );
  if (policyRes.rows.length === 0) return;
  const policy = policyRes.rows[0];
  const policyComp = policy.company_id;
  const policyDept = policy.department_id;
  if (!policyComp && !policyDept) return;
  const empRes = await client.query(
    `SELECT company_id, department_id, employee_id 
     FROM employee 
     WHERE LOWER(TRIM(email)) = LOWER(TRIM($1)) 
        OR LOWER(TRIM(employee_id)) = LOWER(TRIM($1)) 
        OR LOWER(TRIM(username)) = LOWER(TRIM($1))`,
    [requesterEmail]
  );
  if (empRes.rows.length === 0) {
    throw new Error(`Không tìm thấy thông tin nhân viên: ${requesterEmail}`);
  }
  const emp = empRes.rows[0];
  if (policyComp && String(policyComp).trim()) {
    if (!emp.company_id || String(emp.company_id).trim() !== String(policyComp).trim()) {
      throw new Error(`Nhân viên không thuộc công ty được cấu hình cho quy trình "${policy.policy_name}"`);
    }
  }
  if (policyDept && String(policyDept).trim()) {
    if (!emp.department_id || String(emp.department_id).trim() !== String(policyDept).trim()) {
      throw new Error(`Nhân viên không thuộc phòng ban được cấu hình cho quy trình "${policy.policy_name}"`);
    }
  }
}

async function validateRequestChildPermissions(tableName, requestId, userEmployeeId, userRole, client = pool) {
  const requestChildren = ['payment', 'invoice', 'service', 'asset', 'contract', 'expense', 'target_table'];
  if (!requestChildren.includes(tableName)) return;

  if (userRole && userRole.toUpperCase() === 'SUPER ADMIN') return;

  if (!requestId) {
    throw new Error('Yêu cầu ID Request để thực hiện thao tác trên bảng con.');
  }

  const res = await client.query(
    `SELECT sr_status, process_status, sr_creater, requester, sr_owner, policy_lead FROM request WHERE request_id = $1`,
    [requestId]
  );
  if (res.rows.length === 0) {
    throw new Error('Không tìm thấy Request tương ứng.');
  }

  const req = res.rows[0];
  enrichRecordWithStatusKeys('request', req);
  const srStatus = req.sr_status_key || String(req.sr_status || '').toLowerCase();
  const processStatus = req.process_status_key || String(req.process_status || '').toLowerCase();
  const email = (userEmployeeId || '').toLowerCase();

  const srOwnerArr = Array.isArray(req.sr_owner)
    ? req.sr_owner.map(s => s.toLowerCase())
    : (req.sr_owner ? [req.sr_owner.toLowerCase()] : []);
  const policyLead = (req.policy_lead || '').toLowerCase();
  const creator = (req.sr_creater || '').toLowerCase();
  const requester = (req.requester || '').toLowerCase();

  // For target_table: Allowed by Creator / Requester or SR Owner / Policy Lead at any stage
  if (tableName === 'target_table') {
    const isAuthorized = (email === creator || email === requester || srOwnerArr.includes(email) || email === policyLead);
    if (!isAuthorized) {
      throw new Error('Chỉ Người tạo (Requester), SR Owner hoặc Policy Lead mới được phép thao tác cấu hình Target Table.');
    }
    return;
  }

  const isDraftOrRejected = [1, 4].includes(Number(req.sr_status)) || srStatus === 'draft' || srStatus === 'rejected';
  const isProcessingOrCompleted = [8, 9].includes(Number(req.process_status)) || processStatus === 'processing' || processStatus === 'completed';

  const isDraftOwner = isDraftOrRejected && (email === creator || email === requester);
  const isProcessHandler = isProcessingOrCompleted && (srOwnerArr.includes(email) || email === policyLead);

  if (!isDraftOwner && !isProcessHandler) {
    throw new Error('Bảng con chỉ cho phép thao tác khi trạng thái Request là Draft/Rejected (bởi Người tạo) hoặc Processing/Completed (bởi Người xử lý/Policy Lead).');
  }
}

// POST /api/table/:tableName/:id/restore
router.post('/:tableName/:id/restore', async (req, res) => {
  const { tableName, id } = req.params;
  const user = getUserFromReq(req);
  if (!user.role || user.role.toUpperCase() !== 'SUPER ADMIN') {
    return res.status(403).json({ error: 'Access denied: Only Super Admin can restore records.' });
  }

  const pk = getPrimaryKey(tableName);
  const dbCols = await getTableColumns(tableName);
  const hasIdCol = dbCols.includes('id');

  if (!dbCols.includes('deleted_at')) {
    return res.status(400).json({ error: 'This table does not support soft-delete/restore.' });
  }

  try {
    let query;
    let statusColToUpdate = null;
    let restoreStatusVal = 'Draft';

    if (dbCols.includes('sr_status')) { statusColToUpdate = 'sr_status'; restoreStatusVal = getRestoreStatusVal(tableName, 'sr_status', 'Draft'); }
    else if (dbCols.includes('payment_status')) { statusColToUpdate = 'payment_status'; restoreStatusVal = getRestoreStatusVal(tableName, 'payment_status', 'Draft'); }
    else if (dbCols.includes('invoice_status')) { statusColToUpdate = 'invoice_status'; restoreStatusVal = getRestoreStatusVal(tableName, 'invoice_status', 'Draft'); }
    else if (dbCols.includes('account_status')) { statusColToUpdate = 'account_status'; restoreStatusVal = getRestoreStatusVal(tableName, 'account_status', 'Active'); }
    else if (dbCols.includes('status')) {
      statusColToUpdate = 'status';
      restoreStatusVal = getRestoreStatusVal(tableName, 'status', 'Active');
    }
    else if (dbCols.includes('subscription_status')) { statusColToUpdate = 'subscription_status'; restoreStatusVal = getRestoreStatusVal(tableName, 'subscription_status', 'Active'); }
    else if (dbCols.includes('billing_status')) { statusColToUpdate = 'billing_status'; restoreStatusVal = getRestoreStatusVal(tableName, 'billing_status', 'Active'); }

    if (statusColToUpdate) {
      query = `UPDATE "${tableName}" SET deleted_at = NULL, "${statusColToUpdate}" = '${restoreStatusVal}' WHERE (${pk}::text = $1`;
    } else {
      query = `UPDATE "${tableName}" SET deleted_at = NULL WHERE (${pk}::text = $1`;
    }
    if (hasIdCol && pk !== 'id') {
      query += ` OR id::text = $1`;
    }
    if (tableName === 'action_rules') {
      query += ` OR action_id = $1`;
    }
    query += `) AND deleted_at IS NOT NULL RETURNING *`;
    const userEmployeeId = user && user.employee_id ? user.employee_id : (req.user && req.user.employee_id ? req.user.employee_id : 'system');
    const resPool = getPoolForTable(tableName);
    const resClient = await resPool.connect();
    let result;
    try {
      await resClient.query('BEGIN');
      await resClient.query("SELECT set_config('app.current_user', $1, true)", [userEmployeeId]);
      result = await resClient.query(query, [id]);
      await resClient.query('COMMIT');
    } catch (rErr) {
      await resClient.query('ROLLBACK');
      throw rErr;
    } finally {
      resClient.release();
    }
    if (result.rows.length === 0) return res.status(404).json({ error: 'Record not found or already active' });

    broadcastSSE('db_change', { action: 'insert', table: tableName, id: id, record: result.rows[0] });
    res.json({ message: 'Restored successfully', record: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/table/:tableName/bulk-restore
router.post('/:tableName/bulk-restore', async (req, res) => {
  const { tableName } = req.params;
  const user = getUserFromReq(req);
  if (!user.role || user.role.toUpperCase() !== 'SUPER ADMIN') {
    return res.status(403).json({ error: 'Access denied: Only Super Admin can restore records.' });
  }

  const { ids, pk: customPk } = req.body;
  const pk = customPk || getPrimaryKey(tableName);
  const dbCols = await getTableColumns(tableName);
  if (customPk && !dbCols.includes(customPk)) {
    return res.status(400).json({ error: 'Invalid primary key column name' });
  }
  const hasIdCol = dbCols.includes('id');

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Expected an array of IDs' });
  }

  if (!dbCols.includes('deleted_at')) {
    return res.status(400).json({ error: 'This table does not support soft-delete/restore.' });
  }

  try {
    let query;
    let statusColToUpdate = null;
    let restoreStatusVal = 'Draft';

    if (dbCols.includes('sr_status')) { statusColToUpdate = 'sr_status'; restoreStatusVal = getRestoreStatusVal(tableName, 'sr_status', 'Draft'); }
    else if (dbCols.includes('payment_status')) { statusColToUpdate = 'payment_status'; restoreStatusVal = getRestoreStatusVal(tableName, 'payment_status', 'Draft'); }
    else if (dbCols.includes('invoice_status')) { statusColToUpdate = 'invoice_status'; restoreStatusVal = getRestoreStatusVal(tableName, 'invoice_status', 'Draft'); }
    else if (dbCols.includes('account_status')) { statusColToUpdate = 'account_status'; restoreStatusVal = getRestoreStatusVal(tableName, 'account_status', 'Active'); }
    else if (dbCols.includes('status')) {
      statusColToUpdate = 'status';
      restoreStatusVal = getRestoreStatusVal(tableName, 'status', 'Active');
    }
    else if (dbCols.includes('subscription_status')) { statusColToUpdate = 'subscription_status'; restoreStatusVal = getRestoreStatusVal(tableName, 'subscription_status', 'Active'); }
    else if (dbCols.includes('billing_status')) { statusColToUpdate = 'billing_status'; restoreStatusVal = getRestoreStatusVal(tableName, 'billing_status', 'Active'); }

    if (statusColToUpdate) {
      query = `UPDATE "${tableName}" SET deleted_at = NULL, "${statusColToUpdate}" = '${restoreStatusVal}' WHERE (${pk} = ANY($1)`;
    } else {
      query = `UPDATE "${tableName}" SET deleted_at = NULL WHERE (${pk} = ANY($1)`;
    }
    if (hasIdCol && pk !== 'id') {
      query += ` OR id::text = ANY($1::text[])`;
    }
    query += `) AND deleted_at IS NOT NULL RETURNING *`;
    const userEmployeeId = user && user.employee_id ? user.employee_id : (req.user && req.user.employee_id ? req.user.employee_id : 'system');
    const bulkResPool = getPoolForTable(tableName);
    const bulkResClient = await bulkResPool.connect();
    let result;
    try {
      await bulkResClient.query('BEGIN');
      await bulkResClient.query("SELECT set_config('app.current_user', $1, true)", [userEmployeeId]);
      result = await bulkResClient.query(query, [ids]);
      await bulkResClient.query('COMMIT');
    } catch (brErr) {
      await bulkResClient.query('ROLLBACK');
      throw brErr;
    } finally {
      bulkResClient.release();
    }

    // Broadcast for each restored record
    result.rows.forEach(row => {
      const idVal = row[pk] || row.id;
      broadcastSSE('db_change', { action: 'insert', table: tableName, id: idVal, record: row });
    });

    res.json({ message: `Successfully restored ${result.rows.length} records from ${tableName}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function maskTicketComments(rows) {
  if (!rows || rows.length === 0) return rows;
  const ticketIds = [...new Set(rows.map(r => r.ticket).filter(Boolean))];
  if (ticketIds.length === 0) return rows;
  try {
    const hPool = getHelpdeskPool();
    const ticketRes = await hPool.query(
      'SELECT ticket_id, requester, sr_creater FROM ticket WHERE ticket_id = ANY($1)',
      [ticketIds]
    );
    const ticketMap = {};
    ticketRes.rows.forEach(t => {
      ticketMap[t.ticket_id] = {
        requester: (t.requester || '').toLowerCase(),
        sr_creater: (t.sr_creater || '').toLowerCase()
      };
    });
    rows.forEach(r => {
      const isFromHelpdesk = r.logs && r.logs.origin === 'helpdesk';
      const tInfo = ticketMap[r.ticket];
      const author = (r.created_by || r.comment_by || '').toLowerCase();
      const shouldMask = isFromHelpdesk || (tInfo && author !== tInfo.requester && author !== tInfo.sr_creater && author !== 'it support');
      if (shouldMask) {
        if (r.comment_by) r.comment_by = 'IT support';
        if (r.created_by) r.created_by = 'IT support';
        if (r.updated_by) r.updated_by = 'IT support';
      }
    });
  } catch (e) {
    console.error('Error masking ticket comments:', e);
  }
  return rows;
}

router.cleanEmptyStringsForTable = cleanEmptyStringsForTable;
router.convertStatusFieldsToIds = convertStatusFieldsToIds;
router.calculateRequestFinanceSummary = calculateRequestFinanceSummary;

module.exports = router;

async function syncUploadedFiles(dbClient, tableName, recordId, columnName, procedureFileStr, uploadedBy) {
  let urls = [];
  try {
    if (procedureFileStr) {
      if (String(procedureFileStr).startsWith('[')) {
        urls = JSON.parse(procedureFileStr);
      } else {
        urls = String(procedureFileStr).split(',').map(s => s.trim()).filter(Boolean);
      }
    }
  } catch (e) {
    if (procedureFileStr) urls = [procedureFileStr];
  }

  // 1. Get current files in uploaded_files for this record
  const currentRes = await dbClient.query(
    `SELECT id, file_path FROM "uploaded_files" 
     WHERE table_name = $1 AND record_id = $2 AND column_name = $3 AND deleted_at IS NULL`,
    [tableName, recordId, columnName]
  );
  const currentFiles = currentRes.rows;

  // 2. Identify files to delete (present in DB but not in incoming urls)
  const filesToDelete = currentFiles.filter(f => !urls.includes(f.file_path));
  if (filesToDelete.length > 0) {
    const deleteIds = filesToDelete.map(f => f.id);
    await dbClient.query(
      `UPDATE "uploaded_files" SET deleted_at = NOW() WHERE id = ANY($1::uuid[])`,
      [deleteIds]
    );
  }

  // Helper mapping extension to mime-type
  const extToMime = {
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'txt': 'text/plain',
    'zip': 'application/zip'
  };

  // 3. Insert new files (present in incoming urls but not in DB)
  const existingPaths = currentFiles.map(f => f.file_path);
  for (const url of urls) {
    if (!existingPaths.includes(url)) {
      const rawFilename = url.split('/').pop().split('?')[0];
      let decodedFilename = rawFilename;
      try { decodedFilename = decodeURIComponent(rawFilename); } catch (e) {}
      const cleanDisplayName = decodedFilename.replace(/^upload_\d+(_\d+)?_/i, '').replace(/^[a-zA-Z0-9_-]+_\d{10,}(_\d+)?_/i, '') || decodedFilename;
      const ext = rawFilename.split('.').pop().toLowerCase();
      const mimeType = extToMime[ext] || 'application/octet-stream';
      await dbClient.query(
        `INSERT INTO "uploaded_files" (id, table_name, record_id, column_name, file_name, mime_type, file_path, uploaded_by)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)`,
        [tableName, recordId, columnName, cleanDisplayName, mimeType, url, uploadedBy]
      );
    }
  }
}
