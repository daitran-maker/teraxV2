/**
 * CRC App - Core UI Helpers, Formatting & Modal Handlers
 * Extracted as part of Modularization
 */


/* ============================================================
   CRC APP - Main JavaScript Application
   ============================================================ */

const API_BASE = '/api';

window.onerror = function (message, source, lineno, colno, error) {
  console.error('[CRITICAL ONERROR]', { message, source, lineno, colno, error });
};
window.addEventListener('unhandledrejection', function (event) {
  console.error('[CRITICAL UNHANDLED REJECTION]', event.reason);
});

// --- Debounce Helper ---
function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

const SERVER_SEARCH_MODULES = new Set(['employee', 'employee_active', 'payment', 'expense', 'invoice', 'request', 'service', 'asset', 'mtr', 'account', 'request_activity_log', 'finance', 'contract', 'action_rules']);

function isServerSearchModule(moduleKey) {
  return SERVER_SEARCH_MODULES.has(moduleKey);
}

function sortFilterEntries(filterModuleKey, filterKey, entries) {
  if (filterKey === 'fy' || filterKey === 'fy_recognized' || filterKey === 'fy_target_closed_date') {
    return entries.sort(([a], [b]) => {
      const isANa = !a || a === 'N/A' || a === 'Unknown';
      const isBNa = !b || b === 'N/A' || b === 'Unknown';
      if (isANa && !isBNa) return 1;
      if (!isANa && isBNa) return -1;
      if (isANa && isBNa) return 0;

      const numA = parseInt(String(a).match(/\d+/)?.[0] || '0', 10);
      const numB = parseInt(String(b).match(/\d+/)?.[0] || '0', 10);
      if (numA !== numB) return numB - numA;
      return String(b).localeCompare(String(a), undefined, { numeric: true, sensitivity: 'base' });
    });
  }

  if (filterKey === 'quarter_by_closed_date') {
    return entries.sort(([a], [b]) => String(a).localeCompare(String(b)));
  }

  // Sort by count descending. If counts are equal, sort alphabetically
  return entries.sort((a, b) => {
    const countA = a[1];
    const countB = b[1];
    if (countB !== countA) return countB - countA;
    return String(a[0]).localeCompare(String(b[0]), undefined, { numeric: true, sensitivity: 'base' });
  });
}
window.sortFilterEntries = sortFilterEntries;

const QUICK_MENU_MODULES = ['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team', 'contract', 'invoice', 'payment', 'expense', 'asset', 'service'];

function isColumnPinned(moduleKey, columnKey) {
  if (!moduleKey || !columnKey) return false;
  if (['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team', 'request'].includes(moduleKey) && columnKey === 'description') return true;
  if (moduleKey === 'expense' && columnKey === 'description') return true;
  if ((moduleKey === 'employee' || moduleKey === 'employee_active') && columnKey === 'full_name') return true;
  if (moduleKey === 'payment' && columnKey === 'payment_description') return true;
  if (moduleKey === 'contract' && (columnKey === 'contract_label' || columnKey === 'contract_name_or_description')) return true;
  if (moduleKey === 'invoice' && columnKey === 'invoice_no') return true;
  if (moduleKey === 'finance' && columnKey === 'process') return true;
  const leftPinnedColumns = {
    account: 'account_name',
    service: 'service_name',
    asset: 'asset_name',
    policy: 'policy_name',
    oppotunity: 'project_label',
    opportunity: 'project_label',
    finance: 'process',
    expense: 'description'
  };
  return leftPinnedColumns[moduleKey] === columnKey;
}

function getStickyTableColumnStyle(moduleKey, columnKey, isHeader, mod = null) {
  // Disable column pinning on mobile screens <= 768px
  if (typeof window !== 'undefined' && window.innerWidth <= 768) {
    return '';
  }
  const background = isHeader ? '#F8FAFC' : '#ffffff';
  const zIndex = isHeader ? 25 : 10;
  const topStyle = isHeader ? 'top: 0;' : '';

  const hasCheckbox = ['permissions', 'exception_rules', 'action_rules', 'contract', 'request', 'payment', 'invoice', 'my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(moduleKey);
  const hasQuickMenu = QUICK_MENU_MODULES.includes(moduleKey);
  const hasRowActions = mod && mod.hasRowActions;

  let leadingOffset = 0;
  if (hasCheckbox) leadingOffset += 40;
  if (hasQuickMenu) leadingOffset += 45;
  if (hasRowActions && moduleKey === 'finance') leadingOffset += 70;

  if (['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team', 'request'].includes(moduleKey) && columnKey === 'description') {
    return `position: sticky; ${topStyle} left: ${leadingOffset}px; background: ${background}; z-index: ${zIndex}; border-right: 1px solid #E2E8F0; width: 320px; min-width: 320px; max-width: 320px;${isHeader ? '' : ' white-space: nowrap; overflow: hidden; text-overflow: ellipsis;'}`;
  }

  if (moduleKey === 'expense' && columnKey === 'description') {
    return `position: sticky; ${topStyle} left: ${leadingOffset}px; background: ${background}; z-index: ${zIndex}; border-right: 1px solid #E2E8F0; width: 300px; min-width: 300px; max-width: 300px;${isHeader ? '' : ' white-space: nowrap; overflow: hidden; text-overflow: ellipsis;'}`;
  }

  if ((moduleKey === 'employee' || moduleKey === 'employee_active') && columnKey === 'full_name') {
    return `position: sticky; ${topStyle} left: ${leadingOffset}px; background: ${background}; z-index: ${zIndex}; border-right: 1px solid #E2E8F0; width: 240px; min-width: 240px; max-width: 240px;`;
  }

  if (moduleKey === 'payment' && columnKey === 'payment_description') {
    return `position: sticky; ${topStyle} left: ${leadingOffset}px; background: ${background}; z-index: ${zIndex}; border-right: 1px solid #E2E8F0; width: 395px; min-width: 395px; max-width: 395px;${isHeader ? '' : ' white-space: nowrap; overflow: hidden; text-overflow: ellipsis;'}`;
  }

  if (moduleKey === 'contract' && (columnKey === 'contract_label' || columnKey === 'contract_name_or_description')) {
    return `position: sticky; ${topStyle} left: ${leadingOffset}px; background: ${background}; z-index: ${zIndex}; border-right: 1px solid #E2E8F0; width: 320px; min-width: 320px; max-width: 320px;${isHeader ? '' : ' white-space: nowrap; overflow: hidden; text-overflow: ellipsis;'}`;
  }

  if (moduleKey === 'invoice' && columnKey === 'invoice_no') {
    return `position: sticky; ${topStyle} left: ${leadingOffset}px; background: ${background}; z-index: ${zIndex}; border-right: 1px solid #E2E8F0; width: 200px; min-width: 200px; max-width: 200px;`;
  }

  if (moduleKey === 'finance' && columnKey === 'process') {
    return `position: sticky; ${topStyle} left: ${leadingOffset}px; background: ${background}; z-index: ${zIndex}; border-right: 1px solid #E2E8F0; width: 240px; min-width: 240px; max-width: 240px;`;
  }

  const leftPinnedColumns = {
    account: 'account_name',
    service: 'service_name',
    asset: 'asset_name',
    policy: 'policy_name',
    oppotunity: 'project_label',
    opportunity: 'project_label',
    expense: 'description'
  };
  if (leftPinnedColumns[moduleKey] === columnKey) {
    let widthStyle = '';
    if (moduleKey === 'service') widthStyle = ' width: 240px; min-width: 240px; max-width: 240px;';
    else if (moduleKey === 'asset') widthStyle = ' width: 220px; min-width: 220px; max-width: 220px;';
    return `position: sticky; ${topStyle} left: ${leadingOffset}px; background: ${background}; z-index: ${zIndex}; border-right: 1px solid #E2E8F0;${widthStyle}${isHeader ? '' : ' white-space: nowrap; overflow: hidden; text-overflow: ellipsis;'}`;
  }

  return '';
}

// --- Authentication Check ---
if (window.location.hash.includes('token=')) {
  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  const token = hashParams.get('token');
  if (token) {
    localStorage.setItem('crc_token', token);
    const userParam = hashParams.get('user');
    if (userParam) {
      try {
        localStorage.setItem('crc_user', decodeURIComponent(userParam));
      } catch (e) { }
    }
    // Clean the hash from the URL to keep it clean
    window.history.replaceState(null, null, window.location.pathname + window.location.search);
  }
}

if (!localStorage.getItem('crc_token')) {
  window.location.href = '/login.html';
}
const authUser = JSON.parse(localStorage.getItem('crc_user') || '{}');

function logout() {
  localStorage.removeItem('crc_token');
  localStorage.removeItem('crc_user');
  window.location.href = '/login.html';
}

// User Switcher extracted to js/components/userSwitcher.js

// Table Column Resizing Handler
(function() {
  let startX, startWidth, thEl;

  document.addEventListener('mousedown', function(e) {
    if (e.target.classList.contains('col-resizer')) {
      thEl = e.target.parentElement;
      startX = e.pageX;
      startWidth = thEl.offsetWidth;
      
      e.target.classList.add('resizing');
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      e.preventDefault();
    }
  });

  window.initStickyOffsets = function(moduleKeyOrTable) {
    let table = null;
    if (typeof moduleKeyOrTable === 'string') {
      table = document.querySelector(`#view-${moduleKeyOrTable} table.data-table`) || document.querySelector(`#view-${moduleKeyOrTable} table`);
    } else if (moduleKeyOrTable instanceof HTMLElement) {
      table = moduleKeyOrTable.tagName.toLowerCase() === 'table' ? moduleKeyOrTable : moduleKeyOrTable.querySelector('table');
    }
    if (!table) return;

    if (window.innerWidth <= 768) {
      // Mobile view: Remove all horizontal sticky left offsets
      const allCells = table.querySelectorAll('th, td');
      allCells.forEach(cell => {
        if (cell.classList.contains('col-pinned') || cell.classList.contains('request-row-menu-cell') || cell.classList.contains('row-actions') || cell.classList.contains('row-bulk-checkbox-cell')) {
          cell.style.removeProperty('left');
          if (cell.tagName.toLowerCase() === 'td') {
            cell.style.removeProperty('position');
            cell.style.removeProperty('z-index');
          }
        }
      });
      return;
    }

    const headerRow = table.querySelector('thead tr.header-row') || table.querySelector('thead tr') || table.querySelector('tr');
    if (!headerRow) return;

    const headerCells = Array.from(headerRow.cells);
    const pinnedColOffsets = {};

    // 1. Batch Read Pass
    const cellInfos = headerCells.map((th) => {
      const isCheckbox = th.querySelector('input[type="checkbox"]') !== null || th.classList.contains('row-bulk-checkbox-cell');
      const isMenu = th.classList.contains('request-row-menu-cell');
      const isAction = th.classList.contains('row-actions') || th.classList.contains('col-row-actions');
      const isExplicitPinned = th.classList.contains('col-pinned') || (th.style.position === 'sticky' && th.style.left !== '');
      const isPinned = isCheckbox || isMenu || isAction || isExplicitPinned;

      let cellW = 0;
      if (isPinned) {
        cellW = th.offsetWidth;
        if (!cellW || cellW === 0) {
          if (isCheckbox) cellW = 40;
          else if (isMenu) cellW = 45;
          else if (isAction) cellW = 70;
          else cellW = parseInt(th.style.width || th.style.minWidth || '150', 10) || 150;
        }
      }
      return { th, isPinned, cellW };
    });

    // Calculate offsets
    let accumLeft = 0;
    cellInfos.forEach((info, idx) => {
      if (info.isPinned) {
        pinnedColOffsets[idx] = accumLeft;
        accumLeft += info.cellW;
      }
    });

    // 2. Batch Write Pass for Header
    cellInfos.forEach((info, idx) => {
      const th = info.th;
      if (info.isPinned) {
        const leftVal = pinnedColOffsets[idx] + 'px';
        if (th.style.left !== leftVal) {
          th.classList.add('col-pinned');
          th.style.setProperty('position', 'sticky', 'important');
          th.style.setProperty('top', '0px', 'important');
          th.style.setProperty('left', leftVal, 'important');
          th.style.setProperty('z-index', '25', 'important');
          th.style.setProperty('background', '#F8FAFC', 'important');
        }
      } else {
        if (th.classList.contains('col-pinned') || th.style.left) {
          th.classList.remove('col-pinned');
          th.style.removeProperty('left');
          th.style.setProperty('z-index', '11', 'important');
        }
      }
    });

    // 3. Batch Write Pass for Body
    const tbodyRows = table.querySelectorAll('tbody tr');
    tbodyRows.forEach(row => {
      const cells = Array.from(row.cells);
      cells.forEach((cell, idx) => {
        if (pinnedColOffsets[idx] !== undefined) {
          const leftVal = pinnedColOffsets[idx] + 'px';
          if (cell.style.left !== leftVal) {
            cell.classList.add('col-pinned');
            cell.style.setProperty('position', 'sticky', 'important');
            cell.style.setProperty('left', leftVal, 'important');
            cell.style.setProperty('z-index', '10', 'important');
            cell.style.setProperty('background', '#FFFFFF');
          }
        } else {
          if (cell.classList.contains('col-pinned') || cell.style.left) {
            cell.classList.remove('col-pinned');
            cell.style.removeProperty('left');
            cell.style.removeProperty('position');
            cell.style.removeProperty('z-index');
          }
        }
      });
    });
  };

  // Re-calculate sticky offsets on viewport resize
  window.addEventListener('resize', debounce(() => {
    if (typeof currentModule !== 'undefined' && currentModule) {
      if (typeof initStickyOffsets === 'function') initStickyOffsets(currentModule);
    }
  }, 150));

  // Toggle .is-scrolled on .table-wrapper to show header shadow when scrolled
  document.addEventListener('scroll', function(e) {
    const wrapper = e.target;
    if (wrapper && wrapper.classList && wrapper.classList.contains('table-wrapper')) {
      if (wrapper.scrollTop > 2) {
        wrapper.classList.add('is-scrolled');
      } else {
        wrapper.classList.remove('is-scrolled');
      }
    }
  }, true);

  function onMouseMove(e) {
    if (!thEl) return;
    const deltaX = e.pageX - startX;
    const newWidth = Math.max(50, startWidth + deltaX);
    
    const table = thEl.closest('table');
    const colClass = Array.from(thEl.classList).find(c => c.startsWith('col-'));
    if (colClass) {
      if (table) {
        const cells = table.querySelectorAll(`.${colClass}`);
        cells.forEach(cell => {
          cell.style.width = newWidth + 'px';
          cell.style.minWidth = newWidth + 'px';
          cell.style.maxWidth = newWidth + 'px';
        });
      }
    } else {
      thEl.style.width = newWidth + 'px';
      thEl.style.minWidth = newWidth + 'px';
      thEl.style.maxWidth = newWidth + 'px';
    }

    if (table) {
      window.initStickyOffsets(table);
    }
  }

  function onMouseUp(e) {
    const resizer = document.querySelector('.col-resizer.resizing');
    if (resizer) resizer.classList.remove('resizing');
    
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    thEl = null;
  }
})();

function redirectToAccessDenied() {
  const returnTo = window.location.hash || '';
  window.location.href = `/access-denied.html?returnTo=${encodeURIComponent(returnTo)}`;
}

function isAccessDeniedError(err) {
  const msg = String(err && err.message ? err.message : err || '').toLowerCase();
  return msg.includes('access denied') ||
    msg.includes('permission') ||
    msg.includes('403');
}

// ============================================================
// MODULE CONFIGURATION (Now loaded dynamically from config.js for better architecture)
// ============================================================

// ============================================================
// STATE
// ============================================================
let currentModule = null;
let currentView = 'table'; // 'table' | 'detail'
let currentRecord = null;
let currentData = [];
let selectCache = {};
let selectedIds = new Set();
let currentSearch = '';
let inFlightSelectRequests = {};
let currentTableTotal = 0;
let currentTableLimit = 50;
let currentTablePage = 1;
let currentTableSummary = null;
let currentFacetedSummary = null;
let originalFacetedSummary = {}; // cache for full unfiltered faceted summary
let originalClientData = {};   // cache for full unfiltered client-side data (for filter count preservation)
let moduleStates = {};
let companyTypeCounts = {};

// --- Active Base Currency Helper for Dynamic labels (with memoized caching) ---
let lastCurrencyCache = { key: null, value: 'VND' };
window.getActiveBaseCurrency = function () {
  // Build a unique cache key based on the current state parameters
  const modKey = typeof currentModule !== 'undefined' ? currentModule : '';
  const viewKey = typeof currentView !== 'undefined' ? currentView : 'table';
  const filterVal = (modKey && typeof activeDropdownFilters !== 'undefined' && activeDropdownFilters[modKey] && activeDropdownFilters[modKey]['my_company'])
    ? Array.from(activeDropdownFilters[modKey]['my_company'])[0]
    : '';
  const recordId = (viewKey === 'detail' && typeof currentRecord !== 'undefined' && currentRecord)
    ? (currentRecord.my_company_id || currentRecord.company_id || currentRecord.company_entity || currentRecord.id__my_company)
    : '';
  const firstRowId = (typeof currentData !== 'undefined' && Array.isArray(currentData) && currentData.length > 0)
    ? (currentData[0].my_company_id || currentData[0].company_id || currentData[0].company_entity || currentData[0].id__my_company)
    : '';
  const tenantCurr = (window.cmsTenantInfo && window.cmsTenantInfo.base_currency) || '';

  const stateKey = `${modKey}_${viewKey}_${recordId}_${filterVal}_${firstRowId}_${tenantCurr}`;
  if (lastCurrencyCache.key === stateKey) {
    return lastCurrencyCache.value;
  }

  let resolvedCurrency = null;

  // 1. If currently viewing a detail record
  if (viewKey === 'detail' && typeof currentRecord !== 'undefined' && currentRecord) {
    const record = currentRecord;
    if (modKey === 'my_company' && record.base_currency) {
      resolvedCurrency = record.base_currency;
    } else if (selectCache && selectCache['my_company']) {
      let compId = record.my_company_id || record.company_id || record.company_entity || record.id__my_company;
      if (!compId && record.requester && selectCache['employee']) {
        const emp = selectCache['employee'].find(e => e.email === record.requester || e.employee_id === record.requester);
        if (emp) compId = emp.company_id;
      }
      if (!compId && record.request_type && selectCache['policy']) {
        const pol = selectCache['policy'].find(p => p.policy_name === record.request_type || p.policy_id === record.request_type);
        if (pol) compId = pol.company_id;
      }
      if (compId) {
        const comp = selectCache['my_company'].find(c =>
          String(c.my_company_id) === String(compId) ||
          c.company_shortname === compId
        );
        if (comp && comp.base_currency) resolvedCurrency = comp.base_currency;
      }
    }
  }

  // 2. Check active sidebar filters
  if (!resolvedCurrency && modKey && typeof activeDropdownFilters !== 'undefined' && activeDropdownFilters[modKey] && selectCache && selectCache['my_company']) {
    const companyFilter = activeDropdownFilters[modKey]['my_company'];
    if (companyFilter && companyFilter.size > 0) {
      const filterValStr = Array.from(companyFilter)[0];
      const comp = selectCache['my_company'].find(c =>
        String(c.my_company_id) === String(filterValStr) ||
        c.company_shortname === filterValStr ||
        c.company_fullname === filterValStr
      );
      if (comp && comp.base_currency) resolvedCurrency = comp.base_currency;
    }
  }

  // 3. Check current data rows
  if (!resolvedCurrency && typeof currentData !== 'undefined' && Array.isArray(currentData) && currentData.length > 0 && selectCache && selectCache['my_company']) {
    const firstRow = currentData[0];
    const compId = firstRow.my_company_id || firstRow.company_id || firstRow.company_entity || firstRow.id__my_company;
    if (compId) {
      const comp = selectCache['my_company'].find(c =>
        String(c.my_company_id) === String(compId) ||
        c.company_shortname === compId
      );
      if (comp && comp.base_currency) resolvedCurrency = comp.base_currency;
    }
  }

  // 4. Check authUser company
  if (!resolvedCurrency && typeof authUser !== 'undefined' && authUser && authUser.company_id && selectCache && selectCache['my_company']) {
    const comp = selectCache['my_company'].find(c => String(c.my_company_id) === String(authUser.company_id) || c.company_shortname === authUser.company_id);
    if (comp && comp.base_currency) resolvedCurrency = comp.base_currency;
  }

  // 5. Check cmsTenantInfo (from CMS subscription view)
  if (!resolvedCurrency && window.cmsTenantInfo && window.cmsTenantInfo.base_currency) {
    resolvedCurrency = window.cmsTenantInfo.base_currency;
  }

  // 6. First company in selectCache
  if (!resolvedCurrency && selectCache && selectCache['my_company'] && selectCache['my_company'].length > 0) {
    const firstComp = selectCache['my_company'].find(c => c.base_currency);
    if (firstComp && firstComp.base_currency) resolvedCurrency = firstComp.base_currency;
  }

  // 7. Ultimate fallback: 'VND'
  if (!resolvedCurrency || resolvedCurrency === 'Base Currency') {
    resolvedCurrency = 'VND';
  }

  lastCurrencyCache.key = stateKey;
  lastCurrencyCache.value = resolvedCurrency;
  return resolvedCurrency;
};

// Helper to escape HTML to prevent XSS
function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Helper to handle PostgreSQL bytea Buffer objects sent as JSON
function parseBufferVal(val) {
  if (val && typeof val === 'object' && val.type === 'Buffer' && Array.isArray(val.data)) {
    // Chunk processing to avoid "Maximum call stack size exceeded" on large base64 buffers
    let str = "";
    const chunk = 8192;
    for (let i = 0; i < val.data.length; i += chunk) {
      str += String.fromCharCode.apply(null, val.data.slice(i, i + chunk));
    }
    return str;
  }
  return val;
}

// ============================================================
// API HELPERS
// ============================================================
async function apiFetch(endpoint, method = 'GET', body = null) {
  const token = localStorage.getItem('crc_token');
  const user = localStorage.getItem('crc_user'); // JSON string

  const headers = {
    'Content-Type': 'application/json'
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(API_BASE + endpoint, {
    method,
    headers,
    cache: 'no-store',
    body: body ? JSON.stringify(body) : null
  });

  const text = await res.text();

  if (res.status === 401) {
    localStorage.removeItem('crc_token');
    window.location.href = '/login.html';
    return;
  }

  let json = null;
  let isJson = false;
  try {
    json = JSON.parse(text);
    isJson = true;
  } catch (parseErr) {
    isJson = false;
  }

  if (isJson) {
    if (res.status === 403) {
      const msg = json.error_code ? (typeof t === 'function' ? t(json.error_code, json.error) : json.error) : (json.error || 'Access denied (403)');
      throw new Error(msg);
    }
    if (!res.ok) {
      let msg = json.error_code ? (typeof t === 'function' ? t(json.error_code, json.error) : json.error) : (json.error || 'Request failed');
      if (json.details) {
        let detailStr = '';
        if (Array.isArray(json.details)) {
          detailStr = json.details.map(d => typeof d === 'string' ? d : `${d.field ? d.field + ': ' : ''}${d.message || d.error || JSON.stringify(d)}`).join(', ');
        } else if (typeof json.details === 'string') {
          detailStr = json.details;
        } else if (typeof json.details === 'object') {
          detailStr = Object.entries(json.details).map(([k, v]) => `${k}: ${v}`).join(', ');
        }
        if (detailStr) {
          msg = `${msg}: ${detailStr}`;
        }
      }
      throw new Error(msg);
    }
    return json;
  } else {
    if (res.status === 403) {
      throw new Error('Access denied (403): You do not have permission to perform this action.');
    }
    if (!res.ok) {
      const errorSnippet = text.length > 150 ? text.substring(0, 150) + '...' : text;
      throw new Error(`Server returned error ${res.status}: ${errorSnippet || 'Unknown error'}`);
    }
    throw new Error('Server returned invalid data format. Please check Console.');
  }
}

async function apiGet(path) { return apiFetch(path); }
async function apiPost(path, body) { return apiFetch(path, 'POST', body); }
async function apiPut(path, body) { return apiFetch(path, 'PUT', body); }
async function apiDelete(path) { return apiFetch(path, 'DELETE'); }

function getRecordEndpoint(moduleKey, pkVal, withParams = true) {
  const mod = MODULES[moduleKey];
  if (!mod) return '';
  if (moduleKey === 'permissions') {
    return `/permissions/column-permissions/${pkVal}`;
  }
  let endpoint = mod.endpoint;
  if (endpoint.startsWith('/my-views/') && moduleKey !== 'request_activity_log') {
    endpoint = `/table/${mod.writeTable || 'request'}`;
  }
  let path = `${endpoint}/${pkVal}`;
  if (withParams && mod.pk) {
    path += `?pk=${mod.pk}`;
  }
  const hashModule = window.location.hash.replace('#', '').split('/')[0];
  if (moduleKey === 'request' && ['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(hashModule)) {
    path += (path.includes('?') ? '&' : '?') + `view=${hashModule}`;
  }
  return path;
}

// ============================================================
// TOAST NOTIFICATIONS
// ============================================================
function showToast(msg, type = 'info', title = null, requireHoverToDismiss = false) {
  const icons = { success: 'check_circle', error: 'warning', warning: 'warning', info: 'info' };
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.style.boxShadow = '0 10px 30px rgba(0,0,0,0.1)';

  if (title) {
    toast.innerHTML = `
      <div style="display:flex; align-items:flex-start; gap:14px;">
        <span class="material-symbols-rounded" style="font-size:23px; color:#fff; margin-top:2px;">${icons[type] || 'info'}</span>
        <div style="display:flex; flex-direction:column; gap:6px; max-width: 320px;">
          <strong style="font-size:14px; color:#fff; line-height: 1.3;">${title}</strong>
          <span style="font-size:12px; color:rgba(255,255,255,0.9); line-height: 1.5; word-wrap: break-word;">${msg}</span>
        </div>
      </div>
    `;
    toast.style.padding = '20px 24px';
    toast.style.background = 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)';
    toast.style.border = 'none';
    toast.style.boxShadow = '0 15px 40px rgba(234, 88, 12, 0.4)';
    toast.style.color = '#fff';
  } else {
    toast.innerHTML = `<span class="material-symbols-rounded" style="font-size:18px; color:inherit;">${icons[type] || 'info'}</span><span>${msg}</span>`;
  }

  container.appendChild(toast);

  let dismissTimeout;
  const fadeOut = () => {
    toast.style.animation = 'fadeOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  };

  if (requireHoverToDismiss) {
    let hasHovered = false;
    toast.style.cursor = 'pointer';
    toast.addEventListener('mouseenter', () => {
      hasHovered = true;
    });
    toast.addEventListener('mouseleave', () => {
      if (hasHovered) fadeOut();
    });
    toast.addEventListener('click', () => {
      fadeOut();
    });
    // No timeout! It will stay indefinitely until hovered.
  } else {
    dismissTimeout = setTimeout(fadeOut, 3000);
  }
}

function showAlert(msg, type = 'success', title = 'Done!') {
  const icons = { success: 'check_circle', error: 'warning', warning: 'warning', info: 'info' };
  const iconEl = document.getElementById('alert-icon');
  if (iconEl) {
    iconEl.textContent = icons[type] || 'info';
    iconEl.style.color = type === 'success' ? 'var(--accent)' : 'var(--accent-red)';
  }

  const titleEl = document.getElementById('alert-title');
  if (titleEl) titleEl.textContent = title;

  const msgEl = document.getElementById('alert-message');
  if (msgEl) msgEl.textContent = msg;

  openModal('alert-modal');
}

window.getFormattedRequestCode = function (record) {
  if (!record) return '';
  const reqNum = record.request_id || '';

  // If the request_id is already formatted (contains dashes and is not a UUID)
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reqNum);
  if (reqNum.includes('-') && !isUUID) {
    return reqNum;
  }

  const processCode = record.request_type || '';

  let dateStr = '';
  if (record.sr_submitted_date) {
    const d = new Date(record.sr_submitted_date);
    if (!isNaN(d.getTime())) {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yy = String(d.getFullYear()).slice(-2);
      dateStr = `${dd}${mm}${yy}`;
    }
  }
  if (!dateStr) {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    dateStr = `${dd}${mm}${yy}`;
  }

  let reqPrefix = '';
  const requesterEmail = record.requester || '';
  if (requesterEmail) {
    const prefix = requesterEmail.split('@')[0];
    reqPrefix = prefix.slice(0, 2).toUpperCase();
  }

  // [Process]-[ddmmyy]-[2 chars requester]-[request_id]
  return `${processCode}-${dateStr}-${reqPrefix}-${reqNum}`;
};

function truncateFileName(fileName, maxLen = 30) {
  if (!fileName || typeof fileName !== 'string') return fileName || '';
  if (fileName.length <= maxLen) return fileName;
  const lastDot = fileName.lastIndexOf('.');
  const ext = (lastDot !== -1 && lastDot > fileName.length - 8) ? fileName.substring(lastDot) : '';
  const nameWithoutExt = ext ? fileName.substring(0, lastDot) : fileName;
  const availableLen = maxLen - ext.length - 3;
  if (availableLen <= 4) {
    return fileName.substring(0, maxLen - 3) + '...';
  }
  const frontLen = Math.ceil(availableLen * 0.65);
  const backLen = Math.floor(availableLen * 0.35);
  return `${nameWithoutExt.substring(0, frontLen)}...${nameWithoutExt.slice(-backLen)}${ext}`;
}
window.truncateFileName = truncateFileName;

function formatFileNameDisplay(val, maxLen = 30) {
  if (!val) return '';
  if (typeof val !== 'string') return String(val);
  if (val.startsWith('data:')) return 'Attached File';
  let raw = val.split('/').pop().split('?')[0];
  try { raw = decodeURIComponent(raw); } catch (e) {}
  // Strip upload timestamp prefix: upload_<id>_<name> or upload_<timestamp>_<name>
  let cleanName = raw.replace(/^upload_\d+(_\d+)?_/i, '');
  if (cleanName === raw) {
    // Strip other table/key prefix: e.g. comment_file_<timestamp>_<random>_<name> or any prefix with timestamp
    cleanName = raw.replace(/^[a-zA-Z0-9_-]+_\d{10,}(_\d+)?_/i, '');
  }
  const finalName = cleanName || raw || 'Attachment';
  return truncateFileName(finalName, maxLen);
}

window.getBadgeStyles = function (status, customColor) {
  const idToKey = {
    '1': 'draft', '2': 'pending_approval', '3': 'approved', '4': 'rejected', '5': 'closed', '6': 'cancelled',
    '7': 'not_started', '8': 'processing', '9': 'completed',
    '10': 'draft', '11': 'pending', '12': 'in_progress', '13': 'completed',
    '14': 'not_started', '15': 'processing', '16': 'completed',
    '17': 'active', '18': 'inactive',
    '19': 'active', '20': 'inactive',
    '21': 'failured', '22': 'in_used', '23': 'no_used',
    '26': 'not_started_yet', '27': 'on_going', '28': 'going_to_expired', '29': 'expired',
    '30': 'draft', '31': 'ready_for_payment', '32': 'paid', '33': 'deleted',
    '34': 'draft', '35': 'ready_to_issue', '36': 'issued', '37': 'paid', '38': 'void', '39': 'deleted',
    '40': 'active', '41': 'grace', '42': 'expired', '43': 'canceled', '44': 'inactive',
    '45': 'active', '46': 'grace', '47': 'expired', '48': 'canceled', '49': 'inactive',
    '50': 'active', '51': 'inactive',
    '52': 'open', '53': 'closed_won', '54': 'closed_lost',
    '55': 'draft', '56': 'approved',
    '57': 'active', '58': 'inactive',
    '60': 'incoming', '61': 'outgoing',
    '62': 'not_started', '63': 'processing', '64': 'completed',
    '65': 'pending', '66': 'completed',
    '67': 'active', '68': 'inactive',
    '69': 'selling', '70': 'buying', '71': 'internal',
    '117': 'canceled', '118': 'cancelled', '119': 'cancelled', '120': 'draft'
  };
  const mappedStatus = idToKey[String(status)] || status;
  const hex = (customColor && String(customColor).startsWith('#')) ? customColor
    : (typeof mappedStatus === 'string' && mappedStatus.startsWith('#')) ? mappedStatus : null;
  if (hex) {
    return `background: ${hex}15; color: ${hex}; border: 1px solid ${hex}33;`;
  }
  const s = String(mappedStatus || '').toLowerCase().trim();
  if (['active', 'approved', 'completed', 'ready for payment', 'ready to issue', 'issued', 'paid', 'yes', 'true', 'success'].includes(s) || s.includes('approved') || s.includes('completed')) {
    return 'background: #ECFDF5; color: #10B981; border: 1px solid rgba(16, 185, 129, 0.2);';
  }
  if (['inactive', 'resigned', 'rejected', 'cancelled', 'failed', 'no', 'false', 'void', 'closed'].includes(s) || s.includes('rejected') || s.includes('cancel')) {
    return 'background: #FEF2F2; color: #EF4444; border: 1px solid rgba(239, 68, 68, 0.2);';
  }
  if (s.includes('approval') || s.includes('warn')) {
    return 'background: #FFFBEB; color: #F59E0B; border: 1px solid rgba(245, 158, 11, 0.2);';
  }
  if (['processing', 'pending'].includes(s) || s.includes('pending') || s.includes('processing')) {
    return 'background: #EFF6FF; color: #3B82F6; border: 1px solid rgba(59, 130, 246, 0.2);';
  }
  if (s.includes('draft') || s.includes('not started')) {
    return 'background: #F3F4F6; color: #6B7280; border: 1px solid rgba(107, 114, 128, 0.2);';
  }
  return 'background: #FFF1E8; color: #F97316; border: 1px solid rgba(249, 115, 22, 0.2);';
};

function renderApprovalFlowWidget(record) {
  let flow = record ? record.approval_flow : null;
  if (typeof flow === 'string') {
    try { flow = JSON.parse(flow); } catch (e) { }
  }

  // Check if policy / request is Tier 0 (Auto-approved, no approvers required)
  let isTier0 = false;
  if (flow && flow.total_levels === 0) {
    isTier0 = true;
  } else if (record) {
    const policyLvl = record.policy_approval_level || record.approval_level || '';
    if (String(policyLvl).toLowerCase().includes('tier 0')) {
      isTier0 = true;
    } else if (record.request_type && typeof selectCache !== 'undefined' && selectCache['policy']) {
      const pol = selectCache['policy'].find(p => String(p.policy_id) === String(record.request_type) || p.policy_name === record.request_type);
      if (pol && String(pol.approval_level || '').toLowerCase().includes('tier 0')) {
        isTier0 = true;
      }
    }
  }

  if (isTier0 || (flow && flow.total_levels === 0)) {
    return `<div style="padding: 8px 12px; color: #10B981; font-size: 13px; font-weight: 500; display: inline-flex; align-items: center; gap: 6px; background: #ECFDF5; border-radius: 6px; border: 1px solid rgba(16, 185, 129, 0.2);">
      <span class="material-symbols-rounded" style="font-size: 18px;">check_circle</span>
      ${typeof t === 'function' ? t('approval.auto_approved_tier0', 'Auto-approved (Tier 0 - No approval required)') : 'Auto-approved (Tier 0 - No approval required)'}
    </div>`;
  }

  if (!flow || !Array.isArray(flow.steps) || flow.steps.length === 0) {
    return `<div style="padding: 12px; color: #94A3B8; font-size: 13px; font-style: italic;">—</div>`;
  }

  let html = `<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px 20px; width: 100%;">`;

  flow.steps.forEach((step, idx) => {
    const level = step.level || (idx + 1);
    const status = step.status != null ? step.status : 7;

    const approverVal = step.approver || '';
    const approverName = approverVal ? (resolveEmployeeName(approverVal) || approverVal) : '—';

    const actionByVal = step.action_by || '';
    const actionByName = actionByVal ? (resolveEmployeeName(actionByVal) || actionByVal) : actionByVal;

    const actionDate = step.action_date ? formatDateTime(step.action_date) : null;
    let dateStr = '—';
    if (actionDate) {
      dateStr = actionByName && actionByName !== approverName ? `${actionDate} (By ${actionByName})` : actionDate;
    }

    const approverLabel = typeof t === 'function' ? (t(`col.tier_${level}_approver`, t(`col.tier_${level}_approval`, `Tier ${level} Approver`))) : `Tier ${level} Approver`;
    const statusLabel = typeof t === 'function' ? t(`col.tier_${level}_status`, `Tier ${level} Status`) : `Tier ${level} Status`;
    const updateDateLabel = typeof t === 'function' ? t(`col.tier_${level}_update_date`, `Tier ${level} Update Date`) : `Tier ${level} Update Date`;

    // Column 1: Tier N Approver
    html += `
      <div class="field-row" style="grid-column: span 1; display: flex; flex-direction: column; gap: 4px; min-height: unset; justify-content: flex-start; box-sizing: border-box; padding: 0;">
        <div style="font-size: 13px; font-weight: 500; color: #6B7280; line-height: 1.3;">${escapeHTML(approverLabel)}</div>
        <div style="font-size: 14px; font-weight: 400; color: #111827; word-break: break-word; line-height: 1.4;">${escapeHTML(approverName)}</div>
      </div>
    `;

    // Column 2: Tier N Status
    html += `
      <div class="field-row" style="grid-column: span 1; display: flex; flex-direction: column; gap: 4px; min-height: unset; justify-content: flex-start; box-sizing: border-box; padding: 0;">
        <div style="font-size: 13px; font-weight: 500; color: #6B7280; line-height: 1.3;">${escapeHTML(statusLabel)}</div>
        <div style="font-size: 14px; font-weight: 400; color: #111827; word-break: break-word; line-height: 1.4;">
          <span style="display: inline-flex; align-items: center; padding: 4px 8px; border-radius: 6px; font-size: 12px; font-weight: 600; ${getBadgeStyles(status)}">
            ${escapeHTML(t_val(status))}
          </span>
        </div>
      </div>
    `;

    // Column 3: Tier N Update Date
    html += `
      <div class="field-row" style="grid-column: span 1; display: flex; flex-direction: column; gap: 4px; min-height: unset; justify-content: flex-start; box-sizing: border-box; padding: 0;">
        <div style="font-size: 13px; font-weight: 500; color: #6B7280; line-height: 1.3;">${escapeHTML(updateDateLabel)}</div>
        <div style="font-size: 14px; font-weight: 400; color: #111827; word-break: break-word; line-height: 1.4;">${escapeHTML(dateStr)}</div>
      </div>
    `;
  });

  html += `</div>`;
  return html;
}

function formatDateTime(val) {
  if (!val || (typeof val === 'object' && !(val instanceof Date))) return '';

  let date;
  if (val instanceof Date) {
    date = val;
  } else if (typeof val === 'string') {
    const legacyFormat = /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/;
    if (legacyFormat.test(val)) {
      date = new Date(val + ' +07:00');
    } else {
      date = new Date(val);
    }
  } else {
    date = new Date(val);
  }

  if (isNaN(date.getTime())) return '';

  const pad = (n) => String(n).padStart(2, '0');
  const h = pad(date.getHours());
  const m = pad(date.getMinutes());
  const s = pad(date.getSeconds());
  const D = pad(date.getDate());
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const monthStr = months[date.getMonth()];
  const Y = date.getFullYear();

  return `${D}-${monthStr}-${Y} ${h}:${m}:${s}`;
}

function formatDateMON(val) {
  if (!val || (typeof val === 'object' && !(val instanceof Date))) return '';
  if (typeof val === 'string') {
    const ymdMatch = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (ymdMatch) {
      const year = ymdMatch[1];
      const monthIdx = parseInt(ymdMatch[2], 10) - 1;
      const day = ymdMatch[3];
      const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
      const monthStr = months[monthIdx] || ymdMatch[2];
      return `${day}-${monthStr}-${year}`;
    }
  }
  let d = (val instanceof Date) ? val : new Date(val);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  const day = pad(d.getDate());
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const monthStr = months[d.getMonth()];
  const year = d.getFullYear();
  return `${day}-${monthStr}-${year}`;
}

function formatDate(val) {
  return formatDateMON(val);
}

// Record Policy & SLA Service extracted to js/services/recordPolicyService.js
// ============================================================
// MODAL HELPERS
// ============================================================
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

function handleFormClose(id) {
  // Close immediately when Cancel or close button is clicked
  closeModal(id);
}

// Close modal on overlay click (safe tracking for mousedown/mouseup to avoid accidental discard prompt on drag)
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  let mousedownTarget = null;
  let mouseupTarget = null;

  overlay.addEventListener('mousedown', (e) => {
    mousedownTarget = e.target;
  });
  overlay.addEventListener('mouseup', (e) => {
    mouseupTarget = e.target;
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay && mousedownTarget === overlay && mouseupTarget === overlay) {
      if (overlay.id === 'form-modal') {
        // Only trigger discard warning when clicking outside the form
        const okBtn = document.getElementById('discard-ok-btn');
        okBtn.onclick = () => {
          closeModal('discard-modal');
          closeModal('form-modal');
        };
        openModal('discard-modal');
      } else if (overlay.id !== 'alert-modal' && overlay.id !== 'discard-modal') {
        // Normal modals (confirm-modal, etc.) close immediately
        closeModal(overlay.id);
      }
    }
    // Reset targets
    mousedownTarget = null;
    mouseupTarget = null;
  });
});

// Window Bridge for UI Helpers
window.isColumnPinned = isColumnPinned;
window.getStickyTableColumnStyle = getStickyTableColumnStyle;
window.logout = logout;
window.getRecordEndpoint = getRecordEndpoint;
window.formatFileNameDisplay = formatFileNameDisplay;
window.renderApprovalFlowWidget = renderApprovalFlowWidget;
window.formatDateTime = formatDateTime;
window.formatDateMON = formatDateMON;
window.formatDate = formatDate;
window.openModal = openModal;
window.closeModal = closeModal;
window.handleFormClose = handleFormClose;
