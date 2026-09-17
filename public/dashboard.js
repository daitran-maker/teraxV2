/* ============================================================
   DASHBOARD HOME – dashboard.js
   Handles: Notification Center, Task Pending panel, Stat Cards
   ============================================================ */

// ---- State ----
let dashboardNotiList = [];       // All notifications loaded for dashboard
let dashboardNotiFilter = 'all';  // Current filter tab
let dashboardWatches = {};        // { requestId: is_watching }
let dashboardTaskList = [];       // Flagged notifications (tasks)
let dashNotiPage = 1;
let dashNotiLimit = 10;
let dashNotiTotal = 0;
let dashNotiTotalPages = 1;

// ---- Helpers ----
function dashTimeAgo(dateStr) {
    if (!dateStr) return '';
    const now = new Date();
    const d = new Date(dateStr);
    const diff = Math.floor((now - d) / 1000);
    if (diff < 60) return t('dash.time.just_now', 'vừa xong');
    if (diff < 3600) return Math.floor(diff / 60) + ' ' + t('dash.time.mins_ago', 'phút trước');
    if (diff < 86400) return Math.floor(diff / 3600) + ' ' + t('dash.time.hours_ago', 'giờ trước');
    if (diff < 604800) return Math.floor(diff / 86400) + ' ' + t('dash.time.days_ago', 'ngày trước');
    return formatDate(d);
}

function dashExtractRequestId(link) {
    // Extracts request ID from notification link (e.g. "my_request/uuid-xxx")
    if (!link) return null;
    const parts = link.split('/');
    return parts.length >= 2 ? parts[parts.length - 1] : null;
}

// ---- Main entry: render dashboard home ----
async function loadHomeDashboard() {
    const contentEl = document.getElementById('content');
    if (!contentEl) return;

    if (typeof window.updateGlobalStatusCards === 'function') {
        window.updateGlobalStatusCards('');
    }

    contentEl.innerHTML = `
        <div class="home-dashboard" id="home-dashboard-root">
            <!-- Stat Cards Row -->
            <div class="stat-cards-grid" id="stat-cards-grid">
                ${renderStatCards()}
            </div>

            <!-- Main Content Row -->
            <div class="dashboard-content-row">
                <!-- Notification Center -->
                <div class="notification-center-panel" id="noti-center-panel">
                    <div class="noti-panel-header">
                        <span class="material-symbols-rounded" style="font-size:18px; color:var(--accent)">notifications</span>
                        <h3 data-i18n="dash.noti.title">${t('dash.noti.title', 'Thông Báo')}</h3>
                        <span class="noti-panel-badge" id="dash-noti-badge" style="display:none">0</span>
                        <div class="noti-panel-actions">
                            <button class="btn btn-sm" id="dash-mark-all-read"
                                style="font-size:11px; color:var(--accent); background:transparent; border:none; cursor:pointer; padding:4px 8px; border-radius:6px;"
                                onclick="dashMarkAllRead()" title="${t('dash.noti.mark_all_read', 'Đánh dấu tất cả đã đọc')}">
                                <span class="material-symbols-rounded" style="font-size:15px; vertical-align:middle">done_all</span>
                            </button>
                            <button class="btn btn-sm" id="dash-refresh-noti"
                                style="font-size:11px; color:var(--text-muted); background:transparent; border:none; cursor:pointer; padding:4px 8px; border-radius:6px;"
                                onclick="dashLoadNotifications()" title="${t('dash.noti.refresh', 'Làm mới')}">
                                <span class="material-symbols-rounded" style="font-size:15px; vertical-align:middle">refresh</span>
                            </button>
                        </div>
                    </div>
                    <!-- Filter Tabs -->
                    <div class="noti-filter-tabs" id="noti-filter-tabs">
                        <button class="noti-filter-tab active" data-filter="all" data-i18n="dash.noti.filter.all" onclick="dashSetFilter('all')">${t('dash.noti.filter.all', 'Tất cả')}</button>
                        <button class="noti-filter-tab" data-filter="unread" data-i18n="dash.noti.filter.unread" onclick="dashSetFilter('unread')">${t('dash.noti.filter.unread', 'Chưa đọc')}</button>
                        <button class="noti-filter-tab" data-filter="pinned" data-i18n="dash.noti.filter.pinned" onclick="dashSetFilter('pinned')">${t('dash.noti.filter.pinned', 'Đã ghim')}</button>
                        <button class="noti-filter-tab" data-filter="flagged" data-i18n="dash.noti.filter.flagged" onclick="dashSetFilter('flagged')">${t('dash.noti.filter.flagged', 'Task')}</button>
                    </div>
                    <!-- Noti List -->
                    <div class="noti-list" id="dash-noti-list">
                        <div class="noti-empty">
                            <span class="material-symbols-rounded">notifications_off</span>
                            <div class="noti-empty-text">${t('detail.loading', 'Đang tải...')}</div>
                        </div>
                    </div>
                    <!-- Dash Noti Pagination -->
                    <div id="dash-noti-pagination" style="padding:10px 15px; border-top:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; background:var(--bg-default); font-size:12px; gap:8px; border-bottom-left-radius:12px; border-bottom-right-radius:12px;">
                      <button id="dashNotifPrevBtn" class="btn btn-sm" style="font-size:11px; background:transparent; border:1px solid var(--border); color:var(--text); cursor:pointer; padding:4px 8px; border-radius:4px; transition: all 0.2s;" onclick="dashChangeNotificationPage(-1)">Prev</button>
                      <span id="dashNotifPageInfo" style="color:var(--text-muted); font-weight:500;">Page 1 of 1</span>
                      <button id="dashNotifNextBtn" class="btn btn-sm" style="font-size:11px; background:transparent; border:1px solid var(--border); color:var(--text); cursor:pointer; padding:4px 8px; border-radius:4px; transition: all 0.2s;" onclick="dashChangeNotificationPage(1)">Next</button>
                    </div>
                </div>

                <!-- Task Pending Panel -->
                <div class="task-pending-panel" id="task-pending-panel">
                    <div class="task-panel-header">
                        <span class="material-symbols-rounded" style="font-size:18px; color:#ef4444">flag</span>
                        <h3 data-i18n="dash.task.title">${t('dash.task.title', 'Task Pending')}</h3>
                        <span class="task-count-badge" id="task-count-badge" style="display:none">0</span>
                    </div>
                    <div class="task-list" id="dash-task-list">
                        <div class="task-empty">
                            <span class="material-symbols-rounded">task_alt</span>
                            <div class="task-empty-text">${t('dash.task.empty', 'Chưa có task nào')}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Load data
    await Promise.all([
        dashLoadNotifications(),
        dashLoadStatCards(),
    ]);
}

// ---- Load Stat Cards Counts for Home Dashboard ----
async function dashLoadStatCards() {
    try {
        const stats = await apiGet('/my-views/stats/summary').catch(() => null);
        if (!stats) return;

        const myReqCount = stats.my_request || 0;
        const myAppCount = stats.my_approval || 0;
        const myTaskCount = stats.my_task || stats.my_process_owner || 0;

        const elReq = document.getElementById('stat-val-my_request');
        if (elReq) {
            elReq.textContent = formatNumber(myReqCount);
            elReq.className = 'stat-card-value' + (myReqCount === 0 ? ' placeholder' : '');
        }
        const elApp = document.getElementById('stat-val-my_approval');
        if (elApp) {
            elApp.textContent = formatNumber(myAppCount);
            elApp.className = 'stat-card-value' + (myAppCount === 0 ? ' placeholder' : '');
        }
        const elTask = document.getElementById('stat-val-my_process_owner') || document.getElementById('stat-val-my_task');
        if (elTask) {
            elTask.textContent = formatNumber(myTaskCount);
            elTask.className = 'stat-card-value' + (myTaskCount === 0 ? ' placeholder' : '');
        }
    } catch (e) {
        console.error('[Dashboard] Failed to load stat cards data:', e);
    }
}

// ---- Stat Cards (placeholder for now) ----
function renderStatCards() {
    const cards = [
        {
            label: t('dash.stat.my_request', 'Request của tôi'),
            icon: 'assignment',
            accent: '#1D4ED8',
            iconBg: 'rgba(29,78,216,0.1)',
            value: null,
            sub: t('dash.stat.my_request_sub', 'Đang mở'),
            link: 'my_request'
        },
        {
            label: t('dash.stat.my_approval', 'Chờ duyệt'),
            icon: 'pending_actions',
            accent: '#f59e0b',
            iconBg: 'rgba(245,158,11,0.1)',
            value: null,
            sub: t('dash.stat.my_approval_sub', 'Cần xử lý'),
            link: 'my_approval'
        },
        {
            label: t('dash.stat.my_process_owner', 'Tôi chủ trì'),
            icon: 'task_alt',
            accent: '#16a34a',
            iconBg: 'rgba(22,163,74,0.1)',
            value: null,
            sub: t('dash.stat.my_process_owner_sub', 'Đang thực hiện'),
            link: 'my_process_owner'
        },
        {
            label: t('dash.stat.task_pending', 'Task Pending'),
            icon: 'flag',
            accent: '#ef4444',
            iconBg: 'rgba(239,68,68,0.1)',
            value: null,
            sub: t('dash.stat.task_pending_sub', 'Gắn cờ theo dõi'),
            link: 'home'
        }
    ];

    return cards.map(c => `
        <div class="stat-card" style="--stat-card-accent:${c.accent}; --stat-card-icon-bg:${c.iconBg}; cursor:pointer;"
             onclick="window.location.hash='${c.link}'" id="stat-card-${c.link}">
            <div class="stat-card-icon">
                <span class="material-symbols-rounded">${c.icon}</span>
            </div>
            <div class="stat-card-body">
                <div class="stat-card-label">${c.label}</div>
                <div class="stat-card-value ${c.value === null ? 'placeholder' : ''}" id="stat-val-${c.link}">
                    ${c.value === null ? '—' : c.value}
                </div>
                <div class="stat-card-sub">${c.sub}</div>
            </div>
        </div>
    `).join('');
}

// ---- Load Notifications ----
async function dashLoadNotifications() {
    try {
        const refreshBtn = document.getElementById('dash-refresh-noti');
        if (refreshBtn) {
            refreshBtn.style.animation = 'spin 0.8s linear infinite';
            refreshBtn.style.animationIterationCount = '1';
        }

        const res = await apiFetch('/notifications?page=1&limit=500');
        const list = (res && Array.isArray(res.data)) ? res.data : (Array.isArray(res) ? res : []);
        if (list) {
            dashboardNotiList = list;
            dashboardTaskList = list.filter(n => n.is_flagged || n.is_pinned);

            dashRenderNotiList();
            dashRenderTaskList();
            dashUpdateBadges();
        }
    } catch (e) {
        console.error('[Dashboard] Failed to load notifications:', e);
    } finally {
        const refreshBtn = document.getElementById('dash-refresh-noti');
        if (refreshBtn) refreshBtn.style.animation = '';
    }
}

// ---- Set filter tab ----
function dashSetFilter(filter) {
    dashboardNotiFilter = filter;
    dashNotiPage = 1;
    document.querySelectorAll('.noti-filter-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.filter === filter);
    });
    dashRenderNotiList();
}

// ---- Render Notification List ----
function dashRenderNotiList() {
    const listEl = document.getElementById('dash-noti-list');
    if (!listEl) return;

    // Apply filter
    let filtered = [...dashboardNotiList];
    if (dashboardNotiFilter === 'unread') filtered = filtered.filter(n => !n.is_read);
    else if (dashboardNotiFilter === 'pinned') filtered = filtered.filter(n => n.is_pinned);
    else if (dashboardNotiFilter === 'flagged') filtered = filtered.filter(n => n.is_flagged);

    // Sort: pinned → flagged → unread → by date
    filtered.sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        if (a.is_flagged !== b.is_flagged) return a.is_flagged ? -1 : 1;
        if (a.is_read !== b.is_read) return a.is_read ? 1 : -1;
        return new Date(b.created_date) - new Date(a.created_date);
    });

    dashNotiTotal = filtered.length;
    dashNotiTotalPages = Math.ceil(dashNotiTotal / dashNotiLimit) || 1;
    if (dashNotiPage > dashNotiTotalPages) dashNotiPage = dashNotiTotalPages;
    if (dashNotiPage < 1) dashNotiPage = 1;

    dashUpdatePaginationControls();

    if (filtered.length === 0) {
        const emptyMessages = {
            all: t('dash.noti.empty', 'Chưa có thông báo nào'),
            unread: t('dash.noti.empty.unread', 'Không có thông báo chưa đọc'),
            pinned: t('dash.noti.empty.pinned', 'Chưa ghim thông báo nào'),
            flagged: t('dash.noti.empty.flagged', 'Chưa có task nào được gắn cờ')
        };
        listEl.innerHTML = `
            <div class="noti-empty">
                <span class="material-symbols-rounded">notifications_off</span>
                <div class="noti-empty-text">${emptyMessages[dashboardNotiFilter] || t('table.no_records', 'Không có dữ liệu')}</div>
            </div>`;
        return;
    }

    const start = (dashNotiPage - 1) * dashNotiLimit;
    const pageItems = filtered.slice(start, start + dashNotiLimit);

    listEl.innerHTML = pageItems.map(n => dashRenderNotiItem(n)).join('');
}

function dashUpdatePaginationControls() {
    const prevBtn = document.getElementById('dashNotifPrevBtn');
    const nextBtn = document.getElementById('dashNotifNextBtn');
    const pageInfo = document.getElementById('dashNotifPageInfo');
    const pagContainer = document.getElementById('dash-noti-pagination');
    
    if (dashNotiTotal === 0) {
        if (pagContainer) pagContainer.style.display = 'none';
        return;
    } else {
        if (pagContainer) pagContainer.style.display = 'flex';
    }

    if (pageInfo) {
        pageInfo.innerHTML = '';
        pageInfo.style.display = 'flex';
        pageInfo.style.gap = '6px';
        pageInfo.style.alignItems = 'center';
        
        const maxVisible = 5;
        let startPage = Math.max(1, dashNotiPage - Math.floor(maxVisible / 2));
        let endPage = Math.min(dashNotiTotalPages, startPage + maxVisible - 1);
        if (endPage - startPage + 1 < maxVisible) {
            startPage = Math.max(1, endPage - maxVisible + 1);
        }
        
        if (startPage > 1) {
            const firstBtn = createDashPageButton(1, 1 === dashNotiPage);
            pageInfo.appendChild(firstBtn);
            if (startPage > 2) {
                const dots = document.createElement('span');
                dots.textContent = '...';
                dots.style.color = 'var(--text-muted)';
                dots.style.padding = '0 2px';
                pageInfo.appendChild(dots);
            }
        }
        
        for (let i = startPage; i <= endPage; i++) {
            const btn = createDashPageButton(i, i === dashNotiPage);
            pageInfo.appendChild(btn);
        }
        
        if (endPage < dashNotiTotalPages) {
            if (endPage < dashNotiTotalPages - 1) {
                const dots = document.createElement('span');
                dots.textContent = '...';
                dots.style.color = 'var(--text-muted)';
                dots.style.padding = '0 2px';
                pageInfo.appendChild(dots);
            }
            const lastBtn = createDashPageButton(dashNotiTotalPages, dashNotiTotalPages === dashNotiPage);
            pageInfo.appendChild(lastBtn);
        }
    }
    if (prevBtn) {
        prevBtn.disabled = dashNotiPage <= 1;
        prevBtn.style.opacity = dashNotiPage <= 1 ? '0.5' : '1';
        prevBtn.style.cursor = dashNotiPage <= 1 ? 'not-allowed' : 'pointer';
    }
    if (nextBtn) {
        nextBtn.disabled = dashNotiPage >= dashNotiTotalPages;
        nextBtn.style.opacity = dashNotiPage >= dashNotiTotalPages ? '0.5' : '1';
        nextBtn.style.cursor = dashNotiPage >= dashNotiTotalPages ? 'not-allowed' : 'pointer';
    }
}

function createDashPageButton(pageNum, isActive) {
    const btn = document.createElement('button');
    btn.textContent = pageNum;
    btn.className = 'btn btn-sm';
    btn.style.cssText = `
        height: 24px;
        width: 24px;
        min-width: 24px;
        padding: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        border: 1px solid ${isActive ? 'var(--accent)' : 'var(--border)'};
        border-radius: 4px;
        background: ${isActive ? 'rgba(249, 115, 22, 0.1)' : 'transparent'};
        color: ${isActive ? 'var(--accent)' : 'var(--text)'};
        font-weight: ${isActive ? '700' : '500'};
        cursor: pointer;
        transition: all 0.2s;
    `;
    btn.onclick = () => {
        if (pageNum !== dashNotiPage) {
            dashNotiPage = pageNum;
            dashRenderNotiList();
        }
    };
    return btn;
}

window.dashChangeNotificationPage = function(dir) {
    const targetPage = dashNotiPage + dir;
    if (targetPage < 1 || targetPage > dashNotiTotalPages) return;
    dashNotiPage = targetPage;
    dashRenderNotiList();
};

// ---- Render single notification item ----
function dashRenderNotiItem(n) {
    const requestId = dashExtractRequestId(n.link);
    const isWatching = requestId ? (dashboardWatches[requestId] !== false) : false;
    const hasLink = !!n.link;

    // Status classes
    let classes = 'noti-item';
    if (!n.is_read) classes += ' is-unread';
    if (n.is_pinned) classes += ' is-pinned';
    if (n.is_flagged) classes += ' is-flagged';

    // Tags (Notice the emoji icons are removed!)
    const tags = [];
    if (n.is_pinned) tags.push(`<span class="noti-item-tag pinned">${t('dash.noti.tag.pinned', 'Đã ghim')}</span>`);
    if (n.is_flagged) tags.push(`<span class="noti-item-tag flagged">${t('dash.noti.tag.flagged', 'Task')}</span>`);
    if (requestId && isWatching) tags.push(`<span class="noti-item-tag watching">${t('dash.noti.tag.watching', 'Theo dõi')}</span>`);

    // Plain text body (strip HTML)
    const plainBody = (n.body || '').replace(/<[^>]*>/gm, '');

    return `
        <div class="${classes}" data-noti-id="${escapeHTML(String(n.id))}">
            <div class="noti-item-indicator ${n.is_read ? 'read' : ''}"></div>
            <div class="noti-item-body">
                <div class="noti-item-title" title="${escapeHTML(n.title || 'Thông báo')}">${escapeHTML(n.title || 'Thông báo')}</div>
                <div class="noti-item-text">${escapeHTML(plainBody)}</div>
                <div class="noti-item-meta">
                    <span class="noti-item-time">${dashTimeAgo(n.created_date)}</span>
                    ${tags.join('')}
                </div>
            </div>
            <div class="noti-action-btns">
                ${!n.is_read ? `
                <button class="noti-action-btn" onclick="dashMarkRead('${escapeHTML(String(n.id))}')" title="${t('dash.noti.action.mark_read', 'Đánh dấu đã đọc')}">
                    done
                </button>` : ''}
                <button class="noti-action-btn ${n.is_pinned ? 'active-pin' : ''}"
                    onclick="dashTogglePin('${escapeHTML(String(n.id))}')"
                    title="${n.is_pinned ? t('dash.noti.action.unpin', 'Bỏ ghim') : t('dash.noti.action.pin', 'Ghim thông báo')}">
                    push_pin
                </button>
                <button class="noti-action-btn ${n.is_flagged ? 'active-flag' : ''}"
                    onclick="dashToggleFlag('${escapeHTML(String(n.id))}')"
                    title="${n.is_flagged ? t('dash.noti.action.unflag', 'Bỏ cờ') : t('dash.noti.action.flag', 'Gắn cờ → tạo Task')}">
                    flag
                </button>
                ${requestId ? `
                <button class="noti-action-btn ${isWatching ? 'active-watch' : ''}"
                    onclick="dashToggleWatch('${escapeHTML(String(n.id))}', '${escapeHTML(requestId)}')"
                    title="${isWatching ? t('dash.noti.action.unwatch', 'Bỏ theo dõi request') : t('dash.noti.action.watch', 'Theo dõi request')}">
                    ${isWatching ? 'notifications_active' : 'notifications_off'}
                </button>` : ''}
                ${hasLink ? `
                <button class="noti-action-btn navigate"
                    onclick="dashNavigate('${escapeHTML(n.id)}', '${escapeHTML(n.link)}')"
                    title="${t('dash.noti.action.view', 'Xem chi tiết')}">
                    arrow_forward
                </button>` : ''}
            </div>
        </div>
    `;
}

// ---- Render Task Pending List ----
function dashRenderTaskList() {
    const listEl = document.getElementById('dash-task-list');
    if (!listEl) return;

    dashboardTaskList = dashboardNotiList.filter(n => n.is_flagged || n.is_pinned);

    if (dashboardTaskList.length === 0) {
        listEl.innerHTML = `
            <div class="task-empty">
                <span class="material-symbols-rounded">task_alt</span>
                <div class="task-empty-text">${t('dash.task.empty', 'Không có task nào. Gắn cờ vào thông báo để tạo task.')}</div>
            </div>`;
        return;
    }

    listEl.innerHTML = dashboardTaskList.map(n => {
        const plainBody = (n.body || '').replace(/<[^>]*>/gm, '');
        return `
            <div class="task-item" data-task-id="${escapeHTML(String(n.id))}">
                <button class="task-complete-btn"
                    onclick="dashCompleteTask('${escapeHTML(String(n.id))}')"
                    title="${t('dash.task.complete', 'Đánh dấu hoàn thành')}"></button>
                <div class="task-item-body" onclick="${n.link ? `dashNavigate('${escapeHTML(String(n.id))}', '${escapeHTML(n.link)}')` : ''}">
                    <div class="task-item-title">${escapeHTML(n.title || 'Task')}</div>
                    <div class="task-item-sub">${escapeHTML(plainBody.substring(0, 80))}${plainBody.length > 80 ? '…' : ''}</div>
                    ${n.flagged_note ? `<div class="task-item-note">📝 ${escapeHTML(n.flagged_note)}</div>` : ''}
                    <div class="task-item-sub" style="margin-top:3px; opacity:0.7">${dashTimeAgo(n.created_date)}</div>
                </div>
            </div>
        `;
    }).join('');
}

// ---- Update Badges ----
function dashUpdateBadges() {
    const unreadCount = dashboardNotiList.filter(n => !n.is_read).length;
    const taskCount = dashboardNotiList.filter(n => n.is_flagged || n.is_pinned).length;

    const notiBadge = document.getElementById('dash-noti-badge');
    if (notiBadge) {
        notiBadge.textContent = unreadCount > 99 ? '99+' : unreadCount;
        notiBadge.style.display = unreadCount > 0 ? 'inline-block' : 'none';
    }

    const taskBadge = document.getElementById('task-count-badge');
    if (taskBadge) {
        taskBadge.textContent = taskCount;
        taskBadge.style.display = taskCount > 0 ? 'inline-block' : 'none';
    }

    // Update stat card for tasks
    const taskStatVal = document.getElementById('stat-val-home');
    if (taskStatVal) {
        taskStatVal.textContent = taskCount > 0 ? formatNumber(taskCount) : '—';
        taskStatVal.className = 'stat-card-value' + (taskCount === 0 ? ' placeholder' : '');
    }
}

// ---- Actions ----

async function dashMarkRead(id) {
    try {
        await apiFetch(`/notifications/${id}/read`, 'PUT');
        const n = dashboardNotiList.find(n => String(n.id) === String(id));
        if (n) n.is_read = true;
        // Also update the shared notificationsList (for the bell dropdown)
        const global = notificationsList.find(n => String(n.id) === String(id));
        if (global) global.is_read = true;
        updateNotificationBadge();
        dashRenderNotiList();
        dashUpdateBadges();
    } catch (e) {
        console.error('[Dashboard] Error marking read', e);
        showToast(t('table.failed_load', 'Lỗi thực hiện'), 'error');
    }
}

async function dashMarkAllRead() {
    try {
        await apiFetch('/notifications/read-all', 'PUT');
        dashboardNotiList.forEach(n => n.is_read = true);
        notificationsList.forEach(n => n.is_read = true);
        updateNotificationBadge();
        dashRenderNotiList();
        dashUpdateBadges();
        showToast(t('dash.noti.mark_all_read', 'Đã đánh dấu tất cả đã đọc'), 'success');
    } catch (e) {
        console.error('[Dashboard] Error marking all read', e);
        showToast(t('table.failed_load', 'Lỗi thực hiện'), 'error');
    }
}

async function dashTogglePin(id) {
    try {
        const updated = await apiFetch(`/notifications/${id}/pin`, 'PUT');
        const idx = dashboardNotiList.findIndex(n => String(n.id) === String(id));
        if (idx > -1) dashboardNotiList[idx] = { ...dashboardNotiList[idx], ...updated };

        const isPinned = dashboardNotiList[idx]?.is_pinned;
        showToast(isPinned ? t('dash.toast.pin_success', 'Đã ghim thông báo') : t('dash.toast.unpin_success', 'Đã bỏ ghim thông báo'), 'success');
        dashRenderNotiList();
        dashRenderTaskList();
        dashUpdateBadges();
    } catch (e) {
        console.error('[Dashboard] Error toggling pin', e);
        showToast(t('table.failed_load', 'Lỗi thực hiện'), 'error');
    }
}

async function dashToggleFlag(id) {
    try {
        const updated = await apiFetch(`/notifications/${id}/flag`, 'PUT');
        const idx = dashboardNotiList.findIndex(n => String(n.id) === String(id));
        if (idx > -1) dashboardNotiList[idx] = { ...dashboardNotiList[idx], ...updated };

        const isFlagged = dashboardNotiList[idx]?.is_flagged;
        showToast(isFlagged ? t('dash.toast.flag_success', 'Đã gắn cờ – thêm vào Task Pending') : t('dash.toast.unflag_success', 'Đã bỏ cờ khỏi Task Pending'), 'success');
        dashRenderNotiList();
        dashRenderTaskList();
        dashUpdateBadges();
    } catch (e) {
        console.error('[Dashboard] Error toggling flag', e);
        showToast(t('table.failed_load', 'Lỗi thực hiện'), 'error');
    }
}

async function dashToggleWatch(notiId, requestId) {
    const currentlyWatching = dashboardWatches[requestId] !== false;
    try {
        if (currentlyWatching) {
            await apiFetch('/notifications/unwatch', 'PUT', { requestId });
            dashboardWatches[requestId] = false;
            showToast(t('dash.toast.unwatch_success', 'Đã bỏ theo dõi request này'), 'info');
        } else {
            await apiFetch('/notifications/watch', 'POST', { requestId });
            dashboardWatches[requestId] = true;
            showToast(t('dash.toast.watch_success', 'Đang theo dõi request này'), 'success');
        }
        dashRenderNotiList();
    } catch (e) {
        console.error('[Dashboard] Error toggling watch', e);
        showToast(t('table.failed_load', 'Lỗi thực hiện'), 'error');
    }
}

async function dashCompleteTask(id) {
    try {
        const updated = await apiFetch(`/notifications/${id}/complete-task`, 'PUT');
        const idx = dashboardNotiList.findIndex(n => String(n.id) === String(id));
        if (idx > -1) {
            dashboardNotiList[idx] = { 
                ...dashboardNotiList[idx], 
                ...updated,
                is_flagged: false,
                is_pinned: false
            };
        }

        showToast(t('dash.toast.task_complete', 'Task đã hoàn thành!'), 'success');

        // Animate removal
        const taskEl = document.querySelector(`[data-task-id="${id}"]`);
        if (taskEl) {
            taskEl.style.transition = 'opacity 0.3s, transform 0.3s';
            taskEl.style.opacity = '0';
            taskEl.style.transform = 'translateX(20px)';
            setTimeout(() => {
                dashRenderTaskList();
                dashUpdateBadges();
                dashRenderNotiList();
            }, 300);
        } else {
            dashRenderTaskList();
            dashUpdateBadges();
            dashRenderNotiList();
        }
    } catch (e) {
        console.error('[Dashboard] Error completing task', e);
        showToast(t('table.failed_load', 'Lỗi thực hiện'), 'error');
    }
}

function dashNavigate(notiId, link) {
    if (!link) return;
    // Mark as read before navigating
    const n = dashboardNotiList.find(n => String(n.id) === String(notiId));
    if (n && !n.is_read) {
        dashMarkRead(notiId).catch(() => {});
    }
    window.location.hash = link;
}

// ---- Sync from SSE (called from notifications.js when new notification arrives) ----
window.dashboardSyncNewNotification = function(notif) {
    // Only sync if currently on the home dashboard
    if (typeof currentModule !== 'undefined' && currentModule !== 'home') return;
    if (!document.getElementById('home-dashboard-root')) return;

    const exists = dashboardNotiList.some(n => n.id === notif.id);
    if (!exists) {
        dashboardNotiList.unshift(notif);
        dashNotiPage = 1;
        dashRenderNotiList();
        dashRenderTaskList();
        dashUpdateBadges();
    }
};
