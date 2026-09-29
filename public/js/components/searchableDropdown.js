/**
 * CRC App - Searchable Dropdowns & Multiselect Component
 * Extracted as part of Phase 2 Modularization
 */

// Initialize searchable dropdowns for selects with 5+ options (supporting lazy dynamic loading)
// Behaviour: type-to-search only (list hidden when empty), no limit on result count
window.initializeSearchableDropdowns = function (container = document) {
  // Initialize Searchable Multiselect Dropdowns
  const multiselects = container.querySelectorAll('.searchable-multiselect-container');
  multiselects.forEach(msContainer => {
    if (msContainer.dataset.initialized === 'true') return;
    msContainer.dataset.initialized = 'true';

    const fieldKey = msContainer.dataset.fieldKey;
    const trigger = msContainer.querySelector('.multiselect-trigger');
    const searchInput = msContainer.querySelector('.multiselect-search-input');
    const dropdownList = msContainer.querySelector('.multiselect-dropdown-list');
    const pillsContainer = msContainer.querySelector('.selected-pills');
    const checkboxStore = msContainer.querySelector('.checkbox-store');

    const isTargetMultiselect = msContainer.classList.contains('target-record-multiselect');
    if (isTargetMultiselect) {
      const getSelectedSet = () => {
        const selected = new Set();
        checkboxStore.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
          selected.add(cb.value);
        });
        return selected;
      };

      const getPkName = (tbl) => {
        if (tbl === 'employee') return 'employee_id';
        if (tbl === 'my_company') return 'my_company_id';
        if (tbl === 'company') return 'company_id';
        if (tbl === 'asset') return 'office_asset_id';
        if (tbl === 'service') return 'service_id';
        if (tbl === 'contact') return 'contact_id';
        if (tbl === 'policy') return 'policy_id';
        return 'id';
      };

      const getRecordLabel = (tbl, item) => {
        if (tbl === 'employee') return `${item.full_name || ''} (${item.email || ''})`.trim();
        if (tbl === 'my_company') return item.company_shortname || item.company_fullname || '';
        if (tbl === 'company') return item.company_shortname || item.company_fullname || '';
        if (tbl === 'asset') return `${item.asset_name || ''} [${item.office_asset_id || ''}]`.trim();
        if (tbl === 'service') return item.service_name || item.service_id || '';
        if (tbl === 'contact') return `${item.full_name || ''} (${item.email || ''})`.trim();
        if (tbl === 'policy') return item.policy_name || item.policy_id || '';
        return item.id || '';
      };

      const selectedIds = JSON.parse(msContainer.dataset.selected || '[]');
      const currentTableEl = document.getElementById('f-table_name');
      const currentTable = currentTableEl ? currentTableEl.value : '';

      let localOptions = [];
      const renderPills = () => {
        pillsContainer.innerHTML = '';
        const selected = getSelectedSet();
        selected.forEach(val => {
          const opt = localOptions.find(o => o.value === val);
          const label = opt ? opt.label : val;
          const pill = document.createElement('span');
          pill.className = 'multiselect-pill';
          pill.innerHTML = `
            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHTML(label)}</span>
            <span class="remove-pill-btn">✕</span>
          `;
          pill.querySelector('.remove-pill-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            const cb = checkboxStore.querySelector(`input[type="checkbox"][value="${val}"]`);
            if (cb) {
              cb.remove();
            }
            renderPills();
          });
          pillsContainer.appendChild(pill);
        });
        searchInput.placeholder = selected.size > 0 ? '' : 'Search and select...';
      };

      if (currentTable && selectedIds.length > 0) {
        const pk = getPkName(currentTable);
        const endpoint = currentTable === 'policy' ? '/policies' : `/table/${currentTable}`;
        apiGet(`${endpoint}?${pk}=${selectedIds.join(',')}&limit=1000`).then(res => {
          const rows = res.data && Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []);
          checkboxStore.innerHTML = '';
          localOptions = rows.map(item => {
            const val = String(item[pk]);
            const lbl = getRecordLabel(currentTable, item);
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.name = `multi-${fieldKey}`;
            cb.value = val;
            cb.checked = true;
            cb.style.display = 'none';
            checkboxStore.appendChild(cb);
            return { value: val, label: lbl };
          });
          renderPills();
        }).catch(err => console.warn('Failed to resolve target record labels:', err));
      }

      let searchTimeout = null;
      const renderDropdownItems = async (query = '') => {
        dropdownList.innerHTML = '';
        const selectedTableEl = document.getElementById('f-table_name');
        const selectedTable = selectedTableEl ? selectedTableEl.value : '';
        if (!selectedTable) {
          dropdownList.innerHTML = `<div class="searchable-dropdown-no-results">Vui lòng chọn bảng mục tiêu trước</div>`;
          return;
        }

        dropdownList.innerHTML = `<div class="searchable-dropdown-no-results">Đang tìm kiếm...</div>`;
        try {
          const pk = getPkName(selectedTable);
          const endpoint = selectedTable === 'policy' ? '/policies' : `/table/${selectedTable}`;
          const res = await apiGet(`${endpoint}?search=${encodeURIComponent(query)}&limit=50`);
          const rows = res.data && Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []);

          dropdownList.innerHTML = '';
          if (rows.length === 0) {
            dropdownList.innerHTML = `<div class="searchable-dropdown-no-results">No results found</div>`;
            return;
          }

          const selected = getSelectedSet();
          rows.forEach(item => {
            const val = String(item[pk]);
            const lbl = getRecordLabel(selectedTable, item);
            const isChecked = selected.has(val);

            if (!localOptions.some(o => o.value === val)) {
              localOptions.push({ value: val, label: lbl });
            }

            const div = document.createElement('div');
            div.className = 'searchable-dropdown-item';
            div.style.cssText = `
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
            div.innerHTML = `
              <input type="checkbox" style="cursor: pointer; pointer-events: none;" ${isChecked ? 'checked' : ''} />
              <span style="pointer-events: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHTML(lbl)}</span>
            `;

            div.addEventListener('click', (e) => {
              e.stopPropagation();
              let cb = checkboxStore.querySelector(`input[type="checkbox"][value="${val}"]`);
              if (!cb) {
                cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.name = `multi-${fieldKey}`;
                cb.value = val;
                cb.style.display = 'none';
                checkboxStore.appendChild(cb);
              }
              cb.checked = !cb.checked;
              cb.dispatchEvent(new Event('change', { bubbles: true }));

              renderPills();
              const chk = div.querySelector('input[type="checkbox"]');
              if (chk) chk.checked = cb.checked;
            });

            dropdownList.appendChild(div);
          });
        } catch (err) {
          console.error('Search target records error:', err);
          dropdownList.innerHTML = `<div class="searchable-dropdown-no-results" style="color:red;">Lỗi tải dữ liệu</div>`;
        }
      };

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
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          renderDropdownItems(searchInput.value.trim());
        }, 300);
      });

      renderPills();
      return;
    }



    // Build the list of options from checkboxes
    const checkboxes = Array.from(checkboxStore.querySelectorAll('input[type="checkbox"]'));
    const optionsFrom = msContainer.dataset.optionsFrom;

    // Resolve options
    const resolvedOptions = checkboxes.map(cb => {
      let val = cb.value;
      if (typeof val === 'string' && val.startsWith('[') && val.endsWith(']')) {
        val = val.slice(1, -1).trim();
      }
      let label = val;
      if (optionsFrom === 'employee') {
        const empMatch = selectCache['employee'] ? selectCache['employee'].find(x =>
          (x.employee_id && String(x.employee_id).toLowerCase() === val.toLowerCase()) ||
          (x.email && String(x.email).toLowerCase() === val.toLowerCase()) ||
          (x.username && String(x.username).toLowerCase() === val.toLowerCase())
        ) : null;
        if (empMatch) {
          label = formatEmployeeLabel(empMatch);
        } else if (typeof resolveEmployeeLabel === 'function') {
          label = resolveEmployeeLabel(val) || val;
        }
      } else if (optionsFrom) {
        label = resolveLookupValue(currentModule, fieldKey, val) || val;
      }
      return { value: val, label: label, checkbox: cb };
    });

    const getSelectedSet = () => {
      const selected = new Set();
      checkboxes.forEach(cb => {
        if (cb.checked) selected.add(cb.value);
      });
      return selected;
    };

    const renderPills = () => {
      pillsContainer.innerHTML = '';
      const selected = getSelectedSet();
      selected.forEach(val => {
        const cleanVal = String(val).replace(/^\[|\]$/g, '').trim();
        const opt = resolvedOptions.find(o => o.value.toLowerCase() === cleanVal.toLowerCase() || o.value.toLowerCase() === String(val).toLowerCase());
        let label = opt ? opt.label : null;
        if (!label) {
          if (optionsFrom === 'employee' && typeof resolveEmployeeLabel === 'function') {
            label = resolveEmployeeLabel(cleanVal) || cleanVal;
          } else if (typeof resolveLookupValue === 'function') {
            label = resolveLookupValue(currentModule, fieldKey, cleanVal) || cleanVal;
          } else {
            label = cleanVal;
          }
        }
        const pill = document.createElement('span');
        pill.className = 'multiselect-pill';
        pill.innerHTML = `
          <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHTML(label)}</span>
          <span class="remove-pill-btn">✕</span>
        `;
        pill.querySelector('.remove-pill-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          const optMatch = resolvedOptions.find(o => o.value === val);
          if (optMatch) {
            optMatch.checkbox.checked = false;
            optMatch.checkbox.dispatchEvent(new Event('change', { bubbles: true }));
          }
          renderPills();
          renderDropdownItems(searchInput.value.trim());
        });
        pillsContainer.appendChild(pill);
      });

      if (selected.size > 0) {
        searchInput.placeholder = '';
      } else {
        searchInput.placeholder = 'Search and select...';
      }
    };

    const renderDropdownItems = (query = '') => {
      dropdownList.innerHTML = '';
      const selected = getSelectedSet();
      const filtered = resolvedOptions.filter(opt => {
        return opt.label.toLowerCase().includes(query.toLowerCase()) ||
          opt.value.toLowerCase().includes(query.toLowerCase());
      });

      if (filtered.length === 0) {
        dropdownList.innerHTML = `<div class="searchable-dropdown-no-results">No results found</div>`;
        return;
      }

      filtered.forEach(opt => {
        const isChecked = selected.has(opt.value);
        const item = document.createElement('div');
        item.className = 'searchable-dropdown-item';
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

        item.innerHTML = `
          <input type="checkbox" style="cursor: pointer; pointer-events: none;" ${isChecked ? 'checked' : ''} />
          <span style="pointer-events: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHTML(opt.label)}</span>
        `;

        item.addEventListener('click', (e) => {
          e.stopPropagation();
          opt.checkbox.checked = !opt.checkbox.checked;
          opt.checkbox.dispatchEvent(new Event('change', { bubbles: true }));

          renderPills();
          const chk = item.querySelector('input[type="checkbox"]');
          if (chk) chk.checked = opt.checkbox.checked;
        });

        dropdownList.appendChild(item);
      });
    };

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

    const clickOutsideHandler = (e) => {
      if (!document.body.contains(msContainer)) {
        document.removeEventListener('click', clickOutsideHandler);
        return;
      }
      if (!msContainer.contains(e.target)) {
        dropdownList.style.display = 'none';
        searchInput.value = '';
      }
    };
    document.addEventListener('click', clickOutsideHandler);

    renderPills();
  });

  const selects = container.querySelectorAll('select.form-select');
  selects.forEach(select => {
    if (select.dataset.searchableInitialized) return;

    const morphToSearchable = () => {
      if (select.dataset.searchableInitialized === 'true') return;
      select.dataset.searchableInitialized = 'true';

      // Capture initial inline display BEFORE wrapping (avoids getComputedStyle on hidden parent)
      const initialDisplay = select.style.display === 'none' ? 'none' : '';

      // Create wrapper
      const wrapper = document.createElement('div');
      wrapper.className = 'searchable-dropdown-container';
      wrapper.style.display = initialDisplay;

      select.parentNode.insertBefore(wrapper, select);
      wrapper.appendChild(select);

      // Search input
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'form-input searchable-dropdown-input';
      input.autocomplete = 'off';
      if (select.id === 'f-request_type') {
        input.placeholder = typeof t === 'function' ? t('form.search_process', 'Search process (ID | Name)...') : 'Search process (ID | Name)...';
      } else {
        input.placeholder = select.options[0]?.textContent || t('form.search_placeholder', 'Type to search...');
      }
      const isSelectDisabled = () => select.disabled || select.readOnly || select.hasAttribute('disabled') || select.hasAttribute('readonly');
      if (isSelectDisabled()) {
        input.disabled = true;
        input.style.cursor = 'not-allowed';
        input.style.background = 'var(--bg-hover)';
        input.style.opacity = '0.8';
      }

      // Arrow icon
      const arrow = document.createElement('span');
      arrow.className = 'material-symbols-rounded searchable-dropdown-arrow';
      arrow.textContent = 'arrow_drop_down';
      if (isSelectDisabled()) {
        arrow.style.display = 'none';
      }

      // Result list
      const list = document.createElement('div');
      list.className = 'searchable-dropdown-list';
      list.style.display = 'none'; // Hidden by default

      // Toggle list on arrow click
      arrow.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isSelectDisabled() || input.disabled || input.readOnly) return;
        if (list.style.display === 'block') {
          list.style.display = 'none';
        } else {
          list.style.display = 'block';
          renderSuggestions('');
          input.focus();
        }
      });

      wrapper.appendChild(input);
      wrapper.appendChild(arrow);
      wrapper.appendChild(list);

      let highlightedIndex = -1;

      // Sync text input with the currently selected <option> label
      const syncSearchInput = () => {
        const selectedOpt = select.options[select.selectedIndex];
        if (selectedOpt && selectedOpt.value !== '') {
          let text = selectedOpt.textContent;
          if (selectedOpt.value.includes('@') && !selectedOpt.textContent.toLowerCase().includes(selectedOpt.value.toLowerCase())) {
            text = `${selectedOpt.textContent} (${selectedOpt.value})`;
          }
          input.value = text;
        } else {
          input.value = '';
        }
      };

      // Render ALL matching suggestions (no limit)
      const renderSuggestions = (query = '') => {
        list.innerHTML = '';
        highlightedIndex = -1;

        if (select.dataset.searchRequired === 'true' && query.trim() === '') {
          list.innerHTML = `<div class="searchable-dropdown-no-results">${typeof t === 'function' ? t('form.type_to_search', 'Type to search...') : 'Type to search...'}</div>`;
          return;
        }

        const q = query.toLowerCase();
        const filtered = Array.from(select.options).filter(opt => {
          if (opt.value === '') return false;
          const labelMatch = opt.textContent.toLowerCase().includes(q);
          const valueMatch = opt.value.toLowerCase().includes(q);
          const typeMatch = (opt.dataset.type || '').toLowerCase().includes(q);
          const nameMatch = (opt.dataset.name || '').toLowerCase().includes(q);
          const descMatch = (opt.dataset.desc || '').toLowerCase().includes(q);
          return labelMatch || valueMatch || typeMatch || nameMatch || descMatch;
        });

        if (filtered.length === 0) {
          list.innerHTML = `<div class="searchable-dropdown-no-results">${t('form.no_results', 'No results found')}</div>`;
          return;
        }

        filtered.forEach((opt) => {
          const item = document.createElement('div');
          item.className = 'searchable-dropdown-item';

          let displayLabel = opt.textContent;
          if (opt.value.includes('@') && !opt.textContent.toLowerCase().includes(opt.value.toLowerCase())) {
            displayLabel = `${opt.textContent} (${opt.value})`;
          }
          item.textContent = displayLabel;
          item.dataset.value = opt.value;
          if (opt.selected) item.classList.add('selected');

          item.addEventListener('click', (e) => {
            e.stopPropagation();
            select.value = opt.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            syncSearchInput();
            list.style.display = 'none'; // Close list on item selection
          });

          list.appendChild(item);
        });
      };

      // On focus/click: show full list immediately (all options)
      const showAllOptions = () => {
        list.style.display = 'block';
        renderSuggestions('');
      };
      input.addEventListener('focus', () => {
        if (isSelectDisabled() || input.disabled || input.readOnly) return;
        input.select();
        showAllOptions();
      });
      input.addEventListener('click', () => {
        if (isSelectDisabled() || input.disabled || input.readOnly) return;
        showAllOptions();
      });

      // Filter while typing; show all when cleared
      input.addEventListener('input', () => {
        if (isSelectDisabled() || input.disabled || input.readOnly) return;
        const val = input.value.trim();
        if (val === '') {
          if (select.value !== '') {
            select.value = '';
            select.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
        list.style.display = 'block';
        renderSuggestions(val);
      });

      input.addEventListener('blur', () => {
        setTimeout(() => {
          const val = input.value.trim();
          if (val === '') {
            if (select.value !== '') {
              select.value = '';
              select.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }
        }, 200);
      });

      // Keyboard navigation: Arrow / Enter / Escape
      input.addEventListener('keydown', (e) => {
        if (isSelectDisabled() || input.disabled || input.readOnly) return;
        const items = list.querySelectorAll('.searchable-dropdown-item');
        if (list.style.display === 'none') {
          if (e.key === 'ArrowDown') {
            list.style.display = 'block';
            renderSuggestions(input.value.trim());
            e.preventDefault();
          }
          return;
        }

        if (e.key === 'ArrowDown') {
          highlightedIndex = (highlightedIndex + 1) % items.length;
          updateHighlight(items);
          e.preventDefault();
        } else if (e.key === 'ArrowUp') {
          highlightedIndex = (highlightedIndex - 1 + items.length) % items.length;
          updateHighlight(items);
          e.preventDefault();
        } else if (e.key === 'Enter') {
          if (highlightedIndex >= 0 && highlightedIndex < items.length) {
            items[highlightedIndex].click();
          } else if (items.length > 0) {
            items[0].click();
          }
          e.preventDefault();
        } else if (e.key === 'Escape') {
          list.style.display = 'none'; // Close list on escape
          syncSearchInput(); // restore original selected label on escape
          e.preventDefault();
        }
      });

      const updateHighlight = (items) => {
        items.forEach((item, idx) => {
          item.classList.toggle('highlighted', idx === highlightedIndex);
          if (idx === highlightedIndex) item.scrollIntoView({ block: 'nearest' });
        });
      };

      // Redirect programmatic .focus() to the search input
      select.focus = () => input.focus();

      // ── Display sync: intercept style changes so wrapper follows show/hide ──
      const originalSetProperty = select.style.setProperty.bind(select.style);
      select.style.setProperty = function (prop, val, priority) {
        if (prop === 'display') {
          wrapper.style.display = val;
          // Always keep the raw <select> hidden regardless
          originalSetProperty('display', 'none', 'important');
          return;
        }
        originalSetProperty(prop, val, priority);
      };

      Object.defineProperty(select.style, 'display', {
        get() { return wrapper.style.display; },
        set(val) { wrapper.style.display = val; },
        configurable: true
      });

      // ── Value sync: update text input whenever .value is set programmatically ──
      const valueDescriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
      Object.defineProperty(select, 'value', {
        get() { return valueDescriptor.get.call(this); },
        set(val) {
          valueDescriptor.set.call(this, val);
          syncSearchInput();
        },
        configurable: true
      });

      // Watch for options being added/removed or disabled changes
      const observer = new MutationObserver(() => {
        const disabled = isSelectDisabled();
        input.disabled = disabled;
        input.style.cursor = disabled ? 'not-allowed' : 'pointer';
        input.style.background = disabled ? 'var(--bg-hover)' : '';
        input.style.opacity = disabled ? '0.8' : '';
        arrow.style.display = disabled ? 'none' : '';
        syncSearchInput();
        if (list.style.display === 'block') {
          renderSuggestions(input.value);
        }
      });
      observer.observe(select, { childList: true, attributes: true, attributeFilter: ['disabled'] });

      // Hide the raw <select> using the original (pre-intercept) setter
      originalSetProperty('display', 'none', 'important');

      // Populate input with current selection (if any) and pre-render suggestions
      syncSearchInput();
      renderSuggestions();
    };

    morphToSearchable();
  });
};

window.handleTargetTableChange = function () {
  const multiselectContainer = document.querySelector('.target-record-multiselect');
  if (!multiselectContainer) return;
  const checkboxStore = multiselectContainer.querySelector('.checkbox-store');
  const pillsContainer = multiselectContainer.querySelector('.selected-pills');
  const searchInput = multiselectContainer.querySelector('.multiselect-search-input');

  if (checkboxStore) checkboxStore.innerHTML = '';
  if (pillsContainer) pillsContainer.innerHTML = '';
  if (searchInput) {
    searchInput.value = '';
    searchInput.placeholder = 'Search and select...';
  }
  multiselectContainer.dataset.selected = '[]';
};

// Close any open suggestion list when clicking outside
document.addEventListener('click', (e) => {
  document.querySelectorAll('.searchable-dropdown-container').forEach(c => {
    if (!c.contains(e.target)) {
      const l = c.querySelector('.searchable-dropdown-list');
      if (l) l.style.display = 'none';
      const inp = c.querySelector('.searchable-dropdown-input');
      const sel = c.querySelector('select.form-select');
      if (inp && sel) {
        if (inp.value.trim() === '' && sel.value !== '') {
          sel.value = '';
          sel.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          // If clicked outside without selecting an option, revert search input to selected option's label
          const selectedOpt = sel.options ? sel.options[sel.selectedIndex] : null;
          if (selectedOpt && selectedOpt.value !== '') {
            let text = selectedOpt.textContent;
            if (selectedOpt.value.includes('@') && !selectedOpt.textContent.toLowerCase().includes(selectedOpt.value.toLowerCase())) {
              text = `${selectedOpt.textContent} (${selectedOpt.value})`;
            }
            inp.value = text;
          } else {
            inp.value = '';
          }
        }
      }
    }
  });
});

window.refreshSearchableDropdown = function (select) {
  if (!select) return;
  const wrapper = select.closest('.searchable-dropdown-container');
  if (!wrapper) return;
  const input = wrapper.querySelector('.searchable-dropdown-input');
  if (input) {
    const selectedOpt = select.options[select.selectedIndex];
    if (selectedOpt && selectedOpt.value !== '') {
      input.value = selectedOpt.textContent;
    } else {
      input.value = '';
      if (select.id === 'f-request_type') {
        input.placeholder = typeof t === 'function' ? t('form.search_process', 'Search process (ID | Name)...') : 'Search process (ID | Name)...';
      } else {
        input.placeholder = select.options[0]?.textContent || (typeof t === 'function' ? t('form.search_placeholder', 'Type to search...') : 'Type to search...');
      }
    }
  }
};

