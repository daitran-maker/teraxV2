/**
 * CRC App - Lookup & Select Options Service
 * Extracted as part of Modularization
 */

// ============================================================
// SELECT OPTIONS CACHE
// ============================================================
async function getSelectOptions(moduleKey) {
  if (selectCache[moduleKey] && selectCache[moduleKey].isFullList) return selectCache[moduleKey];

  // Request deduplication: if already fetching this module, return the existing promise
  if (inFlightSelectRequests[moduleKey]) return inFlightSelectRequests[moduleKey];

  // Special case: fetch DB schema from our schema endpoint
  if (moduleKey === '_schemaData') {
    inFlightSelectRequests[moduleKey] = apiGet('/schema/tables').then(data => {
      selectCache[moduleKey] = data;
      delete inFlightSelectRequests[moduleKey];
      return data;
    }).catch(err => {
      delete inFlightSelectRequests[moduleKey];
      return {};
    });
    return inFlightSelectRequests[moduleKey];
  }

  if (moduleKey === 'account_currency') {
    if (selectCache[moduleKey] && selectCache[moduleKey].isFullList) return selectCache[moduleKey];

    if (inFlightSelectRequests[moduleKey]) return inFlightSelectRequests[moduleKey];

    inFlightSelectRequests[moduleKey] = apiGet('/table/account-currencies/all').then(currencies => {
      const data = currencies.map(c => ({ code: c, label: c }));
      data.isFullList = true;
      selectCache[moduleKey] = data;
      delete inFlightSelectRequests[moduleKey];
      return data;
    }).catch(err => {
      delete inFlightSelectRequests[moduleKey];
      return [];
    });
    return inFlightSelectRequests[moduleKey];
  }

  if (moduleKey === 'status_catalog') {
    if (selectCache[moduleKey] && selectCache[moduleKey].isFullList) return selectCache[moduleKey];
    if (inFlightSelectRequests[moduleKey]) return inFlightSelectRequests[moduleKey];
    inFlightSelectRequests[moduleKey] = apiGet('/table/status_catalog?limit=1000').then(res => {
      const data = res.data && Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []);
      data.isFullList = true;
      selectCache[moduleKey] = data;
      delete inFlightSelectRequests[moduleKey];
      return data;
    }).catch(err => {
      delete inFlightSelectRequests[moduleKey];
      return [];
    });
    return inFlightSelectRequests[moduleKey];
  }

  if (moduleKey === 'cms_city' || moduleKey === 'cms_province') {
    return [];
  }

  const mod = MODULES[moduleKey];
  if (!mod) return [];

  let endpointUrl = mod.endpoint;
  if (['company', 'employee', 'my_company', 'department', 'policy', 'operation_program', 'account', 'cms_currency'].includes(moduleKey)) {
    endpointUrl += (endpointUrl.includes('?') ? '&' : '?') + 'limit=10000';
  }
  // Always skip heavy faceted summary and counts when loading lookup select options!
  endpointUrl += (endpointUrl.includes('?') ? '&' : '?') + 'summary=false';

  inFlightSelectRequests[moduleKey] = apiGet(endpointUrl).then(res => {
    const data = res.data && Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []);
    data.isFullList = true;
    if (moduleKey === 'finance') {
      data.forEach(r => {
        r.finance_label = [r.finance_account_number, r.finance_account_name, r.finance_type, r.description]
          .map(s => String(s || '').trim())
          .filter(Boolean)
          .join(' • ');
      });
    }
    selectCache[moduleKey] = data;
    if (moduleKey === 'employee') {
      try {
        const map = {};
        data.forEach(e => {
          if (e.employee_id) {
            const empId = String(e.employee_id).toLowerCase().trim();
            if (e.email) map[e.email.toLowerCase().trim()] = empId;
            if (e.username) map[e.username.toLowerCase().trim()] = empId;
          }
        });
        localStorage.setItem('crc_employee_map', JSON.stringify(map));
      } catch (err) {
        console.warn('Failed to update crc_employee_map:', err);
      }
    }
    delete inFlightSelectRequests[moduleKey];
    return data;
  }).catch(err => {
    delete inFlightSelectRequests[moduleKey];
    return [];
  });

  return inFlightSelectRequests[moduleKey];
}

function getFinanceOptionLabel(row) {
  if (!row || typeof row !== 'object') return '';
  return [
    row.finance_account_number || row.account_code,
    row.finance_account_name || row.account_name,
    row.finance_type || row.account_type,
    row.description
  ].map(s => String(s || '').trim()).filter(Boolean).join(' • ');
}

function getFinanceOptionExample(row) {
  if (!row || typeof row !== 'object') return '';
  return String(row.example || '').trim();
}

let financeTooltipTimer = null;

function closeFinanceSelectDropdowns(exceptContainer) {
  document.querySelectorAll('.finance-select-container.is-open').forEach(container => {
    if (container !== exceptContainer) {
      container.classList.remove('is-open');
      const list = container.querySelector('.finance-select-list');
      if (list) list.style.display = 'none';
    }
  });
  hideFinanceOptionTooltip();
}

function hideFinanceOptionTooltip() {
  if (financeTooltipTimer) {
    clearTimeout(financeTooltipTimer);
    financeTooltipTimer = null;
  }
  const tip = document.getElementById('finance-option-tooltip');
  if (tip) tip.remove();
}

function showFinanceOptionTooltip(target, text) {
  hideFinanceOptionTooltip();
  if (!text || !target) return;
  financeTooltipTimer = setTimeout(() => {
    const tip = document.createElement('div');
    tip.id = 'finance-option-tooltip';
    tip.className = 'finance-option-tooltip';
    tip.innerHTML = `<div class="finance-option-tooltip-title">Example</div><div>${escapeHTML(text)}</div>`;
    document.body.appendChild(tip);

    const rect = target.getBoundingClientRect();
    const gap = 10;
    const viewportPadding = 12;
    const hasRightSpace = rect.right + gap + tip.offsetWidth <= window.innerWidth - viewportPadding;
    const left = hasRightSpace
      ? rect.right + window.scrollX + gap
      : Math.max(viewportPadding, rect.left + window.scrollX - tip.offsetWidth - gap);
    const top = Math.min(
      window.scrollY + window.innerHeight - tip.offsetHeight - viewportPadding,
      Math.max(window.scrollY + viewportPadding, rect.top + window.scrollY)
    );
    tip.style.top = `${top}px`;
    tip.style.left = `${left}px`;
  }, 200);
}

function selectFinanceOption(fieldKey, value, label) {
  const container = document.getElementById(`finance-select-${fieldKey}`);
  if (!container) return;
  const hidden = document.getElementById(`f-${fieldKey}`);
  const search = container.querySelector('.finance-select-search');
  const list = container.querySelector('.finance-select-list');
  if (hidden) hidden.value = value || '';
  if (search) search.value = label || '';
  if (list) list.style.display = 'none';
  container.classList.remove('is-open');
  hideFinanceOptionTooltip();
  const nativeChange = new Event('change', { bubbles: true });
  if (hidden) hidden.dispatchEvent(nativeChange);
}

function filterFinanceOptions(fieldKey) {
  const container = document.getElementById(`finance-select-${fieldKey}`);
  if (!container) return;
  const search = container.querySelector('.finance-select-search');
  const list = container.querySelector('.finance-select-list');
  if (!search || !list) return;
  const term = search.value.trim().toLowerCase();
  list.querySelectorAll('.finance-select-option').forEach(option => {
    const text = (option.dataset.search || option.textContent || '').toLowerCase();
    option.style.display = !term || text.includes(term) ? 'block' : 'none';
  });
}

function showAllFinanceOptions(fieldKey) {
  const container = document.getElementById(`finance-select-${fieldKey}`);
  if (!container) return;
  const list = container.querySelector('.finance-select-list');
  if (!list) return;
  list.querySelectorAll('.finance-select-option').forEach(option => {
    option.style.display = 'block';
  });
}

document.addEventListener('click', (event) => {
  if (!event.target.closest('.finance-select-container')) {
    closeFinanceSelectDropdowns(null);
  }
});

window.showFinanceOptionTooltip = showFinanceOptionTooltip;
window.hideFinanceOptionTooltip = hideFinanceOptionTooltip;
window.selectFinanceOption = selectFinanceOption;
window.filterFinanceOptions = filterFinanceOptions;
window.showAllFinanceOptions = showAllFinanceOptions;
window.closeFinanceSelectDropdowns = closeFinanceSelectDropdowns;

// ============================================================
// LOOKUP PARSERS
// ============================================================
async function prefetchLookups(moduleKey, dataArr = typeof currentData !== 'undefined' ? currentData : null) {
  const mod = MODULES[moduleKey];
  if (!mod) return;
  const promises = [];

  if (moduleKey === 'target_table' && dataArr && Array.isArray(dataArr)) {
    const tableGroups = {};
    dataArr.forEach(row => {
      const targetTable = row.table_name;
      if (!targetTable) return;
      const ids = Array.isArray(row.record_ids)
        ? row.record_ids
        : (typeof row.record_ids === 'string'
          ? row.record_ids.split(',').map(s => s.trim().replace(/^\[|\]$/g, '')).filter(Boolean)
          : []);
      if (ids.length === 0) return;
      if (!tableGroups[targetTable]) tableGroups[targetTable] = new Set();
      ids.forEach(id => tableGroups[targetTable].add(id));
    });

    for (const [targetTable, idSet] of Object.entries(tableGroups)) {
      const refMod = MODULES[targetTable];
      if (!refMod) continue;
      const pk = refMod.pk;
      if (!pk) continue;

      if (!selectCache[targetTable]) selectCache[targetTable] = [];
      const existingVals = new Set(selectCache[targetTable].map(x => String(x[pk]).toLowerCase()));
      const missingVals = Array.from(idSet).filter(id => !existingVals.has(String(id).toLowerCase()));

      if (missingVals.length > 0) {
        const endpoint = targetTable === 'policy' ? '/policies' : `/table/${targetTable}`;
        const p = apiGet(`${endpoint}?${pk}=${missingVals.join(',')}&limit=500`).then(res => {
          const records = res.data && Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []);
          records.forEach(r => {
            if (!selectCache[targetTable].some(cached => String(cached[pk]) === String(r[pk]))) {
              selectCache[targetTable].push(r);
            }
          });
        }).catch(e => console.error(`Prefetch target table actual records error for ${targetTable}`, e));
        promises.push(p);
      }
    }
  }

  const smallTables = ['employee', 'department', 'my_company', 'policy', 'operation_program', 'account', 'company', 'oppotunity', 'opportunity', 'status_catalog'];

  if (!selectCache['employee'] || !selectCache['employee'].isFullList) {
    promises.push(getSelectOptions('employee').catch(() => {}));
  }
  if (!selectCache['status_catalog'] || !selectCache['status_catalog'].isFullList) {
    promises.push(getSelectOptions('status_catalog').catch(() => {}));
  }

  const isTableListPrefetch = dataArr && Array.isArray(dataArr) && dataArr.length > 1;
  const allFields = isTableListPrefetch ? (mod.columns || []) : [...(mod.fields || []), ...(mod.columns || []), ...(mod.detailFields || [])];
  const uniqueFields = [];
  const seenKeys = new Set();
  for (const f of allFields) {
    if (f.key && !seenKeys.has(f.key)) {
      seenKeys.add(f.key);
      uniqueFields.push(f);
    }
  }

  if (moduleKey === 'payment' || uniqueFields.some(f => f.key === 'counter_party' || f.type === 'counter_party' || f.key === 'pay_to')) {
    if (!selectCache['company'] || !selectCache['company'].isFullList) {
      promises.push(getSelectOptions('company').catch(() => {}));
    }
    if (!selectCache['my_company'] || !selectCache['my_company'].isFullList) {
      promises.push(getSelectOptions('my_company').catch(() => {}));
    }
  }

  for (const f of uniqueFields) {
    if (f.optionsFrom) {
      // Bảng quốc gia, tỉnh thành, tiền tệ được lưu trực tiếp dạng chuỗi trong DB, chỉ cần khi mở Form Add/Edit!
      if (['cms_country', 'cms_province', 'cms_city', 'cms_currency'].includes(f.optionsFrom)) {
        continue;
      }
      if (smallTables.includes(f.optionsFrom)) {
        if (!selectCache[f.optionsFrom] || !selectCache[f.optionsFrom].isFullList) {
          promises.push(getSelectOptions(f.optionsFrom).catch(e => console.error("Prefetch error", e)));
        }
      } else {
        // Large paginated table (like request). Fetch missing records referenced in dataArr!
        if (dataArr && Array.isArray(dataArr)) {
          if (f.optionsFrom === 'request') {
            // Request displayName needs policy, ensure it's fetched
            if (!selectCache['policy']) promises.push(getSelectOptions('policy').catch(e => console.error("Prefetch policy error", e)));
          }
          if (!selectCache[f.optionsFrom]) selectCache[f.optionsFrom] = [];
          const refMod = MODULES[f.optionsFrom];
          const pk = refMod ? refMod.pk : null;
          if (pk) {
            const missingVals = new Set();
            const existingVals = new Set();
            selectCache[f.optionsFrom].forEach(x => {
              if (x[pk] !== undefined && x[pk] !== null) existingVals.add(String(x[pk]));
            });
            dataArr.forEach(r => {
              const val = r[f.key];
              if (val !== undefined && val !== null && !existingVals.has(String(val))) {
                missingVals.add(val);
              }
            });
            if (missingVals.size > 0) {
              const valArray = Array.from(missingVals);
              // Chunk by 50 to avoid URI too long and large IN clauses
              if (!window._prefetchInflight) window._prefetchInflight = {};
              for (let i = 0; i < valArray.length; i += 50) {
                const chunk = valArray.slice(i, i + 50).sort();
                const cacheKey = `${f.optionsFrom}::${chunk.join(',')}`;
                if (window._prefetchInflight[cacheKey]) {
                  promises.push(window._prefetchInflight[cacheKey]);
                  continue;
                }
                // We use the base table GET endpoint with comma-separated IDs
                const endpointPath = `${refMod.endpoint}?${pk}=${chunk.join(',')}&limit=100`;
                const p = apiGet(endpointPath).then(res => {
                  const data = res.data || (Array.isArray(res) ? res : []);
                  data.forEach(d => selectCache[f.optionsFrom].push(d));
                  delete window._prefetchInflight[cacheKey];
                }).catch(e => { console.error("Prefetch missing bulk error", e); delete window._prefetchInflight[cacheKey]; });
                window._prefetchInflight[cacheKey] = p;
                promises.push(p);
              }
            }
          }
        }
      }
    }
  }
  await Promise.all(promises);
}

function formatEmployeeLabel(emp) {
  if (!emp) return '';
  const subInfo = emp.email || emp.username || '';
  const isInactive = String(emp.status || '').toLowerCase() === 'inactive';
  if (isInactive) {
    return subInfo || emp.full_name || '';
  }
  return subInfo ? `${emp.full_name} (${subInfo})` : emp.full_name;
}

function resolveEmployeeLabel(val) {
  if (!val) return '';
  if (Array.isArray(val)) {
    return val.map(e => resolveEmployeeLabel(e)).filter(Boolean).join(', ');
  }
  if (typeof val === 'object') {
    return typeof formatEmployeeLabel === 'function' ? formatEmployeeLabel(val) : (val.full_name || val.email || '');
  }
  if (typeof val === 'string' && val.includes(',')) {
    return val.split(',').map(e => resolveEmployeeLabel(e.trim().replace(/^\[|\]$/g, ''))).filter(Boolean).join(', ');
  }
  let str = String(val).trim();
  if (str.startsWith('[') && str.endsWith(']')) {
    str = str.slice(1, -1).trim();
  }
  if (!str) return '';
  if (selectCache['employee']) {
    if (!selectCache['employee_index_by_email'] || selectCache['employee_index_by_email']._lastLength !== selectCache['employee'].length) {
      const m = new Map();
      selectCache['employee'].forEach(x => { if (x.email) m.set(String(x.email).toLowerCase().trim(), x); });
      m._lastLength = selectCache['employee'].length;
      selectCache['employee_index_by_email'] = m;
    }
    if (!selectCache['employee_index_by_id'] || selectCache['employee_index_by_id']._lastLength !== selectCache['employee'].length) {
      const m = new Map();
      selectCache['employee'].forEach(x => { if (x.employee_id) m.set(String(x.employee_id).toLowerCase().trim(), x); });
      m._lastLength = selectCache['employee'].length;
      selectCache['employee_index_by_id'] = m;
    }
    if (!selectCache['employee_index_by_username'] || selectCache['employee_index_by_username']._lastLength !== selectCache['employee'].length) {
      const m = new Map();
      selectCache['employee'].forEach(x => { if (x.username) m.set(String(x.username).toLowerCase().trim(), x); });
      m._lastLength = selectCache['employee'].length;
      selectCache['employee_index_by_username'] = m;
    }
    const valLc = str.toLowerCase();
    const e = selectCache['employee_index_by_id'].get(valLc)
      || selectCache['employee_index_by_email'].get(valLc)
      || selectCache['employee_index_by_username'].get(valLc);
    if (e) {
      return typeof formatEmployeeLabel === 'function' ? formatEmployeeLabel(e) : (e.full_name || e.email || str);
    }
  }
  return str;
}
window.resolveEmployeeLabel = resolveEmployeeLabel;

function resolveEmployeeName(val) {
  if (!val) return '';
  if (Array.isArray(val)) {
    return val.map(e => resolveEmployeeName(e)).filter(Boolean).join(', ');
  }
  if (typeof val === 'object' && val !== null) {
    return val.full_name || val.email || '';
  }
  if (typeof val === 'string' && val.includes(',')) {
    return val.split(',').map(e => resolveEmployeeName(e.trim().replace(/^\[|\]$/g, ''))).filter(Boolean).join(', ');
  }
  let str = String(val).trim();
  if (str.startsWith('[') && str.endsWith(']')) {
    str = str.slice(1, -1).trim();
  }
  if (!str) return '';
  if (selectCache['employee']) {
    if (!selectCache['employee_index_by_email'] || selectCache['employee_index_by_email']._lastLength !== selectCache['employee'].length) {
      const m = new Map();
      selectCache['employee'].forEach(x => { if (x.email) m.set(String(x.email).toLowerCase().trim(), x); });
      m._lastLength = selectCache['employee'].length;
      selectCache['employee_index_by_email'] = m;
    }
    if (!selectCache['employee_index_by_id'] || selectCache['employee_index_by_id']._lastLength !== selectCache['employee'].length) {
      const m = new Map();
      selectCache['employee'].forEach(x => { if (x.employee_id) m.set(String(x.employee_id).toLowerCase().trim(), x); });
      m._lastLength = selectCache['employee'].length;
      selectCache['employee_index_by_id'] = m;
    }
    if (!selectCache['employee_index_by_username'] || selectCache['employee_index_by_username']._lastLength !== selectCache['employee'].length) {
      const m = new Map();
      selectCache['employee'].forEach(x => { if (x.username) m.set(String(x.username).toLowerCase().trim(), x); });
      m._lastLength = selectCache['employee'].length;
      selectCache['employee_index_by_username'] = m;
    }
    const valLc = str.toLowerCase();
    const e = selectCache['employee_index_by_id'].get(valLc)
      || selectCache['employee_index_by_email'].get(valLc)
      || selectCache['employee_index_by_username'].get(valLc);
    if (e) {
      return e.full_name || e.email || str;
    }
  }
  return str;
}
window.resolveEmployeeName = resolveEmployeeName;

window.formatRequestLabel = function (r) {
  if (!r) return '';
  let pName = r.request_type || '';
  try {
    if (typeof selectCache !== 'undefined' && selectCache['policy']) {
      const p = selectCache['policy'].find(x => String(x.policy_id) === String(r.request_type) || x.policy_name === r.request_type);
      if (p) pName = p.policy_name || r.request_type;
    }
  } catch (e) { }
  const desc = r.description || '';
  const labelParts = [pName, desc].filter(x => x !== null && x !== undefined && String(x).trim() !== '');
  if (labelParts.length > 0) {
    return labelParts.join(' | ');
  }
  return r.request_label || (window.getFormattedRequestCode ? window.getFormattedRequestCode(r) : r.request_id) || '';
};

window.formatCompanyLabel = function (r) {
  if (!r) return '';
  const name = r.company_name || '';
  const shortName = r.company_shortname || '';
  const fullName = r.company_fullname || '';
  return [name, shortName, fullName].filter(Boolean).join(' | ');
};

window.formatOpportunityLabel = function (r) {
  if (!r) return '';
  return r.project_label || [r.project_id, r.project_name].filter(Boolean).join(' - ') || r.project_name || String(r.project_id || '');
};

window.formatPaymentLabel = function (r) {
  if (!r) return '';
  let typeStr = '';
  const rawType = r.payment_type;
  if (typeof t_val === 'function' && rawType !== undefined && rawType !== null && rawType !== '') {
    typeStr = t_val(rawType);
  }
  if (!typeStr || typeStr === String(rawType)) {
    const rawNum = Number(rawType);
    if (rawNum === 60 || String(rawType).toLowerCase() === 'incoming') {
      typeStr = typeof t === 'function' ? t('status.incoming', 'Incoming') : 'Incoming';
    } else if (rawNum === 61 || String(rawType).toLowerCase() === 'outgoing') {
      typeStr = typeof t === 'function' ? t('status.outgoing', 'Outgoing') : 'Outgoing';
    } else if (typeof selectCache !== 'undefined' && selectCache['status_catalog']) {
      const match = selectCache['status_catalog'].find(s => s.id === rawNum || String(s.id) === String(rawType));
      if (match) {
        typeStr = match.display_name_en || match.display_name_vi || match.status_key || String(rawType);
      }
    }
  }
  if (!typeStr) typeStr = 'Payment';
  const desc = r.payment_description || r.description || '';
  return desc ? `${typeStr} | ${desc}` : typeStr;
};

function formatProcessLabel(r) {
  if (!r) return '';
  if (typeof r === 'string' || typeof r === 'number') {
    if (typeof selectCache !== 'undefined' && selectCache['policy']) {
      const match = selectCache['policy'].find(x => String(x.policy_id) === String(r) || x.policy_name === r);
      if (match) r = match;
      else return String(r);
    } else {
      return String(r);
    }
  }
  const pid = r.policy_id || r.ticket_type_id || r.id || '';
  let name = r.policy_name || r.ticket_name || r.name || r.description || '';
  if (typeof name === 'string' && name.toUpperCase().startsWith('OPPORTUNITY')) {
    name = 'Opportunity';
  }
  if (!name) {
    const contractTypeMap = { '69': 'Selling', '70': 'Buying', '71': 'Internal' };
    name = contractTypeMap[pid] || pid;
  }
  if (pid && name && String(pid) !== String(name)) {
    return `${pid} | ${name}`;
  }
  return name || String(pid) || '';
}
window.formatProcessLabel = formatProcessLabel;

window.resolveSelectDisplayVal = function (optionsFrom, val) {
  if (!val) return '';
  if (optionsFrom && selectCache[optionsFrom]) {
    const pk = MODULES[optionsFrom] ? MODULES[optionsFrom].pk : 'id';
    const match = selectCache[optionsFrom].find(x => String(x[pk]) === String(val));
    if (match) {
      if (optionsFrom === 'request') {
        return window.formatRequestLabel(match);
      }
      if (optionsFrom === 'my_company' || optionsFrom === 'company') {
        return window.formatCompanyLabel(match);
      }
      if (optionsFrom === 'policy' || optionsFrom === 'helpdesk_policy') {
        return window.formatProcessLabel(match);
      }
      if (optionsFrom === 'payment') {
        return window.formatPaymentLabel(match);
      }
      if (optionsFrom === 'employee') {
        return typeof formatEmployeeLabel === 'function' ? formatEmployeeLabel(match) : val;
      }
      if (MODULES[optionsFrom].displayName) {
        return MODULES[optionsFrom].displayName(match);
      }
    }
  }
  return val;
};

const lookupFieldDefCache = new Map();

function getSelectLookupMap(cacheKey, list, keyExtractor) {
  if (!selectCache[cacheKey] || selectCache[cacheKey]._lastLength !== list.length) {
    const m = new Map();
    list.forEach(item => {
      keyExtractor(item, (k) => {
        if (k !== null && k !== undefined && k !== '') {
          m.set(String(k).trim().toLowerCase(), item);
        }
      });
    });
    m._lastLength = list.length;
    selectCache[cacheKey] = m;
  }
  return selectCache[cacheKey];
}

function resolveLookupValue(moduleKey, fieldKey, val) {
  if (val === null || val === undefined || val === '') return val;

  const mod = typeof MODULES !== 'undefined' ? MODULES[moduleKey] : null;
  if (mod && mod.pk === fieldKey) return val;

  // Handle arrays or comma-separated lists of values (like sr_owner or elements)
  if (Array.isArray(val)) {
    return val.map(v => resolveLookupValue(moduleKey, fieldKey, v)).filter(Boolean).join(', ');
  }
  if (typeof val === 'string' && val.includes(',') && fieldKey !== 'view_name' && fieldKey !== 'changes' && fieldKey !== 'counter_party') {
    return val.split(',').map(v => resolveLookupValue(moduleKey, fieldKey, v.trim().replace(/^\[|\]$/g, ''))).filter(Boolean).join(', ');
  }
  if (typeof val === 'string' && val.startsWith('[') && val.endsWith(']')) {
    val = val.slice(1, -1).trim();
    if (!val) return '';
  }

  if (fieldKey === 'elements') {
    return typeof t_val === 'function' ? t_val(val) : val;
  }

  // This is a direct value on My Company / Partner Company, not a reference to another company.
  if ((moduleKey === 'my_company' || moduleKey === 'company') && fieldKey === 'company_shortname') return val;
  if (fieldKey === 'country') return val;

  if (fieldKey === 'counter_party' || fieldKey === 'pay_to' || fieldKey === 'pay_from') {
    if (typeof val === 'string' && (val.startsWith('Employee | ') || val.startsWith('Company | '))) {
      return val;
    }
    if (typeof val === 'string' && (val.trim() === 'Counter party (Company or Individual)' || val.trim() === '—')) {
      return '';
    }
    let parsed = null;
    try {
      let cleanVal = val;
      if (typeof val === 'string') {
        cleanVal = val.replace(/"type":"([^"]+)"\s*"id":/g, '"type":"$1","id":')
          .replace(/"id":"([^"]+)"\s*"type":/g, '"id":"$1","type":');
      }
      parsed = typeof cleanVal === 'string' ? JSON.parse(cleanVal) : cleanVal;
    } catch (e) { }

    if (parsed && typeof parsed === 'object' && parsed.type && parsed.id) {
      const typeVal = String(parsed.type).toLowerCase();
      const idVal = String(parsed.id).trim();

      if (!idVal) return '';

      if (typeVal === 'employee') {
        if (selectCache['employee'] && selectCache['employee'].length > 0) {
          const empMap = getSelectLookupMap('_emp_lookup_all', selectCache['employee'], (x, add) => {
            add(x.employee_id);
            add(x.email);
            add(x.username);
            add(x.full_name);
          });
          const match = empMap.get(idVal.toLowerCase());
          if (match) {
            return `Employee | ${match.full_name || match.email || idVal}`;
          }
        }
        return `Employee | ${idVal}`;
      } else if (typeVal === 'company' || typeVal === 'partner') {
        let match = null;
        if (selectCache['company'] && selectCache['company'].length > 0) {
          const compMap = getSelectLookupMap('_comp_lookup_all', selectCache['company'], (x, add) => {
            add(x.company_id);
            add(x.company_shortname);
            add(x.company_fullname);
            add(x.company_name);
          });
          match = compMap.get(idVal.toLowerCase());
        }
        if (!match && selectCache['my_company'] && selectCache['my_company'].length > 0) {
          const myCompMap = getSelectLookupMap('_my_comp_lookup_all', selectCache['my_company'], (x, add) => {
            add(x.my_company_id);
            add(x.company_shortname);
            add(x.company_fullname);
            add(x.company_name);
          });
          match = myCompMap.get(idVal.toLowerCase());
        }
        if (match) {
          const compLabel = match.company_label || [match.company_shortname, match.company_fullname].filter(Boolean).join(' | ') || match.company_name || idVal;
          return `Company | ${compLabel}`;
        }
        return `Company | ${idVal}`;
      }
    }

    // If not a valid company or employee structure, clear it
    return '';
  }

  if (fieldKey === 'finance_mappings') {
    let mappings = [];
    try {
      mappings = typeof val === 'string' ? JSON.parse(val) : val;
    } catch (e) { }
    if (!Array.isArray(mappings)) return '';

    const debits = [];
    const credits = [];
    const finList = selectCache['finance'] || [];
    const finMap = finList.length > 0 ? getSelectLookupMap('_fin_lookup_fcid', finList, (x, add) => {
      add(x.fcid);
      add(x.finance_account_number);
    }) : null;

    mappings.forEach(m => {
      let accNum = '';
      if (finMap && m.finance_category_id) {
        const acc = finMap.get(String(m.finance_category_id).trim().toLowerCase());
        if (acc) accNum = acc.finance_account_number;
      }
      if (!accNum) accNum = m.finance_category_id || '';

      const label = `${accNum} (${m.value === 'WO VAT' ? 'WO VAT' : m.value === 'VAT' ? 'VAT' : 'Total'})`;
      if (m.nature === 'Debit') {
        debits.push(label);
      } else {
        credits.push(label);
      }
    });

    return `Dr: ${debits.join(', ')} | Cr: ${credits.join(', ')}`;
  }

  if (fieldKey === 'currency' || fieldKey === 'base_currency') {
    if (String(val) === '1') return 'VND';
    if (String(val) === '2') return 'USD';
    if (String(val) === '3') return 'EUR';
    if (String(val) === '4') return 'MMK';
    if (String(val) === '5') return 'SGD';
    if (String(val) === '6') return 'THB';
  }

  if (fieldKey === 'payment_type') {
    const rawNum = Number(val);
    if (rawNum === 60 || String(val).toLowerCase() === 'incoming') {
      return typeof t === 'function' ? t('status.incoming', 'Incoming') : 'Incoming';
    }
    if (rawNum === 61 || String(val).toLowerCase() === 'outgoing') {
      return typeof t === 'function' ? t('status.outgoing', 'Outgoing') : 'Outgoing';
    }
    if (typeof selectCache !== 'undefined' && selectCache['status_catalog']) {
      const match = selectCache['status_catalog'].find(s => s.id === rawNum || String(s.id) === String(val));
      if (match) {
        return match.display_name_en || match.display_name_vi || match.status_key || String(val);
      }
    }
  }

  const cacheKey = `${moduleKey}_${fieldKey}`;
  let topFieldDef = lookupFieldDefCache.get(cacheKey);
  if (topFieldDef === undefined) {
    const topMod = MODULES[moduleKey];
    topFieldDef = topMod ? ((topMod.fields && topMod.fields.find(f => f.key === fieldKey)) || (topMod.columns && topMod.columns.find(c => c.key === fieldKey)) || (topMod.detailFields && topMod.detailFields.find(f => f.key === fieldKey))) || null : null;
    lookupFieldDefCache.set(cacheKey, topFieldDef);
  }
  const topOptionsFrom = topFieldDef ? topFieldDef.optionsFrom : null;

  // --- OVERRIDE FOR EMPLOYEE ---
  const isEmployeeField = topOptionsFrom === 'employee' ||
    ['policy_lead', 'sr_owner', 'tier1_approval', 'tier2_approval', 'tier3_approval', 'tier_1_approval', 'tier_2_approval', 'tier_3_approval', 'requester', 'sr_creater', 'created_by', 'updated_by', 'comment_by', 'employee', 'sr_coordinator', 'transaction_managed_by', 'finance_control', 'current_owner', 'direct_manager', 'head_manager', 'manager_email', 'tag', 'exceptions', 'sale_lead', 'handler_id', 'pic', 'owner_id', 'lead_id', 'responsible_employee', 'service_owner', 'contract_owner'].includes(fieldKey) ||
    fieldKey.includes('employee');
  if (isEmployeeField) {
    if (selectCache['employee']) {
      const isRequestModule = ['request', 'my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(moduleKey);
      if (isRequestModule) {
        const empName = resolveEmployeeName(val);
        if (empName) return empName;
      }
      const empLabel = resolveEmployeeLabel(val);
      if (empLabel) return empLabel;
    }
  }

  // --- OVERRIDE FOR REQUEST ---
  const isRequestField = ['request', 'request_id', 'payment_request', 'invoice_request', 'mtr_request', 'service_request', 'asset_request'].includes(fieldKey) || (topOptionsFrom === 'request');
  if (isRequestField) {
    if (selectCache['request']) {
      if (!selectCache['request_index_by_id'] || selectCache['request_index_by_id']._lastLength !== selectCache['request'].length) {
        const m = new Map();
        selectCache['request'].forEach(x => {
          if (x.request_id) m.set(String(x.request_id).trim().toLowerCase(), x);
        });
        m._lastLength = selectCache['request'].length;
        selectCache['request_index_by_id'] = m;
      }
      const match = selectCache['request_index_by_id'].get(String(val).trim().toLowerCase());
      if (match) {
        return window.formatRequestLabel(match);
      }
    }
  }

  // --- OVERRIDE FOR PAYMENT ---
  const isPaymentField = (['payment', 'payment_id'].includes(fieldKey) || topOptionsFrom === 'payment') && fieldKey !== 'payment_request';
  if (isPaymentField) {
    if (selectCache['payment']) {
      const match = selectCache['payment'].find(x => String(x.payment_id) === String(val));
      if (match) {
        return window.formatPaymentLabel(match);
      }
    }
  }

  // --- OVERRIDE FOR COMPANY/SUPPLIER & COUNTER PARTY ---
  const isCompanyField = ['company_id', 'my_company', 'company_entity', 'company_shortname', 'vendor', 'customer', 'partner', 'company'].includes(fieldKey) || (topOptionsFrom === 'my_company' || topOptionsFrom === 'company');
  if (isCompanyField) {
    let lookupVal = val;
    let typeVal = 'company';
    if (typeof val === 'string' && val.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(val);
        if (parsed && parsed.id) {
          lookupVal = parsed.id;
          typeVal = parsed.type || 'company';
        }
      } catch (e) { }
    }

    const cleanLookup = String(lookupVal).trim().toLowerCase();

    if (typeVal === 'employee') {
      if (selectCache['employee']) {
        if (!selectCache['employee_index_by_id'] || selectCache['employee_index_by_id']._lastLength !== selectCache['employee'].length) {
          const m = new Map();
          selectCache['employee'].forEach(x => {
            if (x.employee_id) m.set(String(x.employee_id).toLowerCase(), x);
          });
          m._lastLength = selectCache['employee'].length;
          selectCache['employee_index_by_id'] = m;
        }
        const match = selectCache['employee_index_by_id'].get(cleanLookup);
        if (match) return match.full_name || match.email;
      }
    } else {
      if (selectCache['my_company']) {
        if (!selectCache['my_company_index_shortname'] || selectCache['my_company_index_shortname']._lastLength !== selectCache['my_company'].length) {
          const m = new Map();
          selectCache['my_company'].forEach(x => {
            if (x.my_company_id) m.set(String(x.my_company_id).trim().toLowerCase(), x);
            if (x.company_shortname) m.set(String(x.company_shortname).trim().toLowerCase(), x);
          });
          m._lastLength = selectCache['my_company'].length;
          selectCache['my_company_index_shortname'] = m;
        }
        const match = selectCache['my_company_index_shortname'].get(cleanLookup);
        if (match) {
          return window.formatCompanyLabel(match);
        }
      }
      if (selectCache['company']) {
        if (!selectCache['company_index_shortname'] || selectCache['company_index_shortname']._lastLength !== selectCache['company'].length) {
          const m = new Map();
          selectCache['company'].forEach(x => {
            if (x.company_id) m.set(String(x.company_id).trim().toLowerCase(), x);
            if (x.company_shortname) m.set(String(x.company_shortname).trim().toLowerCase(), x);
          });
          m._lastLength = selectCache['company'].length;
          selectCache['company_index_shortname'] = m;
        }
        const match = selectCache['company_index_shortname'].get(cleanLookup);
        if (match) return window.formatCompanyLabel(match);
      }
    }
  }

  // --- OVERRIDE FOR PROCESS (POLICY) ---
  const isProcessField = ['request_type', 'policy_id'].includes(fieldKey) || (topOptionsFrom === 'policy' || topOptionsFrom === 'helpdesk_policy');
  if (isProcessField) {
    if (selectCache['policy']) {
      if (!selectCache['policy_index_id'] || selectCache['policy_index_id']._lastLength !== selectCache['policy'].length) {
        const m = new Map();
        selectCache['policy'].forEach(x => {
          if (x.policy_id) m.set(String(x.policy_id).trim().toLowerCase(), x);
        });
        m._lastLength = selectCache['policy'].length;
        selectCache['policy_index_id'] = m;
      }
      const match = selectCache['policy_index_id'].get(String(val).trim().toLowerCase());
      if (match) {
        return window.formatProcessLabel(match);
      }
    }
    if (selectCache['helpdesk_policy']) {
      if (!selectCache['helpdesk_policy_index_id'] || selectCache['helpdesk_policy_index_id']._lastLength !== selectCache['helpdesk_policy'].length) {
        const m = new Map();
        selectCache['helpdesk_policy'].forEach(x => {
          if (x.policy_id) m.set(String(x.policy_id).trim().toLowerCase(), x);
        });
        m._lastLength = selectCache['helpdesk_policy'].length;
        selectCache['helpdesk_policy_index_id'] = m;
      }
      const match = selectCache['helpdesk_policy_index_id'].get(String(val).trim().toLowerCase());
      if (match) {
        return window.formatProcessLabel(match);
      }
    }
  }

  // --- OVERRIDE FOR PROJECT / OPPORTUNITY ---
  const isOppField = ['project', 'opportunity', 'oppotunity', 'opportunity_id', 'project_id'].includes(fieldKey) || (topOptionsFrom === 'oppotunity' || topOptionsFrom === 'opportunity');
  if (isOppField) {
    const oppCache = selectCache['oppotunity'] || selectCache['opportunity'];
    if (oppCache) {
      const match = oppCache.find(x => String(x.project_id).trim().toLowerCase() === String(val).trim().toLowerCase() || String(x.project_name).trim().toLowerCase() === String(val).trim().toLowerCase());
      if (match) {
        if (typeof window.formatOpportunityLabel === 'function') return window.formatOpportunityLabel(match);
        if (MODULES.oppotunity && MODULES.oppotunity.displayName) return MODULES.oppotunity.displayName(match);
        return match.project_label || match.project_name || val;
      }
    }
  }

  if (['company_id', 'my_company', 'company_entity'].includes(fieldKey)) {
    if (selectCache['my_company']) {
      if (!selectCache['my_company_index_id'] || selectCache['my_company_index_id']._lastLength !== selectCache['my_company'].length) {
        const idMap = new Map();
        selectCache['my_company'].forEach(x => {
          idMap.set(String(x.my_company_id), x);
          idMap.set(String(x.company_shortname), x);
        });
        idMap._lastLength = selectCache['my_company'].length;
        selectCache['my_company_index_id'] = idMap;
      }
      const match = selectCache['my_company_index_id'].get(String(val));
      if (match) return match.company_shortname || match.company_fullname || val;
    }
  }

  if (fieldKey === 'department_id') {
    if (selectCache['department']) {
      if (!selectCache['department_index_id'] || selectCache['department_index_id']._lastLength !== selectCache['department'].length) {
        const idMap = new Map();
        selectCache['department'].forEach(x => {
          if (x.department_id) idMap.set(String(x.department_id), x);
          if (x.department_name) idMap.set(String(x.department_name), x);
          if (x.department_label) idMap.set(String(x.department_label), x);
        });
        idMap._lastLength = selectCache['department'].length;
        selectCache['department_index_id'] = idMap;
      }
      const match = selectCache['department_index_id'].get(String(val));
      if (match) return match.department_label || match.department_name || val;
    }
  }

  if (fieldKey === 'tier1_approval' && typeof val === 'string' && val.trim().toLowerCase() === 'direct manager') {
    return 'Direct Manager';
  }

  // Handle arrays or string representations of arrays (e.g., [123, 456])
  if (typeof val === 'string' && val.startsWith('[') && val.endsWith(']')) {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) {
        return parsed.map(v => resolveLookupValue(moduleKey, fieldKey, v)).filter(Boolean).join(', ');
      }
    } catch (e) {
      // Fallback if not valid JSON
    }
    val = val.slice(1, -1);
  }

  if (fieldKey === 'roles') {
    if (typeof val === 'string') {
      return val.split(',')
        .map(v => v.trim().replace(/^\[|\]$/g, ''))
        .filter(Boolean)
        .join(', ');
    }
    return val;
  }

  if (!mod) return val;

  // Search in both fields and columns for the definition
  let fieldDef = (mod.fields && mod.fields.find(f => f.key === fieldKey)) ||
    (mod.columns && mod.columns.find(c => c.key === fieldKey));

  // If no fieldDef is found, or fieldDef has no lookup config, try to define a fallback lookup
  let fallbackOptionsFrom = null;
  let fallbackValueKey = 'id';
  let fallbackLabelKey = 'name';

  if (!fieldDef || (!fieldDef.optionsFrom && !fieldDef.staticOptions)) {
    // 1. Employee Lookups
    if (
      ['direct_manager', 'tier_1_approval', 'tier_2_approval', 'tier_3_approval',
        'sr_owner', 'sr_coordinator', 'policy_lead', 'requester', 'sr_creater', 'created_by',
        'updated_by', 'comment_by', 'employee'].includes(fieldKey) ||
      (typeof val === 'string' && val.includes('@'))
    ) {
      fallbackOptionsFrom = 'employee';
      fallbackValueKey = (typeof val === 'string' && val.includes('@')) ? 'email' : 'employee_id';
      fallbackLabelKey = 'full_name';
    }
    // 2. Company / Customer Lookups
    else if (['company_id', 'vendor', 'customer', 'partner', 'my_company', 'company', 'company_entity', 'company_shortname'].includes(fieldKey)) {
      if (selectCache['my_company']) {
        if (!selectCache['my_company_index_id'] || selectCache['my_company_index_id']._lastLength !== selectCache['my_company'].length) {
          const idMap = new Map();
          selectCache['my_company'].forEach(x => {
            idMap.set(String(x.my_company_id), x);
            idMap.set(String(x.company_shortname), x);
          });
          idMap._lastLength = selectCache['my_company'].length;
          selectCache['my_company_index_id'] = idMap;
        }
        const match = selectCache['my_company_index_id'].get(String(val));
        if (match) return window.formatCompanyLabel(match) || val;
      }
      if (selectCache['company']) {
        if (!selectCache['company_index_id'] || selectCache['company_index_id']._lastLength !== selectCache['company'].length) {
          const idMap = new Map();
          selectCache['company'].forEach(x => {
            idMap.set(String(x.company_id), x);
            idMap.set(String(x.company_shortname), x);
          });
          idMap._lastLength = selectCache['company'].length;
          selectCache['company_index_id'] = idMap;
        }
        const match = selectCache['company_index_id'].get(String(val));
        if (match) return match.company_name || match.company_shortname || val;
      }
    }
    // 3. Department Lookups
    else if (fieldKey === 'department_id') {
      fallbackOptionsFrom = 'department';
      fallbackValueKey = 'department_id';
      fallbackLabelKey = 'department_name';
    }
    // 4. Policy/Request Type Lookups
    else if (['request_type', 'policy_id'].includes(fieldKey)) {
      fallbackOptionsFrom = 'policy';
      fallbackValueKey = 'policy_id';
      fallbackLabelKey = 'policy_name';
    }
    // 5. Request Lookup
    else if (['request', 'request_id', 'payment_request', 'invoice_request', 'mtr_request', 'service_request', 'asset_request'].includes(fieldKey)) {
      if (selectCache['request']) {
        const reqMatch = selectCache['request'].find(x => String(x.request_id) === String(val));
        if (reqMatch && MODULES['request'] && MODULES['request'].displayName) {
          return MODULES['request'].displayName(reqMatch);
        }
      }
    }
  }

  // --- CONTRACT TYPE RESOLVER ---
  if ((moduleKey === 'contract' || moduleKey === 'v_contract') && fieldKey === 'type') {
    const num = Number(val);
    if (num === 69 || String(val).toLowerCase() === 'selling') return 'Selling';
    if (num === 70 || String(val).toLowerCase() === 'buying') return 'Buying';
    if (num === 71 || String(val).toLowerCase() === 'internal') return 'Internal';
  }

  // 1. Solve static options / options array
  const optList = (fieldDef && fieldDef.staticOptions) || (fieldDef && fieldDef.options);
  if (optList && Array.isArray(optList)) {
    const sMatch = optList.find(o =>
      (typeof o === 'object' && String(o.value) === String(val)) || (String(o) === String(val))
    );
    if (sMatch) return (typeof sMatch === 'object') ? (sMatch.label || sMatch.value) : sMatch;
  }

  // 2. Solve dynamic optionsFrom (either via config or fallback)
  const optionsFrom = fieldDef ? fieldDef.optionsFrom : fallbackOptionsFrom;
  if (optionsFrom && selectCache[optionsFrom]) {
    const refModKey = optionsFrom;
    const refMod = MODULES[refModKey];
    const optionArr = selectCache[refModKey];

    const valKey = fieldDef ? (fieldDef.optionValue || 'id') : fallbackValueKey;
    const labelKey = fieldDef ? fieldDef.optionLabel : fallbackLabelKey;

    // Create an O(1) Index Map for hyper-fast lookup if not exists
    if (!selectCache[`${refModKey}_index_${valKey}`] || selectCache[`${refModKey}_index_${valKey}`]._lastLength !== optionArr.length) {
      const idxMap = new Map();
      for (let i = 0; i < optionArr.length; i++) {
        idxMap.set(String(optionArr[i][valKey]), optionArr[i]);
      }
      idxMap._lastLength = optionArr.length;
      selectCache[`${refModKey}_index_${valKey}`] = idxMap;
    }

    const idxMap = selectCache[`${refModKey}_index_${valKey}`];
    let match = idxMap.get(String(val));

    // Fallback for employee module to search by employee_id, email, or username if direct match fails
    if (!match && refModKey === 'employee') {
      const valStr = String(val).toLowerCase();
      match = optionArr.find(x =>
        (x.employee_id && String(x.employee_id).toLowerCase() === valStr) ||
        (x.email && String(x.email).toLowerCase() === valStr) ||
        (x.username && String(x.username).toLowerCase() === valStr)
      );
    }

    // Mismatched configuration fallback: if match not found, try primary key index fallback
    if (!match && refMod && refMod.pk && valKey !== refMod.pk) {
      if (!selectCache[`${refModKey}_index_${refMod.pk}`] || selectCache[`${refModKey}_index_${refMod.pk}`]._lastLength !== optionArr.length) {
        const primaryKeyMap = new Map();
        for (let i = 0; i < optionArr.length; i++) {
          primaryKeyMap.set(String(optionArr[i][refMod.pk]), optionArr[i]);
        }
        primaryKeyMap._lastLength = optionArr.length;
        selectCache[`${refModKey}_index_${refMod.pk}`] = primaryKeyMap;
      }
      match = selectCache[`${refModKey}_index_${refMod.pk}`].get(String(val));
    }

    if (match) {
      if (refModKey === 'employee') {
        const isRequestModule = ['request', 'my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(moduleKey);
        if (isRequestModule) return match.full_name || val;
        return typeof formatEmployeeLabel === 'function' ? formatEmployeeLabel(match) : (match.full_name || val);
      }
      if (refMod && refMod.labelTemplate) {
        let str = refMod.labelTemplate;
        const typeMap = { 69: 'Selling', 70: 'Buying', '69': 'Selling', '70': 'Buying' };
        for (const k in match) {
          let mk = match[k] !== null && match[k] !== undefined ? String(match[k]) : '';
          if (refModKey === 'contract' && k === 'type' && typeMap[mk]) {
            mk = typeMap[mk];
          }
          str = str.replace(new RegExp(`{{${k}}}`, 'gi'), mk);
        }
        return str;
      } else if (refMod && refMod.displayName && (!fieldDef || !fieldDef.optionLabel)) {
        return refMod.displayName(match);
      } else if (labelKey) {
        let ol = match[labelKey];
        if (!ol && (refModKey === 'oppotunity' || refModKey === 'opportunity') && match.project_name) {
          ol = match.project_name;
        }
        if (labelKey === 'policy_name' && typeof ol === 'string' && ol.toUpperCase().startsWith('OPPORTUNITY')) {
          ol = 'Opportunity';
        }
        return ol;
      }
    }
  }
  return val;
}


// Window Bridge for Lookup Service
window.getSelectOptions = getSelectOptions;
window.prefetchLookups = prefetchLookups;
window.formatEmployeeLabel = formatEmployeeLabel;
window.resolveEmployeeLabel = resolveEmployeeLabel;
window.resolveEmployeeName = resolveEmployeeName;
window.formatRequestLabel = formatRequestLabel;
window.formatCompanyLabel = formatCompanyLabel;
window.formatOpportunityLabel = formatOpportunityLabel;
window.formatProcessLabel = formatProcessLabel;
window.resolveSelectDisplayVal = resolveSelectDisplayVal;
window.getSelectLookupMap = getSelectLookupMap;
window.resolveLookupValue = resolveLookupValue;
