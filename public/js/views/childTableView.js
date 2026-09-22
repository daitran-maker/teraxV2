/**
 * CRC App - Child Tables & Related Records View
 * Extracted as part of Phase 2 Modularization
 */

window.switchMobileDetailTab = function (tab) {
  const activePane = document.getElementById('content');
  if (!activePane) return;
  const infoBtn = activePane.querySelector('#mob-tab-info');
  const relatedBtn = activePane.querySelector('#mob-tab-related');
  const layout = activePane.querySelector('.detail-layout');

  if (tab === 'info') {
    if (infoBtn) {
      infoBtn.classList.add('active');
      infoBtn.style.background = 'rgba(255, 255, 255, 0.15)';
      infoBtn.style.color = '#fff';
    }
    if (relatedBtn) {
      relatedBtn.classList.remove('active');
      relatedBtn.style.background = 'transparent';
      relatedBtn.style.color = 'rgba(255, 255, 255, 0.6)';
    }
    if (layout) layout.classList.remove('show-related');
  } else if (tab === 'related') {
    if (relatedBtn) {
      relatedBtn.classList.add('active');
      relatedBtn.style.background = 'rgba(255, 255, 255, 0.15)';
      relatedBtn.style.color = '#fff';
    }
    if (infoBtn) {
      infoBtn.classList.remove('active');
      infoBtn.style.background = 'transparent';
      infoBtn.style.color = 'rgba(255, 255, 255, 0.6)';
    }
    if (layout) layout.classList.add('show-related');
  }
};

function renderChildCardHTML(childKey, row, displayName, pkVal, visibleCols, mod) {
  let statusClass = '';
  if (childKey !== 'request') {
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

  // Filter out status from fields since card background/accent represents it (Task 4)
  const displayFields = visibleCols.filter(c => {
    const k = c.key.toLowerCase();
    return !['status', 'payment_status', 'invoice_status', 'account_status'].includes(k);
  });

  const isProfile = ['employee', 'contact', 'company', 'department'].includes(childKey);
  const isFinancial = ['payment', 'invoice', 'mtr'].includes(childKey);
  const isAssetOrService = ['asset', 'service'].includes(childKey);

  const getFieldVal = (col) => {
    let val = parseBufferVal(row[col.key]);
    const virtualVal = resolveVirtualColumn(childKey, col.key, row);
    if (virtualVal !== undefined) val = virtualVal;
    val = resolveLookupValue(childKey, col.key, val);
    if (val === null || val === undefined) return '';
    const l = String(col.label).toLowerCase();
    const k = String(col.key).toLowerCase();
    if ((col.key === 'point' || col.key === 'rating_point') && (childKey === 'request_rating' || childKey === 'rating')) {
      const pointVal = parseInt(val) || 0;
      let starsHTML = '';
      for (let i = 1; i <= 5; i++) {
        const starColor = i <= pointVal ? '#EAB308' : '#D1D5DB';
        starsHTML += `<span class="material-symbols-rounded" style="font-size:16px; color:${starColor}; vertical-align:middle; line-height:1;">star</span>`;
      }
      return `${starsHTML} <span style="font-size:11px; color:var(--text-muted); font-weight:600; margin-left:4px; vertical-align:middle;">(${pointVal})</span>`;
    }
    const isRequestChild = ['request', 'my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(childKey);
    if (isRequestChild && (col.type === 'date' || col.type === 'datetime' || ['date', 'due_date', 'payment_date', 'start_date', 'end_date', 'purchase_date', 'contract_signed_date', 'transaction_date', 'invoice_date', 'close_date', 'create_date', 'request_date', 'birthday', 'next_payment_date', 'deadline'].includes(col.key) || col.key === 'log_time' || col.key === 'created_date' || col.key === 'updated_date' || k.endsWith('_date') || k.includes('date') || l.includes('date') || (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}/)))) {
      return formatDateTime(val);
    } else if (['date', 'due_date', 'payment_date', 'start_date', 'end_date', 'purchase_date', 'contract_signed_date', 'transaction_date', 'invoice_date', 'close_date', 'create_date', 'request_date', 'birthday', 'next_payment_date', 'deadline'].includes(col.key) || col.type === 'date' || l === 'date' || l === 'transaction date' || (l.includes('date') && !['log_time', 'created_date', 'updated_date'].includes(col.key))) {
      return formatDateMON(val);
    } else if (col.key === 'log_time' || col.key === 'created_date' || col.key === 'updated_date' || k.endsWith('_date') || l.includes('date')) {
      return formatDateTime(val);
    } else if ((k.includes('amount') || k.includes('price') || k.includes('cost') || k.includes('total') || k.includes('budget') || k.includes('tax') || k.includes('value') || k.includes('balance') || isNumericFieldKey(col.key, col.type)) && !k.includes('type')) {
      if (childKey === 'finance' && (val === 0 || val === '0' || parseFloat(val) === 0 || val === '')) {
        return '';
      }
      return formatNumber(val);
    }
    return val;
  };

  if (isProfile) {
    let avatarHTML = '';
    let email = row.email || '';
    let phone = row.phone || row.mobile_no || '';
    let subtitle = '';

    if (childKey === 'employee') {
      const avatarUrl = row.avatar;
      const initials = (row.full_name || 'E').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      avatarHTML = avatarUrl
        ? `<img src="${avatarUrl}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;border:2px solid #fff;box-shadow:var(--shadow-sm);" />`
        : `<div style="width:40px;height:40px;border-radius:50%;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:13px;box-shadow:var(--shadow-sm);">${initials}</div>`;
      subtitle = row.position || 'Employee';
    } else if (childKey === 'contact') {
      const initials = (row.name || 'C').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      avatarHTML = `<div style="width:40px;height:40px;border-radius:50%;background:rgba(79, 142, 247, 0.1);color:var(--accent);display:flex;align-items:center;justify-content:center;font-weight:600;font-size:13px;border:1px solid rgba(79, 142, 247, 0.2);">${initials}</div>`;
      subtitle = row.title || 'Contact';
    } else if (childKey === 'company') {
      const logoUrl = row.logo;
      avatarHTML = logoUrl
        ? `<img src="${logoUrl}" style="width:40px;height:40px;border-radius:8px;object-fit:contain;background:#fff;padding:2px;border:1px solid var(--border-light);" />`
        : `<div style="width:40px;height:40px;border-radius:8px;background:var(--bg-hover);color:var(--text-muted);display:flex;align-items:center;justify-content:center;border:1px solid var(--border);"><span class="material-symbols-rounded" style="font-size:18px;">corporate_fare</span></div>`;
      subtitle = row.type || 'Company';
    } else if (childKey === 'department') {
      avatarHTML = `<div style="width:40px;height:40px;border-radius:8px;background:rgba(249, 115, 22, 0.1);color:#f97316;display:flex;align-items:center;justify-content:center;border:1px solid rgba(249, 115, 22, 0.2);"><span class="material-symbols-rounded" style="font-size:18px;">account_tree</span></div>`;
      subtitle = [row.type, row.company_shortname].filter(Boolean).join(' • ') || 'Department';
    }

    return `
      <div class="modern-card profile-card ${statusClass}" onclick="window.location.hash = '${childKey}/${pkVal}'" style="background:var(--bg-card); border:1px solid var(--border); border-radius:12px; padding:16px; display:flex; flex-direction:column; gap:12px; cursor:pointer; transition:all 0.2s; box-shadow:var(--shadow-sm);" onmouseover="this.style.borderColor='var(--accent)'; this.style.transform='translateY(-2px)';" onmouseout="this.style.borderColor='var(--border)'; this.style.transform='none';">
         <div style="display:flex; gap:12px; align-items:center; border-bottom:1px solid var(--border-light); padding-bottom:10px;">
           ${avatarHTML}
           <div style="display:flex; flex-direction:column; min-width:0; flex:1;">
             <span style="font-weight:600; color:var(--text-primary); font-size:12.5px; word-break:break-word; line-height:1.4; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;" title="${escapeHTML(String(displayName))}">${escapeHTML(String(displayName))}</span>
             <span style="font-size:10px; color:var(--text-muted);">${escapeHTML(subtitle)}</span>
           </div>
           <span class="material-symbols-rounded" style="color:var(--text-muted); font-size:16px; margin-left:auto; flex-shrink:0;">open_in_new</span>
         </div>
         <div style="display:flex; flex-direction:column; gap:6px; flex:1;">
           ${displayFields.map(c => {
      const val = getFieldVal(c);
      if (val === '') return '';
      return `
               <div style="display:flex; justify-content:space-between; font-size:11px; padding: 2px 0;">
                 <span style="color:var(--text-muted); font-weight:500;">${escapeHTML(c.label)}</span>
                 <span style="color:var(--text-primary); font-weight:600; text-align:right;">${escapeHTML(String(val))}</span>
               </div>
             `;
    }).join('')}
         </div>
         ${(email || phone) ? `
         <div style="display:flex; gap:8px; border-top:1px dashed var(--border-light); padding-top:10px; margin-top:4px;" onclick="event.stopPropagation()">
           ${email ? `<a href="mailto:${email}" class="btn btn-outline btn-sm" style="flex:1; justify-content:center; text-decoration:none; display:flex; align-items:center; gap:4px; font-size:9.5px; padding:4px 8px;"><span class="material-symbols-rounded" style="font-size:13px;">mail</span> Email</a>` : ''}
           ${phone ? `<a href="tel:${phone}" class="btn btn-outline btn-sm" style="flex:1; justify-content:center; text-decoration:none; display:flex; align-items:center; gap:4px; font-size:9.5px; padding:4px 8px;"><span class="material-symbols-rounded" style="font-size:13px;">phone</span> Call</a>` : ''}
         </div>` : ''}
      </div>
    `;

  } else if (isFinancial) {
    let amountVal = '';
    let currencyVal = row.currency || 'VND';
    let typeVal = '';

    if (childKey === 'payment') {
      amountVal = getFieldVal(mod.columns.find(c => c.key === 'value'));
      typeVal = row.payment_type || 'Payment';
    } else if (childKey === 'invoice') {
      amountVal = getFieldVal(mod.columns.find(c => c.key === 'value_before_vat'));
      typeVal = row.invoice_type || 'Invoice';
    } else if (childKey === 'mtr') {
      amountVal = getFieldVal(mod.columns.find(c => c.key === 'amount'));
      typeVal = row.transaction_type || 'Transfer';
    }

    return `
      <div class="modern-card financial-card ${statusClass}" onclick="window.location.hash = '${childKey}/${pkVal}'" style="background:var(--bg-card); border:1px solid var(--border); border-radius:12px; padding:16px; display:flex; flex-direction:column; gap:12px; cursor:pointer; transition:all 0.2s; box-shadow:var(--shadow-sm);" onmouseover="this.style.borderColor='var(--accent)'; this.style.transform='translateY(-2px)';" onmouseout="this.style.borderColor='var(--border)'; this.style.transform='none';">
         <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:1px solid var(--border-light); padding-bottom:10px;">
           <div style="display:flex; flex-direction:column; min-width:0; flex:1;">
             <span style="font-weight:600; color:var(--text-primary); font-size:12.5px; word-break:break-word; line-height:1.4; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;" title="${escapeHTML(String(displayName))}">${escapeHTML(String(displayName))}</span>
             <span class="badge badge-blue" style="width:fit-content; margin-top:4px; font-size:9px; padding:2px 6px;">${escapeHTML(typeVal)}</span>
           </div>
           <div style="display:flex; flex-direction:column; align-items:flex-end; margin-left:8px;">
             <span style="font-size:14px; font-weight:700; color:var(--accent-orange);">${escapeHTML(amountVal)}</span>
             <span style="font-size:8px; color:var(--text-muted); font-weight:700; text-transform:uppercase;">${escapeHTML(currencyVal)}</span>
           </div>
         </div>
         <div style="display:flex; flex-direction:column; gap:6px;">
           ${displayFields.filter(c => !['value', 'value_before_vat', 'amount', 'currency'].includes(c.key)).map(c => {
      const val = getFieldVal(c);
      if (val === '') return '';
      return `
               <div style="display:flex; justify-content:space-between; font-size:11px; padding: 2px 0;">
                 <span style="color:var(--text-muted); font-weight:500;">${escapeHTML(c.label)}</span>
                 <span style="color:var(--text-primary); font-weight:600; text-align:right; max-width:180px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${escapeHTML(String(val))}">${escapeHTML(String(val))}</span>
               </div>
             `;
    }).join('')}
         </div>
      </div>
    `;

  } else if (isAssetOrService) {
    let mainIcon = childKey === 'asset' ? 'inventory_2' : 'settings_suggest';
    let subInfo = '';

    if (childKey === 'asset') {
      subInfo = row.identity_number ? `SN: ${row.identity_number}` : (row.type || 'Asset');
    } else if (childKey === 'service') {
      subInfo = row.service_type || 'Service';
    }

    return `
      <div class="modern-card asset-card ${statusClass}" onclick="window.location.hash = '${childKey}/${pkVal}'" style="background:var(--bg-card); border:1px solid var(--border); border-radius:12px; padding:16px; display:flex; flex-direction:column; gap:12px; cursor:pointer; transition:all 0.2s; box-shadow:var(--shadow-sm);" onmouseover="this.style.borderColor='var(--accent)'; this.style.transform='translateY(-2px)';" onmouseout="this.style.borderColor='var(--border)'; this.style.transform='none';">
         <div style="display:flex; gap:10px; align-items:center; border-bottom:1px solid var(--border-light); padding-bottom:10px;">
           <div style="width:32px;height:32px;border-radius:6px;background:rgba(99, 102, 241, 0.1);color:var(--accent);display:flex;align-items:center;justify-content:center;">
             <span class="material-symbols-rounded" style="font-size:16px;">${mainIcon}</span>
           </div>
           <div style="display:flex; flex-direction:column; min-width:0; flex:1;">
             <span style="font-weight:600; color:var(--text-primary); font-size:12.5px; word-break:break-word; line-height:1.4; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;" title="${escapeHTML(String(displayName))}">${escapeHTML(String(displayName))}</span>
             <span style="font-size:9px; color:var(--text-muted);">${escapeHTML(subInfo)}</span>
           </div>
           <span class="material-symbols-rounded" style="color:var(--text-muted); font-size:16px; flex-shrink:0;">open_in_new</span>
         </div>
         <div style="display:flex; flex-direction:column; gap:6px;">
           ${displayFields.map(c => {
      const val = getFieldVal(c);
      if (val === '') return '';
      return `
               <div style="display:flex; justify-content:space-between; font-size:11px; padding: 2px 0;">
                 <span style="color:var(--text-muted); font-weight:500;">${escapeHTML(c.label)}</span>
                 <span style="color:var(--text-primary); font-weight:600; text-align:right;">${escapeHTML(String(val))}</span>
               </div>
             `;
    }).join('')}
         </div>
      </div>
    `;

  } else {
    return `
      <div class="modern-card default-card ${statusClass}" onclick="window.location.hash = '${childKey}/${pkVal}'" style="background:var(--bg-card); border:1px solid var(--border); border-radius:12px; padding:16px; display:flex; flex-direction:column; gap:12px; cursor:pointer; transition:all 0.2s; box-shadow:var(--shadow-sm);" onmouseover="this.style.borderColor='var(--accent)'; this.style.transform='translateY(-2px)';" onmouseout="this.style.borderColor='var(--border)'; this.style.transform='none';">
         <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-light); padding-bottom:8px;">
           <span style="font-weight:600; color:var(--text-primary); font-size:13px;">${escapeHTML(String(displayName))}</span>
           <span class="material-symbols-rounded" style="color:var(--text-muted); font-size:16px;">open_in_new</span>
         </div>
         <div style="display:flex; flex-direction:column; gap:8px;">
         ${displayFields.map(c => {
      const val = getFieldVal(c);
      if (val === '') return '';
      return `
              <div style="display:flex; flex-direction:column; align-items:flex-start; padding: 4px 0; border-bottom: 1px dashed rgba(0,0,0,0.05); gap:2px;">
                <span style="font-size:8px; color:var(--text-muted); opacity:0.6; line-height:1; font-weight:700; text-transform:uppercase;">${escapeHTML(c.label)}</span>
                <div style="text-align:left; word-break:break-word; font-size:12px; color:var(--text-primary); font-weight:500;">${escapeHTML(String(val))}</div>
              </div>
            `;
    }).join('')}
         </div>
      </div>
    `;
  }
}

window.filterChildTableSearch = function (childKey, parentKey, parentPkVal, query) {
  if (childKey === 'logs') {
    const cont = document.querySelector(`#child-table-container-${childKey}`);
    if (cont) {
      const q = (query || '').toLowerCase().trim();
      const cards = cont.querySelectorAll('.log-card');
      let visible = 0;
      cards.forEach(c => {
        const text = (c.textContent || '').toLowerCase();
        const match = !q || text.includes(q);
        c.style.display = match ? '' : 'none';
        if (match) visible++;
      });
      const sumSpan = document.querySelector(`#child-sum-${childKey}`);
      if (sumSpan) {
        sumSpan.innerHTML = `<span style="opacity:0.7;font-weight:normal;font-size:12px;">(${visible} records)</span>`;
      }
    }
    return;
  }
  const hashModule = window.location.hash.replace('#', '').split('/')[0];
  if (['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(hashModule) && parentKey === 'request') {
    parentKey = hashModule;
  }
  const cacheKey = `${parentKey}_${parentPkVal}_${childKey}`;
  const allData = (window.childTableRawData && window.childTableRawData[cacheKey]) ? window.childTableRawData[cacheKey] : [];
  const q = (query || '').toLowerCase().trim();
  let filteredData = allData;
  if (q) {
    filteredData = allData.filter(row => {
      return Object.values(row).some(val => val !== null && val !== undefined && String(val).toLowerCase().includes(q));
    });
  }
  loadChildTable(childKey, parentKey, parentPkVal, filteredData);
};

const REQUEST_CHILD_RELOAD_MODULES = ['request', 'service', 'payment', 'expense', 'asset', 'comment', 'contract'];

function getActiveHashModule() {
  return (window.location.hash || '').replace('#', '').split('/')[0] || currentModule;
}

function normalizeRequestParentKey(parentKey) {
  return ['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(parentKey) ? 'my_request' : parentKey;
}

function getChildSortTime(row) {
  const candidates = [
    row.sr_created_date,
    row.created_date,
    row.comment_date,
    row.updated_date,
    row.payment_date,
    row.due_date,
    row.purchase_date,
    row.start_date,
    row.end_date,
    row.contract_signed_date
  ];
  for (const value of candidates) {
    if (!value) continue;
    const time = new Date(value).getTime();
    if (!Number.isNaN(time)) return time;
  }
  return 0;
}

function sortChildRowsNewestFirst(childKey, rows) {
  if (!REQUEST_CHILD_RELOAD_MODULES.includes(childKey) || !Array.isArray(rows)) return rows;
  return rows.sort((a, b) => getChildSortTime(b) - getChildSortTime(a));
}

function markReportPanesDirty(moduleKeys = []) {
  const keys = new Set(['request', 'my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team', ...moduleKeys]);
  window.reportReloadNeeded = window.reportReloadNeeded || {};
  keys.forEach(key => {
    window.reportReloadNeeded[key] = true;
    const pane = document.getElementById('pane-' + key);
    if (pane) pane.dataset.dirty = 'true';
  });
}

function clearChildTableCache(childKey, parentKey, parentPkVal) {
  if (!window.childTableRawData || !childKey || !parentPkVal) return;
  const keys = [
    `${parentKey}_${parentPkVal}_${childKey}`,
    `${normalizeRequestParentKey(parentKey)}_${parentPkVal}_${childKey}`,
    `request_${parentPkVal}_${childKey}`,
    `my_request_${parentPkVal}_${childKey}`,
    `my_process_owner_${parentPkVal}_${childKey}`,
    `my_task_${parentPkVal}_${childKey}`,
    `my_approval_${parentPkVal}_${childKey}`,
    `my_team_${parentPkVal}_${childKey}`
  ];
  keys.forEach(key => delete window.childTableRawData[key]);
}

async function loadChildTable(childKey, parentKey, parentPkVal, customData) {
  const hashModule = window.location.hash.replace('#', '').split('/')[0];
  if (['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(hashModule) && parentKey === 'request') {
    parentKey = hashModule;
  }
  const normalizedParentKey = normalizeRequestParentKey(parentKey);
  const mod = MODULES[childKey];
  const targetPath = parentPkVal ? `${parentKey}/${parentPkVal}` : parentKey;
  const targetPaneId = 'pane-' + targetPath.replace(/[^a-zA-Z0-9_-]/g, '-');
  let contentPane = document.getElementById(targetPaneId);
  if (!contentPane) {
    const activePane = document.getElementById('content');
    if (activePane) {
      const activeHash = activePane.dataset.hash || '';
      const activePath = activeHash.split('&')[0];
      if (activePath === targetPath) {
        contentPane = activePane;
      }
    }
  }
  if (!contentPane) {
    contentPane = document.getElementById('content');
  }
  if (!contentPane) return;
  const container = contentPane.querySelector(`#child-table-container-${childKey}`);
  if (!container) return;
  container.dataset.loaded = 'true';






  if (childKey === 'logs') {
    if (!selectCache['employee'] || !selectCache['employee'].isFullList) {
      try {
        await getSelectOptions('employee');
      } catch (e) { }
    }

    const activityLog = typeof currentRecord !== 'undefined' && currentRecord ? (currentRecord.logs || currentRecord.log) : '';
    const notificationLogs = typeof currentRecord !== 'undefined' && currentRecord ? currentRecord.notification_logs : null;

    // Asynchronously fetch audit logs from backend if not yet fetched for this container
    const effectiveTable = (MODULES[parentKey]?.writeTable) || (['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(parentKey) ? 'request' : parentKey);
    if (parentPkVal && !container.dataset.auditFetched) {
      container.dataset.auditFetched = 'true';
      apiGet(`/table/${encodeURIComponent(effectiveTable)}/${encodeURIComponent(parentPkVal)}/audit-logs`)
        .then(res => {
          if (res && res.data && res.data.length > 0) {
            if (typeof currentRecord !== 'undefined' && currentRecord) {
              currentRecord.log = res.data;
            }
            loadChildTable(childKey, parentKey, parentPkVal, customData);
          }
        })
        .catch(() => { });
    }

    let combinedEntries = [];

    // Helper function to safely parse logs
    function parseLogs(logText) {
      if (!logText) return [];
      if (Array.isArray(logText)) {
        return logText.map(item => {
          if (item && typeof item === 'object') {
            return { type: 'json', content: item };
          } else {
            return { type: 'text', content: String(item) };
          }
        });
      }
      if (typeof logText === 'string') {
        const trimmed = logText.trim();
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
          try {
            const parsedArray = JSON.parse(trimmed);
            if (Array.isArray(parsedArray)) {
              return parsedArray.map(item => {
                if (item && typeof item === 'object') {
                  return { type: 'json', content: item };
                } else {
                  return { type: 'text', content: String(item) };
                }
              });
            }
          } catch (e) { }
        }
      }

      const entries = [];
      let i = 0;
      const len = logText.length;

      while (i < len) {
        const startIdx = logText.indexOf('{', i);
        if (startIdx === -1) {
          const plainText = logText.substring(i).trim();
          if (plainText) {
            entries.push({ type: 'text', content: plainText });
          }
          break;
        }

        const plainText = logText.substring(i, startIdx).trim();
        if (plainText) {
          entries.push({ type: 'text', content: plainText });
        }

        let braceCount = 0;
        let inString = false;
        let escape = false;
        let endIdx = -1;

        for (let j = startIdx; j < len; j++) {
          const char = logText[j];
          if (escape) {
            escape = false;
            continue;
          }
          if (char === '\\') {
            escape = true;
            continue;
          }
          if (char === '"') {
            inString = !inString;
            continue;
          }
          if (!inString) {
            if (char === '{') {
              braceCount++;
            } else if (char === '}') {
              braceCount--;
              if (braceCount === 0) {
                endIdx = j;
                break;
              }
            }
          }
        }

        if (endIdx !== -1) {
          const jsonStr = logText.substring(startIdx, endIdx + 1);
          try {
            const parsed = JSON.parse(jsonStr);
            entries.push({ type: 'json', content: parsed });
            i = endIdx + 1;
          } catch (e) {
            entries.push({ type: 'text', content: logText.substring(startIdx, startIdx + 1) });
            i = startIdx + 1;
          }
        } else {
          const plainText = logText.substring(startIdx).trim();
          if (plainText) {
            entries.push({ type: 'text', content: plainText });
          }
          break;
        }
      }
      return entries;
    }

    // Helper function to parse log date robustly
    function parseLogDate(dateStr) {
      if (!dateStr) return new Date();
      let d = new Date(dateStr);
      if (!isNaN(d.getTime())) return d;

      // Try parsing MM/DD/YYYY HH24:MI:SS or DD/MM/YYYY HH24:MI:SS manually
      const parts = dateStr.split(' ');
      if (parts.length === 2) {
        const dateParts = parts[0].split('/');
        const timeParts = parts[1].split(':');
        if (dateParts.length === 3 && timeParts.length === 3) {
          const m = parseInt(dateParts[0], 10) - 1;
          const dd = parseInt(dateParts[1], 10);
          const y = parseInt(dateParts[2], 10);
          const hh = parseInt(timeParts[0], 10);
          const mm = parseInt(timeParts[1], 10);
          const ss = parseInt(timeParts[2], 10);
          d = new Date(y, m, dd, hh, mm, ss);
          if (!isNaN(d.getTime())) return d;
        }
      }
      return new Date();
    }

    if (activityLog) {
      try {
        const parsedEntries = parseLogs(activityLog);
        parsedEntries.forEach(entry => {
          if (entry.type === 'json') {
            const parsed = entry.content;

            // Show only short action summary; full JSON only in expand detail
            let actionText = parsed.action || 'System activity';
            const changesObj = parsed.changes;

            // Ignore internal notification log updates in activity timeline
            if (changesObj && typeof changesObj === 'object' && !Array.isArray(changesObj)) {
              const changedKeys = Object.keys(changesObj);
              if (changedKeys.length === 1 && changedKeys[0] === 'notification_logs') {
                return;
              }
            }

            let detailsHtml = '';
            if (actionText === 'commented' || parsed.comment_text) {
              actionText = typeof t === 'function' ? t('action.commented', 'commented') : 'commented';
              const cmtText = parsed.comment_text || (changesObj && changesObj.comment ? (changesObj.comment.new || changesObj.comment) : '');
              if (cmtText) {
                detailsHtml = `<div style="margin-top:4px; padding:6px 10px; background:#F8FAFC; border-radius:6px; border-left:3px solid var(--accent); color:var(--text-primary); font-size:12px; white-space:pre-wrap;">${escapeHTML(String(cmtText).trim())}</div>`;
              }
            } else if (actionText.toLowerCase().includes('approved') || actionText.toLowerCase().includes('rejected') || actionText.toLowerCase().includes('phê duyệt')) {
              const isApprove = !actionText.toLowerCase().includes('reject');
              const tierMatch = actionText.match(/(?:tier|cấp|level)\s*(\d+)/i);
              const tierNum = tierMatch ? tierMatch[1] : '';
              if (isApprove) {
                actionText = tierNum ? (typeof t === 'function' ? `${t('action.approved', 'Approved')} Tier ${tierNum}` : `Approved Tier ${tierNum}`) : (typeof t === 'function' ? t('action.approved_record', 'Approved request') : 'Approved request');
              } else {
                actionText = tierNum ? (typeof t === 'function' ? `${t('action.rejected', 'Rejected')} Tier ${tierNum}` : `Rejected Tier ${tierNum}`) : (typeof t === 'function' ? t('action.rejected_record', 'Rejected request') : 'Rejected request');
              }
              const badgeBg = isApprove ? '#ECFDF5' : '#FEF2F2';
              const badgeBorder = isApprove ? '#10B981' : '#EF4444';
              const badgeIcon = isApprove ? 'check_circle' : 'cancel';
              const badgeLabel = isApprove ? (tierNum ? `Approved (Tier ${tierNum})` : 'Approved') : (tierNum ? `Rejected (Tier ${tierNum})` : 'Rejected');
              detailsHtml = `<div style="margin-top:4px;"><span style="display:inline-flex; align-items:center; gap:4px; padding:2px 8px; border-radius:4px; font-size:11px; font-weight:600; background:${badgeBg}; color:${badgeBorder}; border:1px solid ${badgeBorder}33;"><span class="material-symbols-rounded" style="font-size:13px;">${badgeIcon}</span> ${badgeLabel}</span></div>`;
            } else if (actionText.toLowerCase() === 'submitted request' || actionText.toLowerCase().includes('submitted and auto-approved')) {
              const isAuto = actionText.toLowerCase().includes('auto');
              const badgeLabel = isAuto ? 'Submitted & Approved (Tier 0)' : 'Submitted Request';
              actionText = typeof t === 'function' ? t('action.submitted_request', badgeLabel) : badgeLabel;
              detailsHtml = `<div style="margin-top:4px;"><span style="display:inline-flex; align-items:center; gap:4px; padding:2px 8px; border-radius:4px; font-size:11px; font-weight:600; background:#EFF6FF; color:#2563EB; border:1px solid #2563EB33;"><span class="material-symbols-rounded" style="font-size:13px;">send</span> ${escapeHTML(actionText)}</span></div>`;
            } else if (actionText.toLowerCase() === 'withdrew request') {
              actionText = typeof t === 'function' ? t('action.withdrew_request', 'Withdrew Request') : 'Withdrew Request';
              detailsHtml = `<div style="margin-top:4px;"><span style="display:inline-flex; align-items:center; gap:4px; padding:2px 8px; border-radius:4px; font-size:11px; font-weight:600; background:#FFFBEB; color:#D97706; border:1px solid #D9770633;"><span class="material-symbols-rounded" style="font-size:13px;">undo</span> ${escapeHTML(actionText)}</span></div>`;
            } else if (actionText.toLowerCase() === 'cancelled request') {
              actionText = typeof t === 'function' ? t('action.cancelled_request', 'Cancelled Request') : 'Cancelled Request';
              detailsHtml = `<div style="margin-top:4px;"><span style="display:inline-flex; align-items:center; gap:4px; padding:2px 8px; border-radius:4px; font-size:11px; font-weight:600; background:#FEF2F2; color:#DC2626; border:1px solid #DC262633;"><span class="material-symbols-rounded" style="font-size:13px;">block</span> ${escapeHTML(actionText)}</span></div>`;
            } else if (actionText.toLowerCase() === 'completed request') {
              actionText = typeof t === 'function' ? t('action.completed_request', 'Completed Request') : 'Completed Request';
              detailsHtml = `<div style="margin-top:4px;"><span style="display:inline-flex; align-items:center; gap:4px; padding:2px 8px; border-radius:4px; font-size:11px; font-weight:600; background:#ECFDF5; color:#059669; border:1px solid #05966933;"><span class="material-symbols-rounded" style="font-size:13px;">task_alt</span> ${escapeHTML(actionText)}</span></div>`;
            } else if (actionText.toLowerCase() === 'closed request') {
              actionText = typeof t === 'function' ? t('action.closed_request', 'Closed Request') : 'Closed Request';
              detailsHtml = `<div style="margin-top:4px;"><span style="display:inline-flex; align-items:center; gap:4px; padding:2px 8px; border-radius:4px; font-size:11px; font-weight:600; background:#F1F5F9; color:#475569; border:1px solid #47556933;"><span class="material-symbols-rounded" style="font-size:13px;">lock</span> ${escapeHTML(actionText)}</span></div>`;
            } else if (actionText.toLowerCase() === 'started request processing') {
              actionText = typeof t === 'function' ? t('action.started_processing', 'Started Processing') : 'Started Processing';
              detailsHtml = `<div style="margin-top:4px;"><span style="display:inline-flex; align-items:center; gap:4px; padding:2px 8px; border-radius:4px; font-size:11px; font-weight:600; background:#ECFEFF; color:#0891B2; border:1px solid #0891B233;"><span class="material-symbols-rounded" style="font-size:13px;">play_arrow</span> ${escapeHTML(actionText)}</span></div>`;
            } else if (actionText.toLowerCase() === 'paid payment') {
              actionText = typeof t === 'function' ? t('action.paid_payment', 'Paid Payment') : 'Paid Payment';
              detailsHtml = `<div style="margin-top:4px;"><span style="display:inline-flex; align-items:center; gap:4px; padding:2px 8px; border-radius:4px; font-size:11px; font-weight:600; background:#F5F3FF; color:#7C3AED; border:1px solid #7C3AED33;"><span class="material-symbols-rounded" style="font-size:13px;">payments</span> ${escapeHTML(actionText)}</span></div>`;
            } else if (actionText.toLowerCase().startsWith('reassigned sr owner')) {
              detailsHtml = `<div style="margin-top:4px;"><span style="display:inline-flex; align-items:center; gap:4px; padding:2px 8px; border-radius:4px; font-size:11px; font-weight:600; background:#EEF2FF; color:#4F46E5; border:1px solid #4F46E533;"><span class="material-symbols-rounded" style="font-size:13px;">swap_horiz</span> ${escapeHTML(actionText)}</span></div>`;
            } else if (actionText === 'created record') {
              actionText = typeof t === 'function' ? t('action.created_record', 'Created request') : 'Created request';
            } else if (actionText.startsWith('added ') || actionText.startsWith('updated ') || actionText.startsWith('deleted ')) {
              const actParts = actionText.split(' ');
              const verb = actParts[0];
              const targetEntity = actParts.slice(1).join('_');
              const actionKey = `action.${verb}_${targetEntity}`;
              if (typeof t === 'function' && t(actionKey, '') && t(actionKey, '') !== actionKey) {
                actionText = t(actionKey);
              } else {
                const verbLabel = typeof t === 'function' ? t(`action.${verb}`, verb) : verb;
                const tableLabel = typeof t === 'function' ? (t(`table.${targetEntity}`, targetEntity) || t(`nav.${targetEntity}`, targetEntity)) : targetEntity;
                actionText = `${verbLabel} ${tableLabel}`;
              }
              if (verb === 'updated' && changesObj && typeof changesObj === 'object' && !Array.isArray(changesObj)) {
                const changedKeys = Object.keys(changesObj).filter(k => k !== 'approval_flow' && k !== 'notification_logs' && k !== 'updated_by' && k !== 'updated_date');
                if (changedKeys.length === 1) {
                  const fieldLabel = (typeof t === 'function' ? t('col.' + changedKeys[0], changedKeys[0]) : changedKeys[0]);
                  actionText += ` (${fieldLabel})`;
                } else if (changedKeys.length > 1 && changedKeys.length <= 3) {
                  const labels = changedKeys.map(k => typeof t === 'function' ? t('col.' + k, k) : k).join(', ');
                  actionText += ` (${labels})`;
                } else if (changedKeys.length > 3) {
                  actionText += ` (${changedKeys.length} ${typeof t === 'function' ? t('col.fields', 'fields') : 'fields'})`;
                }
              }
            } else if (actionText === 'updated record' && changesObj && typeof changesObj === 'object' && !Array.isArray(changesObj)) {
              if (changesObj.approval_flow) {
                const newF = changesObj.approval_flow.new || changesObj.approval_flow;
                const oldF = changesObj.approval_flow.old;
                let actedStep = null;
                if (newF && Array.isArray(newF.steps)) {
                  actedStep = newF.steps.find(s => {
                    if (!oldF || !Array.isArray(oldF.steps)) return s.status === 3 || s.status === 4;
                    const os = oldF.steps.find(x => x.level === s.level);
                    return !os || os.status !== s.status || (!os.action_by && s.action_by);
                  });
                }
                if (actedStep) {
                  const isApprove = actedStep.status === 3 || actedStep.status_key === 'approved';
                  const tierNum = actedStep.level || '';
                  actionText = isApprove
                    ? (tierNum ? (typeof t === 'function' ? `${t('action.approved', 'Approved')} Tier ${tierNum}` : `Approved Tier ${tierNum}`) : 'Approved request')
                    : (tierNum ? (typeof t === 'function' ? `${t('action.rejected', 'Rejected')} Tier ${tierNum}` : `Rejected Tier ${tierNum}`) : 'Rejected request');
                  const badgeBg = isApprove ? '#ECFDF5' : '#FEF2F2';
                  const badgeBorder = isApprove ? '#10B981' : '#EF4444';
                  const badgeIcon = isApprove ? 'check_circle' : 'cancel';
                  const badgeLabel = isApprove ? (tierNum ? `Approved (Tier ${tierNum})` : 'Approved') : (tierNum ? `Rejected (Tier ${tierNum})` : 'Rejected');
                  detailsHtml = `<div style="margin-top:4px;"><span style="display:inline-flex; align-items:center; gap:4px; padding:2px 8px; border-radius:4px; font-size:11px; font-weight:600; background:${badgeBg}; color:${badgeBorder}; border:1px solid ${badgeBorder}33;"><span class="material-symbols-rounded" style="font-size:13px;">${badgeIcon}</span> ${badgeLabel}</span></div>`;
                }
              }
              if (!detailsHtml) {
                const changedKeys = Object.keys(changesObj).filter(k => k !== 'approval_flow' && k !== 'notification_logs');
                if (changedKeys.length === 1) {
                  const fieldLabel = (typeof t === 'function' ? t('col.' + changedKeys[0], changedKeys[0]) : changedKeys[0]);
                  actionText = typeof t === 'function' ? `${t('action.updated', 'updated')} ${fieldLabel}` : `updated ${fieldLabel}`;
                } else if (changedKeys.length > 1 && changedKeys.length <= 3) {
                  const labels = changedKeys.map(k => typeof t === 'function' ? t('col.' + k, k) : k).join(', ');
                  actionText = typeof t === 'function' ? `${t('action.updated', 'updated')} ${labels}` : `updated ${labels}`;
                } else if (changedKeys.length > 3) {
                  actionText = typeof t === 'function' ? `${t('action.updated', 'updated')} ${changedKeys.length} ${t('col.fields', 'fields')}` : `updated ${changedKeys.length} fields`;
                } else {
                  actionText = typeof t === 'function' ? t('action.updated_record', 'Updated record') : 'Updated record';
                }
              }
            }
            if (changesObj && typeof changesObj === 'object' && !Array.isArray(changesObj)) {
              const changeDetails = Object.entries(changesObj)
                .filter(([k, v]) => k !== 'approval_flow') // hide complex approval_flow internal updates
                .map(([k, v]) => {
                  let valHtml = '';
                  if (v && typeof v === 'object' && 'old' in v && 'new' in v) {
                    const oldVal = v.old === null || v.old === undefined ? 'null' : String(v.old);
                    const newVal = v.new === null || v.new === undefined ? 'null' : String(v.new);
                    if (v.old === null || v.old === undefined) {
                      valHtml = `<span style="color:var(--accent); font-weight:500;">${escapeHTML(newVal)}</span>`;
                    } else {
                      valHtml = `<span style="text-decoration: line-through; color:var(--text-muted); opacity:0.7;">${escapeHTML(oldVal)}</span> ➔ <span style="color:var(--accent); font-weight:500;">${escapeHTML(newVal)}</span>`;
                    }
                  } else {
                    valHtml = `<span style="color:var(--text-primary);">${escapeHTML(typeof v === 'object' ? JSON.stringify(v) : String(v))}</span>`;
                  }
                  const fieldLabel = (typeof t === 'function' ? t('col.' + k, k) : k);
                  return `<div style="margin-bottom:4px;padding:3px 0;"><span style="color:var(--text-muted);font-weight:500;">${escapeHTML(fieldLabel)}:</span> ${valHtml}</div>`;
                })
                .join('');
              if (changeDetails) {
                detailsHtml = `<div style="margin-top:4px;">${changeDetails}</div>`;
              }
            } else if (Array.isArray(changesObj)) {
              const changeDetails = changesObj.map(ch => {
                let str = String(ch);
                str = str.replace(/^([a-z0-9_]+)(?=:)/i, (match) => typeof t === 'function' ? t('col.' + match, match) : match);
                return str.split(/( -> |: )/).map(part => {
                  if (part === ' -> ' || part === ': ') return part;
                  return typeof t_val === 'function' ? t_val(part) : part;
                }).join('');
              }).map(chText => `<div style="margin-bottom: 4px;">↳ ${escapeHTML(chText)}</div>`).join('');
              if (changeDetails) {
                detailsHtml = `<div style="margin-top:4px;">${changeDetails}</div>`;
              }
            }

            combinedEntries.push({
              time: parseLogDate(parsed.timestamp || parsed.sent_at),
              timestampStr: parsed.timestamp || parsed.sent_at || '',
              type: 'activity',
              user: resolveEmployeeName(parsed.user || parsed.by || 'System'),
              action: actionText,
              detailsHtml: detailsHtml
            });
          } else {
            combinedEntries.push({
              time: new Date(),
              timestampStr: '',
              type: 'activity',
              user: 'System',
              action: entry.content,
              detailsHtml: ''
            });
          }
        });
      } catch (e) {
        console.error("Error parsing activityLog", e);
      }
    }

    if (notificationLogs) {
      try {
        const notifs = typeof notificationLogs === 'string' ? JSON.parse(notificationLogs) : notificationLogs;
        if (Array.isArray(notifs)) {
          notifs.forEach(n => {
            combinedEntries.push({
              time: new Date(n.sent_at),
              timestampStr: n.sent_at,
              type: 'notification',
              recipients: n.recipients || [],
              title: n.title,
              body: n.body
            });
          });
        }
      } catch (e) {
        console.error("Error parsing notificationLogs", e);
      }
    }

    combinedEntries.sort((a, b) => b.time - a.time);

    // Deduplicate and merge entries referring to the same action event
    const deduplicatedEntries = [];
    combinedEntries.forEach(entry => {
      const matchIdx = deduplicatedEntries.findIndex(prev => {
        if (prev.type !== entry.type) return false;
        const prevTime = prev.time instanceof Date ? prev.time.getTime() : 0;
        const currTime = entry.time instanceof Date ? entry.time.getTime() : 0;
        const timeDiff = Math.abs(prevTime - currTime);
        if (timeDiff > 5000) return false;

        const prevAction = String(prev.action || '').trim().toLowerCase();
        const currAction = String(entry.action || '').trim().toLowerCase();
        const prevUser = String(prev.user || '').trim().toLowerCase();
        const currUser = String(entry.user || '').trim().toLowerCase();

        // 1. Exact action match
        if (prevAction === currAction && (prevUser === currUser || prevUser === 'system' || currUser === 'system' || !prevUser || !currUser)) {
          return true;
        }

        // Do not merge distinct workflow actions with each other
        const isPrevWorkflow = /approv|reject|submit|withdraw|cancel|complet|close|start|paid|comment/i.test(prevAction);
        const isCurrWorkflow = /approv|reject|submit|withdraw|cancel|complet|close|start|paid|comment/i.test(currAction);
        if (isPrevWorkflow && isCurrWorkflow) {
          if (prevAction !== currAction) return false;
        }

        // 2. Generic trigger 'updated record' paired with specific action
        const isPrevGeneric = prevAction === 'updated record' || prevAction === 'created record';
        const isCurrGeneric = currAction === 'updated record' || currAction === 'created record';
        if (isPrevGeneric !== isCurrGeneric) {
          if (!prevUser || !currUser || prevUser === currUser || prevUser === 'system' || currUser === 'system') {
            return true;
          }
        }

        return false;
      });

      if (matchIdx !== -1) {
        const existing = deduplicatedEntries[matchIdx];
        const isExistingGeneric = String(existing.action || '').trim().toLowerCase() === 'updated record';
        const isEntryGeneric = String(entry.action || '').trim().toLowerCase() === 'updated record';
        if (isExistingGeneric && !isEntryGeneric) {
          existing.action = entry.action;
        }
        if ((!existing.user || String(existing.user).toLowerCase() === 'system') && entry.user && String(entry.user).toLowerCase() !== 'system') {
          existing.user = entry.user;
        }
        if (!existing.detailsHtml && entry.detailsHtml) {
          existing.detailsHtml = entry.detailsHtml;
        }
      } else {
        deduplicatedEntries.push(entry);
      }
    });
    combinedEntries = deduplicatedEntries;

    let html = `
      <style>
        .log-timeline { display:flex; flex-direction:column; gap:10px; padding:12px; }
        .log-card {
          background: var(--bg-card);
          border: 1px solid var(--border-light);
          border-radius: 10px;
          padding: 10px 14px;
          display: flex;
          flex-direction: column;
          gap: 5px;
          font-size: 12px;
          transition: box-shadow 0.15s;
        }
        .log-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
        .log-card.clickable { cursor: pointer; }
        .log-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 10px;
          color: var(--text-muted);
          padding-bottom: 5px;
          margin-bottom: 2px;
          border-bottom: 1px dashed var(--border-light);
        }
        .log-badge {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 2px 7px; border-radius: 4px;
          font-size: 10px; font-weight: 500; letter-spacing: 0.02em;
          background: #F1F5F9; color: #475569;
          border: 1px solid #E2E8F0;
        }
        .log-badge.activity { background: #F1F5F9; color: #475569; border-color: #E2E8F0; }
        .log-badge.notification { background: #F1F5F9; color: #475569; border-color: #E2E8F0; }
        .log-expand-details {
          margin-top: 6px; padding: 8px 10px;
          background: var(--bg-subtle, rgba(0,0,0,0.03));
          border-radius: 7px;
          font-size: 11px;
          color: var(--text-secondary);
          line-height: 1.7;
          display: none;
        }
      </style>
      <div class="log-timeline">
    `;

    if (combinedEntries.length === 0) {
      html += `
        <div style="text-align:center; padding:32px 16px; color:var(--text-muted);">
          <span class="material-symbols-rounded" style="font-size:29px; opacity:0.5; margin-bottom:8px;">history</span>
          <div>${typeof t === 'function' ? t('detail.no_records', 'No records found.') : 'No records found.'}</div>
        </div>
      `;
    } else {
      combinedEntries.forEach((entry, idx) => {
        const formattedTime = formatDateTime(entry.timestampStr || entry.time.toISOString());
        const entryId = `log-entry-${idx}`;
        if (entry.type === 'activity') {
          const hasDetails = !!entry.detailsHtml;
          const isLong = hasDetails;
          const shortAction = entry.action;
          const displayDetails = entry.detailsHtml || '';
          html += `
            <div class="log-card${isLong ? ' clickable' : ''}" ${isLong ? `onclick="(function(el){var b=el.querySelector('.log-expand-details');var shown=b.style.display==='block';b.style.display=shown?'none':'block';el.querySelector('.log-expand-icon').style.transform=shown?'':'rotate(180deg)'})(this)"` : ''}>
              <div class="log-header">
                <span class="log-badge activity"><span class="material-symbols-rounded" style="font-size:11px;">settings</span> Activity</span>
                <div style="display:flex;align-items:center;gap:5px;">
                  <span>${escapeHTML(formattedTime)}</span>
                  ${isLong ? '<span class="material-symbols-rounded log-expand-icon" style="font-size:14px;transition:transform 0.2s;">expand_more</span>' : ''}
                </div>
              </div>
              <div style="line-height:1.5;">
                <span style="font-weight:600;color:var(--accent);">${escapeHTML(entry.user || 'System')}</span>
                <span style="color:var(--text-muted);margin:0 4px;">·</span>
                <span style="color:var(--text-primary);">${escapeHTML(shortAction)}</span>
              </div>
              ${isLong ? `<div class="log-expand-details">${displayDetails}</div>` : ''}
            </div>
          `;
        } else {
          const recips = resolveEmployeeLabel(entry.recipients);
          const isLongBody = entry.body && entry.body.length > 60;
          const shortBody = isLongBody ? entry.body.slice(0, 60) + '…' : entry.body;
          html += `
            <div class="log-card${isLongBody ? ' clickable' : ''}" ${isLongBody ? `onclick="(function(el){var b=el.querySelector('.log-expand-details');var shown=b.style.display==='block';b.style.display=shown?'none':'block';el.querySelector('.log-expand-icon').style.transform=shown?'':'rotate(180deg)'})(this)"` : ''}>
              <div class="log-header">
                <span class="log-badge notification"><span class="material-symbols-rounded" style="font-size:11px;">mail</span> Notification</span>
                <div style="display:flex;align-items:center;gap:5px;">
                  <span>${escapeHTML(formattedTime)}</span>
                  ${isLongBody ? '<span class="material-symbols-rounded log-expand-icon" style="font-size:14px;transition:transform 0.2s;">expand_more</span>' : ''}
                </div>
              </div>
              <div style="line-height:1.5;">
                <span style="color:var(--text-muted);font-size:10px;">To</span>
                <strong style="color:var(--text-primary);margin-left:4px;">${escapeHTML(recips || '—')}</strong>
              </div>
              <div style="font-weight:600;color:var(--text-primary);">${escapeHTML(entry.title)}</div>
              <div style="color:var(--text-secondary);font-style:italic;font-size:11px;padding:4px 8px;border-left:2px solid var(--accent);background:var(--bg-subtle,rgba(0,0,0,0.02));border-radius:0 4px 4px 0;">${escapeHTML(shortBody)}</div>
              ${isLongBody ? `<div class="log-expand-details" style="white-space:pre-wrap;">${escapeHTML(entry.body)}</div>` : ''}
            </div>
          `;
        }
      });
    }

    html += `</div>`;

    container.innerHTML = html;

    const tabBtn = contentPane.querySelector(`#tab-btn-${childKey}`);
    if (tabBtn) {
      const countBadge = contentPane.querySelector(`#tab-count-${childKey}`);
      if (countBadge) {
        countBadge.textContent = combinedEntries.length > 0 ? combinedEntries.length : '';
      } else {
        const originalLabel = typeof t === 'function' ? t('module.' + childKey + '.title', mod.label) : mod.label;
        tabBtn.innerHTML = `${originalLabel} <span style="font-size:10px;opacity:0.8;background:rgba(255,255,255,0.15);padding:1px 5px;border-radius:10px;margin-left:4px;">${combinedEntries.length}</span>`;
      }
    }

    const sumSpan = contentPane.querySelector(`#child-sum-${childKey}`);
    if (sumSpan) {
      sumSpan.innerHTML = `<span style="opacity:0.7;font-weight:normal;font-size:12px;">(${combinedEntries.length} records)</span>`;
    }
    return;
  }

  let fkCol = parentKey === 'contract' ? 'contract_id' : parentKey;
  if (parentKey === 'request') {
    if (childKey === 'assigned_task' || childKey === 'request_rating') fkCol = 'request_id';
    else if (childKey === 'expense') fkCol = 'id__request';
  }
  let fkVal = parentPkVal;
  if (parentKey === 'my_company') {
    if (childKey === 'account') {
      fkCol = 'company_entity';
      fkVal = parentPkVal;
    } else if (childKey === 'my_location') {
      fkCol = 'my_company';
    } else if (childKey === 'policy') {
      fkCol = 'company_id';
      fkVal = parentPkVal;
    } else {
      fkCol = 'company_id';
    }
  }
  else if (parentKey === 'payment') {
    if (childKey === 'mtr') {
      fkCol = 'transaction_id';
      fkVal = (typeof currentRecord !== 'undefined' && currentRecord) ? currentRecord.transaction_id : null;
    }
  }
  else if (parentKey === 'department') fkCol = 'department_id';
  else if (parentKey === 'company') {
    if (childKey === 'contact') fkCol = 'company_id';
    else if (childKey === 'contract') fkCol = 'contractor';
    else if (childKey === 'payment') fkCol = 'company';
    else if (childKey === 'oppotunity' || childKey === 'oppo' || childKey === 'opportunity') fkCol = 'id__company';
    else fkCol = 'company_id';
  }
  else if (parentKey === 'finance') {
    fkCol = 'request_type';
    fkVal = (typeof currentRecord !== 'undefined' && currentRecord && (currentRecord.process_id || currentRecord.id || currentRecord.process)) || parentPkVal;
  }
  else if (parentKey === 'policy' || parentKey === 'opportunity_list') fkCol = 'request_type';
  else if (parentKey === 'assigned_task') {
    fkCol = 'task_id';
  }
  else if (['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(parentKey)) {
    fkCol = (childKey === 'assigned_task' || childKey === 'request_rating') ? 'request_id' : (childKey === 'expense' ? 'id__request' : 'request');
  }
  else if (parentKey === 'employee' || parentKey === 'employee_active') {
    if (childKey === 'request') fkCol = 'employee_related';
    else if (childKey === 'payment') fkCol = 'employee_related';
    else if (childKey === 'asset') fkCol = 'employee_related';
    else if (childKey === 'service') fkCol = 'employee_related';
  }
  else if (parentKey === 'ticket' || parentKey === 'support' || childKey === 'ticket_comment') {
    fkCol = 'ticket';
  }

  try {
    let data = [];
    let empOpts = [];

    let lastRes = null;
    const cacheKey = `${parentKey}_${parentPkVal}_${childKey}`;
    if (customData && Array.isArray(customData)) {
      data = sortChildRowsNewestFirst(childKey, [...customData]);
      empOpts = selectCache['employee'] || [];
    } else {
      if (parentKey === 'payment' && childKey === 'mtr' && (!fkVal || fkVal === 'null')) {
        data = [];
      } else if (childKey === 'opportunity_list' && parentPkVal === 'VIRTUAL_OPPORTUNITY') {
        const res = await apiGet('/policies');
        lastRes = res;
        const allPol = res.data && Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []);
        data = allPol.filter(r => (r.policy_name || '').toUpperCase().startsWith('OPPORTUNITY') && String(r.policy_id) !== 'VIRTUAL_OPPORTUNITY');
      } else if (childKey === 'comment' || childKey === 'ticket_comment') {
        // Fetch comment data; use employee cache if warm (instant), else render immediately
        // with email fallback and silently re-render names when employee data arrives
        let queryCol = fkCol;
        if (childKey === 'ticket_comment') queryCol = 'ticket';
        const url = (queryCol && fkVal)
          ? `${mod.endpoint}?${queryCol}=${fkVal}&slice=${normalizedParentKey}&summary=false&limit=1000`
          : `${mod.endpoint}?slice=${normalizedParentKey}&summary=false&limit=1000`;
        const res = await apiGet(url);
        lastRes = res;
        data = sortChildRowsNewestFirst(childKey, res.data && Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []));
        // Use cached employees immediately if available
        empOpts = selectCache['employee'] || [];
        // Kick off employee fetch in background if not cached
        if (!selectCache['employee']) {
          getSelectOptions('employee').then(opts => {
            empOpts = opts;
            // Re-render comment names once employees arrive (if container still exists)
            const cont = contentPane.querySelector(`#child-table-container-${childKey}`);
            if (cont && opts.length > 0) {
              loadChildTable(childKey, parentKey, parentPkVal);
            }
          }).catch(() => { });
        }
      } else {
        const url = (fkCol && fkVal)
          ? `${mod.endpoint}?${fkCol}=${fkVal}&slice=${normalizedParentKey}&summary=false&limit=1000`
          : `${mod.endpoint}?slice=${normalizedParentKey}&summary=false&limit=1000`;
        const res = await apiGet(url);
        lastRes = res;
        data = sortChildRowsNewestFirst(childKey, res.data && Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []));
      }
      window.childTableRawData = window.childTableRawData || {};
      window.childTableRawData[cacheKey] = data;
    }

    // Block rendering until lookups are prefetched to avoid showing raw IDs
    if (!customData) {
      await prefetchLookups(childKey, data).catch(e => console.warn('Prefetch warn:', e));
    }

    // Update count in tab header button and sum span
    const count = (lastRes && lastRes.meta && typeof lastRes.meta.total !== 'undefined' && !customData) ? lastRes.meta.total : data.length;
    if (!customData) {
      const tabBtn = contentPane.querySelector(`#tab-btn-${childKey}`);
      if (tabBtn) {
        // For Detail View 2: update the dedicated count badge span
        const countBadge = contentPane.querySelector(`#tab-count-${childKey}`);
        if (countBadge) {
          countBadge.textContent = count > 0 ? count : '';
        } else {
          const originalLabel = typeof t === 'function' ? t('module.' + childKey + '.title', mod.label) : mod.label;
          tabBtn.innerHTML = `${originalLabel} <span style="font-size:10px;opacity:0.8;background:rgba(255,255,255,0.15);padding:1px 5px;border-radius:10px;margin-left:4px;">${count}</span>`;
        }
      }
    }

    const sumSpan = contentPane.querySelector(`#child-sum-${childKey}`);
    if (sumSpan) {
      sumSpan.innerHTML = '';
    }

    if (childKey === 'contract' && data.length > 0) {
      const baseCurr = (typeof window.getActiveBaseCurrency === 'function' ? window.getActiveBaseCurrency() : 'VND') || 'VND';
      const groups = {};
      for (const item of data) {
        const type = item.type || 'Unknown';
        const baseVal = parseFloat(item.total_value_in_base_currency != null ? item.total_value_in_base_currency : (parseFloat(item.value_before_vat_in_base_currency || 0) + parseFloat(item.vat_value_in_base_currency || 0))) || ((parseFloat(item.value_before_vat) || 0) + (parseFloat(item.vat_value) || 0));

        if (!groups[type]) groups[type] = { count: 0, sum: 0 };
        groups[type].count++;
        groups[type].sum += baseVal;
      }

      let htmlParts = [];
      for (const [type, info] of Object.entries(groups)) {
        const isSelling = Number(type) === 69 || String(type).toLowerCase() === 'selling';
        const isBuying = Number(type) === 70 || String(type).toLowerCase() === 'buying';
        const color = isSelling ? '#047857' : (isBuying ? '#B91C1C' : '#475569');
        const typeDisplay = typeof t_val === 'function' ? t_val(type) : type;
        htmlParts.push(`<span style="white-space:nowrap; flex-shrink:0;">${typeDisplay}: <span style="color:${color}; font-weight:700;">${formatNumber(Math.round(info.sum))} ${baseCurr}</span> (${info.count} contracts)</span>`);
      }

      if (sumSpan && htmlParts.length > 0) {
        sumSpan.innerHTML = `<div style="display:flex; gap:8px; font-size:11px; color:#64748B; align-items:center; flex-wrap:nowrap;">${htmlParts.join('<span style="border-left: 1px solid #CBD5E1; height:10px; flex-shrink:0;"></span>')}</div>`;
      }
    }

    // Calculate sum for financial tables (payment, invoice, and expense summaries omitted per requirement)
    if (childKey === 'mtr' && data.length > 0) {
      const baseCurr = (typeof window.getActiveBaseCurrency === 'function' ? window.getActiveBaseCurrency() : 'VND') || 'VND';
      const total = data.reduce((acc, curr) => acc + (parseFloat(curr.amount_in_base_currency != null ? curr.amount_in_base_currency : curr.amount) || 0), 0);
      if (sumSpan) {
        sumSpan.innerHTML = `<span style="font-size:11px; color:#64748B; font-weight:400; white-space:nowrap; flex-shrink:0;">Total: <span style="color:#111827; font-weight:700;">${formatNumber(Math.round(total))} ${baseCurr}</span></span>`;
      }
    }

    // (Legacy grid fallback)
    const childTbody = contentPane.querySelector(`#tbody-${childKey}`);
    if (childTbody) {
      childTbody.innerHTML = buildTableRows(childKey, data);
    }

    if (childKey !== 'comment' && childKey !== 'ticket_comment' && data.length === 0) {
      const activeContainer = contentPane.querySelector(`#child-table-container-${childKey}`);
      if (activeContainer) activeContainer.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:11px;">${typeof t === 'function' ? t('detail.no_related', 'No related records found.') : 'No related records found.'}</div>`;
      return;
    }

    if (childKey === 'comment' || childKey === 'ticket_comment') {
      const activeContainer = contentPane.querySelector(`#child-table-container-${childKey}`) || container;
      if (activeContainer) {
        if (window.innerWidth <= 900) {
          activeContainer.style.setProperty('overflow', 'visible', 'important');
          activeContainer.style.display = 'block';
          activeContainer.style.removeProperty('flex-direction');
          activeContainer.style.removeProperty('height');
        } else {
          activeContainer.style.setProperty('overflow', 'hidden', 'important');
          activeContainer.style.setProperty('display', 'flex', 'important');
          activeContainer.style.setProperty('flex-direction', 'column', 'important');
          activeContainer.style.setProperty('height', '100%', 'important');
        }
      }
      window.inlineEmpOpts = empOpts;
      contentPane.selectedInlineTags = [];

      const empMap = {};
      empOpts.forEach(o => {
        if (o.email) empMap[o.email.toLowerCase()] = o.full_name || o.email.split('@')[0];
        if (o.employee_id) empMap[o.employee_id.toLowerCase()] = o.full_name || o.employee_id;
      });

      sortChildRowsNewestFirst(childKey, data);

      let html = `
        <style>
        .modern-tag-chip {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 4px 10px;
            border-radius: 16px;
            background: rgba(2, 132, 199, 0.1);
            color: #0284c7;
            font-size:10px;
            font-weight: 600;
            margin: 2px;
            border: 1px solid rgba(2, 132, 199, 0.2);
        }
        .modern-tag-chip .remove-btn {
            cursor: pointer;
            font-size:13px;
            font-weight: bold;
            opacity: 0.6;
            transition: opacity 0.2s;
        }
        .modern-tag-chip .remove-btn:hover {
            opacity: 1;
        }
        .tag-dropdown-item {
            padding: 8px 12px;
            cursor: pointer;
            font-size:11px;
            transition: background 0.2s;
            color: var(--text-primary);
            border-bottom: 1px solid var(--border-light);
        }
        .tag-dropdown-item:last-child {
            border-bottom: none;
        }
        .tag-dropdown-item:hover {
            background: var(--bg-hover);
        }
        .btn-send-modern {
            padding: 6px 14px;
            border-radius: 8px;
            font-size:10px;
            font-weight: 600;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .btn-send-modern:hover {
            transform: translateY(-1px);
        }
        .btn-send-modern:active {
            transform: scale(0.98);
        }
        .tag-search-input {
            width: 100%; height: 40px; border-radius: 8px; 
            padding: 8px 12px; font-size:13px; 
            border: 1px solid #E5E7EB; 
            background: #FFFFFF; 
            color: #111827; outline: none; 
            transition: all 0.2s ease;
            box-sizing: border-box;
        }
        .tag-search-input:focus {
            border-color: var(--accent);
        }
        .inline-comment-box {
            padding: 12px; 
            background: var(--bg-card); 
            border-top: 1px solid var(--border);
            border-radius: 0 0 12px 12px;
            box-shadow: 0 -4px 15px rgba(0,0,0,0.03);
            position: sticky;
            bottom: 0;
            z-index: 20;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        </style>
        <div class="comments-wrapper" style="display:flex; flex-direction:column; position:relative; background: var(--bg-default); width:100%; height:100%;">
      `;

      html += '<div class="comments-stream" style="padding: 12px; display:flex; flex-direction:column; gap:8px; flex:1; overflow-y:auto;">';
      if (data.length === 0) {
        html += `<div style="padding:40px 20px; text-align:center; color:var(--text-muted); font-size:11px; flex:1; display:flex; flex-direction:column; justify-content:center; align-items:center;">
           <span class="material-symbols-rounded" style="font-size:29px; opacity:0.5; margin-bottom:8px;">forum</span>
           <div>${typeof t === 'function' ? t('detail.no_related', 'No related records found.') : 'No related records found.'}</div>
         </div>`;
      } else {
        data.forEach(cmt => {
          const createdByKey = (cmt.created_by || '').toLowerCase();
          const commentByKey = (cmt.comment_by || '').toLowerCase();
          const empObj = empOpts.find(o =>
            (o.email && o.email.toLowerCase() === createdByKey) ||
            (o.employee_id && o.employee_id.toLowerCase() === createdByKey) ||
            (o.email && o.email.toLowerCase() === commentByKey) ||
            (o.employee_id && o.employee_id.toLowerCase() === commentByKey)
          );
          const authorName = empObj ? empObj.full_name : (empMap[createdByKey] || cmt.created_by || 'System');
          const authorInitial = authorName.substring(0, 1).toUpperCase();
          const date = formatDateTime(cmt.comment_date || cmt.created_date) || '';
          const content = escapeHTML(cmt.comment || '');
          let attachmentsHtml = '';
          if (cmt.file || cmt.link) {
            attachmentsHtml += `<div style="margin-top:10px; display:flex; flex-direction:column; gap:6px;">`;
            if (cmt.file) {
              let fileList = [];
              try {
                if (String(cmt.file).startsWith('[')) {
                  fileList = JSON.parse(cmt.file);
                } else {
                  fileList = String(cmt.file).split(',').map(s => s.trim()).filter(Boolean);
                }
              } catch (e) {
                fileList = [cmt.file];
              }
              fileList.forEach(fileStr => {
                const isImg = fileStr.startsWith('data:image') || /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(fileStr);
                if (isImg) {
                  attachmentsHtml += `<div style="border:1px solid var(--border); border-radius:6px; overflow:hidden; display:inline-block; max-width:100%; cursor:pointer;" onclick="const m=document.createElement('div');m.style.position='fixed';m.style.inset='0';m.style.background='rgba(0,0,0,0.8)';m.style.zIndex='9999';m.style.display='flex';m.style.alignItems='center';m.style.justifyContent='center';m.onclick=()=>m.remove();const i=document.createElement('img');i.src='${fileStr}';i.style.maxWidth='90%';i.style.maxHeight='90%';i.style.borderRadius='8px';m.appendChild(i);document.body.appendChild(m);"><img src="${fileStr}" style="width:100%; height:auto; display:block; max-height:200px; object-fit:contain;" title="Click to enlarge" /></div>`;
                } else {
                  const rawName = formatFileNameDisplay(fileStr);
                  const downloadFileName = escapeHTML(rawName);
                  attachmentsHtml += `<a href="${fileStr}" target="_blank" download="${downloadFileName}" style="display:inline-flex; align-items:center; gap:6px; padding:6px 12px; background:var(--bg-hover); border:1px solid var(--border); border-radius:6px; font-size:11px; color:var(--text); text-decoration:none;"><span class="material-symbols-rounded" style="font-size:14px;">attach_file</span> ${downloadFileName}</a>`;
                }
              });
            }
            if (cmt.link) {
              attachmentsHtml += `<a href="${cmt.link}" target="_blank" style="display:inline-flex; align-items:center; gap:6px; padding:6px 12px; background:var(--bg-hover); border:1px solid var(--border); border-radius:6px; font-size:10px; color:var(--accent); text-decoration:none; word-break:break-all;"><span class="material-symbols-rounded" style="font-size:13px;">link</span> ${escapeHTML(cmt.link)}</a>`;
            }
            attachmentsHtml += `</div>`;
          }

          let toTags = '';
          if (cmt.tag) {
            const toArr = Array.isArray(cmt.tag) ? cmt.tag : (typeof cmt.tag === 'string' ? cmt.tag.split(',') : []);
            if (toArr.length > 0) {
              const tagHtml = toArr.map(email => {
                const cleanEmail = email.trim();
                const dispName = empMap[cleanEmail.toLowerCase()] || cleanEmail.split('@')[0];
                return `<span style="display:inline-block; padding:2px 8px; background:rgba(2, 132, 199, 0.1); color:#0284c7; border-radius:12px; font-size:8px; font-weight:700; margin-right:4px;">@${escapeHTML(dispName)}</span>`;
              }).join('');
              toTags = `<div style="margin-bottom:8px; display:flex; align-items:center; flex-wrap:wrap;">${tagHtml}</div>`;
            }
          }

          const isMyComment = (typeof authUser !== 'undefined' && (
            (authUser.email && authUser.email.toLowerCase() === (cmt.created_by || '').toLowerCase()) ||
            (authUser.employee_id && authUser.employee_id.toLowerCase() === (cmt.created_by || '').toLowerCase()) ||
            (authUser.email && authUser.email.toLowerCase() === (cmt.comment_by || '').toLowerCase()) ||
            (authUser.employee_id && authUser.employee_id.toLowerCase() === (cmt.comment_by || '').toLowerCase())
          ));

          const formattedDate = formatDateTime(cmt.comment_date || cmt.created_date) || date;

          const requesterEmail = currentRecord ? (currentRecord.requester || currentRecord.sr_creater || currentRecord.created_by) : null;
          const isDevComment = (childKey === 'ticket_comment') && (
            (cmt.created_by === 'IT support' || cmt.comment_by === 'IT support') ||
            (cmt.logs && cmt.logs.origin === 'helpdesk') ||
            (requesterEmail && cmt.created_by !== requesterEmail && cmt.comment_by !== requesterEmail)
          );
          const displayAuthorInitial = (authorName === 'IT support') ? 'IT' : authorInitial;
          const cardBg = (childKey === 'ticket_comment') ? (isDevComment ? '#FFEDD5' : '#F8FAFC') : '#FFFFFF';
          const cardBorder = (childKey === 'ticket_comment') ? (isDevComment ? '#FDBA74' : '#E2E8F0') : '#E5E7EB';
          const cardAlign = (childKey === 'ticket_comment') ? (isDevComment ? 'flex-end' : 'flex-start') : 'flex-start';
          const cardWidth = (childKey === 'ticket_comment') ? 'fit-content' : '100%';
          const cardMinWidth = (childKey === 'ticket_comment') ? '320px' : 'none';
          const cardMaxWidth = (childKey === 'ticket_comment') ? '85%' : '100%';
          const cardPadding = (childKey === 'ticket_comment') ? '12px 16px' : '16px';
          const cardShadow = (childKey === 'ticket_comment') ? '0 1px 2px rgba(0,0,0,0.04)' : 'none';

          const authorEmail = empObj ? empObj.email : (cmt.created_by && cmt.created_by.includes('@') ? cmt.created_by : '');
          const replyTagVal = authorEmail || cmt.comment_by || cmt.created_by || authorName;

          html += `
              <div class="comment-card ${isMyComment ? 'my-comment' : ''}" data-comment-id="${cmt.comment_id}" style="margin-bottom:8px; background:${cardBg}; padding:${cardPadding}; border-radius:12px; border:1px solid ${cardBorder}; box-shadow:${cardShadow}; max-width:${cardMaxWidth}; align-self:${cardAlign}; width:${cardWidth}; min-width:${cardMinWidth};">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px; gap:20px;">
                  <div style="display:flex; align-items:center; gap:10px;">
                    <div style="width:32px; height:32px; border-radius:50%; background:#F97316; color:#fff; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700; flex-shrink:0; letter-spacing:0.5px;">${displayAuthorInitial}</div>
                    <div style="display:flex; flex-direction:column; gap:1px;">
                      <span style="font-size:13px; font-weight:600; color:#111827; line-height:1.3;">${escapeHTML(authorName)}</span>
                      <span style="font-size:11px; color:#9CA3AF; font-weight:400;">${formattedDate}</span>
                    </div>
                  </div>
                  <div style="display:flex; gap:4px; margin-top:2px;">
                    <button style="padding:3px 6px; border:none; background:transparent; cursor:pointer; color:#9CA3AF; border-radius:4px; transition:color 0.2s;" onmouseover="this.style.color='#6B7280'" onmouseout="this.style.color='#9CA3AF'" onclick="window.replyToComment(this, '${escapeHTML(replyTagVal)}', '${cmt.comment_id}', '${parentKey}', '${parentPkVal}')" title="${t('btn.reply', 'Reply')}"><span class="material-symbols-rounded" style="font-size:16px;">reply</span></button>
                    ${isMyComment ? `<button style="padding:3px 6px; border:none; background:transparent; cursor:pointer; color:#9CA3AF; border-radius:4px; transition:color 0.2s;" onmouseover="this.style.color='#EF4444'" onmouseout="this.style.color='#9CA3AF'" onclick="confirmDelete('${childKey}', '${cmt.comment_id}', t('msg.this_comment', 'this comment'))" title="${t('btn.delete', 'Delete')}"><span class="material-symbols-rounded" style="font-size:16px;">delete</span></button>` : ''}
                  </div>
                </div>
                ${toTags}
                <div style="font-size:13px; color:#374151; line-height:1.6; white-space:pre-wrap; padding-left:42px;">${content}</div>
                ${attachmentsHtml}
              </div>
            `;
        });
      }
      html += '</div>'; // End comments-stream

      // Render the sticky comment form at the bottom
      html += `
        <div class="inline-comment-box" style="padding: 16px; background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.02); position: sticky; bottom: 0; z-index: 20; display: flex; flex-direction: column; gap: 12px; margin-top: 12px;">
           <!-- Tag Section -->
           <div style="display:flex; flex-direction:column; position:relative; gap:6px; margin-bottom: 2px;">
              <div style="display:flex; align-items:center; gap:6px; color:#475569; font-size:12px; font-weight:600;">
                 <span class="material-symbols-rounded" style="font-size:15px; color:#9CA3AF;">sell</span>
                 <span>${typeof t === 'function' ? t('msg.tag_people', 'Tag People') : 'Tag People'}</span>
              </div>
              
              <!-- Chips container -->
              <div id="selected-tags-chips" style="display:flex; flex-wrap:wrap; gap:4px; margin-bottom: 2px;"></div>
              
              <div style="position:relative; width:100%;">
                <input type="text" id="tag-search-input" class="tag-search-input" placeholder="Type name or email to tag..." oninput="window.filterInlineTags(this)" onfocus="window.filterInlineTags(this)">
                <!-- Dropdown menu -->
                <div id="tag-search-dropdown" style="display:none; position:absolute; left:0; right:0; bottom:100%; margin-bottom:4px; max-height:150px; overflow-y:auto; background:#FFFFFF; border:1px solid #E5E7EB; border-radius:6px; box-shadow:0 4px 6px -1px rgba(0,0,0,0.1); z-index:100;"></div>
              </div>
           </div>

           <!-- Textarea -->
           <textarea id="inline-comment-text" style="width:100%; min-height:96px; padding:12px; resize:none; font-size:13px; border-radius:8px; border:1px solid #E5E7EB; background:#FFFFFF; color:#111827; font-family:inherit; outline:none; transition:border-color 0.2s; line-height:1.5; box-sizing:border-box;" placeholder="${t('msg.write_comment', 'Write a comment...')}" onfocusin="this.style.borderColor='#F97316'" onfocusout="this.style.borderColor='#E5E7EB'"></textarea>
           
           <!-- Actions Row -->
           <div style="display:flex; gap:8px; align-items:center; justify-content:space-between; flex-wrap:wrap;">
              <div style="display:flex; gap:8px; align-items:center;">
                 <input type="file" id="inline-comment-file" style="display:none;" onchange="window.handleInlineFileChange(this)">
                 <button onclick="this.closest('.inline-comment-box').querySelector('#inline-comment-file').click()" style="display:inline-flex; align-items:center; gap:5px; padding:8px 16px; height:40px; border:1px solid #E5E7EB; border-radius:8px; background:#FFFFFF; color:#475569; font-size:13px; font-weight:500; cursor:pointer; font-family:inherit; transition:all 0.2s; white-space:nowrap; box-sizing:border-box;" onmouseover="this.style.borderColor='#F97316'; this.style.color='#F97316';" onmouseout="this.style.borderColor='#E5E7EB'; this.style.color='#475569';"><span class="material-symbols-rounded" style="font-size:15px;">attach_file</span>${t('btn.attach_file', 'Attach File')}</button>
                 <input type="hidden" id="inline-comment-file-b64">
                 <span id="inline-file-name" style="font-size:11px; color:#9CA3AF; max-width:100px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"></span>
                 <button onclick="const r=this.closest('.inline-comment-box').querySelector('#inline-link-row'); r.style.display = r.style.display==='none'?'flex':'none';" style="display:inline-flex; align-items:center; gap:5px; padding:8px 16px; height:40px; border:1px solid #E5E7EB; border-radius:8px; background:#FFFFFF; color:#475569; font-size:13px; font-weight:500; cursor:pointer; font-family:inherit; transition:all 0.2s; white-space:nowrap; box-sizing:border-box;" onmouseover="this.style.borderColor='#F97316'; this.style.color='#F97316';" onmouseout="this.style.borderColor='#E5E7EB'; this.style.color='#475569';"><span class="material-symbols-rounded" style="font-size:15px;">link</span>Attached Link</button>
              </div>
              <button onclick="window.submitInlineComment(this, '${parentKey}', '${parentPkVal}', '${childKey}')" style="display:inline-flex; align-items:center; gap:6px; padding:8px 20px; height:40px; border:none; border-radius:8px; background:#F97316; color:#FFFFFF; font-size:14px; font-weight:600; cursor:pointer; font-family:inherit; transition:background 0.2s; flex-shrink:0; box-sizing:border-box;" onmouseover="this.style.background='#EA580C'" onmouseout="this.style.background='#F97316'">${typeof t === 'function' ? t('btn.send', 'Send') : 'Send'} <span class="material-symbols-rounded" style="font-size:15px;">send</span></button>
           </div>
           <!-- Link input row (hidden by default) -->
           <div id="inline-link-row" style="display:none; align-items:center; gap:8px;">
             <span class="material-symbols-rounded" style="font-size:15px; color:#9CA3AF;">link</span>
             <input type="text" id="inline-comment-link" style="flex:1; height:34px; border:1px solid #E5E7EB; border-radius:6px; padding:4px 12px; font-size:12px; background:#FFFFFF; color:#111827; font-family:inherit; outline:none;" placeholder="🔗 ${t('msg.attached_link', 'Paste a link...')}">
           </div>
        </div>
      `;
      html += '</div>'; // End flex container
      const activeContainerComment = contentPane.querySelector(`#child-table-container-${childKey}`) || container;
      if (activeContainerComment) {
        activeContainerComment.innerHTML = html;
        const box = activeContainerComment.querySelector('.inline-comment-box');
        if (box) box.selectedInlineTags = [];
        setTimeout(() => {
          const stream = activeContainerComment.querySelector('.comments-stream');
          if (stream) stream.scrollTop = stream.scrollHeight;
        }, 50);
      }

      // Handlers are defined globally
    } else {
      const isDetail2 = ['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team', 'payment', 'asset', 'account', 'service', 'employee', 'request', 'contract'].includes(parentKey);
      let html = '';
      if (data.length === 0) {
        html = isDetail2 ? `
             <div style="text-align:center; padding:32px 16px; background:#F8FAFC; border-radius:12px; border:1px dashed #E2E8F0; margin:8px 0;">
               <span class="material-symbols-rounded" style="font-size:29px; color:#94A3B8; margin-bottom:8px; opacity:0.6;">receipt_long</span>
               <div style="font-size:12px; color:#64748B;">${t('detail.no_records', 'No records found.')}</div>
             </div>
           ` : `
             <div style="text-align:center; padding:32px 16px; background:var(--bg-hover); border-radius:12px; border:1px dashed var(--border-light); margin:8px 0;">
               <span class="material-symbols-rounded" style="font-size:29px; color:var(--text-muted); margin-bottom:8px; opacity:0.6;">receipt_long</span>
               <div style="font-size:12px; color:var(--text-secondary);">${t('detail.no_records', 'No records found.')}</div>
             </div>
           `;
      } else {
        let cols = mod.columns.filter(c => !c.hidden);
        if (childKey === 'mtr' && parentKey === 'account') {
          cols = [
            { key: 'transaction_date', label: 'Transaction Date' },
            { key: 'description', label: 'Description' },
            { key: 'transaction_type', label: 'Transaction Type' },
            { key: 'amount', label: 'Amount' },
            { key: 'exchange_rate', label: 'Exchange Rate' },
            { key: 'currency', label: 'Currency' },
            { key: 'note', label: 'Note' }
          ];
        }

        if (['request', 'my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team', 'contract'].includes(parentKey)) {
          cols = cols.filter(c => c.key !== 'request');
        }

        if (isDetail2) {
          const hashModule = window.location.hash.replace('#', '').split('/')[0];
          const effectiveParentKey = (['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(hashModule))
            ? hashModule
            : (['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(parentKey) ? parentKey : (['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(currentModule) ? currentModule : parentKey));
          const isReqParent = ['request', 'my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(effectiveParentKey)
            || ['request', 'my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(parentKey);
          const allowChildActions = !['logs', 'request_activity_log', 'history', 'finance'].includes(childKey) && (isReqParent
            ? isChildTableActionAllowed(childKey, 'edit', effectiveParentKey)
            : (parentKey === 'contract' ? ['payment', 'invoice'].includes(childKey) : (parentKey === 'account' ? childKey === 'mtr' : (parentKey === 'my_company' ? true : (parentKey === 'company' ? (childKey === 'contact' && isChildTableActionAllowed(childKey, 'edit', parentKey)) : false)))));

          html = `
                 <style>
                   .child-table-row:hover {
                     background-color: #F8FAFC !important;
                   }
                 </style>
                 <div class="table-responsive" style="margin: 0; overflow-x: auto; width:100%; border: none; border-radius: 0; background: transparent; box-shadow: none;">
                   <table class="table modern-table" style="width: 100%; min-width: max-content; border-collapse: collapse; margin: 0;">
                     <thead>
                       <tr style="border-bottom: 1px solid #E2E8F0; background: #F8FAFC;">
                         ${allowChildActions ? `<th style="padding: 12px 14px; text-align: center; font-size:11px; font-weight: 600; text-transform: uppercase; color: #64748B; letter-spacing: 0.5px; white-space: nowrap; width: 50px;">${t('col.actions', 'Actions')}</th>` : ''}
                         ${cols.map(c => `<th style="padding: 12px 14px; text-align: left; font-size:11px; font-weight: 600; text-transform: uppercase; color: #64748B; letter-spacing: 0.5px; white-space: nowrap;">${escapeHTML(t(c.labelKey || ('col.' + c.key), c.label))}</th>`).join('')}
                       </tr>
                     </thead>
                     <tbody>
                       ${data.map(row => {
              const pkVal = row[mod.pk];
              const resolvedRow = { ...row };
              if (childKey === 'contract') {
                resolvedRow.total_value = (parseFloat(row.value_before_vat) || 0) + (parseFloat(row.vat_value) || 0);
              }
              cols.forEach(c => {
                const virtualVal = typeof resolveVirtualColumn === 'function' ? resolveVirtualColumn(childKey, c.key, row) : undefined;
                if (virtualVal !== undefined) {
                  resolvedRow[c.key] = virtualVal;
                } else {
                  resolvedRow[c.key] = resolveLookupValue(childKey, c.key, resolvedRow[c.key]);
                }
              });
              const rowClickTarget = childKey === 'opportunity_list' ? 'policy' : childKey;
              const rowOnClick = `window.location.hash = '${rowClickTarget}/${pkVal}'`;
              return `
                           <tr onclick="${rowOnClick}" style="cursor: pointer; border-bottom: 1px solid #F1F5F9; transition: background 0.15s;" class="child-table-row">
                             ${allowChildActions ? `
                               ${['payment', 'contract', 'invoice', 'mtr', 'expense', 'asset', 'service'].includes(childKey) ? `
                                <td style="padding: 6px 14px; text-align: center;" onclick="event.stopPropagation();">
                                  <button type="button" class="row-action-menu-btn" title="Quick actions" onclick="toggleRowActionMenu('${childKey}', '${pkVal}', this, event)">
                                    <span class="material-symbols-rounded" style="font-size:18px; pointer-events:none; color: #64748B;">more_vert</span>
                                  </button>
                                </td>
                              ` : (!['logs', 'request_activity_log', 'history', 'request_rating', 'rating', 'feedback', 'comment', 'ticket_comment', 'finance', 'assigned_task'].includes(childKey) && isChildTableActionAllowed(childKey, 'duplicate', parentKey)) ? `
                               <td style="padding: 6px 14px; text-align: center; white-space: nowrap;" onclick="event.stopPropagation();">
                                 <button type="button" class="btn btn-outline btn-sm" onclick="event.stopPropagation(); duplicateRecord('${childKey}', '${pkVal}')" title="Copy / Duplicate" style="display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; padding: 0; border: 1px solid #E5E7EB; border-radius: 6px; background: #FFFFFF; color: #475569; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.borderColor='var(--accent)'; this.style.color='var(--accent)'" onmouseout="this.style.borderColor='#E5E7EB'; this.style.color='#475569'">
                                   <span class="material-symbols-rounded" style="font-size: 16px;">content_copy</span>
                                 </button>
                               </td>
                             ` : ''}
                             ` : ''}
                             ${cols.map((c, colIdx) => {
                let val = resolvedRow[c.key];
                if (val === null || val === undefined) val = '';
                const k = String(c.key).toLowerCase();
                const l = String(c.label).toLowerCase();
                let displayVal = String(val);

                const isRequestChild = ['request', 'my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(childKey);
                if (isRequestChild && (c.type === 'date' || c.type === 'datetime' || ['date', 'due_date', 'payment_date', 'start_date', 'end_date', 'purchase_date', 'contract_signed_date', 'transaction_date', 'invoice_date', 'close_date', 'create_date', 'request_date'].includes(c.key) || c.key === 'log_time' || c.key === 'created_date' || c.key === 'updated_date' || k.endsWith('_date') || k.includes('date') || l.includes('date') || (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}/)))) {
                  displayVal = formatDateTime(val);
                } else if (['date', 'due_date', 'payment_date', 'start_date', 'end_date', 'purchase_date', 'contract_signed_date', 'transaction_date', 'invoice_date', 'close_date', 'create_date', 'request_date'].includes(c.key) || c.type === 'date' || l === 'date' || l === 'transaction date' || (l.includes('date') && !['log_time', 'created_date', 'updated_date'].includes(c.key))) {
                  displayVal = formatDateMON(val);
                } else if (c.key === 'log_time' || c.key === 'created_date' || c.key === 'updated_date') {
                  displayVal = formatDateTime(val);
                } else if (k.endsWith('_date') || l.includes('date') || (typeof val === 'string' && val.match(/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}/))) {
                  displayVal = formatDateTime(val);
                } else if (k.includes('rate')) {
                  displayVal = formatExchangeRate(val);
                } else if ((k.includes('amount') || k.includes('price') || k.includes('cost') || k.includes('total') || k.includes('budget') || k.includes('tax') || k.includes('value') || k.includes('balance') || isNumericFieldKey(c.key, c.type)) && !k.includes('type')) {
                  if (childKey === 'finance' && (val === 0 || val === '0' || parseFloat(val) === 0 || val === '')) {
                    displayVal = '';
                  } else {
                    displayVal = formatNumber(val);
                  }
                }

                if ((c.key === 'point' || c.key === 'rating_point') && (childKey === 'request_rating' || childKey === 'rating')) {
                  const pointVal = parseInt(val) || 0;
                  let starsHTML = '';
                  for (let i = 1; i <= 5; i++) {
                    const starColor = i <= pointVal ? '#EAB308' : '#D1D5DB';
                    starsHTML += `<span class="material-symbols-rounded" style="font-size:16px; color:${starColor}; vertical-align:middle; line-height:1;">star</span>`;
                  }
                  const cellContent = `${starsHTML} <span style="font-size:11px; color:#64748B; font-weight:600; margin-left:4px; vertical-align:middle;">(${pointVal})</span>`;
                  return `<td style="padding: 12px 14px; font-size: 13px; color: #334155; white-space: nowrap;">${cellContent}</td>`;
                }

                let cellContentHTML = '';
                if ((c.badge || ['status', 'payment_status', 'invoice_status', 'sr_status', 'process_status', 'account_status', 'payment_type'].includes(c.key)) && val !== undefined && val !== null && val !== '') {
                  let translatedVal = (typeof t_val === 'function') ? t_val(val) : String(val);
                  if (c.key === 'payment_type') {
                    if (val === '60' || Number(val) === 60 || String(val).toLowerCase() === 'incoming') translatedVal = (typeof t === 'function' ? t('status.incoming', 'Incoming') : 'Incoming');
                    else if (val === '61' || Number(val) === 61 || String(val).toLowerCase() === 'outgoing') translatedVal = (typeof t === 'function' ? t('status.outgoing', 'Outgoing') : 'Outgoing');
                  }
                  cellContentHTML = escapeHTML(translatedVal);
                } else {
                  const display = displayVal.length > 80 ? displayVal.substring(0, 78) + '…' : displayVal;
                  cellContentHTML = escapeHTML(display);
                }

                if (colIdx === 0) {
                  cellContentHTML = `<span style="font-weight: 600; color: #1E293B;">${cellContentHTML}</span>`;
                }

                return `<td style="padding: 12px 14px; font-size: 13px; color: #334155; white-space: nowrap;" title="${escapeHTML(displayVal)}">${cellContentHTML}</td>`;
              }).join('')}
                           </tr>
                         `;
            }).join('')}
                     </tbody>
                   </table>
                 </div>
               `;
        } else {
          html = `
                 <style>
                   .child-table-row:hover {
                     background-color: var(--bg-hover) !important;
                   }
                 </style>
                 <div class="table-responsive" style="margin: 8px 0; overflow-x: auto; width:100%; border: 1px solid var(--border); border-radius: 12px; background: var(--bg-card);">
                   <table class="table modern-table" style="width: 100%; border-collapse: collapse; margin: 0;">
                     <thead>
                       <tr style="border-bottom: 1px solid var(--border);">
                         ${cols.map(c => `<th style="padding: 10px 14px; text-align: left; font-size:10px; font-weight: 600; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.5px; white-space: nowrap;">${escapeHTML(t('col.' + c.key, c.label))}</th>`).join('')}
                       </tr>
                     </thead>
                     <tbody>
                       ${data.map(row => {
            const pkVal = row[mod.pk];
            const resolvedRow = { ...row };
            if (childKey === 'contract') {
              resolvedRow.total_value = (parseFloat(row.value_before_vat) || 0) + (parseFloat(row.vat_value) || 0);
            }
            cols.forEach(c => {
              const virtualVal = typeof resolveVirtualColumn === 'function' ? resolveVirtualColumn(childKey, c.key, row) : undefined;
              if (virtualVal !== undefined) {
                resolvedRow[c.key] = virtualVal;
              } else {
                resolvedRow[c.key] = resolveLookupValue(childKey, c.key, row[c.key]);
              }
            });

            const rowClickTarget = childKey === 'opportunity_list' ? 'policy' : childKey;

            return `
                           <tr onclick="window.location.hash = '${rowClickTarget}/${pkVal}'" style="cursor: pointer; border-bottom: 1px solid var(--border-light); transition: background 0.15s;" class="child-table-row">

                             ${cols.map(c => {
              let val = resolvedRow[c.key];
              if (val === null || val === undefined) val = '';
              const k = String(c.key).toLowerCase();
              const l = String(c.label).toLowerCase();
              let displayVal = String(val);

              const isRequestChild = ['request', 'my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(childKey);
              if (isRequestChild && (c.type === 'date' || c.type === 'datetime' || ['date', 'due_date', 'payment_date', 'start_date', 'end_date', 'purchase_date', 'contract_signed_date', 'transaction_date', 'invoice_date', 'close_date', 'create_date', 'request_date'].includes(c.key) || c.key === 'log_time' || c.key === 'created_date' || c.key === 'updated_date' || k.endsWith('_date') || k.includes('date') || l.includes('date') || (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}/)))) {
                displayVal = formatDateTime(val);
              } else if (['date', 'due_date', 'payment_date', 'start_date', 'end_date', 'purchase_date', 'contract_signed_date', 'transaction_date', 'invoice_date', 'close_date', 'create_date', 'request_date'].includes(c.key) || c.type === 'date' || l === 'date' || l === 'transaction date' || (l.includes('date') && !['log_time', 'created_date', 'updated_date'].includes(c.key))) {
                displayVal = formatDateMON(val);
              } else if (c.key === 'log_time' || c.key === 'created_date' || c.key === 'updated_date') {
                displayVal = formatDateTime(val);
              } else if (k.endsWith('_date') || l.includes('date') || (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/))) {
                displayVal = formatDateTime(val);
              } else if (k.includes('rate')) {
                displayVal = formatExchangeRate(val);
              } else if ((k.includes('amount') || k.includes('price') || k.includes('cost') || k.includes('total') || k.includes('budget') || k.includes('tax') || k.includes('value') || k.includes('balance') || isNumericFieldKey(c.key, c.type)) && !k.includes('type')) {
                if (childKey === 'finance' && (val === 0 || val === '0' || parseFloat(val) === 0 || val === '')) {
                  displayVal = '';
                } else {
                  displayVal = formatNumber(val);
                }
              }

              if ((c.badge || ['status', 'payment_status', 'invoice_status', 'sr_status', 'process_status', 'account_status', 'payment_type'].includes(c.key)) && val !== undefined && val !== null && val !== '') {
                let translatedVal = (typeof t_val === 'function') ? t_val(val) : String(val);
                if (c.key === 'payment_type') {
                  if (val === '60' || Number(val) === 60 || String(val).toLowerCase() === 'incoming') translatedVal = (typeof t === 'function' ? t('status.incoming', 'Incoming') : 'Incoming');
                  else if (val === '61' || Number(val) === 61 || String(val).toLowerCase() === 'outgoing') translatedVal = (typeof t === 'function' ? t('status.outgoing', 'Outgoing') : 'Outgoing');
                }
                return `<td style="padding: 10px 14px; font-size:12px; color: var(--text-primary); white-space: nowrap;">${escapeHTML(translatedVal)}</td>`;
              }

              const display = displayVal.length > 80 ? displayVal.substring(0, 78) + '…' : displayVal;
              return `<td style="padding: 10px 14px; font-size:12px; color: var(--text-primary); white-space: nowrap;" title="${escapeHTML(displayVal)}">${escapeHTML(display)}</td>`;
            }).join('')}
                           </tr>
                         `;
          }).join('')}
                     </tbody>
                   </table>
                 </div>
               `;
        }
      }
      const activeContainer = contentPane.querySelector(`#child-table-container-${childKey}`) || container;
      if (activeContainer) {
        activeContainer.innerHTML = html;
        applyChildTablePagination(activeContainer, childKey);
      }
    }
  } catch (err) {
    const activeContainer = contentPane.querySelector(`#child-table-container-${childKey}`) || container;
    if (activeContainer) activeContainer.innerHTML = `<div style="padding:20px;text-align:center;color:#ef4444;font-size:12px;">${t('detail.failed_load', 'Failed to load records:')} ${err.message}</div>`;
  }
}


window.loadChildTable = loadChildTable;
window.clearChildTableCache = clearChildTableCache;
window.renderChildCardHTML = renderChildCardHTML;
window.normalizeRequestParentKey = normalizeRequestParentKey;
window.sortChildRowsNewestFirst = sortChildRowsNewestFirst;
window.markReportPanesDirty = markReportPanesDirty;
