/**
 * CRC App - My Views Dashboard (my_request, my_approval, my_task, my_team)
 * Extracted as part of Phase 2 Modularization
 */

// ============================================================
// DASHBOARD VIEWS (My Request, My Approval, My Task)
// ============================================================
const DASHBOARD_META = {
  my_request: { title: 'My Requests', subtitle: 'Requests you created or are the requester', apiPath: 'my-request', icon: 'description' },
  my_approval: { title: 'My Approval', subtitle: 'Requests pending your approval', apiPath: 'my-approval', icon: 'approval' },
  my_process_owner: { title: 'My Task', subtitle: 'Requests assigned to you as SR Owner', apiPath: 'my-process-owner', icon: 'assignment_ind' },
  my_task: { title: 'My Task', subtitle: 'Requests assigned to you as SR Owner', apiPath: 'my-process-owner', icon: 'assignment_ind' },
  my_team: { title: 'My Team', subtitle: 'Requests where you are Policy Lead or SR Owner\'s Direct Manager', apiPath: 'my-team', icon: 'group' }
};

let dashboardData = [];
let dashboardFilters = {};
window.dashboardFilterSidebarHidden = window.dashboardFilterSidebarHidden || {};
let currentDashboardPage = 1;
const DASHBOARD_PAGE_SIZE = 50;

function getFiscalYear(dateStr) {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'N/A';
  return String(d.getFullYear());
}

function getApprovalStatusForUser(record) {
  if (!record) return 'N/A';
  const email = (authUser && authUser.email) ? authUser.email.toLowerCase() : '';
  const empId = (authUser && authUser.employee_id) ? authUser.employee_id.toLowerCase() : '';
  const username = (authUser && authUser.username) ? authUser.username.toLowerCase() : '';
  if (!email && !empId && !username) return 'N/A';

  const mapStatus = (st) => {
    if (st === undefined || st === null) return 'Not started yet';
    const sStr = String(st).toLowerCase().trim();
    if (sStr === '2' || sStr === 'pending' || sStr === 'pending_approval' || sStr === 'pending approval') return 'Pending Approval';
    if (sStr === '3' || sStr === 'approved') return 'Approved';
    if (sStr === '4' || sStr === 'rejected') return 'Rejected';
    if (sStr === '7' || sStr === 'not_started' || sStr === 'not started' || sStr === 'not started yet') return 'Not started yet';
    return st;
  };

  // Try parsing approval_flow first
  let flow = record.approval_flow;
  if (typeof flow === 'string') {
    try { flow = JSON.parse(flow); } catch (e) { }
  }
  if (flow && Array.isArray(flow.steps)) {
    const userStep = flow.steps.find(step => {
      const app = String(step.approver || '').toLowerCase().trim();
      return app === email || app === empId || app === username;
    });
    if (userStep) {
      return mapStatus(userStep.status);
    }
  }

  // Fallback to legacy fields
  if (record.tier_1_approval && [email, empId, username].includes(record.tier_1_approval.toLowerCase().trim())) {
    return mapStatus(record.tier_1_status);
  }
  if (record.tier_2_approval && [email, empId, username].includes(record.tier_2_approval.toLowerCase().trim())) {
    return mapStatus(record.tier_2_status);
  }
  if (record.tier_3_approval && [email, empId, username].includes(record.tier_3_approval.toLowerCase().trim())) {
    return mapStatus(record.tier_3_status);
  }
  return 'N/A';
}

function getHighestTierApprovalStatus(record) {
  if (!record) return 1;
  const statusNum = Number(record.sr_status);
  if (!isNaN(statusNum)) return statusNum;
  const status = record.sr_status || 'Draft';
  if (status === 'Pending Approval' || status === 'Submitted' || status === 'Pending') return 2;
  if (status === 'Approved') return 3;
  if (status === 'Rejected') return 4;
  if (status === 'Closed') return 5;
  if (status === 'Cancelled') return 6;
  return status;
}

function resolvePolicyName(policyId) {
  if (!policyId) return 'Unknown';
  if (selectCache['policy']) {
    if (!selectCache['policy_index_by_id'] || selectCache['policy_index_by_id']._lastLength !== selectCache['policy'].length) {
      const m = new Map();
      selectCache['policy'].forEach(x => m.set(String(x.policy_id), x));
      m._lastLength = selectCache['policy'].length;
      selectCache['policy_index_by_id'] = m;
    }
    const p = selectCache['policy_index_by_id'].get(String(policyId));
    if (p) return p.policy_name;
  }
  return policyId;
}

function resolveEmployeeName(val) {
  if (!val) return '';
  if (Array.isArray(val)) {
    return val.map(e => resolveEmployeeName(e)).filter(Boolean).join(', ');
  }
  if (typeof val === 'string' && val.includes(',')) {
    return val.split(',').map(e => resolveEmployeeName(e.trim())).filter(Boolean).join(', ');
  }
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
    const valLc = String(val).toLowerCase().trim();
    const e = selectCache['employee_index_by_id'].get(valLc)
      || selectCache['employee_index_by_email'].get(valLc)
      || selectCache['employee_index_by_username'].get(valLc);
    if (e) {
      const isInactive = String(e.status || '').toLowerCase() === 'inactive';
      if (isInactive) return e.email || val;
      return e.full_name || val;
    }
  }
  return val;
}

async function loadDashboardView(viewKey) {
  loadPersistedFilters(viewKey);
  const meta = DASHBOARD_META[viewKey];
  if (!meta) return;

  currentModule = viewKey;
  currentView = 'dashboard';

  // Clear old table summaries to prevent bug where dashboard shows previous view's summary
  currentTableSummary = null;
  currentFacetedSummary = null;
  originalFacetedSummary = {};

  // Update topbar
  const title = t(`nav.${viewKey}`, meta.title);
  const subtitle = t(`module.${viewKey}.subtitle`, meta.subtitle);
  const _tbTitle = document.getElementById('topbar-title'); if (_tbTitle) _tbTitle.innerHTML = title;
  const _tbSub = document.getElementById('topbar-subtitle'); if (_tbSub) _tbSub.textContent = subtitle;
  const _tbAct = document.getElementById('topbar-actions-custom'); if (_tbAct) _tbAct.innerHTML = '';
  updatePaneMeta(title);

  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="skeleton-table-wrapper" style="height: 100%; animation: fadeIn 0.15s ease;">
      <div class="skeleton-header-row" style="height: 72px; padding: 12px 24px;">
        <div style="flex: 1; max-width: 480px; height: 48px;">
          <div class="skeleton-box" style="width: 100%; height: 48px; border-radius: 8px;"></div>
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <div class="skeleton-box" style="width: 105px; height: 40px; border-radius: 8px;"></div>
          <div class="skeleton-box" style="width: 90px; height: 40px; border-radius: 8px; background-color: #FFEDD5;"></div>
        </div>
      </div>
      <div class="skeleton-layout-split" style="flex: 1;">
        <div class="skeleton-sidebar">
          <div class="skeleton-box" style="width: 60%; height: 16px; margin-bottom: 8px;"></div>
          <div class="skeleton-box" style="width: 90%; height: 14px;"></div>
          <div class="skeleton-box" style="width: 75%; height: 14px;"></div>
          <div class="skeleton-box" style="width: 85%; height: 14px; margin-top: 14px;"></div>
          <div class="skeleton-box" style="width: 65%; height: 14px;"></div>
          <div class="skeleton-box" style="width: 80%; height: 14px;"></div>
        </div>
        <div class="skeleton-table-body">
          <div style="display: flex; gap: 16px; padding-bottom: 12px; border-bottom: 2px solid #E2E8F0;">
            <div class="skeleton-box" style="width: 40px; height: 16px;"></div>
            <div class="skeleton-box" style="width: 25%; height: 16px;"></div>
            <div class="skeleton-box" style="width: 20%; height: 16px;"></div>
            <div class="skeleton-box" style="width: 18%; height: 16px;"></div>
            <div class="skeleton-box" style="width: 15%; height: 16px;"></div>
            <div class="skeleton-box" style="width: 12%; height: 16px;"></div>
          </div>
          ${Array.from({ length: 6 }).map((_, idx) => `
            <div class="skeleton-row">
              <div class="skeleton-box" style="width: 24px; height: 14px;"></div>
              <div class="skeleton-box" style="width: ${25 + (idx % 3) * 5}%; height: 14px;"></div>
              <div class="skeleton-box" style="width: ${18 + (idx % 2) * 4}%; height: 14px;"></div>
              <div class="skeleton-box" style="width: ${16 + (idx % 4) * 3}%; height: 14px;"></div>
              <div class="skeleton-box" style="width: ${12 + (idx % 2) * 3}%; height: 14px;"></div>
              <div class="skeleton-box" style="width: 10%; height: 14px;"></div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  try {
    // Start lookups prefetch and dashboard data fetch in parallel
    const promises = [];
    if (!selectCache['policy']) promises.push(getSelectOptions('policy'));
    if (!selectCache['employee']) promises.push(getSelectOptions('employee'));

    const serverSearch = (moduleStates[viewKey]?.serverSearch || '').trim();
    let url = `/my-views/${meta.apiPath}`;
    if (serverSearch) {
      url += `?search=${encodeURIComponent(serverSearch)}`;
    }
    const dataPromise = apiGet(url);
    promises.push(dataPromise);

    await Promise.all(promises);
    const res = await dataPromise;
    dashboardData = res.data || [];
    currentData = dashboardData;
    loadPersistedFilters(viewKey);

    // Pre-compute expensive resolved values once per record (major perf fix)
    dashboardData.forEach(r => {
      // sr_owner is TEXT[] — resolve each email to a name and join
      const srOwnerRaw = r.sr_owner;
      const srOwnerNames = Array.isArray(srOwnerRaw)
        ? srOwnerRaw.map(e => resolveEmployeeName(e) || e).join(', ')
        : (resolveEmployeeName(srOwnerRaw) || srOwnerRaw || '');
      r._cache = {
        requesterName: (resolveEmployeeName(r.requester) || '').toLowerCase(),
        srOwnerName: srOwnerNames,
        srOwnerNameLc: srOwnerNames.toLowerCase(),
        fy: getFiscalYear(r.sr_submitted_date || r.sr_created_date || r.created_date),
        approvalStatus: getApprovalStatusForUser(r),
        ratingStatus: (r.rating && typeof r.rating === 'object' && r.rating.point !== undefined && r.rating.point !== null) ? 'Rated' : 'Pending Rating',
      };
    });

    renderDashboardView(viewKey, dashboardData);
  } catch (err) {
    content.innerHTML = `<div class="empty-state"><div class="empty-icon material-symbols-rounded">warning</div><div class="empty-title">Error Loading</div><div class="empty-desc">${err.message}</div></div>`;
    showToast(err.message, 'error');
  }
}

function renderDashboardView(viewKey, data) {
  const meta = DASHBOARD_META[viewKey];
  const content = document.getElementById('content');

  // Build status cards (no Total card)
  const statusCards = buildStatusCards(viewKey, data);
  updateGlobalStatusCards(statusCards);

  // Build filter sidebar
  const filterSidebar = buildFilterSidebar(viewKey, data);

  content.innerHTML = `
    <div class="view active" id="view-${viewKey}" style="display: flex; flex-direction: column; height: 100%; overflow: hidden; background: #FFFFFF; font-family: 'Inter', sans-serif;">
      <!-- Search Header (full width) -->
      <div class="dv-search-header" style="padding: 12px 24px; display: flex; gap: 12px; align-items: center; border-bottom: 1px solid #E5E7EB; background: #ffffff; flex-shrink:0; height: 72px;">
        <div style="position: relative; flex: 1; min-width: 200px; height: 48px;">
          <span class="material-symbols-rounded" style="position: absolute; left: 16px; top: 50%; transform: translateY(-50%); font-size:18px; color: #6B7280;">search</span>
          <input type="text" id="dv-search-input-${viewKey}" class="form-input" placeholder="Search requests by policy, requester, owner, description..." value="${moduleStates[viewKey]?.search || ''}" oninput="filterDashboardTable('${viewKey}', this.value)" style="padding: 12px 16px 12px 44px; width: 100%; border-radius: 8px; border: 1px solid #E5E7EB; height: 48px; font-size: 13px; font-family: 'Inter', sans-serif; color: #111827; background: #FFFFFF;" />
        </div>
        <!-- Table Actions Inline -->
        <div class="table-actions-wrapper" id="table-actions-${viewKey}" style="display:flex; gap:8px; align-items:center;">
          <button class="btn dashboard-filter-toggle" id="dashboard-filter-toggle-${viewKey}" type="button" aria-expanded="${!window.dashboardFilterSidebarHidden[viewKey]}" onclick="toggleDashboardFilterSidebar('${viewKey}')"><span class="material-symbols-rounded">filter_list</span><span class="dashboard-filter-toggle-label">${window.dashboardFilterSidebarHidden[viewKey] ? t('table.show_filter', 'Hiện filter') : t('table.hide_filter', 'Ẩn filter')}</span></button>
          ${isActionAllowed(viewKey, 'add') && !['my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(viewKey) ?
      `<button class="btn" onclick="openAddModal('request')" style="background:#FF6A00 !important; color:#ffffff !important; border:none !important; border-radius:8px !important; padding:8px 24px !important; font-weight:600 !important; font-size:13px !important; height:40px !important; display:inline-flex !important; align-items:center !important; justify-content:center !important; box-shadow: 0 4px 12px rgba(255, 106, 0, 0.15) !important; transition: all 0.2s ease !important;" onmouseover="this.style.background='#ea580c !important'" onmouseout="this.style.background='#FF6A00 !important'">+ ${t('table.add', 'Add')}</button>` : ''
    }
        </div>
      </div>

      <!-- Split Area: Sidebar (left) + Table (right) -->
      <div class="dv-main-layout" style="flex: 1; display: flex; min-height: 0; overflow: hidden; background: #ffffff; gap: 0;">
        <!-- Left Filter Sidebar -->
        <div class="dv-filter-sidebar ${window.dashboardFilterSidebarHidden[viewKey] ? 'is-hidden' : ''}" id="dashboard-filter-sidebar-${viewKey}">
          <div class="dv-filter-header" onclick="toggleMobileFilterSidebarCollapse('${viewKey}', this)">
            <span class="material-symbols-rounded" style="font-size:14px; color:#FF6A00;">filter_list</span>
            <span style="font-family: 'Inter', sans-serif; text-transform: uppercase; font-size: 11.5px; letter-spacing: 0.5px;">Filters</span>
            <span id="dv-filter-collapse-btn" class="material-symbols-rounded" style="font-size:16px; color:#9CA3AF; transition: transform 0.2s; margin-left:4px;">expand_less</span>
            <button class="dv-filter-clear" onclick="event.stopPropagation(); clearDashboardFilters('${viewKey}')" style="margin-left:auto; background:none; border:none; color:#FF6A00; font-size:10px; font-weight:600; cursor:pointer; padding:2px 6px; border-radius:4px;">${t('table.clear_all', 'Clear all')}</button>
          </div>
          <div class="dv-filter-groups-container">
            ${filterSidebar}
          </div>
        </div>

        <!-- Right: Table Area -->
        <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden; background: #ffffff;">
          <div class="dv-cards-list" id="dv-cards-list-${viewKey}" style="flex:1; overflow-y:auto; overflow-x:auto !important; display: block !important; padding: 0 !important;">
            <!-- Table rendered here -->
          </div>
          <div id="dv-pagination-${viewKey}" style="padding: 12px 16px; border-top: 1px solid #E5E7EB; display:flex; justify-content:space-between; align-items:center; background:#ffffff;">
            <!-- Pagination rendered here -->
          </div>
        </div>
      </div>

    </div>
  `;
  currentDashboardPage = 1;
  applyDashboardFilters(viewKey);
  initSidebarResizer(viewKey, true);
}

window.toggleDashboardFilterSidebar = function (viewKey) {
  const sidebar = document.getElementById(`dashboard-filter-sidebar-${viewKey}`);
  if (!sidebar) return;
  const isHidden = !sidebar.classList.contains('is-hidden');
  sidebar.classList.toggle('is-hidden', isHidden);
  window.dashboardFilterSidebarHidden[viewKey] = isHidden;

  const button = document.getElementById(`dashboard-filter-toggle-${viewKey}`);
  if (button) {
    button.setAttribute('aria-expanded', String(!isHidden));
    const label = button.querySelector('.dashboard-filter-toggle-label');
    if (label) label.textContent = isHidden ? t('table.show_filter', 'Hiện filter') : t('table.hide_filter', 'Ẩn filter');
  }
};

function buildStatusCards(viewKey, data) {
  const neutralColor = '#6B7280';
  let cardConfigs = [];

  if (viewKey === 'my_request') {
    let counts = {
      'Pending Approval': 0,
      'Approved': 0,
      'Completed': 0,
      'Rejected': 0,
      'Draft': 0
    };
    (data || []).forEach(r => {
      const srNum = Number(r.sr_status);
      const srKey = String(r.sr_status_key || r.sr_status || '').toLowerCase().trim();
      const procNum = Number(r.process_status);
      const procKey = String(r.process_status_key || r.process_status || '').toLowerCase().trim();

      if (srNum === 1 || srKey === 'draft') {
        counts['Draft']++;
      } else if (srNum === 4 || srKey === 'rejected') {
        counts['Rejected']++;
      } else if (srNum === 2 || srKey === 'pending_approval' || srKey === 'submitted' || srKey === 'pending approval' || srKey === 'pending') {
        counts['Pending Approval']++;
      } else if (srNum === 3 || srKey === 'approved') {
        counts['Approved']++;
      } else if (procNum === 9 || procKey === 'completed' || srNum === 5 || srKey === 'closed') {
        counts['Completed']++;
      }
    });

    cardConfigs = [
      { key: 'Pending Approval', label: typeof t === 'function' ? t('status.pending_approval', 'Pending Approval') : 'Pending Approval', count: counts['Pending Approval'], color: '#F59E0B', icon: 'hourglass_top', bgLight: '#FFFBEB' },
      { key: 'Approved', label: typeof t === 'function' ? t('status.approved', 'Approved') : 'Approved', count: counts['Approved'], color: '#3B82F6', icon: 'thumb_up', bgLight: '#EFF6FF' },
      { key: 'Completed', label: typeof t === 'function' ? t('status.completed', 'Completed') : 'Completed', count: counts['Completed'], color: '#10B981', icon: 'task_alt', bgLight: '#ECFDF5' },
      { key: 'Rejected', label: typeof t === 'function' ? t('status.rejected', 'Rejected') : 'Rejected', count: counts['Rejected'], color: '#EF4444', icon: 'cancel', bgLight: '#FEF2F2' },
      { key: 'Draft', label: typeof t === 'function' ? t('status.draft', 'Draft') : 'Draft', count: counts['Draft'], color: '#6B7280', icon: 'edit_note', bgLight: '#F3F4F6' }
    ];
  } else if (viewKey === 'my_approval') {
    let counts = {
      'Pending Approval': 0,
      'Approved': 0,
      'Rejected': 0,
      'Not started yet': 0
    };
    (data || []).forEach(r => {
      const s = getApprovalStatusForUser(r);
      if (s === 'Pending Approval' || s === 'Pending' || s === 'pending_approval' || s === '2' || s === 2) {
        counts['Pending Approval']++;
      } else if (s === 'Approved' || s === 'approved' || s === '3' || s === 3) {
        counts['Approved']++;
      } else if (s === 'Rejected' || s === 'rejected' || s === '4' || s === 4) {
        counts['Rejected']++;
      } else {
        counts['Not started yet']++;
      }
    });

    cardConfigs = [
      { key: 'Pending Approval', label: typeof t === 'function' ? t('status.pending_approval', 'Pending Approval') : 'Pending Approval', count: counts['Pending Approval'], color: '#F59E0B', icon: 'hourglass_top', bgLight: '#FFFBEB' },
      { key: 'Approved', label: typeof t === 'function' ? t('status.approved', 'Approved') : 'Approved', count: counts['Approved'], color: '#10B981', icon: 'task_alt', bgLight: '#ECFDF5' },
      { key: 'Rejected', label: typeof t === 'function' ? t('status.rejected', 'Rejected') : 'Rejected', count: counts['Rejected'], color: '#EF4444', icon: 'cancel', bgLight: '#FEF2F2' },
      { key: 'Not started yet', label: typeof t === 'function' ? t('status.not_started_yet', 'Not started yet') : 'Not started yet', count: counts['Not started yet'], color: '#6B7280', icon: 'schedule', bgLight: '#F3F4F6' }
    ];
  } else if (['my_process_owner', 'my_task', 'my_team'].includes(viewKey)) {
    let counts = {
      'Not started yet': 0,
      'Processing': 0,
      'Completed': 0
    };
    (data || []).forEach(r => {
      const procNum = Number(r.process_status);
      const procKey = String(r.process_status_key || r.process_status || '').toLowerCase().trim();

      if (procNum === 8 || procKey === 'processing') {
        counts['Processing']++;
      } else if (procNum === 9 || procKey === 'completed') {
        counts['Completed']++;
      } else {
        counts['Not started yet']++;
      }
    });

    cardConfigs = [
      { key: 'Not started yet', label: typeof t === 'function' ? t('status.not_started_yet', 'Not started yet') : 'Not started yet', count: counts['Not started yet'], color: '#6B7280', icon: 'schedule', bgLight: '#F3F4F6' },
      { key: 'Processing', label: typeof t === 'function' ? t('status.processing', 'Processing') : 'Processing', count: counts['Processing'], color: '#3B82F6', icon: 'sync', bgLight: '#EFF6FF' },
      { key: 'Completed', label: typeof t === 'function' ? t('status.completed', 'Completed') : 'Completed', count: counts['Completed'], color: '#10B981', icon: 'task_alt', bgLight: '#ECFDF5' }
    ];
  }

  if (cardConfigs.length === 0) return '';

  let html = '<div class="dv-kpi-cards-row" style="display:flex; gap:12px; width: 100%; overflow-x: auto; padding-bottom: 2px;">';
  for (const card of cardConfigs) {
    html += `
      <div class="dv-kpi-card" style="flex:1; min-width:120px; height:64px; background:#ffffff; border:1px solid #E5E7EB; border-radius:12px; padding:10px 12px; display:flex; align-items:center; gap:12px; box-shadow: 0 1px 2px rgba(16,24,40,0.04); border-bottom: 3px solid ${card.color}; transition: all 0.2s ease;">
        <div class="dv-card-icon" style="width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; background:${card.bgLight}; color:${card.color}; flex-shrink:0;">
          <span class="material-symbols-rounded" style="font-size:14px;">${card.icon}</span>
        </div>
        <div class="dv-card-info" style="display:flex; flex-direction:column; gap:2px; min-width:0;">
          <div class="dv-card-count" style="font-size:16px; font-weight:700; color:#111827; line-height:1; font-family:Inter, sans-serif;">${formatNumber(card.count)}</div>
          <div class="dv-card-label" style="font-size:11px; font-weight:500; color:#6B7280; font-family:Inter, sans-serif; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; line-height:1.3; text-transform:none !important; letter-spacing:normal !important;">${card.label}</div>
        </div>
      </div>
    `;
  }
  html += '</div>';
  return html;
}

function buildFilterSidebar(viewKey, data) {
  let filterGroups = [];

  // FY Filter (always first)
  const fyCounts = {};
  data.forEach(r => {
    const fy = getFiscalYear(r.sr_submitted_date || r.sr_created_date || r.created_date);
    fyCounts[fy] = (fyCounts[fy] || 0) + 1;
  });
  filterGroups.push({ key: 'fy', label: 'FY', values: fyCounts });

  if (viewKey === 'my_request') {
    // SR Status filter
    const srCounts = {};
    data.forEach(r => { const s = r.sr_status_key || r.sr_status || 'Unknown'; srCounts[s] = (srCounts[s] || 0) + 1; });
    filterGroups.push({ key: 'sr_status', label: 'SR Status', values: srCounts });

    // Process Status filter
    const psCounts = {};
    data.forEach(r => { const s = r.process_status_key || r.process_status || 'Unknown'; psCounts[s] = (psCounts[s] || 0) + 1; });
    filterGroups.push({ key: 'process_status', label: 'Process Status', values: psCounts });

    // Rating Status filter
    const ratingCounts = {};
    data.forEach(r => {
      const isRated = (r.rating && typeof r.rating === 'object' && r.rating.point !== undefined && r.rating.point !== null);
      const s = isRated ? 'Rated' : 'Pending Rating';
      ratingCounts[s] = (ratingCounts[s] || 0) + 1;
    });
    filterGroups.push({ key: 'rating_status', label: 'Rating', values: ratingCounts });
  } else if (viewKey === 'my_approval') {
    // SR Status filter
    const srCounts = {};
    data.forEach(r => { const s = r.sr_status_key || r.sr_status || 'Unknown'; srCounts[s] = (srCounts[s] || 0) + 1; });
    filterGroups.push({ key: 'sr_status', label: 'SR Status', values: srCounts });

    // Process Status
    const psCounts = {};
    data.forEach(r => { const s = r.process_status_key || r.process_status || 'Unknown'; psCounts[s] = (psCounts[s] || 0) + 1; });
    filterGroups.push({ key: 'process_status', label: 'Process Status', values: psCounts });
  } else if (['my_process_owner', 'my_task'].includes(viewKey)) {
    // Process Status
    const psCounts = {};
    data.forEach(r => { const s = r.process_status_key || r.process_status || 'Unknown'; psCounts[s] = (psCounts[s] || 0) + 1; });
    filterGroups.push({ key: 'process_status', label: 'Process Status', values: psCounts });

    // SR Status filter
    const srCounts = {};
    data.forEach(r => { const s = r.sr_status_key || r.sr_status || 'Unknown'; srCounts[s] = (srCounts[s] || 0) + 1; });
    filterGroups.push({ key: 'sr_status', label: 'SR Status', values: srCounts });
  } else if (viewKey === 'my_team') {
    // SR Owner filter — sr_owner is TEXT[], handle array
    const ownerCounts = {};
    data.forEach(r => {
      const owners = Array.isArray(r.sr_owner) ? r.sr_owner : (r.sr_owner ? [r.sr_owner] : []);
      if (owners.length === 0) {
        ownerCounts['Unknown'] = (ownerCounts['Unknown'] || 0) + 1;
      } else {
        owners.forEach(ownerEmail => {
          const s = resolveEmployeeName(ownerEmail) || ownerEmail || 'Unknown';
          ownerCounts[s] = (ownerCounts[s] || 0) + 1;
        });
      }
    });
    filterGroups.push({ key: 'sr_owner', label: 'SR Owner', values: ownerCounts });

    // Process Status filter
    const psCounts = {};
    data.forEach(r => { const s = r.process_status_key || r.process_status || 'Unknown'; psCounts[s] = (psCounts[s] || 0) + 1; });
    filterGroups.push({ key: 'process_status', label: 'Process Status', values: psCounts });
  }

  let html = '';
  for (const group of filterGroups) {
    if (dashboardFilters[group.key] instanceof Set) {
      dashboardFilters[group.key].forEach(val => {
        if (group.values[val] === undefined) {
          group.values[val] = 0;
        }
      });
    }

    const sortedEntries = typeof sortFilterEntries === 'function'
      ? sortFilterEntries(viewKey, group.key, Object.entries(group.values))
      : (group.key === 'fy'
        ? Object.entries(group.values).sort(([a], [b]) => String(b).localeCompare(String(a), undefined, { numeric: true }))
        : Object.entries(group.values).sort((a, b) => b[1] - a[1]));
    const groupUniqueKey = `${viewKey}_${group.key}`;

    const hasCheckedInRemaining = sortedEntries.slice(5).some(([val]) => isFilterValueChecked(dashboardFilters[group.key], val));
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
      const isChecked = isFilterValueChecked(dashboardFilters[group.key], val) ? 'checked' : '';
      return `
            <label class="dv-filter-option">
              <input type="checkbox" data-filter-key="${group.key}" data-filter-value="${escapeHTML(val)}" ${isChecked}
                onchange="toggleDashboardFilter('${viewKey}', '${group.key}', '${val.replace(/'/g, "\\'")}', this.checked)" />
              <span class="dv-filter-checkbox"></span>
              <span class="dv-filter-text">${escapeHTML(t_val(val))}</span>
              <span class="dv-filter-count">${formatNumber(count)}</span>
            </label>
          `;
    }).join('')}

        ${showMore ? `
          <div class="dv-filter-more-options" style="display: ${isExpanded ? 'block' : 'none'};">
            ${remaining.map(([val, count]) => {
      const isChecked = dashboardFilters[group.key] instanceof Set && dashboardFilters[group.key].has(val) ? 'checked' : '';
      return `
                <label class="dv-filter-option">
                  <input type="checkbox" data-filter-key="${group.key}" data-filter-value="${escapeHTML(val)}" ${isChecked}
                    onchange="toggleDashboardFilter('${viewKey}', '${group.key}', '${val.replace(/'/g, "\\'")}', this.checked)" />
                  <span class="dv-filter-checkbox"></span>
                  <span class="dv-filter-text">${escapeHTML(t_val(val))}</span>
                  <span class="dv-filter-count">${formatNumber(count)}</span>
                </label>
              `;
    }).join('')}
          </div>
          <div class="dv-filter-more-btn" onclick="toggleMoreFilterOptions(this, '${groupUniqueKey}')" style="color:#FF6A00; font-size:11px; font-weight:600; cursor:pointer; padding:4px 0px; display:inline-block;">${isExpanded ? 'less' : 'more ...'}</div>
        ` : ''}
      </div>
    `;
  }
  return html;
}

function getDashboardFilterValue(viewKey, row, filterKey) {
  if (filterKey === 'fy') return row._cache?.fy || getFiscalYear(row.sr_submitted_date || row.sr_created_date || row.created_date);
  if (filterKey === 'sr_status') return row.sr_status_key || row.sr_status || 'Unknown';
  if (filterKey === 'process_status') return row.process_status_key || row.process_status || 'Unknown';
  if (filterKey === 'approval_status') return row._cache?.approvalStatus || getApprovalStatusForUser(row);
  if (filterKey === 'rating_status') {
    return row._cache?.ratingStatus || ((row.rating && typeof row.rating === 'object' && row.rating.point !== undefined && row.rating.point !== null) ? 'Rated' : 'Pending Rating');
  }
  if (filterKey === 'sr_owner') {
    let owners = [];
    if (Array.isArray(row.sr_owner)) {
      owners = row.sr_owner;
    } else if (typeof row.sr_owner === 'string') {
      owners = row.sr_owner.split(',').map(s => s.trim().replace(/^\[|\]$/g, '')).filter(Boolean);
    }
    const ownerNames = owners.map(email => resolveEmployeeName(email) || email || 'Unknown');
    return ownerNames.length > 0 ? ownerNames : ['Unknown'];
  }
  return row[filterKey] || 'Unknown';
}

function rowMatchesDashboardFilters(viewKey, row, { searchQuery = '', excludeFilterKey = null } = {}) {
  if (searchQuery) {
    const requestId = (row.request_id || '').toLowerCase();
    const policyName = (row.policy_name || '').toLowerCase();
    const requester = (row.requester || '').toLowerCase();
    const srOwner = Array.isArray(row.sr_owner) ? row.sr_owner.join(', ').toLowerCase() : (row.sr_owner || '').toLowerCase();
    const description = (row.description || '').toLowerCase();
    const requesterName = row._cache?.requesterName || '';
    const srOwnerName = row._cache?.srOwnerNameLc || '';
    const matches = requestId.includes(searchQuery) ||
      policyName.includes(searchQuery) ||
      requester.includes(searchQuery) ||
      srOwner.includes(searchQuery) ||
      description.includes(searchQuery) ||
      requesterName.includes(searchQuery) ||
      srOwnerName.includes(searchQuery);
    if (!matches) return false;
  }

  for (const [filterKey, filterValues] of Object.entries(dashboardFilters)) {
    if (filterKey === excludeFilterKey || !(filterValues instanceof Set) || filterValues.size === 0) continue;
    const value = getDashboardFilterValue(viewKey, row, filterKey);
    const values = Array.isArray(value) ? value : [value];
    if (!values.some(v => isFilterValueChecked(filterValues, v))) return false;
  }
  return true;
}

function getCurrentStep(r) {
  if (Number(r.process_status) === 9 || Number(r.sr_status) === 5) {
    if (Number(r.process_status) === 9) return 'Completed';
    return 'Final Review';
  }
  if (Number(r.sr_status) === 1) return 'Not started';
  if (Number(r.process_status) === 7) return 'Not started';

  let flow = r.approval_flow;
  if (typeof flow === 'string') {
    try { flow = JSON.parse(flow); } catch (e) { }
  }
  if (flow && Array.isArray(flow.steps) && flow.steps.length > 0) {
    const pendingStep = flow.steps.find(s => s.status && s.status.toLowerCase() === 'pending approval');
    if (pendingStep) return `Tier ${pendingStep.level} Approval`;
  }
  return 'Processing';
}

function formatDateOnly(dateStr) {
  if (!dateStr) return 'N/A';
  return (typeof formatDate === 'function' ? formatDate(dateStr) : formatDateMON(dateStr)) || dateStr;
}

function buildRequestCards(viewKey, data) {
  const isDashboard = ['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(viewKey);
  const showDashboardActions = ['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(viewKey);

  if (data.length === 0) {
    if (isDashboard) {
      const emptyColspan = viewKey === 'my_request' ? 8 : (showDashboardActions ? 7 : 5);
      return `<tr><td colspan="${emptyColspan}" style="padding:40px; text-align:center; color:var(--text-muted);"><div class="empty-state"><div class="empty-icon material-symbols-rounded">inbox</div><div class="empty-title">${t('table.no_records', 'No records found')}</div></div></td></tr>`;
    }
    return `<div class="empty-state" style="padding:40px;"><div class="empty-icon material-symbols-rounded">inbox</div><div class="empty-title">No requests found</div></div>`;
  }

  return data.map(r => {
    let policyName = r.policy_name || resolvePolicyName(r.request_type);
    if (typeof policyName === 'string' && policyName.toUpperCase().includes('OPPORTUNITY')) {
      policyName = 'Opportunity';
    }
    const desc = r.description || 'No description';
    const createdDate = (viewKey === 'my_team' || viewKey === 'my_request')
      ? (r.sr_created_date ? formatDateTime(r.sr_created_date) : (r.created_date ? formatDateTime(r.created_date) : 'N/A'))
      : (r.sr_submitted_date ? formatDateTime(r.sr_submitted_date) : (r.sr_created_date ? formatDateTime(r.sr_created_date) : (r.created_date ? formatDateTime(r.created_date) : 'N/A')));
    const requesterName = r._cache?.requesterName ? (r._cache.requesterName.length > 0 ? resolveEmployeeName(r.requester) : '') : resolveEmployeeName(r.requester);
    const processStatus = r.process_status_key || r.process_status || 'N/A';
    const srStatus = r.sr_status_key || r.sr_status || 'Unknown';
    const requestId = r.request_id;

    const approvalDisplay = getHighestTierApprovalStatus(r);
    const fy = r._cache?.fy || getFiscalYear(r.sr_submitted_date || r.sr_created_date || r.created_date);
    const userApprovalStatus = r._cache?.approvalStatus || getApprovalStatusForUser(r);

    if (isDashboard) {
      const createdDateOnly = (viewKey === 'my_team' || viewKey === 'my_request')
        ? (r.sr_created_date ? formatDateTime(r.sr_created_date) : (r.created_date ? formatDateTime(r.created_date) : 'N/A'))
        : (r.sr_submitted_date ? formatDateTime(r.sr_submitted_date) : (r.sr_created_date ? formatDateTime(r.sr_created_date) : (r.created_date ? formatDateTime(r.created_date) : 'N/A')));

      const getBadgeStyles = (status, customColor) => {
        const hex = (customColor && String(customColor).startsWith('#')) ? customColor
          : (typeof status === 'string' && status.startsWith('#')) ? status : null;
        if (hex) {
          return `background: ${hex}15; color: ${hex}; border: 1px solid ${hex}33;`;
        }
        const s = String(status || '').toLowerCase().trim();
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

      const ratingPt = (r.rating && typeof r.rating === 'object') ? (r.rating.point || 0) : 0;
      const ratingHTML = `
        <div style="display:flex; align-items:center; gap:2px;">
          ${[1, 2, 3, 4, 5].map(i => `<span class="material-symbols-rounded" style="font-size:14px; color:${i <= ratingPt ? '#F59E0B' : '#D1D5DB'}">${i <= ratingPt ? 'star' : 'star_border'}</span>`).join('')}
        </div>
      `;
      const showRatingCell = !['my_team', 'my_process_owner', 'my_task', 'my_approval'].includes(viewKey);
      const ratingCellHTML = showRatingCell ? `<td class="col-rating" style="padding: 12px 16px; font-size: 13px; font-family: 'Inter', sans-serif; white-space: nowrap;">${ratingHTML}</td>` : '';

      const isDeleted = !!r.deleted_at;
      const rowMenuCellHTML = showDashboardActions ? `<td class="request-row-menu-cell col-menu" onclick="event.stopPropagation();"><button class="row-action-menu-btn" title="Quick actions" onclick="toggleRowActionMenu('${viewKey}', '${requestId}', this, event)"><span class="material-symbols-rounded" style="font-size:18px; pointer-events:none; color: #64748B;">more_vert</span></button></td>` : '';
      const actionCellHTML = showDashboardActions && !['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(viewKey) ? `
          <td style="padding: 12px 16px; text-align: center; white-space: nowrap;" onclick="event.stopPropagation();">
            <button class="btn-table-action" onclick="event.stopPropagation(); duplicateRecord('request', '${requestId}')" title="Duplicate" style="margin-right: 4px;">
              <span class="material-symbols-rounded" style="font-size: 14px;">content_copy</span>
            </button>
          </td>` : '';
      return `
        <tr onclick="window.location.hash='${viewKey}/${requestId}'" class="${isDeleted ? 'soft-deleted-row' : ''}" style="height: 56px; border-bottom: 1px solid #F1F5F9; cursor: pointer; transition: background 0.2s ease;" onmouseover="this.style.background='#F8FAFC'" onmouseout="this.style.background='transparent'">
          ${rowMenuCellHTML}
          <td class="col-description" style="padding: 12px 16px; font-size: 13px; font-weight: 400; color: #111827; font-family: 'Inter', sans-serif; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHTML(desc)}">
            ${isDeleted ? `<span class="material-symbols-rounded" style="font-size:16px; color:#EF4444; margin-right:6px; vertical-align:middle;" title="Soft Deleted">block</span>` : ''}${escapeHTML(desc)}
          </td>
          <td class="col-type" style="padding: 12px 16px; font-size: 13px; font-weight: 400; color: #111827; font-family: 'Inter', sans-serif; white-space: nowrap;">
            <div style="display:flex; align-items:center; gap:6px;">
              <span class="material-symbols-rounded" style="font-size:14px; color:#FF6A00;">label</span>
              <span>${escapeHTML(policyName)}</span>
            </div>
          </td>
          <!-- <td style="padding: 12px 16px; font-size: 13px; font-weight: 400; color: #6B7280; font-family: 'Inter', sans-serif; white-space: nowrap;">${escapeHTML(requesterName || '-')}</td> -->
          <td class="col-process_status" style="padding: 12px 16px; font-size: 13px; font-family: 'Inter', sans-serif; white-space: nowrap;">
            <span style="display:inline-flex; align-items:center; padding:4px 8px; border-radius:6px; font-size:12px; font-weight:500; ${getBadgeStyles(processStatus, r.process_status_color)}">${escapeHTML(t_val(processStatus))}</span>
          </td>
          <td class="col-sr_status" style="padding: 12px 16px; font-size: 13px; font-family: 'Inter', sans-serif; white-space: nowrap;">
            <span style="display:inline-flex; align-items:center; padding:4px 8px; border-radius:6px; font-size:12px; font-weight:500; ${getBadgeStyles(approvalDisplay)}">${escapeHTML(t_val(approvalDisplay))}</span>
          </td>
          ${ratingCellHTML}
          <td class="col-created_date" style="padding: 12px 16px; font-size: 13px; font-weight: 400; color: #6B7280; font-family: 'Inter', sans-serif; white-space: nowrap;">${escapeHTML(createdDateOnly)}</td>
        </tr>
      `;
    }
    return '';
  }).join('');
}

window.toggleDashboardFilter = function (viewKey, filterKey, filterValue, checked) {
  if (!dashboardFilters[filterKey]) dashboardFilters[filterKey] = new Set();
  if (checked) {
    dashboardFilters[filterKey].add(filterValue);
  } else {
    dashboardFilters[filterKey].delete(filterValue);
    if (dashboardFilters[filterKey].size === 0) delete dashboardFilters[filterKey];
  }
  savePersistedFilters(viewKey);
  currentDashboardPage = 1;
  applyDashboardFilters(viewKey);
};

window.clearDashboardFilters = function (viewKey) {
  dashboardFilters = {};
  savePersistedFilters(viewKey);
  currentDashboardPage = 1;
  // Uncheck all checkboxes
  document.querySelectorAll('.dv-filter-option input[type="checkbox"]').forEach(cb => cb.checked = false);
  applyDashboardFilters(viewKey);
};

function applyDashboardFilters(viewKey) {
  const container = document.getElementById(`dv-cards-list-${viewKey}`);
  const pagination = document.getElementById(`dv-pagination-${viewKey}`);
  if (!container) return;

  const showDashboardActions = ['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(viewKey);

  const searchQuery = (moduleStates[viewKey]?.search || '').toLowerCase().trim();

  const filteredData = dashboardData.filter(r => rowMatchesDashboardFilters(viewKey, r, { searchQuery }));

  // Paginate
  const total = filteredData.length;
  const totalPages = Math.ceil(total / DASHBOARD_PAGE_SIZE) || 1;
  if (currentDashboardPage > totalPages) currentDashboardPage = totalPages;
  if (currentDashboardPage < 1) currentDashboardPage = 1;

  const start = (currentDashboardPage - 1) * DASHBOARD_PAGE_SIZE;
  const paginatedData = filteredData.slice(start, start + DASHBOARD_PAGE_SIZE);

  // Render cards
  if (['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(viewKey)) {
    const showRatingHeader = !['my_team', 'my_process_owner', 'my_task', 'my_approval'].includes(viewKey);
    const colspanVal = showRatingHeader ? 7 : 6;
    const ratingHeaderHTML = showRatingHeader ? `<th style="padding: 12px 16px; font-size: 13px; font-weight: 600; color: #6B7280; text-align: left; font-family: 'Inter', sans-serif; border-bottom: 1px solid #E5E7EB;">${typeof t === 'function' ? t('col.rating', 'Rating') : 'Rating'}</th>` : '';
    const actionMenuHeaderHTML = showDashboardActions ? `<th class="request-row-menu-cell" style="width: 40px; min-width: 40px; max-width: 40px; padding: 0; text-align: center; border-bottom: 1px solid #E5E7EB;"></th>` : '';
    const actionHeaderHTML = showDashboardActions ? `<th style="padding: 12px 16px; font-size: 13px; font-weight: 600; color: #6B7280; text-align: center; font-family: 'Inter', sans-serif; border-bottom: 1px solid #E5E7EB;">${t('col.actions', 'Actions')}</th>` : '';
    const dateHeaderLabel = ['my_process_owner', 'my_task', 'my_approval'].includes(viewKey) ? (typeof t === 'function' ? t('col.submit_date', 'Submited Date') : 'Submited Date') : (typeof t === 'function' ? t('col.created_date', 'Created Date') : 'Created Date');

    if (paginatedData.length === 0) {
      container.innerHTML = `<table class="data-table modern-table dv-table-container" style="width: 100%; border-collapse: collapse; background: #ffffff; font-family: 'Inter', sans-serif;"><tbody><tr><td colspan="${colspanVal}" style="padding:40px; text-align:center; color:var(--text-muted);"><div class="empty-state"><div class="empty-icon material-symbols-rounded">inbox</div><div class="empty-title">No requests found</div></div></td></tr></tbody></table>`;
    } else {
      container.innerHTML = `
        <table class="data-table modern-table dv-table-container" style="width: 100%; border-collapse: collapse; background: #ffffff; font-family: 'Inter', sans-serif;">
          <thead>
            <tr style="height: 48px; border-bottom: 1px solid #E5E7EB; background: #F8FAFC;">
              ${actionMenuHeaderHTML}
              <th class="col-description" style="position: relative; padding: 12px 16px; font-size: 13px; font-weight: 600; color: #6B7280; text-align: left; font-family: 'Inter', sans-serif; border-bottom: 1px solid #E5E7EB;">${t('col.description', 'Description')}<div class="col-resizer" onclick="event.stopPropagation()"></div></th>
              <th class="col-type" style="position: relative; padding: 12px 16px; font-size: 13px; font-weight: 600; color: #6B7280; text-align: left; font-family: 'Inter', sans-serif; border-bottom: 1px solid #E5E7EB;">${t('col.type', 'Type')}<div class="col-resizer" onclick="event.stopPropagation()"></div></th>
              <!-- <th style="padding: 12px 16px; font-size: 13px; font-weight: 600; color: #6B7280; text-align: left; font-family: 'Inter', sans-serif; border-bottom: 1px solid #E5E7EB;">Requester</th> -->
              <th class="col-process_status" style="position: relative; padding: 12px 16px; font-size: 13px; font-weight: 600; color: #6B7280; text-align: left; font-family: 'Inter', sans-serif; border-bottom: 1px solid #E5E7EB;">${t('col.process_status', 'Process Status')}<div class="col-resizer" onclick="event.stopPropagation()"></div></th>
              <th class="col-sr_status" style="position: relative; padding: 12px 16px; font-size: 13px; font-weight: 600; color: #6B7280; text-align: left; font-family: 'Inter', sans-serif; border-bottom: 1px solid #E5E7EB;">${t('col.sr_status', 'SR Status')}<div class="col-resizer" onclick="event.stopPropagation()"></div></th>
              ${showRatingHeader ? `<th class="col-rating" style="position: relative; padding: 12px 16px; font-size: 13px; font-weight: 600; color: #6B7280; text-align: left; font-family: 'Inter', sans-serif; border-bottom: 1px solid #E5E7EB;">${typeof t === 'function' ? t('col.rating', 'FeedBack') : 'FeedBack'}<div class="col-resizer" onclick="event.stopPropagation()"></div></th>` : ''}
              <th class="col-created_date" style="position: relative; padding: 12px 16px; font-size: 13px; font-weight: 600; color: #6B7280; text-align: left; font-family: 'Inter', sans-serif; border-bottom: 1px solid #E5E7EB;">${dateHeaderLabel}<div class="col-resizer" onclick="event.stopPropagation()"></div></th>
            </tr>
          </thead>
          <tbody>
            ${buildRequestCards(viewKey, paginatedData)}
          </tbody>
        </table>
      `;
    }
  } else {
    const cardsHTML = buildRequestCards(viewKey, paginatedData);
    container.innerHTML = Array.isArray(cardsHTML) ? cardsHTML.join('') : cardsHTML;
  }
  container.scrollTop = 0;

  // Update Status Cards dynamically based on filtered data
  const statusCardsHTML = buildStatusCards(viewKey, filteredData);
  updateGlobalStatusCards(statusCardsHTML);
  const statusContainer = document.querySelector(`#view-${viewKey} .dv-status-cards-outer`);
  if (statusContainer) {
    statusContainer.innerHTML = statusCardsHTML;
  }

  // Render pagination controls
  if (pagination) {
    if (['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(viewKey)) {
      let paginationHTML = `
        <div style="font-size:13px; font-weight: 500; color: #6B7280; font-family: 'Inter', sans-serif;">
          Showing <strong style="color: #111827;">${start + 1}-${Math.min(start + DASHBOARD_PAGE_SIZE, total)}</strong> of <strong style="color: #111827;">${total}</strong> records
        </div>
        <div style="display: flex; gap: 8px; align-items: center; height: 48px;">
          <button class="btn" onclick="changeDashboardPage('${viewKey}', ${currentDashboardPage - 1})" ${currentDashboardPage <= 1 ? 'disabled' : ''} style="height: 36px !important; padding: 6px 12px !important; font-size: 13px !important; border: 1px solid #E5E7EB !important; border-radius: 6px !important; background: #FFFFFF !important; color: #374151 !important; font-weight: 500 !important; cursor: pointer; transition: all 0.2s ease;">${t('table.prev', 'Prev')}</button>
          
          ${Array.from({ length: totalPages }).map((_, i) => {
        const pageNum = i + 1;
        const isActive = pageNum === currentDashboardPage;
        if (totalPages > 5 && pageNum !== 1 && pageNum !== totalPages && Math.abs(pageNum - currentDashboardPage) > 1) {
          if (pageNum === 2 || pageNum === totalPages - 1) {
            return `<span style="color: #9CA3AF; padding: 0 4px;">...</span>`;
          }
          return '';
        }
        return `
              <button class="btn" onclick="changeDashboardPage('${viewKey}', ${pageNum})" style="height: 36px !important; width: 36px !important; padding: 0 !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; font-size: 13px !important; border: 1px solid ${isActive ? '#FF6A00' : '#E5E7EB'} !important; border-radius: 6px !important; background: ${isActive ? '#FFF1E8' : '#FFFFFF'} !important; color: ${isActive ? '#FF6A00' : '#374151'} !important; font-weight: ${isActive ? '600' : '500'} !important; cursor: pointer; transition: all 0.2s ease;">${pageNum}</button>
            `;
      }).join('')}
          
          <button class="btn" onclick="changeDashboardPage('${viewKey}', ${currentDashboardPage + 1})" ${currentDashboardPage >= totalPages ? 'disabled' : ''} style="height: 36px !important; padding: 6px 12px !important; font-size: 13px !important; border: 1px solid #E5E7EB !important; border-radius: 6px !important; background: #FFFFFF !important; color: #374151 !important; font-weight: 500 !important; cursor: pointer; transition: all 0.2s ease;">${t('table.next', 'Next')}</button>
        </div>
      `;
      pagination.innerHTML = paginationHTML;
      pagination.style.background = '#FFFFFF';
      pagination.style.borderTop = '1px solid #E5E7EB';
      pagination.style.padding = '12px 16px';
    } else {
      pagination.innerHTML = `
        <div style="font-size:12px; color: var(--text-muted);">
          Page <strong style="color: var(--text-primary);">${currentDashboardPage}</strong> of <strong>${totalPages}</strong>
          <span style="margin: 0 8px;">|</span> Total <strong>${total}</strong> records
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-outline btn-sm" onclick="changeDashboardPage('${viewKey}', ${currentDashboardPage - 1})" ${currentDashboardPage <= 1 ? 'disabled' : ''}>Prev</button>
          <button class="btn btn-outline btn-sm" onclick="changeDashboardPage('${viewKey}', ${currentDashboardPage + 1})" ${currentDashboardPage >= totalPages ? 'disabled' : ''}>Next</button>
        </div>
      `;
    }
  }

  // Faceted Search: Update Dropdown Filter counts dynamically
  const filterInputs = document.querySelectorAll(`#view-${viewKey} .dv-filter-option input`);
  if (filterInputs.length > 0) {
    const countsByFilterKey = {};
    const filterKeys = [...new Set(Array.from(filterInputs).map(input => input.dataset.filterKey).filter(Boolean))];
    filterKeys.forEach(filterKey => {
      const counts = {};
      dashboardData.forEach(r => {
        if (!rowMatchesDashboardFilters(viewKey, r, { searchQuery, excludeFilterKey: filterKey })) return;
        const value = getDashboardFilterValue(viewKey, r, filterKey);
        const values = Array.isArray(value) ? value : [value];
        values.forEach(v => {
          const key = String(v);
          counts[key] = (counts[key] || 0) + 1;
        });
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

window.changeDashboardPage = function (viewKey, page) {
  currentDashboardPage = page;
  applyDashboardFilters(viewKey);
};

const debouncedFilterDashboardTable = debounce((viewKey, query) => {
  if (!moduleStates[viewKey]) moduleStates[viewKey] = {};
  moduleStates[viewKey].search = query;
  moduleStates[viewKey].serverSearch = query.trim();
  currentDashboardPage = 1;
  savePersistedFilters(viewKey);
  loadDashboardView(viewKey);
}, 400);

window.filterDashboardTable = function (viewKey, query) {
  debouncedFilterDashboardTable(viewKey, query);
};

window.triggerDashboardGlobalSearch = function (viewKey, query) {
  if (!moduleStates[viewKey]) moduleStates[viewKey] = {};
  moduleStates[viewKey].serverSearch = query;
  savePersistedFilters(viewKey);
  loadDashboardView(viewKey);
};


window.loadDashboardView = loadDashboardView;
window.renderDashboardView = renderDashboardView;
window.applyDashboardFilters = applyDashboardFilters;
window.buildStatusCards = buildStatusCards;
window.buildFilterSidebar = buildFilterSidebar;
window.buildRequestCards = buildRequestCards;
