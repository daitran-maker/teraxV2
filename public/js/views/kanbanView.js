/**
 * CRC App - Assigned Task Kanban View
 * Extracted as part of Phase 2 Modularization
 * All handlers mounted to window.* for zero-regression compatibility.
 */

window.taskDragData = { taskId: null };

window.handleTaskDragStart = function (e, taskId) {
  window.taskDragData.taskId = taskId;
  e.dataTransfer.setData('text/plain', taskId);
  e.dataTransfer.effectAllowed = 'move';
  const card = document.getElementById('task-card-' + taskId);
  if (card) {
    card.style.opacity = '0.5';
    card.classList.add('is-dragging');
  }
};

window.handleTaskDragEnd = function (e) {
  const card = document.querySelector('.task-card.is-dragging');
  if (card) {
    card.style.opacity = '1';
    card.classList.remove('is-dragging');
  }
  document.querySelectorAll('.kanban-column-body').forEach(col => {
    col.classList.remove('drag-over');
    col.style.background = '';
  });
};

window.handleTaskDragOver = function (e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const col = e.currentTarget;
  if (col && !col.classList.contains('drag-over')) {
    col.classList.add('drag-over');
    col.style.background = 'rgba(59, 130, 246, 0.05)';
  }
};

window.handleTaskDragLeave = function (e) {
  const col = e.currentTarget;
  if (col && !col.contains(e.relatedTarget)) {
    col.classList.remove('drag-over');
    col.style.background = '';
  }
};

window.handleTaskDrop = async function (e, targetStatus) {
  e.preventDefault();
  const taskId = e.dataTransfer.getData('text/plain') || window.taskDragData.taskId;
  if (!taskId) return;

  document.querySelectorAll('.kanban-column-body').forEach(col => {
    col.classList.remove('drag-over');
    col.style.background = '';
  });

  await window.quickUpdateTaskStatus(taskId, targetStatus);
};

window.quickUpdateTaskStatus = async function (taskId, newStatus, event) {
  if (event) event.stopPropagation();
  try {
    showToast('Updating task status...', 'info');
    await apiPut('/table/assigned_task/' + taskId, { status: newStatus });
    showToast('Task updated to ' + newStatus, 'success');
    await renderAssignedTaskKanbanView('assigned_task', true);
  } catch (err) {
    console.error('Failed to update task status:', err);
    showToast(err.message || 'Failed to update task status', 'error');
  }
};

window.filterKanbanCards = function (query) {
  const q = (query || '').toLowerCase().trim();
  const cards = document.querySelectorAll('.task-kanban-card');
  let colCounts = { 'Not started yet': 0, 'Processing': 0, 'Completed': 0 };

  cards.forEach(card => {
    const text = (card.textContent || '').toLowerCase();
    const status = card.getAttribute('data-status') || 'Not started yet';
    if (!q || text.includes(q)) {
      card.style.display = 'block';
      if (colCounts[status] !== undefined) colCounts[status]++;
    } else {
      card.style.display = 'none';
    }
  });

  document.querySelectorAll('.kanban-column-count').forEach(badge => {
    const s = badge.getAttribute('data-status');
    if (s && colCounts[s] !== undefined) {
      badge.textContent = colCounts[s];
    }
  });
};

async function renderAssignedTaskKanbanView(moduleKey = 'assigned_task', skipFetch = false) {
  currentModule = 'assigned_task';
  currentView = 'table';
  const meta = getModuleMeta('assigned_task');
  const content = document.getElementById('content');
  if (!content) return;

  if (document.getElementById('topbar-title')) document.getElementById('topbar-title').innerHTML = meta.title || 'My Tasks';
  if (document.getElementById('topbar-subtitle')) document.getElementById('topbar-subtitle').textContent = meta.subtitle || 'Tasks assigned to you';
  if (typeof updateGlobalStatusCards === 'function') updateGlobalStatusCards('');

  content.innerHTML = `<div class="loading"><div class="spinner"></div> Loading Tasks...</div>`;

  try {
    const promises = [
      apiGet('/table/assigned_task?slice=assigned_task&limit=1000')
    ];
    if (!selectCache['employee']) promises.push(getSelectOptions('employee'));
    if (!selectCache['request']) promises.push(getSelectOptions('request').catch(() => []));

    const [res] = await Promise.all(promises);
    const tasks = res.data && Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []);
    currentData = tasks;

    let parentRequestsMap = new Map();
    try {
      const reqList = selectCache['request'] || [];
      reqList.forEach(r => parentRequestsMap.set(String(r.request_id || r.id), r));
    } catch (e) { }

    const columns = [
      {
        id: 'Not started yet',
        title: 'Not started yet',
        color: '#64748B',
        badgeBg: '#F1F5F9',
        badgeColor: '#475569',
        columnBg: '#F8FAFC',
        borderTop: '3px solid #64748B',
        icon: 'schedule'
      },
      {
        id: 'Processing',
        title: 'Processing',
        color: '#2563EB',
        badgeBg: '#DBEAFE',
        badgeColor: '#1D4ED8',
        columnBg: '#F0F7FF',
        borderTop: '3px solid #2563EB',
        icon: 'sync'
      },
      {
        id: 'Completed',
        title: 'Completed',
        color: '#059669',
        badgeBg: '#D1FAE5',
        badgeColor: '#047857',
        columnBg: '#F0FDF4',
        borderTop: '3px solid #059669',
        icon: 'task_alt'
      }
    ];

    const tasksByStatus = {
      'Not started yet': [],
      'Processing': [],
      'Completed': []
    };

    tasks.forEach(t => {
      let st = t.status || 'Not started yet';
      if (!tasksByStatus[st]) st = 'Not started yet';
      tasksByStatus[st].push(t);
    });

    const userEmpId = (authUser && authUser.employee_id ? authUser.employee_id : '').toLowerCase();
    const isGlobalAdmin = authUser && authUser.role && authUser.role.toUpperCase() === 'SUPER ADMIN';

    let columnsHtml = '';
    columns.forEach(col => {
      const colTasks = tasksByStatus[col.id] || [];

      let cardsHtml = '';
      colTasks.forEach(task => {
        const taskId = task.task_id || task.id;
        const assigneeName = resolveEmployeeName(task.employee_id) || task.employee_id || 'Unassigned';
        const reqObj = task.request_id ? parentRequestsMap.get(String(task.request_id)) : null;
        const parentStatus = (reqObj && (reqObj.sr_status || reqObj.process_status)) ? (reqObj.sr_status || reqObj.process_status) : '';
        const isParentCompleted = String(parentStatus).toLowerCase() === 'completed' || String(parentStatus).toLowerCase() === 'closed' || String(parentStatus) === '9';

        let isLeadOrOwner = false;
        if (reqObj) {
          const srOwnerArr = Array.isArray(reqObj.sr_owner) ? reqObj.sr_owner.map(s => String(s).toLowerCase()) : (reqObj.sr_owner ? [String(reqObj.sr_owner).toLowerCase()] : []);
          const policyLead = String(reqObj.policy_lead || '').toLowerCase();
          if (srOwnerArr.includes(userEmpId) || policyLead === userEmpId) {
            isLeadOrOwner = true;
          }
        }
        const isAssignee = String(task.employee_id || '').toLowerCase() === userEmpId;
        const canUpdate = (isAssignee || isLeadOrOwner || isGlobalAdmin) && !isParentCompleted;

        let deadlineHtml = '';
        if (task.deadline) {
          const dlDate = new Date(task.deadline);
          const isOverdue = !isNaN(dlDate.getTime()) && dlDate < new Date() && col.id !== 'Completed';
          const dlColor = isOverdue ? '#EF4444' : '#64748B';
          const dlBg = isOverdue ? '#FEF2F2' : '#F1F5F9';
          deadlineHtml = `
            <div style="display:inline-flex; align-items:center; gap:4px; font-size:11px; color:${dlColor}; background:${dlBg}; padding:2px 8px; border-radius:6px; font-weight:500;">
              <span class="material-symbols-rounded" style="font-size:13px;">calendar_today</span>
              <span>${formatDateMON(task.deadline)}</span>
              ${isOverdue ? '<span style="font-weight:700; font-size:10px; text-transform:uppercase; margin-left:2px;">Overdue</span>' : ''}
            </div>
          `;
        }

        let attachmentsHtml = '';
        if (task.task_info_guide_file) {
          attachmentsHtml += `
            <span title="Attached File: ${escapeHTML(task.task_info_guide_file)}" style="display:inline-flex; align-items:center; color:#2563EB; background:#EFF6FF; padding:3px 6px; border-radius:4px; font-size:11px; gap:2px;">
              <span class="material-symbols-rounded" style="font-size:13px;">attach_file</span>
              <span>File</span>
            </span>
          `;
        }
        if (task.task_info_link) {
          attachmentsHtml += `
            <a href="${escapeHTML(task.task_info_link)}" target="_blank" onclick="event.stopPropagation();" title="Link: ${escapeHTML(task.task_info_link)}" style="display:inline-flex; align-items:center; color:#059669; background:#ECFDF5; padding:3px 6px; border-radius:4px; font-size:11px; gap:2px; text-decoration:none;">
              <span class="material-symbols-rounded" style="font-size:13px;">link</span>
              <span>Link</span>
            </a>
          `;
        }

        let actionsHtml = '';
        if (canUpdate) {
          if (col.id === 'Not started yet') {
            actionsHtml = `
              <div style="display:flex; gap:6px; margin-top:10px; border-top:1px solid #F1F5F9; padding-top:8px;" onclick="event.stopPropagation();">
                <button type="button" class="btn btn-sm" onclick="quickUpdateTaskStatus('${taskId}', 'Processing', event)" style="flex:1; height:26px !important; font-size:11px !important; background:#EFF6FF !important; color:#1D4ED8 !important; border:1px solid #BFDBFE !important; border-radius:6px; display:inline-flex; align-items:center; justify-content:center; gap:4px; font-weight:600; cursor:pointer;">
                  <span class="material-symbols-rounded" style="font-size:14px;">play_arrow</span> Start
                </button>
              </div>
            `;
          } else if (col.id === 'Processing') {
            actionsHtml = `
              <div style="display:flex; gap:6px; margin-top:10px; border-top:1px solid #F1F5F9; padding-top:8px;" onclick="event.stopPropagation();">
                <button type="button" class="btn btn-sm" onclick="quickUpdateTaskStatus('${taskId}', 'Not started yet', event)" title="Move back" style="width:32px; height:26px !important; padding:0 !important; background:#F8FAFC !important; color:#64748B !important; border:1px solid #CBD5E1 !important; border-radius:6px; display:inline-flex; align-items:center; justify-content:center; cursor:pointer;">
                  <span class="material-symbols-rounded" style="font-size:14px;">undo</span>
                </button>
                <button type="button" class="btn btn-sm" onclick="quickUpdateTaskStatus('${taskId}', 'Completed', event)" style="flex:1; height:26px !important; font-size:11px !important; background:#ECFDF5 !important; color:#047857 !important; border:1px solid #A7F3D0 !important; border-radius:6px; display:inline-flex; align-items:center; justify-content:center; gap:4px; font-weight:600; cursor:pointer;">
                  <span class="material-symbols-rounded" style="font-size:14px;">check_circle</span> Complete
                </button>
              </div>
            `;
          } else if (col.id === 'Completed') {
            actionsHtml = `
              <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px; border-top:1px solid #F1F5F9; padding-top:6px;" onclick="event.stopPropagation();">
                <span style="font-size:11px; color:#059669; display:inline-flex; align-items:center; gap:4px; font-weight:600;">
                  <span class="material-symbols-rounded" style="font-size:14px;">verified</span> Completed
                </span>
                <button type="button" class="btn btn-sm" onclick="quickUpdateTaskStatus('${taskId}', 'Processing', event)" style="height:22px !important; font-size:10px !important; background:none !important; border:none !important; color:#64748B !important; text-decoration:underline; cursor:pointer; padding:0 4px;">Reopen</button>
              </div>
            `;
          }
        } else if (isParentCompleted) {
          actionsHtml = `
            <div style="margin-top:8px; border-top:1px solid #F1F5F9; padding-top:6px; font-size:10.5px; color:#94A3B8; font-style:italic; display:flex; align-items:center; gap:4px;">
              <span class="material-symbols-rounded" style="font-size:12px;">lock</span> Parent request completed (Locked)
            </div>
          `;
        }

        cardsHtml += `
          <div class="task-kanban-card task-card" id="task-card-${taskId}" data-status="${col.id}" draggable="${canUpdate ? 'true' : 'false'}" ondragstart="handleTaskDragStart(event, '${taskId}')" ondragend="handleTaskDragEnd(event)" onclick="showUpdateTaskStatusModal('${taskId}')" style="background:#FFFFFF; border:1px solid #E2E8F0; border-radius:10px; padding:12px; margin-bottom:12px; box-shadow:0 1px 3px rgba(0,0,0,0.04); cursor:pointer; transition:all 0.2s ease; user-select:none;">
            <!-- Top row: IDs -->
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <span style="font-family:monospace; font-size:11px; font-weight:700; color:#2563EB; background:#EFF6FF; padding:2px 6px; border-radius:4px;">#${taskId}</span>
              ${task.request_id ? `<span style="font-size:11px; color:#64748B; background:#F8FAFC; border:1px solid #E2E8F0; padding:1px 6px; border-radius:4px;">Req: ${task.request_id}</span>` : ''}
            </div>

            <!-- Description -->
            <div style="font-size:13px; font-weight:600; color:#1E293B; line-height:1.4; margin-bottom:10px; word-break:break-word;">
              ${escapeHTML(task.description || 'No description provided')}
            </div>

            <!-- Assignee info -->
            <div style="display:flex; align-items:center; gap:6px; margin-bottom:8px; font-size:11.5px; color:#475569;">
              <span class="material-symbols-rounded" style="font-size:15px; color:#94A3B8;">account_circle</span>
              <span style="font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHTML(assigneeName)}</span>
            </div>

            <!-- Deadline & Attachments -->
            <div style="display:flex; flex-wrap:wrap; gap:6px; align-items:center;">
              ${deadlineHtml}
              ${attachmentsHtml}
            </div>

            <!-- Action buttons -->
            ${actionsHtml}
          </div>
        `;
      });

      columnsHtml += `
        <div class="kanban-column" style="flex:1; min-width:300px; max-width:400px; display:flex; flex-direction:column; background:${col.columnBg}; border:1px solid #E2E8F0; border-top:${col.borderTop}; border-radius:12px; overflow:hidden; height:100%;">
          <!-- Column Header -->
          <div style="padding:12px 16px; display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid #E2E8F0; background:#FFFFFF; flex-shrink:0;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="material-symbols-rounded" style="font-size:18px; color:${col.color};">${col.icon}</span>
              <h4 style="margin:0; font-size:13.5px; font-weight:700; color:#1E293B;">${col.title}</h4>
            </div>
            <span class="kanban-column-count" data-status="${col.id}" style="font-size:11.5px; font-weight:700; background:${col.badgeBg}; color:${col.badgeColor}; padding:2px 8px; border-radius:12px;">${colTasks.length}</span>
          </div>

          <!-- Column Cards Area -->
          <div class="kanban-column-body" ondragover="handleTaskDragOver(event)" ondragleave="handleTaskDragLeave(event)" ondrop="handleTaskDrop(event, '${col.id}')" style="flex:1; overflow-y:auto; padding:12px; transition:background 0.2s ease;">
            ${cardsHtml.length > 0 ? cardsHtml : `<div style="text-align:center; padding:32px 12px; color:#94A3B8; font-size:12px; font-style:italic;">No tasks in this stage</div>`}
          </div>
        </div>
      `;
    });

    content.innerHTML = `
      <div class="view active" id="view-assigned_task" style="display:flex; flex-direction:column; height:100%; overflow:hidden; background:#FFFFFF; font-family:'Inter', sans-serif;">
        <!-- Search & Control Header -->
        <div class="dv-search-header" style="padding:10px 16px; display:flex; gap:12px; align-items:center; border-bottom:1px solid #E5E7EB; background:#FFFFFF; flex-shrink:0;">
          <div style="position:relative; flex:1; min-width:200px;">
            <span class="material-symbols-rounded" style="position:absolute; left:16px; top:50%; transform:translateY(-50%); font-size:18px; color:#6B7280;">search</span>
            <input type="text" id="kanban-task-search" class="form-input search-input" placeholder="Search tasks by description, ID, assignee..." oninput="filterKanbanCards(this.value)" style="padding:0 16px 0 32px; width:100%; border-radius:8px; border:1px solid #E5E7EB; font-size:13px; font-family:'Inter',sans-serif; color:#111827; background:#FFFFFF;" />
          </div>
          <div class="table-actions-wrapper" style="display:flex; gap:8px; align-items:center;">
            <button class="btn btn-outline btn-sm" onclick="renderAssignedTaskKanbanView('assigned_task', true)" title="Refresh Board" style="height:28px !important; display:inline-flex; align-items:center; gap:4px; font-weight:500;">
              <span class="material-symbols-rounded" style="font-size:16px;">refresh</span> Refresh
            </button>
          </div>
        </div>

        <!-- Kanban Board 3-Columns Layout -->
        <div class="kanban-board-container" style="flex:1; display:flex; gap:16px; padding:16px; overflow-x:auto; overflow-y:hidden; background:#F8FAFC;">
          ${columnsHtml}
        </div>
      </div>
    `;

  } catch (err) {
    console.error('Failed to load Kanban board:', err);
    content.innerHTML = `<div style="padding:24px; color:#EF4444; font-size:13px;">Failed to load tasks: ${escapeHTML(err.message)}</div>`;
  }
}
window.renderAssignedTaskKanbanView = renderAssignedTaskKanbanView;
