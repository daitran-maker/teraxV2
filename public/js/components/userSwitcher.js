/**
 * CRC App - User Switcher Component
 * Extracted as part of Phase 2 Modularization
 */

let userSwitcherUsers = [];

function closeUserSwitcher() {
  const dropdown = document.getElementById('user-switcher-dropdown');
  if (dropdown) dropdown.style.display = 'none';
}
window.closeUserSwitcher = closeUserSwitcher;

async function toggleUserSwitcher(event) {
  if (event) event.stopPropagation();

  const dropdown = document.getElementById('user-switcher-dropdown');
  const list = document.getElementById('user-switcher-list');
  const search = document.getElementById('user-switcher-search');
  if (!dropdown || !list) return;

  const willOpen = dropdown.style.display !== 'block';
  if (!willOpen) {
    closeUserSwitcher();
    return;
  }

  dropdown.style.display = 'block';
  if (search) {
    search.value = '';
    setTimeout(() => search.focus(), 0);
  }

  if (userSwitcherUsers.length === 0) {
    list.innerHTML = `<div style="padding:14px; color:#64748B; font-size:12px;">Loading users...</div>`;
    try {
      const res = await apiGet('/auth/switch-users');
      userSwitcherUsers = Array.isArray(res.data) ? res.data : [];
    } catch (err) {
      list.innerHTML = `<div style="padding:14px; color:#EF4444; font-size:12px;">${escapeHTML(err.message || 'Could not load users.')}</div>`;
      return;
    }
  }

  renderUserSwitcherList(userSwitcherUsers);
}
window.toggleUserSwitcher = toggleUserSwitcher;

function renderUserSwitcherList(users) {
  const list = document.getElementById('user-switcher-list');
  if (!list) return;

  if (!users || users.length === 0) {
    list.innerHTML = `<div style="padding:14px; color:#64748B; font-size:12px;">No users found.</div>`;
    return;
  }

  const currentId = String((window.authUser && window.authUser.employee_id) || '').toLowerCase();
  list.innerHTML = users.map(user => {
    const employeeId = String(user.employee_id || '');
    const isCurrent = employeeId.toLowerCase() === currentId;
    const name = user.full_name || user.email || user.username || employeeId;
    const meta = [user.position, user.role, user.email].filter(Boolean).join(' • ');
    return `
      <button type="button" onclick="switchToUser('${escapeHTML(employeeId).replace(/'/g, "\\'")}')" style="width:100%; display:flex; align-items:center; justify-content:space-between; gap:10px; border:none; background:${isCurrent ? '#FFF7ED' : '#FFFFFF'}; color:#0F172A; text-align:left; padding:10px 12px; border-radius:6px; cursor:pointer; font-family:inherit;">
        <span style="min-width:0;">
          <span style="display:block; font-size:13px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHTML(name)}</span>
          <span style="display:block; margin-top:2px; font-size:11px; color:#64748B; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHTML(meta)}</span>
        </span>
        ${isCurrent ? `<span class="material-symbols-rounded" style="font-size:17px; color:#F97316;">check_circle</span>` : ''}
      </button>
    `;
  }).join('');
}
window.renderUserSwitcherList = renderUserSwitcherList;

function filterUserSwitcher(query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) {
    renderUserSwitcherList(userSwitcherUsers);
    return;
  }

  renderUserSwitcherList(userSwitcherUsers.filter(user => [
    user.employee_id,
    user.full_name,
    user.email,
    user.username,
    user.role,
    user.position
  ].some(v => String(v || '').toLowerCase().includes(q))));
}
window.filterUserSwitcher = filterUserSwitcher;

async function switchToUser(employeeId) {
  const currentId = String((window.authUser && window.authUser.employee_id) || '').toLowerCase();
  if (!employeeId || String(employeeId).toLowerCase() === currentId) {
    closeUserSwitcher();
    return;
  }

  try {
    const res = await apiPost('/auth/switch-user', { employee_id: employeeId });
    localStorage.setItem('crc_token', res.token);
    localStorage.setItem('crc_user', JSON.stringify(res.user));

    const hashParts = window.location.hash.replace('#', '').split('/');
    const viewName = hashParts[0];
    const recordId = hashParts[1];
    if (recordId && ['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(viewName)) {
      try {
        await apiGet(`/table/request/${encodeURIComponent(recordId)}?pk=request_id&view=${viewName}`);
      } catch (err) {
        if (typeof redirectToAccessDenied === 'function') {
          redirectToAccessDenied();
        }
        return;
      }
    }

    window.location.reload();
  } catch (err) {
    showToast(err.message || 'Could not switch user.', 'error');
  }
}
window.switchToUser = switchToUser;

document.addEventListener('click', function (e) {
  const switcher = document.getElementById('topbar-user-switcher');
  if (switcher && !switcher.contains(e.target)) {
    closeUserSwitcher();
  }
}, true);
