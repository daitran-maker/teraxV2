/**
 * CRC App - Table View Subsystem
 * Extracted as part of Modularization
 * Contains renderTableView, activeDropdownFilters, filter sidebars, pagination, table rows, sorting
 */

// ============================================================
// TABLE VIEW FILTERS & METRIC CARDS
// ============================================================
let activeDropdownFilters = {};

// ============================================================
// PERSISTENT FILTER LOGIC (LOCALSTORAGE PER USER & MODULE)
// ============================================================
function resolveCurrentEmployeeId() {
  try {
    const userStr = localStorage.getItem('crc_user');
    if (!userStr) return 'guest';
    const userObj = JSON.parse(userStr);

    if (userObj.employee_id) return String(userObj.employee_id).toLowerCase().trim();
    if (userObj.employeeId) return String(userObj.employeeId).toLowerCase().trim();

    const email = (userObj.email || '').toLowerCase().trim();
    const username = (userObj.username || '').toLowerCase().trim();

    const mapStr = localStorage.getItem('crc_employee_map');
    if (mapStr) {
      const map = JSON.parse(mapStr);
      if (email && map[email]) return map[email];
      if (username && map[username]) return map[username];
    }

    if (selectCache['employee'] && Array.isArray(selectCache['employee'])) {
      const found = selectCache['employee'].find(e =>
        (email && e.email && e.email.toLowerCase().trim() === email) ||
        (username && e.username && e.username.toLowerCase().trim() === username)
      );
      if (found && found.employee_id) {
        const empId = String(found.employee_id).toLowerCase().trim();
        try {
          const map = mapStr ? JSON.parse(mapStr) : {};
          if (email) map[email] = empId;
          if (username) map[username] = empId;
          localStorage.setItem('crc_employee_map', JSON.stringify(map));
        } catch (e) { }
        return empId;
      }
    }

    if (email) return email;
    if (username) return username;
  } catch (e) { }
  return 'guest';
}

function getFilterStorageKey(moduleKey) {
  const empId = resolveCurrentEmployeeId().replace(/[^a-z0-9_-]/g, '_');
  return `crc_filter_${empId}_${moduleKey}`;
}

function isFilterValueChecked(filterSet, val) {
  if (!(filterSet instanceof Set) || filterSet.size === 0) return false;
  const valStr = String(val).trim();
  if (filterSet.has(valStr)) return true;
  const valLower = valStr.toLowerCase();
  for (const fv of filterSet) {
    if (String(fv).trim().toLowerCase() === valLower) return true;
  }
  return false;
}

window.savePersistedFilters = function (moduleKey) {
  if (!moduleKey) return;
  try {
    const key = getFilterStorageKey(moduleKey);
    const dropdownFiltersObj = {};

    const isDashboard = ['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(moduleKey);
    const filterSource = isDashboard ? dashboardFilters : (activeDropdownFilters[moduleKey] || {});

    for (const [fKey, fSet] of Object.entries(filterSource)) {
      if (fSet && fSet instanceof Set && fSet.size > 0) {
        dropdownFiltersObj[fKey] = Array.from(fSet);
      }
    }
    const search = moduleStates[moduleKey]?.search || '';
    const serverSearch = moduleStates[moduleKey]?.serverSearch || '';

    const payload = {
      dropdownFilters: dropdownFiltersObj,
      search: search,
      serverSearch: serverSearch
    };
    console.log('[FilterCache Debug] Saving filters under key:', key, 'payload:', payload);
    localStorage.setItem(key, JSON.stringify(payload));
  } catch (e) {
    console.warn('[FilterCache] Failed to save filter state:', e);
  }
};

window.loadPersistedFilters = function (moduleKey) {
  if (!moduleKey) return;
  const isDashboard = ['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(moduleKey);

  if (isDashboard) {
    dashboardFilters = {};
  } else {
    activeDropdownFilters[moduleKey] = {};
  }

  try {
    const key = getFilterStorageKey(moduleKey);
    const saved = localStorage.getItem(key);
    console.log('[FilterCache Debug] Loading filters under key:', key, 'saved value:', saved);
    if (!saved) return;
    const payload = JSON.parse(saved);

    if (payload.dropdownFilters && typeof payload.dropdownFilters === 'object') {
      if (isDashboard) {
        for (const [fKey, valArray] of Object.entries(payload.dropdownFilters)) {
          if (Array.isArray(valArray) && valArray.length > 0) {
            dashboardFilters[fKey] = new Set(valArray);
          }
        }
      } else {
        activeDropdownFilters[moduleKey] = {};
        for (const [fKey, valArray] of Object.entries(payload.dropdownFilters)) {
          if (Array.isArray(valArray) && valArray.length > 0) {
            activeDropdownFilters[moduleKey][fKey] = new Set(valArray);
          }
        }
      }
    }

    if (!moduleStates[moduleKey]) moduleStates[moduleKey] = {};
    if (payload.search && !moduleStates[moduleKey].search) {
      moduleStates[moduleKey].search = payload.search;
    }
    if (payload.serverSearch && !moduleStates[moduleKey].serverSearch) {
      moduleStates[moduleKey].serverSearch = payload.serverSearch;
    }
  } catch (e) {
    console.warn('[FilterCache] Failed to load filter state:', e);
  }
};

function getFiscalYear(dateVal) {
  if (!dateVal) return 'N/A';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return 'N/A';
  return String(d.getFullYear());
}

function formatNumber(val) {
  if (val === null || val === undefined || val === '') return '';
  const num = Number(val);
  if (!isNaN(num)) return num.toLocaleString('en-US');
  return val;
}

window.formatExchangeRate = function (val) {
  if (val === null || val === undefined || val === '') return '';
  const num = Number(val);
  if (!isNaN(num)) {
    return num.toLocaleString('en-US', { maximumFractionDigits: 6 });
  }
  return val;
};

function isNumericFieldKey(key, type) {
  if (!key) return false;
  if (type === 'number') return true;
  const k = String(key).toLowerCase();
  if (k === 'counter_party') return false;
  if (k === 'vat' || k.includes('vat') || k.includes('value_before_vat')) {
    return true;
  }
  if (
    k === 'gm' ||
    k === 'selling' ||
    k === 'buying' ||
    k === 'asset' ||
    k.includes('selling') ||
    k.includes('buying') ||
    k.includes('paid_') ||
    k.includes('_paid')
  ) {
    return true;
  }
  if (
    k === 'id' ||
    k.endsWith('_id') ||
    k.startsWith('id_') ||
    k.includes('code') ||
    k.includes('type') ||
    k.includes('phone') ||
    k.includes('account') ||
    k.includes('identity') ||
    k.includes('number') ||
    k.includes('username') ||
    k.includes('password') ||
    k.includes('email') ||
    k.includes('date') ||
    k.includes('time')
  ) {
    return false;
  }
  return (
    k.includes('amount') ||
    k.includes('price') ||
    k.includes('cost') ||
    k.includes('total') ||
    k.includes('budget') ||
    k.includes('tax') ||
    k.includes('value') ||
    k.includes('balance') ||
    k.includes('rate') ||
    k === 'qty' ||
    k.includes('quantity') ||
    k.includes('limit') ||
    k.includes('count') ||
    k.includes('debit') ||
    k.includes('credit') ||
    k === 'vat' ||
    k.includes('vat')
  );
}

function resolveCompanyForRecord(rowData) {
  if (!rowData) return 'N/A';

  if (rowData.company_shortname) return rowData.company_shortname;

  const idToResolve = rowData.company_entity || rowData.company_id || rowData.my_company;

  if (idToResolve && selectCache['my_company']) {
    if (!selectCache['my_company_index_by_id']) {
      const m = new Map();
      selectCache['my_company'].forEach(c => m.set(String(c.my_company_id), c));
      selectCache['my_company_index_by_id'] = m;
    }
    const comp = selectCache['my_company_index_by_id'].get(String(idToResolve));
    if (comp) return comp.company_shortname || comp.company_fullname || 'N/A';
  }

  if (rowData.company_id && typeof rowData.company_id === 'string') {
    return rowData.company_id;
  }


  if (!rowData.request) return 'N/A';

  if (selectCache['request']) {
    if (!selectCache['request_index_by_id'] || selectCache['request_index_by_id']._lastLength !== selectCache['request'].length) {
      const m = new Map();
      selectCache['request'].forEach(x => m.set(String(x.request_id), x));
      m._lastLength = selectCache['request'].length;
      selectCache['request_index_by_id'] = m;
    }
    const req = selectCache['request_index_by_id'].get(String(rowData.request));

    if (req && req.requester) {
      if (selectCache['employee']) {
        if (!selectCache['employee_index_by_email_or_id'] || selectCache['employee_index_by_email_or_id'].size === 0) {
          const m = new Map();
          selectCache['employee'].forEach(x => {
            if (x.email) m.set(x.email.toLowerCase(), x);
            if (x.employee_id) m.set(x.employee_id.toLowerCase(), x);
          });
          selectCache['employee_index_by_email_or_id'] = m;
        }
        const emp = selectCache['employee_index_by_email_or_id'].get(req.requester.toLowerCase());

        if (emp) {
          if (emp.company_shortname) return emp.company_shortname;
          if (emp.company_id && selectCache['my_company']) {
            if (!selectCache['my_company_index_by_id']) {
              const m = new Map();
              selectCache['my_company'].forEach(c => m.set(String(c.my_company_id), c));
              selectCache['my_company_index_by_id'] = m;
            }
            const comp = selectCache['my_company_index_by_id'].get(String(emp.company_id));
            if (comp) return comp.company_shortname || comp.company_fullname || 'N/A';
          }
        }
      }
    }
  }
  return 'N/A';
}

function getTableDropdownValue(moduleKey, row, key) {
  if (!row) return 'N/A';
  if (moduleKey === 'employee' || moduleKey === 'employee_active') {
    if (key === 'my_company') return row.company_shortname || 'N/A';
    if (key === 'department_name') return row.department_name || 'N/A';
    if (key === 'status') return row.status || 'Inactive';
  }
  if (moduleKey === 'payment') {
    if (key === 'my_company') return resolveCompanyForRecord(row);
    if (key === 'payment_type') return row.payment_type || 'N/A';
    if (key === 'payment_status') return row.payment_status || 'N/A';
    if (key === 'payment_method') return row.payment_method || 'N/A';
    if (key === 'fy') return getFiscalYear(row.created_date);
  }

  if (['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team', 'request'].includes(moduleKey)) {
    if (key === 'policy_name') return row.policy_name || resolveLookupValue(moduleKey, 'request_type', row.request_type) || 'N/A';
    if (key === 'status') return ['my_task', 'my_process_owner'].includes(moduleKey) ? (row.process_status || 'N/A') : (row.sr_status || 'N/A');
    if (key === 'sr_status') return row.sr_status || 'N/A';
    if (key === 'process_status') return row.process_status || 'Not started yet';
    if (key === 'approval_status') return row.approval_status || getApprovalStatusForUser(row) || 'N/A';
    if (key === 'request_type') return resolveLookupValue(moduleKey, 'request_type', row.request_type) || row.request_type || 'N/A';
  }
  if (key === 'my_company') return resolveCompanyForRecord(row);
  if (key === 'fy') return row.fy || getFiscalYear(row.contract_signed_date || row.sr_submitted_date || row.sr_created_date || row.created_date || row.log_time);
  if (key === 'month' && row.log_time) return String(new Date(row.log_time).getMonth() + 1).padStart(2, '0');
  if (key === 'year' && row.log_time) return String(new Date(row.log_time).getFullYear());

  let val = row[key];
  if (typeof resolveVirtualColumn === 'function') {
    const virtualVal = resolveVirtualColumn(moduleKey, key, row);
    if (virtualVal !== undefined) val = virtualVal;
  }
  const resolved = resolveLookupValue(moduleKey, key, val);
  if (resolved !== undefined && resolved !== null && resolved !== '') return resolved;
  if (val !== undefined && val !== null && val !== '') return val;
  return 'N/A';
}

function rowMatchesTableFilters(moduleKey, row, { search = '', colFilters = {}, dropdownFilters = {}, excludeFilterKey = null } = {}) {
  if (search) {
    if (!row._searchText) {
      let rowText = '';
      for (const k in row) {
        rowText += ' ' + String(row[k] || '');
        const resolved = resolveLookupValue(moduleKey, k, row[k]);
        if (resolved && resolved !== row[k]) rowText += ' ' + String(resolved);
      }
      row._searchText = rowText.toLowerCase();
    }
    if (!row._searchText.includes(search)) return false;
  }

  for (const [key, filterVal] of Object.entries(colFilters || {})) {
    if (!filterVal) continue;
    const val = resolveLookupValue(moduleKey, key, row[key]);
    if (!String(val || '').toLowerCase().includes(filterVal)) return false;
  }

  for (const [key, filterValues] of Object.entries(dropdownFilters || {})) {
    if (key === excludeFilterKey || !(filterValues instanceof Set) || filterValues.size === 0) continue;
    const rowVal = getTableDropdownValue(moduleKey, row, key);
    let hasMatch = filterValues.has(String(rowVal));
    if (!hasMatch && (key === 'my_company' || key === 'company_id' || key === 'company_entity')) {
      const rawId = String(row.my_company || row.company_id || row.company_entity || '');
      if (rawId && filterValues.has(rawId)) hasMatch = true;
    }
    if (!hasMatch) return false;
  }

  return true;
}
// ============================================================
// CHILD TABLE CLIENT-SIDE PAGINATION (DOM post-processing)
// Runs after child table HTML is injected.
// ============================================================
function applyChildTablePagination(container, childKey, tabPane = null) {
  if (!container) return;
  const PAGE_SIZE = 50;

  const table = container.querySelector('table');
  if (!table) return;
  const tbody = table.querySelector('tbody');
  if (!tbody) return;
  const allRows = Array.from(tbody.querySelectorAll('tr'));
  const total = allRows.length;
  if (total === 0) return;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  let currentPage = 1;

  container.querySelectorAll(':scope > .ct-pager-footer').forEach(el => el.remove());

  // Keep each child table footer scoped to its own tab pane.
  const footerParent = container;

  function renderPage(page) {
    currentPage = Math.max(1, Math.min(page, totalPages));
    allRows.forEach((row, i) => {
      row.style.display = (i >= (currentPage - 1) * PAGE_SIZE && i < currentPage * PAGE_SIZE) ? '' : 'none';
    });
    const info = footerParent.querySelector('.ct-page-info');
    const prev = footerParent.querySelector('.ct-prev-btn');
    const next = footerParent.querySelector('.ct-next-btn');
    const pageButtons = footerParent.querySelector('.ct-page-buttons');
    const startRecord = (currentPage - 1) * PAGE_SIZE + 1;
    const endRecord = Math.min(currentPage * PAGE_SIZE, total);
    if (info) {
      info.innerHTML = `Showing <strong style="color:#111827;">${startRecord}-${endRecord}</strong> of <strong style="color:#111827;">${total}</strong> records`;
    }
    if (prev) prev.disabled = currentPage <= 1;
    if (next) next.disabled = currentPage >= totalPages;
    if (pageButtons) {
      pageButtons.innerHTML = buildChildPageButtonsHTML();
      pageButtons.querySelectorAll('.ct-page-btn').forEach(btn => {
        btn.addEventListener('click', () => renderPage(parseInt(btn.dataset.page, 10)));
      });
    }
  }

  function buildChildPageButtonsHTML() {
    if (totalPages <= 1) return '';
    return Array.from({ length: totalPages }).map((_, i) => {
      const pageNum = i + 1;
      const isActive = pageNum === currentPage;
      if (totalPages > 5 && pageNum !== 1 && pageNum !== totalPages && Math.abs(pageNum - currentPage) > 1) {
        if (pageNum === 2 || pageNum === totalPages - 1) {
          return `<span style="color:#9CA3AF;padding:0 4px;">...</span>`;
        }
        return '';
      }
      return `<button class="btn pagination-page-btn ct-page-btn${isActive ? ' is-active' : ''}" data-page="${pageNum}" style="height:28px !important;width:28px !important;min-width:28px !important;padding:0 !important;display:inline-flex !important;align-items:center !important;justify-content:center !important;font-size:12px !important;border:1px solid ${isActive ? '#F97316' : '#E5E7EB'} !important;border-radius:6px !important;background:${isActive ? '#FFF7ED' : '#FFFFFF'} !important;color:${isActive ? '#EA580C' : '#374151'} !important;font-weight:${isActive ? '600' : '500'} !important;cursor:pointer;transition:all 0.2s ease;">${pageNum}</button>`;
    }).join('');
  }

  // ── Restore container scroll (undo any previous override) ────────────
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.minHeight = '0';
  container.style.overflow = 'hidden';
  const wrapper = table.closest('.table-responsive');
  if (wrapper) {
    wrapper.style.flex = '1 1 auto';
    wrapper.style.minHeight = '0';
    wrapper.style.overflowY = 'auto';
    wrapper.style.overflowX = 'auto';
  }

  // ── Detect style context ───────────────────────────────────────────────
  const isLight = container.closest('[style*="background: transparent"]') !== null ||
    container.closest('[style*="background:transparent"]') !== null;
  const footerBrd = isLight ? '#E2E8F0' : 'var(--border)';

  const footer = document.createElement('div');
  footer.className = 'ct-pager-footer pagination-container';
  footer.style.cssText =
    `display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:auto;padding:8px 12px;flex-shrink:0;width:100%;z-index:10;` +
    `background:#FFFFFF;border-top:1px solid ${footerBrd};` +
    `font-family:Inter,sans-serif;`;

  const btnStyle =
    `height:28px !important;display:inline-flex;align-items:center;gap:4px;padding:4px 10px !important;` +
    `border:1px solid #E5E7EB !important;border-radius:6px;background:#FFFFFF !important;color:#374151 !important;` +
    `font-size:12px;font-weight:500;cursor:pointer;font-family:inherit;line-height:1.5;`;

  footer.innerHTML =
    `<div class="ct-page-info" style="font-size:12px;font-weight:500;color:#6B7280;font-family:'Inter',sans-serif;">` +
    `Showing <strong style="color:#111827;">1-${Math.min(PAGE_SIZE, total)}</strong> of <strong style="color:#111827;">${total}</strong> records</div>` +
    (totalPages > 1
      ? `<div class="pagination-controls" style="display:flex;gap:6px;align-items:center;height:32px;">` +
      `<button class="btn ct-prev-btn" style="${btnStyle}">${t('table.prev', 'Prev')}</button>` +
      `<span class="ct-page-buttons" style="display:flex;gap:6px;align-items:center;">${buildChildPageButtonsHTML()}</span>` +
      `<button class="btn ct-next-btn" style="${btnStyle}">${t('table.next', 'Next')}</button>` +
      `</div>`
      : '');

  if (totalPages > 1) {
    footer.querySelector('.ct-prev-btn').addEventListener('click', () => renderPage(currentPage - 1));
    footer.querySelector('.ct-next-btn').addEventListener('click', () => renderPage(currentPage + 1));
  }

  container.appendChild(footer);

  renderPage(1);
}

window.updateGlobalStatusCards = function (html) {
  const globalContainer = document.getElementById('global-status-cards-container');
  if (!globalContainer) return;
  const content = document.getElementById('content');
  if (content && html !== undefined) {
    content.dataset.statusCardsHTML = html;
  }
  if (html && html.trim()) {
    globalContainer.innerHTML = `<div class="dv-status-cards-outer" style="flex-shrink:0; padding:10px 16px; width:100%; box-sizing:border-box;">${html}</div>`;
    globalContainer.style.display = 'block';
  } else {
    globalContainer.innerHTML = '';
    globalContainer.style.display = 'none';
  }
};

function buildTableStatusCards(moduleKey, data) {
  if (moduleKey === 'contract') {
    let totalContracts = typeof currentTableTotal !== 'undefined' ? currentTableTotal : data.length;
    const baseCurr = (typeof window.getActiveBaseCurrency === 'function' ? window.getActiveBaseCurrency() : 'VND') || 'VND';

    let typeBaseSums = {};
    let totalBaseSum = 0;
    const tf = currentFacetedSummary?.type_financials || originalFacetedSummary[moduleKey]?.type_financials;
    if (tf && Object.keys(tf).length > 0) {
      Object.entries(tf).forEach(([type, info]) => {
        let sum = info.total_base_val;
        if (sum == null) {
          sum = 0;
          Object.values(info.currencies || {}).forEach(v => { sum += (parseFloat(v) || 0); });
        }
        typeBaseSums[type] = sum;
        totalBaseSum += sum;
      });
    } else {
      (data || []).forEach(r => {
        const typeKey = r.type_key || (Number(r.type) === 69 ? 'selling' : (Number(r.type) === 70 ? 'buying' : (Number(r.type) === 71 ? 'internal' : String(r.type || 'unknown').toLowerCase())));
        const type = typeKey.charAt(0).toUpperCase() + typeKey.slice(1).toLowerCase();
        const baseVal = parseFloat(r.total_value_in_base_currency != null ? r.total_value_in_base_currency : (parseFloat(r.value_before_vat_in_base_currency || 0) + parseFloat(r.vat_value_in_base_currency || 0))) || ((parseFloat(r.value_before_vat) || 0) + (parseFloat(r.vat_value) || 0));

        typeBaseSums[type] = (typeBaseSums[type] || 0) + baseVal;
        totalBaseSum += baseVal;
      });
    }

    const typeCounts = {};
    if (currentFacetedSummary && currentFacetedSummary.type) {
      Object.entries(currentFacetedSummary.type).forEach(([k, v]) => {
        const typeKey = String(k).trim().toLowerCase();
        const type = (typeKey === '69' || typeKey === 'selling') ? 'Selling' : ((typeKey === '70' || typeKey === 'buying') ? 'Buying' : ((typeKey === '71' || typeKey === 'internal') ? 'Internal' : (typeKey.charAt(0).toUpperCase() + typeKey.slice(1))));
        typeCounts[type] = (typeCounts[type] || 0) + v;
      });
    } else {
      (data || []).forEach(r => {
        const typeKey = r.type_key || (Number(r.type) === 69 ? 'selling' : (Number(r.type) === 70 ? 'buying' : (Number(r.type) === 71 ? 'internal' : String(r.type || 'unknown').toLowerCase())));
        const type = typeKey.charAt(0).toUpperCase() + typeKey.slice(1).toLowerCase();
        typeCounts[type] = (typeCounts[type] || 0) + 1;
      });
    }

    const cardConfigMap = {
      'selling': { label: 'Selling Contracts', color: '#10b981', bg: '#ecfdf5', icon: 'sell' },
      'buying': { label: 'Buying Contracts', color: '#3b82f6', bg: '#eff6ff', icon: 'shopping_cart' },
      'internal': { label: 'Internal Contracts', color: '#7c3aed', bg: '#f5f3ff', icon: 'sync_alt' }
    };

    const palette = [
      { color: '#10b981', bg: '#ecfdf5', icon: 'sell' },
      { color: '#3b82f6', bg: '#eff6ff', icon: 'shopping_cart' },
      { color: '#7c3aed', bg: '#f5f3ff', icon: 'sync_alt' },
      { color: '#f97316', bg: '#fff1e8', icon: 'description' },
      { color: '#0284c7', bg: '#e0f2fe', icon: 'contract' },
      { color: '#64748b', bg: '#f3f4f6', icon: 'folder' }
    ];

    const cards = [
      {
        label: typeof t === 'function' ? t('contract.total_contracts', 'Total Contracts') : 'Total Contracts',
        count: totalContracts,
        detail: totalBaseSum ? `${formatNumber(Math.round(totalBaseSum))} ${baseCurr}` : '',
        color: '#f97316',
        bg: '#fff1e8',
        icon: 'description'
      }
    ];

    let idx = 0;
    Object.keys(typeCounts).sort().forEach(type => {
      const typeLc = type.toLowerCase();
      const count = typeCounts[type] || 0;
      const sum = typeBaseSums[type] || 0;
      const detail = `${formatNumber(Math.round(sum))} ${baseCurr}`;

      const config = cardConfigMap[typeLc] || {
        label: `${type} Contracts`,
        color: palette[(idx + 3) % palette.length].color,
        bg: palette[(idx + 3) % palette.length].bg,
        icon: 'description'
      };

      cards.push({
        label: config.label,
        count: count,
        detail: detail,
        color: config.color,
        bg: config.bg,
        icon: config.icon
      });
      idx++;
    });

    return `<div class="dv-status-cards contract-status-cards" style="display:flex; gap:12px; width:100%; overflow-x:auto; padding-bottom:2px;">${cards.map(card => `
      <div class="dv-status-card" style="flex:1; min-width:180px; height:64px; background:#ffffff; border:1px solid #E5E7EB; border-radius:12px; padding:10px 12px; display:flex; align-items:center; gap:12px; box-shadow:0 1px 2px rgba(16,24,40,0.04); border-bottom:3px solid ${card.color};">
        <div style="width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; background:${card.bg}; color:${card.color}; flex-shrink:0;"><span class="material-symbols-rounded" style="font-size:14px;">${card.icon}</span></div>
        <div style="display:flex; flex-direction:column; gap:2px; min-width:0;">
          <div style="display:flex; align-items:baseline; gap:6px;">
            <span style="font-size:16px; font-weight:700; color:#111827; line-height:1; font-family:Inter,sans-serif;">${formatNumber(card.count)}</span>
            ${card.detail ? `<span style="font-size:10px; color:#6B7280; font-weight:600; font-family:Inter,sans-serif; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${card.detail}">${card.detail}</span>` : ''}
          </div>
          <div style="font-size:11px; font-weight:500; color:#6B7280; font-family:Inter,sans-serif; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${escapeHTML(card.label)}">${escapeHTML(card.label)}</div>
        </div>
      </div>`).join('')}</div>`;
  }

  if (moduleKey === 'company') {
    const iconByType = { customer: 'person', partner: 'handshake', supplier: 'local_shipping' };
    const orderedTypes = ['Customer', 'Partner', 'Supplier'];

    const typeSource = currentFacetedSummary?.type || originalFacetedSummary[moduleKey]?.type || {};
    const activeCounts = {};
    orderedTypes.forEach(t => { activeCounts[t] = 0; });

    if (Object.keys(typeSource).length > 0) {
      Object.entries(typeSource).forEach(([k, count]) => {
        const keyLc = String(k).trim().toLowerCase();
        const matchType = orderedTypes.find(t => t.toLowerCase() === keyLc) || (k.charAt(0).toUpperCase() + k.slice(1).toLowerCase());
        activeCounts[matchType] = (activeCounts[matchType] || 0) + (count || 0);
      });
    } else {
      data.forEach(r => {
        const typeVal = r.type || 'Unassigned';
        activeCounts[typeVal] = (activeCounts[typeVal] || 0) + 1;
      });
    }

    const cardConfig = {
      '': { label: 'Total Companies', color: '#f97316', bg: '#fff1e8', icon: 'domain' },
      'customer': { label: 'Customers', color: '#3b82f6', bg: '#eff6ff', icon: 'person' },
      'partner': { label: 'Partners', color: '#7c3aed', bg: '#f5f3ff', icon: 'handshake' },
      'supplier': { label: 'Suppliers', color: '#10b981', bg: '#ecfdf5', icon: 'local_shipping' }
    };

    const totalCount = typeof currentTableTotal !== 'undefined' && currentTableTotal !== null ? currentTableTotal : Object.values(activeCounts).reduce((total, count) => total + Number(count || 0), 0);

    const cards = [
      { key: '', count: totalCount },
      ...orderedTypes.map(type => ({ key: type, count: Number(activeCounts[type] || 0) }))
    ];

    return `<div class="dv-status-cards company-type-cards" style="display:flex; gap:12px; width:100%; overflow-x:auto; padding-bottom:2px;">${cards.map(card => {
      const config = cardConfig[card.key.toLowerCase()] || { label: card.key, color: '#64748b', bg: '#f3f4f6', icon: iconByType[card.key.toLowerCase()] || 'business' };

      return `
        <div class="dv-status-card"
             style="flex:1; min-width:150px; height:64px; border-radius:12px; padding:10px 12px; display:flex; align-items:center; gap:12px; box-shadow:0 1px 2px rgba(16,24,40,0.04); border:1px solid #E5E7EB; border-bottom:3px solid ${config.color}; background:#ffffff;">
          <div style="width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; background:${config.bg}; color:${config.color}; flex-shrink:0;">
            <span class="material-symbols-rounded" style="font-size:14px;">${config.icon}</span>
          </div>
          <div style="display:flex; flex-direction:column; gap:2px; min-width:0;">
            <div style="font-size:16px; font-weight:700; color:#111827; line-height:1; font-family:Inter,sans-serif;">${formatNumber(card.count)}</div>
            <div style="font-size:11px; font-weight:500; color:#6B7280; font-family:Inter,sans-serif; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${escapeHTML(config.label)}">${escapeHTML(config.label)}</div>
          </div>
        </div>
      `;
    }).join('')}</div>`;
  }

  // Employee dashboard: show headcount by company. The signed-in user's
  // company is displayed first so a company manager sees their own headcount
  // immediately, followed by the remaining companies.
  if (moduleKey === 'employee' || moduleKey === 'employee_active') {
    const companyCounts = {
      ...(currentFacetedSummary?.company_shortname || originalFacetedSummary[moduleKey]?.company_shortname || {})
    };
    if (Object.keys(companyCounts).length === 0) {
      data.forEach(row => {
        const company = row.company_shortname || 'Unassigned';
        companyCounts[company] = (companyCounts[company] || 0) + 1;
      });
    }

    const ownCompany = (selectCache.my_company || []).find(company =>
      String(company.my_company_id) === String(authUser.company_id)
    );
    const ownCompanyName = ownCompany && (ownCompany.company_shortname || ownCompany.company_fullname);
    const companies = Object.entries(companyCounts).sort(([nameA], [nameB]) => {
      if (nameA === ownCompanyName) return -1;
      if (nameB === ownCompanyName) return 1;
      return nameA.localeCompare(nameB);
    });
    const palette = [
      { color: '#f97316', bg: '#fff1e8' },
      { color: '#3b82f6', bg: '#eff6ff' },
      { color: '#10b981', bg: '#ecfdf5' },
      { color: '#7c3aed', bg: '#f5f3ff' },
      { color: '#64748b', bg: '#f3f4f6' }
    ];
    const cards = [
      { label: 'Total Employees', count: currentTableTotal || data.length, icon: 'person', ...palette[0] },
      ...companies.map(([company, count], index) => ({
        label: company === ownCompanyName ? `${company} Employees` : company,
        count,
        icon: 'person',
        ...palette[(index + 1) % palette.length]
      }))
    ];
    return `<div class="dv-status-cards employee-company-cards" style="display:flex; gap:12px; width:100%; overflow-x:auto; padding-bottom:2px;">${cards.map(card => `
      <div class="dv-status-card" style="flex:1; min-width:150px; height:64px; background:#ffffff; border:1px solid #E5E7EB; border-radius:12px; padding:10px 12px; display:flex; align-items:center; gap:12px; box-shadow:0 1px 2px rgba(16,24,40,0.04); border-bottom:3px solid ${card.color};">
        <div style="width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; background:${card.bg}; color:${card.color}; flex-shrink:0;"><span class="material-symbols-rounded" style="font-size:14px;">${card.icon}</span></div>
        <div style="display:flex; flex-direction:column; gap:2px; min-width:0;"><div style="font-size:16px; font-weight:700; color:#111827; line-height:1; font-family:Inter,sans-serif;">${formatNumber(card.count)}</div><div style="font-size:11px; font-weight:500; color:#6B7280; font-family:Inter,sans-serif; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${escapeHTML(String(card.label))}">${escapeHTML(String(card.label))}</div></div>
      </div>`).join('')}</div>`;
  }
  // My Company uses the same top KPI card pattern as My Requests, but with
  // organization-specific indicators instead of request statuses.
  if (moduleKey === 'my_company') {
    const totalDepts = data.reduce((sum, r) => sum + (parseInt(r.department) || 0), 0);
    const totalAccounts = data.reduce((sum, r) => sum + (parseInt(r.account) || 0), 0);
    const cards = [
      { label: 'Total Companies', count: currentTableTotal || data.length, icon: 'domain', color: '#f97316', bg: '#fff1e8' },
      { label: 'Total Department', count: totalDepts, icon: 'corporate_fare', color: '#7c3aed', bg: '#f5f3ff' },
      { label: 'Total Accounts', count: totalAccounts, icon: 'account_balance', color: '#10b981', bg: '#ecfdf5' }
    ];
    return `<div class="dv-status-cards" style="display:flex; gap:12px; width:100%; overflow-x:auto; padding-bottom:2px;">${cards.map(card => `
      <div class="dv-status-card" style="flex:1; min-width:140px; height:64px; background:#ffffff; border:1px solid #E5E7EB; border-radius:12px; padding:10px 12px; display:flex; align-items:center; gap:12px; box-shadow:0 1px 2px rgba(16,24,40,0.04); border-bottom:3px solid ${card.color};">
        <div style="width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; background:${card.bg}; color:${card.color}; flex-shrink:0;"><span class="material-symbols-rounded" style="font-size:14px;">${card.icon}</span></div>
        <div style="display:flex; flex-direction:column; gap:2px; min-width:0;"><div style="font-size:16px; font-weight:700; color:#111827; line-height:1; font-family:Inter,sans-serif;">${formatNumber(card.count)}</div><div style="font-size:11px; font-weight:500; color:#6B7280; font-family:Inter,sans-serif; white-space:nowrap;">${card.label}</div></div>
      </div>`).join('')}</div>`;
  }
  if (moduleKey === 'account') {
    const baseCurr = (typeof window.getActiveBaseCurrency === 'function' ? window.getActiveBaseCurrency() : 'VND') || 'VND';
    let totalBaseBalance = currentFacetedSummary?.total_base_balance || originalFacetedSummary[moduleKey]?.total_base_balance;
    if (totalBaseBalance == null) {
      totalBaseBalance = 0;
      (data || []).forEach(r => {
        const bal = parseFloat(r.balance_in_base_currency != null ? r.balance_in_base_currency : (parseFloat(r.balance || 0) * parseFloat(r.exchange_rate || 1))) || 0;
        totalBaseBalance += bal;
      });
    }

    const totalAccounts = currentTableTotal || (data ? data.length : 0);
    const statusCounts = currentFacetedSummary?.account_status || originalFacetedSummary[moduleKey]?.account_status || {};
    let openCount = statusCounts['Open'] || statusCounts['open'] || statusCounts['10'] || 0;
    let closedCount = statusCounts['Closed'] || statusCounts['closed'] || statusCounts['11'] || 0;
    if (!statusCounts['Open'] && !statusCounts['Closed']) {
      (data || []).forEach(r => {
        const s = String(r.account_status || '').toLowerCase();
        if (s === 'open' || s === '10' || s === 'active') openCount++;
        else closedCount++;
      });
    }

    const cards = [
      {
        label: typeof t === 'function' ? t('account.total_balance', 'Total Balance') : 'Total Balance',
        countStr: `${formatNumber(Math.round(totalBaseBalance))} ${baseCurr}`,
        color: '#10b981',
        bg: '#ecfdf5',
        icon: 'account_balance_wallet'
      },
      {
        label: typeof t === 'function' ? t('account.total_accounts', 'Total Accounts') : 'Total Accounts',
        countStr: formatNumber(totalAccounts),
        color: '#3b82f6',
        bg: '#eff6ff',
        icon: 'account_balance'
      },
      {
        label: typeof t === 'function' ? t('account.open_accounts', 'Open Accounts') : 'Open Accounts',
        countStr: formatNumber(openCount),
        color: '#10b981',
        bg: '#ecfdf5',
        icon: 'lock_open'
      },
      {
        label: typeof t === 'function' ? t('account.closed_accounts', 'Closed Accounts') : 'Closed Accounts',
        countStr: formatNumber(closedCount),
        color: '#ef4444',
        bg: '#fef2f2',
        icon: 'lock'
      }
    ];

    return `<div class="dv-status-cards" style="display:flex; gap:12px; width:100%; overflow-x:auto; padding-bottom:2px;">${cards.map(card => `
      <div class="dv-status-card" style="flex:1; min-width:160px; height:64px; background:#ffffff; border:1px solid #E5E7EB; border-radius:12px; padding:10px 12px; display:flex; align-items:center; gap:12px; box-shadow:0 1px 2px rgba(16,24,40,0.04); border-bottom:3px solid ${card.color};">
        <div style="width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; background:${card.bg}; color:${card.color}; flex-shrink:0;"><span class="material-symbols-rounded" style="font-size:14px;">${card.icon}</span></div>
        <div style="display:flex; flex-direction:column; gap:2px; min-width:0;"><div style="font-size:15px; font-weight:700; color:#111827; line-height:1; font-family:Inter,sans-serif;">${card.countStr}</div><div style="font-size:11px; font-weight:500; color:#6B7280; font-family:Inter,sans-serif; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${escapeHTML(String(card.label))}">${escapeHTML(String(card.label))}</div></div>
      </div>`).join('')}</div>`;
  }
  if (moduleKey === 'invoice') {
    const baseCurr = (typeof window.getActiveBaseCurrency === 'function' ? window.getActiveBaseCurrency() : 'VND') || 'VND';
    let totalBaseVal = currentFacetedSummary?.total_base_val || originalFacetedSummary[moduleKey]?.total_base_val;
    const statusBaseSums = {};
    const statusCounts = currentFacetedSummary?.invoice_status || originalFacetedSummary[moduleKey]?.invoice_status || {};

    if (totalBaseVal == null || Object.keys(statusBaseSums).length === 0) {
      totalBaseVal = 0;
      (data || []).forEach(r => {
        const val = parseFloat(r.total_value_in_base_currency != null ? r.total_value_in_base_currency : (parseFloat(r.value_before_vat_in_base_currency || 0) + parseFloat(r.vat_value_in_base_currency || 0))) || ((parseFloat(r.value_before_vat) || 0) + (parseFloat(r.vat_value) || 0));
        totalBaseVal += val;
        const st = r.invoice_status || 'Draft';
        statusBaseSums[st] = (statusBaseSums[st] || 0) + val;
      });
    }

    const totalInvoices = currentTableTotal || (data ? data.length : 0);
    const statuses = ['Draft', 'Issued', 'Paid', 'Void'];
    const statusConfig = {
      'Draft': { color: '#64748b', bg: '#f8fafc', icon: 'edit_note' },
      'Issued': { color: '#3b82f6', bg: '#eff6ff', icon: 'send' },
      'Paid': { color: '#10b981', bg: '#ecfdf5', icon: 'task_alt' },
      'Void': { color: '#ef4444', bg: '#fef2f2', icon: 'cancel' }
    };

    const cards = [
      {
        label: typeof t === 'function' ? t('invoice.total_invoices', 'Total Invoices') : 'Total Invoices',
        count: totalInvoices,
        detail: totalBaseVal ? `${formatNumber(Math.round(totalBaseVal))} ${baseCurr}` : '',
        color: '#f97316',
        bg: '#fff1e8',
        icon: 'receipt'
      }
    ];

    statuses.forEach(st => {
      const cfg = statusConfig[st];
      const count = statusCounts[st] || 0;
      const sumVal = statusBaseSums[st];
      cards.push({
        label: typeof t_val === 'function' ? t_val(st) : st,
        count: count,
        detail: sumVal ? `${formatNumber(Math.round(sumVal))} ${baseCurr}` : '',
        color: cfg.color,
        bg: cfg.bg,
        icon: cfg.icon
      });
    });

    return `<div class="dv-status-cards invoice-status-cards" style="display:flex; gap:12px; width:100%; overflow-x:auto; padding-bottom:2px;">${cards.map(card => `
      <div class="dv-status-card" style="flex:1; min-width:160px; height:64px; background:#ffffff; border:1px solid #E5E7EB; border-radius:12px; padding:10px 12px; display:flex; align-items:center; gap:12px; box-shadow:0 1px 2px rgba(16,24,40,0.04); border-bottom:3px solid ${card.color};">
        <div style="width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; background:${card.bg}; color:${card.color}; flex-shrink:0;"><span class="material-symbols-rounded" style="font-size:14px;">${card.icon}</span></div>
        <div style="display:flex; flex-direction:column; gap:2px; min-width:0;">
          <div style="display:flex; align-items:baseline; gap:6px;">
            <span style="font-size:16px; font-weight:700; color:#111827; line-height:1; font-family:Inter,sans-serif;">${formatNumber(card.count)}</span>
            ${card.detail ? `<span style="font-size:10px; color:#6B7280; font-weight:600; font-family:Inter,sans-serif; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${card.detail}">${card.detail}</span>` : ''}
          </div>
          <div style="font-size:11px; font-weight:500; color:#6B7280; font-family:Inter,sans-serif; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${escapeHTML(card.label)}">${escapeHTML(card.label)}</div>
        </div>
      </div>`).join('')}</div>`;
  }
  if (moduleKey === 'policy') {
    const typeCounts = {};
    (data || []).forEach(r => {
      const type = r.policy_type || 'Unassigned';
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });

    const palette = [
      { color: '#3b82f6', bg: '#eff6ff', icon: 'business' },
      { color: '#10b981', bg: '#ecfdf5', icon: 'apartment' },
      { color: '#7c3aed', bg: '#f5f3ff', icon: 'corporate_fare' },
      { color: '#f97316', bg: '#fff1e8', icon: 'domain' },
      { color: '#0284c7', bg: '#e0f2fe', icon: 'account_tree' },
      { color: '#64748b', bg: '#f3f4f6', icon: 'folder' }
    ];

    const cards = Object.entries(typeCounts).map(([type, count], index) => {
      const style = palette[index % palette.length];
      return {
        label: type,
        count,
        ...style
      };
    });

    return `<div class="dv-status-cards" style="display:flex; gap:12px; width:100%; overflow-x:auto; padding-bottom:2px;">${cards.map(card => `
      <div class="dv-status-card" style="flex:1; min-width:140px; height:64px; background:#ffffff; border:1px solid #E5E7EB; border-radius:12px; padding:10px 12px; display:flex; align-items:center; gap:12px; box-shadow:0 1px 2px rgba(16,24,40,0.04); border-bottom:3px solid ${card.color};">
        <div style="width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; background:${card.bg}; color:${card.color}; flex-shrink:0;"><span class="material-symbols-rounded" style="font-size:14px;">${card.icon}</span></div>
        <div style="display:flex; flex-direction:column; gap:2px; min-width:0;"><div style="font-size:16px; font-weight:700; color:#111827; line-height:1; font-family:Inter,sans-serif;">${formatNumber(card.count)}</div><div style="font-size:11px; font-weight:500; color:#6B7280; font-family:Inter,sans-serif; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${escapeHTML(String(card.label))}">${escapeHTML(String(card.label))}</div></div>
      </div>`).join('')}</div>`;
  }
  if (moduleKey === 'expense') {
    const costFinancials = currentFacetedSummary?.expense_cost_financials || originalFacetedSummary[moduleKey]?.expense_cost_financials;
    const baseCurr = (typeof window.getActiveBaseCurrency === 'function' ? window.getActiveBaseCurrency() : 'VND') || 'VND';

    let totalCount = typeof currentTableTotal !== 'undefined' && currentTableTotal !== null ? currentTableTotal : (data ? data.length : 0);
    let totalBaseSum = 0;
    let costData = {};

    if (costFinancials && Object.keys(costFinancials).length > 0) {
      Object.entries(costFinancials).forEach(([costKey, info]) => {
        const baseVal = parseFloat(info.total_base_val != null ? info.total_base_val : (info.total_ex_vat || 0)) || 0;
        costData[costKey] = {
          count: info.count || 0,
          sumBase: baseVal
        };
        totalBaseSum += baseVal;
      });
    } else {
      (data || []).forEach(r => {
        const costKey = String(r.id__expense_cost !== undefined && r.id__expense_cost !== null ? r.id__expense_cost : (r.expense_cost || 'Unassigned')).trim();
        const baseVal = parseFloat(r.total_value_in_base_currency != null ? r.total_value_in_base_currency : (parseFloat(r.value_before_vat_in_base_currency) || 0)) || (parseFloat(r.value_before_vat) || 0);

        if (!costData[costKey]) {
          costData[costKey] = { count: 0, sumBase: 0 };
        }
        costData[costKey].count += 1;
        costData[costKey].sumBase += baseVal;
        totalBaseSum += baseVal;
      });
    }

    const palette = [
      { color: '#f97316', bg: '#fff1e8', icon: 'receipt_long' },
      { color: '#10b981', bg: '#ecfdf5', icon: 'payments' },
      { color: '#3b82f6', bg: '#eff6ff', icon: 'account_balance_wallet' },
      { color: '#7c3aed', bg: '#f5f3ff', icon: 'trending_down' },
      { color: '#0284c7', bg: '#e0f2fe', icon: 'shopping_bag' },
      { color: '#ec4899', bg: '#fdf2f8', icon: 'category' },
      { color: '#64748b', bg: '#f3f4f6', icon: 'folder' }
    ];

    const cards = [
      {
        label: typeof t === 'function' ? t('total_expenses', 'Total Expenses') : 'Total Expenses',
        count: totalCount,
        detail: `${formatNumber(Math.round(totalBaseSum))} ${baseCurr}`,
        color: '#f97316',
        bg: '#fff1e8',
        icon: 'receipt_long'
      }
    ];

    let pIdx = 1;
    Object.keys(costData).sort().forEach(costKey => {
      const info = costData[costKey];
      const style = palette[pIdx % palette.length];
      pIdx++;
      cards.push({
        label: typeof t_val === 'function' ? t_val(costKey) : costKey,
        count: info.count,
        detail: `${formatNumber(Math.round(info.sumBase))} ${baseCurr}`,
        color: style.color,
        bg: style.bg,
        icon: style.icon
      });
    });

    return `<div class="dv-status-cards expense-status-cards" style="display:flex; gap:12px; width:100%; overflow-x:auto; padding-bottom:2px;">${cards.map(card => `
      <div class="dv-status-card" style="flex:1; min-width:180px; height:64px; background:#ffffff; border:1px solid #E5E7EB; border-radius:12px; padding:10px 12px; display:flex; align-items:center; gap:12px; box-shadow:0 1px 2px rgba(16,24,40,0.04); border-bottom:3px solid ${card.color};">
        <div style="width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; background:${card.bg}; color:${card.color}; flex-shrink:0;"><span class="material-symbols-rounded" style="font-size:14px;">${card.icon}</span></div>
        <div style="display:flex; flex-direction:column; gap:2px; min-width:0;">
          <div style="display:flex; align-items:baseline; gap:6px;">
            <span style="font-size:16px; font-weight:700; color:#111827; line-height:1; font-family:Inter,sans-serif;">${formatNumber(card.count)}</span>
            ${card.detail ? `<span style="font-size:10px; color:#6B7280; font-weight:600; font-family:Inter,sans-serif; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${card.detail}">${card.detail}</span>` : ''}
          </div>
          <div style="font-size:11px; font-weight:500; color:#6B7280; font-family:Inter,sans-serif; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${escapeHTML(card.label)}">${escapeHTML(card.label)}</div>
        </div>
      </div>`).join('')}</div>`;
  }
  if (moduleKey === 'finance') {
    const financials = currentFacetedSummary?.finance_financials || originalFacetedSummary[moduleKey]?.finance_financials;
    const baseCurr = (typeof window.getActiveBaseCurrency === 'function' ? window.getActiveBaseCurrency() : 'VND') || 'VND';
    let totalSelling = 0;
    let totalCost = 0;
    let totalPaidSelling = 0;
    let totalPaidBuying = 0;

    if (financials && typeof financials.total_selling !== 'undefined') {
      totalSelling = parseFloat(financials.total_selling) || 0;
      totalCost = parseFloat(financials.total_cost) || 0;
      totalPaidSelling = parseFloat(financials.total_paid_selling) || 0;
      totalPaidBuying = parseFloat(financials.total_paid_buying) || 0;
    } else {
      (data || []).forEach(r => {
        totalSelling += parseFloat(r.selling) || 0;
        totalCost += (parseFloat(r.buying) || 0) + (parseFloat(r.expense_value) || 0) + (parseFloat(r.asset) || 0);
        totalPaidSelling += parseFloat(r.paid_selling) || 0;
        totalPaidBuying += parseFloat(r.paid_buying) || 0;
      });
    }

    const cards = [
      {
        label: typeof t === 'function' ? t('finance.total_revenue', 'Tổng doanh thu') : 'Tổng doanh thu',
        countStr: `${formatNumber(Math.round(totalSelling))} ${baseCurr}`,
        color: '#10B981',
        bg: '#ECFDF5',
        icon: 'trending_up'
      },
      {
        label: typeof t === 'function' ? t('finance.total_cost', 'Tổng chi phí') : 'Tổng chi phí',
        countStr: `${formatNumber(Math.round(totalCost))} ${baseCurr}`,
        color: '#EF4444',
        bg: '#FEF2F2',
        icon: 'trending_down'
      },
      {
        label: typeof t === 'function' ? t('finance.total_paid_selling', 'Tổng đã thu bán ra') : 'Tổng đã thu bán ra',
        countStr: `${formatNumber(Math.round(totalPaidSelling))} ${baseCurr}`,
        color: '#3B82F6',
        bg: '#EFF6FF',
        icon: 'payments'
      },
      {
        label: typeof t === 'function' ? t('finance.total_paid_buying', 'Tổng đã chi mua vào') : 'Tổng đã chi mua vào',
        countStr: `${formatNumber(Math.round(totalPaidBuying))} ${baseCurr}`,
        color: '#F97316',
        bg: '#FFF7ED',
        icon: 'shopping_cart_checkout'
      }
    ];

    return `<div class="dv-status-cards finance-status-cards" style="display:flex; gap:12px; width:100%; overflow-x:auto; padding-bottom:2px;">${cards.map(card => `
      <div class="dv-status-card" style="flex:1; min-width:160px; height:64px; background:#ffffff; border:1px solid #E5E7EB; border-radius:12px; padding:10px 12px; display:flex; align-items:center; gap:12px; box-shadow:0 1px 2px rgba(16,24,40,0.04); border-bottom:3px solid ${card.color};">
        <div style="width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; background:${card.bg}; color:${card.color}; flex-shrink:0;"><span class="material-symbols-rounded" style="font-size:14px;">${card.icon}</span></div>
        <div style="display:flex; flex-direction:column; gap:2px; min-width:0;">
          <div style="font-size:15px; font-weight:700; color:#111827; line-height:1; font-family:Inter,sans-serif;">${card.countStr}</div>
          <div style="font-size:11px; font-weight:500; color:#6B7280; font-family:Inter,sans-serif; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${escapeHTML(card.label)}">${escapeHTML(card.label)}</div>
        </div>
      </div>`).join('')}</div>`;
  }
  if (!['employee', 'employee_active', 'payment', 'request', 'service', 'asset', 'mtr', 'oppotunity'].includes(moduleKey)) {
    return '';
  }
  let counts = {};
  let colorMap = {};
  let totalCount = currentTableTotal || data.length;

  const isClientSideStatusCards = ['oppotunity'].includes(moduleKey);
  if (currentTableSummary && !isClientSideStatusCards) {
    counts = { ...currentTableSummary };
    if (originalFacetedSummary[moduleKey]) {
      let facetKey = '';
      if (moduleKey === 'employee' || moduleKey === 'employee_active') facetKey = 'status';
      else if (moduleKey === 'payment') facetKey = 'payment_status';

      else if (moduleKey === 'invoice') facetKey = 'invoice_status';
      else if (moduleKey === 'request') facetKey = 'sr_status';
      else if (moduleKey === 'service') facetKey = 'status';
      else if (moduleKey === 'asset') facetKey = 'status';
      else if (moduleKey === 'mtr') facetKey = 'transaction_type';
      else if (moduleKey === 'account') facetKey = 'account_status';
      else if (moduleKey === 'oppotunity') facetKey = 'status';

      if (facetKey && originalFacetedSummary[moduleKey][facetKey]) {
        for (const k of Object.keys(originalFacetedSummary[moduleKey][facetKey])) {
          if (!(k in counts)) counts[k] = 0;
        }
      }
    }
  } else {
    if (moduleKey === 'employee' || moduleKey === 'employee_active') {
      data.forEach(r => {
        const s = r.status || 'Inactive';
        counts[s] = (counts[s] || 0) + 1;
      });
    } else if (moduleKey === 'payment') {
      data.forEach(r => {
        const s = r.payment_status || 'Pending';
        counts[s] = (counts[s] || 0) + 1;
      });

    } else if (moduleKey === 'invoice') {
      data.forEach(r => {
        const s = r.invoice_status || 'Draft';
        counts[s] = (counts[s] || 0) + 1;
      });
    } else if (moduleKey === 'request') {
      data.forEach(r => {
        const s = r.sr_status || 'Draft';
        counts[s] = (counts[s] || 0) + 1;
      });
    } else if (moduleKey === 'service') {
      data.forEach(r => {
        const s = r.status || 'Not started yet';
        counts[s] = (counts[s] || 0) + 1;
      });
    } else if (moduleKey === 'asset') {
      data.forEach(r => {
        const s = r.status || 'Active';
        counts[s] = (counts[s] || 0) + 1;
      });
    } else if (moduleKey === 'mtr') {
      data.forEach(r => {
        const s = r.transaction_type || 'Internal';
        counts[s] = (counts[s] || 0) + 1;
      });
    } else if (moduleKey === 'account') {
      data.forEach(r => {
        const s = r.account_status || 'Open';
        counts[s] = (counts[s] || 0) + 1;
      });
    } else if (moduleKey === 'oppotunity') {
      data.forEach(r => {
        const s = r.status || 'Open';
        counts[s] = (counts[s] || 0) + 1;
      });
    }
    totalCount = data.length;
  }

  if (moduleKey === 'employee' || moduleKey === 'employee_active') {
    colorMap = { 'Active': '#10b981', 'Inactive': '#ef4444' };
  } else if (moduleKey === 'payment') {
    colorMap = {
      'Draft': '#64748b',
      'Paid': '#10b981',
      'Not Due Yet': '#0284c7',
      'Overdue': '#ef4444',
      'Submitted For Payment': '#f59e0b',
      'Submitted for Payment': '#f59e0b',
      'Pending': '#3b82f6',
      'Processing': '#8b5cf6',
      'Failed': '#dc2626',
      'Cancelled': '#64748b',
      'Rejected': '#f43f5e'
    };

  } else if (moduleKey === 'invoice') {
    counts = {
      'Draft': 0,
      'Issued': 0,
      'Paid': 0,
      'Void': 0,
      ...counts
    };
    colorMap = { 'Draft': '#64748b', 'Issued': '#3b82f6', 'Paid': '#10b981', 'Void': '#ef4444' };
  } else if (moduleKey === 'request') {
    colorMap = { 'Draft': '#64748b', 'Submitted': '#3b82f6', 'Pending Approval': '#3b82f6', 'Approved': '#10b981', 'Rejected': '#ef4444', 'Closed': '#64748b', 'Open': '#64748b' };
  } else if (moduleKey === 'service') {
    colorMap = { 'not_started_yet': '#64748b', 'on_going': '#3b82f6', 'going_to_expired': '#f59e0b', 'expired': '#ef4444' };
  } else if (moduleKey === 'asset') {
    colorMap = { 'failured': '#ef4444', 'in_used': '#10b981', 'no_used': '#64748b' };
  } else if (moduleKey === 'mtr') {
    colorMap = {
      'Incoming payment': '#10b981',
      'Outgoing payment': '#3b82f6',
      'Internal payment': '#7c3aed',
      'Incoming Payment': '#10b981',
      'Outgoing Payment': '#3b82f6',
      'Internal Payment': '#7c3aed',
      'Unknown': '#64748b'
    };
  } else if (moduleKey === 'account') {
    colorMap = { 'Open': '#10b981', 'Closed': '#ef4444' };
  } else if (moduleKey === 'oppotunity') {
    colorMap = { '52': '#3b82f6', '53': '#10b981', '54': '#ef4444', 'Open': '#3b82f6', 'Closed Won': '#10b981', 'Closed Lost': '#ef4444' };
  }

  const icons = {
    'Draft': 'edit_note',
    'Paid': 'task_alt',
    'Not Due Yet': 'schedule',
    'Overdue': 'warning',
    'Submitted For Payment': 'send',
    'Submitted for Payment': 'send',
    'Pending': 'hourglass_top',
    'Processing': 'sync',
    'Failed': 'cancel',
    'Cancelled': 'block',
    'Rejected': 'highlight_off',
    'Active': 'check_circle',
    'Inactive': 'cancel',
    'CAPEX': 'account_balance',
    'OPEX': 'trending_up',
    'Not started yet': 'hourglass_empty',
    'Hết hiệu lực': 'gavel',
    'Failured': 'report_problem',
    'Không được sử dụng': 'block',
    'Completed': 'done_all',
    'Inbound': 'arrow_downward',
    'Outbound': 'arrow_upward',
    'Internal': 'sync_alt',
    'Incoming payment': 'arrow_downward',
    'Outgoing payment': 'arrow_upward',
    'Internal payment': 'sync_alt',
    'Incoming Payment': 'arrow_downward',
    'Outgoing Payment': 'arrow_upward',
    'Internal Payment': 'sync_alt',
    'Open': 'lock_open',
    'Closed': 'lock',
    'Closed Won': 'emoji_events',
    'Closed Lost': 'sentiment_dissatisfied',
    'Unknown': 'help_outline'
  };

  const getBgLight = (hex) => {
    const h = hex.toLowerCase();
    if (['#10b981', '#22c55e', '#16a34a'].includes(h)) return '#ecfdf5';
    if (['#ef4444', '#dc2626', '#f43f5e'].includes(h)) return '#fef2f2';
    if (['#f59e0b', '#d97706', '#eab308'].includes(h)) return '#fffbeb';
    if (['#3b82f6', '#2563eb', '#0284c7', '#06b6d4'].includes(h)) return '#eff6ff';
    if (['#7c3aed', '#8b5cf6'].includes(h)) return '#f5f3ff';
    if (['#ea580c', '#f97316', '#ff6a00'].includes(h)) return '#fff1e8';
    if (['#64748b', '#94a3b8'].includes(h)) return '#f8fafc';
    return '#f3f4f6';
  };

  const resolveStyle = (st) => {
    if (!st) return { color: '#64748b', icon: 'info' };
    const raw = String(st).trim();
    const lc = raw.toLowerCase().replace(/\s+/g, '_');
    
    if (colorMap[raw]) return { color: colorMap[raw], icon: icons[raw] || 'info' };
    if (colorMap[lc]) return { color: colorMap[lc], icon: icons[lc] || icons[raw] || 'info' };

    if (['draft'].includes(lc)) return { color: '#64748b', icon: 'edit_note' };
    if (['pending', 'pending_approval', 'submitted', 'on_going', 'processing'].includes(lc)) return { color: '#3b82f6', icon: 'hourglass_top' };
    if (['approved', 'paid', 'active', 'completed', 'closed_won', 'in_used'].includes(lc)) return { color: '#10b981', icon: 'task_alt' };
    if (['rejected', 'cancelled', 'canceled', 'failed', 'failured', 'closed_lost', 'void', 'expired', 'inactive'].includes(lc)) return { color: '#ef4444', icon: 'cancel' };
    if (['ready_for_payment', 'ready_to_issue', 'going_to_expired'].includes(lc)) return { color: '#f59e0b', icon: 'schedule' };
    
    return { color: '#64748b', icon: 'info' };
  };

  const baseCurr = (typeof window.getActiveBaseCurrency === 'function' ? window.getActiveBaseCurrency() : 'VND') || 'VND';
  const cardBaseSums = {};
  if (moduleKey === 'payment' && Array.isArray(data)) {
    data.forEach(r => {
      const s = r.payment_status || 'Pending';
      const baseVal = parseFloat(r.value_in_base_currency != null ? r.value_in_base_currency : (parseFloat(r.total_value) || parseFloat(r.value) || 0) * (parseFloat(r.exchange_rate) || 1)) || 0;
      cardBaseSums[s] = (cardBaseSums[s] || 0) + baseVal;
    });
  } else if (moduleKey === 'mtr' && Array.isArray(data)) {
    data.forEach(r => {
      const s = r.transaction_type || 'Internal';
      const baseVal = parseFloat(r.amount_in_base_currency != null ? r.amount_in_base_currency : r.amount) || 0;
      cardBaseSums[s] = (cardBaseSums[s] || 0) + baseVal;
    });
  }

  let html = '<div class="dv-status-cards" style="display:flex; gap:12px; width: 100%; overflow-x: auto; padding-bottom: 2px;">';
  for (const [status, count] of Object.entries(counts)) {
    const style = resolveStyle(status);
    const color = style.color;
    const icon = style.icon;
    const bgLight = getBgLight(color);

    // Capitalize status to Title Case or translate if possible
    const label = typeof t_val === 'function' ? t_val(status) : status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const sumVal = cardBaseSums[status];
    const detail = sumVal ? `${formatNumber(Math.round(sumVal))} ${baseCurr}` : '';

    html += `
      <div class="dv-status-card" style="flex:1; min-width:120px; height:64px; background:#ffffff; border:1px solid #E5E7EB; border-radius:12px; padding:10px 12px; display:flex; align-items:center; gap:12px; box-shadow: 0 1px 2px rgba(16,24,40,0.04); border-bottom: 3px solid ${color}; transition: all 0.2s ease;">
        <div class="dv-card-icon" style="width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; background:${bgLight}; color:${color}; flex-shrink:0;">
          <span class="material-symbols-rounded" style="font-size:14px;">${icon}</span>
        </div>
        <div class="dv-card-info" style="display:flex; flex-direction:column; gap:2px; min-width:0;">
          <div style="display:flex; align-items:baseline; gap:6px;">
            <span class="dv-card-count" style="font-size:16px; font-weight:700; color:#111827; line-height:1; font-family:Inter, sans-serif;">${formatNumber(count)}</span>
            ${detail ? `<span style="font-size:10px; color:#6B7280; font-weight:600; font-family:Inter,sans-serif; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${detail}">${detail}</span>` : ''}
          </div>
          <div class="dv-card-label" style="font-size:11px; font-weight:500; color:#6B7280; font-family:Inter, sans-serif; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; line-height:1.3; text-transform:none !important; letter-spacing:normal !important;">${label}</div>
        </div>
      </div>
    `;
  }
  html += '</div>';
  return html;
}

window.expandedFilterGroups = window.expandedFilterGroups || new Set();

window.toggleMoreFilterOptions = function (btn, groupUniqueKey) {
  const container = btn.previousElementSibling;
  if (container && container.classList.contains('dv-filter-more-options')) {
    const isHidden = container.style.display === 'none';
    container.style.display = isHidden ? 'block' : 'none';
    if (isHidden) {
      window.expandedFilterGroups.add(groupUniqueKey);
      btn.textContent = 'less';
    } else {
      window.expandedFilterGroups.delete(groupUniqueKey);
      btn.textContent = 'more ...';
    }
  }
};

function resolveFilterDisplayVal(groupKey, val) {
  if (val === null || val === undefined || val === '') return 'N/A';
  let displayVal = val;
  const statusKeys = [
    'status', 'sr_status', 'process_status', 'payment_status', 'invoice_status',
    'account_status', 'service_status', 'asset_status', 'payment_type', 'invoice_type',
    'service_type', 'asset_type', 'type', 'contract_type', 'policy_type',
    'billing_status', 'subscription_status', 'approval_status', 'rating_status', 'role', 'gen', 'gender',
    'id__expense_type', 'id__expense_cost'
  ];
  if (statusKeys.includes(groupKey) || (!isNaN(Number(val)) && typeof val !== 'boolean')) {
    if (typeof t_val === 'function') {
      const res = t_val(val);
      if (res !== undefined && res !== null) return res;
    }
  }
  if (groupKey === 'month') {
    const monthNames = {
      en: { '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr', '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Aug', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec' },
      vi: { '01': 'Tháng 1', '02': 'Tháng 2', '03': 'Tháng 3', '04': 'Tháng 4', '05': 'Tháng 5', '06': 'Tháng 6', '07': 'Tháng 7', '08': 'Tháng 8', '09': 'Tháng 9', '10': 'Tháng 10', '11': 'Tháng 11', '12': 'Tháng 12' }
    };
    displayVal = monthNames[currentLang === 'vi' ? 'vi' : 'en'][val] || val;
  } else if (groupKey === 'table_name') {
    displayVal = val ? (val.charAt(0).toUpperCase() + val.slice(1).replace(/_/g, ' ')) : '';
  } else if (groupKey === 'contract_owner' || groupKey === 'requester' || groupKey === 'sr_creater' || groupKey === 'policy_lead' || groupKey === 'direct_manager') {
    displayVal = resolveEmployeeName(val) || val;
  } else if (groupKey === 'operation_program_id') {
    const opIdToName = {};
    if (selectCache['operation_program']) {
      selectCache['operation_program'].forEach(op => {
        if (op.oper_id) opIdToName[String(op.oper_id)] = op.payment_name;
      });
    }
    displayVal = (val === 'Unknown' || val === null || val === undefined || val === 'N/A') ? 'N/A' : (opIdToName[String(val)] || val);
  } else if (groupKey === 'my_company' || groupKey === 'company_id' || groupKey === 'company_entity') {
    if (selectCache['my_company']) {
      if (!selectCache['my_company_index_by_id']) {
        const m = new Map();
        selectCache['my_company'].forEach(c => m.set(String(c.my_company_id), c));
        selectCache['my_company_index_by_id'] = m;
      }
      const comp = selectCache['my_company_index_by_id'].get(String(val));
      if (comp) {
        displayVal = comp.company_shortname || comp.company_fullname || val;
      }
    }
  } else if (groupKey === 'department_name' || groupKey === 'department_id') {
    if (selectCache['department']) {
      if (!selectCache['department_index_by_name'] || selectCache['department_index_by_name']._lastLength !== selectCache['department'].length) {
        const m = new Map();
        selectCache['department'].forEach(d => {
          if (d.department_name) m.set(String(d.department_name).trim().toLowerCase(), d);
          if (d.department_id) m.set(String(d.department_id).trim().toLowerCase(), d);
        });
        m._lastLength = selectCache['department'].length;
        selectCache['department_index_by_name'] = m;
      }
      const cleanVal = String(val).trim().toLowerCase();
      const dept = selectCache['department_index_by_name'].get(cleanVal);
      if (dept) {
        displayVal = dept.department_label || dept.department_name || val;
      }
    }
  } else {
    if (typeof t_val === 'function') {
      const translated = t_val(val);
      if (translated && translated !== val) {
        displayVal = translated;
      } else if (typeof displayVal === 'string' && displayVal.length > 0) {
        displayVal = displayVal.replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      }
    }
  }
  return displayVal;
}

function buildDropdownFiltersHTML(moduleKey) {
  const mod = MODULES[moduleKey];
  const allowedModules = ['employee', 'employee_active', 'payment', 'invoice', 'my_request', 'my_approval', 'my_process_owner', 'my_task', 'request', 'service', 'asset', 'mtr', 'account', 'my_company', 'request_activity_log', 'finance', 'contract', 'expense'];
  if (!allowedModules.includes(moduleKey) && !(mod && mod.groupBy)) {
    return '';
  }

  let prefixHtml = '';
  // Finance module uses date-range filter, in addition to checkbox dropdowns
  if (moduleKey === 'finance') {
    const state = moduleStates[moduleKey] || {};
    const fromVal = state.from_date || '';
    const toVal = state.to_date || '';
    const labelFrom = typeof t === 'function' ? t('filter.from_date', 'From Date') : 'From Date';
    const labelTo = typeof t === 'function' ? t('filter.to_date', 'To Date') : 'To Date';
    prefixHtml = `
      <div class="dv-filter-group" style="padding:8px 0;">
        <div style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px;">${labelFrom}</div>
        <input type="date" value="${fromVal}" style="width:100%; padding:6px 8px; border:1px solid var(--border-light); border-radius:6px; font-size:12px; color:var(--text-primary); background:var(--bg-card); cursor:pointer;"
          onchange="window.setFinanceDateFilter('${moduleKey}', 'from_date', this.value)" />
      </div>
      <div class="dv-filter-group" style="padding:8px 0; border-top:1px solid var(--border-light); margin-bottom:12px;">
        <div style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px;">${labelTo}</div>
        <input type="date" value="${toVal}" style="width:100%; padding:6px 8px; border:1px solid var(--border-light); border-radius:6px; font-size:12px; color:var(--text-primary); background:var(--bg-card); cursor:pointer;"
          onchange="window.setFinanceDateFilter('${moduleKey}', 'to_date', this.value)" />
      </div>
    `;
  }

  // For client-side filtered modules, use original unfiltered data so sidebar counts don't disappear when a filter is active
  const serverFilteredModulesForBuild = ['employee', 'employee_active', 'payment', 'invoice', 'request', 'service', 'asset', 'mtr', 'account', 'request_activity_log', 'finance', 'contract', 'expense', 'action_rules'];
  const isClientSideModule = !serverFilteredModulesForBuild.includes(moduleKey);
  const data = (isClientSideModule && originalClientData[moduleKey]) ? originalClientData[moduleKey] : (currentData || []);

  console.log('buildDropdownFiltersHTML:', moduleKey, {
    currentFacetedSummary,
    originalFacetedSummary: originalFacetedSummary[moduleKey],
    dataLength: data.length
  });

  const filters = activeDropdownFilters[moduleKey] || {};
  let filterGroups = [];

  if (moduleKey === 'employee' || moduleKey === 'employee_active') {
    const companyCounts = {};
    if (originalFacetedSummary[moduleKey] && originalFacetedSummary[moduleKey].company_shortname) {
      for (const k of Object.keys(originalFacetedSummary[moduleKey].company_shortname)) companyCounts[k] = originalFacetedSummary[moduleKey].company_shortname[k] || 0;
    }
    if (currentFacetedSummary && currentFacetedSummary.company_shortname) {
      for (const k of Object.keys(companyCounts)) companyCounts[k] = 0;
      for (const [k, v] of Object.entries(currentFacetedSummary.company_shortname)) companyCounts[k] = v;
    } else {
      data.forEach(r => { const val = r.company_shortname || 'N/A'; companyCounts[val] = (companyCounts[val] || 0) + 1; });
    }
    filterGroups.push({ key: 'my_company', label: 'Company', values: companyCounts });

    const deptCounts = {};
    if (originalFacetedSummary[moduleKey] && originalFacetedSummary[moduleKey].department_name) {
      for (const k of Object.keys(originalFacetedSummary[moduleKey].department_name)) deptCounts[k] = originalFacetedSummary[moduleKey].department_name[k] || 0;
    }
    if (currentFacetedSummary && currentFacetedSummary.department_name) {
      for (const k of Object.keys(deptCounts)) deptCounts[k] = 0;
      for (const [k, v] of Object.entries(currentFacetedSummary.department_name)) deptCounts[k] = (deptCounts[k] || 0) + v;
    } else {
      data.forEach(r => { const val = r.department_name || 'N/A'; deptCounts[val] = (deptCounts[val] || 0) + 1; });
    }
    filterGroups.push({ key: 'department_name', label: 'Department', values: deptCounts });

    if (moduleKey === 'employee') {
      const statusCounts = {};
      if (originalFacetedSummary[moduleKey] && originalFacetedSummary[moduleKey].status) {
        for (const k of Object.keys(originalFacetedSummary[moduleKey].status)) statusCounts[k] = originalFacetedSummary[moduleKey].status[k] || 0;
      }
      if (currentFacetedSummary && currentFacetedSummary.status) {
        for (const k of Object.keys(statusCounts)) statusCounts[k] = 0;
        for (const [k, v] of Object.entries(currentFacetedSummary.status)) statusCounts[k] = v;
      } else {
        for (const k of Object.keys(statusCounts)) statusCounts[k] = 0;
        data.forEach(r => { const val = r.status || 'Inactive'; statusCounts[val] = (statusCounts[val] || 0) + 1; });
      }
      filterGroups.push({ key: 'status', label: 'Status', values: statusCounts });

      const seatCounts = {};
      if (originalFacetedSummary[moduleKey] && originalFacetedSummary[moduleKey].app_user_enabled) {
        for (const k of Object.keys(originalFacetedSummary[moduleKey].app_user_enabled)) {
          const name = k === 'true' ? 'Enabled' : 'Disabled';
          seatCounts[name] = originalFacetedSummary[moduleKey].app_user_enabled[k] || 0;
        }
      }
      if (currentFacetedSummary && currentFacetedSummary.app_user_enabled) {
        for (const k of Object.keys(seatCounts)) seatCounts[k] = 0;
        for (const [k, v] of Object.entries(currentFacetedSummary.app_user_enabled)) {
          const name = k === 'true' ? 'Enabled' : 'Disabled';
          seatCounts[name] = v;
        }
      } else {
        data.forEach(r => {
          const val = r.app_user_enabled === true || r.app_user_enabled === 'true' ? 'Enabled' : 'Disabled';
          seatCounts[val] = (seatCounts[val] || 0) + 1;
        });
      }
      filterGroups.push({ key: 'app_user_enabled', label: 'App User Access', values: seatCounts });
    }

  } else if (moduleKey === 'payment') {
    // 1. FY
    const fyCounts = {};
    if (originalFacetedSummary[moduleKey] && originalFacetedSummary[moduleKey].fy) {
      for (const k of Object.keys(originalFacetedSummary[moduleKey].fy)) fyCounts[k] = originalFacetedSummary[moduleKey].fy[k] || 0;
    }
    if (currentFacetedSummary && currentFacetedSummary.fy) {
      for (const k of Object.keys(fyCounts)) fyCounts[k] = 0;
      for (const [k, v] of Object.entries(currentFacetedSummary.fy)) fyCounts[k] = v;
    } else {
      for (const k of Object.keys(fyCounts)) fyCounts[k] = 0;
      data.forEach(r => { const val = getFiscalYear(r.created_date); fyCounts[val] = (fyCounts[val] || 0) + 1; });
    }
    filterGroups.push({ key: 'fy', label: 'Fiscal Year', values: fyCounts });

    // 2. My Company
    const companyCounts = {};
    if (originalFacetedSummary[moduleKey] && originalFacetedSummary[moduleKey].company_id) {
      for (const k of Object.keys(originalFacetedSummary[moduleKey].company_id)) {
        const name = k === 'Unknown' ? 'N/A' : k;
        companyCounts[name] = originalFacetedSummary[moduleKey].company_id[k] || 0;
      }
    }
    if (currentFacetedSummary && currentFacetedSummary.company_id) {
      for (const k of Object.keys(companyCounts)) companyCounts[k] = 0;
      for (const [k, v] of Object.entries(currentFacetedSummary.company_id)) {
        const name = k === 'Unknown' ? 'N/A' : k;
        companyCounts[name] = v;
      }
    } else {
      for (const k of Object.keys(companyCounts)) companyCounts[k] = 0;
      data.forEach(r => { const val = resolveCompanyForRecord(r); companyCounts[val] = (companyCounts[val] || 0) + 1; });
    }
    filterGroups.push({ key: 'my_company', label: 'Company', values: companyCounts });

    // 3. Payment type
    const typeCounts = {};
    if (originalFacetedSummary[moduleKey] && originalFacetedSummary[moduleKey].payment_type) {
      for (const k of Object.keys(originalFacetedSummary[moduleKey].payment_type)) typeCounts[k] = originalFacetedSummary[moduleKey].payment_type[k] || 0;
    }
    if (currentFacetedSummary && currentFacetedSummary.payment_type) {
      for (const k of Object.keys(typeCounts)) typeCounts[k] = 0;
      for (const [k, v] of Object.entries(currentFacetedSummary.payment_type)) typeCounts[k] = v;
    } else {
      for (const k of Object.keys(typeCounts)) typeCounts[k] = 0;
      data.forEach(r => { const val = r.payment_type || 'N/A'; typeCounts[val] = (typeCounts[val] || 0) + 1; });
    }
    filterGroups.push({ key: 'payment_type', label: 'Payment Type', values: typeCounts });

    // 4. Payment status
    const statusCounts = {};
    if (originalFacetedSummary[moduleKey] && originalFacetedSummary[moduleKey].payment_status) {
      for (const k of Object.keys(originalFacetedSummary[moduleKey].payment_status)) statusCounts[k] = originalFacetedSummary[moduleKey].payment_status[k] || 0;
    }
    if (currentFacetedSummary && currentFacetedSummary.payment_status) {
      for (const k of Object.keys(statusCounts)) statusCounts[k] = 0;
      for (const [k, v] of Object.entries(currentFacetedSummary.payment_status)) statusCounts[k] = v;
    } else {
      for (const k of Object.keys(statusCounts)) statusCounts[k] = 0;
      data.forEach(r => { const val = r.payment_status || 'N/A'; statusCounts[val] = (statusCounts[val] || 0) + 1; });
    }
    filterGroups.push({ key: 'payment_status', label: 'Payment Status', values: statusCounts });

    // 5. Payment method
    const methodCounts = {
      'Bank Transfer': 0,
      'Bank TT': 0,
      'Cash': 0
    };
    if (originalFacetedSummary[moduleKey] && originalFacetedSummary[moduleKey].payment_method) {
      for (const k of Object.keys(originalFacetedSummary[moduleKey].payment_method)) {
        methodCounts[k] = originalFacetedSummary[moduleKey].payment_method[k] || 0;
      }
    }
    if (currentFacetedSummary && currentFacetedSummary.payment_method) {
      for (const k of Object.keys(methodCounts)) {
        methodCounts[k] = currentFacetedSummary.payment_method[k] || 0;
      }
    } else {
      for (const k of Object.keys(methodCounts)) methodCounts[k] = 0;
      data.forEach(r => { const val = r.payment_method || 'N/A'; methodCounts[val] = (methodCounts[val] || 0) + 1; });
    }
    filterGroups.push({ key: 'payment_method', label: 'Payment Method', values: methodCounts });

    // 6. Overdue
    const overdueCounts = {
      '0 - 30 days': 0,
      '30 - 60 days': 0,
      '60 - 90 days': 0,
      'Over 90 days': 0
    };
    if (originalFacetedSummary[moduleKey] && originalFacetedSummary[moduleKey].overdue) {
      for (const k of Object.keys(overdueCounts)) {
        overdueCounts[k] = originalFacetedSummary[moduleKey].overdue[k] || 0;
      }
    }
    if (currentFacetedSummary && currentFacetedSummary.overdue) {
      for (const k of Object.keys(overdueCounts)) {
        overdueCounts[k] = currentFacetedSummary.overdue[k] || 0;
      }
    } else {
      for (const k of Object.keys(overdueCounts)) overdueCounts[k] = 0;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      data.forEach(r => {
        const isPaid = Number(r.payment_status) === 32;
        if (!isPaid && r.due_date) {
          const dueDate = new Date(r.due_date);
          dueDate.setHours(0, 0, 0, 0);
          if (dueDate < today) {
            const diffTime = Math.abs(today - dueDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays <= 30) overdueCounts['0 - 30 days']++;
            else if (diffDays <= 60) overdueCounts['30 - 60 days']++;
            else if (diffDays <= 90) overdueCounts['60 - 90 days']++;
            else overdueCounts['Over 90 days']++;
          }
        }
      });
    }
    filterGroups.push({ key: 'overdue', label: 'Overdue', values: overdueCounts });



  } else if (moduleKey === 'invoice') {
    const buildInvoiceFacet = (facetKey, rowKey, fallbackValue) => {
      const counts = {};
      const originalFacet = originalFacetedSummary[moduleKey]?.[facetKey];
      const currentFacet = currentFacetedSummary?.[facetKey];

      if (originalFacet) {
        for (const k of Object.keys(originalFacet)) counts[k] = originalFacet[k] || 0;
      }

      if (currentFacet) {
        for (const k of Object.keys(counts)) counts[k] = 0;
        for (const [k, v] of Object.entries(currentFacet)) counts[k] = v;
      } else {
        for (const k of Object.keys(counts)) counts[k] = 0;
        data.forEach(r => {
          const val = r[rowKey] || fallbackValue;
          counts[val] = (counts[val] || 0) + 1;
        });
      }

      return counts;
    };

    const statusCounts = buildInvoiceFacet('invoice_status', 'invoice_status', 'draft');
    const typeCounts = buildInvoiceFacet('invoice_type', 'invoice_type', 'N/A');
    const currencyCounts = buildInvoiceFacet('currency', 'currency', 'N/A');

    filterGroups.push({ key: 'invoice_status', label: 'Invoice Status', values: statusCounts });
    filterGroups.push({ key: 'invoice_type', label: 'Invoice Type', values: typeCounts });
    filterGroups.push({ key: 'currency', label: 'Currency', values: currencyCounts });

  } else if (['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team', 'request'].includes(moduleKey)) {
    const statusCounts = {};

    if (originalFacetedSummary[moduleKey] && originalFacetedSummary[moduleKey].sr_status) {
      for (const k of Object.keys(originalFacetedSummary[moduleKey].sr_status)) statusCounts[k] = originalFacetedSummary[moduleKey].sr_status[k] || 0;
    }
    if (currentFacetedSummary && currentFacetedSummary.sr_status) {
      for (const k of Object.keys(statusCounts)) statusCounts[k] = 0;
      for (const [k, v] of Object.entries(currentFacetedSummary.sr_status)) statusCounts[k] = v;
    } else {
      for (const k of Object.keys(statusCounts)) statusCounts[k] = 0;
      data.forEach(r => {
        let val;
        if (['my_task', 'my_process_owner'].includes(moduleKey)) val = r.process_status || 'N/A';
        else val = r.sr_status || 'N/A';
        statusCounts[val] = (statusCounts[val] || 0) + 1;
      });
    }
    filterGroups.push({ key: 'status', label: 'Status', values: statusCounts });

    const policyCounts = {};
    if (originalFacetedSummary[moduleKey] && originalFacetedSummary[moduleKey].policy_name) {
      for (const k of Object.keys(originalFacetedSummary[moduleKey].policy_name)) {
        const name = k.toUpperCase().startsWith('OPPORTUNITY') ? 'Opportunity' : k;
        policyCounts[name] = originalFacetedSummary[moduleKey].policy_name[k] || 0;
      }
    }
    if (currentFacetedSummary && currentFacetedSummary.policy_name) {
      for (const k of Object.keys(policyCounts)) policyCounts[k] = 0;
      for (const [k, v] of Object.entries(currentFacetedSummary.policy_name)) {
        const name = k.toUpperCase().startsWith('OPPORTUNITY') ? 'Opportunity' : k;
        policyCounts[name] = v;
      }
    } else {
      for (const k of Object.keys(policyCounts)) policyCounts[k] = 0;
      data.forEach(r => { const val = r.policy_name || resolveLookupValue(moduleKey, 'request_type', r.request_type) || 'N/A'; policyCounts[val] = (policyCounts[val] || 0) + 1; });
    }
    filterGroups.push({ key: 'policy_name', label: 'Process Name / Process Type', values: policyCounts });
  } else if (moduleKey === 'service' || moduleKey === 'asset' || moduleKey === 'mtr' || moduleKey === 'account' || moduleKey === 'my_company' || moduleKey === 'request_activity_log' || moduleKey === 'finance') {
    if (moduleKey === 'service') {
      // 1. Fiscal Year
      const fyCounts = {};
      if (originalFacetedSummary[moduleKey] && originalFacetedSummary[moduleKey].fy) {
        for (const k of Object.keys(originalFacetedSummary[moduleKey].fy)) fyCounts[k] = originalFacetedSummary[moduleKey].fy[k] || 0;
      }
      if (currentFacetedSummary && currentFacetedSummary.fy) {
        for (const k of Object.keys(fyCounts)) fyCounts[k] = 0;
        for (const [k, v] of Object.entries(currentFacetedSummary.fy)) fyCounts[k] = v;
      } else {
        for (const k of Object.keys(fyCounts)) fyCounts[k] = 0;
        data.forEach(r => { const val = r.fy || 'N/A'; fyCounts[val] = (fyCounts[val] || 0) + 1; });
      }
      filterGroups.push({ key: 'fy', label: 'Fiscal Year', values: fyCounts });

      // 2. Company
      const companyCounts = {};
      const companyIdToName = {};
      if (selectCache['my_company']) {
        selectCache['my_company'].forEach(c => {
          if (c.my_company_id) companyIdToName[String(c.my_company_id)] = c.company_shortname || c.company_fullname;
        });
      }
      const resolveCompanyKey = (k) => {
        if (k === 'Unknown' || k === null || k === undefined) return 'N/A';
        return companyIdToName[String(k)] || k;
      };
      if (originalFacetedSummary[moduleKey] && originalFacetedSummary[moduleKey].company_id) {
        for (const [k, v] of Object.entries(originalFacetedSummary[moduleKey].company_id)) {
          const name = resolveCompanyKey(k);
          companyCounts[name] = (companyCounts[name] || 0) + (v || 0);
        }
      }
      if (currentFacetedSummary && currentFacetedSummary.company_id) {
        for (const k of Object.keys(companyCounts)) companyCounts[k] = 0;
        for (const [k, v] of Object.entries(currentFacetedSummary.company_id)) {
          const name = resolveCompanyKey(k);
          companyCounts[name] = (companyCounts[name] || 0) + v;
        }
      } else {
        for (const k of Object.keys(companyCounts)) companyCounts[k] = 0;
        data.forEach(r => { const val = resolveCompanyForRecord(r); companyCounts[val] = (companyCounts[val] || 0) + 1; });
      }
      filterGroups.push({ key: 'my_company', label: 'Company', values: companyCounts });

      // 3. Service Status
      const statusCounts = {};
      if (originalFacetedSummary[moduleKey] && originalFacetedSummary[moduleKey].status) {
        for (const k of Object.keys(originalFacetedSummary[moduleKey].status)) statusCounts[k] = originalFacetedSummary[moduleKey].status[k] || 0;
      }
      if (currentFacetedSummary && currentFacetedSummary.status) {
        for (const k of Object.keys(statusCounts)) statusCounts[k] = 0;
        for (const [k, v] of Object.entries(currentFacetedSummary.status)) statusCounts[k] = v;
      } else {
        for (const k of Object.keys(statusCounts)) statusCounts[k] = 0;
        data.forEach(r => { const val = r.status || 'N/A'; statusCounts[val] = (statusCounts[val] || 0) + 1; });
      }
      filterGroups.push({ key: 'status', label: 'Service Status', values: statusCounts });

      // 4. Service Type
      const typeCounts = {};
      if (originalFacetedSummary[moduleKey] && originalFacetedSummary[moduleKey].service_type) {
        for (const k of Object.keys(originalFacetedSummary[moduleKey].service_type)) typeCounts[k] = originalFacetedSummary[moduleKey].service_type[k] || 0;
      }
      if (currentFacetedSummary && currentFacetedSummary.service_type) {
        for (const k of Object.keys(typeCounts)) typeCounts[k] = 0;
        for (const [k, v] of Object.entries(currentFacetedSummary.service_type)) typeCounts[k] = v;
      } else {
        for (const k of Object.keys(typeCounts)) typeCounts[k] = 0;
        data.forEach(r => { const val = r.service_type || 'N/A'; typeCounts[val] = (typeCounts[val] || 0) + 1; });
      }
      filterGroups.push({ key: 'service_type', label: 'Service Type', values: typeCounts });
    } else if (moduleKey === 'asset') {
      const companyCounts = {};
      if (originalFacetedSummary[moduleKey] && originalFacetedSummary[moduleKey].company_id) {
        for (const k of Object.keys(originalFacetedSummary[moduleKey].company_id)) {
          const name = k === 'Unknown' ? 'N/A' : k;
          companyCounts[name] = originalFacetedSummary[moduleKey].company_id[k] || 0;
        }
      }
      if (currentFacetedSummary && currentFacetedSummary.company_id) {
        for (const k of Object.keys(companyCounts)) companyCounts[k] = 0;
        for (const [k, v] of Object.entries(currentFacetedSummary.company_id)) {
          const name = k === 'Unknown' ? 'N/A' : k;
          companyCounts[name] = v;
        }
      } else {
        for (const k of Object.keys(companyCounts)) companyCounts[k] = 0;
        data.forEach(r => { const val = resolveCompanyForRecord(r); companyCounts[val] = (companyCounts[val] || 0) + 1; });
      }
      filterGroups.push({ key: 'my_company', label: 'Company', values: companyCounts });

      const statusCounts = {};
      if (originalFacetedSummary[moduleKey] && originalFacetedSummary[moduleKey].status) {
        for (const k of Object.keys(originalFacetedSummary[moduleKey].status)) statusCounts[k] = originalFacetedSummary[moduleKey].status[k] || 0;
      }
      if (currentFacetedSummary && currentFacetedSummary.status) {
        for (const k of Object.keys(statusCounts)) statusCounts[k] = 0;
        for (const [k, v] of Object.entries(currentFacetedSummary.status)) statusCounts[k] = v;
      } else {
        for (const k of Object.keys(statusCounts)) statusCounts[k] = 0;
        data.forEach(r => { const val = r.status || 'N/A'; statusCounts[val] = (statusCounts[val] || 0) + 1; });
      }
      filterGroups.push({ key: 'status', label: 'Asset Status', values: statusCounts });

      const typeCounts = {};
      if (originalFacetedSummary[moduleKey] && originalFacetedSummary[moduleKey].type) {
        for (const k of Object.keys(originalFacetedSummary[moduleKey].type)) typeCounts[k] = originalFacetedSummary[moduleKey].type[k] || 0;
      }
      if (currentFacetedSummary && currentFacetedSummary.type) {
        for (const k of Object.keys(typeCounts)) typeCounts[k] = 0;
        for (const [k, v] of Object.entries(currentFacetedSummary.type)) typeCounts[k] = v;
      } else {
        for (const k of Object.keys(typeCounts)) typeCounts[k] = 0;
        data.forEach(r => { const val = r.type || 'N/A'; typeCounts[val] = (typeCounts[val] || 0) + 1; });
      }
      filterGroups.push({ key: 'type', label: 'Asset Type', values: typeCounts });

    } else if (moduleKey === 'finance') {
      // 1. FY (Fiscal Year) - PLACED AT THE VERY TOP
      const fyCounts = {};
      if (originalFacetedSummary[moduleKey] && originalFacetedSummary[moduleKey].fy) {
        const sortedYears = Object.keys(originalFacetedSummary[moduleKey].fy).sort((a, b) => b.localeCompare(a));
        for (const k of sortedYears) fyCounts[k] = originalFacetedSummary[moduleKey].fy[k] || 0;
      }
      if (currentFacetedSummary && currentFacetedSummary.fy) {
        for (const k of Object.keys(fyCounts)) fyCounts[k] = 0;
        for (const [k, v] of Object.entries(currentFacetedSummary.fy)) fyCounts[k] = v;
      } else {
        data.forEach(r => {
          const val = r.fy || 'N/A';
          fyCounts[val] = (fyCounts[val] || 0) + 1;
        });
      }
      filterGroups.push({ key: 'fy', label: typeof t === 'function' ? t('col.fy', 'FY') : 'FY', values: fyCounts });

      // 2. Process Type
      const policyTypeCounts = {};
      if (originalFacetedSummary[moduleKey] && originalFacetedSummary[moduleKey].policy_type) {
        for (const k of Object.keys(originalFacetedSummary[moduleKey].policy_type)) policyTypeCounts[k] = originalFacetedSummary[moduleKey].policy_type[k] || 0;
      }
      if (currentFacetedSummary && currentFacetedSummary.policy_type) {
        for (const k of Object.keys(policyTypeCounts)) policyTypeCounts[k] = 0;
        for (const [k, v] of Object.entries(currentFacetedSummary.policy_type)) policyTypeCounts[k] = v;
      } else {
        for (const k of Object.keys(policyTypeCounts)) policyTypeCounts[k] = 0;
        data.forEach(r => { const val = r.policy_type || 'N/A'; policyTypeCounts[val] = (policyTypeCounts[val] || 0) + 1; });
      }
      filterGroups.push({ key: 'policy_type', label: 'Process Type', values: policyTypeCounts });

      // 3. Country
      const countryCounts = {};
      const resolveCountryName = (k) => {
        if (!k || k === 'Unassigned' || k === 'N/A') return 'N/A';
        return k;
      };
      if (originalFacetedSummary[moduleKey] && originalFacetedSummary[moduleKey].country) {
        for (const [k, v] of Object.entries(originalFacetedSummary[moduleKey].country)) {
          const name = resolveCountryName(k);
          countryCounts[name] = (countryCounts[name] || 0) + (v || 0);
        }
      }
      if (currentFacetedSummary && currentFacetedSummary.country) {
        for (const k of Object.keys(countryCounts)) countryCounts[k] = 0;
        for (const [k, v] of Object.entries(currentFacetedSummary.country)) {
          const name = resolveCountryName(k);
          countryCounts[name] = (countryCounts[name] || 0) + v;
        }
      } else {
        data.forEach(r => {
          const val = resolveCountryName(r.country);
          countryCounts[val] = (countryCounts[val] || 0) + 1;
        });
      }
      filterGroups.push({ key: 'country', label: typeof t === 'function' ? t('col.country', 'Country') : 'Country', values: countryCounts });

    } else if (moduleKey === 'mtr') {
      // 1. My Company
      const companyCounts = {};
      const companyIdToName = {};
      if (selectCache['my_company']) {
        selectCache['my_company'].forEach(c => {
          if (c.my_company_id) companyIdToName[String(c.my_company_id)] = c.company_shortname || c.company_fullname;
        });
      }
      const resolveCompanyKey = (k) => {
        if (k === 'Unknown' || k === null || k === undefined) return 'N/A';
        return companyIdToName[String(k)] || k;
      };
      if (originalFacetedSummary[moduleKey] && originalFacetedSummary[moduleKey].company_id) {
        for (const [k, v] of Object.entries(originalFacetedSummary[moduleKey].company_id)) {
          const name = resolveCompanyKey(k);
          companyCounts[name] = (companyCounts[name] || 0) + (v || 0);
        }
      }
      if (currentFacetedSummary && currentFacetedSummary.company_id) {
        for (const k of Object.keys(companyCounts)) companyCounts[k] = 0;
        for (const [k, v] of Object.entries(currentFacetedSummary.company_id)) {
          const name = resolveCompanyKey(k);
          companyCounts[name] = (companyCounts[name] || 0) + v;
        }
      } else {
        for (const k of Object.keys(companyCounts)) companyCounts[k] = 0;
        data.forEach(r => { const val = resolveCompanyKey(r.company_id); companyCounts[val] = (companyCounts[val] || 0) + 1; });
      }
      filterGroups.push({ key: 'my_company', label: 'My Company', values: companyCounts });

      // 2. Account Status
      const accStatusCounts = {};
      if (originalFacetedSummary[moduleKey] && originalFacetedSummary[moduleKey].account_status) {
        for (const k of Object.keys(originalFacetedSummary[moduleKey].account_status)) accStatusCounts[k] = originalFacetedSummary[moduleKey].account_status[k] || 0;
      }
      if (currentFacetedSummary && currentFacetedSummary.account_status) {
        for (const k of Object.keys(accStatusCounts)) accStatusCounts[k] = 0;
        for (const [k, v] of Object.entries(currentFacetedSummary.account_status)) accStatusCounts[k] = v;
      } else {
        for (const k of Object.keys(accStatusCounts)) accStatusCounts[k] = 0;
        data.forEach(r => { const val = r.account_status || 'N/A'; accStatusCounts[val] = (accStatusCounts[val] || 0) + 1; });
      }
      filterGroups.push({ key: 'account_status', label: 'Account Status', values: accStatusCounts });

      // 3. Type
      const typeCounts = {};
      if (originalFacetedSummary[moduleKey] && originalFacetedSummary[moduleKey].transaction_type) {
        for (const k of Object.keys(originalFacetedSummary[moduleKey].transaction_type)) typeCounts[k] = originalFacetedSummary[moduleKey].transaction_type[k] || 0;
      }
      if (currentFacetedSummary && currentFacetedSummary.transaction_type) {
        for (const k of Object.keys(typeCounts)) typeCounts[k] = 0;
        for (const [k, v] of Object.entries(currentFacetedSummary.transaction_type)) typeCounts[k] = v;
      } else {
        for (const k of Object.keys(typeCounts)) typeCounts[k] = 0;
        data.forEach(r => { const val = r.transaction_type || 'N/A'; typeCounts[val] = (typeCounts[val] || 0) + 1; });
      }
      filterGroups.push({ key: 'transaction_type', label: 'Type', values: typeCounts });

      // 4. Currency
      const currencyCounts = {};
      if (originalFacetedSummary[moduleKey] && originalFacetedSummary[moduleKey].currency) {
        for (const k of Object.keys(originalFacetedSummary[moduleKey].currency)) currencyCounts[k] = originalFacetedSummary[moduleKey].currency[k] || 0;
      }
      if (currentFacetedSummary && currentFacetedSummary.currency) {
        for (const k of Object.keys(currencyCounts)) currencyCounts[k] = 0;
        for (const [k, v] of Object.entries(currentFacetedSummary.currency)) currencyCounts[k] = v;
      } else {
        for (const k of Object.keys(currencyCounts)) currencyCounts[k] = 0;
        data.forEach(r => { const val = r.currency || 'N/A'; currencyCounts[val] = (currencyCounts[val] || 0) + 1; });
      }
      filterGroups.push({ key: 'currency', label: 'Currency', values: currencyCounts });
    } else if (moduleKey === 'account') {
      // 1. My Company
      const companyCounts = {};
      const companyIdToName = {};
      if (selectCache['my_company']) {
        selectCache['my_company'].forEach(c => {
          if (c.my_company_id) companyIdToName[String(c.my_company_id)] = c.company_shortname || c.company_fullname;
        });
      }
      const resolveCompanyKey = (k) => {
        if (k === 'Unknown' || k === null || k === undefined) return 'N/A';
        return companyIdToName[String(k)] || k;
      };

      if (originalFacetedSummary[moduleKey] && originalFacetedSummary[moduleKey].company_id) {
        for (const [k, v] of Object.entries(originalFacetedSummary[moduleKey].company_id)) {
          const name = resolveCompanyKey(k);
          companyCounts[name] = (companyCounts[name] || 0) + (v || 0);
        }
      }
      if (currentFacetedSummary && currentFacetedSummary.company_id) {
        for (const k of Object.keys(companyCounts)) companyCounts[k] = 0;
        for (const [k, v] of Object.entries(currentFacetedSummary.company_id)) {
          const name = resolveCompanyKey(k);
          companyCounts[name] = (companyCounts[name] || 0) + v;
        }
      } else {
        for (const k of Object.keys(companyCounts)) companyCounts[k] = 0;
        data.forEach(r => { const val = resolveCompanyKey(r.company_entity); companyCounts[val] = (companyCounts[val] || 0) + 1; });
      }
      filterGroups.push({ key: 'my_company', label: 'My Company', values: companyCounts });

      // 2. Account status
      const statusCounts = {};
      if (originalFacetedSummary[moduleKey] && originalFacetedSummary[moduleKey].account_status) {
        for (const k of Object.keys(originalFacetedSummary[moduleKey].account_status)) statusCounts[k] = originalFacetedSummary[moduleKey].account_status[k] || 0;
      }
      if (currentFacetedSummary && currentFacetedSummary.account_status) {
        for (const k of Object.keys(statusCounts)) statusCounts[k] = 0;
        for (const [k, v] of Object.entries(currentFacetedSummary.account_status)) statusCounts[k] = v;
      } else {
        for (const k of Object.keys(statusCounts)) statusCounts[k] = 0;
        data.forEach(r => { const val = r.account_status || 'N/A'; statusCounts[val] = (statusCounts[val] || 0) + 1; });
      }
      filterGroups.push({ key: 'account_status', label: 'Account status', values: statusCounts });

      // 3. Type
      const typeCounts = {};
      if (originalFacetedSummary[moduleKey] && originalFacetedSummary[moduleKey].type) {
        for (const k of Object.keys(originalFacetedSummary[moduleKey].type)) typeCounts[k] = originalFacetedSummary[moduleKey].type[k] || 0;
      }
      if (currentFacetedSummary && currentFacetedSummary.type) {
        for (const k of Object.keys(typeCounts)) typeCounts[k] = 0;
        for (const [k, v] of Object.entries(currentFacetedSummary.type)) typeCounts[k] = v;
      } else {
        for (const k of Object.keys(typeCounts)) typeCounts[k] = 0;
        data.forEach(r => { const val = r.type || 'N/A'; typeCounts[val] = (typeCounts[val] || 0) + 1; });
      }
      filterGroups.push({ key: 'type', label: 'Type', values: typeCounts });

      // 4. Currency
      const currencyCounts = {};
      if (originalFacetedSummary[moduleKey] && originalFacetedSummary[moduleKey].currency) {
        for (const k of Object.keys(originalFacetedSummary[moduleKey].currency)) currencyCounts[k] = originalFacetedSummary[moduleKey].currency[k] || 0;
      }
      if (currentFacetedSummary && currentFacetedSummary.currency) {
        for (const k of Object.keys(currencyCounts)) currencyCounts[k] = 0;
        for (const [k, v] of Object.entries(currentFacetedSummary.currency)) currencyCounts[k] = v;
      } else {
        for (const k of Object.keys(currencyCounts)) currencyCounts[k] = 0;
        data.forEach(r => { const val = r.currency || 'N/A'; currencyCounts[val] = (currencyCounts[val] || 0) + 1; });
      }
      filterGroups.push({ key: 'currency', label: 'Currency', values: currencyCounts });
    } else if (moduleKey === 'my_company') {
      // Country filter
      const countryCounts = {};
      data.forEach(r => { const val = r.country || 'N/A'; countryCounts[val] = (countryCounts[val] || 0) + 1; });
      filterGroups.push({ key: 'country', label: 'Country', values: countryCounts });

      // Province/State filter
      const provinceCounts = {};
      data.forEach(r => { const val = r.province || 'N/A'; provinceCounts[val] = (provinceCounts[val] || 0) + 1; });
      filterGroups.push({ key: 'province', label: 'Province/State', values: provinceCounts });

      // City filter
      const cityCounts = {};
      data.forEach(r => { const val = r.city || 'N/A'; cityCounts[val] = (cityCounts[val] || 0) + 1; });
      filterGroups.push({ key: 'city', label: 'City', values: cityCounts });
    } else if (moduleKey === 'request_activity_log') {
      // 1. Table filter
      const tableCounts = {};
      if (originalFacetedSummary[moduleKey] && originalFacetedSummary[moduleKey].table_name) {
        for (const k of Object.keys(originalFacetedSummary[moduleKey].table_name)) {
          tableCounts[k] = originalFacetedSummary[moduleKey].table_name[k] || 0;
        }
      }
      if (currentFacetedSummary && currentFacetedSummary.table_name) {
        for (const k of Object.keys(tableCounts)) tableCounts[k] = 0;
        for (const [k, v] of Object.entries(currentFacetedSummary.table_name)) tableCounts[k] = v;
      } else {
        data.forEach(r => { const val = r.table_name || 'N/A'; tableCounts[val] = (tableCounts[val] || 0) + 1; });
      }
      filterGroups.push({ key: 'table_name', label: 'Table', values: tableCounts });

      // 2. Month filter
      const monthCounts = {};
      if (originalFacetedSummary[moduleKey] && originalFacetedSummary[moduleKey].month) {
        for (const k of Object.keys(originalFacetedSummary[moduleKey].month)) {
          monthCounts[k] = originalFacetedSummary[moduleKey].month[k] || 0;
        }
      }
      if (currentFacetedSummary && currentFacetedSummary.month) {
        for (const k of Object.keys(monthCounts)) monthCounts[k] = 0;
        for (const [k, v] of Object.entries(currentFacetedSummary.month)) monthCounts[k] = v;
      } else {
        data.forEach(r => {
          if (r.log_time) {
            const m = String(new Date(r.log_time).getMonth() + 1).padStart(2, '0');
            monthCounts[m] = (monthCounts[m] || 0) + 1;
          }
        });
      }
      filterGroups.push({ key: 'month', label: 'Month', values: monthCounts });

      // 3. Year filter
      const yearCounts = {};
      if (originalFacetedSummary[moduleKey] && originalFacetedSummary[moduleKey].year) {
        for (const k of Object.keys(originalFacetedSummary[moduleKey].year)) {
          yearCounts[k] = originalFacetedSummary[moduleKey].year[k] || 0;
        }
      }
      if (currentFacetedSummary && currentFacetedSummary.year) {
        for (const k of Object.keys(yearCounts)) yearCounts[k] = 0;
        for (const [k, v] of Object.entries(currentFacetedSummary.year)) yearCounts[k] = v;
      } else {
        data.forEach(r => {
          if (r.log_time) {
            const y = String(new Date(r.log_time).getFullYear());
            yearCounts[y] = (yearCounts[y] || 0) + 1;
          }
        });
      }
      filterGroups.push({ key: 'year', label: 'Year', values: yearCounts });
    }
  } else if (['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(moduleKey)) {
    // Compact report filters for the request workspaces.
    const makeCounts = (key, fallback = 'N/A') => {
      const counts = {};
      data.forEach(row => {
        const value = resolveLookupValue(moduleKey, key, row[key]) || row[key] || fallback;
        counts[value] = (counts[value] || 0) + 1;
      });
      return counts;
    };
    filterGroups.push({ key: 'sr_status', label: 'Request Status', values: makeCounts('sr_status') });
    filterGroups.push({ key: 'process_status', label: 'Process Status', values: makeCounts('process_status') });
    filterGroups.push({ key: 'approval_status', label: 'Approval Status', values: makeCounts('approval_status') });
    filterGroups.push({ key: 'request_type', label: 'Request Type', values: makeCounts('request_type') });
  } else if (moduleKey === 'contract') {
    // 1. FY (Fiscal Year from Signed Date)
    const fyCounts = {};
    if (originalFacetedSummary[moduleKey] && originalFacetedSummary[moduleKey].fy) {
      // Sort keys descending (newer year to older year)
      const sortedYears = Object.keys(originalFacetedSummary[moduleKey].fy).sort((a, b) => b - a);
      for (const k of sortedYears) fyCounts[k] = originalFacetedSummary[moduleKey].fy[k] || 0;
    }
    if (currentFacetedSummary && currentFacetedSummary.fy) {
      for (const k of Object.keys(fyCounts)) fyCounts[k] = 0;
      for (const [k, v] of Object.entries(currentFacetedSummary.fy)) fyCounts[k] = v;
    } else {
      for (const k of Object.keys(fyCounts)) fyCounts[k] = 0;
      data.forEach(r => {
        const val = r.contract_signed_date ? new Date(r.contract_signed_date).getFullYear() : 'N/A';
        fyCounts[val] = (fyCounts[val] || 0) + 1;
      });
    }
    filterGroups.push({ key: 'fy', label: 'FY', values: fyCounts });

    // 2. My Company
    const companyCounts = {};
    const resolveCompanyShortname = (k) => {
      if (!k || k === 'N/A') return k;
      if (selectCache['my_company']) {
        const match = selectCache['my_company'].find(c =>
          String(c.my_company_id) === String(k) ||
          String(c.company_shortname).toLowerCase() === String(k).toLowerCase()
        );
        if (match) return match.company_shortname || k;
      }
      return k;
    };
    if (originalFacetedSummary[moduleKey] && originalFacetedSummary[moduleKey].my_company) {
      for (const k of Object.keys(originalFacetedSummary[moduleKey].my_company)) {
        const name = resolveCompanyShortname(k) || k;
        companyCounts[name] = (companyCounts[name] || 0) + (originalFacetedSummary[moduleKey].my_company[k] || 0);
      }
    }
    if (currentFacetedSummary && currentFacetedSummary.my_company) {
      for (const k of Object.keys(companyCounts)) companyCounts[k] = 0;
      for (const [k, v] of Object.entries(currentFacetedSummary.my_company)) {
        const name = resolveCompanyShortname(k) || k;
        companyCounts[name] = (companyCounts[name] || 0) + v;
      }
    } else {
      data.forEach(r => {
        const val = resolveCompanyShortname(r.my_company) || 'N/A';
        companyCounts[val] = (companyCounts[val] || 0) + 1;
      });
    }
    filterGroups.push({ key: 'my_company', label: 'My Company', values: companyCounts });

    // 3. Contract Type
    const typeCounts = {};
    if (originalFacetedSummary[moduleKey] && originalFacetedSummary[moduleKey].type) {
      for (const k of Object.keys(originalFacetedSummary[moduleKey].type)) typeCounts[k] = originalFacetedSummary[moduleKey].type[k] || 0;
    }
    if (currentFacetedSummary && currentFacetedSummary.type) {
      for (const k of Object.keys(typeCounts)) typeCounts[k] = 0;
      for (const [k, v] of Object.entries(currentFacetedSummary.type)) typeCounts[k] = v;
    } else {
      for (const k of Object.keys(typeCounts)) typeCounts[k] = 0;
      data.forEach(r => { const val = r.type || 'N/A'; typeCounts[val] = (typeCounts[val] || 0) + 1; });
    }
    filterGroups.push({ key: 'type', label: 'Contract Type', values: typeCounts });

    // 4. Contract Owner
    const ownerCounts = {};
    if (originalFacetedSummary[moduleKey] && originalFacetedSummary[moduleKey].contract_owner) {
      for (const k of Object.keys(originalFacetedSummary[moduleKey].contract_owner)) {
        const name = resolveLookupValue('contract', 'contract_owner', k) || k;
        ownerCounts[name] = (ownerCounts[name] || 0) + (originalFacetedSummary[moduleKey].contract_owner[k] || 0);
      }
    }
    if (currentFacetedSummary && currentFacetedSummary.contract_owner) {
      for (const k of Object.keys(ownerCounts)) ownerCounts[k] = 0;
      for (const [k, v] of Object.entries(currentFacetedSummary.contract_owner)) {
        const name = resolveLookupValue('contract', 'contract_owner', k) || k;
        ownerCounts[name] = (ownerCounts[name] || 0) + v;
      }
    } else {
      data.forEach(r => {
        const val = resolveLookupValue('contract', 'contract_owner', r.contract_owner) || 'N/A';
        ownerCounts[val] = (ownerCounts[val] || 0) + 1;
      });
    }
    filterGroups.push({ key: 'contract_owner', label: 'Contract Owner', values: ownerCounts });
  } else if (moduleKey === 'expense') {
    // 1. FY (Fiscal Year)
    const fyCounts = {};
    if (originalFacetedSummary[moduleKey] && originalFacetedSummary[moduleKey].fy) {
      const sortedYears = Object.keys(originalFacetedSummary[moduleKey].fy).sort((a, b) => b - a);
      for (const k of sortedYears) fyCounts[k] = originalFacetedSummary[moduleKey].fy[k] || 0;
    }
    if (currentFacetedSummary && currentFacetedSummary.fy) {
      for (const k of Object.keys(fyCounts)) fyCounts[k] = 0;
      for (const [k, v] of Object.entries(currentFacetedSummary.fy)) fyCounts[k] = v;
    } else {
      for (const k of Object.keys(fyCounts)) fyCounts[k] = 0;
      data.forEach(r => {
        const val = r.fy || (r.created_at ? String(new Date(r.created_at).getFullYear()) : 'N/A');
        fyCounts[val] = (fyCounts[val] || 0) + 1;
      });
    }
    filterGroups.push({ key: 'fy', label: 'FY', values: fyCounts });

    // 2. My Company
    const companyCounts = {};
    const resolveCompanyShortname = (k) => {
      if (!k || k === 'N/A') return k;
      if (selectCache['my_company']) {
        const match = selectCache['my_company'].find(c =>
          String(c.my_company_id) === String(k) ||
          String(c.company_shortname).toLowerCase() === String(k).toLowerCase()
        );
        if (match) return match.company_shortname || k;
      }
      return k;
    };
    if (originalFacetedSummary[moduleKey] && originalFacetedSummary[moduleKey].id__my_company) {
      for (const k of Object.keys(originalFacetedSummary[moduleKey].id__my_company)) {
        const name = resolveCompanyShortname(k) || k;
        companyCounts[name] = (companyCounts[name] || 0) + (originalFacetedSummary[moduleKey].id__my_company[k] || 0);
      }
    }
    if (currentFacetedSummary && currentFacetedSummary.id__my_company) {
      for (const k of Object.keys(companyCounts)) companyCounts[k] = 0;
      for (const [k, v] of Object.entries(currentFacetedSummary.id__my_company)) {
        const name = resolveCompanyShortname(k) || k;
        companyCounts[name] = (companyCounts[name] || 0) + v;
      }
    } else {
      data.forEach(r => {
        const val = resolveCompanyShortname(r.id__my_company || r.my_company) || 'N/A';
        companyCounts[val] = (companyCounts[val] || 0) + 1;
      });
    }
    filterGroups.push({ key: 'my_company', label: 'My Company', values: companyCounts });

    // 3. Expense Cost
    const costCounts = {};
    if (originalFacetedSummary[moduleKey] && originalFacetedSummary[moduleKey].id__expense_cost) {
      for (const k of Object.keys(originalFacetedSummary[moduleKey].id__expense_cost)) costCounts[k] = originalFacetedSummary[moduleKey].id__expense_cost[k] || 0;
    }
    if (currentFacetedSummary && currentFacetedSummary.id__expense_cost) {
      for (const k of Object.keys(costCounts)) costCounts[k] = 0;
      for (const [k, v] of Object.entries(currentFacetedSummary.id__expense_cost)) costCounts[k] = v;
    } else {
      for (const k of Object.keys(costCounts)) costCounts[k] = 0;
      data.forEach(r => {
        const val = r.id__expense_cost || r.expense_cost || 'N/A';
        costCounts[val] = (costCounts[val] || 0) + 1;
      });
    }
    filterGroups.push({ key: 'id__expense_cost', label: 'Expense Cost', values: costCounts });

    // 4. Expense Type
    const typeCounts = {};
    if (originalFacetedSummary[moduleKey] && originalFacetedSummary[moduleKey].id__expense_type) {
      for (const k of Object.keys(originalFacetedSummary[moduleKey].id__expense_type)) typeCounts[k] = originalFacetedSummary[moduleKey].id__expense_type[k] || 0;
    }
    if (currentFacetedSummary && currentFacetedSummary.id__expense_type) {
      for (const k of Object.keys(typeCounts)) typeCounts[k] = 0;
      for (const [k, v] of Object.entries(currentFacetedSummary.id__expense_type)) typeCounts[k] = v;
    } else {
      for (const k of Object.keys(typeCounts)) typeCounts[k] = 0;
      data.forEach(r => {
        const val = r.id__expense_type || r.expense_type || 'N/A';
        typeCounts[val] = (typeCounts[val] || 0) + 1;
      });
    }
    filterGroups.push({ key: 'id__expense_type', label: 'Expense Type', values: typeCounts });
  } else if (moduleKey === 'operation_program') {
    // 1. My Company
    const companyCounts = {};
    const companyIdToName = {};
    if (selectCache['my_company']) {
      selectCache['my_company'].forEach(c => {
        if (c.my_company_id) companyIdToName[String(c.my_company_id)] = c.company_shortname || c.company_fullname;
      });
    }
    const resolveCompanyKey = (k) => {
      if (k === 'Unknown' || k === null || k === undefined) return 'N/A';
      return companyIdToName[String(k)] || k;
    };
    data.forEach(r => {
      const val = resolveCompanyKey(r.company_id);
      companyCounts[val] = (companyCounts[val] || 0) + 1;
    });
    filterGroups.push({ key: 'my_company', label: 'Company', values: companyCounts });

    // 2. Payment Type
    const typeCounts = {};
    data.forEach(r => {
      let types = [];
      if (typeof r.payment_type === 'string') {
        types = r.payment_type.split(',').map(s => s.trim().replace(/^\[|\]$/g, '')).filter(Boolean);
      } else if (r.payment_type !== undefined && r.payment_type !== null) {
        types = [String(r.payment_type)];
      }
      if (types.length === 0) types = ['N/A'];
      types.forEach(tVal => {
        typeCounts[tVal] = (typeCounts[tVal] || 0) + 1;
      });
    });
    filterGroups.push({ key: 'payment_type', label: 'Payment Type', values: typeCounts });
  } else {
    const mod = MODULES[moduleKey];
    if (mod && mod.groupBy) {
      const groupKeys = Array.isArray(mod.groupBy) ? mod.groupBy : [mod.groupBy];
      for (const gKey of groupKeys) {
        const valCounts = {};

        // If server-side faceted summary is available, use it!
        const serverCounts = currentFacetedSummary?.[gKey] || originalFacetedSummary[moduleKey]?.[gKey];
        const isVirtualColumn = ['fy_recognized', 'fy_target_closed_date', 'quarter_by_closed_date', 'sale_team'].includes(gKey);
        if (serverCounts && !isClientSideModule && !isVirtualColumn) {
          if (originalFacetedSummary[moduleKey]?.[gKey]) {
            for (const k of Object.keys(originalFacetedSummary[moduleKey][gKey])) {
              valCounts[k] = originalFacetedSummary[moduleKey][gKey][k] || 0;
            }
          }
          if (currentFacetedSummary?.[gKey]) {
            for (const k of Object.keys(valCounts)) valCounts[k] = 0;
            for (const [k, v] of Object.entries(currentFacetedSummary[gKey])) {
              valCounts[k] = v;
            }
          }
        } else {
          // Client-side fallback
          data.forEach(r => {
            let val = r[gKey];
            if (typeof resolveVirtualColumn === 'function') {
              const virtualVal = resolveVirtualColumn(moduleKey, gKey, r);
              if (virtualVal !== undefined) val = virtualVal;
            }
            val = resolveLookupValue(moduleKey, gKey, val);
            if (val === undefined || val === null || val === '') val = 'N/A';
            valCounts[val] = (valCounts[val] || 0) + 1;
          });
        }

        const col = mod.columns.find(c => c.key === gKey) || (mod.fields && mod.fields.find(f => f.key === gKey));
        const label = col ? col.label : (gKey.charAt(0).toUpperCase() + gKey.slice(1).replace(/_/g, ' '));
        filterGroups.push({ key: gKey, label: label, values: valCounts });
      }
    }
  }

  let html = '';
  for (const group of filterGroups) {
    if (filters[group.key] instanceof Set) {
      filters[group.key].forEach(val => {
        if (group.values[val] === undefined) {
          group.values[val] = 0;
        }
      });
    }

    const sortedEntries = sortFilterEntries(moduleKey, group.key, Object.entries(group.values));
    const groupUniqueKey = `${moduleKey}_${group.key}`;

    const hasCheckedInRemaining = sortedEntries.slice(5).some(([val]) => isFilterValueChecked(filters[group.key], val));
    if (hasCheckedInRemaining) {
      if (!window.expandedFilterGroups) window.expandedFilterGroups = new Set();
      window.expandedFilterGroups.add(groupUniqueKey);
    }

    const isExpanded = window.expandedFilterGroups && window.expandedFilterGroups.has(groupUniqueKey);
    const showMore = sortedEntries.length > 5;
    const first5 = showMore ? sortedEntries.slice(0, 5) : sortedEntries;
    const remaining = showMore ? sortedEntries.slice(5) : [];

    html += `
      <div class="dv-filter-group">
        <div class="dv-filter-group-title">${typeof t === 'function' ? (t('filter.' + group.key) !== ('filter.' + group.key) ? t('filter.' + group.key) : group.label) : group.label}</div>
        ${first5.map(([val, count]) => {
      const isChecked = isFilterValueChecked(filters[group.key], val) ? 'checked' : '';
      let displayVal = resolveFilterDisplayVal(group.key, val);
      return `
            <label class="dv-filter-option" title="${escapeHTML(displayVal)}">
              <input type="checkbox" data-module="${moduleKey}" data-filter-key="${group.key}" data-filter-value="${escapeHTML(val)}" ${isChecked}
                onchange="toggleTableFilter('${moduleKey}', '${group.key}', '${val.replace(/'/g, "\\'")}', this.checked)" />
              <span class="dv-filter-checkbox"></span>
              <span class="dv-filter-text" title="${escapeHTML(displayVal)}">${escapeHTML(displayVal)}</span>
              <span class="dv-filter-count">${formatNumber(count)}</span>
            </label>
          `;
    }).join('')}
        
        ${showMore ? `
          <div class="dv-filter-more-options" style="display: ${isExpanded ? 'block' : 'none'};">
            ${remaining.map(([val, count]) => {
      const isChecked = filters[group.key] instanceof Set && filters[group.key].has(val) ? 'checked' : '';
      let displayVal = resolveFilterDisplayVal(group.key, val);
      return `
                <label class="dv-filter-option" title="${escapeHTML(displayVal)}">
                  <input type="checkbox" data-module="${moduleKey}" data-filter-key="${group.key}" data-filter-value="${escapeHTML(val)}" ${isChecked}
                    onchange="toggleTableFilter('${moduleKey}', '${group.key}', '${val.replace(/'/g, "\\'")}', this.checked)" />
                  <span class="dv-filter-checkbox"></span>
                  <span class="dv-filter-text" title="${escapeHTML(displayVal)}">${escapeHTML(displayVal)}</span>
                  <span class="dv-filter-count">${formatNumber(count)}</span>
                </label>
              `;
    }).join('')}
          </div>
          <div class="dv-filter-more-btn" onclick="toggleMoreFilterOptions(this, '${groupUniqueKey}')" style="color:#FF6A00; font-size:11px; font-weight:600; cursor:pointer; padding:4px 0px; display:inline-block;">${isExpanded ? 'less' : 'more ...'}</div>
        ` : ''}
      </div>
    `;
    if (moduleKey === 'finance' && group.key === 'fy' && prefixHtml) {
      html += prefixHtml;
      prefixHtml = '';
    }
  }
  console.log('buildDropdownFiltersHTML generated HTML:', html);
  return prefixHtml + html;
}

window.toggleTableFilter = function (moduleKey, filterKey, filterValue, checked) {
  if (!activeDropdownFilters[moduleKey]) activeDropdownFilters[moduleKey] = {};
  if (!activeDropdownFilters[moduleKey][filterKey]) {
    activeDropdownFilters[moduleKey][filterKey] = new Set();
  }

  if (checked) {
    activeDropdownFilters[moduleKey][filterKey].add(filterValue);
  } else {
    activeDropdownFilters[moduleKey][filterKey].delete(filterValue);
    if (activeDropdownFilters[moduleKey][filterKey].size === 0) {
      delete activeDropdownFilters[moduleKey][filterKey];
    }
  }

  savePersistedFilters(moduleKey);

  // Reset pagination to page 1 when filtering
  if (!moduleStates[moduleKey]) moduleStates[moduleKey] = {};
  moduleStates[moduleKey].page = 1;
  moduleStates[moduleKey].scrollTop = 0;

  const serverFilteredModules = ['employee', 'employee_active', 'payment', 'invoice', 'request', 'service', 'asset', 'mtr', 'account', 'request_activity_log', 'finance', 'contract', 'expense', 'action_rules'];
  if (serverFilteredModules.includes(moduleKey)) {
    renderTableView(moduleKey, 1, false);
  } else {
    applyAllFilters(moduleKey);
  }
};

window.clearTableFilters = function (moduleKey) {
  activeDropdownFilters[moduleKey] = {};
  savePersistedFilters(moduleKey);

  if (!moduleStates[moduleKey]) moduleStates[moduleKey] = {};
  moduleStates[moduleKey].page = 1;
  moduleStates[moduleKey].scrollTop = 0;

  // For finance: also reset the date range filters stored in moduleStates
  if (moduleKey === 'finance') {
    delete moduleStates[moduleKey].from_date;
    delete moduleStates[moduleKey].to_date;
    drawFilterSidebar(moduleKey); // redraw sidebar to clear date inputs visually
  }

  // Manually uncheck to avoid full DOM redraw which resets faceted counts
  document.querySelectorAll(`#view-${moduleKey} .dv-filter-option input[type="checkbox"]`).forEach(cb => cb.checked = false);

  const serverFilteredModules = ['employee', 'employee_active', 'payment', 'invoice', 'request', 'service', 'asset', 'mtr', 'account', 'request_activity_log', 'finance', 'contract', 'expense', 'action_rules'];
  if (serverFilteredModules.includes(moduleKey)) {
    renderTableView(moduleKey, 1, false);
  } else {
    applyAllFilters(moduleKey);
  }
};

// The report filter panel stays out of the way until the user explicitly
// opens it. Filtering behaviour and selected values are unchanged.
window.tableFilterPanelOpen = window.tableFilterPanelOpen || {};
window.tableFilterSidebarHidden = window.tableFilterSidebarHidden || {};
window.toggleTableFilterPanel = function (moduleKey) {
  const panel = document.getElementById(`table-filter-panel-${moduleKey}`);
  if (!panel) return;
  const isOpen = !panel.classList.contains('is-open');
  panel.classList.toggle('is-open', isOpen);
  window.tableFilterPanelOpen[moduleKey] = isOpen;
  const button = document.getElementById(`table-filter-toggle-${moduleKey}`);
  if (button) {
    button.setAttribute('aria-expanded', String(isOpen));
    const label = button.querySelector('.filter-toggle-label');
    if (label) label.textContent = isOpen ? t('table.hide_filter', 'Ẩn filter') : t('table.show_filter', 'Hiện filter');
  }
};

window.toggleTableFilterSidebar = function (moduleKey) {
  const sidebar = document.getElementById(`table-filter-sidebar-${moduleKey}`);
  if (!sidebar) return;
  const isHidden = !sidebar.classList.contains('is-hidden');
  sidebar.classList.toggle('is-hidden', isHidden);
  window.tableFilterSidebarHidden[moduleKey] = isHidden;

  const button = document.getElementById(`table-filter-sidebar-toggle-${moduleKey}`);
  if (button) {
    button.setAttribute('aria-expanded', String(!isHidden));
    const label = button.querySelector('.table-filter-sidebar-toggle-label');
    if (label) label.textContent = isHidden ? t('table.show_filter', 'Hiện filter') : t('table.hide_filter', 'Ẩn filter');
  }
};

window.initSidebarResizer = function (moduleOrViewKey, isDashboard = false) {
  const sidebarId = isDashboard ? `dashboard-filter-sidebar-${moduleOrViewKey}` : `table-filter-sidebar-${moduleOrViewKey}`;
  const sidebar = document.getElementById(sidebarId);
  if (!sidebar) return;

  if (window.innerWidth <= 768) {
    sidebar.style.removeProperty('width');
    sidebar.style.removeProperty('min-width');
    sidebar.style.removeProperty('max-width');
    return;
  }

  const savedWidth = localStorage.getItem('crc-filter-sidebar-width');
  if (savedWidth) {
    sidebar.style.setProperty('width', savedWidth, 'important');
    sidebar.style.setProperty('min-width', savedWidth, 'important');
    sidebar.style.setProperty('max-width', savedWidth, 'important');
  }

  // Insert resizer element after sidebar if not already present
  let resizer = sidebar.nextElementSibling;
  if (!resizer || !resizer.classList.contains('dv-sidebar-resizer')) {
    resizer = document.createElement('div');
    resizer.className = 'dv-sidebar-resizer';
    sidebar.parentNode.insertBefore(resizer, sidebar.nextSibling);
  }

  let startX, startWidth;

  function onMouseDown(e) {
    e.preventDefault();
    startX = e.clientX;
    startWidth = sidebar.getBoundingClientRect().width;
    resizer.classList.add('is-dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  function onMouseMove(e) {
    const deltaX = e.clientX - startX;
    let newWidth = startWidth + deltaX;
    // Constrain width
    if (newWidth < 180) newWidth = 180;
    if (newWidth > 600) newWidth = 600;

    sidebar.style.setProperty('width', newWidth + 'px', 'important');
    sidebar.style.setProperty('min-width', newWidth + 'px', 'important');
    sidebar.style.setProperty('max-width', newWidth + 'px', 'important');
    // Save to localStorage
    localStorage.setItem('crc-filter-sidebar-width', newWidth + 'px');
  }

  function onMouseUp() {
    resizer.classList.remove('is-dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }

  if (resizer._listenerAttached) {
    resizer.removeEventListener('mousedown', resizer._listenerAttached);
  }
  resizer.addEventListener('mousedown', onMouseDown);
  resizer._listenerAttached = onMouseDown;
};

window.drawFilterSidebar = function (moduleKey) {
  const sidebar = document.querySelector(`#view-${moduleKey} .dv-filter-sidebar`);
  if (!sidebar) return;

  const scrollPos = sidebar.scrollTop;
  const isCollapsed = sidebar.classList.contains('collapsed');
  const dropdownFiltersHTML = buildDropdownFiltersHTML(moduleKey);

  sidebar.innerHTML = `
    <div class="dv-filter-header" onclick="toggleMobileFilterSidebarCollapse('${moduleKey}', this)">
      <span class="material-symbols-rounded" style="font-size:14px; color:var(--accent);">filter_list</span>
      <span>Filters</span>
      <span id="dv-filter-collapse-btn" class="material-symbols-rounded" style="font-size:16px; color:var(--text-muted); transition: transform 0.2s; margin-left:4px;">${isCollapsed ? 'expand_more' : 'expand_less'}</span>
      <button class="dv-filter-clear" onclick="event.stopPropagation(); clearTableFilters('${moduleKey}')" style="margin-left:auto; background:none; border:none; color:var(--accent); font-size:10px; font-weight:600; cursor:pointer; padding:2px 6px; border-radius:4px; transition:var(--transition);">Clear all</button>
    </div>
    <div class="dv-filter-groups-container" style="${isCollapsed ? 'display:none;' : ''}">
      ${dropdownFiltersHTML}
    </div>
  `;
  sidebar.scrollTop = scrollPos;
};

window.toggleMobileFilterSidebarCollapse = function (moduleKey, btnEl) {
  const header = btnEl ? btnEl.closest('.dv-filter-header') : null;
  const sidebar = header ? header.closest('.dv-filter-sidebar') : document.querySelector(`#view-${moduleKey} .dv-filter-sidebar`);
  if (!sidebar) return;

  sidebar.classList.toggle('collapsed');
  const isCollapsed = sidebar.classList.contains('collapsed');

  const container = sidebar.querySelector('.dv-filter-groups-container');
  if (container) {
    if (isCollapsed) {
      container.style.setProperty('display', 'none', 'important');
    } else {
      container.style.removeProperty('display');
    }
  }

  const btn = sidebar.querySelector('#dv-filter-collapse-btn');
  if (btn) {
    btn.textContent = isCollapsed ? 'expand_more' : 'expand_less';
  }
};

async function buildActionButtons(moduleKey) {
  if (moduleKey === 'request_activity_log') {
    return `
      <button class="btn btn-custom-action" onclick="triggerDbBackup()" style="background: #10B981; color: white; border-color: #10B981; display: inline-flex; align-items: center; gap: 4px; padding: 6px 12px; border-radius: 6px; font-weight:600; font-size:12px;">
        <span class="material-symbols-rounded" style="font-size:16px;">backup</span>
        <span>Backup Database</span>
      </button>
      <button class="btn btn-outline btn-sm" onclick="showBackupManagementModal()" style="display: inline-flex; align-items: center; gap: 4px; padding: 6px 12px; border-radius: 6px; font-weight:600; font-size:12px; border:1px solid #E5E7EB; color:#374151; background:#FFFFFF;">
        <span class="material-symbols-rounded" style="font-size:16px;">settings_backup_restore</span>
        <span>Manage Snapshots</span>
      </button>
    `;
  }
  return '';
}

window.triggerDbBackup = async function () {
  try {
    showToast('Creating database snapshot...', 'info');
    const res = await apiPost('/backup/snapshot');
    showToast(res.message || 'Backup created successfully.', 'success');
  } catch (err) {
    showToast(`Backup failed: ${err.message}`, 'error');
  }
};

window.showBackupManagementModal = async function () {
  try {
    showToast('Loading snapshots...', 'info');
    const res = await apiGet('/backup/snapshots');
    const snapshots = res.snapshots || [];

    const existingModal = document.getElementById('backup-management-modal');
    if (existingModal) existingModal.remove();

    const modalHTML = `
      <div id="backup-management-modal" class="modal-overlay" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 9999; opacity: 0; transition: opacity 0.2s ease;">
        <div class="modal-container" style="background: #ffffff; border-radius: 12px; width: 100%; max-width: 600px; max-height: 85vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);">
          <div class="modal-header" style="padding: 16px 24px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: #f8fafc;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="material-symbols-rounded" style="color: var(--accent); font-size: 22px;">settings_backup_restore</span>
              <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #0f172a;">Database Snapshots</h3>
            </div>
            <button onclick="closeModal('backup-management-modal')" style="background: none; border: none; font-size: 20px; color: #94a3b8; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: color 0.15s ease;">&times;</button>
          </div>
          <div class="modal-body" style="padding: 24px; overflow-y: auto; flex: 1;">
            <div style="margin-bottom: 16px; font-size: 13px; color: #475569; line-height: 1.5;">
              Select a previous snapshot database version to restore. 
              <span style="color: #ef4444; font-weight: 600;">Warning: Restoring will overwrite the current database and discard any subsequent modifications.</span>
            </div>
            
            ${snapshots.length === 0 ? `
              <div style="text-align: center; padding: 32px; color: #94a3b8;">
                <span class="material-symbols-rounded" style="font-size: 48px; margin-bottom: 8px;">cloud_off</span>
                <div style="font-size: 14px; font-weight: 500;">No snapshots found</div>
                <div style="font-size: 12px; margin-top: 4px;">Click "Backup Database" to create one.</div>
              </div>
            ` : `
              <div style="display: flex; flex-direction: column; gap: 10px;">
                ${snapshots.map(s => {
      const sizeMB = (s.sizeBytes / (1024 * 1024)).toFixed(2);
      const dateStr = formatDateTime(s.createdAt);
      return `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc; transition: all 0.15s ease;">
                      <div style="text-align:left;">
                        <div style="font-size: 13px; font-weight: 600; color: #0f172a; word-break: break-all;">${s.filename}</div>
                        <div style="font-size: 11px; color: #64748b; margin-top: 4px;">
                          Created: <strong>${dateStr}</strong> | Size: <strong>${sizeMB} MB</strong>
                        </div>
                      </div>
                      <button class="btn btn-sm" onclick="triggerSnapshotRestore('${s.filename}')" style="background: #ef4444; color: white; border: none; font-size: 11px; padding: 6px 12px; border-radius: 4px; font-weight: 600; cursor: pointer; transition: background 0.15s;">
                        Restore
                      </button>
                    </div>
                  `;
    }).join('')}
              </div>
            `}
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    setTimeout(() => {
      const el = document.getElementById('backup-management-modal');
      if (el) {
        el.style.opacity = '1';
        openModal('backup-management-modal');
      }
    }, 10);

  } catch (err) {
    showToast(`Failed to load snapshots: ${err.message}`, 'error');
  }
};

window.triggerSnapshotRestore = async function (filename) {
  const confirmMsg = currentLang === 'vi'
    ? `CẢNH BÁO CỰC KỲ QUAN TRỌNG: Bạn có chắc chắn muốn khôi phục cơ sở dữ liệu về phiên bản "${filename}" không? Hành động này sẽ ghi đè và làm mất toàn bộ dữ liệu mới phát sinh sau thời điểm backup!`
    : `CRITICAL WARNING: Are you sure you want to restore the database to snapshot "${filename}"? This will overwrite the current database and delete all modifications made after this snapshot!`;

  if (!confirm(confirmMsg)) return;

  try {
    closeModal('backup-management-modal');
    showToast('Restoring database from snapshot...', 'info');
    const res = await apiPost(`/backup/snapshot/${filename}/restore`);
    showToast(res.message || 'Database restored successfully.', 'success');
    setTimeout(() => window.location.reload(), 1500); // Reload application to fetch new database state
  } catch (err) {
    showToast(`Restore failed: ${err.message}`, 'error');
  }
};

window.triggerRowRevert = async function (tableName, recordId, logId) {
  const confirmMsg = currentLang === 'vi'
    ? `Bạn có chắc chắn muốn khôi phục dòng dữ liệu này (Bảng: ${tableName}, ID: ${recordId}) về trạng thái tại Log ID: ${logId} không?`
    : `Are you sure you want to revert this record (Table: ${tableName}, ID: ${recordId}) to the state at Log ID: ${logId}?`;

  if (!confirm(confirmMsg)) return;

  try {
    showToast('Reverting record...', 'info');
    const res = await apiPost('/backup/revert', { tableName, recordId, targetLogId: logId });
    showToast(res.message || 'Record reverted successfully.', 'success');
    loadModule(currentModule, false); // Reload table view
  } catch (err) {
    showToast(`Revert failed: ${err.message}`, 'error');
  }
};

async function renderTableView(moduleKey, page = 1, skipFetch = false) {
  loadPersistedFilters(moduleKey);
  const mod = MODULES[moduleKey];
  const meta = getModuleMeta(moduleKey);
  const content = document.getElementById('content');

  let seatWidgetHTML = '';

  try {
    if (!skipFetch) {
      const existingTbody = document.getElementById(`tbody-${moduleKey}`);
      if (existingTbody) {
        existingTbody.style.opacity = '0.5';
        existingTbody.style.pointerEvents = 'none';
      }
      // Pass moduleKey as 'slice' parameter for backend permission checking
      const sep = mod.endpoint.includes('?') ? '&' : '?';

      const dropdownFilters = activeDropdownFilters[moduleKey] || {};
      const serverFilteredModules = ['employee', 'employee_active', 'payment', 'invoice', 'request', 'service', 'asset', 'mtr', 'account', 'request_activity_log', 'finance', 'contract', 'expense', 'action_rules'];
      const isClientSide = !serverFilteredModules.includes(moduleKey);
      let limit = isClientSide ? 10000 : 50;

      let filterParams = '';
      for (const [key, valSet] of Object.entries(dropdownFilters)) {
        if (valSet && valSet.size > 0) {
          filterParams += `&${key}=${Array.from(valSet).map(encodeURIComponent).join(',')}`;
        }
      }

      if (moduleKey === 'finance') {
        const finState = moduleStates[moduleKey] || {};
        if (finState.from_date) filterParams += `&from_date=${encodeURIComponent(finState.from_date)}`;
        if (finState.to_date) filterParams += `&to_date=${encodeURIComponent(finState.to_date)}`;
      }
      let endpointUrl = `${mod.endpoint}${sep}slice=${moduleKey}&page=${page}&limit=${limit}${filterParams}`;

      const serverSearch = moduleStates[moduleKey]?.serverSearch;
      if (serverSearch) {
        endpointUrl += `&search=${encodeURIComponent(serverSearch)}`;
      }

      const sortBy = moduleStates[moduleKey]?.sort_by;
      const sortDir = moduleStates[moduleKey]?.sort_dir;
      if (sortBy) {
        endpointUrl += `&sort_by=${encodeURIComponent(sortBy)}&sort_dir=${encodeURIComponent(sortDir || 'DESC')}`;
      }

      // FETCH DATA FIRST
      const res = await apiGet(endpointUrl);

      const data = res.data && Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []);
      currentData = data;
      if (moduleKey === 'company') {
        companyTypeCounts = res.meta?.type_counts || {};
      }

      // FIRE AND FORGET PREFETCH: Do not block the initial render!
      const fireAndForgetPromises = [prefetchLookups(moduleKey)];

      if (moduleKey === 'employee' || moduleKey === 'employee_active') {
        fireAndForgetPromises.push(getSelectOptions('my_company').catch(() => []));
        fireAndForgetPromises.push(getSelectOptions('department').catch(() => []));
        fireAndForgetPromises.push(getSelectOptions('employee').catch(() => []));
      } else if (moduleKey === 'payment') {
        fireAndForgetPromises.push(getSelectOptions('my_company').catch(() => []));
        fireAndForgetPromises.push(getSelectOptions('employee').catch(() => []));
      } else if (moduleKey === 'contract') {
        fireAndForgetPromises.push(getSelectOptions('operation_program').catch(() => []));
        fireAndForgetPromises.push(getSelectOptions('employee').catch(() => []));
        fireAndForgetPromises.push(getSelectOptions('company').catch(() => []));
      } else if (['account', 'mtr', 'asset', 'service', 'expense'].includes(moduleKey)) {
        fireAndForgetPromises.push(getSelectOptions('my_company').catch(() => []));
      }

      Promise.all(fireAndForgetPromises).then(() => {
        const tbody = document.getElementById(`tbody-${moduleKey}`);
        if (tbody && currentView === 'table' && currentModule === moduleKey) {
          applyAllFilters(moduleKey);
          if (['employee', 'employee_active', 'payment', 'request', 'account', 'mtr', 'asset', 'service', 'my_company', 'department', 'request_activity_log', 'policy', 'finance', 'contract', 'company'].includes(moduleKey)) {
            drawFilterSidebar(moduleKey);
          }
        }
      });

      currentTableTotal = res.meta ? res.meta.total : (res.total || data.length);
      currentTableLimit = res.meta ? res.meta.limit : (res.limit || limit);
      currentTablePage = res.meta ? res.meta.page : (res.page || page);
      if (moduleKey === 'my_company') {
        const companyBadge = document.getElementById('nav-badge-my_company');
        if (companyBadge) {
          companyBadge.style.display = 'none';
        }
      }
      if (page === 1) {
        currentTableSummary = res.meta ? res.meta.summary : null;
        currentFacetedSummary = res.meta ? res.meta.faceted_summary : null;
        if (currentFacetedSummary) {
          if (!originalFacetedSummary[moduleKey] || filterParams === '') {
            originalFacetedSummary[moduleKey] = JSON.parse(JSON.stringify(currentFacetedSummary));
          }
        }
        // Cache original unfiltered data for client-side filtered modules (preserves filter sidebar counts)
        const serverFilteredModules = ['employee', 'employee_active', 'payment', 'invoice', 'request', 'service', 'asset', 'mtr', 'account', 'request_activity_log', 'finance', 'contract', 'expense', 'action_rules'];
        if (!serverFilteredModules.includes(moduleKey) && filterParams === '') {
          originalClientData[moduleKey] = [...data];
        }
      }

      if (!moduleStates[moduleKey]) moduleStates[moduleKey] = {};
      moduleStates[moduleKey].page = currentTablePage;
    }

    currentView = 'table';
    const data = currentData;

    // Build Table UI
    const total = currentTableTotal;
    const limit = currentTableLimit;
    const totalPages = Math.ceil(total / limit) || 1;

    let pageButtonsHTML = '';
    if (totalPages > 1) {
      pageButtonsHTML = Array.from({ length: totalPages }).map((_, i) => {
        const pageNum = i + 1;
        const isActive = pageNum === currentTablePage;
        if (totalPages > 5 && pageNum !== 1 && pageNum !== totalPages && Math.abs(pageNum - currentTablePage) > 1) {
          if (pageNum === 2 || pageNum === totalPages - 1) {
            return `<span style="color: #9CA3AF; padding: 0 4px;">...</span>`;
          }
          return '';
        }
        return `
          <button class="btn pagination-page-btn ${isActive ? 'is-active' : ''}" onclick="changePage('${moduleKey}', ${pageNum})" style="height: 28px !important; width: 28px !important; padding: 0 !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; font-size: 12px !important; border: 1px solid ${isActive ? '#FF6A00' : '#E5E7EB'} !important; border-radius: 6px !important; background: ${isActive ? '#FFF1E8' : '#FFFFFF'} !important; color: ${isActive ? '#FF6A00' : '#374151'} !important; font-weight: ${isActive ? '600' : '500'} !important; cursor: pointer; transition: all 0.2s ease;">${pageNum}</button>
        `;
      }).join('');
    }

    const startRecord = (currentTablePage - 1) * limit + 1;
    const endRecord = Math.min(currentTablePage * limit, total);

    const paginationHTML = currentTableTotal ? `
      <div class="pagination-container" id="pagination-${moduleKey}" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 16px; border-top: 1px solid #E5E7EB; background: #FFFFFF; flex-shrink: 0; min-height: 44px;">
        <div class="pagination-info" style="font-size:12px; font-weight: 500; color: #6B7280; font-family: 'Inter', sans-serif;">
          Showing <strong style="color: #111827;">${startRecord}-${endRecord}</strong> of <strong style="color: #111827;">${total}</strong> records
        </div>
        <div class="pagination-controls" style="display: flex; gap: 6px; align-items: center; height: 32px;">
          <button class="btn" onclick="changePage('${moduleKey}', ${currentTablePage - 1})" ${currentTablePage <= 1 ? 'disabled' : ''} style="height: 28px !important; padding: 4px 10px !important; font-size: 12px !important; border: 1px solid #E5E7EB !important; border-radius: 6px !important; background: #FFFFFF !important; color: #374151 !important; font-weight: 500 !important; cursor: pointer; transition: all 0.2s ease;">${t('table.prev', 'Prev')}</button>
          ${pageButtonsHTML}
          <button class="btn" onclick="changePage('${moduleKey}', ${currentTablePage + 1})" ${currentTablePage >= totalPages ? 'disabled' : ''} style="height: 28px !important; padding: 4px 10px !important; font-size: 12px !important; border: 1px solid #E5E7EB !important; border-radius: 6px !important; background: #FFFFFF !important; color: #374151 !important; font-weight: 500 !important; cursor: pointer; transition: all 0.2s ease;">${t('table.next', 'Next')}</button>
        </div>
      </div>
    ` : '';

    // Keep topbar clean
    const _tbAct = document.getElementById('topbar-actions-custom'); if (_tbAct) _tbAct.innerHTML = '';

    const dropdownFiltersHTML = buildDropdownFiltersHTML(moduleKey);
    const isSidebarModule = (moduleKey === 'employee' || moduleKey === 'employee_active' || moduleKey === 'payment' || moduleKey === 'invoice' || moduleKey === 'request' || moduleKey === 'service' || moduleKey === 'asset' || moduleKey === 'mtr' || moduleKey === 'account' || moduleKey === 'my_company' || moduleKey === 'request_activity_log' || moduleKey === 'finance' || moduleKey === 'contract' || !!(mod && mod.groupBy));
    const noAddButtonModules = new Set(['employee', 'employee_active', 'payment', 'invoice', 'account', 'service', 'asset', 'my_approval', 'my_process_owner', 'my_task', 'my_team', 'policy', 'oppotunity']);

    const actionsHTML = `
      ${await buildActionButtons(moduleKey)}
      ${['permissions', 'exception_rules', 'action_rules'].includes(moduleKey) ? `
        <button class="btn btn-outline btn-sm" id="bulk-edit-btn" onclick="openBulkEditModal('${moduleKey}')" style="display: none; background: #ea580c; color: white; border-color: #ea580c;"></button>
      ` : ''}
      ${isSidebarModule ? `<button class="btn table-filter-sidebar-toggle" id="table-filter-sidebar-toggle-${moduleKey}" type="button" aria-expanded="${!window.tableFilterSidebarHidden[moduleKey]}" onclick="toggleTableFilterSidebar('${moduleKey}')"><span class="material-symbols-rounded">filter_list</span><span class="table-filter-sidebar-toggle-label">${window.tableFilterSidebarHidden[moduleKey] ? t('table.show_filter', 'Hiện filter') : t('table.hide_filter', 'Ẩn filter')}</span></button>` : ''}
      ${moduleKey === 'my_request' && dropdownFiltersHTML ? `<button class="btn btn-outline btn-sm table-filter-toggle" id="table-filter-toggle-${moduleKey}" type="button" aria-expanded="${window.tableFilterPanelOpen[moduleKey] ? 'true' : 'false'}" onclick="toggleTableFilterPanel('${moduleKey}')"><span class="material-symbols-rounded" style="font-size:16px;">filter_list</span><span class="filter-toggle-label">${window.tableFilterPanelOpen[moduleKey] ? t('table.hide_filter', 'Ẩn filter') : t('table.show_filter', 'Hiện filter')}</span></button>` : ''}
      ${!noAddButtonModules.has(moduleKey) && isActionAllowed(moduleKey, 'add') ? `<button class="btn btn-custom-action" onclick="openAddModal('${moduleKey}')"><span class="material-symbols-rounded">add</span><span>${t('table.add', 'Add')}</span></button>` : ''}
      <button class="btn btn-outline btn-sm" onclick="exportToCSV('${moduleKey}')"><span class="material-symbols-rounded" style="font-size:14px;">upload</span> ${t('table.export', 'Export')}</button>
    `;

    const statusCardsHTML = buildTableStatusCards(moduleKey, data);
    updateGlobalStatusCards(statusCardsHTML);

    const buildHeaderRowHTML = () => `
      <tr class="header-row">
        ${['permissions', 'exception_rules', 'action_rules', 'contract', 'request', 'payment', 'invoice', 'my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(moduleKey) ? `
          <th class="row-bulk-checkbox-cell col-pinned" style="width: 40px; min-width: 40px; max-width: 40px; text-align: center; position: sticky; left: 0; background: #F8FAFC; z-index: 25;">
            <input type="checkbox" id="bulk-select-all" onclick="toggleSelectAllRows('${moduleKey}', this)">
          </th>
        ` : ''}
        ${QUICK_MENU_MODULES.includes(moduleKey) ? `<th class="request-row-menu-cell col-pinned" style="width: 45px; min-width: 45px; max-width: 45px; padding: 0; text-align: center; position: sticky; left: ${['permissions', 'exception_rules', 'action_rules', 'contract', 'request', 'payment', 'invoice', 'my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(moduleKey) ? '40px' : '0'}; background: #F8FAFC; z-index: 25;"></th>` : ''}
        ${mod.hasRowActions ? `<th class="row-actions col-pinned" style="width:70px; min-width:70px; max-width:70px; text-align:center; ${moduleKey === 'finance' ? 'position: sticky; left: 0; background: #F8FAFC; z-index: 25; border-right: 1px solid #E2E8F0;' : ''}"></th>` : ''}
        ${mod.columns.filter(c => !c.hidden && isColumnAllowed(moduleKey, c.key)).map(c => {
      const isPinned = isColumnPinned(moduleKey, c.key);
      const extraStyle = getStickyTableColumnStyle(moduleKey, c.key, true, mod);
      const pinnedClass = isPinned ? ' col-pinned' : '';
      const posStyle = extraStyle ? extraStyle : 'position: sticky; top: 0; z-index: 11; background: #F8FAFC;';
      return `<th class="col-${c.key}${pinnedClass}" onclick="toggleTableSort('${moduleKey}', '${c.key}')" style="cursor:pointer; user-select:none; ${posStyle}">${t(c.labelKey || ('col.' + c.key), c.label)}${getSortIcon(moduleKey, c.key)}<div class="col-resizer" onclick="event.stopPropagation()"></div></th>`;
    }).join('')}
      </tr>
    `;

    const existingView = document.getElementById(`view-${moduleKey}`);
    if (existingView && currentView === 'table' && currentModule === moduleKey) {
      const theadEl = existingView.querySelector('.data-table thead');
      if (theadEl) {
        theadEl.innerHTML = buildHeaderRowHTML();
      }

      applyAllFilters(moduleKey);

      const pagEl = document.getElementById(`pagination-${moduleKey}`);
      if (pagEl) {
        pagEl.outerHTML = paginationHTML;
      } else {
        const tableArea = document.getElementById(`tbody-${moduleKey}`)?.closest('.table-wrapper')?.parentElement;
        if (tableArea && paginationHTML) {
          tableArea.insertAdjacentHTML('beforeend', paginationHTML);
        }
      }

      const actionsWrapper = document.getElementById(`table-actions-${moduleKey}`);
      if (actionsWrapper) {
        actionsWrapper.innerHTML = actionsHTML;
      }

      if (isSidebarModule) {
        drawFilterSidebar(moduleKey);
      }

      const tbody = document.getElementById(`tbody-${moduleKey}`);
      if (tbody) {
        tbody.style.opacity = '1';
        tbody.style.pointerEvents = 'auto';
      }

      return;
    }

    if (isSidebarModule) {
      content.innerHTML = `
  <div class="view active" id="view-${moduleKey}" style="display:flex; flex-direction:column; height:100%; overflow:hidden; background:#FFFFFF; font-family:'Inter',sans-serif;">

    
    <!-- Search Header (full width, below KPI cards) -->
    <div class="dv-search-header" style="padding:12px 24px; display:flex; gap:12px; align-items:center; border-bottom:1px solid #E5E7EB; background:#ffffff; flex-shrink:0; height:72px;">
      <div style="position:relative; flex:1; min-width:200px; height:48px;">
        <span class="material-symbols-rounded" style="position:absolute; left:16px; top:50%; transform:translateY(-50%); font-size:18px; color:#6B7280;">search</span>
        <input type="text" class="search-input form-input" placeholder="${t('table.search_placeholder', 'Search')} ${meta.title}..." value="${escapeHTML(currentSearch)}" oninput="filterTable('${moduleKey}', this.value)" style="padding:12px 16px 12px 44px; width:100%; border-radius:8px; border:1px solid #E5E7EB; height:48px; font-size:13px; font-family:'Inter',sans-serif; color:#111827; background:#FFFFFF;" />
      </div>
      <div class="table-actions-wrapper" id="table-actions-${moduleKey}" style="display:flex; gap:8px; align-items:center;"></div>
    </div>

    <!-- Split Layout: Filter Sidebar (left 260px) + Table Area (right) -->
    <div class="dv-main-layout" style="flex:1; display:flex; min-height:0; overflow:hidden; background:#ffffff; gap:0;">
      <!-- Left Filter Sidebar -->
      <div class="dv-filter-sidebar ${window.tableFilterSidebarHidden[moduleKey] ? 'is-hidden' : ''}" id="table-filter-sidebar-${moduleKey}">
      </div>

      <!-- Right: Table Area -->
      <div style="flex:1; display:flex; flex-direction:column; overflow:hidden; background:#ffffff;">
        <div class="table-wrapper" style="flex:1; overflow:auto;">
          <table class="data-table">
            <thead>
              ${buildHeaderRowHTML()}
            </thead>
            <tbody id="tbody-${moduleKey}">
              <!-- We will render table rows dynamically using applyAllFilters -->
            </tbody>
          </table>
          ${data.length === 0 ? `<div class="empty-state"><div class="empty-icon material-symbols-rounded">inbox</div><div class="empty-title">${t('table.no_records', 'No records found')}</div><div class="empty-desc">${t('table.no_records_desc', 'Click "Add" to create the first entry.')}</div></div>` : ''}
        </div>
        ${paginationHTML}
      </div>
    </div>

  </div>
  <style>
    .filter-input::placeholder { color: var(--text-muted); opacity: 0.5; }
    .filter-input:focus { outline: none; border-color: var(--primary) !important; box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2); }
    .hidden-by-group { display: none !important; }
  </style>
  `;
      drawFilterSidebar(moduleKey);
      initSidebarResizer(moduleKey, false);
    } else {

      content.innerHTML = `
  <div class="view active" id="view-${moduleKey}" style="display:flex; flex-direction:column; height:100%; overflow:hidden; gap:8px;">
    <div class="table-container" style="flex:1;">
      <div class="table-toolbar" style="display:flex; flex-direction:column; gap:12px; padding:10px 16px;">
         <div class="search-box" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; width:100%;">
           <div style="display:flex; align-items:center; gap:12px; flex:1; max-width:550px; min-width:200px;">
             <div class="search-input-group" style="flex:1; max-width:400px; min-width:200px;">
               <span class="search-icon material-symbols-rounded" style="font-size:16px;">search</span>
               <input type="text" class="search-input" placeholder="${t('table.search_placeholder', 'Search')} ${meta.title}..." value="${escapeHTML(currentSearch)}" oninput="filterTable('${moduleKey}', this.value)">
             </div>
             <span id="count-${moduleKey}" class="search-count" style="font-size:10px; color:var(--text-muted); padding:4px 8px; background:rgba(0,0,0,0.1); border-radius:4px; white-space:nowrap;">${formatNumber(data.length)} ${t('table.records', 'records')}</span>
           </div>
           <!-- Table Actions Inline -->
           <div class="table-actions-wrapper" id="table-actions-${moduleKey}" style="display:flex; gap:8px; align-items:center; flex-shrink:0;"></div>
         </div>
         ${dropdownFiltersHTML ? `<div class="table-filter-panel ${window.tableFilterPanelOpen[moduleKey] ? 'is-open' : ''}" id="table-filter-panel-${moduleKey}">${dropdownFiltersHTML}</div>` : ''}
      </div>
      <div class="table-wrapper" style="flex:1; overflow:auto;">
        <table class="data-table">
          <thead>
            ${buildHeaderRowHTML()}
          </thead>
          <tbody id="tbody-${moduleKey}">
            <!-- We will render table rows dynamically using applyAllFilters -->
          </tbody>
        </table>
        ${data.length === 0 ? `<div class="empty-state"><div class="empty-icon material-symbols-rounded">inbox</div><div class="empty-title">${t('table.no_records', 'No records found')}</div><div class="empty-desc">${t('table.no_records_desc', 'Click "Add" to create the first entry.')}</div></div>` : ''}
      </div>
      ${paginationHTML}
    </div>
  </div>
  <style>
    .filter-input::placeholder { color: var(--text-muted); opacity: 0.5; }
    .filter-input:focus { outline: none; border-color: var(--primary) !important; box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2); }
    .hidden-by-group { display: none !important; }
  </style>
  `;
    }

    // Inject action buttons into the view toolbar
    const actionsWrapper = document.getElementById(`table-actions-${moduleKey}`);
    if (actionsWrapper) {
      actionsWrapper.innerHTML = actionsHTML;
    }


    // Trigger the client-side rendering with pagination via applyAllFilters
    applyAllFilters(moduleKey);

    // Restore scroll position if it exists
    if (moduleStates[moduleKey] && moduleStates[moduleKey].scrollTop !== undefined) {
      requestAnimationFrame(() => {
        setTimeout(() => {
          const container = document.querySelector(`#view-${moduleKey} .table-wrapper`);
          if (container) {
            container.scrollTop = moduleStates[moduleKey].scrollTop;
          }
        }, 100);
      });
    }
  } catch (err) {
    content.innerHTML = `<div class="empty-state"><div class="empty-icon material-symbols-rounded">warning</div><div class="empty-title">${t('toast.error_loading', 'Error Loading Data')}</div><div class="empty-desc">${err.message}</div></div>`;
    showToast(err.message, 'error');
  }
}

window.changePage = function (moduleKey, page) {
  if (page < 1) return;
  if (moduleStates[moduleKey]) moduleStates[moduleKey].scrollTop = 0;

  const dropdownFilters = activeDropdownFilters[moduleKey] || {};
  const serverFilteredModules = ['employee', 'employee_active', 'payment', 'invoice', 'request', 'service', 'asset', 'mtr', 'account', 'request_activity_log', 'finance', 'contract', 'expense', 'action_rules'];
  const isGlobalFetch = !serverFilteredModules.includes(moduleKey);

  if (isGlobalFetch && currentData && currentData.length > 50) {
    if (!moduleStates[moduleKey]) moduleStates[moduleKey] = {};
    moduleStates[moduleKey].page = page;
    applyAllFilters(moduleKey);
  } else {
    window.location.hash = `${moduleKey}&page=${page}`;
  }
};

// REMOVED Redundant buildTableViewHTML to ensure consistency

function buildTableRows(moduleKey, data) {
  const mod = MODULES[moduleKey];
  if (data.length === 0) return '';
  const visibleCols = mod.columns.filter(c => !c.hidden && isColumnAllowed(moduleKey, c.key));
  return data.map(row => buildSingleRowHTML(moduleKey, row, '', visibleCols)).join('');
}

let groupIdCounter = 0;

window.toggleGroup = function (groupId) {
  const icon = document.getElementById('icon-' + groupId);
  if (!icon) return;
  const isExpanded = icon.textContent === 'expand_more';
  icon.textContent = isExpanded ? 'chevron_right' : 'expand_more';

  const toggleChildren = (parentId, show) => {
    const children = document.querySelectorAll('.child-of-' + parentId);
    children.forEach(child => {
      // Re-apply filter logic if showing
      if (show) {
        // Just make it empty so css takes over. But maybe it was filtered out by search?
        // Let's rely on standard display, and if a filter is active, it might need re-evaluation.
        // For simplicity, we just set display. (Proper fix: trigger applyAllFilters if needed, or don't override search)
        // Actually, if we use a class 'collapsed', we can control it via CSS, which integrates better with inline styles from filters!
      }

      // Let's just set the hidden class or similar. Or display none.
      // But if filterTable applies inline display = '', it will override!
      // So we should add/remove a class 'hidden-by-group' instead of setting style directly.
      if (show) {
        child.classList.remove('hidden-by-group');
      } else {
        child.classList.add('hidden-by-group');
      }

      if (child.classList.contains('group-header')) {
        const childGroupId = child.dataset.groupId;
        const childIcon = document.getElementById('icon-' + childGroupId);
        const childIsExpanded = childIcon.textContent === 'expand_more';
        if (show && childIsExpanded) {
          toggleChildren(childGroupId, true);
        } else if (!show) {
          toggleChildren(childGroupId, false);
        }
      }
    });
  };

  toggleChildren(groupId, !isExpanded);
};

function renderGroupedRows(moduleKey, data, groupKeys, level, parentGroupId = '') {
  const mod = MODULES[moduleKey];
  const currentKey = groupKeys[level];
  const groups = {};

  data.forEach(row => {
    let val = row[currentKey] || 'Unassigned';
    val = resolveLookupValue(moduleKey, currentKey, val);
    if (!groups[val]) groups[val] = [];
    groups[val].push(row);
  });

  let html = '';
  const sortedGroupNames = Object.keys(groups).sort();

  for (const groupName of sortedGroupNames) {
    const groupData = groups[groupName];
    const indent = level * 24;
    const currentGroupId = 'grp_' + (++groupIdCounter);
    const visibleColsCount = mod.columns.filter(c => !c.hidden).length;
    const parentClass = parentGroupId ? 'child-of-' + parentGroupId + ' hidden-by-group' : '';

    html += `
      <tr class="group-header ${parentClass}" data-group-id="${currentGroupId}" onclick="toggleGroup('${currentGroupId}')" style="background:var(--bg-hover); cursor:pointer;">
        <td colspan="${visibleColsCount + (mod.hasRowActions ? 1 : 0)}" style="padding-left:${16 + indent}px; font-weight:600; color:var(--text-secondary); border-bottom:1px solid var(--border);">
          <div style="display:flex; align-items:center; gap:6px;">
            <span class="material-symbols-rounded" id="icon-${currentGroupId}" style="font-size:18px; color:var(--text-muted);">chevron_right</span>
            <span style="font-size:12px; text-transform:uppercase; letter-spacing:0.5px;">${groupName} <span style="color:var(--text-muted); font-size:11px;">(${groupData.length})</span></span>
          </div>
        </td>
      </tr>
    `;

    if (level < groupKeys.length - 1) {
      html += renderGroupedRows(moduleKey, groupData, groupKeys, level + 1, currentGroupId);
    } else {
      html += groupData.map(row => buildSingleRowHTML(moduleKey, row, currentGroupId)).join('');
    }
  }
  return html;
}

window.resolveVirtualColumn = function (moduleKey, colKey, row) {
  if (moduleKey === 'oppotunity' || moduleKey === 'oppo' || moduleKey === 'opportunity') {
    if (colKey === 'project_label') {
      return [row.project_id, row.project_name].filter(Boolean).join(' - ');
    }
    if (colKey === 'fy_recognized') {
      if (!row.create_date) return '';
      const d = new Date(row.create_date);
      return isNaN(d) ? '' : d.getFullYear().toString();
    }
    if (colKey === 'fy_target_closed_date') {
      if (!row.close_date) return '';
      const d = new Date(row.close_date);
      return isNaN(d) ? '' : d.getFullYear().toString();
    }
    if (colKey === 'quarter_by_closed_date') {
      if (!row.close_date) return '';
      const d = new Date(row.close_date);
      if (isNaN(d)) return '';
      return `Q${Math.floor(d.getMonth() / 3) + 1}`;
    }
    if (colKey === 'sale_team') {
      const ids = Array.isArray(row.sale_team) ? row.sale_team : (typeof row.sale_team === 'string' ? row.sale_team.split(',').map(x => x.trim().replace(/^\[|\]$/g, '').replace(/^"|"$/g, '')).filter(Boolean) : []);
      if (!ids || ids.length === 0) return '';
      const empOpts = window.selectCache && window.selectCache['employee'] ? window.selectCache['employee'] : [];
      const names = ids.map(id => {
        const emp = empOpts.find(e => String(e.employee_id) === String(id));
        return emp ? emp.full_name : id;
      });
      return names.filter(Boolean).join(', ');
    }
  }
  if (moduleKey === 'payment') {
    if (colKey === 'counter_party' || colKey === 'pay_to' || colKey === 'pay_from') {
      const rawCp = row.counter_party;
      let resolvedCp = '';
      if (rawCp && rawCp !== 'Counter party (Company or Individual)' && rawCp !== 'Employee' && rawCp !== 'Company' && rawCp !== '—') {
        resolvedCp = resolveLookupValue('payment', 'counter_party', rawCp);
      }
      if (resolvedCp && resolvedCp !== rawCp && resolvedCp !== 'Counter party (Company or Individual)' && resolvedCp !== '—') {
        return resolvedCp;
      }
      const empVal = row.employee;
      const compVal = row.company;
      if (empVal && empVal !== '—') {
        const empOpts = window.selectCache && window.selectCache['employee'] ? window.selectCache['employee'] : [];
        const emp = empOpts.find(e => String(e.employee_id) === String(empVal) || String(e.email) === String(empVal) || String(e.username) === String(empVal));
        if (emp) return `Employee | ${emp.full_name || emp.email || empVal}`;
        return `Employee | ${empVal}`;
      }
      if (compVal && compVal !== '—') {
        const compOpts = window.selectCache && window.selectCache['company'] ? window.selectCache['company'] : [];
        const myCompOpts = window.selectCache && window.selectCache['my_company'] ? window.selectCache['my_company'] : [];
        const comp = (compOpts && compOpts.find(c => String(c.company_id) === String(compVal))) ||
                     (myCompOpts && myCompOpts.find(c => String(c.my_company_id) === String(compVal)));
        if (comp) return `Company | ${comp.company_label || [comp.company_shortname, comp.company_fullname].filter(Boolean).join(' | ') || comp.company_name || compVal}`;
        return `Company | ${compVal}`;
      }
      if (resolvedCp && resolvedCp !== 'Counter party (Company or Individual)' && resolvedCp !== '—') {
        return resolvedCp;
      }
      return '';
    }
  }
  if (moduleKey === 'target_table' && colKey === 'record_ids') {
    const targetTable = row.table_name;
    const recordIds = Array.isArray(row.record_ids)
      ? row.record_ids
      : (typeof row.record_ids === 'string'
        ? row.record_ids.split(',').map(s => s.trim().replace(/^\[|\]$/g, '')).filter(Boolean)
        : []);

    if (recordIds.length === 0) return '';

    const getRecordLabel = (tbl, item) => {
      if (tbl === 'employee') return item.full_name || '';
      if (tbl === 'my_company') return item.company_shortname || '';
      if (tbl === 'company') return item.company_shortname || '';
      if (tbl === 'asset') return item.asset_name || '';
      if (tbl === 'service') return item.service_name || '';
      if (tbl === 'contact') return item.full_name || '';
      if (tbl === 'policy') return item.policy_name || '';
      return item.id || '';
    };

    const getPkName = (tbl) => {
      if (tbl === 'employee') return 'employee_id';
      if (tbl === 'my_company') return 'my_company_id';
      if (tbl === 'company') return 'company_id';
      if (tbl === 'asset') return 'office_asset_id';
      if (tbl === 'service') return 'service_id';
      if (tbl === 'contact') return 'contact_id';
      if (tbl === 'policy') return 'policy_id';
      return 'id';
    };

    const pkCol = getPkName(targetTable);
    const cachedItems = selectCache[targetTable] || [];

    const resolvedLabels = recordIds.map(id => {
      const found = cachedItems.find(item => String(item[pkCol]) === String(id));
      return found ? getRecordLabel(targetTable, found) : id;
    });

    return resolvedLabels.join(', ');
  }
  if (moduleKey === 'my_location' && colKey === 'location_label') {
    const code = row.location_code || '';
    const type = row.type || '';
    const compVal = row.my_company || row.company_shortname || '';
    let compShortName = compVal;
    if (typeof selectCache !== 'undefined' && selectCache['my_company']) {
      const matched = selectCache['my_company'].find(c => String(c.my_company_id) === String(compVal) || String(c.company_shortname) === String(compVal));
      if (matched) compShortName = matched.company_shortname || '';
    }
    return [code, type, compShortName].filter(Boolean).join(' | ');
  }
  if (moduleKey === 'company' && colKey === 'counter_party_label') {
    const shortVal = (row.company_shortname || '').trim();
    const fullVal = (row.company_fullname || '').trim();
    return [shortVal, fullVal].filter(Boolean).join(' | ');
  }
  if (moduleKey === 'department' && colKey === 'department_label') {
    const deptName = row.department_name || '';
    const compVal = row.company_shortname || row.company_id || '';
    let compShortName = compVal;
    if (typeof selectCache !== 'undefined' && selectCache['my_company']) {
      const matched = selectCache['my_company'].find(c => String(c.my_company_id) === String(compVal) || String(c.company_shortname) === String(compVal));
      if (matched) compShortName = matched.company_shortname || '';
    }
    return [deptName, compShortName].filter(Boolean).join(' | ');
  }
  if (moduleKey === 'contract') {
    if (colKey === 'contract_label') {
      const typeMap = { 69: 'Selling', 70: 'Buying', 71: 'Internal', '69': 'Selling', '70': 'Buying', '71': 'Internal' };
      const rawType = row.type;
      const typeLabel = typeMap[rawType] || (typeof rawType === 'string' && isNaN(rawType) ? rawType : '');
      const no = row.contractspood_no || '';
      const desc = row.contract_name_or_description || '';
      return [typeLabel, no, desc].filter(Boolean).join(' | ');
    }
    if (colKey === 'total_value') {
      if (row.total_value !== undefined && row.total_value !== null) return row.total_value;
      return (parseFloat(row.value_before_vat) || 0) + (parseFloat(row.vat_value) || 0);
    }
    if (colKey === 'value_before_vat_in_base_currency') {
      if (row.value_before_vat_in_base_currency !== undefined && row.value_before_vat_in_base_currency !== null) return row.value_before_vat_in_base_currency;
      const val = parseFloat(row.value_before_vat) || 0;
      const rate = parseFloat(row.exchance_rate) || 1;
      return Math.round(val * rate);
    }
    if (colKey === 'vat_value_in_base_currency') {
      if (row.vat_value_in_base_currency !== undefined && row.vat_value_in_base_currency !== null) return row.vat_value_in_base_currency;
      const vat = parseFloat(row.vat_value) || 0;
      const rate = parseFloat(row.exchance_rate) || 1;
      return Math.round(vat * rate);
    }
    if (colKey === 'total_value_in_base_currency') {
      if (row.total_value_in_base_currency !== undefined && row.total_value_in_base_currency !== null) return row.total_value_in_base_currency;
      const val = parseFloat(row.value_before_vat) || 0;
      const vat = parseFloat(row.vat_value) || 0;
      const rate = parseFloat(row.exchance_rate) || 1;
      return Math.round((val + vat) * rate);
    }
  }
  if (moduleKey === 'expense') {
    if (colKey === 'total_value') {
      if (row.total_value !== undefined && row.total_value !== null) return row.total_value;
      return (parseFloat(row.value_before_vat) || 0) + (parseFloat(row.vat_value) || 0);
    }
    if (colKey === 'value_before_vat_in_base_currency') {
      if (row.value_before_vat_in_base_currency !== undefined && row.value_before_vat_in_base_currency !== null) return row.value_before_vat_in_base_currency;
      const val = parseFloat(row.value_before_vat) || 0;
      const rate = parseFloat(row.exchange_rate) || 1;
      return Math.round(val * rate);
    }
    if (colKey === 'vat_value_in_base_currency') {
      if (row.vat_value_in_base_currency !== undefined && row.vat_value_in_base_currency !== null) return row.vat_value_in_base_currency;
      const vat = parseFloat(row.vat_value) || 0;
      const rate = parseFloat(row.exchange_rate) || 1;
      return Math.round(vat * rate);
    }
    if (colKey === 'total_value_in_base_currency') {
      if (row.total_value_in_base_currency !== undefined && row.total_value_in_base_currency !== null) return row.total_value_in_base_currency;
      const val = parseFloat(row.value_before_vat) || 0;
      const vat = parseFloat(row.vat_value) || 0;
      const rate = parseFloat(row.exchange_rate) || 1;
      return Math.round((val + vat) * rate);
    }
  }
  if (moduleKey === 'invoice') {
    if (colKey === 'total_value') {
      if (row.total_value !== undefined && row.total_value !== null) return row.total_value;
      return (parseFloat(row.value_before_vat) || 0) + (parseFloat(row.vat_value) || 0);
    }
    if (colKey === 'value_before_vat_in_base_currency') {
      if (row.value_before_vat_in_base_currency !== undefined && row.value_before_vat_in_base_currency !== null) return row.value_before_vat_in_base_currency;
      const val = parseFloat(row.value_before_vat) || 0;
      const rate = parseFloat(row.exchange_rate) || 1;
      return Math.round(val * rate);
    }
    if (colKey === 'vat_value_in_base_currency') {
      if (row.vat_value_in_base_currency !== undefined && row.vat_value_in_base_currency !== null) return row.vat_value_in_base_currency;
      const vat = parseFloat(row.vat_value) || 0;
      const rate = parseFloat(row.exchange_rate) || 1;
      return Math.round(vat * rate);
    }
    if (colKey === 'total_value_in_base_currency') {
      if (row.total_value_in_base_currency !== undefined && row.total_value_in_base_currency !== null) return row.total_value_in_base_currency;
      const val = parseFloat(row.value_before_vat) || 0;
      const vat = parseFloat(row.vat_value) || 0;
      const rate = parseFloat(row.exchange_rate) || 1;
      return Math.round((val + vat) * rate);
    }
  }
  if (moduleKey === 'payment') {
    if (colKey === 'value_in_base_currency') {
      if (row.value_in_base_currency !== undefined && row.value_in_base_currency !== null) return row.value_in_base_currency;
      const val = parseFloat(row.value) || 0;
      const rate = parseFloat(row.exchange_rate) || 1;
      return Math.round(val * rate);
    }
  }
  if (moduleKey === 'asset') {
    if (colKey === 'value_in_base_currency') {
      if (row.value_in_base_currency !== undefined && row.value_in_base_currency !== null) return row.value_in_base_currency;
      const cost = parseFloat(String(row.purchase_cost || '').replace(/[^0-9.]/g, '')) || 0;
      const rate = parseFloat(String(row.exchange_rate || '').replace(/[^0-9.]/g, '')) || 1;
      return Math.round(cost * rate);
    }
  }
  if (moduleKey === 'account') {
    if (colKey === 'balance_in_base_currency') {
      if (row.balance_in_base_currency !== undefined && row.balance_in_base_currency !== null) return row.balance_in_base_currency;
      const bal = parseFloat(row.balance) || 0;
      const rate = parseFloat(row.exchange_rate) || 1;
      return Math.round(bal * rate);
    }
  }
  return undefined;
};

function buildSingleRowHTML(moduleKey, row, parentGroupId = '', visibleCols = null) {
  const mod = MODULES[moduleKey];
  const pkVal = row[mod.pk];
  if (!visibleCols) {
    visibleCols = mod.columns.filter(c => !c.hidden && isColumnAllowed(moduleKey, c.key));
  }
  const parentClass = parentGroupId ? 'child-of-' + parentGroupId + ' hidden-by-group' : '';

  const resolvedSearchVals = [];
  const cellsArray = visibleCols.map(colOrig => {
    let col = { ...colOrig };
    const isPinned = isColumnPinned(moduleKey, col.key);
    const pinnedClass = isPinned ? ' col-pinned' : '';

    if (col.key === 'request' && (moduleKey === 'payment' || moduleKey === 'invoice') && row.source === 'Contract') {
      col.key = 'contract_id';
      col.label = 'Contract';
      col.labelKey = 'col.contract';
      col.optionsFrom = 'contract';
    }
    let val = parseBufferVal(row[col.key]);
    const virtualVal = resolveVirtualColumn(moduleKey, col.key, row);
    if (virtualVal !== undefined) val = virtualVal;
    if (col.key === 'total_value' && moduleKey === 'contract') {
      val = (parseFloat(row.value_before_vat) || 0) + (parseFloat(row.vat_value) || 0);
    }
    val = resolveLookupValue(moduleKey, col.key, val);

    if (val !== null && val !== undefined) {
      resolvedSearchVals.push(String(val));
    }

    if (val === null || val === undefined) val = '';

    if (col.key === 'policy_name' && typeof val === 'string' && val.toUpperCase().startsWith('OPPORTUNITY')) {
      val = 'Opportunity';
    }

    // Formatting for specific columns
    const k = String(col.key).toLowerCase();
    const l = String(col.label).toLowerCase();

    if ((col.key === 'point' || col.key === 'rating_point') && (moduleKey === 'request_rating' || moduleKey === 'rating')) {
      const pointVal = parseInt(val) || 0;
      let starsHTML = '';
      for (let i = 1; i <= 5; i++) {
        const starColor = i <= pointVal ? '#EAB308' : '#D1D5DB';
        starsHTML += `<span class="material-symbols-rounded" style="font-size:16px; color:${starColor}; vertical-align:middle; line-height:1;">star</span>`;
      }
      const displayStars = `${starsHTML} <span style="font-size:11px; color:var(--text-muted); font-weight:600; margin-left:4px; vertical-align:middle;">(${pointVal})</span>`;
      let tdStyle = getStickyTableColumnStyle(moduleKey, col.key, false, mod);
      return `<td class="col-${col.key}${pinnedClass}" data-label="${escapeHTML(col.label)}" style="${tdStyle}">${displayStars}</td>`;
    }

    if (col.key === 'log_time') {
      val = formatDateTime(val);
    }
    if (col.key === 'table_name') {
      val = val ? (val.charAt(0).toUpperCase() + val.slice(1).replace(/_/g, ' ')) : '';
    }
    if (col.key === 'changes') {
      let formattedChanges = '';
      try {
        const changesObj = typeof val === 'string' ? JSON.parse(val) : val;
        if (changesObj && typeof changesObj === 'object') {
          const keys = Object.keys(changesObj).filter(k => k !== 'log' && k !== 'updated_date');
          if (keys.length > 0) {
            formattedChanges = `<span style="color:var(--text-secondary); opacity:0.8; font-weight: 500;">Changed: ${keys.join(', ')}</span>`;
          } else {
            formattedChanges = `<span style="color:var(--text-muted); font-style:italic;">No field changes</span>`;
          }
        } else {
          formattedChanges = escapeHTML(String(val));
        }
      } catch (e) {
        formattedChanges = escapeHTML(String(val));
      }
      return `<td class="col-${col.key}${pinnedClass}" data-label="${escapeHTML(col.label)}" style="font-size:11px; line-height:1.4; vertical-align:middle; white-space:nowrap; max-width:250px; overflow:hidden; text-overflow:ellipsis;" title="${escapeHTML(formattedChanges.replace(/<[^>]*>/g, ''))}">${formattedChanges}</td>`;
    }

    if (k === 'log' || k === 'logs' || l === 'log' || l === 'logs') {
      const formattedLog = formatLogEntry(val);
      return `<td class="col-${col.key}${pinnedClass}" data-label="${escapeHTML(col.label)}" style="font-size:10px; line-height:1.5; max-width:250px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; vertical-align:middle;" title="${escapeHTML(formattedLog)}">${formattedLog}</td>`;
    }

    if (col.key === 'process_duration') {
      const slaInfo = calculateRequestSLA(row);
      let tdStyle = getStickyTableColumnStyle(moduleKey, col.key, false, mod);
      return `<td class="col-${col.key}${pinnedClass}" data-label="${escapeHTML(col.label)}" style="${tdStyle} font-weight: 500; font-size: 12px; white-space: nowrap;">${escapeHTML(slaInfo.durationFormatted)}</td>`;
    }

    if (col.key === 'sla_status') {
      const slaInfo = calculateRequestSLA(row);
      let tdStyle = getStickyTableColumnStyle(moduleKey, col.key, false, mod);
      return `<td class="col-${col.key}${pinnedClass}" data-label="${escapeHTML(col.label)}" style="${tdStyle}">${escapeHTML(slaInfo.badgeLabel)}</td>`;
    }

    if (col.key === 'sla' || col.key === 'policy_sla') {
      let tdStyle = getStickyTableColumnStyle(moduleKey, col.key, false, mod);
      if (val !== undefined && val !== null && val !== '') {
        const numVal = Number(val);
        const unitDay = typeof t === 'function' ? t('unit.days', 'd') : 'd';
        const disp = !isNaN(numVal) ? `${numVal.toFixed(2)} ${unitDay}` : String(val);
        return `<td class="col-${col.key}${pinnedClass}" data-label="${escapeHTML(col.label)}" style="${tdStyle} font-size: 12px; white-space: nowrap;">${escapeHTML(disp)}</td>`;
      } else {
        const naText = typeof t === 'function' ? t('badge.sla_na', 'Không áp dụng SLA') : 'Không áp dụng SLA';
        return `<td class="col-${col.key}${pinnedClass}" data-label="${escapeHTML(col.label)}" style="${tdStyle} color: #94A3B8; font-size: 12px; white-space: nowrap;">${escapeHTML(naText)}</td>`;
      }
    }

    const isRequestTable = ['request', 'my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(moduleKey);
    if (isRequestTable && (col.type === 'date' || col.type === 'datetime' || ['date', 'due_date', 'payment_date', 'start_date', 'end_date', 'purchase_date', 'contract_signed_date', 'transaction_date', 'invoice_date', 'close_date', 'create_date', 'request_date'].includes(col.key) || col.key === 'log_time' || col.key === 'created_date' || col.key === 'updated_date' || k.endsWith('_date') || k.includes('date') || l.includes('date') || (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}/)))) {
      val = formatDateTime(val);
    } else if (['date', 'due_date', 'payment_date', 'start_date', 'end_date', 'purchase_date', 'contract_signed_date', 'transaction_date', 'invoice_date', 'close_date', 'create_date', 'request_date'].includes(col.key) || col.type === 'date' || l === 'date' || l === 'transaction date' || (l.includes('date') && !['log_time', 'created_date', 'updated_date'].includes(col.key))) {
      val = formatDateMON(val);
    } else if (col.key === 'log_time' || col.key === 'created_date' || col.key === 'updated_date' || k.endsWith('_date') || l.includes('date') || (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/))) {
      val = formatDateTime(val);
    } else if (isNumericFieldKey(col.key, col.type)) {
      if (k.includes('rate')) {
        val = formatExchangeRate(val);
      } else {
        if (moduleKey === 'finance' && (val === 0 || val === '0' || parseFloat(val) === 0 || val === '')) {
          val = '';
        } else {
          val = formatNumber(val);
        }
      }
    }

    if ((col.badge || ['status', 'payment_status', 'invoice_status', 'sr_status', 'process_status', 'account_status', 'payment_type', 'billing_status', 'subscription_status', 'elements'].includes(col.key)) && val !== undefined && val !== null && val !== '') {
      let tdStyle = getStickyTableColumnStyle(moduleKey, col.key, false, mod);
      const rawValStr = String(val).replace(/^\[|\]$/g, '');
      const parts = (rawValStr.includes(',') && !['status', 'payment_status', 'invoice_status', 'sr_status'].includes(col.key))
        ? rawValStr.split(',').map(s => s.trim().replace(/^\[|\]$/g, '')).filter(Boolean)
        : [rawValStr];

      const translated = parts.map(part => {
        if (col.key === 'payment_type') {
          if (part === '60' || Number(part) === 60 || String(part).toLowerCase() === 'incoming') return (typeof t === 'function' ? t('status.incoming', 'Incoming') : 'Incoming');
          if (part === '61' || Number(part) === 61 || String(part).toLowerCase() === 'outgoing') return (typeof t === 'function' ? t('status.outgoing', 'Outgoing') : 'Outgoing');
        }
        return (typeof t_val === 'function') ? t_val(part) : String(part);
      }).join(', ');
      return `<td class="col-${col.key}${pinnedClass}" data-label="${escapeHTML(col.label)}" title="${escapeHTML(translated)}" style="${tdStyle}">${escapeHTML(translated)}</td>`;
    }

    if (col.type === 'child_count') {
      const v = Number(val) || 0;
      let tdStyle = getStickyTableColumnStyle(moduleKey, col.key, false, mod);
      return `<td class="col-${col.key}${pinnedClass} child-count-cell" data-label="${escapeHTML(col.label || '')}" style="${tdStyle} white-space:nowrap; text-align:center; font-weight:500; font-size:13px; color:var(--text-primary);">${formatNumber(v)}</td>`;
    }


    // Special Merging for Avatar / Logo in specific modules
    const isEmployeeName = (moduleKey === 'employee' || moduleKey === 'employee_active') && k === 'full_name';
    const isPartnerName = moduleKey === 'company' && (k === 'company_fullname' || k === 'company_shortname');

    if (isEmployeeName || isPartnerName) {
      const imgKey = isEmployeeName ? 'avatar' : 'logo';
      const imgVal = row[imgKey];
      const imgHTML = (imgVal && String(imgVal).includes('base64'))
        ? `<img src="${imgVal}" style="width:24px;height:24px;${isEmployeeName ? 'border-radius:50%;' : 'border-radius:4px;'}object-fit:cover;margin-right:8px;vertical-align:middle;" />`
        : '';
      const stickyStyle = isEmployeeName ? `${getStickyTableColumnStyle(moduleKey, col.key, false, mod)} white-space: nowrap; overflow: hidden; text-overflow: ellipsis;` : '';
      return `<td class="col-${col.key}${pinnedClass}" data-label="${escapeHTML(col.label)}" title="${String(val).replace(/"/g, '&quot;')}" style="${stickyStyle}">${imgHTML}${val}</td>`;
    }

    if (typeof val === 'string' && val.trim().toLowerCase().includes('data:image') && val.trim().toLowerCase().includes('base64')) {
      // If it's a standalone logo column in 'my_company', make it square as requested
      const isMyCompanyLogo = moduleKey === 'my_company' && k === 'logo';
      const style = isMyCompanyLogo
        ? 'width:40px;height:40px;border-radius:4px;object-fit:contain;'
        : 'width:32px;height:32px;border-radius:50%;object-fit:cover;';
      return `<td class="col-${col.key}${pinnedClass}" data-label="${escapeHTML(col.label)}"><img src="${val.trim()}" alt="Img" style="${style}vertical-align:middle;" /></td>`;
    }

    let tdStyle = getStickyTableColumnStyle(moduleKey, col.key, false, mod);

    if (col.type === 'file' || k === 'file' || k === 'procedure_file' || k === 'attachment' || (typeof val === 'string' && (val.startsWith('/uploads/') || val.startsWith('["/uploads/')))) {
      if (!val) return `<td class="col-${col.key}${pinnedClass}" data-label="${escapeHTML(col.label)}" style="${tdStyle}"></td>`;
      let fileList = [];
      try {
        if (typeof val === 'string' && val.startsWith('[')) fileList = JSON.parse(val);
        else fileList = String(val).split(',').map(s => s.trim()).filter(Boolean);
      } catch (e) {
        fileList = [val];
      }
      const filesHtml = fileList.map(f => {
        const clean = formatFileNameDisplay(f);
        return `<a href="${escapeHTML(f)}" target="_blank" download="${escapeHTML(clean)}" style="display:inline-flex; align-items:center; gap:4px; color:#2563EB; font-weight:500; text-decoration:none; margin-right:8px;" onclick="event.stopPropagation();"><span class="material-symbols-rounded" style="font-size:15px;">attach_file</span> ${escapeHTML(clean)}</a>`;
      }).join('');
      return `<td class="col-${col.key}${pinnedClass}" data-label="${escapeHTML(col.label)}" style="${tdStyle}">${filesHtml}</td>`;
    }

    return `<td class="col-${col.key}${pinnedClass}" data-label="${escapeHTML(col.label)}" title="${escapeHTML(String(val))}" style="${tdStyle}">${escapeHTML(String(val))}</td>`;
  });

  if (row.deleted_at && cellsArray.length > 0) {
    const firstCell = cellsArray[0];
    const tdCloseIdx = firstCell.indexOf('>');
    if (tdCloseIdx !== -1) {
      const iconHTML = `<span class="material-symbols-rounded" style="font-size:14px; color:#EF4444; margin-right:6px; vertical-align:middle;" title="Soft Deleted">block</span>`;
      cellsArray[0] = firstCell.substring(0, tdCloseIdx + 1) + iconHTML + firstCell.substring(tdCloseIdx + 1);
    }
  }
  const cells = cellsArray.join('');

  const searchTerms = [
    ...Object.values(row).map(v => String(v)),
    ...resolvedSearchVals
  ]
    .filter(v => v.length < 500)
    .join(' ')
    .toLowerCase();

  let statusClass = '';
  if (moduleKey !== 'request') {
    let statusVal = row.payment_status || row.invoice_status || row.account_status || row.status || null;
    if (statusVal) {
      const s = String(statusVal).toLowerCase();
      if (['active', 'approved', 'completed', 'open', 'paid', 'issued'].includes(s)) {
        statusClass = 'status-success';
      } else if (['inactive', 'cancelled', 'rejected', 'closed', 'void', 'resigned', 'failed', 'failured', 'không được sử dụng', 'hết hiệu lực'].includes(s)) {
        statusClass = 'status-failure';
      } else if (['pending', 'processing', 'draft', 'not started yet', 'pending confirmation', 'submitted for payment', 'ready for payment', 'pending payment', 'collection working'].includes(s)) {
        statusClass = 'status-warning';
      }
    }
  }

  const hasCheckbox = ['permissions', 'exception_rules', 'action_rules', 'contract', 'request', 'payment', 'invoice', 'my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(moduleKey);
  const checkboxHTML = hasCheckbox ? `
    <td class="row-bulk-checkbox-cell col-pinned" style="width: 40px; min-width: 40px; max-width: 40px; text-align: center; position: sticky; left: 0; background: #ffffff; z-index: 10;" onclick="event.stopPropagation()">
      <input type="checkbox" class="row-bulk-checkbox" data-pk="${pkVal}" onchange="handleRowCheckboxChange('${moduleKey}')">
    </td>
  ` : '';

  // Hamburger quick-action menu for request dashboards, contract, invoice, payment, expense, asset, service
  const hasQuickMenu = QUICK_MENU_MODULES.includes(moduleKey);
  const menuBtnHTML = hasQuickMenu ? `
    <td class="request-row-menu-cell col-pinned" style="width: 45px; min-width: 45px; max-width: 45px; padding: 0; text-align: center; position: sticky; left: ${hasCheckbox ? '40px' : '0'}; background: #ffffff; z-index: 10;" onclick="event.stopPropagation()">
      <button class="row-action-menu-btn" title="Quick actions"
        onclick="toggleRowActionMenu('${moduleKey}', '${pkVal}', this, event)">
        <span class="material-symbols-rounded" style="font-size:18px; pointer-events:none; color: #64748B;">more_vert</span>
      </button>
    </td>
  ` : '';

  const clickHash = `${moduleKey}/${pkVal}`;
  const isDeleted = !!row.deleted_at;
  return `
    <tr data-search="${searchTerms.replace(/"/g, '&quot;')}" class="${parentClass} item-row ${statusClass} ${isDeleted ? 'soft-deleted-row' : ''}" data-parent-id="${parentGroupId}" onclick="window.location.hash = '${clickHash}'" style="cursor:pointer">
      ${checkboxHTML}
      ${menuBtnHTML}
      ${mod.hasRowActions ? `
      <td data-label="" class="row-actions col-pinned" style="width:70px; min-width:70px; max-width:70px; text-align:center; ${moduleKey === 'finance' ? 'position: sticky; left: 0; background: #ffffff; z-index: 10; border-right: 1px solid #E2E8F0;' : ''}" onclick="event.stopPropagation()">
        ${moduleKey === 'request_activity_log' ? `
          <button class="btn btn-sm" onclick="triggerRowRevert('${row.table_name}', '${row.request_id}', ${row.id})" style="background:#ea580c; color:white; border:none; padding:4px 8px; border-radius:4px; font-size:10px; font-weight:600; cursor:pointer;" title="Revert to this version">Revert</button>
        ` : ''}
      </td>` : ''}
      ${cells}
    </tr>
  `;
}

const debouncedFilterTable = debounce((moduleKey, query) => {
  const normalizedQuery = query.toLowerCase();
  currentSearch = normalizedQuery;
  if (!moduleStates[moduleKey]) moduleStates[moduleKey] = {};
  moduleStates[moduleKey].search = normalizedQuery;
  moduleStates[moduleKey].page = 1;
  moduleStates[moduleKey].scrollTop = 0;

  if (isServerSearchModule(moduleKey)) {
    moduleStates[moduleKey].serverSearch = query.trim();
    savePersistedFilters(moduleKey);
    loadModule(moduleKey, false);
    return;
  }

  savePersistedFilters(moduleKey);
  applyAllFilters(moduleKey);
}, 400);

/* ============================================================
   Row Quick-Action Menu — toggle & populate dropdown
   ============================================================ */
window.__rowActionDropdown = null; // tracks the active dropdown element

function closeRowActionDropdown() {
  if (window.__rowActionDropdown) {
    window.__rowActionDropdown.remove();
    window.__rowActionDropdown = null;
  }
}

function findRowActionRecord(moduleKey, pkVal) {
  const mod = MODULES[moduleKey] || {};
  const pkKey = mod.pk || 'request_id';
  const sources = [
    currentData,
    dashboardData,
    selectCache[moduleKey],
    mod.writeTable ? selectCache[mod.writeTable] : null,
    ['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(moduleKey) ? selectCache.request : null
  ].filter(Array.isArray);

  if (window.childTableRawData) {
    for (const k of Object.keys(window.childTableRawData)) {
      if (k.endsWith('_' + moduleKey) && Array.isArray(window.childTableRawData[k])) {
        sources.push(window.childTableRawData[k]);
      }
    }
  }

  for (const source of sources) {
    const record = source.find(r => String(r[pkKey] || r.request_id || r.id) === String(pkVal));
    if (record) return record;
  }

  if (currentRecord && String(currentRecord[pkKey] || currentRecord.request_id || currentRecord.id) === String(pkVal)) {
    return currentRecord;
  }

  return null;
}

async function ensureRowActionRecord(moduleKey, pkVal) {
  let record = findRowActionRecord(moduleKey, pkVal);
  if (!record) {
    try {
      record = await apiGet(getRecordEndpoint(moduleKey, pkVal));
    } catch (e) {
      console.warn('Unable to preload row action record:', e);
    }
  }

  if (record) {
    if (currentView !== 'detail') {
      currentRecord = record;
    }
    const mod = MODULES[moduleKey] || {};
    const pkKey = mod.pk || 'request_id';
    const upsertRecord = (cacheKey) => {
      if (!cacheKey) return;
      if (!selectCache[cacheKey]) selectCache[cacheKey] = [];
      const idx = selectCache[cacheKey].findIndex(r => String(r[pkKey] || r.request_id || r.id) === String(pkVal));
      if (idx >= 0) selectCache[cacheKey][idx] = record;
      else selectCache[cacheKey].push(record);
    };
    upsertRecord(moduleKey);
    if (mod.writeTable) upsertRecord(mod.writeTable);
    if (['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(moduleKey)) upsertRecord('request');
  }

  return record;
}

window.executeRowAction = async function (actionId, moduleKey, pkVal) {
  closeRowActionDropdown();
  await ensureRowActionRecord(moduleKey, pkVal);
  window.__rowActionContext = { moduleKey, view: currentView };
  try {
    return await executeAction(actionId, moduleKey, pkVal);
  } finally {
    window.__rowActionContext = null;
  }
};

// Close when clicking outside
document.addEventListener('click', function (e) {
  if (window.__rowActionDropdown && !window.__rowActionDropdown.contains(e.target)) {
    closeRowActionDropdown();
  }
}, true);

window.toggleRowActionMenu = async function (moduleKey, pkVal, btn, event) {
  event.stopPropagation();

  // If the same button opened this dropdown, close it (toggle)
  if (window.__rowActionDropdown && window.__rowActionDropdown.dataset.pk === pkVal) {
    closeRowActionDropdown();
    return;
  }

  // Close any previously opened dropdown
  closeRowActionDropdown();

  // Create dropdown shell with a loading indicator
  const dropdown = document.createElement('div');
  dropdown.className = 'row-action-dropdown';
  dropdown.dataset.pk = pkVal;
  dropdown.innerHTML = `
    <div class="row-action-dropdown-loading">
      <span class="material-symbols-rounded" style="font-size:14px; animation:spin 0.8s linear infinite;">sync</span>
      <span>Loading…</span>
    </div>
  `;
  document.body.appendChild(dropdown);
  window.__rowActionDropdown = dropdown;

  // Position the dropdown below/above the button
  const btnRect = btn.getBoundingClientRect();
  const dropW = 180;
  let left = btnRect.left;
  let top = btnRect.bottom + 4;
  // Flip up if too close to bottom
  if (top + 200 > window.innerHeight) {
    top = btnRect.top - 4;
    dropdown.style.transform = 'translateY(-100%)';
    dropdown.style.animation = 'none'; // skip animation when flipped
  }
  if (left + dropW > window.innerWidth) left = window.innerWidth - dropW - 8;
  dropdown.style.left = left + 'px';
  dropdown.style.top = top + 'px';

  btn.classList.add('is-loading');

  try {
    // Resolve the view param (same logic as detail view)
    const viewParam = moduleKey; // my_request, my_approval, my_process_owner, my_team
    const isReq = ['my_request', 'my_approval', 'my_process_owner', 'my_team'].includes(moduleKey);
    const resolvedTable = isReq ? 'request' : moduleKey;

    // Determine edit / delete permission
    const mod = MODULES[moduleKey];
    const pkKey = mod ? mod.pk : 'request_id';
    // Find the record from currentData or child tables (fast, no extra fetch)
    let record = findRowActionRecord(moduleKey, pkVal);
    if (!record) {
      record = await ensureRowActionRecord(moduleKey, pkVal);
    }

    const isChildUnderRequest = currentView === 'detail' && ['request', 'my_request', 'my_approval', 'my_process_owner', 'my_team'].includes(currentModule);
    const canChildEdit = isChildUnderRequest ? (typeof isChildTableActionAllowed === 'function' && isChildTableActionAllowed(moduleKey, 'edit', currentModule)) : true;
    const canChildDelete = isChildUnderRequest ? (typeof isChildTableActionAllowed === 'function' && isChildTableActionAllowed(moduleKey, 'delete', currentModule)) : true;

    const canEdit = record && !record.deleted_at && canUserEditRecord(moduleKey, record) && canChildEdit && (isChildUnderRequest || isActionAllowed(viewParam, 'edit'));
    const canDelete = record && !record.deleted_at && canUserDeleteRecord(moduleKey, record) && canChildDelete && (isChildUnderRequest || isActionAllowed(viewParam, 'delete'));

    // Fetch dynamic workflow actions
    let dynamicActions = [];
    if (!isChildUnderRequest || canChildEdit) {
      try {
        dynamicActions = await apiGet(`/actions/${resolvedTable}/${pkVal}?view=${viewParam}`);
      } catch (e) { /* ignore */ }
    }

    // Build dropdown content
    const allItems = [];

    if (canEdit) {
      allItems.push(`
        <button class="row-action-dropdown-item is-edit" onclick="closeRowActionDropdown(); openEditModal('${moduleKey}', '${pkVal}')">
          <span class="material-symbols-rounded" style="font-size:15px;">edit</span>
          <span>${(typeof t === 'function') ? t('detail.edit', 'Edit') : 'Edit'}</span>
        </button>
      `);
    }

    const duplicateRestrictedViews = ['my_request', 'my_approval', 'my_process_owner', 'my_team'];
    const nonDuplicableTables = ['logs', 'request_activity_log', 'history', 'request_rating', 'rating', 'feedback', 'comment', 'ticket_comment', 'finance', 'assigned_task'];
    let canDuplicate = false;
    if (!duplicateRestrictedViews.includes(moduleKey) && !nonDuplicableTables.includes(moduleKey)) {
      if (currentView === 'detail' && typeof currentModule !== 'undefined' && currentModule) {
        canDuplicate = isChildTableActionAllowed(moduleKey, 'add', currentModule);
      } else {
        canDuplicate = isActionAllowed(moduleKey, 'add');
      }
    }

    if (canDuplicate) {
      allItems.push(`
        <button class="row-action-dropdown-item" onclick="closeRowActionDropdown(); duplicateRecord('${moduleKey}', '${pkVal}')">
          <span class="material-symbols-rounded" style="font-size:15px;">content_copy</span>
          <span>${(typeof t === 'function') ? t('detail.duplicate', 'Duplicate') : 'Duplicate'}</span>
        </button>
      `);
    }



    if (Array.isArray(dynamicActions)) {
      dynamicActions.forEach(act => {
        const actionId = act.action_id || act.id;
        const label = (typeof t === 'function') ? t('action.' + actionId, act.label || act.display_name || act.name) : (act.label || act.display_name || act.name);
        const color = (act.color || '').toLowerCase();
        let itemClass = 'row-action-dropdown-item';
        if (color.includes('red')) itemClass += ' is-danger';
        else if (color.includes('green')) itemClass += ' is-success';
        else if (actionId === 'withdraw' || actionId === 'withdraw_request') itemClass += ' is-withdraw';

        const iconHTML = act.icon && act.icon.startsWith('<svg')
          ? `<span style="width:15px;height:15px;display:inline-flex;">${act.icon}</span>`
          : `<span class="material-symbols-rounded" style="font-size:15px;">${act.icon || 'play_circle'}</span>`;

        allItems.push(`
          <button class="${itemClass}" onclick="executeRowAction('${actionId}', '${moduleKey}', '${pkVal}')">
            ${iconHTML}
            <span>${label}</span>
          </button>
        `);
      });
    }

    if (canDelete) {
      if (moduleKey === 'payment' && record && record.contract_id) {
        // Hide delete actions for auto-allocated payments
      } else {
        const displayName = record ? (mod && mod.displayName ? mod.displayName(record) : pkVal) : pkVal;
        allItems.push(`
          <button class="row-action-dropdown-item is-danger" onclick="closeRowActionDropdown(); confirmDelete('${moduleKey}', '${pkVal}', '${String(displayName).replace(/'/g, "\\'")}')">
            <span class="material-symbols-rounded" style="font-size:15px;">delete</span>
            <span>Delete</span>
          </button>
        `);
        const isSuperAdmin = authUser && authUser.role && authUser.role.toUpperCase() === 'SUPER ADMIN';
        if (isSuperAdmin) {
          allItems.push(`
            <button class="row-action-dropdown-item is-danger" style="background:#FFF5F5; border-top:1px solid #FFEBEB;" onclick="closeRowActionDropdown(); confirmHardDelete('${moduleKey}', '${pkVal}', '${String(displayName).replace(/'/g, "\\'")}')">
              <span class="material-symbols-rounded" style="font-size:15px; color:#EF4444;">delete_forever</span>
              <span style="color:#EF4444; font-weight:600;">Hard Delete</span>
            </button>
          `);
        }
      }
    }

    if (allItems.length === 0) {
      dropdown.innerHTML = `<div class="row-action-dropdown-empty">No actions available</div>`;
    } else {
      dropdown.innerHTML = allItems.join('');
    }
  } catch (err) {
    dropdown.innerHTML = `<div class="row-action-dropdown-empty" style="color:#EF4444;">Failed to load</div>`;
  } finally {
    btn.classList.remove('is-loading');
  }
};

window.closeRowActionDropdown = closeRowActionDropdown;

function filterTable(moduleKey, query) {
  debouncedFilterTable(moduleKey, query);
}

window.triggerGlobalSearch = function (moduleKey, query) {
  if (!moduleStates[moduleKey]) moduleStates[moduleKey] = {};
  moduleStates[moduleKey].serverSearch = query.trim();
  moduleStates[moduleKey].page = 1;
  savePersistedFilters(moduleKey);
  loadModule(moduleKey, false);
};

const activeColumnFilters = {};

window.filterTableByColumn = function (moduleKey, colKey, val) {
  if (!activeColumnFilters[moduleKey]) activeColumnFilters[moduleKey] = {};
  activeColumnFilters[moduleKey][colKey] = val.toLowerCase();
  applyAllFilters(moduleKey);
};

function applyAllFilters(moduleKey) {
  const tbody = document.getElementById(`tbody-${moduleKey}`);
  const countEl = document.getElementById(`count-${moduleKey}`);
  if (!tbody) return;

  const serverFilteredModules = ['employee', 'employee_active', 'payment', 'invoice', 'request', 'service', 'asset', 'mtr', 'account', 'request_activity_log', 'finance', 'contract', 'expense', 'action_rules'];
  const mod = MODULES[moduleKey];
  const colFilters = activeColumnFilters[moduleKey] || {};
  const dropdownFilters = activeDropdownFilters[moduleKey] || {};
  const search = (moduleStates[moduleKey]?.search || '').toLowerCase();

  // 1. Array Filtering
  let filteredData = [];
  if (!search && Object.keys(colFilters).length === 0 && Object.keys(dropdownFilters).length === 0) {
    filteredData = currentData;
  } else {
    const visibleCols = mod.columns.filter(c => !c.hidden);
    for (const row of currentData) {
      // Global Search
      let matchesGlobal = true;
      if (search) {
        if (!row._searchText) {
          let rowText = '';
          for (const k in row) {
            rowText += ' ' + String(row[k] || '');
            const resolved = resolveLookupValue(moduleKey, k, row[k]);
            if (resolved && resolved !== row[k]) {
              rowText += ' ' + String(resolved);
            }
          }
          row._searchText = rowText.toLowerCase();
        }
        matchesGlobal = row._searchText.includes(search);
      }
      if (!matchesGlobal) continue;

      // Column Filters
      let matchesColumn = true;
      if (Object.keys(colFilters).length > 0) {
        for (const [key, filterVal] of Object.entries(colFilters)) {
          if (!filterVal) continue;
          let val = row[key];
          val = resolveLookupValue(moduleKey, key, val);
          if (!String(val || '').toLowerCase().includes(filterVal)) {
            matchesColumn = false; break;
          }
        }
      }
      if (!matchesColumn) continue;

      // Dropdown Filters
      let matchesDropdown = true;
      if (!serverFilteredModules.includes(moduleKey) && Object.keys(dropdownFilters).length > 0) {
        const checkFilterMatch = (filterVal, rowVal, key, row) => {
          if (filterVal instanceof Set) {
            if (filterVal.size === 0) return true;
            let hasMatch = filterVal.has(String(rowVal));
            if (!hasMatch && row && (key === 'my_company' || key === 'company_id' || key === 'company_entity')) {
              const rawId = String(row.my_company || row.company_id || row.company_entity || '');
              if (rawId && filterVal.has(rawId)) hasMatch = true;
            }
            return hasMatch;
          }
          if (!filterVal) return true;
          let hasMatch = String(rowVal) === String(filterVal);
          if (!hasMatch && row && (key === 'my_company' || key === 'company_id' || key === 'company_entity')) {
            const rawId = String(row.my_company || row.company_id || row.company_entity || '');
            if (rawId && String(rawId) === String(filterVal)) hasMatch = true;
          }
          return hasMatch;
        };

        for (const [key, filterVal] of Object.entries(dropdownFilters)) {
          if (!filterVal) continue;
          if (moduleKey === 'employee' || moduleKey === 'employee_active') {
            if (key === 'my_company' && !checkFilterMatch(filterVal, row.company_shortname, key, row)) { matchesDropdown = false; break; }
            if (key === 'department_name' && !checkFilterMatch(filterVal, row.department_name, key, row)) { matchesDropdown = false; break; }
            if (key === 'status' && !checkFilterMatch(filterVal, row.status, key, row)) { matchesDropdown = false; break; }
          } else if (moduleKey === 'payment') {
            if (key === 'my_company' && !checkFilterMatch(filterVal, resolveCompanyForRecord(row), key, row)) { matchesDropdown = false; break; }
            if (key === 'payment_type' && !checkFilterMatch(filterVal, row.payment_type, key, row)) { matchesDropdown = false; break; }
            if (key === 'payment_status' && !checkFilterMatch(filterVal, row.payment_status, key, row)) { matchesDropdown = false; break; }

          } else if (['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team', 'request'].includes(moduleKey)) {
            if (key === 'policy_name') {
              const val = row.policy_name || resolveLookupValue(moduleKey, 'request_type', row.request_type) || 'N/A';
              if (!checkFilterMatch(filterVal, val, key, row)) { matchesDropdown = false; break; }
            }
            if (key === 'status') {
              const val = (['my_task', 'my_process_owner'].includes(moduleKey)) ? (row.process_status || 'N/A') : (row.sr_status || 'N/A');
              if (!checkFilterMatch(filterVal, val, key, row)) { matchesDropdown = false; break; }
            }
          } else if (moduleKey === 'operation_program') {
            if (key === 'my_company') {
              if (!checkFilterMatch(filterVal, resolveCompanyForRecord(row), key, row)) { matchesDropdown = false; break; }
            } else if (key === 'payment_type') {
              if (filterVal instanceof Set && filterVal.size > 0) {
                let rowTypes = [];
                if (typeof row.payment_type === 'string') {
                  rowTypes = row.payment_type.split(',').map(s => s.trim().replace(/^\[|\]$/g, '')).filter(Boolean);
                }
                const hasOverlap = rowTypes.some(t => filterVal.has(t));
                if (!hasOverlap) { matchesDropdown = false; break; }
              }
            }
          } else {
            if (key === 'my_company') {
              if (!checkFilterMatch(filterVal, resolveCompanyForRecord(row), key, row)) { matchesDropdown = false; break; }
            } else {
              let val = row[key];
              if (typeof resolveVirtualColumn === 'function') {
                const virtualVal = resolveVirtualColumn(moduleKey, key, row);
                if (virtualVal !== undefined) val = virtualVal;
              }
              val = resolveLookupValue(moduleKey, key, val) || 'N/A';
              if (!checkFilterMatch(filterVal, val, key, row)) { matchesDropdown = false; break; }
            }
          }
        }
      }
      if (!matchesDropdown) continue;

      filteredData.push(row);
    }
  }

  // --- ADDED --- Group Opportunity policies in Table View
  if (moduleKey === 'policy') {
    const opps = [];
    const others = [];
    filteredData.forEach(r => {
      if ((r.policy_name || '').toUpperCase().startsWith('OPPORTUNITY') && String(r.policy_id) !== 'VIRTUAL_OPPORTUNITY') {
        opps.push(r);
      } else {
        others.push(r);
      }
    });
    if (opps.length > 0) {
      const masterOpp = {
        policy_id: 'VIRTUAL_OPPORTUNITY',
        policy_name: 'Opportunity',
        description: 'Group of all Opportunity policies (' + opps.length + ' records)',
        policy_type: opps[0].policy_type || 'OPPORTUNITY',
        policy_lead: '',
        sr_owner: '',
        _is_virtual: true
      };
      filteredData = [...others, masterOpp];
    }
  }
  // -------------

  // Sort filtered data if sort_by is set
  const sortBy = moduleStates[moduleKey]?.sort_by;
  const sortDir = (moduleStates[moduleKey]?.sort_dir || 'DESC').toUpperCase();
  if (sortBy && Array.isArray(filteredData) && filteredData.length > 0) {
    filteredData = [...filteredData].sort((a, b) => {
      if (a._is_virtual) return -1;
      if (b._is_virtual) return 1;

      let valA = a[sortBy];
      let valB = b[sortBy];
      if (typeof resolveVirtualColumn === 'function') {
        const vA = resolveVirtualColumn(moduleKey, sortBy, a);
        const vB = resolveVirtualColumn(moduleKey, sortBy, b);
        if (vA !== undefined) valA = vA;
        if (vB !== undefined) valB = vB;
      }
      valA = resolveLookupValue(moduleKey, sortBy, valA);
      valB = resolveLookupValue(moduleKey, sortBy, valB);

      if (valA === null || valA === undefined) valA = '';
      if (valB === null || valB === undefined) valB = '';

      const cleanA = typeof valA === 'string' ? valA.replace(/,/g, '').trim() : valA;
      const cleanB = typeof valB === 'string' ? valB.replace(/,/g, '').trim() : valB;
      const numA = Number(cleanA);
      const numB = Number(cleanB);
      let cmp = 0;
      if (cleanA !== '' && cleanB !== '' && !isNaN(numA) && !isNaN(numB)) {
        cmp = numA - numB;
      } else {
        const dateA = Date.parse(valA);
        const dateB = Date.parse(valB);
        if (!isNaN(dateA) && !isNaN(dateB) && typeof valA === 'string' && valA.includes('-') && typeof valB === 'string' && valB.includes('-')) {
          cmp = dateA - dateB;
        } else {
          cmp = String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' });
        }
      }
      return sortDir === 'ASC' ? cmp : -cmp;
    });
  }

  // If the dataset is fully loaded (Global Fetch), use local pagination
  // We disabled global fetch for 'employee', 'employee_active', 'payment', 'request' because they now use Server-Side Filtering
  const isGlobalFetch = !serverFilteredModules.includes(moduleKey);

  // 2. Client-Side Pagination & Rendering
  // Force limit to 50 for UI rendering if it's a global fetch, otherwise use backend limit
  const limit = isGlobalFetch ? 50 : (currentTableLimit || 50);
  let page = moduleStates[moduleKey].page || 1;

  let paginatedData = filteredData;
  let totalPages = 1;
  let renderPage = page;

  if (isGlobalFetch) {
    totalPages = Math.ceil(filteredData.length / limit) || 1;
    renderPage = page > totalPages ? totalPages : page;
    paginatedData = filteredData.slice((renderPage - 1) * limit, renderPage * limit);
  }

  tbody.innerHTML = buildTableRows(moduleKey, paginatedData);
  requestAnimationFrame(() => {
    if (typeof initStickyOffsets === 'function') initStickyOffsets(moduleKey);
  });
  setTimeout(() => {
    if (typeof initStickyOffsets === 'function') initStickyOffsets(moduleKey);
  }, 60);

  if (countEl) countEl.textContent = `${currentTableTotal || filteredData.length} ${t('table.records', 'records')}`;

  const pagInfoEl = document.querySelector(`#view-${moduleKey} .pagination-info`);
  const pagControlsEl = document.querySelector(`#view-${moduleKey} .pagination-controls`);

  if (isGlobalFetch) {
    const startRecord = filteredData.length > 0 ? (renderPage - 1) * limit + 1 : 0;
    const endRecord = Math.min(renderPage * limit, filteredData.length);

    if (pagInfoEl) {
      if (filteredData.length !== currentData.length) {
        pagInfoEl.innerHTML = `Filtered <strong>${filteredData.length}</strong> of <strong>${currentData.length}</strong> records (Showing <strong>${startRecord}-${endRecord}</strong>)`;
      } else {
        pagInfoEl.innerHTML = `Showing <strong style="color: #111827;">${startRecord}-${endRecord}</strong> of <strong style="color: #111827;">${filteredData.length}</strong> records`;
      }
      pagInfoEl.style.fontSize = '12px';
      pagInfoEl.style.fontWeight = '500';
      pagInfoEl.style.color = '#6B7280';
      pagInfoEl.style.fontFamily = "'Inter', sans-serif";
    }

    if (pagControlsEl) {
      if (totalPages > 1) {
        const pageButtonsHTML = Array.from({ length: totalPages }).map((_, i) => {
          const pageNum = i + 1;
          const isActive = pageNum === renderPage;
          if (totalPages > 5 && pageNum !== 1 && pageNum !== totalPages && Math.abs(pageNum - renderPage) > 1) {
            if (pageNum === 2 || pageNum === totalPages - 1) {
              return `<span style="color: #9CA3AF; padding: 0 4px;">...</span>`;
            }
            return '';
          }
          return `
               <button class="btn" onclick="changePage('${moduleKey}', ${pageNum})" style="height: 36px !important; width: 36px !important; padding: 0 !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; font-size: 13px !important; border: 1px solid ${isActive ? '#FF6A00' : '#E5E7EB'} !important; border-radius: 6px !important; background: ${isActive ? '#FFF1E8' : '#FFFFFF'} !important; color: ${isActive ? '#FF6A00' : '#374151'} !important; font-weight: ${isActive ? '600' : '500'} !important; cursor: pointer; transition: all 0.2s ease;">${pageNum}</button>
             `;
        }).join('');

        pagControlsEl.innerHTML = `
             <button class="btn" onclick="changePage('${moduleKey}', ${renderPage - 1})" ${renderPage <= 1 ? 'disabled' : ''} style="height: 36px !important; padding: 6px 12px !important; font-size: 13px !important; border: 1px solid #E5E7EB !important; border-radius: 6px !important; background: #FFFFFF !important; color: #374151 !important; font-weight: 500 !important; cursor: pointer; transition: all 0.2s ease;">${t('table.prev', 'Prev')}</button>
             ${pageButtonsHTML}
             <button class="btn" onclick="changePage('${moduleKey}', ${renderPage + 1})" ${renderPage >= totalPages ? 'disabled' : ''} style="height: 36px !important; padding: 6px 12px !important; font-size: 13px !important; border: 1px solid #E5E7EB !important; border-radius: 6px !important; background: #FFFFFF !important; color: #374151 !important; font-weight: 500 !important; cursor: pointer; transition: all 0.2s ease;">${t('table.next', 'Next')}</button>
           `;
        pagControlsEl.style.display = 'flex';
        pagControlsEl.style.alignItems = 'center';
        pagControlsEl.style.height = '48px';
        pagControlsEl.style.gap = '8px';
      } else {
        pagControlsEl.style.display = 'none';
        pagControlsEl.innerHTML = '';
      }
    }
  }

  // 3. Faceted Search: Update Status Cards dynamically
  const tempSummary = currentTableSummary;
  if (isGlobalFetch) currentTableSummary = null; // force recalculation based on filteredData ONLY for client-side filtering
  const newCardsHTML = buildTableStatusCards(moduleKey, filteredData);
  if (isGlobalFetch) currentTableSummary = tempSummary;

  updateGlobalStatusCards(newCardsHTML);
  const cardsContainer = document.querySelector(`#view-${moduleKey} .dv-status-cards-outer`);
  if (cardsContainer) {
    cardsContainer.innerHTML = newCardsHTML;
  }

  // 4. Faceted Search: Update Dropdown Filter counts dynamically
  const isClientSide = !serverFilteredModules.includes(moduleKey);
  if (isGlobalFetch || isClientSide) {
    const filterInputs = document.querySelectorAll(`#view-${moduleKey} .dv-filter-option input`);
    if (filterInputs.length > 0) {
      const baseCountSource = (isClientSide && originalClientData[moduleKey]) ? originalClientData[moduleKey] : currentData;
      const countsByFilterKey = {};
      const filterKeys = [...new Set(Array.from(filterInputs).map(input => input.dataset.filterKey).filter(Boolean))];

      filterKeys.forEach(filterKey => {
        const counts = {};
        baseCountSource.forEach(row => {
          if (!rowMatchesTableFilters(moduleKey, row, { search, colFilters, dropdownFilters, excludeFilterKey: filterKey })) return;
          const val = String(getTableDropdownValue(moduleKey, row, filterKey));
          counts[val] = (counts[val] || 0) + 1;
        });
        countsByFilterKey[filterKey] = counts;
      });

      filterInputs.forEach(input => {
        const key = input.dataset.filterKey;
        const val = input.dataset.filterValue;
        const newCount = countsByFilterKey[key]?.[String(val)] || 0;
        const countEl = input.parentElement.querySelector('.dv-filter-count');
        if (countEl) countEl.textContent = formatNumber(newCount);
      });
    }
  }
}

function attachTableSearch(moduleKey) {
  // nothing extra needed, handled inline
}

// Window Bridge for Table View Subsystem
window.resolveCurrentEmployeeId = resolveCurrentEmployeeId;
window.getFilterStorageKey = getFilterStorageKey;
window.isFilterValueChecked = isFilterValueChecked;
window.getFiscalYear = getFiscalYear;
window.formatNumber = formatNumber;
window.isNumericFieldKey = isNumericFieldKey;
window.resolveCompanyForRecord = resolveCompanyForRecord;
window.getTableDropdownValue = getTableDropdownValue;
window.rowMatchesTableFilters = rowMatchesTableFilters;
window.buildTableStatusCards = buildTableStatusCards;
window.resolveFilterDisplayVal = resolveFilterDisplayVal;
window.buildDropdownFiltersHTML = buildDropdownFiltersHTML;
window.buildActionButtons = buildActionButtons;
window.renderTableView = renderTableView;
window.buildTableRows = buildTableRows;
window.renderGroupedRows = renderGroupedRows;
window.buildSingleRowHTML = buildSingleRowHTML;
window.closeRowActionDropdown = closeRowActionDropdown;
window.findRowActionRecord = findRowActionRecord;
window.ensureRowActionRecord = ensureRowActionRecord;
window.filterTable = filterTable;
window.applyAllFilters = applyAllFilters;
window.attachTableSearch = attachTableSearch;
