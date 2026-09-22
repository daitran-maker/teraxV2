/**
 * CRC App - Bulk Actions Service
 * Extracted as part of Phase 2 Modularization
 */

window.toggleSelectAllRows = function (moduleKey, selectAllCb) {
  const checkboxes = document.querySelectorAll('#tbody-' + moduleKey + ' .row-bulk-checkbox');
  checkboxes.forEach(cb => {
    cb.checked = selectAllCb.checked;
  });
  handleRowCheckboxChange(moduleKey);
};

window.handleRowCheckboxChange = async function (moduleKey) {
  const checkboxes = document.querySelectorAll('#tbody-' + moduleKey + ' .row-bulk-checkbox:checked');
  const ids = Array.from(checkboxes).map(cb => cb.dataset.pk);

  // 1. Bulk edit button handling (legacy)
  const bulkEditBtn = document.getElementById('bulk-edit-btn');
  if (bulkEditBtn) {
    if (checkboxes.length > 0 && ['permissions', 'exception_rules', 'action_rules'].includes(moduleKey)) {
      bulkEditBtn.style.display = 'inline-flex';
      bulkEditBtn.innerHTML = `<span class="material-symbols-rounded" style="font-size:14px; margin-right:4px;">edit_note</span> Bulk Edit (${checkboxes.length})`;
    } else {
      bulkEditBtn.style.display = 'none';
    }
  }

  // 2. Bulk actions container handling
  let container = document.getElementById(`bulk-actions-container-${moduleKey}`);
  if (!container) {
    const actionsWrapper = document.getElementById(`table-actions-${moduleKey}`);
    if (actionsWrapper) {
      container = document.createElement('div');
      container.id = `bulk-actions-container-${moduleKey}`;
      container.className = 'bulk-actions-container';
      container.style.display = 'none';
      container.style.alignItems = 'center';
      container.style.gap = '8px';
      actionsWrapper.insertBefore(container, actionsWrapper.firstChild);
    }
  }

  if (container) {
    if (ids.length > 0) {
      container.style.display = 'inline-flex';
      container.innerHTML = `
        <span class="material-symbols-rounded" style="font-size:14px; animation:spin 0.8s linear infinite; color: var(--text-muted);">sync</span>
        <span style="font-size: 11px; color: var(--text-muted);">Loading actions...</span>
      `;

      try {
        const resolvedTable = ['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(moduleKey) ? 'request' : moduleKey;
        const promises = ids.map(id => apiGet(`/actions/${resolvedTable}/${id}?view=${moduleKey}`).catch(() => []));
        const results = await Promise.all(promises);

        const actionIdsLists = results.map(list => (Array.isArray(list) ? list.map(a => a.action_id || a.id) : []));
        let commonActionIds = [];
        if (actionIdsLists.length > 0) {
          commonActionIds = actionIdsLists[0].filter(actId => actionIdsLists.every(list => list.includes(actId)));
        }

        const firstList = results[0] || [];
        const commonActions = firstList.filter(a => {
          const actionId = a.action_id || a.id;
          return commonActionIds.includes(actionId);
        });

        let actionsHTML = '';
        if (commonActions.length > 0) {
          actionsHTML = commonActions.map(act => {
            const actionId = act.action_id || act.id;
            const label = (typeof t === 'function') ? t('action.' + actionId, act.label || act.display_name || act.name) : (act.label || act.display_name || act.name);
            const color = act.color || '#3B82F6';
            return `
              <button class="btn btn-sm" style="background: ${color}; color: white; border: none; display: inline-flex; align-items: center; gap: 4px; height: 32px; padding: 0 12px; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; transition: opacity 0.2s;" onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'" onclick="executeBulkAction('${moduleKey}', '${actionId}', ${JSON.stringify(ids).replace(/"/g, '&quot;')})">
                ${act.icon || ''}
                <span>${escapeHTML(label)} (${ids.length})</span>
              </button>
            `;
          }).join('');
        }



        if (window.isActionAllowed(moduleKey, 'delete')) {
          actionsHTML += `
            <button class="btn btn-sm" style="background: #EF4444; color: white; border: none; display: inline-flex; align-items: center; gap: 4px; height: 32px; padding: 0 12px; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; transition: opacity 0.2s;" onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'" onclick="deleteSelected('${moduleKey}', ${JSON.stringify(ids).replace(/"/g, '&quot;')})">
              <span class="material-symbols-rounded" style="font-size:15px; color: white;">delete_sweep</span>
              <span>Delete (${ids.length})</span>
            </button>
          `;
          const isSuperAdmin = authUser && authUser.role && authUser.role.toUpperCase() === 'SUPER ADMIN';
          if (isSuperAdmin) {
            actionsHTML += `
              <button class="btn btn-sm" style="background: #FFF5F5; border: 1px solid #FECACA; color: #EF4444; display: inline-flex; align-items: center; gap: 4px; height: 32px; padding: 0 12px; border-radius: 6px; font-size: 12px; font-weight: 700; cursor: pointer; transition: opacity 0.2s;" onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'" onclick="deleteSelected('${moduleKey}', ${JSON.stringify(ids).replace(/"/g, '&quot;')}, true)">
                <span class="material-symbols-rounded" style="font-size:15px; color: #EF4444;">delete_forever</span>
                <span>Hard Delete (${ids.length})</span>
              </button>
            `;
          }
        }

        if (actionsHTML) {
          container.innerHTML = actionsHTML;
        } else {
          container.innerHTML = `<span style="font-size: 11px; color: var(--text-muted);">Không có hành động chung khả dụng</span>`;
        }
      } catch (err) {
        console.error("Error loading bulk actions:", err);
        container.innerHTML = `<span style="font-size: 11px; color: var(--accent-red);">Lỗi tải hành động</span>`;
      }
    } else {
      container.style.display = 'none';
      container.innerHTML = '';
    }
  }
};

window.executeBulkAction = async function (moduleKey, actionId, ids) {
  const label = (typeof t === 'function') ? t('action.' + actionId, actionId) : actionId;
  showCustomConfirm(
    'Xác nhận hành động',
    `Bạn có chắc chắn muốn thực hiện hành động "${label}" cho ${ids.length} dòng đã chọn?`,
    'Thực hiện',
    async () => {
      showToast(`Đang thực hiện hành động cho ${ids.length} dòng...`, 'info');

      const resolvedTable = ['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(moduleKey) ? 'request' : moduleKey;
      let successCount = 0;
      let failCount = 0;
      let lastError = '';

      for (const id of ids) {
        try {
          await apiPost('/actions/execute', {
            action_id: actionId,
            table_name: resolvedTable,
            record_id: id,
            view: moduleKey
          });
          successCount++;
        } catch (e) {
          failCount++;
          lastError = e.message;
        }
      }

      if (failCount === 0) {
        showToast(`Đã thực hiện thành công "${label}" cho ${successCount} dòng!`, 'success');
      } else {
        showToast(`Đã thực hiện cho ${successCount} dòng thành công, ${failCount} dòng thất bại. Lỗi cuối: ${lastError}`, 'warning');
      }

      applyAllFilters(moduleKey);

      const selectAll = document.getElementById('bulk-select-all');
      if (selectAll) selectAll.checked = false;
      const checkboxes = document.querySelectorAll('#tbody-' + moduleKey + ' .row-bulk-checkbox');
      checkboxes.forEach(cb => cb.checked = false);
      handleRowCheckboxChange(moduleKey);
    }
  );
};


async function buildBulkEditFormHTML(moduleKey) {
  const mod = MODULES[moduleKey];
  const targetFields = mod.fields.filter(f => ['levels', 'positions', 'roles', 'exceptions', 'display', 'display_name'].includes(f.key));

  let html = '<div class="form-grid" style="display: grid; gap: 16px;">';

  for (const field of targetFields) {
    if (field.key === 'display') {
      html += `
        <div class="form-group" style="border: 1px solid var(--border); border-radius: 8px; padding: 12px; background: rgba(255,255,255,0.02);">
          <label style="display: flex; align-items: center; justify-content: space-between; font-weight: 600; margin-bottom: 8px;">
            <span>${field.label}</span>
          </label>
          <select id="bulk-select-${field.key}" name="bulk-${field.key}" class="form-select" style="width: 100%; outline: none;">
            <option value="">-- Keep current (Không thay đổi) --</option>
            <option value="true">Active (Show)</option>
            <option value="false">Inactive (Hide)</option>
          </select>
        </div>
      `;
      continue;
    }

    if (field.key === 'display_name') {
      html += `
        <div class="form-group" style="border: 1px solid var(--border); border-radius: 8px; padding: 12px; background: rgba(255,255,255,0.02);">
          <label style="display: flex; align-items: center; justify-content: space-between; font-weight: 600; margin-bottom: 8px;">
            <span>${field.label}</span>
          </label>
          <input type="text" id="bulk-input-${field.key}" name="bulk-${field.key}" class="form-input" style="width: 100%; outline: none;" placeholder="-- Keep current (Không thay đổi) --" />
        </div>
      `;
      continue;
    }

    html += `
      <div class="form-group" style="border: 1px solid var(--border); border-radius: 8px; padding: 12px; background: rgba(255,255,255,0.02);">
        <label style="display: flex; align-items: center; justify-content: space-between; font-weight: 600; margin-bottom: 8px;">
          <span>${field.label}</span>
          <span style="display:flex;gap:6px;">
            <a href="#" onclick="event.preventDefault(); document.querySelectorAll('input[name=\\'bulk-multi-${field.key}\\']').forEach(cb => cb.checked = true);" style="font-size:10px;color:var(--accent);text-decoration:none;">Chọn tất cả</a>
            <a href="#" onclick="event.preventDefault(); document.querySelectorAll('input[name=\\'bulk-multi-${field.key}\\']').forEach(cb => cb.checked = false);" style="font-size:10px;color:var(--text-muted);text-decoration:none;">Bỏ chọn</a>
          </span>
        </label>
        <div id="bulk-container-${field.key}" style="max-height: 150px; overflow-y: auto; padding: 4px; border: 1px dashed var(--border); border-radius: 6px;">
    `;

    let opts = [];
    if (field.staticOptions) {
      field.optionValue = field.optionValue || 'value';
      field.optionLabel = field.optionLabel || 'label';
      opts.push(...field.staticOptions.map(o => ({
        [field.optionValue]: typeof o === 'object' ? o.value : o,
        [field.optionLabel]: typeof o === 'object' ? (o.label || o.value) : o
      })));
    }
    if (field.optionsFrom) {
      opts = opts.concat(await getSelectOptions(field.optionsFrom));
    } else if (field.options) {
      opts = opts.concat(field.options.map(o => ({ [field.key]: o, label: o })));
      field.optionValue = field.key;
      field.optionLabel = 'label';
    }

    const uniqueOpts = [];
    const seen = new Set();
    opts.forEach(o => {
      let ov = String(o[field.optionValue]).trim().replace(/^\[|\]$/g, '');
      if (ov.toLowerCase() === 'staff') ov = 'Staff';
      const ovLower = ov.toLowerCase();
      if (ov && !seen.has(ovLower) && ovLower !== 'null' && ovLower !== 'undefined') {
        seen.add(ovLower);
        o[field.optionValue] = ov;
        if (field.optionLabel && o[field.optionLabel]) o[field.optionLabel] = ov;
        uniqueOpts.push(o);
      }
    });

    const optStr = uniqueOpts.map(o => {
      const ov = String(o[field.optionValue]);
      const ol = o[field.optionLabel] || ov;
      return `
        <label style="display:flex;align-items:center;gap:6px;font-size:11px;cursor:pointer;margin-bottom:4px;padding:2px 4px;border-radius:4px;" onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background='transparent'">
          <input type="checkbox" name="bulk-multi-${field.key}" value="${ov}" style="width:14px;height:14px;cursor:pointer;accent-color:var(--accent);" />
          <span>${ol}</span>
        </label>
      `;
    }).join('');

    if (uniqueOpts.length === 0) {
      html += '<div style="color:var(--text-muted);font-size:11px;padding:8px;">Không có dữ liệu</div>';
    } else {
      html += optStr;
    }

    html += `
        </div>
      </div>
    `;
  }

  html += '<div style="font-size:10px;color:var(--text-muted);margin-top:4px;padding:4px 8px;background:var(--bg-hover);border-radius:6px;">💡 Chỉ những nhóm có ít nhất 1 giá trị được chọn mới được cập nhật. Các nhóm không chọn sẽ giữ nguyên.</div>';
  html += '</div>';
  return html;
}

window.openBulkEditModal = async function (moduleKey) {
  const checkedCbs = document.querySelectorAll('#tbody-' + moduleKey + ' .row-bulk-checkbox:checked');
  const ids = Array.from(checkedCbs).map(cb => cb.getAttribute('data-pk')).filter(Boolean);

  if (ids.length === 0) {
    showToast('Vui lòng chọn ít nhất một bản ghi để chỉnh sửa hàng loạt.', 'error');
    return;
  }

  document.getElementById('form-modal-title').textContent = `Bulk Edit ${ids.length} Records`;
  const body = await buildBulkEditFormHTML(moduleKey);
  document.getElementById('form-modal-body').innerHTML = body;
  initializeSearchableDropdowns(document.getElementById('form-modal-body'));

  // Restore default buttons
  setFormModalButtons(moduleKey, null);

  submitCallback = () => submitBulkEdit(moduleKey, ids);
  openModal('form-modal');
};

window.submitBulkEdit = async function (moduleKey, ids) {
  const mod = MODULES[moduleKey];
  const saveBtn = document.getElementById('form-modal-save');
  saveBtn.disabled = true;
  saveBtn.textContent = t('form.saving', 'Saving...');

  const fieldsToApply = {};
  const targetFields = ['levels', 'positions', 'roles', 'exceptions', 'display', 'display_name'];

  for (const key of targetFields) {
    if (key === 'display') {
      const selectEl = document.getElementById(`bulk-select-${key}`);
      if (selectEl && selectEl.value !== '') {
        fieldsToApply[key] = selectEl.value === 'true';
      }
      continue;
    }
    if (key === 'display_name') {
      const inputEl = document.getElementById(`bulk-input-${key}`);
      if (inputEl && inputEl.value.trim() !== '') {
        fieldsToApply[key] = inputEl.value.trim();
      }
      continue;
    }
    const checkboxes = document.querySelectorAll(`input[name="bulk-multi-${key}"]:checked`);
    if (checkboxes.length > 0) {
      const selectedVals = Array.from(checkboxes).map(cb => cb.value);
      fieldsToApply[key] = selectedVals;
    }
  }

  if (Object.keys(fieldsToApply).length === 0) {
    showToast('Vui lòng chọn ít nhất một giá trị trong bất kỳ nhóm nào để áp dụng thay đổi.', 'error');
    saveBtn.disabled = false;
    saveBtn.textContent = t('form.save', 'Save');
    return;
  }

  try {
    const updatePromises = ids.map(async (id) => {
      const getEndpoint = getRecordEndpoint(moduleKey, id);

      const record = await apiGet(getEndpoint);
      const payload = { ...record };

      for (const [key, selectedVals] of Object.entries(fieldsToApply)) {
        if (moduleKey === 'permissions') {
          payload[key] = selectedVals;
        } else if (key === 'display') {
          payload[key] = selectedVals;
        } else if (key === 'display_name') {
          payload[key] = selectedVals;
        } else {
          payload[key] = selectedVals.length > 0 ? selectedVals.map(v => `[${v}]`).join(', ') : null;
        }
      }

      delete payload.created_by;
      delete payload.created_date;
      delete payload.updated_by;
      delete payload.updated_date;

      const putEndpoint = getRecordEndpoint(moduleKey, id);

      await apiPut(putEndpoint, payload);
    });

    await Promise.all(updatePromises);

    closeModal('form-modal');
    showToast(`Đã cập nhật hàng loạt ${ids.length} bản ghi thành công!`, 'success');

    delete selectCache[moduleKey];
    await refreshTableData(moduleKey, true);
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = t('form.save', 'Save');
  }
};

