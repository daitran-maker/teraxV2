/**
 * CRC App - Toast & Alert Notification Components
 * Extracted as part of Phase 2 Modularization
 * All functions are safely mounted to window.* for zero-regression backward compatibility.
 */

function showToast(msg, type = 'info', title = null, requireHoverToDismiss = false) {
  const icons = { success: 'check_circle', error: 'warning', warning: 'warning', info: 'info' };
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.style.boxShadow = '0 10px 30px rgba(0,0,0,0.1)';

  if (title) {
    toast.innerHTML = `
      <div style="display:flex; align-items:flex-start; gap:14px;">
        <span class="material-symbols-rounded" style="font-size:23px; color:#fff; margin-top:2px;">${icons[type] || 'info'}</span>
        <div style="display:flex; flex-direction:column; gap:6px; max-width: 320px;">
          <strong style="font-size:14px; color:#fff; line-height: 1.3;">${title}</strong>
          <span style="font-size:12px; color:rgba(255,255,255,0.9); line-height: 1.5; word-wrap: break-word;">${msg}</span>
        </div>
      </div>
    `;
    toast.style.padding = '20px 24px';
    toast.style.background = 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)';
    toast.style.border = 'none';
    toast.style.boxShadow = '0 15px 40px rgba(234, 88, 12, 0.4)';
    toast.style.color = '#fff';
  } else {
    toast.innerHTML = `<span class="material-symbols-rounded" style="font-size:18px; color:inherit;">${icons[type] || 'info'}</span><span>${msg}</span>`;
  }

  container.appendChild(toast);

  let dismissTimeout;
  const fadeOut = () => {
    toast.style.animation = 'fadeOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  };

  if (requireHoverToDismiss) {
    let hasHovered = false;
    toast.style.cursor = 'pointer';
    toast.addEventListener('mouseenter', () => {
      hasHovered = true;
    });
    toast.addEventListener('mouseleave', () => {
      if (hasHovered) fadeOut();
    });
    toast.addEventListener('click', () => {
      fadeOut();
    });
  } else {
    dismissTimeout = setTimeout(fadeOut, 3000);
  }
}
window.showToast = showToast;

function showAlert(msg, type = 'success', title = 'Done!') {
  const icons = { success: 'check_circle', error: 'warning', warning: 'warning', info: 'info' };
  const iconEl = document.getElementById('alert-icon');
  if (iconEl) {
    iconEl.textContent = icons[type] || 'info';
    iconEl.style.color = type === 'success' ? 'var(--accent)' : 'var(--accent-red)';
  }

  const titleEl = document.getElementById('alert-title');
  if (titleEl) titleEl.textContent = title;

  const msgEl = document.getElementById('alert-message');
  if (msgEl) msgEl.textContent = msg;

  if (typeof openModal === 'function') {
    openModal('alert-modal');
  }
}
window.showAlert = showAlert;
