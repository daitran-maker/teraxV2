/**
 * CRC App - Permissions, Roles, Branding & Menu Policy Service
 * Extracted as part of Modularization
 */

window.userPermissionsMap = {};
window.userDeniedColumns = {};
window.userActionPermissions = {};

window.isColumnAllowed = function (moduleKey, colKey) {
  if (authUser.role && authUser.role.toUpperCase() === 'SUPER ADMIN') return true;
  if (!window.userDeniedColumns) return true;
  const actualTable = ['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(moduleKey) ? 'request' : moduleKey;
  const deniedList = window.userDeniedColumns[actualTable] || window.userDeniedColumns[moduleKey];
  if (!deniedList) return true;
  return !deniedList.includes(colKey);
};

window.isActionAllowed = function (viewName, actionId) {
  let viewKey = viewName.toLowerCase();
  const actId = actionId.toLowerCase();

  if (viewKey === 'support') {
    if (actId === 'add' || actId === 'edit') return true;
    if (actId === 'delete') return false;
  }
  if (viewKey === 'oppotunity' || viewKey === 'oppo' || viewKey === 'opportunity') {
    if (actId === 'add' || actId === 'edit' || actId === 'delete') return true;
  }

  if (!window.userActionPermissions) return false;

  const actionRules = window.userActionPermissions[actId];
  if (!actionRules) {
    return false;
  }

  // Strict check for add, edit, delete: must have an explicit rule in database for this view
  if (['add', 'edit', 'delete'].includes(actId)) {
    if (actionRules[viewKey] !== undefined) {
      return actionRules[viewKey];
    }
    // Fallback for virtual views mapped to request
    if (['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(viewKey)) {
      if (actionRules['request'] !== undefined) {
        return actionRules['request'];
      }
    }
    return false;
  }

  if (actionRules[viewKey] !== undefined) {
    return actionRules[viewKey];
  }

  if (actionRules['*'] !== undefined) {
    return actionRules['*'];
  }

  return false;
};

window.isActionAllowedWithContext = function (childKey, actionId, parentKey) {
  if (!window.userActionPermissions) return true;

  const actionRules = window.userActionPermissions[actionId.toLowerCase()];
  if (!actionRules) {
    return true;
  }

  // Check context-specific rule first (e.g. 'expense@request')
  if (parentKey) {
    let normalizedParentKey = parentKey.toLowerCase();
    if (['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(normalizedParentKey)) {
      normalizedParentKey = 'request';
    }
    const contextKey = `${childKey.toLowerCase()}@${normalizedParentKey}`;
    if (actionRules[contextKey] !== undefined) {
      return actionRules[contextKey];
    }
  }

  // Fall back to general child key rule (e.g. 'expense')
  const viewKey = childKey.toLowerCase();
  if (actionRules[viewKey] !== undefined) {
    return actionRules[viewKey];
  }

  if (actionRules['*'] !== undefined) {
    return actionRules['*'];
  }

  return true;
};

window.isChildTableActionAllowed = function (childKey, actionId, parentKey = currentModule) {
  let normalizedParentKey = parentKey;
  const hashModule = window.location.hash.replace('#', '').split('/')[0];
  const activeRecord = (currentView === 'detail' && window.currentDetailRecord)
    ? window.currentDetailRecord
    : (typeof currentRecord !== 'undefined' ? currentRecord : null);

  // Feedback (request_rating), Comments, History & Logs, and Finance never allow manual Add or Duplicate action
  const nonAddableDuplicateChildTables = ['logs', 'request_activity_log', 'history', 'request_rating', 'rating', 'feedback', 'comment', 'ticket_comment', 'finance'];
  if (nonAddableDuplicateChildTables.includes(childKey)) {
    if (actionId === 'add' || actionId === 'duplicate' || actionId === 'create') {
      return false;
    }
    if (['logs', 'request_activity_log', 'history', 'finance'].includes(childKey)) {
      return false;
    }
  }

  // Determine effective parent view (e.g. from hash #my_approval/REQ-xxx -> my_approval)
  const effectiveView = (['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(hashModule))
    ? hashModule
    : (['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(normalizedParentKey)
      ? normalizedParentKey
      : (['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(currentModule)
        ? currentModule
        : (normalizedParentKey || currentModule)));

  // Only my_company, account, and allowed request views can add or duplicate child records
  if (actionId === 'add' || actionId === 'create' || actionId === 'duplicate') {
    const allowedParentModulesForChildAdd = [
      'my_company',
      'account',
      'request',
      'my_request',
      'my_process_owner',
      'my_task',
      'my_team'
    ];
    const parentCandidates = [effectiveView, normalizedParentKey, hashModule, currentModule]
      .filter(Boolean)
      .map(v => String(v).toLowerCase());
    const isParentAllowed = allowedParentModulesForChildAdd.some(p => parentCandidates.includes(p));
    if (!isParentAllowed) {
      return false;
    }
  }

  // Block adding payment or invoice if the parent view is a request view and the request has contract element
  if (actionId === 'add' && (childKey === 'payment' || childKey === 'invoice')) {
    if (['request', 'my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(effectiveView)) {
      let elementsVal = activeRecord ? (activeRecord.elements || activeRecord.policy_elements) : null;
      if (!elementsVal && activeRecord && activeRecord.request_type) {
        try {
          if (typeof selectCache !== 'undefined' && selectCache['policy']) {
            const policy = selectCache['policy'].find(p => String(p.policy_id) === String(activeRecord.request_type));
            if (policy) elementsVal = policy.elements;
          }
        } catch (e) { }
      }
      let activeElements = [];
      if (elementsVal) {
        if (Array.isArray(elementsVal)) {
          activeElements = elementsVal.map(s => String(s).replace(/^\[|\]$/g, '').trim().toUpperCase());
        } else if (typeof elementsVal === 'string') {
          activeElements = elementsVal.split(',').map(s => String(s).trim().replace(/^\[|\]$/g, '').toUpperCase()).filter(Boolean);
        }
      }
      if (activeElements.includes('CONTRACT')) {
        return false;
      }
    }
  }

  // Bypass general requestChildren restriction for contract parent
  if (normalizedParentKey === 'contract' && (childKey === 'payment' || childKey === 'invoice')) {
    return isActionAllowedWithContext(childKey, actionId, normalizedParentKey);
  }

  // For company (Customer / Supplier): ONLY contact can be added/edited/acted upon from this view
  if (hashModule === 'company' || normalizedParentKey === 'company' || currentModule === 'company') {
    if (childKey === 'contact') {
      return isActionAllowedWithContext(childKey, actionId, normalizedParentKey);
    }
    return false;
  }

  // Auto allow child tables under my_company detail view
  if (hashModule === 'my_company' || normalizedParentKey === 'my_company' || currentModule === 'my_company') {
    return isActionAllowedWithContext(childKey, actionId, normalizedParentKey);
  }

  const isRequestParent = ['request', 'my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(effectiveView)
    || ['request', 'my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(normalizedParentKey)
    || ['request', 'my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(hashModule)
    || ['request', 'my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(currentModule);

  if (isRequestParent) {
    const requestChildren = ['payment', 'expense', 'invoice', 'service', 'asset', 'contract', 'target_table'];
    if (requestChildren.includes(childKey)) {
      // In my_approval (My Approvals), child table management is NEVER allowed.
      if (effectiveView === 'my_approval') {
        return false;
      }

      // target_table is special: allowed in my_request, my_task, my_team, and request (New Request)
      const isSpecialChild = childKey === 'target_table';
      const allowedViews = isSpecialChild ? ['my_request', 'my_task', 'my_team', 'request'] : ['my_process_owner', 'my_task', 'my_team'];
      if (!allowedViews.includes(effectiveView)) {
        return false;
      }

      if (authUser && authUser.role && authUser.role.toUpperCase() === 'SUPER ADMIN') {
        return isActionAllowedWithContext(childKey, actionId, normalizedParentKey);
      }

      if (activeRecord) {
        const userEmpId = (authUser?.employee_id || '').toLowerCase();
        const requester = (activeRecord.requester || '').toLowerCase();
        const creator = (activeRecord.sr_creater || '').toLowerCase();
        const srOwnerArr = Array.isArray(activeRecord.sr_owner)
          ? activeRecord.sr_owner.map(s => String(s).toLowerCase())
          : (activeRecord.sr_owner ? [String(activeRecord.sr_owner).toLowerCase()] : []);
        const policyLead = (activeRecord.policy_lead || '').toLowerCase();

        const isUserOwnerOrLead = srOwnerArr.includes(userEmpId) || userEmpId === policyLead;
        const isRequesterOrCreator = userEmpId === requester || userEmpId === creator;

        if (isSpecialChild) {
          // Special child tables: target_table and assigned_task
          // Allowed for Requester, Creator, SR Owner, Policy Lead in my_request, my_task, my_team even when Not started yet / Draft
          if (isRequesterOrCreator || isUserOwnerOrLead) {
            return isActionAllowedWithContext(childKey, actionId, normalizedParentKey);
          }
          return false;
        }

        // For standard child tables (payment, invoice, mtr, service, asset, contract):
        if (['my_task', 'my_process_owner'].includes(effectiveView) && !srOwnerArr.includes(userEmpId) && userEmpId !== policyLead) {
          return false;
        }
        if (effectiveView === 'my_team' && userEmpId !== policyLead && !srOwnerArr.includes(userEmpId)) {
          return false;
        }

        const processStatus = Number(activeRecord.process_status);
        const isProcessing = processStatus === 8;
        const isCompleted = processStatus === 9;

        const isProcessHandler = (isProcessing || isCompleted) && isUserOwnerOrLead;

        if (isProcessHandler) {
          return isActionAllowedWithContext(childKey, actionId, normalizedParentKey);
        } else {
          return false;
        }
      }
    }
  }

  return isActionAllowedWithContext(childKey, actionId, normalizedParentKey);
};

async function applyCustomBranding() {
  const toggleEl = document.getElementById('sidebar-toggle');
  try {
    const res = await fetch('/api/public/brand-info');
    const brand = await res.json();

    if (brand && brand.has_branding && brand.logo) {
      // 1. Dynamic Favicon & Apple Touch Icon (AppIcon)
      const iconUrl = brand.icon || brand.logo;
      if (iconUrl) {
        let favIcon = document.querySelector("link[rel*='icon']");
        if (favIcon) favIcon.href = iconUrl;
        let appleIcon = document.querySelector("link[rel='apple-touch-icon']");
        if (appleIcon) appleIcon.href = iconUrl;
      }

      // 2. Dynamic App Title
      if (brand.app_title) {
        document.title = brand.app_title;
      }

      // 3. Transparent PNG Logo for Sidebar (Full + Collapsed)
      if (toggleEl) {
        toggleEl.innerHTML = `
          <img class="sidebar-logo-full" src="${brand.logo}" alt="${escapeHTML(brand.brand_name || 'Brand')}" style="max-height: 28px; max-width: 140px; width: auto; object-fit: contain; background: transparent; transition: opacity 0.2s ease;" />
          <img class="sidebar-logo-collapsed" src="${brand.logo}" alt="${escapeHTML(brand.brand_name || 'Brand')}" style="max-height: 24px; width: 24px; object-fit: contain; background: transparent; display: none;" />
        `;
      }

      // 4. Mobile Menu Button Icon
      const mobileImg = document.querySelector('#mobileMenuBtn img');
      if (mobileImg) {
        mobileImg.src = brand.logo;
        mobileImg.style.background = 'transparent';
      }
      return;
    }
  } catch (e) {
    console.warn('Failed to load brand info for custom branding:', e);
  }

  // Fallback to default TeraX branding
  document.title = 'TeraX – Company Request Center';
  if (toggleEl) {
    toggleEl.innerHTML = `
      <img class="sidebar-logo-full" src="/assets/terax-logo-light.png" alt="TeraX" style="height: 24px; max-width: 140px; object-fit: contain; transition: opacity 0.2s ease;" />
      <img class="sidebar-logo-collapsed" src="/assets/terax-icon-light.png" alt="X" style="height: 24px; width: 24px; object-fit: contain; display: none;" />
    `;
  }
}


async function applyMenuPermissions() {
  if (!localStorage.getItem('crc_token')) return;
  try {
    const permissionsMap = await apiGet('/permissions/my-slices');
    window.userPermissionsMap = permissionsMap;

    // Fetch and store subscription info locally
    try {
      const tenantInfoRes = await apiGet('/table/cms_tenant_info');
      const tenantData = tenantInfoRes.data && Array.isArray(tenantInfoRes.data) ? tenantInfoRes.data : (Array.isArray(tenantInfoRes) ? tenantInfoRes : []);
      if (tenantData.length > 0) {
        window.cmsTenantInfo = tenantData[0];
        // Apply custom company logo if branding is supported
        await applyCustomBranding();
      }
    } catch (e) {
      console.warn('Failed to load cms_tenant_info on startup:', e);
    }

    try {
      const deniedColumns = await apiGet('/permissions/my-columns');
      window.userDeniedColumns = deniedColumns || {};
    } catch (colErr) {
      console.error('Error fetching column permissions:', colErr);
    }

    try {
      const actionPermissions = await apiGet('/permissions/my-action-permissions');
      window.userActionPermissions = actionPermissions || {};
    } catch (actErr) {
      console.error('Error fetching action permissions:', actErr);
      window.userActionPermissions = {};
    }

    document.querySelectorAll('.nav-item').forEach(el => {
      const moduleKey = el.getAttribute('data-module');
      if (moduleKey) {
        if (permissionsMap[moduleKey] === false) {
          el.style.display = 'none';
        } else {
          el.style.display = '';
        }
      }
    });

    // Also hide entire sidebar-sections if they are empty
    document.querySelectorAll('.sidebar-section').forEach(section => {
      const links = Array.from(section.querySelectorAll('.nav-item'));
      if (links.length > 0) {
        const visibleItems = links.filter(el => el.style.display !== 'none');
        if (visibleItems.length === 0) {
          section.style.display = 'none';
        } else {
          section.style.display = '';
        }
      }
    });

    // Check Settings submenu visibility dynamically
    const settingsSub = document.getElementById('settings-submenu');
    const settingsParent = document.getElementById('nav-settings');
    if (settingsSub && settingsParent) {
      const subLinks = Array.from(settingsSub.querySelectorAll('.nav-item'));
      const visibleSubLinks = subLinks.filter(el => el.style.display !== 'none');
      if (visibleSubLinks.length === 0) {
        settingsParent.style.display = 'none';
        settingsSub.style.display = 'none';
      } else {
        settingsParent.style.display = '';
      }
    }
  } catch (err) {
    console.error('Error applying menu permissions:', err);
  }
}

function adjustSidebarForHelpdesk() {
  if (!window.isHelpdesk) return;
  const toHide = [
    'nav-my_request', 'nav-my_approval', 'nav-my_process_owner', 'nav-my_task', 'nav-my_team',
    'nav-my_company', 'nav-department',
    'nav-payment', 'nav-invoice', 'nav-account',
    'nav-service', 'nav-asset', 'nav-request_activity_log'
  ];
  toHide.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  const supportEl = document.querySelector('#nav-support span[data-i18n="nav.support"]');
  if (supportEl) {
    supportEl.textContent = typeof i18next !== 'undefined' ? i18next.t('nav.support', 'Support') : 'Support';
  }
  document.querySelectorAll('.sidebar-section').forEach(sec => {
    const visibleLinks = Array.from(sec.querySelectorAll('a.nav-item')).filter(a => a.style.display !== 'none');
    if (visibleLinks.length === 0) {
      sec.style.display = 'none';
    }
  });
}

// ============================================================
// INIT
// ============================================================
window.addEventListener('DOMContentLoaded', async () => {
  // Load i18n locale
  await loadLocale(currentLang);

  // Fetch Setup Status (with 6s timeout so slow DB doesn't block the whole app)
  if (localStorage.getItem('crc_token')) {
    try {
      const setupStatus = await Promise.race([
        apiGet('/system-setup/status'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Setup status timeout')), 6000))
      ]);
      window.setupCompleted = setupStatus.setupCompleted;
      window.setupTableCounts = setupStatus.tableCounts;
      window.isHelpdesk = setupStatus.isHelpdesk || false;
      if (window.setupCompleted === false) {
        document.body.classList.add('setup-active');
        const navSetup = document.getElementById('nav-setup');
        if (navSetup) navSetup.style.display = 'flex';
      }
    } catch (err) {
      console.error('Error fetching setup status:', err);
      window.setupCompleted = true; // default on error
    }
  }

  // Apply menu permissions (with 6s timeout — permissions load in background if slow)
  await Promise.race([
    applyMenuPermissions(),
    new Promise(resolve => setTimeout(resolve, 6000))
  ]);

  // Adjust sidebar layout for helpdesk app
  adjustSidebarForHelpdesk();

  // Show the sidebar nav once adjusted
  const sidebarNav = document.querySelector('.sidebar-nav');
  if (sidebarNav) {
    sidebarNav.style.opacity = '1';
  }

  // Set Greeting
  const wrapperEl = document.getElementById('topbar-greeting-wrapper');
  const timeEl = document.getElementById('topbar-greeting-time');
  const nameEl = document.getElementById('topbar-greeting-name');
  if (wrapperEl && authUser) {
    const displayName = authUser.nick_name || authUser.nickname || authUser.full_name || authUser.full_name_employee || authUser.employee_name || authUser.email || 'User';

    if (timeEl) timeEl.textContent = 'Hi,';
    if (nameEl) nameEl.textContent = ` ${displayName}`;
    wrapperEl.title = `Hi, ${displayName}`;
  }

  // Render language selector in sidebar
  const langContainer = document.getElementById('sidebar-lang-container');
  if (langContainer) langContainer.innerHTML = buildLangSelectorHTML('sidebar-lang-selector', 'width:100%;');

  // Update static texts with i18n
  updateStaticTexts();

  // Remove loading spinner
  const loader = document.getElementById('global-loading');
  if (loader) loader.remove();

  // Hash routing
  window.addEventListener('hashchange', handleHashChange);

  // Initial route - sometimes browsers need a tiny tick to parse hash correctly after redirects
  setTimeout(handleHashChange, 50);

  // Start background auto-refresh
  startAutoSync();
});

// Import / Export CSV & XLSX extracted to js/services/exportService.js

function updateProcessDescriptionDetails(policy) {
  const textEl = document.getElementById('process-description-text');
  const attachmentsEl = document.getElementById('process-description-attachments');
  const hiddenInput = document.getElementById('f-process_type_description');

  if (!textEl) return;

  if (!policy) {
    textEl.textContent = '';
    if (attachmentsEl) {
      attachmentsEl.innerHTML = '';
      attachmentsEl.style.display = 'none';
    }
    if (hiddenInput) hiddenInput.value = '';
    return;
  }

  const desc = policy.description || '';
  let dept = policy.department_name || policy.department || '';
  if (!dept && policy.department_id && typeof selectCache !== 'undefined' && selectCache['department']) {
    const dMatch = selectCache['department'].find(d => String(d.department_id) === String(policy.department_id));
    if (dMatch) dept = dMatch.department_name || dMatch.name || '';
  }
  if (!dept && policy.policy_type) {
    dept = policy.policy_type;
  }

  let displayText = '';
  if (desc && dept) {
    displayText = `${desc} | ${dept}`;
  } else {
    displayText = desc || dept || policy.policy_name || '';
  }

  textEl.textContent = displayText || '';
  if (hiddenInput) hiddenInput.value = displayText || '';

  // Update links & files as clean links without icons
  let attachmentsHTML = '';
  if (policy.procedure_link && policy.procedure_link.trim()) {
    attachmentsHTML += `
      <a href="${escapeHTML(policy.procedure_link.trim())}" target="_blank" style="color: #2563EB; font-weight: 500; text-decoration: underline; font-size: 12px;">
        Link: ${escapeHTML(policy.procedure_link.trim())}
      </a>
    `;
  }
  if (policy.procedure_file && policy.procedure_file.trim()) {
    const fileVal = policy.procedure_file.trim();
    const fileName = fileVal.split('/').pop() || 'Procedure File';
    attachmentsHTML += `
      <a href="${escapeHTML(fileVal)}" target="_blank" style="color: #2563EB; font-weight: 500; text-decoration: underline; font-size: 12px;">
        File: ${escapeHTML(fileName)}
      </a>
    `;
  }

  if (attachmentsEl) {
    if (attachmentsHTML) {
      attachmentsEl.innerHTML = attachmentsHTML;
      attachmentsEl.style.display = 'flex';
    } else {
      attachmentsEl.innerHTML = '';
      attachmentsEl.style.display = 'none';
    }
  }
}

function updateApprovalLevelVisibility(policy) {
  const approvalLevelField = document.getElementById('f-approval_level');
  if (!approvalLevelField) return;
  const container = approvalLevelField.closest('.form-field');
  if (!container) return;

  if (!policy) {
    container.style.setProperty('display', 'none', 'important');
    return;
  }

  // 1. Get standard approval level as a number
  let processTierLevel = 0;
  const pLevel = policy.approval_level || '';
  if (pLevel) {
    const lvlStr = pLevel.toLowerCase();
    if (lvlStr.includes('tier 3')) {
      processTierLevel = 3;
    } else if (lvlStr.includes('tier 2')) {
      processTierLevel = 2;
    } else if (lvlStr.includes('tier 1')) {
      processTierLevel = 1;
    } else if (lvlStr.includes('tier 0')) {
      processTierLevel = 0;
    }
  }

  // 2. Count total configured approver columns
  let totalConfiguredTiers = 0;
  if (policy.tier3_approval && policy.tier3_approval.trim()) {
    totalConfiguredTiers = 3;
  } else if (policy.tier2_approval && policy.tier2_approval.trim()) {
    totalConfiguredTiers = 2;
  } else if (policy.tier1_approval && policy.tier1_approval.trim()) {
    totalConfiguredTiers = 1;
  }

  // 3. Evaluate visibility condition
  let showNonStandard = false;
  if (pLevel && !pLevel.toLowerCase().includes('tier 0') && processTierLevel < totalConfiguredTiers) {
    showNonStandard = true;
  }

  if (showNonStandard) {
    container.style.removeProperty('display');
  } else {
    container.style.setProperty('display', 'none', 'important');
    approvalLevelField.value = 'Standard';
  }
}

async function initProcessDescriptionAndVisibility() {
  const typeEl = document.getElementById('f-ticket_type') || document.getElementById('f-request_type');
  const policyId = typeEl ? typeEl.value : null;
  if (!policyId) {
    updateProcessDescriptionDetails(null);
    updateApprovalLevelVisibility(null);
    const assignTabBtn = document.getElementById('wizard-tab-assign');
    if (assignTabBtn) assignTabBtn.style.display = 'none';
    return;
  }
  try {
    const policies = await getSelectOptions('policy');
    const policy = policies.find(p => String(p.policy_id) === String(policyId));
    if (policy) {
      updateProcessDescriptionDetails(policy);
      updateApprovalLevelVisibility(policy);
      const rawElements = policy ? (policy.elements || policy.element || '') : '';
      const elementsStr = Array.isArray(rawElements) ? rawElements.join(' ').toLowerCase() : String(rawElements).toLowerCase();
      const hasAssignTask = elementsStr.includes('assign_task') || elementsStr.includes('assign task');
      const assignTabBtn = document.getElementById('wizard-tab-assign');
      if (assignTabBtn) {
        assignTabBtn.style.display = hasAssignTask ? 'inline-block' : 'none';
        if (hasAssignTask && typeof window.initEmbeddedAssignTask === 'function') {
          window.initEmbeddedAssignTask('embedded-assign-task-wizard-container');
        }
      }
    } else {
      updateProcessDescriptionDetails(null);
      updateApprovalLevelVisibility(null);
      const assignTabBtn = document.getElementById('wizard-tab-assign');
      if (assignTabBtn) assignTabBtn.style.display = 'none';
    }
  } catch (err) {
    console.warn('Error during initProcessDescriptionAndVisibility:', err);
  }
}

window.handleRequestTypeChange = async function (sourceField) {
  const typeEl = document.getElementById('f-ticket_type') || document.getElementById('f-request_type');
  const policyId = typeEl ? typeEl.value : null;
  if (!policyId) {
    updateProcessDescriptionDetails(null);
    updateApprovalLevelVisibility(null);
    return;
  }

  try {
    const isTicketType = !!document.getElementById('f-ticket_type');
    const optionSource = (isTicketType && typeof MODULES !== 'undefined' && MODULES['helpdesk_policy']) ? 'helpdesk_policy' : 'policy';
    const policies = await getSelectOptions(optionSource);
    const policy = policies.find(p => String(p.policy_id) === String(policyId));
    if (!policy) {
      updateProcessDescriptionDetails(null);
      updateApprovalLevelVisibility(null);
      return;
    }

    // 1. Generate SR ID/Ticket ID if empty (New record)
    const idInput = document.getElementById('f-ticket_id') || document.getElementById('f-sr_id');
    if (idInput && !idInput.value) {
      const now = new Date();
      const dateStr = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
      const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
      idInput.value = (isTicketType ? 'TK-' : 'SR-') + dateStr + '-' + randomStr;
    }

    // 2. Map standard fields (only if type changed)
    if (sourceField === 'request_type' || sourceField === 'ticket_type') {
      const fieldsToMap = {
        'f-policy_lead': policy.policy_lead || '',
        'f-sr_owner': policy.sr_owner || '',
        'f-sr_coordinator': policy.sr_coordinator || policy.sr_owner || '',
        'f-approval_level': policy.approval_level || '',
        'f-tier_1_status': 'Not started yet',
        'f-tier_2_status': 'Not started yet',
        'f-tier_3_status': 'Not started yet',
        'f-process_status': 'Not started yet',
        'f-process_type_description': policy.description || '',
      };

      const srStatusInput = document.getElementById('f-sr_status');
      if (srStatusInput && (!srStatusInput.value || srStatusInput.value === 'Draft')) {
        srStatusInput.value = 'Draft';
      }

      for (const [id, val] of Object.entries(fieldsToMap)) {
        const input = document.getElementById(id);
        if (input) input.value = val;
      }

      // Update visible details
      updateProcessDescriptionDetails(policy);
      updateApprovalLevelVisibility(policy);

      const rawElements = policy ? (policy.elements || policy.element || '') : '';
      const elementsStr = Array.isArray(rawElements) ? rawElements.join(' ').toLowerCase() : String(rawElements).toLowerCase();
      const hasAssignTask = elementsStr.includes('assign_task') || elementsStr.includes('assign task');
      const assignTabBtn = document.getElementById('wizard-tab-assign');
      if (assignTabBtn) {
        assignTabBtn.style.display = hasAssignTask ? 'inline-block' : 'none';
        if (hasAssignTask && typeof window.initEmbeddedAssignTask === 'function') {
          window.initEmbeddedAssignTask('embedded-assign-task-wizard-container');
        }
      }
    }

    // 3. Resolve Approvers (Tier 1, 2, 3)
    let requesterEmail = document.getElementById('f-requester')?.value;
    if (!requesterEmail && authUser.email) requesterEmail = authUser.email;

    // Resolve requester's company entity - Disabled to keep REQUESTER and MY COMPANY independent
    /*
    const companyInput = document.getElementById('f-company_id');
    if (companyInput && requesterEmail && (sourceField === 'requester' || !companyInput.value)) {
      try {
        const emp = await apiGet(`/table/employee/${requesterEmail}?pk=email`);
        if (emp && emp.company_id) {
          const companies = await getSelectOptions('my_company');
          const comp = companies.find(c => String(c.my_company_id) === String(emp.company_id));
          companyInput.value = comp ? comp.company_shortname : '';
        } else {
          companyInput.value = '';
        }
        companyInput.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (err) {
        console.warn('Could not resolve company for requester:', err);
      }
    }
    */

    const resolveApprover = async (policyVal, targetFieldId) => {
      const targetEl = document.getElementById(targetFieldId);
      if (!targetEl) return;

      if (policyVal && policyVal.toLowerCase() === 'direct manager' && requesterEmail) {
        try {
          const emp = await apiGet(`/table/employee/${requesterEmail}?pk=email`);
          if (emp && emp.direct_manager) {
            targetEl.value = emp.direct_manager;
          } else {
            targetEl.value = '';
          }
        } catch (err) {
          console.warn(`Could not resolve manager for ${targetFieldId}:`, err);
          targetEl.value = '';
        }
      } else {
        targetEl.value = policyVal || '';
      }
    };

    await resolveApprover(policy.tier1_approval, 'f-tier_1_approval');
    await resolveApprover(policy.tier2_approval, 'f-tier_2_approval');
    await resolveApprover(policy.tier3_approval, 'f-tier_3_approval');

  } catch (err) {
    console.error('Error auto-filling request form:', err);
  }
};




// Window Bridge for Permission Service
window.applyCustomBranding = applyCustomBranding;
window.applyMenuPermissions = applyMenuPermissions;
window.adjustSidebarForHelpdesk = adjustSidebarForHelpdesk;
window.updateProcessDescriptionDetails = updateProcessDescriptionDetails;
window.updateApprovalLevelVisibility = updateApprovalLevelVisibility;
window.initProcessDescriptionAndVisibility = initProcessDescriptionAndVisibility;
window.handleRequestTypeChange = handleRequestTypeChange;
