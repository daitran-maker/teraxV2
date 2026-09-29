let notificationsList = [];
let isNotificationOpen = false;
let notificationPage = 1;
let notificationLimit = 10;
let notificationTotal = 0;
let notificationTotalPages = 1;

document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('notificationBtn');
    if (btn) {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // Check HTTPS/Localhost requirement
            if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
                showToast(t('noti.https_required', 'Web Push yêu cầu kết nối HTTPS (ổ khóa xanh). Vui lòng dùng link Ngrok/HTTPS để nhận thông báo.'), 'error');
            } else if (!("Notification" in window)) {
                showToast(t('noti.not_supported', 'Trình duyệt của bạn không hỗ trợ chức năng Thông báo (Notification).'), 'error');
            } else if (Notification.permission === "default") {
                Notification.requestPermission().then(permission => {
                    if (permission === 'granted') {
                        subscribeUserToPush();
                        showToast(t('noti.permission_granted', 'Đã cấp quyền thông báo thành công!'), 'success');
                    } else {
                        showToast(t('noti.permission_denied', 'Bạn đã từ chối cấp quyền thông báo.'), 'error');
                    }
                });
            } else if (Notification.permission === "denied") {
                showToast(t('noti.permission_blocked', 'Quyền thông báo đang bị CHẶN. Vui lòng vào Cài đặt trình duyệt để mở khóa.'), 'error');
            }

            toggleNotificationDropdown();
        });
    }

    document.addEventListener('click', (e) => {
        const dropdown = document.getElementById('notificationDropdown');
        if (dropdown && isNotificationOpen && !dropdown.contains(e.target)) {
            closeNotificationDropdown();
        }
    });

    // Subscribe to Web Push if already granted
    if ("Notification" in window && Notification.permission === "granted") {
        subscribeUserToPush();
    }

    // Load initial notifications and badge count
    setTimeout(loadNotifications, 2000);
});

function toggleNotificationDropdown() {
    const dropdown = document.getElementById('notificationDropdown');
    isNotificationOpen = !isNotificationOpen;
    dropdown.style.display = isNotificationOpen ? 'flex' : 'none';
    if (isNotificationOpen) {
        notificationPage = 1; // Reset to page 1 when opening
        loadNotifications();
    }
}

function closeNotificationDropdown() {
    const dropdown = document.getElementById('notificationDropdown');
    isNotificationOpen = false;
    dropdown.style.display = 'none';
}

async function loadNotifications() {
    try {
        const res = await apiFetch(`/notifications?page=${notificationPage}&limit=${notificationLimit}`);
        if (res && Array.isArray(res.data)) {
            notificationsList = res.data;
            notificationTotal = res.total || 0;
            notificationTotalPages = res.totalPages || 1;
            
            updateNotificationBadge();
            if (isNotificationOpen) {
                renderNotifications();
                updatePaginationControls();
            }
        }
    } catch (e) {
        console.error('[Notification] Failed to load notifications:', e);
    }
}

async function updateNotificationBadge() {
    const badge = document.getElementById('notificationBadge');
    if (!badge) return;
    try {
        const res = await apiFetch('/notifications/unread-count');
        const unreadCount = res && typeof res.count === 'number' ? res.count : 0;
        if (unreadCount > 0) {
            badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
            badge.style.display = 'block';
        } else {
            badge.style.display = 'none';
        }
    } catch (e) {
        console.error('[Notification] Failed to update unread count badge:', e);
    }
}

function updatePaginationControls() {
    const prevBtn = document.getElementById('notifPrevBtn');
    const nextBtn = document.getElementById('notifNextBtn');
    const pageInfo = document.getElementById('notifPageInfo');
    
    if (pageInfo) {
        pageInfo.innerHTML = '';
        pageInfo.style.display = 'flex';
        pageInfo.style.gap = '6px';
        pageInfo.style.alignItems = 'center';
        
        const maxVisible = 5;
        let startPage = Math.max(1, notificationPage - Math.floor(maxVisible / 2));
        let endPage = Math.min(notificationTotalPages, startPage + maxVisible - 1);
        if (endPage - startPage + 1 < maxVisible) {
            startPage = Math.max(1, endPage - maxVisible + 1);
        }
        
        if (startPage > 1) {
            const firstBtn = createPageButton(1, 1 === notificationPage);
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
            const btn = createPageButton(i, i === notificationPage);
            pageInfo.appendChild(btn);
        }
        
        if (endPage < notificationTotalPages) {
            if (endPage < notificationTotalPages - 1) {
                const dots = document.createElement('span');
                dots.textContent = '...';
                dots.style.color = 'var(--text-muted)';
                dots.style.padding = '0 2px';
                pageInfo.appendChild(dots);
            }
            const lastBtn = createPageButton(notificationTotalPages, notificationTotalPages === notificationPage);
            pageInfo.appendChild(lastBtn);
        }
    }
    if (prevBtn) {
        prevBtn.disabled = notificationPage <= 1;
        prevBtn.style.opacity = notificationPage <= 1 ? '0.5' : '1';
        prevBtn.style.cursor = notificationPage <= 1 ? 'not-allowed' : 'pointer';
    }
    if (nextBtn) {
        nextBtn.disabled = notificationPage >= notificationTotalPages;
        nextBtn.style.opacity = notificationPage >= notificationTotalPages ? '0.5' : '1';
        nextBtn.style.cursor = notificationPage >= notificationTotalPages ? 'not-allowed' : 'pointer';
    }
}

function createPageButton(pageNum, isActive) {
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
    btn.onclick = async () => {
        if (pageNum !== notificationPage) {
            notificationPage = pageNum;
            await loadNotifications();
        }
    };
    return btn;
}

window.changeNotificationPage = async function(dir) {
    const targetPage = notificationPage + dir;
    if (targetPage < 1 || targetPage > notificationTotalPages) return;
    notificationPage = targetPage;
    await loadNotifications();
};

function renderNotifications() {
    const listEl = document.getElementById('notificationList');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (notificationsList.length === 0) {
        listEl.innerHTML = '<div style="padding:20px; text-align:center; color:var(--text-muted); font-size:13px;">No notifications yet</div>';
        return;
    }

    // Sort: unread first, then by date descending
    const sorted = [...notificationsList].sort((a, b) => {
        if (a.is_read !== b.is_read) return a.is_read ? 1 : -1;
        return new Date(b.created_date) - new Date(a.created_date);
    });

    sorted.forEach(n => {
        const item = document.createElement('div');
        item.style.padding = '12px 15px';
        item.style.borderBottom = '1px solid var(--border)';
        item.style.cursor = 'pointer';
        item.style.transition = 'background 0.2s';
        item.style.background = n.is_read ? 'transparent' : 'rgba(249, 115, 22, 0.05)';
        item.style.display = 'flex';
        item.style.flexDirection = 'column';
        item.style.gap = '4px';

        item.onmouseenter = () => item.style.background = n.is_read ? 'rgba(255,255,255,0.05)' : 'rgba(249, 115, 22, 0.1)';
        item.onmouseleave = () => item.style.background = n.is_read ? 'transparent' : 'rgba(249, 115, 22, 0.05)';

        item.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div style="font-weight:600; font-size:13px; color: ${n.is_read ? 'var(--text)' : 'var(--accent)'};">${n.title || 'Notification'}</div>
                ${!n.is_read ? '<div style="width:8px; height:8px; border-radius:50%; background:var(--accent-red); margin-top:4px; flex-shrink:0;"></div>' : ''}
            </div>
            <div style="font-size:12px; color:var(--text-muted); line-height:1.4;">${n.body || ''}</div>
            <div style="font-size:10px; color:var(--text-muted); opacity:0.7; margin-top:2px;">${formatDateTime(n.created_date)}</div>
        `;

        item.onclick = async () => {
            if (!n.is_read) {
                await markAsRead(n.id);
            }
            if (n.link) {
                window.location.hash = n.link;
                closeNotificationDropdown();
            }
        };

        listEl.appendChild(item);
    });
}

async function markAsRead(id) {
    try {
        await apiFetch('/notifications/' + id + '/read', 'PUT');
        updateNotificationBadge();
        await loadNotifications();
    } catch (e) {
        console.error('Error marking as read', e);
    }
}

async function markAllNotificationsRead() {
    try {
        await apiFetch('/notifications/read-all', 'PUT');
        updateNotificationBadge();
        await loadNotifications();
    } catch (e) {
        console.error('Error marking all as read', e);
    }
}

// Intercept EventSource assignment to handle SSE events and reconnections automatically.
let _evtSourceInstance = null;

Object.defineProperty(window, 'evtSource', {
    get() {
        return _evtSourceInstance;
    },
    set(newSource) {
        if (_evtSourceInstance && _evtSourceInstance !== newSource) {
            try {
                _evtSourceInstance.close();
            } catch (e) {}
        }
        _evtSourceInstance = newSource;
        if (newSource) {
            console.log('[Notification] New EventSource connection detected. Attaching listener...');
            
            // Listen for new notifications
            newSource.addEventListener('new_notification', (e) => {
                try {
                    const notif = JSON.parse(e.data);
                    const targetUser = notif.user_employee_id;
                    const currentUser = typeof authUser !== 'undefined' && authUser ? authUser.employee_id : null;
                    if (targetUser && currentUser && String(targetUser).toLowerCase() !== String(currentUser).toLowerCase()) {
                        return; // Ignore notifications meant for other users
                    }
                    
                    // Prevent duplicates in the notifications array
                    if (!notificationsList.some(n => n.id === notif.id)) {
                        updateNotificationBadge();
                        if (isNotificationOpen) {
                            if (notificationPage === 1) {
                                loadNotifications();
                            } else {
                                notificationsList.unshift(notif);
                                if (notificationsList.length > notificationLimit) {
                                    notificationsList.pop();
                                }
                                renderNotifications();
                            }
                        }

                        // Sync to Dashboard Home if open
                        if (typeof window.dashboardSyncNewNotification === 'function') {
                            window.dashboardSyncNewNotification(notif);
                        }

                        // Remove HTML tags for plain text display
                        const plainBody = (notif.body || '').replace(/<[^>]*>?/gm, '');

                        // Always show in-app toast notification so the user doesn't miss it if Windows Do Not Disturb is on
                        showToast(plainBody || 'You have a new notification', 'info', notif.title || 'New Notification', true);

                        // Trigger push notification if granted
                        if ("Notification" in window && Notification.permission === "granted") {
                            new Notification(notif.title || 'TeraX', {
                                body: plainBody || 'You have a new notification',
                                icon: '/icon-v2.png'
                            });
                        }
                    }
                } catch(err) {
                    console.error('[Notification] Error parsing/handling new notification SSE event:', err);
                }
            });

            // Automatically reload notifications and current views when connection is established/re-established
            newSource.addEventListener('open', () => {
                console.log('[Notification] SSE stream established. Fetching latest data...');
                loadNotifications();
                
                // Silent refresh of active client view
                if (typeof currentView !== 'undefined' && typeof currentModule !== 'undefined') {
                    if (currentView === 'table') {
                        refreshTableData(currentModule, true).catch(() => {});
                    } else if (currentView === 'detail' && typeof currentRecord !== 'undefined' && currentRecord) {
                        const pkField = MODULES[currentModule]?.pk;
                        if (pkField && currentRecord[pkField]) {
                            openDetailInternal(currentModule, currentRecord[pkField], true, true).catch(() => {});
                        }
                    } else if (currentView === 'dashboard') {
                        const meta = DASHBOARD_META[currentModule];
                        if (meta) {
                            apiGet(`/my-views/${meta.apiPath}`).then(res => {
                                dashboardData = res.data || [];
                                applyDashboardFilters(currentModule);
                            }).catch(() => {});
                        }
                    }
                }
            });
        }
    },
    configurable: true,
    enumerable: true
});

// Helper: Web Push Subscriptions
const PUBLIC_VAPID_KEY = 'BB9c2sN9HL17iyM6UtISHRN-NEDR9v490BoaOkzWdOq8GOs08c-hDgMQvc0xORsps2mS9GoHIbyqzgdh7898_PI';

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

async function subscribeUserToPush() {
    if (!('serviceWorker' in navigator)) {
        showToast(t('noti.sw_not_supported', 'Trình duyệt không hỗ trợ Service Worker.'), 'error');
        return;
    }
    if (!('PushManager' in window)) {
        showToast(t('noti.push_not_supported', 'Trình duyệt không hỗ trợ Web Push (Safari cần Add to Home Screen + HTTPS).'), 'error');
        return;
    }

    try {
        await navigator.serviceWorker.register('sw.js');
        const readyRegistration = await navigator.serviceWorker.ready;
        
        const subscription = await readyRegistration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
        });

        // Send to backend
        await apiFetch('/notifications/subscribe', 'POST', { subscription });
        console.log('[Web Push] Subscribed successfully!');
        showToast(t('noti.subscribe_success', 'Đăng ký nhận Thông báo ngầm thành công!'), 'success');
    } catch (error) {
        console.error('[Web Push] Failed to subscribe:', error);
        showToast(t('noti.subscribe_failed', 'Lỗi khi đăng ký thông báo: ') + error.message, 'error');
    }
}
