/**
 * CRC App - Real-Time Sync Service
 * Extracted as part of Modularization
 */

const IDLE_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes idle timeout

function markUserActive() {
  if (isUserIdle) {
    isUserIdle = false;
    console.log('[Sync] User active again');
    updateSyncStatus(typeof t === 'function' ? t('sync.connected', 'Live connected') : 'Live connected');
    if (hasPendingRealtimeUpdate) {
      triggerCatchUpRefresh();
    }
  }
  clearTimeout(userIdleTimer);
  userIdleTimer = setTimeout(() => {
    isUserIdle = true;
    console.log('[Sync] User idle due to inactivity (>3m)');
    updateSyncStatus(typeof t === 'function' ? t('sync.idle', 'Live paused (Idle)') : 'Live paused (Idle)', false, '#f59e0b');
  }, IDLE_TIMEOUT_MS);
}

// User activity listeners
['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach(evt => {
  window.addEventListener(evt, markUserActive, { passive: true });
});

// Tab visibility listener
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    isTabVisible = false;
    console.log('[Sync] Tab hidden: pausing live UI updates');
    updateSyncStatus(typeof t === 'function' ? t('sync.tab_hidden', 'Live paused (Tab hidden)') : 'Live paused (Tab hidden)', false, '#9ca3af');
  } else {
    isTabVisible = true;
    console.log('[Sync] Tab visible again');
    markUserActive();
    if (hasPendingRealtimeUpdate) {
      triggerCatchUpRefresh();
    }
  }
});

function triggerCatchUpRefresh() {
  hasPendingRealtimeUpdate = false;
  console.log('[Sync] Executing catch-up refresh after idle/hidden...');
  if (currentView === 'table') {
    refreshTableData(currentModule, true).catch(() => { });
  } else if (currentView === 'detail' && currentRecord) {
    const actualModule = (['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(currentModule)) ? 'request' : currentModule;
    const mod = MODULES[actualModule];
    const pkField = mod ? mod.pk : null;
    if (pkField && currentRecord[pkField]) {
      openDetailInternal(currentModule, currentRecord[pkField], true, true).catch(() => { });
    }
  } else if (currentView === 'dashboard') {
    const meta = DASHBOARD_META[currentModule];
    if (meta) {
      apiGet(`/my-views/${meta.apiPath}`).then(res => {
        dashboardData = res.data || [];
        applyDashboardFilters(currentModule);
      }).catch(() => { });
    }
  }
}

function startAutoSync() {
  if (window.evtSource) window.evtSource.close();
  const token = localStorage.getItem('crc_token');
  if (!token) return;

  window.evtSource = new EventSource('/api/stream?token=' + encodeURIComponent(token));

  window.evtSource.onopen = () => {
    markUserActive();
    updateSyncStatus(t('sync.connected', 'Live connected'));
  };

  window.evtSource.onerror = () => {
    updateSyncStatus(t('sync.offline', 'Live sync offline'), true);
    window.evtSource.close();
    setTimeout(startAutoSync, 5000);
  };

  window.evtSource.addEventListener('db_change', (e) => {
    try {
      const payload = JSON.parse(e.data);
      handleRealTimeUpdate(payload);
    } catch (err) {
      console.error(err);
    }
  });
}

function handleRealTimeUpdate(payload) {
  const { action, table, record, id } = payload;
  if (!record) return;

  // If Tab is hidden or User is idle: skip UI re-rendering and set pending flag
  if (!isTabVisible || isUserIdle) {
    hasPendingRealtimeUpdate = true;
    console.log('[Sync] Realtime change received while tab is hidden/idle. Queued for catch-up.');
    return;
  }

  // Gently notify user of update
  lastSyncTime = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const timeStr = `${pad(lastSyncTime.getHours())}:${pad(lastSyncTime.getMinutes())}:${pad(lastSyncTime.getSeconds())}`;
  updateSyncStatus(`${t('sync.synced_at', 'Live synced at')} ${timeStr}`);

  // Handle Comment Stream (Smooth UI Injection)
  if ((table === 'comment' || table === 'ticket_comment') && action === 'insert') {
    const parentId = record.ticket || record.request; // ID of the parent request/ticket

    // Resolve the actual module because currentModule might be a dashboard view (e.g. 'my_request')
    const actualModule = (['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(currentModule)) ? 'request' : currentModule;
    const pkField = MODULES[actualModule] ? MODULES[actualModule].pk : null;

    if (currentView === 'detail' && currentRecord && pkField && String(currentRecord[pkField]) === String(parentId)) {
      loadChildTable(table, currentModule, parentId);
    }
  } else {
    // 1. Clear lookup caches if a setting table changes
    const tableToModule = {
      my_company: 'my_company',
      department: 'department',
      employee: 'employee',
      policy_and_program: 'policy',
      company: 'company',
      operation_program: 'operation_program',
      account: 'account',
      contact: 'contact'
    };
    const cacheKey = tableToModule[table] || table;
    const settingTables = ['employee', 'department', 'my_company', 'policy', 'company', 'operation_program', 'account', 'contact'];
    if (settingTables.includes(cacheKey)) {
      delete selectCache[cacheKey];
      if (cacheKey === 'account') {
        delete selectCache['account_currency'];
      }
      for (const k of Object.keys(selectCache)) {
        if (k.startsWith(`${cacheKey}_index_`)) {
          delete selectCache[k];
        }
      }
      // Silently prefetch in background to update lookups and refresh view
      prefetchLookups(currentModule).then(() => {
        if (currentView === 'table' && document.getElementById(`tbody-${currentModule}`)) {
          document.getElementById(`tbody-${currentModule}`).innerHTML = buildTableRows(currentModule, currentData);
        } else if (currentView === 'detail' && currentRecord) {
          if (!document.querySelector('.modal-overlay.open')) {
            const actualModule = (['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(currentModule)) ? 'request' : currentModule;
            const mod = MODULES[actualModule];
            const pkField = mod ? mod.pk : null;
            if (pkField && currentRecord[pkField]) {
              const activeEl = document.activeElement;
              if (!(activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT' || activeEl.isContentEditable))) {
                openDetailInternal(currentModule, currentRecord[pkField], true, true);
              }
            }
          }
        }
      }).catch(err => console.warn('[Sync] Prefetch lookups failed:', err));
    }

    // Map current active module to its underlying database write table
    const targetTable = (MODULES[currentModule] && MODULES[currentModule].writeTable)
      ? MODULES[currentModule].writeTable
      : (['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(currentModule) ? 'request' : currentModule);

    const actualModule = (['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(currentModule)) ? 'request' : currentModule;
    const mod = MODULES[actualModule];
    const isChildTable = mod && mod.children && mod.children.includes(table);

    if (targetTable === table || (currentView === 'detail' && isChildTable)) {
      if (currentView === 'table' && targetTable === table) {
        // Debounce table refreshes when bulk updates occur rapidly
        if (!document.querySelector('.modal-overlay.open')) {
          if (realTimeDebounceTimer) clearTimeout(realTimeDebounceTimer);
          realTimeDebounceTimer = setTimeout(() => {
            refreshTableData(currentModule, true);
          }, 600);
        }
      } else if (currentView === 'detail' && currentRecord) {
        const pkField = mod ? mod.pk : null;
        let isMatch = false;
        if (targetTable === table) {
          isMatch = record && pkField && String(record[pkField]) === String(currentRecord[pkField]);
        } else if (isChildTable) {
          const parentRef = record.request || record.parent_id || record[actualModule] || record[actualModule + '_id'] || record.contract_id || record.contract;
          isMatch = parentRef && pkField && String(parentRef) === String(currentRecord[pkField]);
        }
        if (isMatch) {
          if (isChildTable && typeof clearChildTableCache === 'function') {
            clearChildTableCache(table, currentModule, currentRecord[pkField]);
          }
          // Gently refresh detail view if user is not typing
          const activeEl = document.activeElement;
          if (!(activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT' || activeEl.isContentEditable))) {
            openDetailInternal(currentModule, currentRecord[pkField], true, true);
          }
        }
      } else if (currentView === 'dashboard' && targetTable === table) {
        // Silently refresh dashboard view to prevent losing filters or page position
        const meta = DASHBOARD_META[currentModule];
        if (meta) {
          apiGet(`/my-views/${meta.apiPath}`).then(res => {
            dashboardData = res.data || [];
            applyDashboardFilters(currentModule);
          }).catch(err => {
            console.error('[Sync] Failed to silently refresh dashboard:', err);
          });
        }
      }
    }
  }
}

function updateSyncStatus(text, isError = false, customColor = null) {
  const statusEl = document.getElementById('topbar-status');
  if (!statusEl) return;

  let dotColor = customColor;
  if (!dotColor) {
    if (text.includes('Syncing')) {
      dotColor = '#eab308';
    } else if (isError) {
      dotColor = 'var(--accent-red)';
    } else {
      dotColor = '#16a34a';
    }
  }

  statusEl.innerHTML = `
    <span style="display:inline-flex; align-items:center; justify-content:center; padding:2px;" title="${text}">
      <span class="sync-dot" style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${dotColor}; ${text.includes('Syncing') ? 'animation: pulse 1s infinite alternate;' : ''}; box-shadow: 0 0 4px ${dotColor};"></span>
    </span>
  `;
}


// Window Bridge for Sync Service
window.markUserActive = markUserActive;
window.triggerCatchUpRefresh = triggerCatchUpRefresh;
window.startAutoSync = startAutoSync;
window.handleRealTimeUpdate = handleRealTimeUpdate;
window.updateSyncStatus = updateSyncStatus;
