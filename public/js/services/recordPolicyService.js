/**
 * CRC App - Record Actions, Permissions & SLA Policy Service
 * Extracted as part of Modularization
 */

function calculateRequestSLA(r, customPolicySLA = null) {
  if (!r) {
    const naText = typeof t === 'function' ? t('badge.sla_na', 'Không áp dụng SLA') : 'Không áp dụng SLA';
    return { durationFormatted: '—', badgeLabel: naText, badgeClass: 'badge-blue', badgeStyle: 'background: #F3F4F6; color: #6B7280; border: 1px solid #E5E7EB;' };
  }

  let slaVal = customPolicySLA;
  if (slaVal === null || slaVal === undefined || slaVal === '') {
    slaVal = r.policy_sla;
  }
  if (slaVal === null || slaVal === undefined || slaVal === '') {
    try {
      if (typeof selectCache !== 'undefined' && selectCache['policy'] && r.request_type) {
        const p = selectCache['policy'].find(x => String(x.policy_id) === String(r.request_type));
        if (p && p.sla !== undefined && p.sla !== null && p.sla !== '') {
          slaVal = p.sla;
        }
      }
    } catch (e) { }
  }

  const numSLA = (slaVal !== null && slaVal !== undefined && slaVal !== '') ? Number(slaVal) : null;
  const hasSLA = (numSLA !== null && !isNaN(numSLA) && numSLA > 0);

  const startDateStr = r.process_start_date;
  const endDateStr = r.process_end_date;

  const unitDay = typeof t === 'function' ? t('unit.days', 'd') : 'd';
  const unitHour = typeof t === 'function' ? t('unit.hours', 'h') : 'h';
  const runningStr = typeof t === 'function' ? t('badge.sla_running', 'đang chạy') : 'đang chạy';
  const naText = typeof t === 'function' ? t('badge.sla_na', 'Không áp dụng SLA') : 'Không áp dụng SLA';
  const pendingText = typeof t === 'function' ? t('badge.sla_pending', 'Chưa bắt đầu') : 'Chưa bắt đầu';
  const qualifiedText = typeof t === 'function' ? t('badge.sla_qualified', 'Đạt SLA') : 'Đạt SLA';
  const breachedText = typeof t === 'function' ? t('badge.sla_breached', 'Trễ SLA') : 'Trễ SLA';
  const inProgressText = typeof t === 'function' ? t('badge.sla_in_progress', 'Trong hạn') : 'Trong hạn';
  const overdueText = typeof t === 'function' ? t('badge.sla_overdue', 'Quá hạn') : 'Quá hạn';

  if (!startDateStr) {
    return {
      hasSLA,
      slaDays: numSLA,
      durationDays: null,
      durationHours: null,
      durationFormatted: '—',
      status: 'pending',
      badgeLabel: pendingText,
      badgeClass: 'badge-blue',
      badgeStyle: 'background: #F1F5F9; color: #64748B; border: 1px solid #CBD5E1;'
    };
  }

  const startDate = new Date(startDateStr);
  if (isNaN(startDate.getTime())) {
    return {
      hasSLA,
      slaDays: numSLA,
      durationDays: null,
      durationHours: null,
      durationFormatted: '—',
      status: 'pending',
      badgeLabel: pendingText,
      badgeClass: 'badge-blue',
      badgeStyle: 'background: #F1F5F9; color: #64748B; border: 1px solid #CBD5E1;'
    };
  }

  const isCompleted = !!endDateStr;
  const endDate = isCompleted ? new Date(endDateStr) : new Date();

  const diffMs = Math.max(0, endDate.getTime() - startDate.getTime());
  const durationHours = diffMs / (1000 * 60 * 60);
  const durationDays = durationHours / 24;

  let durationFormatted = '';
  if (durationDays >= 1) {
    durationFormatted = `${durationDays.toFixed(2)} ${unitDay} (${durationHours.toFixed(1)} ${unitHour})`;
  } else {
    durationFormatted = `${durationHours.toFixed(2)} ${unitHour} (${durationDays.toFixed(2)} ${unitDay})`;
  }

  if (!hasSLA) {
    return {
      hasSLA: false,
      slaDays: null,
      durationDays: Number(durationDays.toFixed(2)),
      durationHours: Number(durationHours.toFixed(2)),
      durationFormatted: isCompleted ? durationFormatted : `${durationFormatted} (${runningStr})`,
      status: 'no_sla',
      badgeLabel: naText,
      badgeClass: 'badge-blue',
      badgeStyle: 'background: #F3F4F6; color: #6B7280; border: 1px solid #E5E7EB;'
    };
  }

  if (isCompleted) {
    if (durationDays <= numSLA) {
      return {
        hasSLA: true,
        slaDays: numSLA,
        durationDays: Number(durationDays.toFixed(2)),
        durationHours: Number(durationHours.toFixed(2)),
        durationFormatted,
        status: 'qualified',
        badgeLabel: qualifiedText,
        badgeClass: 'badge-active',
        badgeStyle: 'background: #ECFDF5; color: #059669; border: 1px solid #A7F3D0;'
      };
    } else {
      return {
        hasSLA: true,
        slaDays: numSLA,
        durationDays: Number(durationDays.toFixed(2)),
        durationHours: Number(durationHours.toFixed(2)),
        durationFormatted,
        status: 'breached',
        badgeLabel: breachedText,
        badgeClass: 'badge-inactive',
        badgeStyle: 'background: #FEF2F2; color: #DC2626; border: 1px solid #FECACA;'
      };
    }
  } else {
    // In progress (now - start_date)
    if (durationDays > numSLA) {
      return {
        hasSLA: true,
        slaDays: numSLA,
        durationDays: Number(durationDays.toFixed(2)),
        durationHours: Number(durationHours.toFixed(2)),
        durationFormatted: `${durationFormatted} (${runningStr})`,
        status: 'overdue',
        badgeLabel: overdueText,
        badgeClass: 'badge-inactive',
        badgeStyle: 'background: #FFF1F2; color: #E11D48; border: 1px solid #FDA4AF;'
      };
    } else {
      return {
        hasSLA: true,
        slaDays: numSLA,
        durationDays: Number(durationDays.toFixed(2)),
        durationHours: Number(durationHours.toFixed(2)),
        durationFormatted: `${durationFormatted} (${runningStr})`,
        status: 'in_progress',
        badgeLabel: inProgressText,
        badgeClass: 'badge-yellow',
        badgeStyle: 'background: #FFFBEB; color: #D97706; border: 1px solid #FDE68A;'
      };
    }
  }
}
window.calculateRequestSLA = calculateRequestSLA;

/**
 * Logic to determine if the current user can edit a specific record
 * This checks record-level BUSINESS RULES only (e.g. request status).
 * The RBAC permission gate is handled separately by isActionAllowed().
 */
function fieldContainsEmail(value, email) {
  const target = String(email || '').toLowerCase();
  if (!target) return false;

  if (Array.isArray(value)) {
    return value.some(v => String(v || '').toLowerCase() === target);
  }

  return String(value || '')
    .split(',')
    .map(v => v.trim().replace(/^\[|\]$/g, '').toLowerCase())
    .some(v => v === target);
}

function shouldHideRequestEditDeleteActions(moduleKey) {
  const hashModule = window.location.hash.replace('#', '').split('/')[0];
  return [moduleKey, hashModule, currentModule]
    .map(v => String(v || '').toLowerCase())
    .some(v => ['my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(v));
}

function shouldHideRequestDynamicAction(moduleKey, actionId) {
  return (['my_request', 'my_approval'].includes(moduleKey) && actionId === 'ACT-REQUEST-02') ||
    (['my_task', 'my_process_owner'].includes(moduleKey) && actionId === 'ACT-REQUEST-04');
}

function shouldShowRequestChildTables(moduleKey, record) {
  const requestViews = ['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team', 'request'];
  const isActualRequest = requestViews.includes(String(moduleKey || '').toLowerCase());
  if (!isActualRequest) return true;

  const processStatusNum = Number(record?.process_status);
  return [8, 9].includes(processStatusNum);
}

function hasModuleRealChildren(moduleKey, pkVal, mod) {
  if (moduleKey === 'policy' && pkVal === 'VIRTUAL_OPPORTUNITY') return true;
  if (moduleKey === 'target_table') return true;
  if (!mod || !mod.children) return false;
  return mod.children.length > 0;
}

function getAllowedDetailChildModules(moduleKey, record, childModules) {
  if (shouldShowRequestChildTables(moduleKey, record)) return childModules;

  return childModules.filter(childKey =>
    childKey === 'target_table' ||
    childKey === 'assigned_task' ||
    childKey === 'comment' ||
    childKey === 'ticket_comment' ||
    childKey === 'logs'
  );
}

function canUserEditRecord(moduleKey, record) {
  if (!authUser) return false;
  if (moduleKey === 'my_approval') {
    return false; // Edit not shown in My Approval view
  }

  if (moduleKey === 'assigned_task' && record) {
    if (authUser.role && authUser.role.toUpperCase() === 'SUPER ADMIN') return true;
    const userEmpId = (authUser.employee_id || '').toLowerCase();
    const isAssignee = String(record.employee_id).toLowerCase() === userEmpId;
    if (currentRecord && String(currentRecord.request_id) === String(record.request_id)) {
      const isLeadOrOwner = (
        userEmpId === (currentRecord.sr_creater || '').toLowerCase() ||
        userEmpId === (currentRecord.requester || '').toLowerCase() ||
        userEmpId === (currentRecord.policy_lead || '').toLowerCase() ||
        fieldContainsEmail(currentRecord.sr_owner, userEmpId)
      );
      if (isLeadOrOwner || isAssignee) return true;
    }
    return isAssignee;
  }

  const actualModule = ['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team', 'request'].includes(moduleKey) ? 'request' : moduleKey;

  if (actualModule === 'request') {
    let isTier1Approved = false;
    let flow = record.approval_flow;
    if (typeof flow === 'string') {
      try { flow = JSON.parse(flow); } catch (e) { }
    }
    if (flow && Array.isArray(flow.steps)) {
      const step1 = flow.steps.find(s => s.level === 1);
      if (step1 && String(step1.status || '').toLowerCase().startsWith('approved')) {
        isTier1Approved = true;
      }
    } else {
      const tier1Status = String(record.tier_1_status || '').toLowerCase().trim();
      isTier1Approved = tier1Status.startsWith('approved');
    }
    const srStatus = Number(record.sr_status);
    if (srStatus !== 1 && String(record.sr_status || '').toLowerCase().trim() !== 'draft') {
      return false;
    }

    const creator = record.sr_creater;
    const requester = record.requester;

    // 2. Super Admin can edit if the status itself is editable
    if (authUser.role && authUser.role.toUpperCase() === 'SUPER ADMIN') return true;

    // 3. View-specific User check:
    const userEmpId = (authUser.employee_id || '').toLowerCase();

    if (moduleKey === 'my_request') {
      const isCreatorOrRequester = (
        userEmpId === (creator || '').toLowerCase() ||
        userEmpId === (requester || '').toLowerCase()
      );
      return isCreatorOrRequester;
    }

    if (moduleKey === 'my_process_owner' || moduleKey === 'my_task' || moduleKey === 'my_team') {
      const isLeadOrOwner = (
        userEmpId === (record.policy_lead || '').toLowerCase() ||
        fieldContainsEmail(record.sr_owner, userEmpId)
      );
      return isLeadOrOwner;
    }

    if (moduleKey === 'my_approval') {
      return false; // Edit not shown in My Approval view
    }

    // Fallback for general 'request' view
    const isAuthorizedUser = (
      userEmpId === (creator || '').toLowerCase() ||
      userEmpId === (requester || '').toLowerCase() ||
      fieldContainsEmail(record.sr_owner, userEmpId) ||
      userEmpId === (record.policy_lead || '').toLowerCase()
    );
    return isAuthorizedUser;
  }

  // Child tables logic:
  const childModules = ['payment', 'expense', 'invoice', 'mtr', 'service', 'asset', 'target_table'];
  if (childModules.includes(moduleKey)) {
    if (moduleKey === 'mtr') {
      const isSuperAdmin = authUser && (String(authUser.role).toUpperCase() === 'SUPER ADMIN' || authUser.is_super_admin);
      if (isSuperAdmin) return true;

      // Only Super Admin or users assigned in action_rules are allowed to edit; lock all others
      const hasActionRule = (typeof isActionAllowed === 'function' && isActionAllowed('mtr', 'edit')) ||
        (typeof isChildTableActionAllowed === 'function' && isChildTableActionAllowed('mtr', 'edit', (typeof currentModule !== 'undefined' ? currentModule : 'account')));

      return !!hasActionRule;
    }

    if (moduleKey === 'payment') {
      const payStatus = Number(record.payment_status);
      if (payStatus !== 30 && String(record.payment_status || '').toLowerCase() !== 'draft') return false;
    }

    if (moduleKey === 'target_table') {
      const parentId = record.request || record.request_id;
      if (parentId) {
        const parentRequest = selectCache['request']?.find(r => String(r.request_id) === String(parentId));
        if (parentRequest) {
          const userEmpId = (authUser.employee_id || '').toLowerCase();
          const requester = (parentRequest.requester || '').toLowerCase();
          const creator = (parentRequest.sr_creater || '').toLowerCase();
          const srOwnerArr = Array.isArray(parentRequest.sr_owner)
            ? parentRequest.sr_owner.map(s => String(s).toLowerCase())
            : (parentRequest.sr_owner ? [String(parentRequest.sr_owner).toLowerCase()] : []);
          const policyLead = (parentRequest.policy_lead || '').toLowerCase();
          return userEmpId === requester || userEmpId === creator || srOwnerArr.includes(userEmpId) || userEmpId === policyLead;
        }
      }
      return true;
    }

    if (authUser.role && authUser.role.toUpperCase() === 'SUPER ADMIN') return true;

    // 2. Parent request context checks
    const parentId = record.request || record.request_id || record.id__request;
    if (parentId) {
      const parentRequest = selectCache['request']?.find(r => String(r.request_id) === String(parentId));
      if (parentRequest) {
        const processStatus = Number(parentRequest.process_status);
        const userEmpId = (authUser.employee_id || '').toLowerCase();

        const requester = (parentRequest.requester || '').toLowerCase();
        const creator = (parentRequest.sr_creater || '').toLowerCase();
        const srOwnerArr = Array.isArray(parentRequest.sr_owner)
          ? parentRequest.sr_owner.map(s => String(s).toLowerCase())
          : (parentRequest.sr_owner ? [String(parentRequest.sr_owner).toLowerCase()] : []);
        const policyLead = (parentRequest.policy_lead || '').toLowerCase();

        // Processing (8) hoặc Completed (9): SR Owner hoặc Policy Lead có thể sửa bảng con (chỉ so khớp employee_id)
        const isProcessHandler = (
          [8, 9].includes(processStatus)
        ) && (
          srOwnerArr.includes(userEmpId) || userEmpId === policyLead
        );

        if (!isProcessHandler) {
          return false;
        }
      }
    }



    return true;
  }

  if (authUser.role && authUser.role.toUpperCase() === 'SUPER ADMIN') return true;

  // For all other modules: business logic allows editing (RBAC gate = isActionAllowed)
  return true;
}

function canUserDeleteRecord(moduleKey, record) {
  if (!authUser) return false;
  if (moduleKey === 'my_approval') {
    return false; // Delete not allowed in My Approval view
  }

  if (moduleKey === 'assigned_task' && record) {
    if (authUser.role && authUser.role.toUpperCase() === 'SUPER ADMIN') return true;
    const isAssignee = String(record.employee_id).toLowerCase() === (authUser.employee_id || '').toLowerCase();
    if (isAssignee) return false; // Assignee cannot delete task
    if (currentRecord && String(currentRecord.request_id) === String(record.request_id)) {
      const userEmpId = (authUser.employee_id || '').toLowerCase();
      const isLeadOrOwner = (
        userEmpId === (currentRecord.sr_creater || '').toLowerCase() ||
        userEmpId === (currentRecord.requester || '').toLowerCase() ||
        userEmpId === (currentRecord.policy_lead || '').toLowerCase() ||
        fieldContainsEmail(currentRecord.sr_owner, userEmpId)
      );
      if (isLeadOrOwner) return true;
    }
    return false;
  }

  if (shouldHideRequestEditDeleteActions(moduleKey)) return false;

  const actualModule = ['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team', 'request'].includes(moduleKey) ? 'request' : moduleKey;

  if (actualModule === 'request') {
    let isTier1Approved = false;
    let flow = record.approval_flow;
    if (typeof flow === 'string') {
      try { flow = JSON.parse(flow); } catch (e) { }
    }
    if (flow && Array.isArray(flow.steps)) {
      const step1 = flow.steps.find(s => s.level === 1);
      if (step1 && String(step1.status || '').toLowerCase().startsWith('approved')) {
        isTier1Approved = true;
      }
    } else {
      const tier1Status = String(record.tier_1_status || '').toLowerCase().trim();
      isTier1Approved = tier1Status.startsWith('approved');
    }
    const isLockedStatus = [5, 6].includes(Number(record.sr_status)) || Number(record.process_status) === 9 || ['completed', 'closed', 'cancelled'].includes(String(record.sr_status || '').toLowerCase());

    // Hide delete button ONLY IF Tier 1 has approved, OR request is completed/closed/cancelled
    if (isTier1Approved || isLockedStatus) {
      return false;
    }

    if (authUser.role && authUser.role.toUpperCase() === 'SUPER ADMIN') return true;

    const userEmail = (authUser.email || '').toLowerCase();
    const creator = (record.sr_creater || '').toLowerCase();
    const requester = (record.requester || '').toLowerCase();

    return userEmail === creator || userEmail === requester;
  }

  const childModules = ['payment', 'expense', 'invoice', 'mtr', 'service', 'asset', 'target_table'];
  if (childModules.includes(moduleKey)) {
    if (moduleKey === 'mtr') {
      const accountId = record.account;
      if (accountId) {
        const account = (selectCache['account'] || []).find(a => String(a.account_id) === String(accountId));
        if (account) {
          const mtrStatus = String(record.status || '').toLowerCase().trim();
          const userEmpId = authUser.employee_id;
          const financeControl = account.finance_control;
          const managedByVal = account.transaction_managed_by;

          let managedByArr = [];
          if (Array.isArray(managedByVal)) {
            managedByArr = managedByVal.map(String);
          } else if (typeof managedByVal === 'string') {
            managedByArr = managedByVal.split(',').map(s => s.trim().replace(/^\[|\]$/g, '')).filter(Boolean);
          }

          const isManagedBy = managedByArr.includes(userEmpId);
          const isFinanceControl = (financeControl === userEmpId);

          if (mtrStatus === 'closed') {
            if (!isManagedBy) return false;
          } else if (mtrStatus === 'open') {
            if (!isManagedBy && !isFinanceControl) return false;
          }
        }
      }
    }

    if (moduleKey === 'payment') {
      const payStatus = Number(record.payment_status);
      if (payStatus !== 30 && String(record.payment_status || '').toLowerCase() !== 'draft') return false;
    }

    if (moduleKey === 'target_table') {
      const parentId = record.request || record.request_id;
      if (parentId) {
        const parentRequest = selectCache['request']?.find(r => String(r.request_id) === String(parentId));
        if (parentRequest) {
          const srStatus = Number(parentRequest.sr_status);
          if (![1, 4].includes(srStatus) && !['draft', 'rejected'].includes(String(parentRequest.sr_status || '').toLowerCase())) return false;
        }
      }
    }

    // 2. Parent request context checks
    const parentId = record.request || record.request_id || record.id__request;
    if (parentId) {
      const parentRequest = selectCache['request']?.find(r => String(r.request_id) === String(parentId));
      if (parentRequest) {
        const processStatus = Number(parentRequest.process_status);
        const userEmpId = (authUser.employee_id || '').toLowerCase();

        const requester = (parentRequest.requester || '').toLowerCase();
        const creator = (parentRequest.sr_creater || '').toLowerCase();
        const srOwnerArr = Array.isArray(parentRequest.sr_owner)
          ? parentRequest.sr_owner.map(s => String(s).toLowerCase())
          : (parentRequest.sr_owner ? [String(parentRequest.sr_owner).toLowerCase()] : []);
        const policyLead = (parentRequest.policy_lead || '').toLowerCase();

        // Processing (8) hoặc Completed (9): SR Owner hoặc Policy Lead có thể xóa bảng con (chỉ so khớp employee_id)
        const isProcessHandler = (
          [8, 9].includes(processStatus)
        ) && (
          srOwnerArr.includes(userEmpId) || userEmpId === policyLead
        );

        if (!isProcessHandler) {
          return false;
        }
      }
    }



    return true;
  }

  return true;
}

function formatLogEntry(val) {
  if (!val) return '';

  let logsArray = null;
  if (Array.isArray(val)) {
    logsArray = val;
  } else if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        logsArray = JSON.parse(trimmed);
      } catch (e) { }
    }
  }

  // If we have a JSON array of logs, format it directly and elegantly
  if (logsArray && Array.isArray(logsArray)) {
    return [...logsArray].reverse().map(item => {
      if (!item || typeof item !== 'object') return String(item || '');
      const ts = (item.timestamp || item.at) ? formatDateTime(item.timestamp || item.at) : '';
      const userRaw = item.user || item.by || 'system';
      const user = resolveEmployeeName(userRaw);
      const action = typeof t_val === 'function' ? t_val(item.action) : (item.action || 'updated');

      let changesHtml = '';
      const changesObj = item.changes;
      if (changesObj && typeof changesObj === 'object' && !Array.isArray(changesObj)) {
        const changeDetails = Object.entries(changesObj)
          .filter(([k, v]) => k !== 'approval_flow') // hide complex approval_flow internal updates
          .map(([k, v]) => {
            let valHtml = '';
            if (v && typeof v === 'object' && 'old' in v && 'new' in v) {
              const oldVal = v.old === null || v.old === undefined ? 'null' : (typeof v.old === 'object' ? JSON.stringify(v.old) : String(v.old));
              const newVal = v.new === null || v.new === undefined ? 'null' : (typeof v.new === 'object' ? JSON.stringify(v.new) : String(v.new));
              if (v.old === null || v.old === undefined) {
                valHtml = `<span style="color:var(--accent); font-weight:500;">${escapeHTML(newVal)}</span>`;
              } else {
                valHtml = `<span style="text-decoration: line-through; color:var(--text-muted); opacity:0.7;">${escapeHTML(oldVal)}</span> ➔ <span style="color:var(--accent); font-weight:500;">${escapeHTML(newVal)}</span>`;
              }
            } else {
              valHtml = `<span style="color:var(--text-primary);">${escapeHTML(typeof v === 'object' ? JSON.stringify(v) : String(v))}</span>`;
            }
            return `<span style="color:var(--text-muted);">${k}:</span> ${valHtml}`;
          })
          .join(', ');
        if (changeDetails) {
          changesHtml = `<div style="margin-left:16px; font-size:11px; color:var(--text-secondary); opacity:0.8;">↳ ${changeDetails}</div>`;
        }
      } else if (Array.isArray(changesObj)) {
        const changeDetails = changesObj.map(ch => {
          let str = String(ch);
          str = str.replace(/^([a-z0-9_]+)(?=:)/i, (match) => typeof t === 'function' ? t('col.' + match, match) : match);
          return str.split(/( -> |: )/).map(part => {
            if (part === ' -> ' || part === ': ') return part;
            return typeof t_val === 'function' ? t_val(part) : part;
          }).join('');
        }).join(', ');
        if (changeDetails) {
          changesHtml = `<div style="margin-left:16px; font-size:11px; color:var(--text-secondary); opacity:0.8;">↳ ${changeDetails}</div>`;
        }
      }

      return `<div style="margin-bottom: 8px; font-size:12px;"><span style="color:var(--accent);font-weight:600;">[${ts}]</span> <span style="font-weight:500;">${user}</span>: ${action}${changesHtml}</div>`;
    }).join('');
  }

  // Fallback to the original text-parsing parser if it's the old newline-separated string
  if (typeof val === 'string') {
    let parsedLogs = [];
    let tempVal = '';

    // Robust brace balancer to extract JSON objects (including nested ones) safely
    let inJson = false;
    let braceCount = 0;
    let inString = false;
    let escape = false;
    let currentJson = '';

    for (let i = 0; i < val.length; i++) {
      const char = val[i];

      if (!inJson) {
        if (char === '{') {
          inJson = true;
          braceCount = 1;
          currentJson = char;
        } else {
          tempVal += char;
        }
      } else {
        currentJson += char;

        if (escape) {
          escape = false;
        } else if (char === '\\') {
          escape = true;
        } else if (char === '"') {
          inString = !inString;
        } else if (!inString) {
          if (char === '{') {
            braceCount++;
          } else if (char === '}') {
            braceCount--;
            if (braceCount === 0) {
              inJson = false;
              try {
                const item = JSON.parse(currentJson);
                if (item.timestamp && item.user && item.action) {
                  parsedLogs.push(item);
                  tempVal += `__JSON_LOG_${parsedLogs.length - 1}__\n`;
                } else {
                  tempVal += currentJson;
                }
              } catch (e) {
                tempVal += currentJson;
              }
              currentJson = '';
            }
          }
        }
      }
    }

    const lines = tempVal.trim().split('\n').filter(l => l.trim() !== '');
    return lines.reverse().map(line => {
      line = line.trim();

      const jsonMatch = line.match(/^__JSON_LOG_(\d+)__$/);
      if (jsonMatch) {
        const item = parsedLogs[parseInt(jsonMatch[1])];
        const ts = item.timestamp ? formatDateTime(item.timestamp) : '';
        const action = typeof t_val === 'function' ? t_val(item.action) : (item.action || 'updated');

        // Format JSON changes elegantly if present
        let changesHtml = '';
        if (item.changes && Object.keys(item.changes).length > 0) {
          const changeDetails = Object.entries(item.changes)
            .filter(([k, v]) => k !== 'approval_flow') // hide complex approval_flow internal updates
            .map(([k, v]) => {
              let valHtml = '';
              if (v && typeof v === 'object' && 'old' in v && 'new' in v) {
                const oldVal = v.old === null || v.old === undefined ? 'null' : (typeof v.old === 'object' ? JSON.stringify(v.old) : String(v.old));
                const newVal = v.new === null || v.new === undefined ? 'null' : (typeof v.new === 'object' ? JSON.stringify(v.new) : String(v.new));
                if (v.old === null || v.old === undefined) {
                  valHtml = `<span style="color:var(--accent); font-weight:500;">${escapeHTML(newVal)}</span>`;
                } else {
                  valHtml = `<span style="text-decoration: line-through; color:var(--text-muted); opacity:0.7;">${escapeHTML(oldVal)}</span> ➔ <span style="color:var(--accent); font-weight:500;">${escapeHTML(newVal)}</span>`;
                }
              } else {
                valHtml = `<span style="color:var(--text-primary);">${escapeHTML(typeof v === 'object' ? JSON.stringify(v) : String(v))}</span>`;
              }
              return `<span style="color:var(--text-muted);">${k}:</span> ${valHtml}`;
            })
            .join(', ');
          if (changeDetails) {
            changesHtml = `<div style="margin-left:16px; font-size:11px; color:var(--text-secondary); opacity:0.8;">↳ ${changeDetails}</div>`;
          }
        }

        const userRaw = item.user || item.by || 'system';
        const user = resolveEmployeeName(userRaw);
        return `<div style="margin-bottom: 8px; font-size:12px;"><span style="color:var(--accent);font-weight:600;">[${ts}]</span> <span style="font-weight:500;">${user}</span>: ${action}${changesHtml}</div>`;
      }

      const bracketMatch = line.match(/^\[(.*?)\]\s*(.+)$/);
      if (bracketMatch) {
        const ts = formatDateTime(bracketMatch[1].trim());
        let content = bracketMatch[2];
        const userMatch = content.match(/^([^\s]+@[^\s:]+|[a-fA-F0-9]{32}|EMP-?\d+):\s*(.+)$/i);
        if (userMatch) {
          const user = resolveEmployeeName(userMatch[1]);
          return `<div style="margin-bottom: 8px; font-size:12px;"><span style="color:var(--accent);font-weight:600;">[${ts}]</span> <span style="font-weight:500;">${user}</span>: ${userMatch[2]}</div>`;
        }
        return `<div style="margin-bottom: 8px; font-size:12px;"><span style="color:var(--accent);font-weight:600;">[${ts}]</span> ${content}</div>`;
      }

      const dashMatch = line.match(/^([\d/:\sAMPM-]+?)\s*-\s*([^\s@]+@[^\s@]+|[a-fA-F0-9]{32}|EMP-?\d+)\s+(.+)$/i);
      if (dashMatch) {
        const ts = formatDateTime(dashMatch[1].trim());
        const user = resolveEmployeeName(dashMatch[2]);
        const action = dashMatch[3];
        return `<div style="margin-bottom: 8px; font-size:12px;"><span style="color:var(--accent);font-weight:600;">[${ts}]</span> <span style="font-weight:500;">${user}</span>: ${action}</div>`;
      }

      return `<div style="margin-bottom: 8px; font-size:12px;">${line}</div>`;
    }).join('');
  }

  if (typeof val === 'object') {
    return `<pre style="font-size:10px;white-space:pre-wrap;margin:0;">${JSON.stringify(val, null, 2)}</pre>`;
  }
  return String(val);
}
window.handleSchemaTableChange = async function (selectEl, fieldKey) {
  const tableName = selectEl.value;

  // 1. Update the schema_column select if it exists
  const colSelect = document.getElementById('f-column_name');
  if (colSelect) {
    colSelect.innerHTML = '<option value="">— Select Column —</option>';
    if (tableName) {
      const schemaData = await getSelectOptions('_schemaData');
      const cols = schemaData[tableName] || [];
      colSelect.innerHTML += cols.map(c => `<option value="${c.column}">${c.column} (${c.type})</option>`).join('');
    }
  }

  // 2. Update dynamic roles in the 'roles' multiselect if it exists
  const rolesContainer = document.getElementById('container-roles');
  if (rolesContainer) {
    // Remove old dynamic roles
    document.querySelectorAll('.dynamic-role-cb').forEach(e => e.remove());

    if (tableName) {
      const schemaData = await getSelectOptions('_schemaData');
      let cols = schemaData[tableName] || [];
      const selectedArr = JSON.parse(rolesContainer.getAttribute('data-selected') || '[]');

      // Find corresponding module config to filter employee-linked columns
      const modKey = Object.keys(MODULES).find(k => MODULES[k].writeTable === tableName || k === tableName);
      if (modKey && MODULES[modKey].fields) {
        const employeeCols = MODULES[modKey].fields
          .filter(f => f.optionsFrom === 'employee')
          .map(f => f.key);
        cols = cols.filter(c => employeeCols.includes(c.column));
      } else {
        cols = []; // If no config, no dynamic roles
      }

      let htmlToAdd = '';
      cols.forEach(c => {
        const ov = `[${c.column}]`;
        const ol = `<span class="material-symbols-rounded" style="font-size:13px; margin-right:4px;">person</span> Dynamic: ${c.column}`;
        // check if already checked (if editing)
        const isChecked = selectedArr.includes(ov) || document.querySelector(`input[name="multi-roles"][value="${ov}"]`)?.checked;

        htmlToAdd += `
             <label class="dynamic-role-cb form-multiselect-pill ${isChecked ? 'active' : ''}" style="border-color: var(--accent); color: var(--accent); font-weight: 600;">
               <input type="checkbox" name="multi-roles" value="${ov}" ${isChecked ? 'checked' : ''} style="display: none;" onchange="toggleMultiselectPill(this)" />
               <span>${ol}</span>
             </label>
           `;
      });

      rolesContainer.insertAdjacentHTML('afterbegin', htmlToAdd);
    }
  }
};

// ============================================================
// CUSTOM HANDLERS
// ============================================================
// Consolidated handler below


// Window Bridge for Record Policy Service
window.calculateRequestSLA = calculateRequestSLA;
window.fieldContainsEmail = fieldContainsEmail;
window.shouldHideRequestEditDeleteActions = shouldHideRequestEditDeleteActions;
window.shouldHideRequestDynamicAction = shouldHideRequestDynamicAction;
window.shouldShowRequestChildTables = shouldShowRequestChildTables;
window.hasModuleRealChildren = hasModuleRealChildren;
window.getAllowedDetailChildModules = getAllowedDetailChildModules;
window.canUserEditRecord = canUserEditRecord;
window.canUserDeleteRecord = canUserDeleteRecord;
window.formatLogEntry = formatLogEntry;
