/**
 * CRC App - Detail View Subsystem
 * Extracted as part of Modularization
 * Contains openDetailView, buildDetailViewHTML, detail modals, rating modals, action buttons
 */

// ============================================================
// DETAIL VIEW
// ============================================================
async function openDetailView(moduleKey, pkVal) {
  // Save scroll position
  const viewEl = document.getElementById(`view-${moduleKey}`);
  if (viewEl) {
    const container = viewEl.querySelector('.table-wrapper');
    if (!moduleStates[moduleKey]) moduleStates[moduleKey] = {};
    if (container) {
      moduleStates[moduleKey].scrollTop = container.scrollTop;
    }
  }

  // Navigation trigger -> Update Hash
  window.location.hash = `${moduleKey}/${pkVal}`;
}

async function openDetailInternal(moduleKey, pkVal, force = false, silent = false, skipFetch = false) {
  updateGlobalStatusCards('');
  const mod = MODULES[moduleKey];
  const content = document.getElementById('content');

  // Nhớ tab hiện tại trước khi vẽ lại để tránh mất tab đang mở (tránh giật lag và chuyển về tab mặc định)
  const activeTabBtn = content.querySelector('.detail-tab.active');
  const activeChildKey = activeTabBtn ? activeTabBtn.id.replace('tab-btn-', '') : null;

  const activeLeftTabBtn = content.querySelector('.detail-left-tab-btn.active');
  const activeLeftTabId = activeLeftTabBtn ? activeLeftTabBtn.getAttribute('data-tab-id') : null;

  // If we are already looking at this record, don't re-render everything unless forced
  if (!force && currentModule === moduleKey && currentView === 'detail' && currentRecord && String(currentRecord[mod.pk]) === String(pkVal)) {
    return;
  }

  currentModule = moduleKey;
  currentView = 'detail';

  // Update topbar so it doesn't show previous module's title
  const meta = getModuleMeta(moduleKey);
  const topbarTitle = document.getElementById('topbar-title');
  if (topbarTitle) topbarTitle.innerHTML = meta.title || mod.label || moduleKey;
  const topbarSubtitle = document.getElementById('topbar-subtitle');
  if (topbarSubtitle) topbarSubtitle.textContent = meta.subtitle || '';

  // 1. Optimistic / Instant Render: check in-memory record cache for 0ms transition
  let record = (currentRecord && String(currentRecord[mod.pk]) === String(pkVal)) ? currentRecord : null;
  if (!record && typeof currentData !== 'undefined' && Array.isArray(currentData)) {
    record = currentData.find(r => String(r[mod.pk]) === String(pkVal));
  }
  if (!record && selectCache[moduleKey] && Array.isArray(selectCache[moduleKey])) {
    record = selectCache[moduleKey].find(r => String(r[mod.pk]) === String(pkVal));
  }

  if (!skipFetch && moduleKey === 'policy' && pkVal === 'VIRTUAL_OPPORTUNITY') {
    record = {
      policy_id: 'VIRTUAL_OPPORTUNITY',
      policy_name: 'Opportunity',
      description: 'Group of all Opportunity policies',
      policy_type: 'OPPORTUNITY',
      _is_virtual: true
    };
    currentRecord = record;
    skipFetch = true;
  }

  // Rendering function that constructs and mounts the detail DOM
  const renderDetailDOM = (rec) => {
    try {
      currentRecord = rec;
      window.currentDetailRecord = rec;

      const scrollEl = document.querySelector('.detail-scroll');
      const scrollTop = scrollEl ? scrollEl.scrollTop : 0;
      content.innerHTML = buildDetailViewHTML(moduleKey, rec);
      if (moduleKey === 'cms_tenant_info') {
        loadTenantStatusStats();
      }
      if (moduleKey === 'target_table') {
        window.loadTargetTableActualRecords(rec);
      }
      if (document.querySelector('.detail-scroll') && scrollTop) {
        document.querySelector('.detail-scroll').scrollTop = scrollTop;
      }

      // Restore tab buttons active state and pane visibility
      if (activeChildKey) {
        const tabs = content.querySelectorAll('.detail-tab');
        tabs.forEach(t => t.classList.remove('active'));
        const activeTab = content.querySelector(`#tab-btn-${activeChildKey}`);
        if (activeTab) activeTab.classList.add('active');

        const panes = content.querySelectorAll('.tab-pane');
        panes.forEach(p => p.style.display = 'none');
        const activePane = content.querySelector(`#tab-pane-${activeChildKey}`);
        if (activePane) activePane.style.display = 'flex';
      }

      if (activeLeftTabId) {
        const leftTabs = content.querySelectorAll('.detail-left-tab-btn');
        leftTabs.forEach(t => t.classList.remove('active'));
        const activeLeftTab = content.querySelector(`.detail-left-tab-btn[data-tab-id="${activeLeftTabId}"]`);
        if (activeLeftTab) activeLeftTab.classList.add('active');

        const leftPanes = content.querySelectorAll('.detail-left-tab-pane');
        leftPanes.forEach(p => p.classList.remove('active'));
        const activeLeftPane = content.querySelector(`#${activeLeftTabId}`);
        if (activeLeftPane) activeLeftPane.classList.add('active');
      }

      // Update Tab Title with actual record display name
      let initialResolvedRecord = { ...rec };
      if (mod.columns) mod.columns.forEach(c => initialResolvedRecord[c.key] = resolveLookupValue(moduleKey, c.key, rec[c.key]));
      if (mod.fields) mod.fields.forEach(c => { if (c.key) initialResolvedRecord[c.key] = resolveLookupValue(moduleKey, c.key, rec[c.key]); });
      const initialDisplayTitle = mod.displayName ? mod.displayName(initialResolvedRecord) : pkVal;
      updatePaneMeta(initialDisplayTitle);

      // Fetch and render Dynamic Actions asynchronously
      window.__currentActionsHTML = '';
      if (pkVal === 'VIRTUAL_OPPORTUNITY') {
        const actionsContainer = content.querySelector('#detail-actions-container');
        if (actionsContainer) {
          window.__currentActionsHTML = '';
          actionsContainer.innerHTML = '';
        }
      } else {
        let viewParam = moduleKey;
        const hashPartsForView = window.location.hash.replace('#', '').split('/');
        const prefixForView = hashPartsForView[0];
        if (['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(prefixForView)) {
          viewParam = prefixForView;
        }
        const resolvedTableForActions = (mod && mod.writeTable) ? mod.writeTable : (['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(viewParam) ? 'request' : moduleKey);
        if (moduleKey === 'finance' || mod.noActions) {
          const actionsContainer = content.querySelector('#detail-actions-container');
          if (actionsContainer) actionsContainer.innerHTML = '';
        } else {
          apiGet(`/actions/${resolvedTableForActions}/${pkVal}?view=${viewParam}`).then(actions => {
            const actionsContainer = content.querySelector('#detail-actions-container');
            if (actionsContainer) {
              let actHTML = '';
              const validActions = Array.isArray(actions) ? actions.filter(act => {
                const actionIdKey = act.action_id || act.id;
                return !shouldHideRequestDynamicAction(viewParam, actionIdKey);
              }) : [];

              if (validActions.length === 0) {
                actHTML = '';
              } else {
                actHTML = validActions.map(act => {
                  let btnClass = 'btn btn-custom-action';
                  const actionColor = (act.color || '').toLowerCase();
                  if (actionColor.includes('red')) {
                    btnClass += ' btn-custom-action-danger';
                  } else if (actionColor.includes('green')) {
                    btnClass += ' btn-custom-action-success';
                  }
                  const actionIdKey = act.action_id || act.id;
                  if (actionIdKey && actionIdKey.startsWith('withdraw')) {
                    btnClass += ' btn-custom-action-withdraw';
                  }
                  const translatedLabel = (typeof t === 'function') ? t('action.' + actionIdKey, act.label || act.display_name || act.name) : (act.label || act.display_name || act.name);
                  return `
                  <button class="${btnClass}" onclick="executeAction('${actionIdKey}', '${moduleKey}', '${pkVal}')">
                    ${act.icon && act.icon.startsWith('<svg') ? act.icon : `<span class="material-symbols-rounded">${act.icon || 'play_circle'}</span>`}
                    <span>${translatedLabel}</span>
                  </button>
                `;
                }).join('');
              }
              window.__currentActionsHTML = actHTML;
              actionsContainer.innerHTML = actHTML;
            }
          }).catch(err => {
            const actionsContainer = content.querySelector('#detail-actions-container');
            if (actionsContainer) {
              actionsContainer.innerHTML = `<div style="color:var(--accent-red); font-size:11px;">Failed to load actions.</div>`;
            }
          });
        }
      }

      if (!silent) {
        const el = document.getElementById(`detail-view-${moduleKey}`);
        if (el) {
          requestAnimationFrame(() => {
            el.style.transform = 'translateX(0)';
          });
        }
      }

      // Asynchronously load child records into designated container divs
      const modHasRealChildren = hasModuleRealChildren(moduleKey, pkVal, mod);
      const modHasSidebar = mod && mod.children && (mod.children.includes('comment') || mod.children.includes('ticket_comment'));
      let baseChildren = [];
      if (modHasRealChildren || modHasSidebar) {
        baseChildren = (moduleKey === 'policy' && pkVal === 'VIRTUAL_OPPORTUNITY') ? ['opportunity_list', 'request'] : (mod.children || []);
        if (!baseChildren.includes('logs')) {
          baseChildren = [...baseChildren, 'logs'];
        }
      }
      const childModules = getAllowedDetailChildModules(
        moduleKey,
        rec,
        baseChildren
      );
      if (childModules.length > 0) {
        const activeChild = activeChildKey || childModules[0];
        // Load active child table immediately so user can see it right away
        loadChildTable(activeChild, moduleKey, pkVal);
        // Stagger remaining child tables in background so network connection pool is not overloaded
        let staggerDelay = 250;
        childModules.forEach(ck => {
          if (ck !== activeChild && ck !== 'finance') {
            const c = content.querySelector(`#child-table-container-${ck}`);
            if (c) {
              setTimeout(() => {
                if (c.isConnected && c.dataset.loaded !== 'true') {
                  loadChildTable(ck, moduleKey, pkVal);
                }
              }, staggerDelay);
              staggerDelay += 200;
            }
          }
        });
      }

      // Auto-load inline Finance and Feedback summary for request modules
      const isRequestModule = ['request', 'my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(moduleKey);
      const inlineSummary = content.querySelector('#inline-finance-summary');
      if (isRequestModule && inlineSummary) {
        loadFinanceSummary(moduleKey, pkVal, inlineSummary);
      }
      const inlineFeedback = content.querySelector('#inline-feedback-summary');
      if (isRequestModule && inlineFeedback) {
        loadFeedbackSummary(moduleKey, pkVal, inlineFeedback);
      }
    } catch (err) {
      if (!silent) {
        if (isAccessDeniedError(err)) {
          redirectToAccessDenied();
          return;
        }
        showToast(err.message, 'error');
        setTimeout(() => {
          goBack(moduleKey);
        }, 1500);
      } else {
        console.warn("Failed rendering detail view:", err);
      }
    }
  };

  // If in-memory record exists, render immediately (0ms perception!)
  if (record) {
    renderDetailDOM(record);
  } else if (!silent && !skipFetch) {
    // Only show spinner when record is not cached at all (e.g. cold reload)
    content.innerHTML = `<div class="loading"><div class="spinner"></div> ${t('detail.loading', 'Loading details...')}</div>`;
  }

  // Background fetch fresh record & prefetch lookups without blocking UI
  if (!skipFetch) {
    const endpointPath = getRecordEndpoint(moduleKey, pkVal);
    apiGet(endpointPath).then(async freshRecord => {
      if (!freshRecord || (freshRecord.error && freshRecord.status === 404)) {
        if (!record) throw new Error('Record not found');
        return;
      }

      currentRecord = freshRecord;
      window.currentDetailRecord = freshRecord;

      if (!selectCache[moduleKey]) selectCache[moduleKey] = [];
      const cachedRecordIndex = selectCache[moduleKey].findIndex(r => String(r[mod.pk]) === String(pkVal));
      if (cachedRecordIndex > -1) {
        selectCache[moduleKey][cachedRecordIndex] = freshRecord;
      } else {
        selectCache[moduleKey].push(freshRecord);
      }

      if (typeof currentData !== 'undefined' && currentData.length > 0) {
        const cIdx = currentData.findIndex(r => String(r[mod.pk]) === String(pkVal));
        if (cIdx > -1) currentData[cIdx] = freshRecord;
      }

      if (typeof dashboardData !== 'undefined' && dashboardData.length > 0) {
        const dIdx = dashboardData.findIndex(r => String(r[mod.pk]) === String(pkVal));
        if (dIdx > -1) dashboardData[dIdx] = freshRecord;
      }

      // Essential lookups to ensure all referenced entities (employees, process, status, etc.) have labels
      const essentialLookupPromises = [];
      if (!selectCache['employee'] || !selectCache['employee'].isFullList) {
        essentialLookupPromises.push(getSelectOptions('employee').catch(() => []));
      }
      if (!selectCache['policy'] || !selectCache['policy'].isFullList) {
        essentialLookupPromises.push(getSelectOptions('policy').catch(() => []));
      }
      if (!selectCache['status_catalog']) {
        essentialLookupPromises.push(getSelectOptions('status_catalog').catch(() => []));
      }
      essentialLookupPromises.push(prefetchLookups(moduleKey, [freshRecord]).catch(() => []));

      // If initial render didn't have cached data (cold load e.g. F5), await lookups first so labels show correctly!
      if (!record) {
        await Promise.all(essentialLookupPromises);
        renderDetailDOM(freshRecord);
      } else {
        Promise.all(essentialLookupPromises).then(() => {
          if (content && content.isConnected && currentRecord === freshRecord) {
            renderDetailDOM(freshRecord);
          }
        }).catch(() => {});
      }
    }).catch(err => {
      if (!silent && !record) {
        if (isAccessDeniedError(err)) {
          redirectToAccessDenied();
          return;
        }
        showToast(err.message, 'error');
        setTimeout(() => {
          goBack(moduleKey);
        }, 1500);
      } else {
        console.warn("Failed background refresh of detail view:", err);
      }
    });
  } else {
    // skipFetch mode: still prefetch lookups in background
    if (!selectCache['employee'] || !selectCache['employee'].isFullList) {
      getSelectOptions('employee').catch(() => {});
    }
    prefetchLookups(moduleKey, [record]).catch(() => {});
  }
}

function showCustomPrompt(title, label, defaultValue = '', placeholder = '', fieldConfig = null) {
  return new Promise(async (resolve) => {
    const modal = document.getElementById('action-prompt-modal');
    document.getElementById('action-prompt-title').textContent = title;
    document.getElementById('action-prompt-label').textContent = label;

    const container = document.getElementById('action-prompt-input-container');
    container.innerHTML = ''; // Clear container

    let clickOutsideHandler = null;
    let inputEl;
    if (fieldConfig && fieldConfig.type === 'multiselect') {
      let options = fieldConfig.options || [];
      const valKey = fieldConfig.optionValue || 'id';
      const labelKey = fieldConfig.optionLabel || 'name';

      let currentSelection = [];
      if (defaultValue) {
        currentSelection = defaultValue.split(',').map(s => s.trim().replace(/^\[|\]$/g, '')).filter(Boolean);
      }

      let html = `
        <div class="searchable-multiselect-container" style="position: relative; width: 100%;">
          <div class="multiselect-trigger" style="display: flex; flex-wrap: wrap; gap: 6px; align-items: center; min-height: 44px; padding: 6px 12px; cursor: pointer; background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; box-sizing: border-box;">
            <div class="selected-pills" style="display: flex; flex-wrap: wrap; gap: 6px;"></div>
            <input type="text" class="multiselect-search-input" placeholder="Search and select..." style="border: none; outline: none; background: transparent; flex: 1; min-width: 120px; font-size: 13px; padding: 0; margin: 0; height: 28px; color: #111827; font-family: inherit;" autocomplete="off" />
            <span class="material-symbols-rounded" style="color: #6B7280; margin-left: auto; font-size: 20px; pointer-events: none;">arrow_drop_down</span>
          </div>
          <div class="multiselect-dropdown-list" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: #ffffff; border: 1px solid #c1c5cb; border-radius: 8px; margin-top: 4px; max-height: 200px; overflow-y: auto; z-index: 9999; box-shadow: 0 10px 25px -3px rgba(0, 0, 0, 0.15); box-sizing: border-box; text-align: left;">
          </div>
        </div>
      `;
      container.innerHTML = html;

      const trigger = container.querySelector('.multiselect-trigger');
      const searchInput = container.querySelector('.multiselect-search-input');
      const dropdownList = container.querySelector('.multiselect-dropdown-list');
      const pillsContainer = container.querySelector('.selected-pills');

      // Setup options with proper values and labels
      const resolvedOptions = options.map(o => {
        const val = typeof o === 'object' ? (o[valKey] !== undefined ? o[valKey] : o.value || o.email) : o;
        let lbl = typeof o === 'object' ? (o[labelKey] !== undefined ? o[labelKey] : o.label || o.full_name) : o;
        if ((fieldConfig.optionsFrom === 'employee' || fieldConfig.key === 'sr_owner') && typeof o === 'object' && o.email && o.full_name) {
          lbl = formatEmployeeLabel(o);
        } else if (typeof t_val === 'function' && (fieldConfig.key === 'elements' || fieldConfig.options)) {
          lbl = t_val(lbl);
        }
        return { value: String(val), label: String(lbl) };
      });

      // Keep track of selected values in a Set
      const selectedValues = new Set();
      if (defaultValue) {
        currentSelection.forEach(val => {
          const matchedOpt = resolvedOptions.find(o => o.value.toLowerCase() === val.toLowerCase());
          if (matchedOpt) {
            selectedValues.add(matchedOpt.value);
          } else {
            selectedValues.add(val);
          }
        });
      }

      // Function to render pills
      const renderPills = () => {
        pillsContainer.innerHTML = '';
        selectedValues.forEach(val => {
          const opt = resolvedOptions.find(o => o.value === val);
          const label = opt ? opt.label : val;
          const pill = document.createElement('span');
          pill.className = 'multiselect-pill';
          pill.innerHTML = `
            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHTML(label)}</span>
            <span class="remove-pill-btn">✕</span>
          `;
          pill.querySelector('.remove-pill-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            selectedValues.delete(val);
            renderPills();
            renderDropdownItems(searchInput.value.trim());
          });
          pillsContainer.appendChild(pill);
        });

        if (selectedValues.size > 0) {
          searchInput.placeholder = '';
        } else {
          searchInput.placeholder = 'Search and select...';
        }
      };

      // Function to render dropdown list items
      const renderDropdownItems = (query = '') => {
        dropdownList.innerHTML = '';
        const filtered = resolvedOptions.filter(opt => {
          return opt.label.toLowerCase().includes(query.toLowerCase()) ||
            opt.value.toLowerCase().includes(query.toLowerCase());
        });

        if (filtered.length === 0) {
          dropdownList.innerHTML = `<div class="searchable-dropdown-no-results">No results found</div>`;
          return;
        }

        const isElementsField = fieldConfig && fieldConfig.key === 'elements';
        const selectedArr = Array.from(selectedValues);
        const hasContract = isElementsField && selectedArr.some(v => String(v).toUpperCase() === 'CONTRACT');
        const hasPaymentOrInvoice = isElementsField && selectedArr.some(v => {
          const u = String(v).toUpperCase();
          return u === 'PAYMENT' || u === 'INVOICE';
        });

        filtered.forEach(opt => {
          const isChecked = selectedValues.has(opt.value);
          const optUpper = String(opt.value).toUpperCase();

          let isDisabled = false;
          if (isElementsField) {
            if (hasContract && (optUpper === 'PAYMENT' || optUpper === 'INVOICE')) {
              isDisabled = !isChecked;
            } else if (hasPaymentOrInvoice && optUpper === 'CONTRACT') {
              isDisabled = !isChecked;
            }
          }

          const item = document.createElement('div');
          item.className = 'searchable-dropdown-item';

          if (isDisabled) {
            item.style.cssText = `
              display: flex;
              align-items: center;
              gap: 8px;
              padding: 8px 12px;
              font-size: 13px;
              color: #9ca3af;
              background: #f3f4f6;
              cursor: not-allowed;
              text-align: left;
              opacity: 0.6;
            `;
          } else {
            item.style.cssText = `
              display: flex;
              align-items: center;
              gap: 8px;
              padding: 8px 12px;
              font-size: 13px;
              color: #1f2937;
              cursor: pointer;
              transition: background 0.15s ease;
              text-align: left;
            `;
          }

          item.innerHTML = `
            <input type="checkbox" style="cursor: pointer; pointer-events: none;" ${isChecked ? 'checked' : ''} ${isDisabled ? 'disabled' : ''} />
            <span style="pointer-events: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHTML(opt.label)}</span>
          `;

          if (!isDisabled) {
            item.addEventListener('click', (e) => {
              e.stopPropagation();
              if (selectedValues.has(opt.value)) {
                selectedValues.delete(opt.value);
              } else {
                selectedValues.add(opt.value);
              }
              renderPills();
              renderDropdownItems(searchInput.value.trim());
            });
          } else {
            item.addEventListener('click', (e) => {
              e.stopPropagation();
            });
          }

          dropdownList.appendChild(item);
        });
      };

      // Event listeners
      trigger.addEventListener('click', (e) => {
        if (e.target !== searchInput) {
          searchInput.focus();
        }
      });

      searchInput.addEventListener('focus', () => {
        dropdownList.style.display = 'block';
        renderDropdownItems(searchInput.value.trim());
      });

      searchInput.addEventListener('input', () => {
        dropdownList.style.display = 'block';
        renderDropdownItems(searchInput.value.trim());
      });

      clickOutsideHandler = (e) => {
        if (!container.contains(e.target)) {
          dropdownList.style.display = 'none';
          searchInput.value = '';
        }
      };
      document.addEventListener('click', clickOutsideHandler);

      renderPills();
      renderDropdownItems();

      inputEl = {
        get value() {
          return Array.from(selectedValues).map(val => String(val).replace(/^\[|\]$/g, '').trim()).join(', ');
        },
        focus() {
          searchInput.focus();
        }
      };
    } else if (fieldConfig && (fieldConfig.optionsFrom || fieldConfig.options || fieldConfig.staticOptions)) {
      // Create a select dropdown
      let options = [];
      if (fieldConfig.optionsFrom) {
        options = await getSelectOptions(fieldConfig.optionsFrom);
      } else if (fieldConfig.staticOptions) {
        options = fieldConfig.staticOptions;
      } else if (fieldConfig.options) {
        options = fieldConfig.options;
      }

      const valKey = fieldConfig.optionValue || 'id';
      const labelKey = fieldConfig.optionLabel || 'name';

      let html = `<select id="action-prompt-input" class="form-select" style="width: 100%;">`;
      html += `<option value="">— Select Option —</option>`;
      options.forEach(o => {
        const val = typeof o === 'object' ? (o[valKey] !== undefined ? o[valKey] : o.value) : o;
        let lbl = typeof o === 'object' ? (o[labelKey] !== undefined ? o[labelKey] : o.label) : o;
        if (fieldConfig.optionsFrom === 'employee' && typeof o === 'object' && o.email && o.full_name) {
          lbl = formatEmployeeLabel(o);
        }
        const isSelected = String(val) === String(defaultValue) ? 'selected' : '';
        html += `<option value="${val}" ${isSelected}>${lbl}</option>`;
      });
      html += `</select>`;
      container.innerHTML = html;
      initializeSearchableDropdowns(container);
      inputEl = document.getElementById('action-prompt-input');
    } else {
      // Create normal text input
      const input = document.createElement('input');
      input.type = 'text';
      input.id = 'action-prompt-input';
      input.className = 'form-input';
      input.style.width = '100%';
      input.value = defaultValue;
      input.placeholder = placeholder;
      container.appendChild(input);
      inputEl = input;
    }

    const okBtn = document.getElementById('action-prompt-ok-btn');
    const cancelBtn = document.getElementById('action-prompt-cancel-btn');

    const cleanUp = () => {
      closeModal('action-prompt-modal');
      okBtn.onclick = null;
      cancelBtn.onclick = null;
      if (clickOutsideHandler) {
        document.removeEventListener('click', clickOutsideHandler);
      }
    };

    okBtn.onclick = () => {
      const val = inputEl.value.trim();
      cleanUp();
      resolve(val);
    };

    cancelBtn.onclick = () => {
      cleanUp();
      resolve(null);
    };

    openModal('action-prompt-modal');
    inputEl.focus();
  });
}

function showRatingModal(title) {
  return new Promise((resolve) => {
    const modal = document.getElementById('action-prompt-modal');
    document.getElementById('action-prompt-title').textContent = title;
    document.getElementById('action-prompt-label').textContent = '';

    const container = document.getElementById('action-prompt-input-container');
    container.innerHTML = '';

    const ratingWrapper = document.createElement('div');
    ratingWrapper.style.display = 'flex';
    ratingWrapper.style.flexDirection = 'column';
    ratingWrapper.style.gap = '16px';
    ratingWrapper.style.padding = '8px 0';

    const starContainer = document.createElement('div');
    starContainer.style.display = 'flex';
    starContainer.style.gap = '12px';
    starContainer.style.justifyContent = 'center';

    let selectedPoint = 0;
    const labels = [
      'Very poor',
      'Poor',
      'Acceptable',
      'Good',
      'Excellent'
    ];

    const labelEl = document.createElement('div');
    labelEl.style.textAlign = 'center';
    labelEl.style.fontWeight = '600';
    labelEl.style.fontSize = '14px';
    labelEl.style.minHeight = '20px';
    labelEl.style.color = 'var(--text-secondary)';
    labelEl.textContent = 'Select a rating';

    for (let i = 1; i <= 5; i++) {
      const star = document.createElement('span');
      star.className = 'material-symbols-rounded';
      star.style.fontSize = '36px';
      star.style.cursor = 'pointer';
      star.style.color = 'var(--text-muted)';
      star.style.transition = 'color 0.2s, transform 0.2s';
      star.textContent = 'star_border';

      star.onmouseover = () => {
        highlightStars(i);
        labelEl.textContent = labels[i - 1];
      };

      star.onmouseout = () => {
        highlightStars(selectedPoint);
        labelEl.textContent = selectedPoint > 0 ? labels[selectedPoint - 1] : 'Select a rating';
      };

      star.onclick = () => {
        selectedPoint = i;
        highlightStars(i);
        labelEl.textContent = labels[i - 1];

        const reqHint = document.getElementById('comment-req-hint');
        if (selectedPoint < 3) {
          if (reqHint) reqHint.style.display = 'inline';
          commentInput.setAttribute('required', 'true');
        } else {
          if (reqHint) reqHint.style.display = 'none';
          commentInput.removeAttribute('required');
        }
      };

      starContainer.appendChild(star);
    }

    function highlightStars(count) {
      Array.from(starContainer.children).forEach((star, index) => {
        if (index < count) {
          star.textContent = 'star';
          star.style.color = '#eab308';
          star.style.transform = 'scale(1.1)';
        } else {
          star.textContent = 'star_border';
          star.style.color = 'var(--text-muted)';
          star.style.transform = 'scale(1.0)';
        }
      });
    }

    const commentWrapper = document.createElement('div');
    commentWrapper.style.display = 'flex';
    commentWrapper.style.flexDirection = 'column';
    commentWrapper.style.gap = '6px';

    const commentLabel = document.createElement('label');
    commentLabel.style.fontSize = '12px';
    commentLabel.style.fontWeight = '500';
    commentLabel.style.color = 'var(--text)';
    commentLabel.innerHTML = `Comments <span id="comment-req-hint" style="color:var(--text-muted); font-style:italic; font-weight:400; font-size:10px; display:none;"> — please share what went wrong</span>`;

    const commentInput = document.createElement('textarea');
    commentInput.className = 'form-input';
    commentInput.placeholder = 'Describe your experience...';
    commentInput.style.width = '100%';
    commentInput.style.height = '80px';
    commentInput.style.padding = '8px 12px';
    commentInput.style.resize = 'none';
    commentInput.style.fontSize = '13px';

    commentWrapper.appendChild(commentLabel);
    commentWrapper.appendChild(commentInput);

    ratingWrapper.appendChild(starContainer);
    ratingWrapper.appendChild(labelEl);
    ratingWrapper.appendChild(commentWrapper);
    container.appendChild(ratingWrapper);

    const okBtn = document.getElementById('action-prompt-ok-btn');
    const cancelBtn = document.getElementById('action-prompt-cancel-btn');

    const cleanUp = () => {
      closeModal('action-prompt-modal');
      okBtn.onclick = null;
      cancelBtn.onclick = null;
    };

    okBtn.onclick = () => {
      if (selectedPoint === 0) {
        showToast('Please select a star rating', 'error');
        return;
      }
      if (selectedPoint < 3 && !commentInput.value.trim()) {
        showToast('Comment is required for rating below 3 stars', 'error');
        commentInput.style.borderColor = 'var(--accent-red)';
        commentInput.focus();
        return;
      }
      const val = {
        point: selectedPoint,
        comment: commentInput.value.trim()
      };
      cleanUp();
      resolve(val);
    };

    cancelBtn.onclick = () => {
      cleanUp();
      resolve(null);
    };

    openModal('action-prompt-modal');
  });
}

function showMultiRatingModal(title, participants, existingRatings = []) {
  return new Promise((resolve) => {
    const existing = document.getElementById('multi-rating-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'multi-rating-modal';
    modal.className = 'modal-overlay open';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:9999;';

    modal.innerHTML = `
      <div class="modal" style="max-width:850px; width:95%; min-height:500px; max-height:85vh; display:flex; flex-direction:column; background:var(--bg-secondary); border:1px solid var(--border); border-radius:12px; box-shadow:var(--shadow); font-family:'Inter', sans-serif;">
        <div class="modal-header" style="border-bottom:1px solid var(--border); padding:20px 24px; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <h3 style="margin:0;font-size:18px;font-weight:700;color:var(--text-primary);display:flex;align-items:center;gap:8px;">
              <span class="material-symbols-rounded" style="color:#eab308;">rate_review</span>
              <span id="mrm-title">${escapeHTML(title)}</span>
            </h3>
            <p style="margin:4px 0 0;font-size:12px;color:var(--text-muted);">${t('rating.description', 'Chọn và đánh giá các nhân viên tham gia yêu cầu này.')}</p>
          </div>
          <button id="mrm-close-x" class="modal-close" style="color:var(--text-muted); background:none; border:none; cursor:pointer; font-size:20px; width:32px; height:32px; display:flex; align-items:center; justify-content:center; border-radius:6px;">✕</button>
        </div>

        <div class="modal-body" style="display:flex; flex-direction:column; gap:16px; padding:20px 24px; overflow-y:auto; flex:1;">
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--text-primary);margin-bottom:6px;">${t('rating.choose_participant', 'CHỌN NGƯỜI ĐƯỢC ĐÁNH GIÁ')} <span style="color:#EF4444;">*</span></label>
            <div class="searchable-multiselect-container" style="position: relative; width: 100%;">
              <div class="multiselect-trigger" style="display: flex; flex-wrap: wrap; gap: 6px; align-items: center; min-height: 44px; padding: 6px 12px; cursor: pointer; background: var(--bg-primary); border: 1px solid var(--border); border-radius: 8px; box-sizing: border-box;">
                <div class="selected-pills" style="display: flex; flex-wrap: wrap; gap: 6px;"></div>
                <input type="text" class="multiselect-search-input" placeholder="${t('rating.search_placeholder', 'Tìm kiếm và chọn người tham gia...')}" style="border: none; outline: none; background: transparent; flex: 1; min-width: 120px; font-size: 13px; padding: 0; margin: 0; height: 28px; color: var(--text-primary); font-family: inherit;" autocomplete="off" />
                <span class="material-symbols-rounded" style="color: var(--text-muted); margin-left: auto; font-size: 20px; pointer-events: none;">arrow_drop_down</span>
              </div>
              <div class="multiselect-dropdown-list" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 8px; margin-top: 4px; max-height: 180px; overflow-y: auto; z-index: 10000; box-shadow: var(--shadow); box-sizing: border-box; text-align: left;">
              </div>
            </div>
          </div>

          <!-- Dynamic Rating Cards Container -->
          <div id="mrm-cards-container" style="display:flex; flex-direction:column; gap:16px;"></div>
        </div>

        <div class="modal-footer" style="padding:14px 24px; border-top:1px solid var(--border); display:flex; gap:12px; justify-content:flex-end;">
          <button id="mrm-cancel" class="btn btn-secondary" style="font-weight:600;">${t('btn.cancel', 'Cancel')}</button>
          <button id="mrm-confirm" class="btn btn-primary" style="font-weight:600; background:#eab308; border-color:#eab308; color:#fff;">${t('rating.submit', 'Submit Rating')}</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const trigger = modal.querySelector('.multiselect-trigger');
    const searchInput = modal.querySelector('.multiselect-search-input');
    const dropdownList = modal.querySelector('.multiselect-dropdown-list');
    const pillsContainer = modal.querySelector('.selected-pills');
    const cardsContainer = modal.querySelector('#mrm-cards-container');

    const selectedEmployees = new Set();
    const employeeDataMap = new Map();

    const resolvedOptions = participants.map(emp => {
      const displayTag = emp.username || emp.email || emp.employee_id;
      const roleStr = emp.role_label || (emp.roles && emp.roles.length ? emp.roles.join(', ') : '');
      const roleBadge = roleStr ? ` - [${roleStr}]` : '';
      return {
        value: String(emp.employee_id),
        label: `${emp.full_name} (${displayTag})${roleBadge}`,
        role_label: roleStr
      };
    });

    const renderPills = () => {
      pillsContainer.innerHTML = '';

      const currentCardIds = Array.from(cardsContainer.querySelectorAll('.rating-card')).map(c => c.getAttribute('data-employee-id'));
      currentCardIds.forEach(id => {
        if (!selectedEmployees.has(id)) {
          const card = cardsContainer.querySelector(`.rating-card[data-employee-id="${id}"]`);
          if (card) card.remove();
          employeeDataMap.delete(id);
        }
      });

      selectedEmployees.forEach(val => {
        const opt = resolvedOptions.find(o => o.value === val);
        const label = opt ? opt.label : val;

        const pill = document.createElement('span');
        pill.className = 'multiselect-pill';
        pill.style.cssText = 'display:inline-flex;align-items:center;gap:4px;background:#EFF6FF;color:#1D4ED8;border:1px solid #BFDBFE;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:500;max-width:240px;white-space:nowrap;overflow:hidden;';
        pill.innerHTML = `
          <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1;">${escapeHTML(label)}</span>
          <span class="remove-pill-btn" style="cursor:pointer;font-weight:700;margin-left:4px;opacity:0.6;flex-shrink:0;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.6">✕</span>
        `;
        pill.querySelector('.remove-pill-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          selectedEmployees.delete(val);
          renderPills();
          renderDropdownItems(searchInput.value.trim());
        });
        pillsContainer.appendChild(pill);

        if (!cardsContainer.querySelector(`.rating-card[data-employee-id="${val}"]`)) {
          createRatingCard(val, label);
        }
      });
    };

    function createRatingCard(empId, label) {
      const existingRating = existingRatings.find(r => r.to_user === empId) || {};
      const initialPoint = existingRating.point || 0;
      const initialComment = existingRating.comment || '';
      const opt = resolvedOptions.find(o => o.value === empId);
      const roleBadgeHTML = opt && opt.role_label ? `<span style="font-size:11px; font-weight:600; padding:2px 8px; border-radius:4px; background:#EFF6FF; color:#2563EB; border:1px solid #BFDBFE;">${escapeHTML(opt.role_label)}</span>` : '';

      const card = document.createElement('div');
      card.className = 'rating-card';
      card.setAttribute('data-employee-id', empId);
      card.style.cssText = 'border:1px solid var(--border); border-radius:8px; padding:16px; display:flex; flex-direction:column; gap:12px; background:var(--bg-primary);';

      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <strong style="font-size:14px; color:var(--text-primary);">${escapeHTML(label)}</strong>
            ${roleBadgeHTML}
          </div>
          <span class="remove-card-btn" style="cursor:pointer; font-size:14px; color:var(--text-muted);" onmouseover="this.style.color='var(--accent-red)'" onmouseout="this.style.color='var(--text-muted)'">${t('rating.remove', '✕ Remove')}</span>
        </div>
        <div style="display:flex; align-items:center; gap:12px;">
          <div class="star-rating-row" style="display:flex; gap:6px;"></div>
          <span class="rating-label" style="font-size:12px; font-weight:600; color:var(--text-secondary);">${t('rating.not_rated', 'Chưa đánh giá')}</span>
        </div>
        <div>
          <textarea class="rating-comment-input form-input" placeholder="${t('rating.comment_placeholder', 'Nhập nhận xét chi tiết...')}" style="width:100%; height:60px; padding:8px 12px; font-size:12px; resize:none;" required></textarea>
        </div>
      `;

      card.querySelector('.remove-card-btn').addEventListener('click', () => {
        selectedEmployees.delete(empId);
        renderPills();
        renderDropdownItems(searchInput.value.trim());
      });

      const starRow = card.querySelector('.star-rating-row');
      const ratingLabel = card.querySelector('.rating-label');
      const commentInput = card.querySelector('.rating-comment-input');

      commentInput.value = initialComment;
      employeeDataMap.set(empId, { point: initialPoint, comment: initialComment });

      const labels = [
        t('rating.star1', 'Rất kém'),
        t('rating.star2', 'Kém'),
        t('rating.star3', 'Chấp nhận được'),
        t('rating.star4', 'Tốt'),
        t('rating.star5', 'Xuất sắc')
      ];
      let selectedPoint = initialPoint;

      const updateStarsUI = (point) => {
        Array.from(starRow.children).forEach((star, index) => {
          if (index < point) {
            star.textContent = 'star';
            star.style.color = '#eab308';
          } else {
            star.textContent = 'star_border';
            star.style.color = 'var(--text-muted)';
          }
        });
        ratingLabel.textContent = point > 0 ? labels[point - 1] : 'Chưa đánh giá';
        if (point > 0 && point <= 3) {
          commentInput.setAttribute('required', 'true');
          commentInput.placeholder = t('rating.comment_required_placeholder', 'Vui lòng nhập lý do đánh giá thấp...');
        } else {
          commentInput.removeAttribute('required');
          commentInput.placeholder = t('rating.comment_placeholder', 'Nhập nhận xét chi tiết...');
        }
      };

      for (let i = 1; i <= 5; i++) {
        const star = document.createElement('span');
        star.className = 'material-symbols-rounded';
        star.style.cssText = 'font-size:24px; cursor:pointer; color:var(--text-muted); transition:color 0.2s;';
        star.textContent = 'star_border';

        star.onmouseover = () => {
          Array.from(starRow.children).forEach((s, idx) => {
            s.textContent = idx < i ? 'star' : 'star_border';
            s.style.color = idx < i ? '#eab308' : 'var(--text-muted)';
          });
          ratingLabel.textContent = labels[i - 1];
        };

        star.onmouseout = () => {
          updateStarsUI(selectedPoint);
        };

        star.onclick = () => {
          selectedPoint = i;
          updateStarsUI(i);
          employeeDataMap.set(empId, { point: i, comment: commentInput.value.trim() });
        };

        starRow.appendChild(star);
      }

      commentInput.addEventListener('input', () => {
        employeeDataMap.set(empId, { point: selectedPoint, comment: commentInput.value.trim() });
      });

      if (initialPoint > 0) {
        updateStarsUI(initialPoint);
      }

      cardsContainer.appendChild(card);
    }

    const renderDropdownItems = (searchVal = '') => {
      dropdownList.innerHTML = '';
      const cleanVal = searchVal.toLowerCase().trim();
      const filtered = resolvedOptions.filter(opt => {
        if (selectedEmployees.has(opt.value)) return false;
        return opt.label.toLowerCase().includes(cleanVal);
      });

      if (filtered.length === 0) {
        dropdownList.innerHTML = `<div style="padding:10px 12px;font-size:13px;color:var(--text-muted);">${t('rating.no_matching', 'Không tìm thấy người tham gia phù hợp')}</div>`;
        return;
      }

      filtered.forEach(opt => {
        const div = document.createElement('div');
        div.style.cssText = 'padding:10px 12px;cursor:pointer;font-size:13px;color:var(--text-primary);border-bottom:1px solid var(--border);transition:background 0.15s;';
        div.innerHTML = escapeHTML(opt.label);
        div.onmouseover = () => { div.style.background = 'var(--bg-primary)'; };
        div.onmouseout = () => { div.style.background = 'transparent'; };
        div.onclick = (e) => {
          e.stopPropagation();
          selectedEmployees.add(opt.value);
          renderPills();
          searchInput.value = '';
          dropdownList.style.display = 'none';
        };
        dropdownList.appendChild(div);
      });
    };

    trigger.onclick = () => {
      dropdownList.style.display = dropdownList.style.display === 'none' ? 'block' : 'none';
      renderDropdownItems(searchInput.value.trim());
      searchInput.focus();
    };

    searchInput.oninput = () => {
      dropdownList.style.display = 'block';
      renderDropdownItems(searchInput.value.trim());
    };

    document.addEventListener('click', (e) => {
      if (!modal.querySelector('.searchable-multiselect-container').contains(e.target)) {
        dropdownList.style.display = 'none';
      }
    });

    if (existingRatings.length > 0) {
      existingRatings.forEach(r => {
        if (resolvedOptions.some(opt => opt.value === r.to_user)) {
          selectedEmployees.add(r.to_user);
        }
      });
      renderPills();
    }

    const cleanUp = () => {
      modal.remove();
    };

    modal.querySelector('#mrm-close-x').onclick = () => {
      cleanUp();
      resolve(null);
    };

    modal.querySelector('#mrm-cancel').onclick = () => {
      cleanUp();
      resolve(null);
    };

    modal.querySelector('#mrm-confirm').onclick = () => {
      if (selectedEmployees.size === 0) {
        showToast(t('rating.err.select_at_least', 'Vui lòng chọn ít nhất một người để đánh giá'), 'error');
        return;
      }

      const ratings = [];
      let isValid = true;

      selectedEmployees.forEach(empId => {
        const data = employeeDataMap.get(empId) || {};
        const pt = data.point || 0;
        const comment = data.comment || '';

        if (pt === 0) {
          showToast(t('rating.err.choose_stars', 'Vui lòng chọn số sao đánh giá cho nhân viên {0}').replace('{0}', empId), 'error');
          const card = cardsContainer.querySelector(`.rating-card[data-employee-id="${empId}"]`);
          if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          isValid = false;
          return;
        }

        if (pt <= 3 && !comment.trim()) {
          showToast(t('rating.err.comment_required', 'Nhận xét là bắt buộc khi đánh giá dưới 3 sao cho nhân viên {0}').replace('{0}', empId), 'error');
          const card = cardsContainer.querySelector(`.rating-card[data-employee-id="${empId}"]`);
          if (card) {
            const textarea = card.querySelector('.rating-comment-input');
            if (textarea) {
              textarea.style.borderColor = 'var(--accent-red)';
              textarea.focus();
            }
          }
          isValid = false;
          return;
        }

        ratings.push({
          to_user: empId,
          point: pt,
          comment: comment
        });
      });

      if (!isValid) return;

      cleanUp();
      resolve({ ratings });
    };
  });
}

// Modal chọn MTR + payment_date cho action Paid
// mtrOptions: [{value, label, transaction_date}]
// currentRecord: payment record hiện tại
function showPaymentPaidModal(mtrOptions, currentRecord, isChangeMtr = false) {
  return new Promise((resolve) => {
    const today = new Date().toISOString().slice(0, 10);
    const defaultDate = (currentRecord && currentRecord.payment_date)
      ? currentRecord.payment_date.slice(0, 10)
      : today;

    const optionsHTML = mtrOptions.length > 0
      ? mtrOptions.map(m => `<option value="${m.value}" data-txdate="${m.transaction_date || ''}">${m.label}</option>`).join('')
      : '<option value="">— No MTR found for this company —</option>';

    // Build modal HTML
    const existingModal = document.getElementById('payment-paid-modal');
    if (existingModal) existingModal.remove();

    const titleText = isChangeMtr ? 'Change MTR Transaction' : 'Mark as Paid';
    const descText = isChangeMtr ? 'Select a different MTR transaction and confirm date' : 'Select MTR transaction and confirm payment date';
    const confirmText = isChangeMtr ? 'Confirm Change' : 'Confirm Paid';

    const modal = document.createElement('div');
    modal.id = 'payment-paid-modal';
    modal.className = 'modal-overlay open';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:9999;';
    modal.innerHTML = `
      <div style="background:#fff;border-radius:12px;padding:28px;width:960px;max-width:95vw;box-shadow:0 20px 60px rgba(0,0,0,0.2);display:flex;flex-direction:column;gap:20px;">
        <div style="display:flex;flex-direction:column;border-bottom:1px solid #E5E7EB;padding-bottom:16px;">
          <h3 style="margin:0;font-size:16px;font-weight:700;color:#111827;">${titleText}</h3>
          <p style="margin:4px 0 0;font-size:12px;color:#6B7280;">${descText}</p>
        </div>
        <div style="display:flex;flex-direction:column;gap:16px;">
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:#374151;margin-bottom:6px;">MTR TRANSACTION <span style="color:#EF4444;">*</span></label>
            <select id="ppm-mtr-select" class="form-select" data-force-searchable="true" data-search-required="true" style="width:100%;padding:8px 12px;border:1px solid #D1D5DB;border-radius:6px;font-size:13px;font-family:inherit;outline:none;" ${mtrOptions.length === 0 ? 'disabled' : ''}>
              <option value="">— Select MTR Transaction —</option>
              ${optionsHTML}
            </select>
            ${mtrOptions.length === 0 ? '<p style="margin:4px 0 0;font-size:11px;color:#EF4444;">⚠ No MTR found. Please add a Money Transaction record first.</p>' : ''}
          </div>
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:#374151;margin-bottom:6px;">PAYMENT DATE</label>
            <input type="date" id="ppm-payment-date" value="${defaultDate}" style="width:100%;padding:8px 12px;border:1px solid #D1D5DB;border-radius:6px;font-size:13px;font-family:inherit;outline:none;box-sizing:border-box;" />
            <p id="ppm-date-hint" style="margin:4px 0 0;font-size:11px;color:#6B7280;">Auto-filled from MTR transaction date when selected (takes priority)</p>
          </div>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;border-top:1px solid #E5E7EB;padding-top:16px;">
          <button id="ppm-cancel" style="padding:8px 18px;border:1px solid #D1D5DB;background:#fff;color:#374151;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;">Cancel</button>
          <button id="ppm-confirm" style="padding:8px 18px;background:var(--accent-green,#10B981);color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;" ${mtrOptions.length === 0 ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>${confirmText}</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    if (window.initializeSearchableDropdowns) {
      window.initializeSearchableDropdowns(modal);
    }

    const mtrSelect = modal.querySelector('#ppm-mtr-select');
    const dateInput = modal.querySelector('#ppm-payment-date');
    const dateHint = modal.querySelector('#ppm-date-hint');

    // Khi chọn MTR → tự động điền payment_date từ transaction_date (ưu tiên)
    mtrSelect.addEventListener('change', () => {
      const selectedOpt = mtrSelect.options[mtrSelect.selectedIndex];
      const txDate = selectedOpt ? selectedOpt.getAttribute('data-txdate') : '';
      if (txDate) {
        dateInput.value = txDate.slice(0, 10);
        dateHint.textContent = '✓ Payment date set from MTR transaction date (priority)';
        dateHint.style.color = 'var(--accent-green, #10B981)';
      } else {
        dateHint.textContent = 'MTR has no transaction date — please enter manually';
        dateHint.style.color = '#F59E0B';
      }
    });

    modal.querySelector('#ppm-cancel').addEventListener('click', () => {
      modal.remove();
      resolve(null);
    });

    modal.querySelector('#ppm-confirm').addEventListener('click', () => {
      const transactionId = mtrSelect.value;
      if (!transactionId) {
        // Find morphed input if available to highlight error
        const wrapper = mtrSelect.closest('.searchable-dropdown-container');
        const input = wrapper ? wrapper.querySelector('.searchable-dropdown-input') : mtrSelect;
        if (input) input.style.borderColor = '#EF4444';
        return;
      }
      const paymentDate = dateInput.value || null;
      modal.remove();
      resolve({ transaction_id: transactionId, payment_date: paymentDate });
    });

    // Click outside to cancel
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
        resolve(null);
      }
    });
  });
}



function showAssignTaskModal(currentRecord) {
  return new Promise(async (resolve) => {
    let employees = [];
    try {
      employees = await getSelectOptions('employee');
    } catch (e) {
      console.warn("Failed to load employees for assign task modal:", e);
    }

    const existing = document.getElementById('assign-task-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'assign-task-modal';
    modal.className = 'modal-overlay open';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:9999;';

    modal.innerHTML = `
      <div class="modal" style="max-width:850px; width:95%; min-height:550px; max-height:85vh; display:flex; flex-direction:column; background:var(--bg-secondary); border:1px solid var(--border); border-radius:12px; box-shadow:var(--shadow); font-family:'Inter', sans-serif;">
        <div class="modal-header" style="border-bottom:1px solid var(--border); padding:20px 24px;">
          <div>
            <h3 style="margin:0;font-size:18px;font-weight:700;color:var(--text-primary);display:flex;align-items:center;gap:8px;"><span class="material-symbols-rounded" style="color:#F97316;">task</span> ${typeof t === 'function' ? t('assign_task.modal_title', 'Chi tiết Giao việc') : 'Assign Task Details'}</h3>
            <p style="margin:4px 0 0;font-size:12px;color:var(--text-muted);">${typeof t === 'function' ? t('assign_task.description', 'Giao công việc cho nhân viên và thiết lập chi tiết bên dưới.') : 'Assign tasks to employees and set individual details below.'}</p>
          </div>
          <button id="atm-close-x" class="modal-close" style="color:var(--text-muted); background:none; border:none; cursor:pointer; font-size:20px; width:32px; height:32px; display:flex; align-items:center; justify-content:center; border-radius:6px;">✕</button>
        </div>

        <div class="modal-body" style="display:flex; flex-direction:column; gap:16px; padding:20px 24px; overflow-y:auto; flex:1;">
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--text-primary);margin-bottom:6px;">${typeof t === 'function' ? t('assign_task.select_assignees', 'CHỌN NHÂN VIÊN GIAO VIỆC') : 'SELECT ASSIGNEES'} <span style="color:#EF4444;">*</span></label>
            <div class="searchable-multiselect-container" style="position: relative; width: 100%;">
              <div class="multiselect-trigger" style="display: flex; flex-wrap: wrap; gap: 6px; align-items: center; min-height: 44px; padding: 6px 12px; cursor: pointer; background: var(--bg-primary); border: 1px solid var(--border); border-radius: 8px; box-sizing: border-box;">
                <div class="selected-pills" style="display: flex; flex-wrap: wrap; gap: 6px;"></div>
                <input type="text" class="multiselect-search-input" placeholder="${typeof t === 'function' ? t('assign_task.search_placeholder', 'Tìm kiếm và chọn nhân viên...') : 'Search and select employees...'}" style="border: none; outline: none; background: transparent; flex: 1; min-width: 120px; font-size: 13px; padding: 0; margin: 0; height: 28px; color: var(--text-primary); font-family: inherit;" autocomplete="off" />
                <span class="material-symbols-rounded" style="color: var(--text-muted); margin-left: auto; font-size: 20px; pointer-events: none;">arrow_drop_down</span>
              </div>
              <div class="multiselect-dropdown-list" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 8px; margin-top: 4px; max-height: 180px; overflow-y: auto; z-index: 10000; box-shadow: var(--shadow); box-sizing: border-box; text-align: left;">
              </div>
            </div>
          </div>

          <!-- Dynamic Assignee Cards Container -->
          <div id="atm-assignees-container" style="display:flex; flex-direction:column; gap:16px;"></div>
        </div>

        <div class="modal-footer" style="padding:14px 24px; border-top:1px solid var(--border); display:flex; gap:12px; justify-content:flex-end;">
          <button id="atm-cancel" class="btn btn-secondary" style="font-weight:600;">${typeof t === 'function' ? t('btn.cancel', 'Huỷ') : 'Cancel'}</button>
          <button id="atm-confirm" class="btn btn-primary" style="font-weight:600; background:#F97316; border-color:#F97316; color:#fff;">${typeof t === 'function' ? t('assign_task.start_task', 'Bắt đầu giao việc') : 'Start Task'}</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const trigger = modal.querySelector('.multiselect-trigger');
    const searchInput = modal.querySelector('.multiselect-search-input');
    const dropdownList = modal.querySelector('.multiselect-dropdown-list');
    const pillsContainer = modal.querySelector('.selected-pills');
    const assigneesContainer = modal.querySelector('#atm-assignees-container');

    const selectedEmployees = new Set();

    const resolvedOptions = employees.map(emp => {
      return {
        value: String(emp.employee_id || emp.email),
        label: typeof formatEmployeeLabel === 'function' ? formatEmployeeLabel(emp) : (emp.full_name || emp.email)
      };
    });

    const renderPills = () => {
      pillsContainer.innerHTML = '';
      const currentCardIds = Array.from(assigneesContainer.querySelectorAll('.assignee-card')).map(c => c.getAttribute('data-employee-id'));

      currentCardIds.forEach(id => {
        if (!selectedEmployees.has(id)) {
          const card = assigneesContainer.querySelector(`.assignee-card[data-employee-id="${id}"]`);
          if (card) card.remove();
        }
      });

      selectedEmployees.forEach(val => {
        const opt = resolvedOptions.find(o => o.value === val);
        const label = opt ? opt.label : val;

        const pill = document.createElement('span');
        pill.className = 'multiselect-pill';
        pill.style.cssText = 'display:inline-flex;align-items:center;gap:4px;background:#EFF6FF;color:#1D4ED8;border:1px solid #BFDBFE;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:500;max-width:180px;white-space:nowrap;overflow:hidden;';
        pill.innerHTML = `
          <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1;">${escapeHTML(label)}</span>
          <span class="remove-pill-btn" style="cursor:pointer;font-weight:700;margin-left:4px;opacity:0.6;flex-shrink:0;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.6">✕</span>
        `;
        pill.querySelector('.remove-pill-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          selectedEmployees.delete(val);
          renderPills();
          renderDropdownItems(searchInput.value.trim());
        });
        pillsContainer.appendChild(pill);

        if (!currentCardIds.includes(val)) {
          const card = document.createElement('div');
          card.className = 'assignee-card';
          card.setAttribute('data-employee-id', val);
          card.style.cssText = 'border: 1px solid var(--border); border-radius: 8px; padding: 16px; background: var(--bg-primary); display: flex; flex-direction: column; gap: 12px; position: relative;';
          card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 8px;">
              <span style="font-weight: 700; font-size: 13px; color: var(--text-primary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; padding-right:8px;">👤 ${escapeHTML(label)}</span>
              <button type="button" class="remove-assignee-card-btn" style="background: none; border: none; cursor: pointer; color: #EF4444; padding: 2px; display: inline-flex; flex-shrink: 0;" title="Remove employee"><span class="material-symbols-rounded" style="font-size: 16px;">delete</span></button>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
              <div>
                <label style="display:block; font-size:11px; font-weight:600; color:var(--text-muted); margin-bottom:4px;">DEADLINE</label>
                <input type="date" class="assignee-deadline" min="${new Date().toISOString().split('T')[0]}" style="width:100%; padding:8px 10px; border:1px solid var(--border); border-radius:6px; font-size:12px; outline:none; box-sizing:border-box; background:var(--bg-secondary); color:var(--text-primary);" />
              </div>

              <div>
                <label style="display:block; font-size:11px; font-weight:600; color:var(--text-muted); margin-bottom:4px;">TASK INFO LINK</label>
                <input type="text" class="assignee-info-link" style="width:100%; padding:8px 10px; border:1px solid var(--border); border-radius:6px; font-size:12px; outline:none; box-sizing:border-box; background:var(--bg-secondary); color:var(--text-primary);" placeholder="https://example.com" />
              </div>
            </div>

            <div>
              <label style="display:block; font-size:11px; font-weight:600; color:var(--text-muted); margin-bottom:4px;">DESCRIPTION <span style="color:#EF4444;">*</span></label>
              <textarea class="assignee-description" style="width:100%; height:60px; padding:8px 10px; border:1px solid var(--border); border-radius:6px; font-size:12px; outline:none; box-sizing:border-box; resize:none; background:var(--bg-secondary); color:var(--text-primary);" placeholder="Enter task description for this employee...">${escapeHTML(currentRecord.description || '')}</textarea>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; align-items: end;">
              <div>
                <label style="display:block; font-size:11px; font-weight:600; color:var(--text-muted); margin-bottom:4px;">GUIDE FILE / ATTACHMENT</label>
                <div style="display:flex; align-items:center; gap:8px;">
                  <input type="file" class="assignee-guide-file" style="display:none;" />
                  <input type="hidden" class="assignee-guide-file-b64" />
                  <button type="button" class="assignee-upload-btn" style="padding:6px 12px; border:1px solid var(--border); background:var(--bg-secondary); color:var(--text-primary); border-radius:6px; font-size:12px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:4px; font-family:inherit;"><span class="material-symbols-rounded" style="font-size:14px;">upload</span> Upload</button>
                  <span class="assignee-file-name" style="font-size:11px; color:var(--text-muted); max-width:120px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">No file selected</span>
                </div>
              </div>

              <div>
                <label style="display:block; font-size:11px; font-weight:600; color:var(--text-muted); margin-bottom:4px;">NOTES</label>
                <input type="text" class="assignee-info-notes" style="width:100%; padding:8px 10px; border:1px solid var(--border); border-radius:6px; font-size:12px; outline:none; box-sizing:border-box; background:var(--bg-secondary); color:var(--text-primary);" placeholder="Optional notes" />
              </div>
            </div>
          `;

          const fileInput = card.querySelector('.assignee-guide-file');
          const uploadBtn = card.querySelector('.assignee-upload-btn');
          const fileNameSpan = card.querySelector('.assignee-file-name');
          const fileB64Hidden = card.querySelector('.assignee-guide-file-b64');

          uploadBtn.addEventListener('click', () => fileInput.click());
          fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
              fileNameSpan.textContent = `${file.name} (Uploading...)`;
              uploadBinaryFile(file)
                .then(url => {
                  fileB64Hidden.value = url;
                  fileNameSpan.textContent = `${file.name}`;
                })
                .catch(err => {
                  console.error('Assignee guide file upload failed:', err);
                  showToast('Upload failed: ' + err.message, 'error');
                  fileNameSpan.textContent = 'Upload failed';
                });
            } else {
              fileNameSpan.textContent = 'No file selected';
              fileB64Hidden.value = '';
            }
          });

          card.querySelector('.remove-assignee-card-btn').addEventListener('click', () => {
            selectedEmployees.delete(val);
            renderPills();
            renderDropdownItems(searchInput.value.trim());
          });

          assigneesContainer.appendChild(card);
        }
      });
    };

    const renderDropdownItems = (filterText = '') => {
      dropdownList.innerHTML = '';
      const filterLower = filterText.toLowerCase();
      const filtered = resolvedOptions.filter(o =>
        !selectedEmployees.has(o.value) &&
        (o.label.toLowerCase().includes(filterLower) || o.value.toLowerCase().includes(filterLower))
      );

      if (filtered.length === 0) {
        dropdownList.innerHTML = `<div style="padding:10px 12px;font-size:13px;color:#9CA3AF;text-align:center;">No matching employees found</div>`;
        return;
      }

      filtered.forEach(o => {
        const item = document.createElement('div');
        item.style.cssText = 'padding:8px 12px;cursor:pointer;font-size:13px;color:#1F2937;border-bottom:1px solid #F3F4F6;';
        item.innerHTML = escapeHTML(o.label);
        item.addEventListener('mouseover', () => item.style.background = '#F9FAFB');
        item.addEventListener('mouseout', () => item.style.background = 'transparent');
        item.addEventListener('mousedown', (e) => {
          e.preventDefault();
          selectedEmployees.add(o.value);
          searchInput.value = '';
          renderPills();
          dropdownList.style.display = 'none';
        });
        dropdownList.appendChild(item);
      });
    };

    trigger.addEventListener('click', () => {
      searchInput.focus();
      dropdownList.style.display = 'block';
      renderDropdownItems(searchInput.value.trim());
    });

    searchInput.addEventListener('input', (e) => {
      dropdownList.style.display = 'block';
      renderDropdownItems(e.target.value.trim());
    });

    const triggerClickOutside = (e) => {
      if (!modal.contains(e.target)) {
        dropdownList.style.display = 'none';
      }
    };
    document.addEventListener('mousedown', triggerClickOutside);

    const closeAll = () => {
      document.removeEventListener('mousedown', triggerClickOutside);
      modal.remove();
      resolve(null);
    };

    modal.querySelector('#atm-close-x').addEventListener('click', closeAll);
    modal.querySelector('#atm-cancel').addEventListener('click', closeAll);

    modal.querySelector('#atm-confirm').addEventListener('click', () => {
      if (selectedEmployees.size === 0) {
        showToast("Vui lòng chọn ít nhất một nhân viên thực hiện (Assign to)", "warning");
        return;
      }

      const tasks = [];
      const cards = modal.querySelectorAll('.assignee-card');
      for (const card of cards) {
        const empId = card.getAttribute('data-employee-id');
        const desc = card.querySelector('.assignee-description').value.trim();
        if (!desc) {
          showToast("Vui lòng nhập mô tả công việc cho mỗi nhân viên", "warning");
          card.querySelector('.assignee-description').focus();
          return;
        }
        const deadline = card.querySelector('.assignee-deadline').value || null;
        const link = card.querySelector('.assignee-info-link').value.trim() || null;
        const fileB64 = card.querySelector('.assignee-guide-file-b64').value || null;
        const notes = card.querySelector('.assignee-info-notes').value.trim() || null;

        tasks.push({
          employee_id: empId,
          description: desc,
          deadline: deadline,
          task_info_link: link,
          task_info_guide_file: fileB64,
          task_info_notes: notes
        });
      }

      document.removeEventListener('mousedown', triggerClickOutside);
      modal.remove();
      resolve({ tasks });
    });
  });
}

/**
 * Opens the Assign Task modal from the child tab Add button.
 * Re-uses the same rich modal as the ACT-REQUEST-08 action,
 * but submits each task individually via POST /table/assigned_task
 * and then refreshes only the assigned_task child tab.
 */
window.openAddAssignedTaskFromChild = async function (requestId, parentModuleKey) {
  const record = (typeof currentRecord !== 'undefined' && currentRecord) ? currentRecord : { request_id: requestId };
  const result = await showAssignTaskModal(record);
  if (!result || !result.tasks || result.tasks.length === 0) return;

  const errors = [];
  for (const task of result.tasks) {
    try {
      await apiPost('/table/assigned_task?view=request', {
        request_id: requestId,
        employee_id: task.employee_id,
        description: task.description,
        deadline: task.deadline || null,
        task_info_link: task.task_info_link || null,
        task_info_guide_file: task.task_info_guide_file || null,
        task_info_notes: task.task_info_notes || null,
        status: 'Not started yet'
      });
    } catch (e) {
      errors.push(`${task.employee_id}: ${e.message}`);
    }
  }

  if (errors.length > 0) {
    showToast('Some tasks failed: ' + errors.join('; '), 'error');
  } else {
    showToast(`${result.tasks.length} task(s) assigned successfully!`, 'success');
  }

  // Refresh only the assigned_task child tab
  try {
    await loadChildTable('assigned_task', parentModuleKey, requestId);
  } catch (e) {
    console.warn('Failed to refresh assigned_task child tab:', e);
  }
};

function showUpdateTaskStatusModal(taskId) {
  return new Promise(async (resolve) => {
    let taskRecord = null;
    let reqRecord = null;
    try {
      taskRecord = await apiGet(`/table/assigned_task/${taskId}`);
      if (taskRecord && taskRecord.request_id) {
        reqRecord = await apiGet(`/table/request/${taskRecord.request_id}?pk=request_id`).catch(() => null);
      }
    } catch (e) {
      console.error("Failed to load task/request details:", e);
      showToast("Cannot load task details.", "error");
      return;
    }

    const userEmpId = (authUser.employee_id || '').toLowerCase();
    const userEmail = (authUser.email || '').toLowerCase();
    const isGlobalAdmin = authUser.role && authUser.role.toUpperCase() === 'SUPER ADMIN';

    let isRequestManager = false;
    if (reqRecord) {
      const srOwnerArr = Array.isArray(reqRecord.sr_owner)
        ? reqRecord.sr_owner.map(s => String(s).toLowerCase())
        : (reqRecord.sr_owner ? [String(reqRecord.sr_owner).toLowerCase()] : []);
      const policyLead = String(reqRecord.policy_lead || '').toLowerCase();
      if (srOwnerArr.includes(userEmpId) || srOwnerArr.includes(userEmail) || policyLead === userEmpId || policyLead === userEmail) {
        isRequestManager = true;
      }
    }

    const isAssignee = String(taskRecord.employee_id).toLowerCase() === userEmpId;
    const canEditComment = isRequestManager || isGlobalAdmin;
    const canEditReport = isAssignee;

    const existing = document.getElementById('update-task-status-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'update-task-status-modal';
    modal.className = 'modal-overlay open';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:9999;';

    const currentStatus = taskRecord.status || 'Not started yet';
    const currentReport = taskRecord.task_info_report || '';
    const currentComment = taskRecord.task_info_comment || '';

    modal.innerHTML = `
      <div class="modal" style="max-width:500px; width:95%; max-height:85vh; display:flex; flex-direction:column; background:var(--bg-secondary); border:1px solid var(--border); border-radius:12px; box-shadow:var(--shadow); font-family:'Inter', sans-serif;">
        <div class="modal-header" style="border-bottom:1px solid var(--border); padding:20px 24px;">
          <div>
            <h3 style="margin:0;font-size:18px;font-weight:700;color:var(--text-primary);display:flex;align-items:center;gap:8px;"><span class="material-symbols-rounded" style="color:#059669;">task_alt</span> Update Task Status</h3>
            <p style="margin:4px 0 0;font-size:12px;color:var(--text-muted);">Update your progress and status for task <strong>${taskId}</strong>.</p>
          </div>
          <button id="utsm-close-x" class="modal-close" style="color:var(--text-muted); background:none; border:none; cursor:pointer; font-size:20px; width:32px; height:32px; display:flex; align-items:center; justify-content:center; border-radius:6px;">✕</button>
        </div>

        <div class="modal-body" style="display:flex; flex-direction:column; gap:16px; padding:20px 24px; overflow-y:auto; flex:1;">
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--text-primary);margin-bottom:6px;">STATUS <span style="color:#EF4444;">*</span></label>
            <select id="utsm-status" class="form-input" style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px;font-family:inherit;outline:none;box-sizing:border-box;background:var(--bg-primary);color:var(--text-primary);">
              <option value="Not started yet" ${currentStatus === 'Not started yet' ? 'selected' : ''}>Not started yet</option>
              <option value="Processing" ${currentStatus === 'Processing' ? 'selected' : ''}>Processing</option>
              <option value="Completed" ${currentStatus === 'Completed' ? 'selected' : ''}>Completed</option>
            </select>
          </div>

          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--text-primary);margin-bottom:6px;">PROGRESS REPORT / NOTES (Assignee)</label>
            <textarea id="utsm-report" style="width:100%;height:80px;padding:10px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px;font-family:inherit;outline:none;box-sizing:border-box;resize:none;background:${canEditReport ? 'var(--bg-primary)' : 'var(--bg-hover)'};color:var(--text-primary);" ${canEditReport ? '' : 'readonly'} placeholder="${canEditReport ? 'Describe what you have done...' : 'No progress report submitted yet'}">${escapeHTML(currentReport)}</textarea>
          </div>

          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--text-primary);margin-bottom:6px;">EVALUATION / COMMENT (Request Manager)</label>
            <textarea id="utsm-comment" style="width:100%;height:80px;padding:10px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px;font-family:inherit;outline:none;box-sizing:border-box;resize:none;background:${canEditComment ? 'var(--bg-primary)' : 'var(--bg-hover)'};color:var(--text-primary);" ${canEditComment ? '' : 'readonly'} placeholder="${canEditComment ? 'Evaluate task completion or add comments...' : 'No evaluation/comments submitted yet'}">${escapeHTML(currentComment)}</textarea>
          </div>
        </div>

        <div class="modal-footer" style="padding:14px 24px; border-top:1px solid var(--border); display:flex; gap:12px; justify-content:flex-end;">
          <button id="utsm-cancel" class="btn btn-secondary" style="font-weight:600;">Cancel</button>
          <button id="utsm-confirm" class="btn btn-primary" style="font-weight:600; background:#059669; border-color:#059669; color:#fff; box-shadow:0 2px 4px rgba(5,150,105,0.2);">Save Changes</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const closeAll = () => {
      modal.remove();
      resolve(null);
    };

    modal.querySelector('#utsm-close-x').addEventListener('click', closeAll);
    modal.querySelector('#utsm-cancel').addEventListener('click', closeAll);

    modal.querySelector('#utsm-confirm').addEventListener('click', async () => {
      const statusVal = modal.querySelector('#utsm-status').value;
      const reportVal = modal.querySelector('#utsm-report').value.trim();
      const commentVal = modal.querySelector('#utsm-comment').value.trim();

      const payload = {
        status: statusVal
      };
      if (canEditReport) payload.task_info_report = reportVal;
      if (canEditComment) payload.task_info_comment = commentVal;

      try {
        showToast('Saving status...', 'info');
        await apiPut(`/table/assigned_task/${taskId}`, payload);
        showToast('Task status updated successfully!', 'success');
        modal.remove();

        if (currentView === 'detail' && currentModule === 'assigned_task') {
          await openDetailInternal('assigned_task', taskId, true);
        } else if (currentView === 'detail' && currentModule) {
          const parentPkField = MODULES[currentModule] ? MODULES[currentModule].pk : 'id';
          const parentPkVal = (window.currentDetailRecord ? window.currentDetailRecord[parentPkField] : null) || (currentRecord ? currentRecord[parentPkField] : null);
          if (parentPkVal) {
            clearChildTableCache('assigned_task', currentModule, parentPkVal);
            await openDetailInternal(currentModule, parentPkVal, true, true);
            setTimeout(() => {
              window.switchTab('assigned_task');
              loadChildTable('assigned_task', currentModule, parentPkVal);
            }, 150);
          }
        } else if (currentView === 'dashboard' && ['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(currentModule)) {
          await loadDashboardView(currentModule);
        } else if (currentView === 'kanban') {
          if (typeof renderAssignedTaskKanbanView === 'function') {
            await renderAssignedTaskKanbanView('assigned_task', true);
          }
        } else if (currentModule) {
          await refreshTableData(currentModule, true);
        }
        resolve(true);
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}

// The original showCustomConfirm has been removed to avoid conflicts with the Promise-based dynamic modal below.

window.executeAction = async function (actionId, moduleKey, pkVal) {
  if (actionId === 'update_task_status') {
    await showUpdateTaskStatusModal(pkVal);
    return;
  }
  let extraData = {};
  const mod = MODULES[moduleKey];
  const fields = mod ? (mod.fields || []) : [];

  // Custom handling for actions that require user input
  if (actionId === 'ACT-REQUEST-016') {
    let parentId = currentRecord && (currentRecord.parent_request_id || currentRecord.parent__id_request);
    if (!parentId) {
      try {
        const childRecord = await apiGet(`/table/request/${pkVal}?pk=request_id`);
        parentId = childRecord && (childRecord.parent_request_id || childRecord.parent__id_request);
      } catch (e) {
        console.warn('Could not resolve parent request:', e);
      }
    }
    if (!parentId) {
      showToast('Main request not found for this payment request.', 'warning');
      return;
    }
    window.location.hash = `#request/${parentId}`;
    return;
  } else if (actionId === 'ACT-REQUEST-01' || actionId === 'change_sr_owner') {
    // SR Owner is now a multiselect (TEXT[])
    let fieldConfig = fields.find(f => f.key === 'sr_owner');
    if (!fieldConfig) {
      fieldConfig = {
        key: 'sr_owner',
        label: 'SR Owner',
        type: 'multiselect',
        optionsFrom: 'employee',
        optionValue: 'email',
        optionLabel: 'full_name'
      };
    } else {
      // Force multiselect even if config says single select
      fieldConfig = { ...fieldConfig, type: 'multiselect' };
    }
    // Build default value from current sr_owner array
    const currentOwners = Array.isArray(currentRecord && currentRecord.sr_owner)
      ? currentRecord.sr_owner
      : (currentRecord && currentRecord.sr_owner ? [currentRecord.sr_owner] : []);
    // Fetch employees to build multiselect checkbox options
    const employeeList = await getSelectOptions('employee');
    const valKey = fieldConfig.optionValue || 'email';
    const labelKey = fieldConfig.optionLabel || 'full_name';
    // Build a multiselect config with resolved employee objects
    const multiFieldConfig = {
      key: 'sr_owner',
      label: 'SR Owner',
      type: 'multiselect',
      optionsFrom: 'employee',
      options: employeeList,
      optionValue: valKey,
      optionLabel: labelKey
    };
    // Build defaultValue as clean comma-separated list for showCustomPrompt
    const defaultValue = currentOwners.map(e => String(e).replace(/^\[|\]$/g, '').trim()).join(', ');
    const newOwnerStr = await showCustomPrompt("Change SR Owner", "Please select new SR Owner(s):", defaultValue, "", multiFieldConfig);
    if (!newOwnerStr) return; // User cancelled
    // Parse back from comma-separated string to array
    const newOwnerArr = newOwnerStr
      .split(',')
      .map(s => s.trim().replace(/^\[|\]$/g, ''))
      .filter(Boolean);
    extraData.sr_owner = newOwnerArr;
  } else if (actionId === 'ACT-REQUEST-02') {
    let fieldConfig = fields.find(f => f.key === 'elements');
    const availableElements = ['Contract', 'Payment', 'Invoice', 'Expense', 'Service', 'Asset', 'Target table', 'Assign task', 'Opportunity', 'Finance'];
    if (!fieldConfig) {
      fieldConfig = {
        key: 'elements',
        label: 'Elements',
        type: 'multiselect',
        options: availableElements
      };
    } else {
      fieldConfig = {
        ...fieldConfig,
        options: availableElements
      };
    }
    // Normalize currentRecord.elements to "[X], [Y]" format regardless of how it was stored
    const recordHasElements = currentRecord && currentRecord.elements && (!Array.isArray(currentRecord.elements) || currentRecord.elements.length > 0);
    let rawElements = recordHasElements ? currentRecord.elements : '';
    if (!rawElements && currentRecord && currentRecord.request_type) {
      if (!selectCache['policy'] || !selectCache['policy'].isFullList) {
        await getSelectOptions('policy').catch(() => { });
      }
      const parentPol = selectCache['policy'] ? selectCache['policy'].find(p => String(p.policy_id) === String(currentRecord.request_type)) : null;
      if (parentPol && parentPol.elements) {
        rawElements = parentPol.elements;
      }
    }
    let defaultValue = '';
    if (rawElements) {
      let parsed = [];
      if (Array.isArray(rawElements)) {
        // Already a JS array (e.g. from JSONB column)
        parsed = rawElements;
      } else if (typeof rawElements === 'string') {
        const trimmed = rawElements.trim();
        if (trimmed.startsWith('[') && trimmed.includes('"')) {
          // JSON array string like ["CONTRACT","EXPENSE"]
          try { parsed = JSON.parse(trimmed); } catch (e) { parsed = []; }
        } else {
          // "[CONTRACT], [EXPENSE]" or "CONTRACT, EXPENSE" format
          parsed = trimmed.split(',').map(s => s.trim().replace(/^\[|\]$/g, '')).filter(Boolean);
        }
      }
      // Rebuild into clean comma-separated format that showCustomPrompt multiselect uses
      defaultValue = parsed.map(s => s.trim().replace(/^\[|\]$/g, '')).filter(Boolean).join(', ');
    }
    const elementsTitle = typeof t === 'function' ? t('col.elements', 'Elements') : 'Elements';
    const elementsPrompt = typeof t === 'function' ? t('action.select_elements', 'Please select elements:') : 'Please select elements:';
    const elements = await showCustomPrompt(elementsTitle, elementsPrompt, defaultValue, "", fieldConfig);
    if (!elements) return;
    extraData.elements = elements;
  } else if (actionId === 'ACT-REQUEST-03' || actionId === 'ACT-REQUEST-03-RE') {
    let participants = [];
    try {
      const res = await apiGet(`/actions/request/${pkVal}/participants`);
      participants = res.data || [];
    } catch (e) {
      console.error("Failed to load participants:", e);
    }
    if (participants.length === 0) {
      showToast(t('rating.no_matching', 'Không tìm thấy người tham gia khả dụng để đánh giá'), "error");
      return;
    }

    let existingRatings = [];
    if (actionId === 'ACT-REQUEST-03-RE') {
      try {
        const res = await apiGet(`/actions/request/${pkVal}/my-ratings`);
        existingRatings = res.data || [];
      } catch (e) {
        console.error("Failed to load existing ratings:", e);
      }
    }

    const result = await showMultiRatingModal(
      actionId === 'ACT-REQUEST-03' ? t('rating.title', "FeedBack yêu cầu") : t('rating.rate_again', "Chỉnh sửa FeedBack"),
      participants,
      existingRatings
    );
    if (!result) return;
    extraData = result;
  } else if (actionId === 'ACT-SUPPORT-03' || actionId === 'ACT-SUPPORT-03-RE' || actionId === 'ACT-REQUEST-06') {
    const isNew = actionId === 'ACT-SUPPORT-03' || actionId === 'ACT-REQUEST-06';
    const ratingObj = await showRatingModal(isNew ? "Rate Request" : "Rate Request Again");
    if (!ratingObj) return;
    extraData.rating = ratingObj;
  } else if (actionId === 'ACT-REQUEST-04') {
    const fieldConfig = {
      key: 'process_status',
      label: 'Process Status',
      type: 'select',
      options: ['Not started yet', 'Processing', 'Completed']
    };
    const currentProcessStatus = currentRecord && currentRecord.process_status ? currentRecord.process_status : '';
    const pStatus = await showCustomPrompt("Re-update Process Status", "Please select new process status:", currentProcessStatus, "", fieldConfig);
    if (!pStatus) return;
    extraData.process_status = pStatus;
  } else if (actionId === 'payment_paid' || actionId === 'payment_change_mtr') {
    // Lấy danh sách MTR thuộc account của payment này
    let mtrList = [];
    try {
      const mtrRes = await apiGet(`/actions/payment/${pkVal}/mtrs`);
      mtrList = (mtrRes && mtrRes.data) ? mtrRes.data : [];
    } catch (e) {
      console.warn('Could not fetch MTRs for payment:', e);
    }

    // Build danh sách options cho dropdown MTR (bổ sung Tên Account ở đầu để dễ tìm kiếm)
    const mtrOptions = mtrList.map(m => {
      const accName = m.account_name || m.account || '';
      return {
        value: m.transaction_id,
        label: `${accName} | ${m.description || m.transaction_id} | ${m.transaction_type || ''} | ${formatNumber(m.amount) || ''} ${m.currency || ''} | ${m.transaction_date ? m.transaction_date.slice(0, 10) : 'No date'}`,
        transaction_date: m.transaction_date
      };
    });

    // Hiện modal chọn MTR + payment_date
    const result = await showPaymentPaidModal(mtrOptions, currentRecord, actionId === 'payment_change_mtr');
    if (!result) return; // User cancelled

    extraData.transaction_id = result.transaction_id;
    if (result.payment_date) extraData.payment_date = result.payment_date;
  } else if (actionId === 'ACT-REQUEST-08' && currentRecord) {
    let activeElements = [];
    let elementsVal = currentRecord.elements || currentRecord.policy_elements;
    if (!elementsVal && currentRecord.request_type) {
      const policy = (typeof requestPolicies !== 'undefined') ? requestPolicies.find(p => String(p.policy_id) === String(currentRecord.request_type)) : null;
      if (policy) elementsVal = policy.elements;
    }
    if (elementsVal) {
      if (Array.isArray(elementsVal)) {
        activeElements = elementsVal.map(s => String(s).replace(/^\[|\]$/g, '').trim().toUpperCase());
      } else if (typeof elementsVal === 'string') {
        activeElements = elementsVal.split(',').map(s => String(s).trim().replace(/^\[|\]$/g, '').toUpperCase()).filter(Boolean);
      }
    }

    if (activeElements.includes('ASSIGN_TASK')) {
      const result = await showAssignTaskModal(currentRecord);
      if (!result) return; // User cancelled
      extraData = { ...result };
    } else {
      const confirmed = await showCustomConfirm("Confirm Execution", "Are you sure you want to execute this action?");
      if (!confirmed) return;
    }
  } else {
    // For automated actions, just ask for confirmation
    const confirmed = await showCustomConfirm("Confirm Execution", "Are you sure you want to execute this action?");
    if (!confirmed) return;
  }

  try {
    showToast('Executing action...', 'info');
    const resolvedTable = (mod && mod.writeTable) ? mod.writeTable : (['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(moduleKey) ? 'request' : moduleKey);
    await apiPost(`/actions/execute`, {
      action_id: actionId,
      table_name: resolvedTable,
      record_id: pkVal,
      view: moduleKey,
      data: extraData
    });
    showToast('Action executed successfully!', 'success');

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

    if (currentView === 'detail') {
      if (currentModule && moduleKey !== currentModule) {
        const parentPkField = MODULES[currentModule] ? MODULES[currentModule].pk : 'id';
        const parentPkVal = (window.currentDetailRecord ? window.currentDetailRecord[parentPkField] : null) || (currentRecord ? currentRecord[parentPkField] : null);
        if (parentPkVal) {
          clearChildTableCache(moduleKey, currentModule, parentPkVal);
          await openDetailInternal(currentModule, parentPkVal, true, true);
          setTimeout(() => {
            window.switchTab(moduleKey);
          }, 150);
        }
      } else {
        await openDetailInternal(moduleKey, pkVal, true);
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
    showToast(err.message, 'error');
  }
}

function buildCmsTenantInfoDetailHTML(record) {
  const currentPlanLabel = typeof t === 'function' ? t('seat.current_plan', 'Gói dịch vụ hiện tại').toUpperCase() : 'GÓI DỊCH VỤ HIỆN TẠI';
  const planDefaultName = typeof t === 'function' ? t('nav.cms_tenant_info', 'Gói dịch vụ') : 'Gói dịch vụ';
  const nextPaymentLabel = typeof t === 'function' ? t('col.next_payment_date', 'Hạn thanh toán kế tiếp') : 'Hạn thanh toán kế tiếp';
  const unknownLabel = typeof t === 'function' ? t('val.unknown', 'Không xác định') : 'Không xác định';
  const billingCycleLabel = typeof t === 'function' ? t('col.billing_cycle', 'Chu kỳ thanh toán') : 'Chu kỳ thanh toán';
  const loadingLabel = typeof t === 'function' ? t('detail.loading', 'Đang tính toán...') : 'Đang tính toán...';

  const userSeatsLabel = typeof t === 'function' ? t('seat.user_seats_title', 'Tài khoản đăng nhập (Seats)') : 'Tài khoản đăng nhập (Seats)';
  const empScaleLabel = typeof t === 'function' ? t('module.employee.title', 'Quy mô nhân sự tối đa') : 'Quy mô nhân sự tối đa';
  const storageLabel = typeof t === 'function' ? t('nav.request_activity_log', 'Dung lượng lưu trữ') : 'Dung lượng lưu trữ';
  const featuresLabel = typeof t === 'function' ? t('module.cms_tenant_info.title', 'Thông số chi tiết gói dịch vụ') : 'Thông số chi tiết gói dịch vụ';

  const userRole = (typeof authUser !== 'undefined' && authUser && authUser.role) ? String(authUser.role).toUpperCase() : '';
  const isSuperAdmin = userRole === 'SUPER ADMIN' || userRole === '1';

  return `
    <div class="view active cms_tenant_info-detail" id="view-cms_tenant_info-detail" style="display: flex; flex-direction: column; height: 100%; overflow: hidden; font-family: 'Inter', sans-serif; background: #F8FAFC;">
      <div class="cms-tenant-info-container" style="display:flex; flex-direction:column; gap:24px; padding:24px; overflow-y:auto; height:100%; box-sizing:border-box;">
        
        <!-- Header Card -->
        <div style="background: linear-gradient(135deg, #1E3A8A, #3B82F6); color: white; padding: 24px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);">
          <div>
            <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #93C5FD; margin-bottom: 4px;">${currentPlanLabel}</div>
            <h1 style="font-size: 26px; font-weight: 800; margin: 0; display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
              ${escapeHTML(record.plan_name || planDefaultName)}
              <span style="font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 9999px; background: rgba(255,255,255,0.2); color: #fff; text-transform: uppercase;">
                ${escapeHTML(record.subscription_status || 'Active')}
              </span>
              <span style="font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 9999px; background: rgba(255,255,255,0.25); color: #fff; text-transform: uppercase; display: inline-flex; align-items: center; gap: 4px;">
                <span class="material-symbols-rounded" style="font-size: 14px;">payments</span>
                ${typeof t === 'function' ? t('col.base_currency', 'Tiền tệ cơ sở') : 'Tiền tệ cơ sở'}: <strong>${escapeHTML(record.base_currency || 'VND')}</strong>
              </span>
            </h1>
            <div style="font-size: 13px; margin-top: 8px; color: #E0F2FE;">
              ${nextPaymentLabel}: <strong>${record.next_payment_date ? formatDate(record.next_payment_date) : unknownLabel}</strong>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap;">
            <div style="text-align: right;">
              <div style="font-size: 28px; font-weight: 800;">${formatNumber(parseFloat(record.last_billing_amount || 0))} ${escapeHTML(record.base_currency || 'VND')}</div>
              <div style="font-size: 11px; color: #93C5FD; font-weight: 600; text-transform: uppercase;">${billingCycleLabel}: ${escapeHTML(record.billing_status || 'Tháng')}</div>
            </div>
            ${isSuperAdmin ? `
              <button class="btn btn-sm" onclick="openEditModal('cms_tenant_info', ${record.id})" style="background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.4); color: white; padding: 8px 14px; border-radius: 8px; font-weight: 700; font-size: 12px; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; transition: all 0.2s;">
                <span class="material-symbols-rounded" style="font-size: 16px;">edit</span>
                <span>${typeof t === 'function' ? t('btn.edit', 'Chỉnh sửa') : 'Chỉnh sửa'}</span>
              </button>
            ` : ''}
          </div>
        </div>

        <!-- Resource Usage Grid -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">
          
          <!-- User Seats -->
          <div class="card" style="background:#fff; border:1px solid #E5E7EB; border-radius:12px; padding:20px; display:flex; flex-direction:column; gap:12px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="font-weight:700; color:#334155; font-size:14px; display:flex; align-items:center; gap:8px;">
                <span class="material-symbols-rounded" style="color:#3B82F6; font-size:18px;">key</span>
                ${userSeatsLabel}
              </span>
              <span id="seat-badge" style="font-weight:800; color:#0F172A; font-size:13px;">${loadingLabel}</span>
            </div>
            <div style="height:8px; background:#F1F5F9; border-radius:4px; overflow:hidden;">
              <div id="seat-progress" style="height:100%; width:0%; background:#3B82F6; transition:width 0.4s ease, background-color 0.3s;"></div>
            </div>
            <div id="seat-warning" style="font-size:12px; color:#64748B;">
              ${loadingLabel}
            </div>
          </div>

          <!-- Employee Scale -->
          <div class="card" style="background:#fff; border:1px solid #E5E7EB; border-radius:12px; padding:20px; display:flex; flex-direction:column; gap:12px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="font-weight:700; color:#334155; font-size:14px; display:flex; align-items:center; gap:8px;">
                <span class="material-symbols-rounded" style="color:#10B981; font-size:18px;">groups</span>
                ${empScaleLabel}
              </span>
              <span id="employee-badge" style="font-weight:800; color:#0F172A; font-size:13px;">${loadingLabel}</span>
            </div>
            <div style="height:8px; background:#F1F5F9; border-radius:4px; overflow:hidden;">
              <div id="employee-progress" style="height:100%; width:0%; background:#10B981; transition:width 0.4s ease, background-color 0.3s;"></div>
            </div>
            <div id="employee-warning" style="font-size:12px; color:#64748B;">
              ${loadingLabel}
            </div>
          </div>

          <!-- Storage Size -->
          <div class="card" style="background:#fff; border:1px solid #E5E7EB; border-radius:12px; padding:20px; display:flex; flex-direction:column; gap:12px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="font-weight:700; color:#334155; font-size:14px; display:flex; align-items:center; gap:8px;">
                <span class="material-symbols-rounded" style="color:#F59E0B; font-size:18px;">database</span>
                ${storageLabel}
              </span>
              <span id="storage-badge" style="font-weight:800; color:#0F172A; font-size:13px;">${loadingLabel}</span>
            </div>
            <div style="height:8px; background:#F1F5F9; border-radius:4px; overflow:hidden;">
              <div id="storage-progress" style="height:100%; width:0%; background:#F59E0B; transition:width 0.4s ease, background-color 0.3s;"></div>
            </div>
            <div id="storage-warning" style="font-size:12px; color:#64748B;">
              ${loadingLabel}
            </div>
          </div>

          <!-- Base Currency -->
          <div class="card" style="background:#fff; border:1px solid #E5E7EB; border-radius:12px; padding:20px; display:flex; flex-direction:column; gap:12px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="font-weight:700; color:#334155; font-size:14px; display:flex; align-items:center; gap:8px;">
                <span class="material-symbols-rounded" style="color:#0EA5E9; font-size:18px;">currency_exchange</span>
                ${typeof t === 'function' ? t('col.base_currency', 'Tiền tệ cơ sở') : 'Tiền tệ cơ sở'}
              </span>
              <span id="tenant-base-currency-badge" style="font-weight:800; color:#0F172A; font-size:14px; background:#F0FDF4; color:#15803D; padding:4px 10px; border-radius:6px; border:1px solid #BBF7D0;">
                ${escapeHTML(record.base_currency || 'VND')}
              </span>
            </div>
            <div style="font-size:12px; color:#64748B; line-height: 1.4;">
              ${typeof t === 'function' ? t('subscription.base_currency_desc', 'Đồng tiền cơ sở đăng ký áp dụng cho toàn bộ quy đổi tài chính và báo cáo trong hệ thống.') : 'Đồng tiền cơ sở đăng ký áp dụng cho toàn bộ quy đổi tài chính và báo cáo trong hệ thống.'}
            </div>
            ${isSuperAdmin ? `
              <div style="margin-top:auto; padding-top:4px;">
                <button class="btn btn-sm" onclick="openEditModal('cms_tenant_info', ${record.id})" style="width:100%; font-size:12px; padding:6px 12px; border-radius:6px; background:#F8FAFC; border:1px solid #CBD5E1; color:#1E293B; font-weight:600; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px;">
                  <span class="material-symbols-rounded" style="font-size:16px;">edit</span>
                  ${typeof t === 'function' ? t('btn.edit_base_currency', 'Sửa Tiền tệ cơ sở') : 'Sửa Tiền tệ cơ sở'}
                </button>
              </div>
            ` : ''}
          </div>

        </div>

        <!-- Detailed Plan Features -->
        <div class="card" style="background:#fff; border:1px solid #E5E7EB; border-radius:12px; padding:24px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
          <h2 style="font-size:16px; font-weight:800; margin:0 0 16px; color:#1E293B; border-bottom:1px solid #F1F5F9; padding-bottom:12px; display:flex; align-items:center; gap:8px;">
            <span class="material-symbols-rounded" style="color:#6366F1;">verified</span>
            ${featuresLabel}
          </h2>
          
          <div id="features-list-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:16px;">
            <div style="color:#64748B; font-style:italic;">${loadingLabel}</div>
          </div>
        </div>

      </div>
    </div>
  `;
}

async function loadTenantStatusStats() {
  try {
    const status = await apiGet('/system-status');

    // 1. Update Seats
    const seatsCount = status.activeUsers.count;
    const seatsLimit = status.activeUsers.limit;
    const seatsPercent = Math.min(status.activeUsers.percentage, 100);
    const seatsBadge = document.getElementById('seat-badge');
    const seatsBar = document.getElementById('seat-progress');
    const seatsWarn = document.getElementById('seat-warning');

    if (seatsBadge) {
      const accountsText = typeof t === 'function' ? t('nav.account', 'tài khoản') : 'tài khoản';
      const unlimitedText = typeof t === 'function' ? t('seat.unlimited', 'Không giới hạn') : 'Không giới hạn';
      seatsBadge.textContent = seatsLimit > 0 ? `${seatsCount} / ${seatsLimit} ${accountsText}` : `${seatsCount} / ${unlimitedText}`;
    }
    if (seatsBar) {
      seatsBar.style.width = `${seatsLimit > 0 ? seatsPercent : 10}%`;
      if (seatsLimit > 0 && seatsPercent >= 100) seatsBar.style.backgroundColor = '#EF4444';
      else if (seatsLimit > 0 && seatsPercent >= 90) seatsBar.style.backgroundColor = '#F59E0B';
      else seatsBar.style.backgroundColor = '#3B82F6';
    }
    if (seatsWarn) {
      const userList = status.activeUsers.list || [];
      const viewListText = typeof t === 'function' ? t('seat.user_seats_title', 'Xem danh sách tài khoản') : 'Xem danh sách tài khoản';
      const deactivateBtnText = typeof t === 'function' ? t('seat.deactivate_action', 'Tắt App') : 'Tắt App';
      const statusActiveText = typeof t === 'function' ? t('seat.status_active', 'Active') : 'Active';

      const userListHTML = userList.length > 0 ? `
        <details style="margin-top: 8px; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 8px;">
          <summary style="font-size: 11px; font-weight: 600; color: #475569; cursor: pointer; display: flex; align-items: center; gap: 4px; user-select: none;">
            <span class="material-symbols-rounded" style="font-size: 15px;">list</span>
            ${viewListText} (${userList.length})
          </summary>
          <div style="margin-top: 8px; display: flex; flex-direction: column; gap: 6px; max-height: 120px; overflow-y: auto; font-size: 11px;">
            ${userList.map(u => `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 8px; background: #fff; border: 1px solid #F1F5F9; border-radius: 6px; gap: 8px;">
                <div style="text-align: left; flex: 1; min-width: 0;">
                  <strong style="color: #1E293B; font-size: 12px; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHTML(u.full_name || u.username)}</strong>
                  <div style="color: #64748B; font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHTML(u.email || '')} | ${escapeHTML(u.role || '')}</div>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                  <button class="btn btn-sm" onclick="deactivateSeatUser('${u.employee_id}', '${escapeHTML(u.full_name || u.username).replace(/'/g, "\\'")}')" style="font-size: 10px; padding: 3px 6px; border-radius: 4px; border: 1px solid #EF4444; color: #EF4444; background: transparent; cursor: pointer; font-weight: 600; display: inline-flex; align-items: center; gap: 2px;">
                    <span class="material-symbols-rounded" style="font-size: 12px;">person_off</span> ${deactivateBtnText}
                  </button>
                  <span style="font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 9999px; background: #E0F2FE; color: #0369A1; text-transform: uppercase; white-space: nowrap;">
                    ${statusActiveText}
                  </span>
                </div>
              </div>
            `).join('')}
          </div>
        </details>
      ` : '';

      if (seatsLimit > 0 && seatsCount >= seatsLimit) {
        const warnLimitExceeded = typeof t === 'function' ? t('employee.error.seat_limit_exceeded', '⚠️ Đã đạt giới hạn tài khoản đăng nhập của gói.') : '⚠️ Đã đạt giới hạn tài khoản đăng nhập của gói.';
        seatsWarn.innerHTML = `
          <span style="color:#EF4444; font-weight:600;">${warnLimitExceeded}</span>
          ${userListHTML}
        `;
      } else if (seatsLimit > 0 && seatsPercent >= 90) {
        const warnNearLimit = typeof t === 'function' ? t('seat.usage_percent_warn', '⚠️ Đã dùng hết {{percent}}% số lượng tài khoản cho phép.').replace('{{percent}}', seatsPercent.toFixed(0)) : `⚠️ Đã dùng hết ${seatsPercent.toFixed(0)}% số lượng tài khoản cho phép.`;
        seatsWarn.innerHTML = `
          <span style="color:#F59E0B; font-weight:600;">${warnNearLimit}</span>
          ${userListHTML}
        `;
      } else {
        const descText = typeof t === 'function' ? t('seat.used_desc', 'Chỉ các tài khoản được bật "Đăng nhập app" mới được tính là 1 seat sử dụng.') : 'Chỉ các tài khoản được bật "Đăng nhập app" mới được tính là 1 seat sử dụng.';
        seatsWarn.innerHTML = `
          <span>${descText}</span>
          ${userListHTML}
        `;
      }
    }

    // 2. Update Employee Scale
    const empCount = status.employees.count;
    const empLimit = status.employees.limit;
    const empPercent = Math.min(status.employees.percentage, 100);
    const empBadge = document.getElementById('employee-badge');
    const empBar = document.getElementById('employee-progress');
    const empWarn = document.getElementById('employee-warning');

    if (empBadge) {
      const empLabelText = typeof t === 'function' ? t('nav.employee', 'nhân sự') : 'nhân sự';
      const unlimitedText = typeof t === 'function' ? t('seat.unlimited', 'Không giới hạn') : 'Không giới hạn';
      empBadge.textContent = empLimit > 0 ? `${empCount} / ${empLimit} ${empLabelText}` : `${empCount} / ${unlimitedText}`;
    }
    if (empBar) {
      empBar.style.width = `${empLimit > 0 ? empPercent : 10}%`;
      if (empLimit > 0 && empPercent >= 100) empBar.style.backgroundColor = '#EF4444';
      else if (empLimit > 0 && empPercent >= 90) empBar.style.backgroundColor = '#F59E0B';
      else empBar.style.backgroundColor = '#10B981';
    }
    if (empWarn) {
      if (empLimit > 0 && empCount >= empLimit) {
        const warnExceeded = typeof t === 'function' ? t('employee.error.scale_limit_exceeded', '⚠️ Đã đạt giới hạn quy mô nhân sự của gói dịch vụ.') : '⚠️ Đã đạt giới hạn quy mô nhân sự của gói dịch vụ.';
        empWarn.innerHTML = `<span style="color:#EF4444; font-weight:600;">${warnExceeded}</span>`;
      } else if (empLimit > 0 && empPercent >= 90) {
        const warnNearLimit = typeof t === 'function' ? t('employee.scale_percent_warn', '⚠️ Quy mô nhân sự đã đạt {{percent}}% giới hạn gói.').replace('{{percent}}', empPercent.toFixed(0)) : `⚠️ Quy mô nhân sự đã đạt ${empPercent.toFixed(0)}% giới hạn gói.`;
        empWarn.innerHTML = `<span style="color:#F59E0B; font-weight:600;">${warnNearLimit}</span>`;
      } else {
        const descText = typeof t === 'function' ? t('employee.scale_desc', 'Tổng quy mô hồ sơ nhân sự (đang hoạt động) được tạo trong cơ sở dữ liệu.') : 'Tổng quy mô hồ sơ nhân sự (đang hoạt động) được tạo trong cơ sở dữ liệu.';
        empWarn.textContent = descText;
      }
    }

    // 3. Update Storage
    const storageUsed = status.storage.usedBytes;
    const storageLimit = status.storage.limitBytes;
    const storageLimitGb = status.storage.limitGb;
    const storagePercent = Math.min(status.storage.percentage, 100);
    const storageBadge = document.getElementById('storage-badge');
    const storageBar = document.getElementById('storage-progress');
    const storageWarn = document.getElementById('storage-warning');

    const formatBytes = (bytes) => {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    if (storageBadge) {
      storageBadge.textContent = storageLimitGb > 0 ? `${formatBytes(storageUsed)} / ${storageLimitGb} GB` : `${formatBytes(storageUsed)} / Theo yêu cầu`;
    }
    if (storageBar) {
      storageBar.style.width = `${storageLimitGb > 0 ? storagePercent : 10}%`;
      if (storageLimitGb > 0 && storagePercent >= 100) storageBar.style.backgroundColor = '#EF4444';
      else if (storageLimitGb > 0 && storagePercent >= 90) storageBar.style.backgroundColor = '#F59E0B';
      else storageBar.style.backgroundColor = '#F59E0B';
    }
    if (storageWarn) {
      const dbStr = formatBytes(status.storage.dbBytes);
      const uploadStr = formatBytes(status.storage.uploadsBytes);
      const codeStr = formatBytes(status.storage.codeBytes || 0);

      const cleanupTitle = typeof t === 'function' ? t('seat.cleanup_title', 'Dọn dẹp lịch sử hoạt động (Audit Logs)') : 'Dọn dẹp lịch sử hoạt động (Audit Logs)';
      const cleanupFrom = typeof t === 'function' ? t('seat.cleanup_from', 'Từ ngày:') : 'Từ ngày:';
      const cleanupTo = typeof t === 'function' ? t('seat.cleanup_to', 'Đến ngày:') : 'Đến ngày:';
      const cleanupExecute = typeof t === 'function' ? t('seat.cleanup_execute', 'Thực hiện xóa') : 'Thực hiện xóa';
      const cleanupNote = typeof t === 'function' ? t('seat.cleanup_note', '* Để trống cả hai ô ngày nếu muốn xóa sạch toàn bộ lịch sử hệ thống (Truncate).') : '* Để trống cả hai ô ngày nếu muốn xóa sạch toàn bộ lịch sử hệ thống (Truncate).';

      const cleanupButtonHTML = `
        <div style="margin-top: 12px; background: #FFF5F5; border: 1px solid #FCA5A5; border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 8px; text-align: left;">
          <div style="font-weight: 700; color: #DC2626; font-size: 12px; display: flex; align-items: center; gap: 4px;">
            <span class="material-symbols-rounded" style="font-size: 16px; color: #DC2626;">delete_sweep</span>
            ${cleanupTitle}
          </div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
            <div style="display: flex; align-items: center; gap: 4px; font-size: 11px; color: #475569;">
              <span>${cleanupFrom}</span>
              <input type="date" id="cleanup-start-date" style="padding: 4px 8px; border: 1px solid #D1D5DB; border-radius: 4px; font-size: 11px; font-family: inherit;" />
            </div>
            <div style="display: flex; align-items: center; gap: 4px; font-size: 11px; color: #475569;">
              <span>${cleanupTo}</span>
              <input type="date" id="cleanup-end-date" style="padding: 4px 8px; border: 1px solid #D1D5DB; border-radius: 4px; font-size: 11px; font-family: inherit;" />
            </div>
            <button class="btn btn-sm" onclick="executeCleanupLogs()" style="font-size: 11px; padding: 5px 12px; border-radius: 4px; border: none; background: #DC2626; color: #FFF; font-weight: 600; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; gap: 4px;">
              ${cleanupExecute}
            </button>
          </div>
          <div style="font-size: 10px; color: #991B1B; font-style: italic;">${cleanupNote}</div>
        </div>
      `;

      if (storageLimitGb > 0 && storageUsed >= storageLimit) {
        const warnFull = typeof t === 'function' ? t('storage.full_warning', '⚠️ Bộ nhớ đã đầy ({{percent}}%). Vui lòng dọn dẹp hoặc nâng cấp gói.').replace('{{percent}}', storagePercent.toFixed(0)) : `⚠️ Bộ nhớ đã đầy (${storagePercent.toFixed(0)}%). Vui lòng dọn dẹp hoặc nâng cấp gói.`;
        storageWarn.innerHTML = `
          <span style="color:#EF4444; font-weight:600;">${warnFull}</span><br/>
          <span style="font-size:11px; color:#475569;">CSDL: ${dbStr} | File: ${uploadStr} | Mã nguồn: ${codeStr}</span>
          ${cleanupButtonHTML}
        `;
      } else if (storageLimitGb > 0 && storagePercent >= 80) {
        const warnNearFull = typeof t === 'function' ? t('storage.near_full_warning', '⚠️ Bộ nhớ sắp đầy ({{percent}}%).').replace('{{percent}}', storagePercent.toFixed(0)) : `⚠️ Bộ nhớ sắp đầy (${storagePercent.toFixed(0)}%).`;
        storageWarn.innerHTML = `
          <span style="color:#F59E0B; font-weight:600;">${warnNearFull}</span><br/>
          <span style="font-size:11px; color:#475569;">CSDL: ${dbStr} | File: ${uploadStr} | Mã nguồn: ${codeStr}</span>
          ${cleanupButtonHTML}
        `;
      } else {
        const descText = typeof t === 'function' ? t('storage.used_breakdown', 'Dung lượng đã dùng: CSDL: <strong>{{dbStr}}</strong> | File: <strong>{{uploadStr}}</strong> | Code: <strong>{{codeStr}}</strong>').replace('{{dbStr}}', dbStr).replace('{{uploadStr}}', uploadStr).replace('{{codeStr}}', codeStr) : `Dung lượng đã dùng: CSDL: <strong>${dbStr}</strong> | File: <strong>${uploadStr}</strong> | Code: <strong>${codeStr}</strong>`;
        storageWarn.innerHTML = `
          ${descText}
          ${cleanupButtonHTML}
        `;
      }
    }

    // 4. Render Plan Features list
    const features = status.features || {};
    const featuresListGrid = document.getElementById('features-list-grid');
    if (featuresListGrid) {
      const renderFeatureItem = (icon, titleKey, defaultTitle, value) => {
        const title = typeof t === 'function' ? t(titleKey, defaultTitle) : defaultTitle;
        return `
          <div style="display:flex; align-items:center; gap:12px; background:#F8FAFC; border:1px solid #F1F5F9; border-radius:8px; padding:12px;">
            <span class="material-symbols-rounded" style="color:#6366F1; font-size:20px;">${icon}</span>
            <div>
              <div style="font-size:11px; font-weight:600; color:#64748B; text-transform:uppercase;">${title}</div>
              <div style="font-size:13px; font-weight:700; color:#1E293B; margin-top:2px;">${value}</div>
            </div>
          </div>
        `;
      };

      const yesVal = typeof t === 'function' ? t('seat.feature.supported', '✅ Hỗ trợ') : '✅ Hỗ trợ';
      const noVal = typeof t === 'function' ? t('seat.feature.not_supported', '❌ Không hỗ trợ') : '❌ Không hỗ trợ';
      const noneText = typeof t === 'function' ? t('seat.feature.none', 'Không') : 'Không';

      const items = [];
      items.push(renderFeatureItem('security', 'seat.feature.sso', 'Đăng nhập một lần (SSO)', features.sso ? yesVal : noVal));
      items.push(renderFeatureItem('phone_iphone', 'seat.feature.mobile_app', 'Mobile App', features.mobile_app ? yesVal : noVal));
      items.push(renderFeatureItem('psychology', 'seat.feature.ai', 'Tích hợp Trí tuệ nhân tạo (AI)', features.ai_integration ? yesVal : noVal));
      items.push(renderFeatureItem('cloud_download', 'seat.feature.backup', 'Sao lưu dữ liệu tự động', features.backup || noneText));
      items.push(renderFeatureItem('support_agent', 'seat.feature.support', 'Hỗ trợ kỹ thuật', features.tech_support || 'Support Portal'));
      items.push(renderFeatureItem('speed', 'seat.feature.sla', 'Mức độ sẵn sàng hệ thống (SLA)', features.sla || 'Best Effort'));
      items.push(renderFeatureItem('palette', 'seat.feature.branding', 'Thương hiệu riêng (Custom Branding)', features.custom_branding ? yesVal : noVal));
      items.push(renderFeatureItem('history', 'seat.feature.audit_log', 'Xem lịch sử hoạt động (Audit log)', features.audit_log || noneText));
      items.push(renderFeatureItem('export_notes', 'seat.feature.export', 'Xuất file báo cáo (Data Export)', features.data_export || 'CSV'));
      items.push(renderFeatureItem('school', 'seat.feature.training', 'Đào tạo & Hướng dẫn sử dụng', features.training || 'Self-learning'));

      const configDaysVal = features.free_custom_config_mandays
        ? (typeof t === 'function' ? t('seat.feature.days_per_year', '{{days}} ngày/năm').replace('{{days}}', features.free_custom_config_mandays) : `${features.free_custom_config_mandays} ngày/năm`)
        : noneText;
      items.push(renderFeatureItem('build', 'seat.feature.config_days', 'Hạn mức cấu hình miễn phí', configDaysVal));

      featuresListGrid.innerHTML = items.join('');
    }
  } catch (e) {
    console.error('Failed to load tenant status stats:', e);
  }
}

async function executeCleanupLogs() {
  const startDate = document.getElementById('cleanup-start-date').value;
  const endDate = document.getElementById('cleanup-end-date').value;

  let confirmMsg = '';
  if (startDate && endDate) {
    const tpl = typeof t === 'function' ? t('seat.cleanup_confirm_range', 'Bạn có chắc chắn muốn xóa lịch sử hoạt động (Audit Logs) từ ngày {{start}} đến ngày {{end}}?') : 'Bạn có chắc chắn muốn xóa lịch sử hoạt động (Audit Logs) từ ngày {{start}} đến ngày {{end}}?';
    confirmMsg = tpl.replace('{{start}}', startDate).replace('{{end}}', endDate);
  } else if (startDate) {
    const tpl = typeof t === 'function' ? t('seat.cleanup_confirm_start', 'Bạn có chắc chắn muốn xóa lịch sử hoạt động (Audit Logs) từ ngày {{start}} trở đi?') : 'Bạn có chắc chắn muốn xóa lịch sử hoạt động (Audit Logs) từ ngày {{start}} trở đi?';
    confirmMsg = tpl.replace('{{start}}', startDate);
  } else if (endDate) {
    const tpl = typeof t === 'function' ? t('seat.cleanup_confirm_end', 'Bạn có chắc chắn muốn xóa lịch sử hoạt động (Audit Logs) đến ngày {{end}}?') : 'Bạn có chắc chắn muốn xóa lịch sử hoạt động (Audit Logs) đến ngày {{end}}?';
    confirmMsg = tpl.replace('{{end}}', endDate);
  } else {
    confirmMsg = typeof t === 'function' ? t('seat.cleanup_confirm_all', 'Bạn có chắc chắn muốn xóa lịch sử hoạt động (Audit Logs) TOÀN BỘ hệ thống (Hành động này sẽ làm sạch hoàn toàn bảng)?') : 'Bạn có chắc chắn muốn xóa lịch sử hoạt động (Audit Logs) TOÀN BỘ hệ thống (Hành động này sẽ làm sạch hoàn toàn bảng)?';
  }

  const warningSuffix = typeof t === 'function' ? t('seat.cleanup_confirm_warning', '\nHành động này không thể hoàn tác.') : '\nHành động này không thể hoàn tác.';
  if (confirm(confirmMsg + warningSuffix)) {
    try {
      const res = await apiPost('/system-status/cleanup-logs', { startDate, endDate });
      if (res && res.success) {
        const successMsg = typeof t === 'function' ? t('seat.cleanup_success', 'Đã dọn dẹp lịch sử hoạt động thành công.') : 'Đã dọn dẹp lịch sử hoạt động thành công.';
        showToast(successMsg, 'success');
        loadTenantStatusStats(); // Reload statistics
      } else {
        const failedMsg = typeof t === 'function' ? t('seat.cleanup_failed', 'Dọn dẹp thất bại') : 'Dọn dẹp thất bại';
        showToast(res.error || failedMsg, 'error');
      }
    } catch (e) {
      showToast(e.message || 'Lỗi kết nối hệ thống', 'error');
    }
  }
}
window.executeCleanupLogs = executeCleanupLogs;

async function deactivateSeatUser(empId, name) {
  const confirmTpl = typeof t === 'function' ? t('seat.deactivate_confirm', 'Bạn có chắc chắn muốn hủy kích hoạt (Tắt App) cho nhân viên "{{name}}" không?') : 'Bạn có chắc chắn muốn hủy kích hoạt (Tắt App) cho nhân viên "{{name}}" không?';
  const confirmMsg = confirmTpl.replace('{{name}}', name);
  if (confirm(confirmMsg)) {
    try {
      const res = await apiPost(`/employees/${empId}/deactivate`);
      if (res && res.success) {
        const successMsg = typeof t === 'function' ? t('seat.deactivate_success', 'Đã hủy kích hoạt tài khoản thành công.') : 'Đã hủy kích hoạt tài khoản thành công.';
        showToast(successMsg, 'success');
        loadTenantStatusStats(); // Reload statistics
      } else {
        showToast(res.error || 'Thực hiện thất bại', 'error');
      }
    } catch (e) {
      showToast(e.message || 'Lỗi kết nối hệ thống', 'error');
    }
  }
}
window.deactivateSeatUser = deactivateSeatUser;

function buildDetailViewHTML(moduleKey, record) {
  if (moduleKey === 'cms_tenant_info') {
    return buildCmsTenantInfoDetailHTML(record);
  }
  let activeViewName = moduleKey;
  const hashParts = window.location.hash.replace('#', '').split('/');
  const prefix = hashParts[0];
  if (['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(prefix)) {
    activeViewName = prefix;
  }

  const mod = MODULES[moduleKey];
  const pkVal = record[mod.pk];

  const resolvedRecord = { ...record };
  if (mod.columns) mod.columns.forEach(c => resolvedRecord[c.key] = resolveLookupValue(moduleKey, c.key, record[c.key]));
  if (mod.fields) mod.fields.forEach(c => { if (c.key) resolvedRecord[c.key] = resolveLookupValue(moduleKey, c.key, record[c.key]); });
  if (mod.detailFields) mod.detailFields.forEach(c => { if (c.key) resolvedRecord[c.key] = resolveLookupValue(moduleKey, c.key, record[c.key]); });
  if ((moduleKey === 'employee' || moduleKey === 'employee_active') && !resolvedRecord.bank_info) {
    const parts = [resolvedRecord.bank_name, resolvedRecord.bank_account, resolvedRecord.bank_city].filter(v => v && String(v).trim());
    if (parts.length > 0) {
      resolvedRecord.bank_info = parts.join(' - ');
    }
  }

  const displayName = mod.displayName ? mod.displayName(resolvedRecord) : pkVal;
  const hasSidebar = mod.children && (mod.children.includes('comment') || mod.children.includes('ticket_comment'));

  // All modules use Detail View 2 — legacy view removed
  if (true) {
    const getBadgeClass = (statusVal) => {
      const s = String(statusVal).toLowerCase();
      if (['active', 'approved', 'completed', 'ready for payment', 'ready to issue', 'issued', 'paid', 'yes', 'true', 'success'].includes(s)) return 'badge-active';
      if (['inactive', 'resigned', 'rejected', 'cancelled', 'failed', 'no', 'false', 'void'].includes(s)) return 'badge-inactive';
      return 'badge-blue';
    };

    const getBadgeStyles = window.getBadgeStyles;

    // Dynamically build Header Title
    let headerTitle = '';
    const parentKeyNormalized = ['request', 'my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(activeViewName) ? 'request' : activeViewName;

    if (parentKeyNormalized === 'request') {
      headerTitle = window.formatRequestLabel ? window.formatRequestLabel(record) : (record.description || window.getFormattedRequestCode(record) || 'Request');
    } else if (parentKeyNormalized === 'payment') {
      headerTitle = window.formatPaymentLabel ? window.formatPaymentLabel(record) : (record.payment_description || 'Payment');

    } else if (parentKeyNormalized === 'service') {
      const serviceName = record.service_name || '';
      const serviceType = record.service_type || 'Service';
      headerTitle = serviceName ? `${serviceType} | ${serviceName}` : serviceType;
    } else if (parentKeyNormalized === 'asset') {
      const assetName = record.asset_name || '';
      const assetType = record.type || 'Asset';
      headerTitle = assetName ? `${assetType} | ${assetName}` : assetType;
    } else if (parentKeyNormalized === 'expense') {
      const type = resolvedRecord.id__expense_type || 'Expense';
      const desc = record.description || '';
      headerTitle = desc ? `${type} | ${desc}` : type;
    } else if (parentKeyNormalized === 'employee') {
      headerTitle = record.full_name || 'Employee';
    } else if (parentKeyNormalized === 'account') {
      headerTitle = record.account_name || record.account_number || 'Account';
    } else if (parentKeyNormalized === 'department') {
      headerTitle = record.department_label || displayName || 'Department';
    } else {
      headerTitle = displayName || 'Detail';
    }

    // Dynamically build Status Grid
    let statusGridHTML = '';
    const buildStatusColumn = (label, val, customColor) => {
      let labelKey = '';
      if (label === 'Status') labelKey = 'col.status';
      else if (label === 'Process') labelKey = 'col.process_status';
      else if (label === 'Process Status') labelKey = 'col.process_status';
      else if (label === 'Payment Status') labelKey = 'col.payment_status';
      else if (label === 'Account Status') labelKey = 'col.account_status';
      else if (label === 'Action') labelKey = 'col.action';
      else labelKey = 'col.' + String(label).toLowerCase().replace(/\s+/g, '_');

      const translatedLabel = typeof t === 'function' ? t(labelKey, label) : label;
      const translatedVal = typeof t_val === 'function' ? t_val(val) : val;

      return `
        <div style="font-size:10px; display: flex; flex-direction: column; justify-content: space-between; gap: 4px; align-items: center; flex: 1; min-width: 0; text-align: center;">
          <span style="color: #6B7280; font-size:9px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%;">${translatedLabel}</span>
          <span style="display:inline-flex; align-items:center; justify-content:center; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; margin-top: 2px; ${getBadgeStyles(val, customColor)}">${escapeHTML(translatedVal)}</span>
        </div>
      `;
    };

    if (['request', 'my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(activeViewName)) {
      const cols = [
        buildStatusColumn('Status', record.sr_status_key || record.sr_status || 'Draft', record.sr_status_color),
        buildStatusColumn('Process', record.process_status_key || record.process_status || 'Not started yet', record.process_status_color)
      ];

      statusGridHTML = `
        <div style="display: flex; justify-content: space-between; align-items: stretch; gap: 8px; width: 100%; border: 1px solid #E5E7EB; border-radius: 8px; padding: 12px 16px; background: #F8FAFC;">
          ${cols.join('<div style="width: 1px; background: #E5E7EB; margin: 0 8px;"></div>')}
        </div>
      `;
    } else if (activeViewName === 'support') {
      const processLabel = (typeof t === 'function') ? t('col.process_status', 'Process Status') : 'Process Status';
      const cols = [
        buildStatusColumn(processLabel, record.process_status_key || record.process_status || 'Processing', record.process_status_color)
      ];
      statusGridHTML = `
        <div style="display: flex; justify-content: space-between; align-items: stretch; gap: 8px; width: 100%; border: 1px solid #E5E7EB; border-radius: 8px; padding: 12px 16px; background: #F8FAFC;">
          ${cols.join('')}
        </div>
      `;
    } else if (activeViewName === 'payment') {
      const cols = [
        buildStatusColumn('Payment Status', record.payment_status_key || record.payment_status || 'Pending', record.payment_status_color)
      ];
      statusGridHTML = `
        <div style="display: flex; justify-content: space-between; align-items: stretch; gap: 8px; width: 100%; border: 1px solid #E5E7EB; border-radius: 8px; padding: 12px 16px; background: #F8FAFC;">
          ${cols.join('')}
        </div>
      `;
    } else if (activeViewName === 'expense') {
      const costVal = resolvedRecord.id__expense_cost || 'Unassigned';
      const typeVal = resolvedRecord.id__expense_type || 'General';
      const cols = [
        buildStatusColumn('Expense Cost', costVal),
        buildStatusColumn('Expense Type', typeVal)
      ];
      statusGridHTML = `
        <div style="display: flex; justify-content: space-between; align-items: stretch; gap: 8px; width: 100%; border: 1px solid #E5E7EB; border-radius: 8px; padding: 12px 16px; background: #F8FAFC;">
          ${cols.join('<div style="width: 1px; background: #E5E7EB; margin: 0 8px;"></div>')}
        </div>
      `;
    } else {
      let statusVal = record.status_key || record.status || record.account_status_key || record.account_status || record.payment_status_key || record.payment_status || 'Active';
      let customColor = record.status_color || record.account_status_color || record.payment_status_color || null;
      let label = 'Status';
      if (activeViewName === 'account') {
        statusVal = record.account_status_key || record.account_status || 'Open';
        customColor = record.account_status_color || null;
        label = 'Account Status';
      } else if (activeViewName === 'request_activity_log') {
        statusVal = record.action || 'Logged';
        label = 'Action';
      }
      statusGridHTML = `
        <div style="display: flex; justify-content: space-between; align-items: stretch; gap: 8px; width: 100%; border: 1px solid #E5E7EB; border-radius: 8px; padding: 12px 16px; background: #F8FAFC;">
          ${buildStatusColumn(label, statusVal, customColor)}
        </div>
      `;
    }

    const requestDetailViews = ['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'];
    const detailProcessStatus = Number(record.process_status);
    const canShowDetailChildren = !requestDetailViews.includes(activeViewName) ||
      [8, 9].includes(detailProcessStatus) || ['processing', 'completed'].includes(String(record.process_status || '').toLowerCase());

    const modHasRealChildren = hasModuleRealChildren(moduleKey, pkVal, mod);
    const allChildren = [];

    if (modHasRealChildren || hasSidebar) {
      if (moduleKey === 'target_table') {
        allChildren.push('target_records');
      }
      if (hasSidebar && pkVal !== 'VIRTUAL_OPPORTUNITY') {
        if (mod.children && mod.children.includes('ticket_comment')) allChildren.push('ticket_comment');
        else allChildren.push('comment');
      }
      if (record && record.is_support) {
        if (!allChildren.includes('logs')) allChildren.push('logs');
      } else {
        let childrenToPush = [];
        if (mod.children) {
          childrenToPush = mod.children.filter(k => k !== 'comment' && k !== 'ticket_comment');
        }
        if (!childrenToPush.includes('logs')) {
          childrenToPush.push('logs');
        }
        const pStatus = Number(record.process_status);
        const isStatusAllowed = [8, 9].includes(pStatus) || ['processing', 'completed'].includes(String(record.process_status || '').toLowerCase());

        let elementsVal = record.elements || record.policy_elements;
        if (!elementsVal) {
          const policy = (selectCache['policy'] || []).find(p => String(p.policy_id) === String(record.request_type));
          if (policy) {
            elementsVal = policy.elements;
          }
        }

        let activeElements = [];
        if (elementsVal) {
          if (Array.isArray(elementsVal)) {
            activeElements = elementsVal.map(s => String(s).replace(/^\[|\]$/g, '').trim().toUpperCase());
          } else if (typeof elementsVal === 'string') {
            activeElements = elementsVal.split(',').map(s => s.trim().replace(/^\[|\]$/g, '').toUpperCase()).filter(Boolean);
          }
        }

        childrenToPush = childrenToPush.filter(childKey => {
          if (childKey === 'logs') return true;
          if (childKey !== 'target_table' && !canShowDetailChildren) return false;

          const isRequest = ['request', 'my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(moduleKey);
          if (isRequest) {
            if (childKey === 'payment') return activeElements.includes('PAYMENT') || activeElements.includes('CONTRACT');
            if (childKey === 'expense') return activeElements.includes('EXPENSE');
            if (childKey === 'service') return activeElements.includes('SERVICE');
            if (childKey === 'asset') return activeElements.includes('ASSET');
            if (childKey === 'contract') return activeElements.includes('CONTRACT');
            if (childKey === 'invoice') return activeElements.includes('INVOICE') || activeElements.includes('CONTRACT');
            if (childKey === 'target_table') return activeElements.includes('TARGET TABLE');
          }
          return true;
        });
        allChildren.push(...childrenToPush);
        // Add Finance summary tab if request has financial elements or element FINANCE is active
        const isRequestParent = ['request', 'my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(moduleKey);
        const hasFinancialData = childrenToPush.includes('payment') || childrenToPush.includes('contract') || childrenToPush.includes('expense') || childrenToPush.includes('invoice') || childrenToPush.includes('asset') || activeElements.includes('FINANCE');
        if (isRequestParent && hasFinancialData && isStatusAllowed) {
          allChildren.push('finance');
        }
      }
    }

    const fieldsSource = (mod && (mod.detailFields || mod.fields)) ? (mod.detailFields || mod.fields) : [];
    const rows = [];
    let currentSectionIndex = -1;
    let sectionHasFields = false;

    for (const f of fieldsSource) {
      if (f.section) {
        if (currentSectionIndex !== -1 && !sectionHasFields) {
          rows.splice(currentSectionIndex, 1);
        }
        currentSectionIndex = rows.length;
        rows.push({ type: 'section', label: f.section });
        sectionHasFields = false;
        continue;
      }

      let level = 3;
      const reqApprovalLevel = (record.approval_level || 'Standard').toLowerCase();
      if (reqApprovalLevel === 'non-standard') {
        level = 3;
      } else if (reqApprovalLevel === 'standard') {
        const policyLvl = (record.policy_approval_level || '').toLowerCase();
        if (policyLvl.includes('3')) level = 3;
        else if (policyLvl.includes('2')) level = 2;
        else if (policyLvl.includes('1')) level = 1;
        else if (policyLvl.includes('0')) level = 0;
        else level = 0;
      } else {
        if (reqApprovalLevel.includes('3')) level = 3;
        else if (reqApprovalLevel.includes('2')) level = 2;
        else if (reqApprovalLevel.includes('1')) level = 1;
        else if (reqApprovalLevel.includes('0')) level = 0;
      }
      if (f.key && f.key.startsWith('tier_1_') && level < 1) continue;
      if (f.key && f.key.startsWith('tier_2_') && level < 2) continue;
      if (f.key && f.key.startsWith('tier_3_') && level < 3) continue;

      rows.push({ type: 'field', ...f });
      sectionHasFields = true;
    }

    if (currentSectionIndex !== -1 && !sectionHasFields) {
      rows.splice(currentSectionIndex, 1);
    }

    const canEdit = record._is_virtual ? false : canUserEditRecord(moduleKey, record);

    let html = `
    <div class="view active ${moduleKey}-detail detail-view-2" id="view-${moduleKey}-detail" style="display: flex; flex-direction: column; height: 100%; overflow: hidden; font-family: 'Inter', sans-serif;">
      
      <!-- Mobile view tabs -->
      <div class="mobile-detail-tabs" style="display: none; gap: 8px; padding: 8px 12px; background: #E2E8F0; border-radius: 12px; margin: 0 16px 12px;">
        <button class="mobile-detail-tab-btn active" onclick="switchMobileDetailTab('info')" id="mob-tab-info" style="flex: 1; padding: 10px; border: none; background: #FFFFFF; color: #1E293B; border-radius: 8px; font-weight: 600; cursor: pointer; font-size:12px; display: flex; align-items: center; justify-content: center; gap: 6px; font-family: inherit; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <span class="material-symbols-rounded" style="font-size:16px;">info</span>
          <span>Information</span>
        </button>
        ${allChildren.length > 0 ? `
        <button class="mobile-detail-tab-btn" onclick="switchMobileDetailTab('related')" id="mob-tab-related" style="flex: 1; padding: 10px; border: none; background: transparent; color: #64748B; border-radius: 8px; font-weight: 600; cursor: pointer; font-size:12px; display: flex; align-items: center; justify-content: center; gap: 6px; font-family: inherit;">
          <span class="material-symbols-rounded" style="font-size:16px;">table_rows_narrow</span>
          <span>Related Info</span>
        </button>
        ` : ''}
      </div>

      <div class="detail-layout ${allChildren.length === 0 ? 'single-view' : ''}" style="display: flex; gap: 24px; padding: 24px; flex: 1; min-height: 0; overflow-y: auto; background: #F8FAFC; ${allChildren.length === 0 ? 'justify-content: center;' : ''}">
        <!-- LEFT PANEL: Record Details -->
        <div class="detail-left" style="${allChildren.length > 0 ? 'flex: 0 0 45%; max-width: 45%;' : 'flex: 1 1 100%; max-width: 900px; width: 100%; margin: 0 auto; height: max-content;'} background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 24px; display: flex; flex-direction: column; gap: 0; box-shadow: 0 1px 3px rgba(0,0,0,0.04); overflow-y: auto; box-sizing: border-box;">
          
          <div style="display: flex; justify-content: flex-end; align-items: center; border-bottom: 1px solid #E5E7EB; padding-bottom: 12px; margin-bottom: 24px; flex-wrap: wrap; gap: 8px;">
            <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
              <div id="detail-actions-container" style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;"></div>
              ${(() => {
        const isSuperAdmin = authUser && authUser.role && authUser.role.toUpperCase() === 'SUPER ADMIN';
        const isDeleted = record && record.deleted_at;
        if (isDeleted) {
          if (isSuperAdmin) {
            return `
                      <button class="btn btn-custom-action btn-custom-action-success" onclick="restoreRecord('${moduleKey}', '${pkVal}')" style="background: #ECFDF5; border: 1px solid #A7F3D0; color: #059669; font-size: 12px; font-weight: 600; padding: 6px 12px; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                        <span class="material-symbols-rounded" style="font-size: 16px; color: #059669;">settings_backup_restore</span> Restore
                      </button>
                    `;
          }
          return '';
        }

        if (['my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(activeViewName)) {
          return '';
        }
        let editBtn = '';
        if (canEdit && isActionAllowed(`${activeViewName}`, 'edit')) {
          editBtn = `
                    <button class="btn btn-custom-action" onclick="openEditModal('${moduleKey}', '${pkVal}')" style="background: #FFFFFF; border: 1px solid #E5E7EB; color: #334155; font-size: 12px; font-weight: 600; padding: 6px 12px; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                      <span class="material-symbols-rounded" style="font-size: 16px;">edit</span> ${t('detail.edit', 'Edit')}
                    </button>
                  `;
        }

        let deleteBtn = '';
        const isDeleteAllowed = isActionAllowed(`${activeViewName}`, 'delete');
        const shouldShowDelete = isDeleteAllowed && canUserDeleteRecord(moduleKey, record) && !(moduleKey === 'payment' && record && record.contract_id);

        if (shouldShowDelete) {
          deleteBtn = `
                    <button class="btn btn-custom-action btn-custom-action-danger" onclick="confirmDelete('${moduleKey}', '${pkVal}', '${String(displayName).replace(/'/g, "\\'")}' )" style="background: #FEF2F2; border: 1px solid #FCA5A5; color: #DC2626; font-size: 12px; font-weight: 600; padding: 6px 12px; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                      <span class="material-symbols-rounded" style="font-size: 16px; color: #DC2626;">delete</span> Delete
                    </button>
                  `;
          const isSuperAdmin = authUser && authUser.role && authUser.role.toUpperCase() === 'SUPER ADMIN';
          if (isSuperAdmin) {
            deleteBtn += `
                    <button class="btn btn-custom-action btn-custom-action-danger" onclick="confirmHardDelete('${moduleKey}', '${pkVal}', '${String(displayName).replace(/'/g, "\\'")}' )" style="background: #FFF5F5; border: 1px solid #FECACA; color: #EF4444; font-size: 12px; font-weight: 700; padding: 6px 12px; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                      <span class="material-symbols-rounded" style="font-size: 16px; color: #EF4444;">delete_forever</span> Hard Delete
                    </button>
            `;
          }
        }

        return editBtn + deleteBtn;
      })()}
            </div>
          </div>

          <!-- Title & Subtitle -->
          <div style="margin-bottom: 24px; width: 100%;">
            <h2 style="font-size: 20px; font-weight: 600; color: #111827; margin: 0 0 16px 0; line-height: 1.2; display: flex; align-items: center; gap: 8px;">
              ${record.deleted_at ? `<span class="material-symbols-rounded" style="font-size: 20px; color: #EF4444; flex-shrink: 0;" title="Soft Deleted">block</span>` : ''}
              <span>${escapeHTML(headerTitle)}</span>
            </h2>
            ${statusGridHTML}
          </div>
    `;

    const auditKeys = ['created_by', 'created_date', 'updated_by', 'updated_date'];
    const logKeys = ['log', 'logs', 'notification_logs'];

    const renderDetailFieldHTML = (rowOrig, gridCols) => {
      let row = { ...rowOrig };
      if (row.key && row.key.startsWith('spacer_')) {
        return `<div class="field-row spacer" style="grid-column: span 1; min-height: unset; box-sizing: border-box; padding: 0;"></div>`;
      }
      let fieldCfg = fieldsSource.find(f => f.key === row.key);
      if (fieldCfg) {
        fieldCfg = { ...fieldCfg };
        if (row.key === 'contract_id') {
          fieldCfg.key = 'contract_id';
          fieldCfg.label = 'Contract';
          fieldCfg.labelKey = 'col.contract';
          fieldCfg.optionsFrom = 'contract';
        }
      }
      let colCfg = mod.columns ? mod.columns.find(c => c.key === row.key) : null;
      if (colCfg) {
        colCfg = { ...colCfg };
        if (row.key === 'contract_id') {
          colCfg.key = 'contract_id';
          colCfg.label = 'Contract';
          colCfg.labelKey = 'col.contract';
          colCfg.optionsFrom = 'contract';
        }
      }
      const isExplicitDetailField = mod.detailFields && mod.detailFields.some(f => f.key === row.key);

      if ((fieldCfg && fieldCfg.hidden) || (colCfg && colCfg.hidden && !isExplicitDetailField) || !isColumnAllowed(moduleKey, row.key)) return '';

      let val = record[row.key];
      if (row.key === 'elements' && moduleKey === 'request') {
        const isEmpty = !val || (Array.isArray(val) && val.length === 0);
        if (isEmpty) {
          val = record.policy_elements || '';
        }
      }
      if (row.key === 'request_id') {
        val = window.getFormattedRequestCode(record);
      } else if (row.key === 'process_duration') {
        const slaInfo = calculateRequestSLA(record);
        val = slaInfo.durationFormatted;
      } else if (row.key === 'sla_status') {
        const slaInfo = calculateRequestSLA(record);
        val = slaInfo.badgeLabel;
      } else if (row.key === 'policy_sla' || (row.key === 'sla' && moduleKey === 'policy')) {
        let slaRaw = record.policy_sla !== undefined ? record.policy_sla : record.sla;
        if (slaRaw !== undefined && slaRaw !== null && slaRaw !== '') {
          const numSla = Number(slaRaw);
          val = !isNaN(numSla) ? `${numSla.toFixed(2)} ${typeof t === 'function' ? t('unit.days', 'd') : 'd'}` : String(slaRaw);
        } else {
          val = typeof t === 'function' ? t('badge.sla_na', 'Không áp dụng SLA') : 'Không áp dụng SLA';
        }
      } else if (row.key === 'non_standard') {
        val = (record.approval_level && record.approval_level.toLowerCase() === 'non-standard') ? 'True' : 'False';
      } else if (moduleKey === 'payment' && row.key === 'value_in_base_currency') {
        const v = parseFloat(record.value) || 0;
        const rate = parseFloat(record.exchange_rate) || 1;
        val = record.value_in_base_currency !== undefined && record.value_in_base_currency !== null ? record.value_in_base_currency : Math.round(v * rate);
      } else if (moduleKey === 'asset' && row.key === 'value_in_base_currency') {
        const cost = parseFloat(String(record.purchase_cost || '').replace(/[^0-9.]/g, '')) || 0;
        const rate = parseFloat(String(record.exchange_rate || '').replace(/[^0-9.]/g, '')) || 1;
        val = record.value_in_base_currency !== undefined && record.value_in_base_currency !== null ? record.value_in_base_currency : Math.round(cost * rate);
      } else if (moduleKey === 'account' && row.key === 'balance_in_base_currency') {
        const bal = parseFloat(record.balance) || 0;
        const rate = parseFloat(record.exchange_rate) || 1;
        val = record.balance_in_base_currency !== undefined && record.balance_in_base_currency !== null ? record.balance_in_base_currency : Math.round(bal * rate);
      } else if ((moduleKey === 'contract' || moduleKey === 'expense' || moduleKey === 'invoice') && row.key === 'total_value') {
        const v = parseFloat(record.value_before_vat) || 0;
        const vat = parseFloat(record.vat_value) || 0;
        val = record.total_value !== undefined && record.total_value !== null ? record.total_value : (v + vat);
      } else if ((moduleKey === 'contract' || moduleKey === 'expense' || moduleKey === 'invoice') && row.key === 'value_before_vat_in_base_currency') {
        const v = parseFloat(record.value_before_vat) || 0;
        const rate = parseFloat(record.exchange_rate || record.exchance_rate) || 1;
        val = record.value_before_vat_in_base_currency !== undefined && record.value_before_vat_in_base_currency !== null ? record.value_before_vat_in_base_currency : Math.round(v * rate);
      } else if ((moduleKey === 'contract' || moduleKey === 'expense' || moduleKey === 'invoice') && row.key === 'vat_value_in_base_currency') {
        const vat = parseFloat(record.vat_value) || 0;
        const rate = parseFloat(record.exchange_rate || record.exchance_rate) || 1;
        val = record.vat_value_in_base_currency !== undefined && record.vat_value_in_base_currency !== null ? record.vat_value_in_base_currency : Math.round(vat * rate);
      } else if ((moduleKey === 'contract' || moduleKey === 'expense' || moduleKey === 'invoice') && row.key === 'total_value_in_base_currency') {
        const v = parseFloat(record.value_before_vat) || 0;
        const vat = parseFloat(record.vat_value) || 0;
        const rate = parseFloat(record.exchange_rate || record.exchance_rate) || 1;
        val = record.total_value_in_base_currency !== undefined && record.total_value_in_base_currency !== null ? record.total_value_in_base_currency : Math.round((v + vat) * rate);
      } else {
        val = parseBufferVal(val);
        const virtualVal = typeof resolveVirtualColumn === 'function' ? resolveVirtualColumn(moduleKey, row.key, record) : undefined;
        if (virtualVal !== undefined) {
          val = virtualVal;
        } else {
          val = resolveLookupValue(moduleKey, row.key, val);
        }
      }

      if (row.key === 'approval_flow') {
        const colSpan = `grid-column: span ${gridCols};`;
        return `
          <div class="field-row" style="${colSpan} display: flex; flex-direction: column; gap: 4px; min-height: unset; justify-content: flex-start; box-sizing: border-box; padding: 0; width: 100%;">
            ${renderApprovalFlowWidget(record)}
          </div>
        `;
      }

      if (val instanceof Array) {
        val = val.map(v => typeof v === 'object' ? JSON.stringify(v) : v).join(', ');
      }

      let isFull = row.full || (fieldCfg && fieldCfg.full) || (colCfg && colCfg.full);
      const longKeys = ['description', 'comment', 'request_title', 'title', 'note', 'sow', 'address', 'bank_info', 'process_type_description', 'full_name', 'company_fullname', 'payment_description', 'account_infor', 'procedure_link', 'website', 'expense_name', 'counter_party', 'elements'];
      if (!isFull && (longKeys.includes(row.key) || (typeof val === 'string' && val.length > 60))) isFull = true;

      let labelRaw = row.label || row.key;
      let labelKey = (fieldCfg && fieldCfg.labelKey) || (colCfg && colCfg.labelKey) || ('col.' + row.key);
      // Dynamic label: counter_party in payment detail view
      if (row.key === 'counter_party' && moduleKey === 'payment') {
        const pType = Number(record.payment_type);
        if (pType === 60 || String(record.payment_type || '').toLowerCase() === 'incoming') {
          labelRaw = 'Pay From';
          labelKey = 'col.pay_from';
        } else {
          labelRaw = 'Pay To';
          labelKey = 'col.pay_to';
        }
      }
      const colLabel = (typeof t === 'function' ? t(labelKey, labelRaw) : labelRaw);

      // Proper Case: only apply if no custom label was provided (pure snake_case key)
      let displayLabel = colLabel.replace(/_/g, ' ');
      if (colLabel === labelRaw && !row.label) {
        displayLabel = displayLabel.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
      }
      displayLabel = displayLabel
        .replace(/\bProcess Sla\b/g, 'Process SLA')
        .replace(/\bSla Qualification\b/g, 'SLA Qualification')
        .replace(/\bSr Owner\b/g, 'SR Owner')
        .replace(/\bSla\b/g, 'SLA')
        .replace(/\bSr\b/g, 'SR');

      let valHTML = '';
      if (val === null || val === undefined || val === '' || (typeof val === 'object' && Object.keys(val).length === 0 && !(val instanceof Date))) {
        valHTML = `<span style="color: #94A3B8; font-style: italic;">—</span>`;
      } else if (row.key === 'sla_status') {
        const slaInfo = calculateRequestSLA(record);
        valHTML = escapeHTML(slaInfo.badgeLabel);
      } else if (row.key === 'rating') {
        let ratingObj = null;
        try {
          if (typeof val === 'string') {
            ratingObj = JSON.parse(val);
          } else if (val && typeof val === 'object') {
            ratingObj = val;
          }
        } catch (e) { }

        if (ratingObj && (ratingObj.point !== undefined || ratingObj.comment)) {
          const pt = parseInt(ratingObj.point) || 0;
          const comment = ratingObj.comment || '';
          let starsHTML = '';
          if (pt > 0) {
            starsHTML = `<div style="display:flex; align-items:center; gap:2px;">
              ${[1, 2, 3, 4, 5].map(i => `<span class="material-symbols-rounded" style="font-size:16px; color:${i <= pt ? '#F59E0B' : '#D1D5DB'}">${i <= pt ? 'star' : 'star_border'}</span>`).join('')}
              <span style="font-size:12px; font-weight:600; color:#4B5563; margin-left:4px;">${pt}/5</span>
            </div>`;
          }
          let commentHTML = '';
          if (comment) {
            commentHTML = `<div style="font-size:13px; color:#4B5563; font-style:italic; background:#F8FAFC; padding:8px 12px; border-radius:8px; border-left:3px solid #CBD5E1; margin-top:4px; max-width:100%; box-sizing:border-box;">"${escapeHTML(comment)}"</div>`;
          }
          valHTML = `<div style="display:flex; flex-direction:column; gap:4px;">
            ${starsHTML}
            ${commentHTML}
          </div>`;
        } else {
          valHTML = `<span style="color: #94A3B8; font-style: italic;">—</span>`;
        }
      } else if ((fieldCfg && fieldCfg.type === 'file') || row.key === 'file') {
        let fileList = [];
        if (val) {
          try {
            if (String(val).startsWith('[')) {
              fileList = JSON.parse(val);
            } else {
              fileList = String(val).split(',').map(s => s.trim()).filter(Boolean);
            }
          } catch (e) {
            fileList = [val];
          }
        }
        valHTML = `<div style="display:flex; flex-direction:column; gap:6px;">` + fileList.map(fileUrl => {
          const lowerVal = String(fileUrl).toLowerCase();
          if (lowerVal.match(/[.](jpeg|jpg|gif|png|webp|svg)/) || lowerVal.includes('data:image')) {
            return `<a href="${escapeHTML(fileUrl)}" target="_blank" style="display:inline-block;"><img src="${escapeHTML(fileUrl)}" style="max-width:200px; max-height:200px; border-radius:8px; border:1px solid #E2E8F0;" /></a>`;
          } else {
            const cleanFileName = formatFileNameDisplay(fileUrl);
            return `<a href="${escapeHTML(fileUrl)}" target="_blank" download="${escapeHTML(cleanFileName)}" style="display:inline-flex; align-items:center; gap:6px; color:#2563EB; font-weight:600; text-decoration:none;"><span class="material-symbols-rounded" style="font-size:16px;">attach_file</span> ${escapeHTML(cleanFileName)}</a>`;
          }
        }).join('') + `</div>`;
      } else if (row.key === 'changes') {
        let formattedChanges = '';
        try {
          const changesObj = typeof val === 'string' ? JSON.parse(val) : val;
          if (changesObj && typeof changesObj === 'object') {
            formattedChanges = Object.entries(changesObj)
              .map(([field, fieldVal]) => {
                let valHtml = '';
                if (fieldVal && typeof fieldVal === 'object' && 'old' in fieldVal && 'new' in fieldVal) {
                  const oldVal = fieldVal.old === null || fieldVal.old === undefined ? 'null' : (typeof fieldVal.old === 'object' ? JSON.stringify(fieldVal.old) : String(fieldVal.old));
                  const newVal = fieldVal.new === null || fieldVal.new === undefined ? 'null' : (typeof fieldVal.new === 'object' ? JSON.stringify(fieldVal.new) : String(fieldVal.new));
                  if (fieldVal.old === null || fieldVal.old === undefined) {
                    valHtml = `<span style="color:var(--accent); font-weight:500;">${escapeHTML(newVal)}</span>`;
                  } else {
                    valHtml = `<span style="text-decoration: line-through; color:var(--text-muted); opacity:0.7;">${escapeHTML(oldVal)}</span> ➔ <span style="color:var(--accent); font-weight:500;">${escapeHTML(newVal)}</span>`;
                  }
                } else {
                  valHtml = escapeHTML(typeof fieldVal === 'object' ? JSON.stringify(fieldVal) : String(fieldVal));
                }
                return `<div style="margin-bottom: 2px;"><strong>${escapeHTML(field)}</strong>: ${valHtml}</div>`;
              })
              .join('');
          } else {
            formattedChanges = escapeHTML(String(val));
          }
        } catch (e) {
          formattedChanges = escapeHTML(String(val));
        }
        valHTML = `<div style="font-size:12px; line-height:1.4; white-space:normal; width:100%;">${formattedChanges || '<span style="color: #94A3B8; font-style: italic;">No changes</span>'}</div>`;
      } else if (typeof val === 'object') {
        valHTML = `<pre style="font-size:11px; white-space:pre-wrap; margin:0; background:#F8FAFC; padding:8px; border-radius:6px; border:1px solid #E2E8F0; width:100%;">${escapeHTML(JSON.stringify(val, null, 2))}</pre>`;
      } else if (typeof val === 'string' && val.trim().toLowerCase().includes('data:image') && val.trim().toLowerCase().includes('base64')) {
        valHTML = `<img src="${val.trim()}" style="max-width:150px; max-height:150px; border-radius:8px; border:1px solid #E2E8F0;" />`;
      } else {
        const k = String(row.key).toLowerCase();
        let displayVal = String(val);

        const isRequestMod = ['request', 'my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(moduleKey);
        if (isRequestMod && (row.type === 'date' || row.type === 'datetime' || ['date', 'due_date', 'payment_date', 'start_date', 'end_date', 'purchase_date', 'contract_signed_date', 'transaction_date', 'invoice_date', 'close_date', 'create_date', 'request_date'].includes(row.key) || k === 'log_time' || k === 'created_date' || k === 'updated_date' || k.endsWith('_date') || k.includes('date') || (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}/)))) {
          displayVal = formatDateTime(val);
        } else if (['date', 'due_date', 'payment_date', 'start_date', 'end_date', 'purchase_date', 'contract_signed_date', 'transaction_date', 'invoice_date', 'close_date', 'create_date', 'request_date'].includes(row.key) || row.type === 'date' || k === 'date' || (k.includes('date') && !['log_time', 'created_date', 'updated_date'].includes(row.key))) {
          displayVal = formatDateMON(val);
        } else if (k === 'log_time' || k === 'created_date' || k === 'updated_date') {
          displayVal = formatDateTime(val);
        } else if (k.endsWith('_date') || (typeof val === 'string' && val.match(/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}/))) {
          displayVal = formatDateTime(val);
        } else if (k.includes('rate')) {
          displayVal = formatExchangeRate(val);
        } else if (isNumericFieldKey(row.key, row.type)) {
          if (!isNaN(parseFloat(val)) && isFinite(val)) {
            if (moduleKey === 'finance' && !k.endsWith('_count') && !k.includes('total_requests') && (val === 0 || val === '0' || parseFloat(val) === 0 || val === '')) {
              displayVal = '';
            } else {
              displayVal = formatNumber(val);
            }
          }
        }
        
        if (displayVal === '[object Object]' || displayVal === '{}') {
          displayVal = '—';
        }

        let linkIcon = '';
        const targetOptionsFrom = (fieldCfg && fieldCfg.optionsFrom) || (colCfg && colCfg.optionsFrom) || (mod.fields && mod.fields.find(f => f.key === row.key)?.optionsFrom);
        if (targetOptionsFrom && record[row.key] && targetOptionsFrom !== 'employee' && targetOptionsFrom !== 'employee_active' && targetOptionsFrom !== 'helpdesk_policy') {
          const rawId = record[row.key];
          linkIcon = `<span class="material-symbols-rounded" style="cursor:pointer; color:#2563EB; font-size:16px; margin-left:6px; vertical-align:middle; transition: opacity 0.2s;" onmouseover="this.style.opacity=0.8" onmouseout="this.style.opacity=1" onclick="openDetailView('${targetOptionsFrom}', '${rawId}')" title="View Details">chevron_right</span>`;
        }
        if (moduleKey === 'payment' && row.key === 'my_company' && record.my_company) {
          linkIcon = `<span class="material-symbols-rounded" style="cursor:pointer; color:#2563EB; font-size:16px; margin-left:6px; vertical-align:middle; transition: opacity 0.2s;" onmouseover="this.style.opacity=0.8" onmouseout="this.style.opacity=1" onclick="openDetailView('my_company', '${record.my_company}')" title="View Details">chevron_right</span>`;
        } else if (moduleKey === 'payment' && (row.key === 'counter_party' || row.key === 'pay_to')) {
          let cpObj = null;
          try {
            cpObj = typeof record.counter_party === 'string' ? JSON.parse(record.counter_party) : record.counter_party;
          } catch (e) { }
          if (cpObj && typeof cpObj === 'object' && cpObj.type === 'employee' && cpObj.id) {
            linkIcon = `<span class="material-symbols-rounded" style="cursor:pointer; color:#2563EB; font-size:16px; margin-left:6px; vertical-align:middle; transition: opacity 0.2s;" onmouseover="this.style.opacity=0.8" onmouseout="this.style.opacity=1" onclick="openDetailView('employee', '${cpObj.id}')" title="View Details">chevron_right</span>`;
          } else if (cpObj && typeof cpObj === 'object' && (cpObj.type === 'company' || cpObj.type === 'partner') && cpObj.id) {
            linkIcon = `<span class="material-symbols-rounded" style="cursor:pointer; color:#2563EB; font-size:16px; margin-left:6px; vertical-align:middle; transition: opacity 0.2s;" onmouseover="this.style.opacity=0.8" onmouseout="this.style.opacity=1" onclick="openDetailView('company', '${cpObj.id}')" title="View Details">chevron_right</span>`;
          } else {
            linkIcon = '';
          }
        }

        if (k === 'approval_status') {
          valHTML = `<span style="display:inline-flex; align-items:center; padding:4px 8px; border-radius:6px; font-size:12px; font-weight:600; ${getBadgeStyles(val)}">${escapeHTML(t_val(displayVal))}</span>${linkIcon}`;
        } else if (k.includes('status')) {
          valHTML = `${escapeHTML(t_val(displayVal))}${linkIcon}`;
        } else if (row.key === 'elements') {
          const rawParts = Array.isArray(val) ? val : String(val).split(',');
          const parts = rawParts.map(s => String(s).trim().replace(/^\[|\]$/g, '')).filter(Boolean);
          if (parts.length > 0) {
            const formattedItems = parts.map(part => {
              const label = (typeof t_val === 'function') ? t_val(part) : String(part);
              return escapeHTML(label);
            }).join(', ');
            valHTML = `${formattedItems}${linkIcon}`;
          } else {
            valHTML = `<span style="color: #94A3B8; font-style: italic;">—</span>`;
          }
        } else {
          valHTML = displayVal ? `${escapeHTML(displayVal)}${linkIcon}` : `<span style="color: #94A3B8; font-style: italic;">—</span>`;
        }
      }

      if (moduleKey === 'finance' && (row.key.endsWith('_count') || row.key === 'total_requests')) {
        const countDisplay = (val === null || val === undefined || val === '' || isNaN(parseFloat(val))) ? '0' : formatNumber(val);
        return `
          <div class="field-row field-row-count-banner" style="grid-column: span ${gridCols}; display: flex; align-items: center; justify-content: space-between; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 7px 14px; margin: 2px 0;">
            <div style="font-size: 13px; font-weight: 600; color: #475569; display: flex; align-items: center; gap: 6px;">
              <span class="material-symbols-rounded" style="font-size: 15px; color: #64748B;">tag</span>
              <span>${escapeHTML(displayLabel)}</span>
            </div>
            <span style="display: inline-flex; align-items: center; justify-content: center; background: #FFFFFF; border: 1px solid #CBD5E1; color: #1E293B; font-weight: 700; font-size: 13px; border-radius: 12px; padding: 1px 10px; min-width: 24px; text-align: center; box-shadow: 0 1px 2px rgba(0,0,0,0.03);">
              ${escapeHTML(countDisplay)}
            </span>
          </div>
        `;
      }

      if (moduleKey === 'finance' && (row.key === 'selling' || row.key === 'buying')) {
        const colSpan = isFull ? `grid-column: span ${gridCols};` : 'grid-column: span 1;';
        return `
          <div class="field-row" style="${colSpan} display: flex; flex-direction: column; gap: 4px; min-height: unset; justify-content: flex-start; box-sizing: border-box; padding: 4px 0;">
            <div style="font-size: 13px; font-weight: 600; color: #475569; line-height: 1.3;">${escapeHTML(displayLabel)}</div>
            <div style="font-size: 16px; font-weight: 700; color: #0F172A; word-break: break-word; line-height: 1.3;">${valHTML}</div>
          </div>
        `;
      }

      const colSpan = isFull ? `grid-column: span ${gridCols};` : 'grid-column: span 1;';
      return `
        <div class="field-row" style="${colSpan} display: flex; flex-direction: column; gap: 4px; min-height: unset; justify-content: flex-start; box-sizing: border-box; padding: 0;">
          <div style="font-size: 13px; font-weight: 500; color: #6B7280; line-height: 1.3;">${escapeHTML(displayLabel)}</div>
          <div style="font-size: 14px; font-weight: 400; color: #111827; word-break: break-word; line-height: 1.4;">${valHTML}</div>
        </div>
      `;
    };

    // Segment detail fields by section
    const detailSections = [];
    let currentDetailSection = { name: 'General', fields: [] };
    detailSections.push(currentDetailSection);

    for (const row of rows) {
      if (auditKeys.includes(row.key) || logKeys.includes(row.key)) continue;

      if (row.type === 'section') {
        currentDetailSection = { name: row.label, fields: [] };
        detailSections.push(currentDetailSection);
      } else {
        currentDetailSection.fields.push(row);
      }
    }

    const activeDetailSections = detailSections.filter(s => s.fields.length > 0);
    const useDetailTabs = false;
    let sectionCounter = 0;

    if (useDetailTabs) {
      // Tab Header
      html += `<div class="form-tabs-header" style="margin-bottom:16px; border-bottom: 2px solid #E5E7EB; width: 100%;">`;
      activeDetailSections.forEach((sec, idx) => {
        const secLabel = (typeof t === 'function' ? t('section.' + sec.name.toLowerCase().replace(/[^a-z0-9]/g, '_'), sec.name) : sec.name).toUpperCase();
        const activeClass = idx === 0 ? ' active' : '';
        const tabId = `detail-left-tab-${moduleKey}-${idx}`;
        html += `<button type="button" class="form-tab-btn detail-left-tab-btn${activeClass}" data-tab-id="${tabId}" onclick="switchDetailLeftTab(this, '${tabId}')">${secLabel}</button>`;
      });
      html += `</div>`;

      // Tab panes
      activeDetailSections.forEach((sec, idx) => {
        const activeClass = idx === 0 ? ' active' : '';
        const tabId = `detail-left-tab-${moduleKey}-${idx}`;
        let currentGridCols = 2;
        const secLower = sec.name.toLowerCase();
        if (secLower.includes('approval')) {
          currentGridCols = 3;
        } else if (secLower.includes('process')) {
          currentGridCols = 2;
        } else if (secLower.includes('detail') && !secLower.includes('financial')) {
          currentGridCols = 1;
        }

        html += `<div class="form-tab-pane detail-left-tab-pane${activeClass}" id="${tabId}" style="width: 100%;">`;
        html += `
          <div class="section-card" style="border: 1px solid #E5E7EB; border-radius: 8px; padding: 16px; background: #FFFFFF; display: flex; flex-direction: column; width: 100%; box-sizing: border-box; margin-bottom: 0; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
            <div style="display: grid; grid-template-columns: repeat(${currentGridCols}, 1fr); gap: 16px 20px; width: 100%;">
        `;
        for (const row of sec.fields) {
          html += renderDetailFieldHTML(row, currentGridCols);
        }
        html += `
            </div>
          </div>
        </div>`;
      });
    } else {
      // Standard vertical layout
      let inSectionCard = false;
      sectionCounter = 0;
      let currentGridCols = 2;

      for (const row of rows) {
        if (auditKeys.includes(row.key) || logKeys.includes(row.key)) continue;

        if (row.type === 'section') {
          if (inSectionCard) {
            html += `
                </div>
              </div>
            `;
            inSectionCard = false;
          }

          sectionCounter++;
          let sectionNameText = typeof t === 'function' ? t('section.' + row.label.toLowerCase().replace(/[^a-z0-9]/g, '_'), row.label) : row.label;
          if (row.label.toLowerCase() === 'approval status') {
            let displayLvl = record.approval_level;
            if (displayLvl === 'Standard') {
              displayLvl = record.policy_approval_level || 'Tier 0';
            } else if (displayLvl === 'Non-Standard') {
              displayLvl = 'Tier 3';
            }
            if (displayLvl) {
              let formattedLvl = String(displayLvl);
              if (/^\d+$/.test(formattedLvl)) {
                formattedLvl = `Tier ${formattedLvl}`;
              }
              sectionNameText += ` (${formattedLvl})`;
            }
          }
          const sectionName = sectionNameText.toUpperCase();

          currentGridCols = 2;
          const secLower = sectionName.toLowerCase();
          if (secLower.includes('approval')) {
            currentGridCols = 3;
          } else if (secLower.includes('process')) {
            currentGridCols = 2;
          } else if (secLower.includes('detail') && !secLower.includes('financial')) {
            currentGridCols = 1;
          }

          html += `
            <!-- SECTION TITLE ABOVE CARD -->
            <div style="font-size: 14px; font-weight: 600; color: #374151; margin: 0 0 12px 0; display: flex; align-items: center; gap: 6px; text-transform: uppercase; letter-spacing: 0.3px;">
              <span>${sectionCounter}. ${escapeHTML(sectionName)}</span>
            </div>
            <!-- SECTION VALUE CARD CONTAINER -->
            <div class="section-card" style="border: 1px solid #E5E7EB; border-radius: 8px; padding: 16px; background: #FFFFFF; display: flex; flex-direction: column; width: 100%; box-sizing: border-box; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
              <div style="display: grid; grid-template-columns: repeat(${currentGridCols}, 1fr); gap: 16px 20px; width: 100%;">
          `;
          inSectionCard = true;
        } else {
          if (!inSectionCard) {
            sectionCounter++;
            html += `
              <!-- SECTION CARD (Fallback) -->
              <div class="section-card" style="border: 1px solid #E5E7EB; border-radius: 8px; padding: 16px; background: #FFFFFF; display: flex; flex-direction: column; width: 100%; box-sizing: border-box; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px 20px; width: 100%;">
            `;
            inSectionCard = true;
            currentGridCols = 2;
          }

          html += renderDetailFieldHTML(row, currentGridCols);
        }
      }

      if (inSectionCard) {
        html += `
            </div>
          </div>
        `;
      }
    }

    const isReqMod = ['request', 'my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(moduleKey) && !(record && record.is_support);
    if (isReqMod) {
      html += `
        <!-- SECTION 4: FEEDBACK -->
        <div style="font-size: 14px; font-weight: 600; color: #374151; margin: 0 0 12px 0; display: flex; align-items: center; gap: 6px; text-transform: uppercase; letter-spacing: 0.3px;">
          <span>${typeof t === 'function' ? t('section.feedback', '4. Feedback') : '4. FEEDBACK'}</span>
        </div>
        <div class="section-card" style="border: 1px solid #E5E7EB; border-radius: 8px; padding: 16px; background: #FFFFFF; display: flex; flex-direction: column; width: 100%; box-sizing: border-box; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
          <div id="inline-feedback-summary"><div style="color:#9CA3AF; font-size:12px;">Loading...</div></div>
        </div>
        </div> <!-- Close detail-left -->
      `;
    } else {
      if (moduleKey === 'cms_tenant_info') {
        html += `
          <!-- SECTION TITLE ABOVE CARD -->
          <div style="font-size: 14px; font-weight: 600; color: #374151; margin: 24px 0 12px 0; display: flex; align-items: center; gap: 6px; text-transform: uppercase; letter-spacing: 0.3px;">
            <span>${t('seat.user_seats_title', 'Danh sách người dùng login (User Seats)')}</span>
          </div>
          <!-- SECTION VALUE CARD CONTAINER -->
          <div class="section-card" style="border: 1px solid #E5E7EB; border-radius: 8px; padding: 16px; background: #FFFFFF; display: flex; flex-direction: column; width: 100%; box-sizing: border-box; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
            <div id="tenant-user-seats-container" style="overflow-x: auto; width: 100%;">
              <div style="color:#9CA3AF; font-size:12px; padding: 8px 0;">Loading...</div>
            </div>
          </div>
        `;

        setTimeout(async () => {
          try {
            const res = await apiGet('/employees/tenant-seats');
            const container = document.getElementById('tenant-user-seats-container');
            if (!container) return;

            if (!res.data || res.data.length === 0) {
              container.innerHTML = `<div style="color:#9CA3AF; font-style:italic; font-size:13px; padding: 8px 0;">${t('seat.no_active_users', 'Chưa có người dùng hoạt động đăng ký')}</div>`;
              return;
            }

            let tableHtml = `
              <table style="width:100%; border-collapse:collapse; font-size:13px; text-align:left;">
                <thead>
                  <tr style="border-bottom:2px solid #E5E7EB; color:#4B5563; font-weight:600;">
                    <th style="padding:10px 8px;">Email</th>
                    <th style="padding:10px 8px;">Username</th>
                    <th style="padding:10px 8px;">Tên đầy đủ</th>
                    <th style="padding:10px 8px;">Trạng thái</th>
                    <th style="padding:10px 8px;">Đăng nhập cuối</th>
                    <th style="padding:10px 8px; text-align:center;">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
            `;

            res.data.forEach(u => {
              const lastLogin = u.last_login_at ? formatDateTime(u.last_login_at) : t('seat.no_login_yet', 'Chưa login');
              const statusLabel = u.is_active ? t('seat.status_active', 'Bật') : t('seat.status_inactive', 'Tắt');
              const badgeStyles = u.is_active
                ? 'background: #ECFDF5; color: #10B981; border: 1px solid rgba(16, 185, 129, 0.2);'
                : 'background: #FEF2F2; color: #EF4444; border: 1px solid rgba(239, 68, 68, 0.2);';

              tableHtml += `
                <tr style="border-bottom:1px solid #F3F4F6;">
                  <td style="padding:10px 8px;"><code>${escapeHTML(u.email || 'N/A')}</code></td>
                  <td style="padding:10px 8px;"><code>${escapeHTML(u.username || 'N/A')}</code></td>
                  <td style="padding:10px 8px;">${escapeHTML(u.full_name || 'N/A')}</td>
                  <td style="padding:10px 8px;">
                    <span style="display:inline-flex; align-items:center; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600; ${badgeStyles}">${escapeHTML(statusLabel)}</span>
                  </td>
                  <td style="padding:10px 8px;">${lastLogin}</td>
                  <td style="padding:10px 8px; text-align:center;">
                    <button class="btn btn-outline btn-sm" style="background:#FEF2F2; color:#EF4444; border:1px solid #FCA5A5; font-size:11px; padding:2px 8px;" onclick="window.releaseTenantUserSeat('${escapeHTML(u.email || u.username)}')">
                      ${t('seat.release_action', 'Giải phóng')}
                    </button>
                  </td>
                </tr>
              `;
            });

            tableHtml += `
                </tbody>
              </table>
            `;
            container.innerHTML = tableHtml;
          } catch (err) {
            console.error('Failed to load user seats:', err);
            const container = document.getElementById('tenant-user-seats-container');
            if (container) {
              container.innerHTML = `<div style="color:#EF4444; font-size:12px;">Failed to load user seats: ${escapeHTML(err.message)}</div>`;
            }
          }
        }, 50);
      }

      if (!modHasRealChildren && !hasSidebar && (record.log !== undefined || record.logs !== undefined)) {
        const logsRaw = record.logs || record.log;
        let parsedLogs = [];
        if (Array.isArray(logsRaw)) {
          parsedLogs = logsRaw;
        } else if (typeof logsRaw === 'string') {
          try {
            const parsed = JSON.parse(logsRaw);
            if (Array.isArray(parsed)) parsedLogs = parsed;
          } catch (e) {}
        }
        if (parsedLogs.length > 0) {
          sectionCounter++;
          const logSectionTitle = typeof t === 'function' ? t('nav.request_activity_log', 'Activity Log') : 'ACTIVITY LOG';
          html += `
            <!-- SECTION: ACTIVITY LOG (Single-View Layout) -->
            <div style="font-size: 14px; font-weight: 600; color: #374151; margin: 24px 0 12px 0; display: flex; align-items: center; gap: 6px; text-transform: uppercase; letter-spacing: 0.3px;">
              <span>${sectionCounter}. ${escapeHTML(logSectionTitle)}</span>
            </div>
            <div class="section-card" style="border: 1px solid #E5E7EB; border-radius: 8px; padding: 16px; background: #FFFFFF; display: flex; flex-direction: column; width: 100%; box-sizing: border-box; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
              <div style="display: flex; flex-direction: column; gap: 8px;">
                ${parsedLogs.slice(0, 15).map(l => {
                  const time = l.timestamp || l.time || l.date ? formatDateTime(l.timestamp || l.time || l.date) : '';
                  const user = resolveEmployeeName(l.user || l.actor || l.by || l.username || 'System') || l.user || 'System';
                  const actionRaw = l.action || l.event || l.message || (typeof l === 'string' ? l : JSON.stringify(l));
                  let displayAction = actionRaw;
                  if (typeof actionRaw === 'string') {
                    if (actionRaw === 'commented') {
                      displayAction = typeof t === 'function' ? t('action.commented', 'commented') : 'commented';
                    } else if (actionRaw === 'created record') {
                      displayAction = typeof t === 'function' ? t('action.created_record', 'Created request') : 'Created request';
                    } else if (actionRaw.startsWith('added ') || actionRaw.startsWith('updated ') || actionRaw.startsWith('deleted ')) {
                      const actParts = actionRaw.split(' ');
                      const actionKey = `action.${actParts[0]}_${actParts.slice(1).join('_')}`;
                      if (typeof t === 'function' && t(actionKey, '') && t(actionKey, '') !== actionKey) {
                        displayAction = t(actionKey);
                      }
                    }
                  }
                  return `
                    <div style="display: flex; align-items: flex-start; gap: 10px; font-size: 12.5px; padding: 6px 0; border-bottom: 1px solid #F1F5F9;">
                      <span class="material-symbols-rounded" style="font-size: 16px; color: #94A3B8; margin-top: 2px;">history</span>
                      <div style="flex: 1;">
                        <div style="display: flex; justify-content: space-between; gap: 8px;">
                          <strong style="color: #1E293B;">${escapeHTML(user)}</strong>
                          <span style="color: #94A3B8; font-size: 11px;">${escapeHTML(time)}</span>
                        </div>
                        <div style="color: #475569; margin-top: 2px;">${escapeHTML(displayAction)}</div>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `;
        }
      }

      html += `</div> <!-- Close detail-left -->`;
    }

    // Right Column (Tabs)
    if (allChildren.length > 0) {
      html += `
        <div class="detail-right" style="flex: 1; display: flex; flex-direction: column; min-width: 0; overflow: hidden; height: 100%;">
          <div class="detail-right-card" style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 24px; display: flex; flex-direction: column; box-shadow: 0 1px 3px rgba(0,0,0,0.04); flex: 1; min-height: 0;">
            
            <!-- Tab Header (TerAX Design) -->
            <div style="display: flex; gap: 0; margin-bottom: 16px; border-bottom: 2px solid #E5E7EB; padding-bottom: 0; flex-wrap: nowrap; overflow-x: auto; overflow-y: hidden; width: 100%; align-items: stretch; scrollbar-width: none;" id="detail-tabs-header">
          `;

      allChildren.forEach((childKey, idx) => {
        if (childKey === 'target_records') {
          const tabLabel = typeof t === 'function' ? t('target_table.records_tab', 'Target Records') : 'Target Records';
          html += `
            <button class="detail-tab ${idx === 0 ? 'active' : ''}" onclick="switchTab(this, '${childKey}')" id="tab-btn-${childKey}" style="display:inline-flex; align-items:center; gap:4px; white-space:nowrap;">
              ${tabLabel} <span id="tab-count-${childKey}" style="font-size:11px; font-weight:500; color:#F97316;"></span>
            </button>
          `;
          return;
        }
        if (childKey === 'finance') {
          html += `
            <button class="detail-tab ${idx === 0 ? 'active' : ''}" onclick="switchTab(this, 'finance')" id="tab-btn-finance" style="display:inline-flex; align-items:center; gap:4px; white-space:nowrap;">${typeof t === 'function' ? t('val.finance', 'Finance') : 'Finance'}</button>
          `;
          return;
        }
        const childMod = MODULES[childKey];
        if (!childMod) return;
        let label = typeof t === 'function' ? t('module.' + childKey + '.title', childMod.label) : childMod.label;
        if (childKey === 'assigned_task') {
          label = typeof t === 'function' ? t('module.assigned_task.tab_title', 'Assign task') : 'Assign task';
        }
        html += `
          <button class="detail-tab ${idx === 0 ? 'active' : ''}" onclick="switchTab(this, '${childKey}')" id="tab-btn-${childKey}" style="display:inline-flex; align-items:center; gap:4px; white-space:nowrap;">
            ${label} <span id="tab-count-${childKey}" style="font-size:11px; font-weight:500; color:#F97316;"></span>
          </button>
        `;
      });

      html += `
            </div> <!-- Close detail-tabs-header -->
            
            <!-- Tab Content -->
            <div class="detail-right-content" id="detail-tabs-content" style="position:relative; overflow:hidden; flex:1; display:flex; flex-direction:column; min-height:0;">
      `;

      for (const childKey of allChildren) {
        if (childKey === 'target_records') {
          const displayStyle = childKey === allChildren[0] ? 'flex' : 'none';
          const loadingText = typeof t === 'function' ? t('target_table.loading_records', 'Loading target records...') : 'Loading target records...';
          html += `
            <div class="tab-pane" id="tab-pane-target_records" style="display:${displayStyle}; flex-direction:column; height:100%; width:100%; min-height:0; overflow-y:auto; padding: 4px;">
              <div id="target-table-actual-records-container" style="flex:1; width:100%;">
                <div style="padding:20px; text-align:center; color:#94A3B8; font-size:12px;">${loadingText}</div>
              </div>
            </div>
          `;
          continue;
        }
        // Finance summary pane — rendered separately
        if (childKey === 'finance') {
          const displayStyle = allChildren[0] === 'finance' ? 'flex' : 'none';
          html += `
            <div class="tab-pane" id="tab-pane-finance" style="display:${displayStyle}; flex-direction:column; height:100%; width:100%; min-height:0; overflow-y:auto;">
              <div id="finance-summary-content" style="padding:4px; flex:1;">
                <div style="padding:32px 20px; text-align:center; color:#94A3B8; font-size:12px;">
                  Loading finance summary...
                </div>
              </div>
            </div>
          `;
          continue;
        }

        const childMod = MODULES[childKey];
        if (!childMod) continue;
        const isComment = childKey === 'comment' || childKey === 'ticket_comment';

        let foreignKey = ['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team', 'request'].includes(moduleKey) ? ((childKey === 'assigned_task' || childKey === 'request_rating') ? 'request_id' : (childKey === 'expense' ? 'id__request' : 'request')) : (moduleKey === 'contract' ? 'contract_id' : moduleKey);
        if (moduleKey === 'assigned_task') foreignKey = 'task_id';
        if (childKey === 'ticket_comment') foreignKey = 'ticket';
        if ((moduleKey === 'employee' || moduleKey === 'employee_active') && childKey === 'request') foreignKey = 'requester';
        if ((moduleKey === 'employee' || moduleKey === 'employee_active') && childKey === 'asset') foreignKey = 'current_owner';

        if ((moduleKey === 'employee' || moduleKey === 'employee_active') && childKey === 'payment') foreignKey = 'employee';
        let foreignVal = pkVal;
        if ((moduleKey === 'my_company' || moduleKey === 'company') && childMod && childMod.fields) {
          if (moduleKey === 'company') {
            if (childKey === 'contact') foreignKey = 'company_id';
            else if (childKey === 'contract') foreignKey = 'contractor';
            else if (childKey === 'payment') foreignKey = 'company';
            else if (childKey === 'oppotunity' || childKey === 'oppo' || childKey === 'opportunity') foreignKey = 'id__company';
            else {
              const compField = childMod.fields.find(f => f.optionsFrom === 'my_company' || f.optionsFrom === 'company' || f.key === 'my_company' || f.key === 'company_id' || f.key === 'company_entity' || f.key === 'contractor' || f.key === 'id__company');
              if (compField) foreignKey = compField.key;
            }
            foreignVal = pkVal;
          } else {
            const compField = childMod.fields.find(f => f.optionsFrom === 'my_company' || f.optionsFrom === 'company' || f.key === 'my_company' || f.key === 'company_id' || f.key === 'company_entity');
            if (compField) {
              foreignKey = compField.key;
              if (compField.optionValue && record && record[compField.optionValue] !== undefined && record[compField.optionValue] !== null) {
                foreignVal = record[compField.optionValue];
              }
            }
          }
        }
        const initialObj = { [foreignKey]: foreignVal };
        if (childKey === 'expense') {
          const reqDate = record?.sr_created_date || record?.created_date || record?.created_at;
          if (reqDate) {
            const d = new Date(reqDate);
            if (!isNaN(d.getFullYear())) {
              initialObj.fy = String(d.getFullYear());
            }
          }
        }
        if (moduleKey === 'my_company' || moduleKey === 'company') {
          initialObj._lock_company = true;
        }
        if (moduleKey === 'contract') {
          initialObj.source = 'Contract';
          if (record && record.request) {
            initialObj.request = record.request;
          }
        }
        const initialDataStr = encodeURI(JSON.stringify(initialObj));
        const displayStyle = childKey === allChildren[0] ? 'flex' : 'none';
        const hashModule = window.location.hash.replace('#', '').split('/')[0];
        const effectiveParentView = (['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(hashModule))
          ? hashModule
          : (['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(activeViewName) ? activeViewName : moduleKey);

        const allowedParentModulesForChildAdd = [
          'my_company',
          'account',
          'request',
          'my_request',
          'my_process_owner',
          'my_task',
          'my_team'
        ];
        const isParentAllowedToAddChild = allowedParentModulesForChildAdd.includes(effectiveParentView)
          || allowedParentModulesForChildAdd.includes(moduleKey);

        const isRequestParent = ['request', 'my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(effectiveParentView)
          || ['request', 'my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(moduleKey);
        const isSpecialChild = ['target_table', 'assigned_task'].includes(childKey);
        const hideAddInNonProcessRequestChildren = isRequestParent && (
          effectiveParentView === 'my_approval' ||
          (!['my_process_owner', 'my_task', 'my_team'].includes(effectiveParentView) && !(isSpecialChild && ['my_request', 'request'].includes(effectiveParentView)))
        );
        let showChildAddButton = isParentAllowedToAddChild
          && !hideAddInNonProcessRequestChildren
          && isChildTableActionAllowed(childKey, 'add', effectiveParentView);
        if (['logs', 'request_activity_log', 'history', 'request_rating', 'rating', 'feedback', 'comment', 'ticket_comment', 'finance'].includes(childKey)) {
          showChildAddButton = false;
        }
        if (moduleKey === 'contract' && childKey === 'invoice' && record && String(record.type).toLowerCase() === 'selling') {
          showChildAddButton = false;
        }

        html += `
          <div class="tab-pane" id="tab-pane-${childKey}" style="display:${displayStyle}; flex-direction:column; height:100%; width:100%; min-height:0;">
            ${!isComment ? `
             <div style="padding: 0 0 12px 0; display:flex; justify-content:space-between; align-items:center; flex-shrink:0; gap:12px; flex-wrap:wrap; width:100%;">
                <div style="display:flex; align-items:center; gap:8px; flex:1; max-width:180px; min-width:140px;">
                  <div style="position:relative; width:100%;">
                    <span class="material-symbols-rounded" style="position:absolute; left:10px; top:50%; transform:translateY(-50%); font-size:16px; color:#94A3B8; pointer-events:none;">search</span>
                    <input type="text" id="child-search-${childKey}" class="form-input" placeholder="${typeof t === 'function' ? t('table.search_placeholder', 'Search...') : 'Search...'}" oninput="filterChildTableSearch('${childKey}', '${moduleKey}', '${pkVal}', this.value)" style="padding: 6px 12px 6px 32px; width:100%; border-radius:6px; border:1px solid #E2E8F0; height:32px; font-size:12px; color:#1E293B; background:#FFF; box-sizing:border-box; outline:none;" />
                  </div>
                </div>
                <div style="display:flex; gap:12px; align-items:center; flex-wrap:nowrap; flex-shrink:0;">
                  <span id="child-sum-${childKey}" style="font-size:11px; color:#64748B; font-weight:400;"></span>
                  ${showChildAddButton ? `
                    <button style="background:#F97316; border:none; color:#fff; font-weight:600; font-size:12px; padding:6px 14px; border-radius:6px; cursor:pointer; display:inline-flex; align-items:center; gap:4px; transition:background 0.2s;" onmouseover="this.style.background='#EA580C'" onmouseout="this.style.background='#F97316'" onclick="${childKey === 'assigned_task' ? `openAddAssignedTaskFromChild('${pkVal}', '${moduleKey}')` : `openAddModal('${childKey}', JSON.parse(decodeURI('${initialDataStr}')))`}"><span class="material-symbols-rounded" style="font-size:15px;">add</span> ${t('table.add', 'Add')}</button>
                  ` : ''}
                </div>
             </div>` : `<span id="child-sum-${childKey}" style="display:none;"></span>`}
            <div id="child-table-container-${childKey}" style="margin:0; flex:1; overflow-y:auto; overflow-x:auto; display:flex; flex-direction:column; min-height:0;">
               <div style="padding:20px; text-align:center; color:#94A3B8; font-size:12px;">Loading...</div>
            </div>
          </div>
        `;
      }

      html += `
            </div> <!-- Close detail-tabs-content -->
          </div> <!-- Close detail-right-card -->
        </div> <!-- Close detail-right -->
      `;
    }

    html += `
      </div> <!-- Close detail-layout -->
    </div> <!-- Close view -->
    `;

    return html;
  }
}

window.switchTab = function (btnOrKey, childKey) {
  let btn = null;
  let key = childKey;
  if (typeof btnOrKey === 'string') {
    key = btnOrKey;
  } else {
    btn = btnOrKey;
  }

  const container = btn ? (btn.closest('.detail-view-2') || document) : (document.getElementById('content') || document);
  container.querySelectorAll('.detail-tab').forEach(el => el.classList.remove('active'));
  container.querySelectorAll('.tab-pane').forEach(el => el.style.display = 'none');

  const tabBtn = container.querySelector('#tab-btn-' + key) || (btn && btn.id === 'tab-btn-' + key ? btn : null);
  if (tabBtn) tabBtn.classList.add('active');

  const tabPane = container.querySelector('#tab-pane-' + key);
  if (tabPane) tabPane.style.display = 'flex';

  // Finance tab: lazy load on first click
  if (key === 'finance') {
    const contentEl = container.querySelector('#finance-summary-content');
    if (contentEl && contentEl.querySelector('.finance-loaded')) return; // already loaded

    // Resolve moduleKey and pkVal from the tab's pane dataset.hash to prevent cross-tab state contamination
    const pane = btn ? btn.closest('.main > .content, .main > [id^="pane-"]') : document.getElementById('content');
    const hash = pane ? (pane.dataset.hash || '') : '';
    const [path] = hash.split('&');
    const [resolvedModule, resolvedPkVal] = path.split('/');

    if (resolvedModule && resolvedPkVal) {
      loadFinanceSummary(resolvedModule, resolvedPkVal, contentEl);
    } else if (typeof currentRecord !== 'undefined' && currentRecord && typeof currentModule !== 'undefined' && currentModule) {
      const mod = MODULES[currentModule];
      if (mod && mod.pk) {
        const pkVal = currentRecord[mod.pk];
        if (pkVal) loadFinanceSummary(currentModule, pkVal, contentEl);
      }
    }
  } else {
    // Child tables: lazy load on first click if not loaded yet
    const childContainer = container.querySelector(`#child-table-container-${key}`);
    if (childContainer && childContainer.dataset.loaded !== 'true') {
      const pane = btn ? btn.closest('.main > .content, .main > [id^="pane-"]') : document.getElementById('content');
      const hash = pane ? (pane.dataset.hash || '') : '';
      const [path] = hash.split('&');
      const [resolvedModule, resolvedPkVal] = path.split('/');
      if (resolvedModule && resolvedPkVal) {
        loadChildTable(key, resolvedModule, resolvedPkVal);
      } else if (typeof currentRecord !== 'undefined' && currentRecord && typeof currentModule !== 'undefined' && currentModule) {
        const mod = MODULES[currentModule];
        if (mod && mod.pk && currentRecord[mod.pk]) {
          loadChildTable(key, currentModule, currentRecord[mod.pk]);
        }
      }
    }
  }
};

// ============================================================
// FEEDBACK SUMMARY
// ============================================================
async function loadFeedbackSummary(parentModuleKey, pkVal, targetId) {
  let container;
  if (targetId && typeof targetId !== 'string') {
    container = targetId;
  } else {
    const contentPane = document.getElementById('content');
    const tid = targetId || 'inline-feedback-summary';
    container = contentPane ? contentPane.querySelector('#' + tid) : document.getElementById(tid);
  }
  if (!container) return;

  container.innerHTML = `<div style="color:#9CA3AF; font-size:12px; padding:8px 0;">${typeof t === 'function' ? t('detail.loading', 'Loading...') : 'Loading...'}</div>`;

  try {
    const res = await apiGet(`/actions/request/${pkVal}/all-ratings`);
    const ratings = (res && res.data) ? res.data : [];
    const summary = (res && res.summary) || null;

    if (ratings.length === 0) {
      container.innerHTML = `
        <div style="color:#94A3B8; font-style:italic; font-size:13px; padding:6px 0; display:flex; align-items:center; gap:6px;">
          <span class="material-symbols-rounded" style="font-size:18px; color:#CBD5E1;">rate_review</span>
          <span>${typeof t === 'function' ? t('feedback.no_feedback', 'No feedback yet for this request') : 'No feedback yet for this request'}</span>
        </div>
      `;
      return;
    }

    let avgPoint = 0;
    if (summary && summary.point) {
      avgPoint = parseFloat(summary.point);
    } else {
      const sum = ratings.reduce((acc, r) => acc + (parseFloat(r.point) || 0), 0);
      avgPoint = parseFloat((sum / ratings.length).toFixed(1));
    }

    const roundedAvg = Math.round(avgPoint);
    const starsSummaryHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; padding-bottom:12px; border-bottom:1px solid #F1F5F9; margin-bottom:12px;">
        <div style="display:flex; align-items:center; gap:6px;">
          <div style="display:flex; align-items:center; gap:2px;">
            ${[1, 2, 3, 4, 5].map(i => `<span class="material-symbols-rounded" style="font-size:18px; color:${i <= roundedAvg ? '#F59E0B' : '#D1D5DB'}">${i <= roundedAvg ? 'star' : 'star_border'}</span>`).join('')}
          </div>
          <span style="font-size:14px; font-weight:700; color:#1E293B;">${avgPoint.toFixed(1)}/5</span>
        </div>
        <span style="font-size:12px; font-weight:500; color:#64748B;">${ratings.length} ${typeof t === 'function' ? t('feedback.reviews_count', 'reviews') : 'reviews'}</span>
      </div>
    `;

    const cardsHTML = ratings.map(r => {
      const pt = parseInt(r.point) || 0;
      const toName = r.to_user_name || r.to_user || 'Unknown';
      const toRoleLabel = r.to_role_label ? `<span style="font-size:11px; font-weight:600; padding:2px 6px; border-radius:4px; background:#EFF6FF; color:#2563EB; margin-left:6px;">${escapeHTML(r.to_role_label)}</span>` : '';
      const comment = r.comment || '';
      const dateStr = r.created_at ? formatDateTime(r.created_at) : '';

      return `
        <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; padding:12px 14px; margin-bottom:8px; display:flex; flex-direction:column; gap:6px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:4px;">
            <div style="display:flex; align-items:center; gap:4px; font-size:13px; font-weight:600; color:#1E293B;">
              <span>${escapeHTML(toName)}</span>
              ${toRoleLabel}
            </div>
            <div style="display:flex; align-items:center; gap:2px;">
              ${[1, 2, 3, 4, 5].map(i => `<span class="material-symbols-rounded" style="font-size:14px; color:${i <= pt ? '#F59E0B' : '#D1D5DB'}">${i <= pt ? 'star' : 'star_border'}</span>`).join('')}
              <span style="font-size:12px; font-weight:700; color:#4B5563; margin-left:4px;">${pt}/5</span>
            </div>
          </div>
          ${comment ? `<div style="font-size:12.5px; color:#334155; line-height:1.4; background:#FFFFFF; border:1px solid #E2E8F0; border-left:3px solid #F59E0B; padding:6px 10px; border-radius:6px; margin-top:2px;">"${escapeHTML(comment)}"</div>` : ''}
          <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px; color:#94A3B8; margin-top:2px;">
            <span style="font-style:italic;">${typeof t === 'function' ? t('feedback.anonymous', 'Anonymous feedback') : 'Anonymous feedback'}</span>
            <span>${escapeHTML(dateStr)}</span>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div style="width:100%;">
        ${starsSummaryHTML}
        <div style="display:flex; flex-direction:column; gap:6px; max-height:400px; overflow-y:auto;">
          ${cardsHTML}
        </div>
      </div>
    `;
  } catch (err) {
    console.error('Failed to load feedback summary:', err);
    container.innerHTML = `<div style="color:#EF4444; font-size:12px;">Failed to load feedback.</div>`;
  }
}
window.loadFeedbackSummary = loadFeedbackSummary;


// Window Bridge for Detail View
window.openDetailView = openDetailView;
window.openDetailInternal = openDetailInternal;
window.showCustomPrompt = showCustomPrompt;
window.showRatingModal = showRatingModal;
window.showMultiRatingModal = showMultiRatingModal;
window.showPaymentPaidModal = showPaymentPaidModal;
window.showAssignTaskModal = showAssignTaskModal;
window.showUpdateTaskStatusModal = showUpdateTaskStatusModal;
window.buildCmsTenantInfoDetailHTML = buildCmsTenantInfoDetailHTML;
window.loadTenantStatusStats = loadTenantStatusStats;
window.buildDetailViewHTML = buildDetailViewHTML;
