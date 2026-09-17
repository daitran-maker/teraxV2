/**
 * CRC App - Tab Router & Hash Navigation
 * Extracted as part of Modularization
 */

// MODULE_META now uses i18n t() for dynamic translation
function getModuleMeta(moduleKey) {
  return {
    title: t(`module.${moduleKey}.title`, t(`nav.${moduleKey}`, moduleKey)),
    subtitle: t(`module.${moduleKey}.subtitle`, '')
  };
}

// ============================================================
// ROUTING & NAVIGATION
// ============================================================
window.appNavHistory = window.appNavHistory || [];

function isRootPath(pathStr) {
  if (!pathStr) return true;
  const cleanPath = pathStr.split('&')[0];
  const parts = cleanPath.split('/');
  return parts.length <= 1 || !parts[1];
}

window.goBack = function (fallbackModule) {
  if (window.appNavHistory && window.appNavHistory.length > 1) {
    window.location.hash = window.appNavHistory[window.appNavHistory.length - 2];
  } else {
    window.location.hash = fallbackModule;
  }
};

window.closeTabPane = function (paneId, event) {
  if (event) event.stopPropagation();
  const pane = document.getElementById(paneId);
  if (!pane) return;
  const isClosingActive = pane.id === 'content';
  pane.remove();

  if (isClosingActive) {
    const remainingPanes = Array.from(document.querySelectorAll('.main > .content, .main > [id^="pane-"]'));
    if (remainingPanes.length > 0) {
      const targetPane = remainingPanes.find(p => isRootPath(p.dataset.hash || '')) || remainingPanes[0];
      window.location.hash = targetPane.dataset.hash || 'my_request';
    } else {
      window.location.hash = 'my_request';
    }
  } else {
    renderTabsBar();
  }
};

window.closeOtherTabs = function (keepPaneId) {
  const panes = Array.from(document.querySelectorAll('.main > .content, .main > [id^="pane-"]'));
  panes.forEach(p => {
    if (p.id !== keepPaneId) {
      p.remove();
    }
  });
  const remaining = document.getElementById(keepPaneId) || document.getElementById('content');
  if (remaining && remaining.id !== 'content') {
    remaining.id = 'content';
    remaining.style.display = '';
    window.location.hash = remaining.dataset.hash || 'my_request';
  }
  renderTabsBar();
  hideTabContextMenu();
};

window.closeTabsToRight = function (currentPaneId) {
  const panes = Array.from(document.querySelectorAll('.main > .content, .main > [id^="pane-"]'));
  const currentIndex = panes.findIndex(p => p.id === currentPaneId);
  if (currentIndex !== -1) {
    for (let i = currentIndex + 1; i < panes.length; i++) {
      panes[i].remove();
    }
  }
  if (!document.getElementById('content')) {
    const pane = document.getElementById(currentPaneId);
    if (pane) {
      pane.id = 'content';
      pane.style.display = '';
      window.location.hash = pane.dataset.hash || 'my_request';
    }
  }
  renderTabsBar();
  hideTabContextMenu();
};

window.closeAllDetailTabs = function () {
  const panes = Array.from(document.querySelectorAll('.main > .content, .main > [id^="pane-"]'));
  let rootPane = null;
  panes.forEach(p => {
    const hash = p.dataset.hash || p.id.replace('pane-', '').replace(/-/, '/');
    if (!isRootPath(hash)) {
      p.remove();
    } else if (!rootPane) {
      rootPane = p;
    }
  });
  if (!document.getElementById('content') && rootPane) {
    rootPane.id = 'content';
    rootPane.style.display = '';
    window.location.hash = rootPane.dataset.hash || 'my_request';
  } else if (!document.getElementById('content')) {
    window.location.hash = 'my_request';
  }
  renderTabsBar();
  hideTabContextMenu();
};

window.closeAllTabs = function () {
  const panes = Array.from(document.querySelectorAll('.main > [id^="pane-"]'));
  panes.forEach(p => p.remove());
  const content = document.getElementById('content');
  if (content) content.remove();
  window.location.hash = 'my_request';
  hideTabContextMenu();
};

window.reloadCurrentTabPane = function (paneId) {
  const pane = document.getElementById(paneId);
  if (pane) {
    const hash = pane.dataset.hash || '';
    pane.remove();
    const content = document.getElementById('content');
    if (content && content.id === paneId) content.remove();
    window.location.hash = '';
    setTimeout(() => {
      window.location.hash = hash || 'my_request';
    }, 10);
  }
  hideTabContextMenu();
};

window.hideTabContextMenu = function () {
  const menu = document.getElementById('tab-context-menu-dropdown');
  if (menu) menu.remove();
};

window.hideTabsDropdown = function () {
  const menu = document.getElementById('topbar-tabs-dropdown-menu');
  if (menu) menu.remove();
};

window.refreshTabsDropdown = function () {
  const existing = document.getElementById('topbar-tabs-dropdown-menu');
  if (!existing) return;
  existing.remove();
  const panes = Array.from(document.querySelectorAll('.main > .content, .main > [id^="pane-"]'));
  if (panes.length > 5) {
    toggleTabsDropdown();
  }
};

window.toggleTabsDropdown = function (event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  const existing = document.getElementById('topbar-tabs-dropdown-menu');
  if (existing) {
    existing.remove();
    return;
  }
  hideTabContextMenu();

  const panes = Array.from(document.querySelectorAll('.main > .content, .main > [id^="pane-"]'));
  if (panes.length === 0) return;

  const btn = (event && event.currentTarget) ? event.currentTarget : document.querySelector('.tab-dropdown-btn');
  const rect = btn ? btn.getBoundingClientRect() : { bottom: 50, right: 300 };

  const menu = document.createElement('div');
  menu.id = 'topbar-tabs-dropdown-menu';
  menu.className = 'tab-dropdown-menu';

  const titleHeader = typeof t === 'function' ? t('tab_menu.open_views', 'Các view đang mở') : 'Các view đang mở';
  let itemsHtml = `
    <div class="tab-dropdown-menu-header">
      <span>${titleHeader}</span>
      <span style="background:#E2E8F0; color:#475569; padding:1px 6px; border-radius:10px; font-size:10px;">${panes.length}</span>
    </div>
  `;

  panes.forEach(p => {
    const isActive = p.id === 'content';
    const hash = p.dataset.hash || p.id.replace('pane-', '').replace(/-/, '/');
    let title = p.dataset.title || 'Tab';
    const isRoot = isRootPath(hash);
    const icon = isRoot ? 'grid_view' : 'description';

    itemsHtml += `
      <div class="tab-dropdown-item ${isActive ? 'active' : ''}" onclick="window.location.hash = '${hash}'; hideTabsDropdown();" title="${escapeHTML(p.dataset.title || '')}">
        <span class="material-symbols-rounded" style="font-size:16px; opacity:${isActive ? '1' : '0.6'}; flex-shrink:0;">${icon}</span>
        <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex:1;">${escapeHTML(title)}</span>
        ${isActive ? '<span class="material-symbols-rounded" style="font-size:16px; color:#2563EB; flex-shrink:0;">check</span>' : ''}
        ${panes.length > 1 ? `<span class="material-symbols-rounded tab-dropdown-item-close" onclick="event.stopPropagation(); closeTabPane('${p.id}', event); refreshTabsDropdown();" title="Đóng tab">close</span>` : ''}
      </div>
    `;
  });

  menu.innerHTML = itemsHtml;
  document.body.appendChild(menu);

  // Calculate position
  const x = Math.min(rect.left, window.innerWidth - 300);
  const y = rect.bottom + 6;
  menu.style.left = `${Math.max(10, x)}px`;
  menu.style.top = `${y}px`;
};

document.addEventListener('click', (e) => {
  if (!e.target.closest('#tab-context-menu-dropdown')) {
    hideTabContextMenu();
  }
  if (!e.target.closest('#topbar-tabs-dropdown-menu') && !e.target.closest('.tab-dropdown-btn')) {
    hideTabsDropdown();
  }
});
document.addEventListener('contextmenu', (e) => {
  if (!e.target.closest('.topbar-tab-item')) {
    hideTabContextMenu();
  }
});

window.showTabContextMenu = function (event, paneId) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  hideTabContextMenu();
  hideTabsDropdown();

  const pane = document.getElementById(paneId);
  if (!pane) return;

  const hash = pane.dataset.hash || '';
  const isRoot = isRootPath(hash);
  const panes = Array.from(document.querySelectorAll('.main > .content, .main > [id^="pane-"]'));
  const currentIndex = panes.findIndex(p => p.id === paneId);
  const hasRightTabs = currentIndex !== -1 && currentIndex < panes.length - 1;
  const hasOtherTabs = panes.length > 1;
  const hasDetailTabs = panes.some(p => !isRootPath(p.dataset.hash || ''));

  const menu = document.createElement('div');
  menu.id = 'tab-context-menu-dropdown';
  menu.className = 'tab-context-menu';

  let menuHtml = `
    <div class="tab-context-menu-item" onclick="closeTabPane('${paneId}', event); hideTabContextMenu();">
      <span class="material-symbols-rounded" style="font-size:16px; opacity:0.7;">close</span>
      <span>Đóng tab này</span>
    </div>
  `;

  if (hasOtherTabs) {
    menuHtml += `
      <div class="tab-context-menu-item" onclick="closeOtherTabs('${paneId}')">
        <span class="material-symbols-rounded" style="font-size:16px; opacity:0.7;">tab_close</span>
        <span>Đóng các tab khác</span>
      </div>
    `;
  }

  if (hasRightTabs) {
    menuHtml += `
      <div class="tab-context-menu-item" onclick="closeTabsToRight('${paneId}')">
        <span class="material-symbols-rounded" style="font-size:16px; opacity:0.7;">tab_close_right</span>
        <span>Đóng các tab bên phải</span>
      </div>
    `;
  }

  if (hasDetailTabs) {
    menuHtml += `
      <div class="tab-context-menu-item" onclick="closeAllDetailTabs()">
        <span class="material-symbols-rounded" style="font-size:16px; opacity:0.7;">clear_all</span>
        <span>Đóng tất cả tab chi tiết</span>
      </div>
    `;
  }

  menuHtml += `
    <div class="tab-context-menu-divider"></div>
    <div class="tab-context-menu-item" onclick="reloadCurrentTabPane('${paneId}')">
      <span class="material-symbols-rounded" style="font-size:16px; opacity:0.7;">refresh</span>
      <span>Tải lại tab</span>
    </div>
  `;

  if (hasOtherTabs) {
    menuHtml += `
      <div class="tab-context-menu-item danger" onclick="closeAllTabs()">
        <span class="material-symbols-rounded" style="font-size:16px;">delete_sweep</span>
        <span>Đóng tất cả tab</span>
      </div>
    `;
  }

  menu.innerHTML = menuHtml;
  document.body.appendChild(menu);

  // Position calculation
  const clickX = event.clientX || 100;
  const clickY = event.clientY || 100;
  const x = Math.min(clickX, window.innerWidth - 210);
  const y = Math.min(clickY, window.innerHeight - 260);
  menu.style.left = `${Math.max(10, x)}px`;
  menu.style.top = `${Math.max(10, y)}px`;
};

window.showTabQuickMenu = function (event) {
  const activePane = document.getElementById('content') || document.querySelector('.main > [id^="pane-"]');
  if (activePane) {
    showTabContextMenu(event, activePane.id);
  }
};

function renderTabsBar() {
  const tabsBar = document.getElementById('topbar-tabs-container') || document.getElementById('tabs-bar');
  if (!tabsBar) return;
  const panes = Array.from(document.querySelectorAll('.main > .content, .main > [id^="pane-"]'));

  if (panes.length === 0) {
    tabsBar.innerHTML = '';
    tabsBar._lastRenderedHtml = '';
    hideTabsDropdown();
    return;
  }

  // Keep tab order stable based on DOM order so active tab doesn't jump to the start
  const orderedPanes = panes;

  let listHtml = '';
  orderedPanes.forEach(p => {
    const isActive = p.id === 'content';
    const hash = p.dataset.hash || p.id.replace('pane-', '').replace(/-/, '/');
    let title = p.dataset.title || '';
    if (!title) {
      const pMod = hash.split('&')[0].split('/')[0];
      const pMeta = typeof getModuleMeta === 'function' ? getModuleMeta(pMod) : null;
      title = (pMeta && pMeta.title) ? pMeta.title : (typeof MODULES !== 'undefined' && MODULES[pMod] ? MODULES[pMod].label : pMod);
    }
    if (title.length > 20) title = title.substring(0, 20) + '...';

    const isRoot = isRootPath(hash);
    const icon = isRoot ? 'grid_view' : 'description';

    listHtml += `
      <div class="topbar-tab-item ${isActive ? 'active' : ''}" onclick="window.location.hash = '${hash}'" oncontextmenu="showTabContextMenu(event, '${p.id}')" title="${escapeHTML(p.dataset.title || title)} (Chuột phải để mở menu thao tác)">
        <span class="material-symbols-rounded" style="font-size:13px; opacity:${isActive ? '0.8' : '0.6'}; flex-shrink:0;">${icon}</span>
        <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:130px;">${escapeHTML(title)}</span>
        ${panes.length > 1 ? `<span class="material-symbols-rounded topbar-tab-close-btn" style="font-size:13px;" onclick="closeTabPane('${p.id}', event)" title="Đóng tab">close</span>` : ''}
      </div>
    `;
  });

  let dropdownBtnHtml = '';
  if (panes.length > 5) {
    dropdownBtnHtml = `
      <div class="topbar-tab-item tab-dropdown-btn" onclick="toggleTabsDropdown(event)" title="Danh sách các view đang mở (${panes.length} tab)">
        <span class="tab-dropdown-count">${panes.length}</span>
        <span class="material-symbols-rounded" style="font-size:18px; color:#475569;">expand_more</span>
      </div>
    `;
  }

  let quickMenuHtml = '';
  if (panes.length > 1) {
    quickMenuHtml = `
      <div class="topbar-tab-item tab-quick-menu-btn" style="padding:0 6px; height:32px; width:32px; display:inline-flex; align-items:center; justify-content:center; border-radius:6px; opacity:0.75; flex-shrink:0; cursor:pointer;" onclick="showTabQuickMenu(event)" title="Tùy chọn quản lý tab">
        <span class="material-symbols-rounded" style="font-size:16px;">more_horiz</span>
      </div>
    `;
  }

  const targetHtml = `
    <div id="topbar-tabs-list" style="display:flex; overflow-x:auto; gap:4px; flex:1; scrollbar-width:none; align-items:center; height:100%;">
      ${listHtml}
    </div>
    ${dropdownBtnHtml}
    ${quickMenuHtml}
  `;

  if (tabsBar._lastRenderedHtml !== targetHtml) {
    tabsBar.innerHTML = targetHtml;
    tabsBar._lastRenderedHtml = targetHtml;
  }
  tabsBar.style.display = 'flex';

  // Safely scroll active tab inside tabsList without triggering page jumps
  const tabsList = tabsBar.querySelector('#topbar-tabs-list');
  const activeTabEl = tabsBar.querySelector('.topbar-tab-item.active');
  if (tabsList && activeTabEl) {
    const listRect = tabsList.getBoundingClientRect();
    const tabRect = activeTabEl.getBoundingClientRect();
    if (tabRect.left < listRect.left) {
      tabsList.scrollLeft -= (listRect.left - tabRect.left + 8);
    } else if (tabRect.right > listRect.right) {
      tabsList.scrollLeft += (tabRect.right - listRect.right + 8);
    }
  }
}

function updatePaneMeta(title, hashOverride) {
  const content = document.getElementById('content');
  if (content) {
    if (title) content.dataset.title = title.replace(/<[^>]*>?/gm, ''); // Strip HTML if any
    content.dataset.hash = hashOverride || window.location.hash.substring(1);
    content.dataset.isRoot = isRootPath(content.dataset.hash) ? 'true' : 'false';
    if (content.dataset.statusCardsHTML !== undefined) {
      updateGlobalStatusCards(content.dataset.statusCardsHTML);
    }
  }
  const topbarTitle = document.getElementById('topbar-title');
  if (topbarTitle && content && content.dataset.title) {
    topbarTitle.innerHTML = content.dataset.title;
  }
  renderTabsBar();
}

async function handleHashChange() {
  const hash = window.location.hash.substring(1); // Remove '#'

  if (window.setupCompleted === false && hash !== 'setup') {
    window.location.hash = 'setup';
    return;
  }

  if (!hash) {
    if (window.setupCompleted === false) {
      window.location.hash = 'setup';
    } else {
      window.location.hash = 'home';
    }
    return;
  }

  const [path] = hash.split('&');
  const parts = path.split('/');
  const moduleKey = parts[0];
  if (moduleKey === 'operation_program') {
    window.location.hash = 'request';
    return;
  }
  if (moduleKey === 'my_task') {
    const newHash = hash.replace(/^my_task/, 'my_process_owner');
    window.location.hash = newHash;
    return;
  }

  // Prevent loading restricted modules if permissions map is loaded
  if (window.userPermissionsMap && window.userPermissionsMap[moduleKey] === false) {
    if (['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(moduleKey)) {
      redirectToAccessDenied();
      return;
    }

    showToast('Access denied: You do not have permission to view this section.', 'warning');
    const fallback = Object.keys(window.userPermissionsMap).find(k => window.userPermissionsMap[k] !== false) || 'my_request';
    window.location.hash = fallback;
    return;
  }

  let oldHash = null;
  if (window.appNavHistory && window.appNavHistory.length > 0) {
    oldHash = window.appNavHistory[window.appNavHistory.length - 1];
  }

  let isBackNavigation = false;
  // History tracking for smart Back button
  if (window.appNavHistory.length > 1 && window.appNavHistory[window.appNavHistory.length - 2] === hash) {
    window.appNavHistory.pop();
    isBackNavigation = true;
  } else if (window.appNavHistory[window.appNavHistory.length - 1] !== hash) {
    window.appNavHistory.push(hash);
  }

  const [pathForCheck] = hash.split('&');
  const pkValCheck = pathForCheck.split('/')[1];

  let oldPathForCheck = oldHash ? oldHash.split('&')[0] : null;

  const isCurrentTargetRoot = isRootPath(pathForCheck);

  // TAB / PANE MANAGEMENT FOR INSTANT NAVIGATION & ROOT VS DETAIL RULES
  if (oldHash && oldHash !== hash && oldPathForCheck !== pathForCheck) {
    const oldPane = document.getElementById('content');
    if (oldPane) {
      const scrollEl = oldPane.querySelector('.table-container') || oldPane.querySelector('.detail-scroll') || oldPane;
      oldPane.dataset.scrollTop = scrollEl ? scrollEl.scrollTop : (window.scrollY || 0);
      oldPane.dataset.scrollLeft = scrollEl ? scrollEl.scrollLeft : (window.scrollX || 0);
      oldPane.id = 'pane-' + oldPathForCheck.replace(/[^a-zA-Z0-9_-]/g, '-');
      oldPane.style.display = 'none';
    }

    // Never remove the pane we are about to switch to; clean up older panes only if total pane count exceeds 25
    const allPanes = Array.from(document.querySelectorAll('.main > [id^="pane-"]'));
    const targetPaneId = 'pane-' + pathForCheck.replace(/[^a-zA-Z0-9_-]/g, '-');
    if (allPanes.length > 25) {
      const toRemove = allPanes.find(p => p.id !== targetPaneId);
      if (toRemove) toRemove.remove();
    }
  }

  let newPaneId = 'pane-' + pathForCheck.replace(/[^a-zA-Z0-9_-]/g, '-');
  let newPane = null;

  if (oldPathForCheck !== pathForCheck) {
    newPane = document.getElementById(newPaneId);
  }

  if (newPane) {
    newPane.id = 'content';
    newPane.style.display = '';
    setTimeout(() => {
      const scrollEl = newPane.querySelector('.table-container') || newPane.querySelector('.detail-scroll') || newPane;
      if (scrollEl) {
        if (newPane.dataset.scrollTop !== undefined) scrollEl.scrollTop = parseInt(newPane.dataset.scrollTop, 10);
        if (newPane.dataset.scrollLeft !== undefined) scrollEl.scrollLeft = parseInt(newPane.dataset.scrollLeft, 10);
      }
    }, 10);

    const [path] = hash.split('&');
    const parts = path.split('/');
    currentModule = parts[0];
    currentView = parts[1] ? 'detail' : (['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(currentModule) ? 'dashboard' : 'table');

    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.id === `nav-${currentModule}`);
    });

    const mod = MODULES[currentModule];
    const meta = getModuleMeta(currentModule);
    const topbarTitle = document.getElementById('topbar-title');
    if (topbarTitle) topbarTitle.innerHTML = newPane.dataset.title || meta.title || (mod ? mod.label : currentModule) || currentModule;
    const topbarSubtitle = document.getElementById('topbar-subtitle');
    if (topbarSubtitle) topbarSubtitle.textContent = meta.subtitle || '';

    updatePaneMeta();
    if (newPane.dataset.dirty === 'true') {
      delete newPane.dataset.dirty;
      if (currentView === 'table') {
        loadModule(currentModule, false);
      } else if (currentView === 'detail') {
        openDetailInternal(currentModule, parts[1], true, true);
      } else if (currentView === 'dashboard') {
        loadDashboardView(currentModule);
      }
    }
    return; // SKIP re-rendering, use cached DOM pane!
  } else {
    let existingContent = document.getElementById('content');
    if (!existingContent) {
      const mainContent = document.querySelector('.main');
      if (mainContent) {
        newPane = document.createElement('div');
        newPane.className = 'content fade-in';
        newPane.id = 'content';
        newPane.dataset.hash = hash;
        const initialMeta = typeof getModuleMeta === 'function' ? getModuleMeta(moduleKey) : null;
        newPane.dataset.title = (initialMeta && initialMeta.title) ? initialMeta.title : (typeof MODULES !== 'undefined' && MODULES[moduleKey] ? MODULES[moduleKey].label : moduleKey);
        newPane.dataset.isRoot = isRootPath(hash) ? 'true' : 'false';
        mainContent.appendChild(newPane);
      }
    }
  }

  const queryParts = hash.split('&').slice(1);
  const queryString = queryParts.join('&');
  const pkVal = parts[1];

  let urlPage = null;
  if (queryString) {
    const params = new URLSearchParams(queryString);
    if (params.has('page')) urlPage = parseInt(params.get('page'));
  }

  const DASHBOARD_VIEWS = ['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'];

  if (moduleKey === 'automation') {
    if (pkVal) {
      loadAutomationDetail(pkVal);
    } else {
      loadAutomationView();
    }
  } else if (moduleKey === 'setup') {
    loadSetupView();
  } else if (moduleKey === 'home') {
    // Dashboard Home View
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.id === 'nav-home');
    });
    currentModule = 'home';
    currentView = 'dashboard';
    const topbarTitle = document.getElementById('topbar-title');
    if (topbarTitle) topbarTitle.innerHTML = 'Dashboard';
    const topbarSubtitle = document.getElementById('topbar-subtitle');
    if (topbarSubtitle) topbarSubtitle.textContent = 'Tổng quan & Thông báo';
    if (typeof loadHomeDashboard === 'function') {
      loadHomeDashboard();
    }
  } else if (DASHBOARD_VIEWS.includes(moduleKey)) {
    // Dashboard View
    if (!window.userPermissionsMap) {
      try {
        window.userPermissionsMap = await apiGet('/permissions/my-slices');
      } catch (err) {
        console.error('Error loading page permissions:', err);
      }
    }
    if (window.userPermissionsMap && window.userPermissionsMap[moduleKey] === false) {
      redirectToAccessDenied();
      return;
    }

    if (pkVal) {
      // Record ID -> open detail in request module
      openDetailInternal('request', pkVal);
    } else {
      document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.toggle('active', el.id === `nav-${moduleKey}`);
      });
      loadDashboardView(moduleKey);
    }
  } else if (MODULES[moduleKey]) {
    if (pkVal) {
      // Record ID provided -> Open Detail View
      openDetailInternal(moduleKey, pkVal);
    } else if (moduleKey === 'cms_tenant_info') {
      // Fetch the single record from the backend, then navigate to detail
      apiGet(MODULES.cms_tenant_info?.endpoint || '/table/cms_tenant_info')
        .then(res => {
          const data = res.data && Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []);
          if (data.length > 0) {
            const pkField = MODULES.cms_tenant_info.pk || 'id';
            window.location.hash = `cms_tenant_info/${data[0][pkField]}`;
          } else {
            loadModule(moduleKey, false);
          }
        })
        .catch(err => {
          console.error('Failed to auto-redirect to subscription detail:', err);
          loadModule(moduleKey, false);
        });
    } else {
      if (!moduleStates[moduleKey]) moduleStates[moduleKey] = {};
      if (urlPage) moduleStates[moduleKey].page = urlPage;

      // Only Module -> Load Table View
      if (currentModule !== moduleKey || currentView !== 'table') {
        const shouldForceReportReload = !!(window.reportReloadNeeded && window.reportReloadNeeded[moduleKey]);
        if (shouldForceReportReload) delete window.reportReloadNeeded[moduleKey];
        const isReturningToSameModuleList = !shouldForceReportReload && (currentModule === moduleKey && currentView === 'detail' && currentData.length > 0 && (!urlPage || urlPage === currentTablePage));
        loadModule(moduleKey, isReturningToSameModuleList);
      } else if (urlPage && urlPage !== currentTablePage) {
        renderTableView(moduleKey, urlPage, false);
      }
    }
  } else {
    window.location.hash = 'home';
  }
}

// Window Bridge for Tab Router
window.getModuleMeta = getModuleMeta;
window.isRootPath = isRootPath;
window.renderTabsBar = renderTabsBar;
window.updatePaneMeta = updatePaneMeta;
window.handleHashChange = handleHashChange;
