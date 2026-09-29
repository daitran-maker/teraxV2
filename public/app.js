/**
 * CRC App - Main Application Bootstrap & Module Loader
 * Lean orchestrator file (~200 lines)
 */

// Core UI Helpers extracted to js/core/uiHelpers.js

// Lookup Service extracted to js/services/lookupService.js
// ============================================================
// NAV
// ============================================================
// Tab Router & Navigation extracted to js/core/tabRouter.js
// Automation View extracted to js/views/automationView.js
async function loadModule(moduleKey, skipFetch = false) {
  currentModule = moduleKey;
  currentView = 'table';
  if (!skipFetch) currentSearch = '';
  // selectCache = {}; // REMOVED: Keep cache for performance
  if (!skipFetch) selectedIds.clear();

  loadPersistedFilters(moduleKey);

  if (moduleStates[moduleKey] && moduleStates[moduleKey].search !== undefined) {
    currentSearch = moduleStates[moduleKey].search;
  } else if (!skipFetch) {
    currentSearch = '';
  }

  // Update nav UI directly here instead of re-rendering whole sidebar
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.id === `nav-${moduleKey}`);
  });

  // Update topbar
  const mod = MODULES[moduleKey];
  const meta = getModuleMeta(moduleKey);
  const titleText = meta.title || (mod ? mod.label : '') || moduleKey;
  const topbarTitle = document.getElementById('topbar-title'); if (topbarTitle) topbarTitle.innerHTML = titleText;
  const _tbSub = document.getElementById('topbar-subtitle'); if (_tbSub) _tbSub.textContent = meta.subtitle || '';
  const _tbAct = document.getElementById('topbar-actions-custom'); if (_tbAct) _tbAct.innerHTML = ''; // Clear old actions
  updatePaneMeta(titleText);

  if (moduleKey === 'home') {
    if (typeof loadHomeDashboard === 'function') {
      await loadHomeDashboard();
    }
  } else if (moduleKey === 'assigned_task') {
    await renderAssignedTaskKanbanView(moduleKey, skipFetch);
  } else {
    const content = document.getElementById('content');
    if (content && !skipFetch) {
      content.innerHTML = `
        <div class="skeleton-table-wrapper" style="padding:16px; background:#FFFFFF; height:100%; display:flex; flex-direction:column; gap:12px; font-family:'Inter',sans-serif;">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:12px;">
            <div class="skeleton-box" style="width:280px; height:36px; border-radius:8px;"></div>
            <div style="display:flex; gap:8px;">
              <div class="skeleton-box" style="width:90px; height:36px; border-radius:8px;"></div>
              <div class="skeleton-box" style="width:110px; height:36px; border-radius:8px;"></div>
            </div>
          </div>
          <div class="skeleton-box" style="width:100%; height:42px; border-radius:6px; margin-top:6px;"></div>
          <div class="skeleton-box" style="width:100%; height:46px; border-radius:6px;"></div>
          <div class="skeleton-box" style="width:100%; height:46px; border-radius:6px;"></div>
          <div class="skeleton-box" style="width:100%; height:46px; border-radius:6px;"></div>
          <div class="skeleton-box" style="width:100%; height:46px; border-radius:6px;"></div>
          <div class="skeleton-box" style="width:100%; height:46px; border-radius:6px;"></div>
        </div>
      `;
    }
    const savedPage = moduleStates[moduleKey] ? moduleStates[moduleKey].page : 1;
    await renderTableView(moduleKey, savedPage, skipFetch);
  }
}

// Table View Subsystem extracted to js/views/tableView.js

// Detail View Subsystem extracted to js/views/detailView.js
// Finance Summary Tab extracted to js/views/financeSummary.js

// Child Tables View extracted to js/views/childTableView.js
// Global Inline Comment Handlers extracted to js/components/inlineComments.js
// ============================================================
// DUPLICATE RECORD (main + child)
// (Consolidated window.duplicateRecord implementation located below)
// ============================================================

window.duplicateChildRecord = async function (childKey, parentKey, parentPkVal, initialParentData = {}) {
  const mod = MODULES[childKey];
  try {
    // Find the most recently created child record to use as template
    const fkMappings = {
      request: 'request', my_request: 'request', my_approval: 'request', my_process_owner: 'request', my_task: 'request', my_team: 'request',
      my_company: 'my_company', payment: 'payment', employee: 'requester', company: 'company'
    };
    const fkCol = fkMappings[parentKey] || parentKey;
    const url = `${mod.endpoint}?${fkCol}=${parentPkVal}&slice=${parentKey}&summary=false&limit=1`;
    const res = await apiGet(url);
    const data = res.data && Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []);

    let initialData = { ...initialParentData };
    if (data.length > 0) {
      const template = data[0];
      const excluded = [mod.pk, 'created_by', 'created_date', 'updated_by', 'updated_date', 'log', 'logs', 'notification_logs', 'deleted_at'];
      for (const [k, v] of Object.entries(template)) {
        if (!excluded.includes(k)) initialData[k] = v;
      }
      if (childKey === 'payment') {
        delete initialData.payment_id;
        initialData.payment_status = 'Draft';
        delete initialData.payment_date;
        delete initialData.transaction_id;
        delete initialData.payment_request;
        delete initialData.due_date;
        delete initialData.payment_period;
      }
    }

    await openAddModal(childKey, initialData);
  } catch (err) {
    showToast(err.message, 'error');
  }
};

// Dynamic Form Modal Subsystem extracted to js/views/formModal.js
// Delete & Bulk Delete Service extracted to js/services/deleteService.js
// ============================================================
// KEYBOARD SHORTCUTS
// ============================================================
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const openModals = Array.from(document.querySelectorAll('.modal-overlay.open'));
    if (openModals.length > 0) {
      const lastModal = openModals[openModals.length - 1];
      if (lastModal.id === 'discard-modal') {
        closeModal('discard-modal');
      } else if (lastModal.id === "form-modal") {
        const okBtn = document.getElementById("discard-ok-btn");
        okBtn.onclick = () => {
          closeModal("discard-modal");
          closeModal("form-modal");
        };
        openModal("discard-modal");
      } else {
        lastModal.classList.remove("open");
      }
    }
  }
});

// ============================================================
// AUTOMATIC REAL-TIME SYNC (OPTIMIZED WITH IDLE & TAB VISIBILITY)
// ============================================================
window.evtSource = null;
let isTabVisible = !document.hidden;
let isUserIdle = false;
let userIdleTimer = null;
let hasPendingRealtimeUpdate = false;
let realTimeDebounceTimer = null;

// Real-Time Sync Service extracted to js/services/syncService.js
// Permissions & Branding Policy Service extracted to js/services/permissionService.js
// Field Handlers Subsystem extracted to js/views/fieldHandlers.js



// Universal Dropdown Auto-closer on clicking outside or switching columns
document.addEventListener('click', function (e) {
  // Close any searchable dropdowns if not clicked inside
  document.querySelectorAll('.searchable-dropdown-container').forEach(c => {
    if (!c.contains(e.target)) {
      const list = c.querySelector('.searchable-dropdown-list');
      if (list) list.style.display = 'none';
    }
  });

  // Close any multiselect dropdowns if not clicked inside
  document.querySelectorAll('.searchable-multiselect-container').forEach(c => {
    if (!c.contains(e.target)) {
      const list = c.querySelector('.multiselect-dropdown-list');
      if (list) list.style.display = 'none';
    }
  });

  // Close row action menus if not clicked inside
  if (window.__rowActionDropdown && !window.__rowActionDropdown.contains(e.target) && !e.target.closest('.row-action-menu-btn')) {
    if (typeof closeRowActionDropdown === 'function') closeRowActionDropdown();
  }

  // Close table column filter panels if clicking on table headers or cells
  if (e.target.closest('th') || e.target.closest('td')) {
    document.querySelectorAll('.multiselect-dropdown-list, .searchable-dropdown-list').forEach(el => {
      el.style.display = 'none';
    });
  }
}, true);

// Assigned Task Kanban View extracted to js/views/kanbanView.js

