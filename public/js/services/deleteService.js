/**
 * CRC App - Delete, Bulk Delete, Restore & Confirmation Service
 * Extracted as part of Phase 2 Modularization
 */

// ============================================================
// DELETE
// ============================================================
function confirmDelete(moduleKey, pkVal, name) {
  if (shouldHideRequestEditDeleteActions(moduleKey)) {
    return;
  }

  document.getElementById('confirm-message').textContent =
    t('toast.confirm_delete', `Are you sure you want to delete "${name}"?`).replace('{{name}}', name);
  const btn = document.getElementById('confirm-ok-btn');
  btn.onclick = () => doDelete(moduleKey, pkVal);
  openModal('confirm-modal');
}

async function doDelete(moduleKey, pkVal) {
  const mod = MODULES[moduleKey];
  let endpointPath = getRecordEndpoint(moduleKey, pkVal, false);
  if (currentView === 'detail' && moduleKey !== currentModule && currentModule) {
    endpointPath += `?view=${currentModule}`;
  }
  try {
    await apiDelete(endpointPath);
    closeModal('confirm-modal');
    showToast(t('toast.record_deleted', 'Record deleted successfully!'), 'success');
    delete selectCache[moduleKey]; // Clear only current module cache

    // Clear DOM cache pane for this module to force reload on next navigation
    const cachedPane = document.getElementById('pane-' + moduleKey);
    if (cachedPane) cachedPane.dataset.dirty = 'true';
    if (moduleKey === 'request') {
      ['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].forEach(v => {
        const p = document.getElementById('pane-' + v);
        if (p) p.dataset.dirty = 'true';
      });
    } else if (['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(moduleKey)) {
      const p = document.getElementById('pane-request');
      if (p) p.dataset.dirty = 'true';
      ['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].forEach(v => {
        if (v !== moduleKey) {
          const p2 = document.getElementById('pane-' + v);
          if (p2) p2.dataset.dirty = 'true';
        }
      });
    }

    lastCurrencyCache = { key: null, value: 'VND' };
    if (['permissions', 'exception_rules', 'action_rules'].includes(moduleKey)) {
      await applyMenuPermissions();
    }
    if (currentView === 'detail') {
      if (moduleKey === currentModule) {
        const isSuperAdmin = authUser && authUser.role && authUser.role.toUpperCase() === 'SUPER ADMIN';
        if (isSuperAdmin) {
          await openDetailInternal(currentModule, pkVal, true);
        } else {
          closeTabPane('content');
        }
      } else {
        // We deleted a child record (like a comment)
        const parentPkField = MODULES[currentModule] ? MODULES[currentModule].pk : 'id';
        const parentPkVal = (window.currentDetailRecord ? window.currentDetailRecord[parentPkField] : null) || (currentRecord ? currentRecord[parentPkField] : null);
        if (parentPkVal) {
          clearChildTableCache(moduleKey, currentModule, parentPkVal);
          if (moduleKey === 'comment' || moduleKey === 'ticket_comment') {
            const cmtEl = document.querySelector(`[data-comment-id="${pkVal}"]`);
            if (cmtEl) {
              cmtEl.style.transition = 'opacity 0.3s ease';
              cmtEl.style.opacity = '0';
              setTimeout(() => {
                cmtEl.remove();
                const stream = document.querySelector('.comments-stream');
                // if it's the last comment, show the empty text
                if (stream && !stream.querySelector('.comment-card')) {
                  stream.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:11px;">${typeof t === 'function' ? t('detail.no_related', 'No related records found.') : 'No related records found.'}</div>`;
                }
              }, 300);
            } else {
              loadChildTable(moduleKey, currentModule, parentPkVal);
            }
          } else {
            loadChildTable(moduleKey, currentModule, parentPkVal);
          }
        }
      }
    } else if (currentView === 'dashboard' && ['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(currentModule)) {
      await loadDashboardView(currentModule);
    } else if (currentView === 'kanban' && currentModule === 'assigned_task') {
      if (typeof renderAssignedTaskKanbanView === 'function') {
        await renderAssignedTaskKanbanView('assigned_task', true);
      }
    } else {
      await refreshTableData(currentModule || moduleKey, true);
    }
  } catch (err) {
    closeModal('confirm-modal');
    showToast(err.message, 'error');
  }
}

function confirmHardDelete(moduleKey, pkVal, name) {
  document.getElementById('confirm-message').textContent =
    `WARNING: Are you sure you want to PERMANENTLY delete "${name}"? This will delete it directly from the database and cascade-delete all related child records. This action CANNOT be undone!`;
  const btn = document.getElementById('confirm-ok-btn');
  btn.onclick = () => doHardDelete(moduleKey, pkVal);
  openModal('confirm-modal');
}

async function doHardDelete(moduleKey, pkVal) {
  const mod = MODULES[moduleKey];
  let endpointPath = getRecordEndpoint(moduleKey, pkVal, false) + '?hard=true';
  if (currentView === 'detail' && moduleKey !== currentModule && currentModule) {
    endpointPath += `&view=${currentModule}`;
  }
  try {
    await apiDelete(endpointPath);
    closeModal('confirm-modal');
    showToast('Record and its child records permanently deleted!', 'success');
    delete selectCache[moduleKey];

    // Clear DOM cache pane for this module to force reload on next navigation
    const cachedPane = document.getElementById('pane-' + moduleKey);
    if (cachedPane) cachedPane.dataset.dirty = 'true';
    if (moduleKey === 'request') {
      ['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].forEach(v => {
        const p = document.getElementById('pane-' + v);
        if (p) p.dataset.dirty = 'true';
      });
    } else if (['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(moduleKey)) {
      const p = document.getElementById('pane-request');
      if (p) p.dataset.dirty = 'true';
      ['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].forEach(v => {
        if (v !== moduleKey) {
          const p2 = document.getElementById('pane-' + v);
          if (p2) p2.dataset.dirty = 'true';
        }
      });
    }

    lastCurrencyCache = { key: null, value: 'VND' };
    if (['permissions', 'exception_rules', 'action_rules'].includes(moduleKey)) {
      await applyMenuPermissions();
    }
    if (currentView === 'detail') {
      if (moduleKey === currentModule) {
        closeTabPane('content');
      } else {
        const parentPkField = MODULES[currentModule] ? MODULES[currentModule].pk : 'id';
        const parentPkVal = (window.currentDetailRecord ? window.currentDetailRecord[parentPkField] : null) || (currentRecord ? currentRecord[parentPkField] : null);
        if (parentPkVal) {
          clearChildTableCache(moduleKey, currentModule, parentPkVal);
          loadChildTable(moduleKey, currentModule, parentPkVal);
        }
      }
    } else if (currentView === 'dashboard' && ['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(currentModule)) {
      await loadDashboardView(currentModule);
    } else if (currentView === 'kanban' && currentModule === 'assigned_task') {
      if (typeof renderAssignedTaskKanbanView === 'function') {
        await renderAssignedTaskKanbanView('assigned_task', true);
      }
    } else {
      await refreshTableData(currentModule || moduleKey, true);
    }
  } catch (err) {
    closeModal('confirm-modal');
    showToast(err.message, 'error');
  }
}

window.restoreRecord = async function (moduleKey, pkVal) {
  const mod = MODULES[moduleKey];
  let tableName = moduleKey;
  if (mod.writeTable) tableName = mod.writeTable;
  else if (mod.endpoint.startsWith('/table/')) {
    tableName = mod.endpoint.split('/table/')[1].split('?')[0];
  }

  showCustomConfirm(
    typeof t === 'function' ? t('toast.confirm_restore', 'Restore Record') : 'Restore Record',
    typeof t === 'function' ? t('toast.confirm_restore_msg', 'Are you sure you want to restore this record and all its associated child records?') : 'Are you sure you want to restore this record and all its associated child records?',
    typeof t === 'function' ? t('btn.restore', 'Restore') : 'Restore',
    async () => {
      try {
        showToast('Restoring record...', 'info');
        await apiPost(`/table/${tableName}/${pkVal}/restore`);
        showToast('Successfully restored record.', 'success');

        // Remove caches to force reload
        delete selectCache[moduleKey];
        const cachedPane = document.getElementById('pane-' + moduleKey);
        if (cachedPane) cachedPane.dataset.dirty = 'true';

        if (moduleKey === 'request') {
          ['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].forEach(v => {
            const p = document.getElementById('pane-' + v);
            if (p) p.dataset.dirty = 'true';
          });
        } else if (['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(moduleKey)) {
          const p = document.getElementById('pane-request');
          if (p) p.dataset.dirty = 'true';
          ['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].forEach(v => {
            if (v !== moduleKey) {
              const p2 = document.getElementById('pane-' + v);
              if (p2) p2.dataset.dirty = 'true';
            }
          });
        }

        // Navigate back or refresh detail page
        if (currentView === 'detail' && moduleKey === currentModule) {
          // Re-load the detail view
          await openDetailInternal(moduleKey, pkVal, true);
        } else {
          await renderTableView(moduleKey);
        }
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
  );
};

// ============================================================
// BULK DELETE
// ============================================================
window.toggleSelectAll = function (moduleKey, checked) {
  const checkboxes = document.querySelectorAll('.row-checkbox');
  checkboxes.forEach(cb => {
    if (cb.closest('tr').style.display !== 'none') {
      cb.checked = checked;
      const val = String(cb.value);
      if (checked) selectedIds.add(val);
      else selectedIds.delete(val);
    }
  });
  updateBulkDeleteUI(moduleKey);
};

window.toggleRowSelection = function (moduleKey, pkVal, checked) {
  const val = String(pkVal);
  if (checked) selectedIds.add(val);
  else selectedIds.delete(val);

  // Update header checkbox state
  const selectAll = document.getElementById(`select-all-${moduleKey}`);
  if (selectAll) {
    const visibleCheckboxes = document.querySelectorAll('.row-checkbox');
    const allChecked = Array.from(visibleCheckboxes).every(cb => cb.checked);
    selectAll.checked = allChecked;
  }

  updateBulkDeleteUI(moduleKey);
};

function updateBulkDeleteUI(moduleKey) {
  const btn = document.getElementById(`btn-bulk-delete-${moduleKey}`);
  const countEl = document.getElementById(`selected-count-${moduleKey}`);
  if (btn && countEl) {
    const count = selectedIds.size;
    countEl.textContent = count;
    btn.style.display = count > 0 ? 'block' : 'none';
  }
}

window.showCustomConfirm = function (title, message, confirmText = 'Confirm', onConfirm = null) {
  return new Promise((resolve) => {
    let modal = document.getElementById('custom-confirm-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.className = 'modal-overlay';
      modal.id = 'custom-confirm-modal';
      modal.innerHTML = `
        <div class="modal confirm-dialog" style="max-width:400px;">
          <button class="modal-close" id="custom-confirm-close-icon">✕</button>
          <div class="modal-content" style="text-align:center; padding: 20px;">
            <div class="material-symbols-rounded" style="font-size:43px; color: var(--accent); margin-bottom: 16px;">help</div>
            <div id="custom-confirm-title" class="confirm-title" style="margin-bottom:6px; font-weight:600; font-size:16px;"></div>
            <div id="custom-confirm-message" class="confirm-message" style="margin-bottom:24px; color:var(--text-secondary); font-size:13px; white-space:pre-wrap;"></div>
            <div class="modal-actions" style="justify-content: center;">
              <button class="btn btn-secondary" id="custom-confirm-cancel-btn">${t('form.cancel', 'Cancel')}</button>
              <button class="btn btn-primary" id="custom-confirm-btn" style="background:var(--accent-red);"></button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }

    document.getElementById('custom-confirm-title').textContent = title || 'Confirm';
    document.getElementById('custom-confirm-message').textContent = message;
    document.getElementById('custom-confirm-btn').textContent = confirmText || 'Confirm';

    const cleanUp = () => {
      closeModal('custom-confirm-modal');
    };

    document.getElementById('custom-confirm-btn').onclick = () => {
      cleanUp();
      if (onConfirm) onConfirm();
      resolve(true);
    };

    const handleCancel = () => {
      cleanUp();
      resolve(false);
    };

    document.getElementById('custom-confirm-cancel-btn').onclick = handleCancel;
    document.getElementById('custom-confirm-close-icon').onclick = handleCancel;

    openModal('custom-confirm-modal');
  });
};

window.deleteSelected = async function (moduleKey, ids) {
  const count = ids ? ids.length : selectedIds.size;
  if (count === 0) return;

  showCustomConfirm('Delete Records', `Are you sure you want to delete ${count} selected records? This action cannot be undone.`, 'Delete', async () => {
    const mod = MODULES[moduleKey];
    // Determine table name for bulk delete
    let tableName = moduleKey;
    if (mod.writeTable) tableName = mod.writeTable;
    else if (mod.endpoint.startsWith('/table/')) {
      tableName = mod.endpoint.split('/table/')[1].split('?')[0];
    }

    const bulkEndpoint = `/table/${tableName}/bulk-delete`;

    try {
      showToast(`Deleting ${count} records...`, 'info');
      await apiPost(bulkEndpoint, {
        ids: ids ? ids : Array.from(selectedIds),
        pk: mod.pk
      });
      showToast(`Successfully deleted ${count} records.`, 'success');
      if (!ids) {
        selectedIds.clear();
      } else {
        const selectAll = document.getElementById('bulk-select-all');
        if (selectAll) selectAll.checked = false;
      }
      await renderTableView(moduleKey);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
};


window.confirmDelete = confirmDelete;
window.confirmHardDelete = confirmHardDelete;
window.updateBulkDeleteUI = updateBulkDeleteUI;
