/**
 * CRC App - Form Field Handlers, Allocations & Wizards
 * Extracted as part of Modularization
 * Contains value calculation handlers, allocations, mappings editor, embedded assign tasks
 */

window.handleInvoiceValueChange = function () {
  const valBeforeVatEl = document.getElementById('f-value_before_vat');
  const vatValueEl = document.getElementById('f-vat_value');
  const exchangeRateEl = document.getElementById('f-exchange_rate');
  const currencyEl = document.getElementById('f-currency');

  if (currencyEl && currencyEl.value === 'VND' && exchangeRateEl && !exchangeRateEl.value) {
    exchangeRateEl.value = '1';
  }

  const valueBeforeVat = parseFloat(String(valBeforeVatEl ? valBeforeVatEl.value : 0).replace(/,/g, '')) || 0;
  const vatValue = parseFloat(String(vatValueEl ? vatValueEl.value : 0).replace(/,/g, '')) || 0;
  const exchangeRate = parseFloat(String(exchangeRateEl ? exchangeRateEl.value : 1).replace(/,/g, '')) || 1;

  const valueInBase = Math.round(valueBeforeVat * exchangeRate);
  const vatValueInBase = Math.round(vatValue * exchangeRate);
  const totalValue = valueBeforeVat + vatValue;
  const totalValueInBase = Math.round(totalValue * exchangeRate);

  const valueInBaseEl = document.getElementById('f-value_before_vat_in_base_currency');
  const vatValueInBaseEl = document.getElementById('f-vat_value_in_base_currency');
  const totalValueEl = document.getElementById('f-total_value');
  const totalValueInBaseEl = document.getElementById('f-total_value_in_base_currency');

  if (valueInBaseEl) valueInBaseEl.value = formatNumber(valueInBase);
  if (vatValueInBaseEl) vatValueInBaseEl.value = formatNumber(vatValueInBase);
  if (totalValueEl) totalValueEl.value = formatNumber(totalValue);
  if (totalValueInBaseEl) totalValueInBaseEl.value = formatNumber(totalValueInBase);

  if (typeof updateFormBaseCurrencyLabels === 'function') updateFormBaseCurrencyLabels('invoice');
};

window.handlePaymentTypeChange = function () {
  const typeEl = document.getElementById('f-payment_type');
  const labelEl = document.querySelector('label[for="f-counter_party"]');
  if (typeEl && labelEl) {
    const val = String(typeEl.value || '').toLowerCase();
    const isIncoming = val === '60' || val === 'incoming';
    const text = isIncoming ? 'Pay From' : 'Pay To';
    const key = isIncoming ? 'col.pay_from' : 'col.pay_to';
    const uppercaseLabel = (typeof t === 'function' ? t(key, text) : text).toUpperCase();
    const fieldCfg = MODULES['payment'].fields.find(f => f.key === 'counter_party');
    const isRequiredField = fieldCfg && fieldCfg.required;
    const requiredIndicator = isRequiredField ? ' <span class="required-asterisk" style="color: #EF4444; font-weight: bold;">*</span>' : '';
    labelEl.innerHTML = `${uppercaseLabel}${requiredIndicator}`;
  }
};

window.handlePaymentValueChange = function () {
  const valueEl = document.getElementById('f-value');
  const exchangeRateEl = document.getElementById('f-exchange_rate');
  const currencyEl = document.getElementById('f-currency');

  if (currencyEl && currencyEl.value === 'VND' && exchangeRateEl && !exchangeRateEl.value) {
    exchangeRateEl.value = '1';
  }

  const value = parseFloat(String(valueEl ? valueEl.value : 0).replace(/,/g, '')) || 0;
  const exchangeRate = parseFloat(String(exchangeRateEl ? exchangeRateEl.value : 1).replace(/,/g, '')) || 1;

  const valueInBase = Math.round(value * exchangeRate);

  const valueInBaseEl = document.getElementById('f-value_in_base_currency');
  if (valueInBaseEl) valueInBaseEl.value = formatNumber(valueInBase);

  if (typeof updateFormBaseCurrencyLabels === 'function') updateFormBaseCurrencyLabels('payment');
};

window.handleAssetValueChange = function () {
  const costEl = document.getElementById('f-purchase_cost');
  const exchangeRateEl = document.getElementById('f-exchange_rate');
  const currencyEl = document.getElementById('f-currency');

  if (currencyEl && currencyEl.value === 'VND' && exchangeRateEl && !exchangeRateEl.value) {
    exchangeRateEl.value = '1';
  }

  const cost = parseFloat(String(costEl ? costEl.value : 0).replace(/,/g, '')) || 0;
  const exchangeRate = parseFloat(String(exchangeRateEl ? exchangeRateEl.value : 1).replace(/,/g, '')) || 1;

  const valueInBase = Math.round(cost * exchangeRate);

  const valueInBaseEl = document.getElementById('f-value_in_base_currency');
  if (valueInBaseEl) valueInBaseEl.value = formatNumber(valueInBase);

  if (typeof updateFormBaseCurrencyLabels === 'function') updateFormBaseCurrencyLabels('asset');
};

window.handleExpenseValueChange = function () {
  const valBeforeVatEl = document.getElementById('f-value_before_vat');
  const vatValueEl = document.getElementById('f-vat_value');
  const exchangeRateEl = document.getElementById('f-exchange_rate');
  const currencyEl = document.getElementById('f-id__currency');

  if (currencyEl && currencyEl.value === 'VND' && exchangeRateEl && !exchangeRateEl.value) {
    exchangeRateEl.value = '1';
  }

  const valueBeforeVat = parseFloat(String(valBeforeVatEl ? valBeforeVatEl.value : 0).replace(/,/g, '')) || 0;
  const vatValue = parseFloat(String(vatValueEl ? vatValueEl.value : 0).replace(/,/g, '')) || 0;
  const exchangeRate = parseFloat(String(exchangeRateEl ? exchangeRateEl.value : 1).replace(/,/g, '')) || 1;

  const valueInBase = Math.round(valueBeforeVat * exchangeRate);
  const vatValueInBase = Math.round(vatValue * exchangeRate);
  const totalValue = valueBeforeVat + vatValue;
  const totalValueInBase = Math.round(totalValue * exchangeRate);

  const valueInBaseEl = document.getElementById('f-value_before_vat_in_base_currency');
  const vatValueInBaseEl = document.getElementById('f-vat_value_in_base_currency');
  const totalValueEl = document.getElementById('f-total_value');
  const totalValueInBaseEl = document.getElementById('f-total_value_in_base_currency');

  if (valueInBaseEl) valueInBaseEl.value = formatNumber(valueInBase);
  if (vatValueInBaseEl) vatValueInBaseEl.value = formatNumber(vatValueInBase);
  if (totalValueEl) totalValueEl.value = formatNumber(totalValue);
  if (totalValueInBaseEl) totalValueInBaseEl.value = formatNumber(totalValueInBase);

  if (typeof updateFormBaseCurrencyLabels === 'function') updateFormBaseCurrencyLabels('expense');
};

window.handleExpenseRequestChange = async function () {
  const reqSelect = document.getElementById('f-id__request');
  const fySelect = document.getElementById('f-fy');
  if (!reqSelect || !fySelect || !reqSelect.value) return;

  try {
    const reqs = await getSelectOptions('request');
    const req = reqs.find(r => String(r.request_id) === String(reqSelect.value));
    if (req && (req.sr_created_date || req.created_date || req.created_at)) {
      const d = new Date(req.sr_created_date || req.created_date || req.created_at);
      if (!isNaN(d.getFullYear())) {
        const yearStr = String(d.getFullYear());
        let optExists = Array.from(fySelect.options).some(o => o.value === yearStr);
        if (!optExists) {
          const newOpt = document.createElement('option');
          newOpt.value = yearStr;
          newOpt.textContent = yearStr;
          fySelect.appendChild(newOpt);
        }
        fySelect.value = yearStr;
        fySelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  } catch (err) {
    console.warn('Error handling expense request change:', err);
  }
};

window.handleContractValueChange = function () {
  const valBeforeVatEl = document.getElementById('f-value_before_vat');
  const vatValueEl = document.getElementById('f-vat_value');
  const exchangeRateEl = document.getElementById('f-exchance_rate');
  const currencyEl = document.getElementById('f-currency');

  if (currencyEl && currencyEl.value === 'VND' && exchangeRateEl && !exchangeRateEl.value) {
    exchangeRateEl.value = '1';
  }

  const valueBeforeVat = parseFloat(String(valBeforeVatEl ? valBeforeVatEl.value : 0).replace(/,/g, '')) || 0;
  const vatValue = parseFloat(String(vatValueEl ? vatValueEl.value : 0).replace(/,/g, '')) || 0;
  const exchangeRate = parseFloat(String(exchangeRateEl ? exchangeRateEl.value : 1).replace(/,/g, '')) || 1;

  const valueInBase = Math.round(valueBeforeVat * exchangeRate);
  const vatValueInBase = Math.round(vatValue * exchangeRate);
  const totalValue = valueBeforeVat + vatValue;
  const totalValueInBase = Math.round(totalValue * exchangeRate);

  const valueInBaseEl = document.getElementById('f-value_before_vat_in_base_currency');
  const vatValueInBaseEl = document.getElementById('f-vat_value_in_base_currency');
  const totalValueEl = document.getElementById('f-total_value');
  const totalValueInBaseEl = document.getElementById('f-total_value_in_base_currency');

  if (valueInBaseEl) valueInBaseEl.value = formatNumber(valueInBase);
  if (vatValueInBaseEl) vatValueInBaseEl.value = formatNumber(vatValueInBase);
  if (totalValueEl) totalValueEl.value = formatNumber(totalValue);
  if (totalValueInBaseEl) totalValueInBaseEl.value = formatNumber(totalValueInBase);

  if (typeof updateFormBaseCurrencyLabels === 'function') updateFormBaseCurrencyLabels('contract');
};

window.updateFormBaseCurrencyLabels = function (moduleKey) {
  let baseCurrency = null;

  // Check company select elements in active form
  const compEl = document.getElementById('f-my_company') || document.getElementById('f-company_entity') || document.getElementById('f-id__my_company');
  if (compEl && compEl.value && selectCache && selectCache['my_company']) {
    const comp = selectCache['my_company'].find(c => String(c.my_company_id) === String(compEl.value) || c.company_shortname === compEl.value);
    if (comp && comp.base_currency) baseCurrency = comp.base_currency;
  }
  // Check request company if request is selected
  if (!baseCurrency) {
    const reqEl = document.getElementById('f-request') || document.getElementById('f-id__request');
    if (reqEl && reqEl.value && selectCache && selectCache['request'] && selectCache['my_company']) {
      const req = selectCache['request'].find(r => String(r.request_id) === String(reqEl.value));
      if (req && req.company_id) {
        const comp = selectCache['my_company'].find(c => String(c.my_company_id) === String(req.company_id) || c.company_shortname === req.company_id);
        if (comp && comp.base_currency) baseCurrency = comp.base_currency;
      }
    }
  }
  if (!baseCurrency && typeof window.getActiveBaseCurrency === 'function') {
    baseCurrency = window.getActiveBaseCurrency();
  }
  if (!baseCurrency || baseCurrency === 'Base Currency') baseCurrency = 'VND';

  const isVi = (typeof currentLang !== 'undefined' ? currentLang : 'en') === 'vi';

  function setFieldLabel(fieldKey, labelText) {
    const labelEl = document.querySelector(`label[for="f-${fieldKey}"]`);
    if (!labelEl) return;
    const firstChild = labelEl.firstChild;
    if (firstChild && firstChild.nodeType === Node.TEXT_NODE) {
      firstChild.textContent = labelText + ' ';
    } else {
      labelEl.insertBefore(document.createTextNode(labelText + ' '), labelEl.firstChild);
    }
  }

  if (moduleKey === 'payment') {
    setFieldLabel('value_in_base_currency', isVi ? `GIÁ TRỊ THEO ${baseCurrency}` : `VALUE IN ${baseCurrency}`);
  } else if (moduleKey === 'asset') {
    setFieldLabel('value_in_base_currency', isVi ? `GIÁ MUA THEO ${baseCurrency}` : `PURCHASE COST IN ${baseCurrency}`);
  } else if (moduleKey === 'contract' || moduleKey === 'expense' || moduleKey === 'invoice') {
    setFieldLabel('value_before_vat_in_base_currency', isVi ? `GIÁ TRỊ TRƯỚC VAT THEO ${baseCurrency}` : `VALUE BEFORE VAT IN ${baseCurrency}`);
    setFieldLabel('vat_value_in_base_currency', isVi ? `GIÁ TRỊ VAT THEO ${baseCurrency}` : `VAT VALUE IN ${baseCurrency}`);
    setFieldLabel('total_value_in_base_currency', isVi ? `TỔNG GIÁ TRỊ THEO ${baseCurrency}` : `TOTAL VALUE IN ${baseCurrency}`);
  } else if (moduleKey === 'account') {
    setFieldLabel('balance_in_base_currency', isVi ? `SỐ DƯ THEO ${baseCurrency}` : `BALANCE IN ${baseCurrency}`);
  }
};

async function updateAssetBaseCurrencyLabel() {
  if (typeof updateFormBaseCurrencyLabels === 'function') {
    updateFormBaseCurrencyLabels('asset');
  }
}

window.openCustomSelectAddDropdown = function (fieldKey) {
  const input = document.getElementById(`f-${fieldKey}`);
  const dropdown = document.getElementById(`dropdown-${fieldKey}`);
  if (!input || !dropdown) return;

  document.querySelectorAll('.custom-select-add-dropdown').forEach(d => {
    if (d.id !== `dropdown-${fieldKey}`) d.style.display = 'none';
  });

  dropdown.style.display = 'block';

  const currentVal = input.value.trim().toLowerCase();

  // Show all options when opening the dropdown initially and highlight the selected one
  const items = dropdown.querySelectorAll('.custom-select-add-item:not(.add-new-item)');
  items.forEach(item => {
    item.style.display = 'block';
    const itemText = item.textContent.trim().toLowerCase();
    if (currentVal && itemText === currentVal) {
      item.style.background = '#E2E8F0';
      item.style.fontWeight = '600';
    } else {
      item.style.background = 'transparent';
      item.style.fontWeight = 'normal';
    }
  });

  // Hide "+ Add new data" option initially
  const addNew = document.getElementById(`add-new-${fieldKey}`);
  if (addNew) addNew.style.display = 'none';
};

window.filterCustomSelectAddDropdown = function (fieldKey) {
  const input = document.getElementById(`f-${fieldKey}`);
  const dropdown = document.getElementById(`dropdown-${fieldKey}`);
  const addNew = document.getElementById(`add-new-${fieldKey}`);
  if (!input || !dropdown || !addNew) return;

  const q = input.value.trim().toLowerCase();
  const items = dropdown.querySelectorAll('.custom-select-add-item:not(.add-new-item)');

  let exactMatch = false;
  let visibleCount = 0;

  items.forEach(item => {
    const text = item.textContent.trim();
    const textLower = text.toLowerCase();
    if (textLower === q) {
      exactMatch = true;
    }
    if (textLower.includes(q)) {
      item.style.display = 'block';
      visibleCount++;
    } else {
      item.style.display = 'none';
    }
  });

  if (input.value.trim() !== '' && !exactMatch) {
    addNew.style.display = 'block';
    const span = addNew.querySelector('.new-val-span');
    if (span) span.textContent = input.value.trim();
  } else {
    addNew.style.display = 'none';
  }
};

window.selectCustomSelectAddValue = function (fieldKey, value) {
  const input = document.getElementById(`f-${fieldKey}`);
  const dropdown = document.getElementById(`dropdown-${fieldKey}`);
  if (!input || !dropdown) return;

  input.value = value;
  dropdown.style.display = 'none';

  triggerCustomSelectAddChange(input);
};

window.addNewCustomSelectAddValue = function (fieldKey) {
  const input = document.getElementById(`f-${fieldKey}`);
  const dropdown = document.getElementById(`dropdown-${fieldKey}`);
  const addNew = document.getElementById(`add-new-${fieldKey}`);
  if (!input || !dropdown || !addNew) return;

  const newVal = input.value.trim();
  if (newVal === '') return;

  let exists = false;
  const items = dropdown.querySelectorAll('.custom-select-add-item:not(.add-new-item)');
  items.forEach(item => {
    if (item.textContent.trim().toLowerCase() === newVal.toLowerCase()) {
      exists = true;
      input.value = item.textContent.trim();
    }
  });

  if (!exists) {
    const newItem = document.createElement('div');
    newItem.className = 'custom-select-add-item';
    newItem.style.cssText = "padding: 8px 12px; cursor: pointer; font-size: 13px; color: #1E293B; transition: background 0.15s ease;";
    newItem.textContent = newVal;
    newItem.onmouseover = function () { this.style.background = '#F1F5F9'; };
    newItem.onmouseout = function () {
      const inp = document.getElementById(`f-${fieldKey}`);
      const selected = (inp && inp.value.trim().toLowerCase() === this.textContent.trim().toLowerCase());
      this.style.background = selected ? '#E2E8F0' : 'transparent';
    };
    newItem.onmousedown = function () {
      selectCustomSelectAddValue(fieldKey, newVal);
    };

    dropdown.insertBefore(newItem, addNew);
    input.value = newVal;
  }

  dropdown.style.display = 'none';
  triggerCustomSelectAddChange(input);
};

window.handleCustomSelectAddKeydown = function (event, fieldKey) {
  const dropdown = document.getElementById(`dropdown-${fieldKey}`);
  if (!dropdown) return;

  if (event.key === 'Escape') {
    dropdown.style.display = 'none';
  } else if (event.key === 'Enter') {
    const addNew = document.getElementById(`add-new-${fieldKey}`);
    if (addNew && addNew.style.display === 'block') {
      event.preventDefault();
      window.addNewCustomSelectAddValue(fieldKey);
    }
  }
};

function triggerCustomSelectAddChange(input) {
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));

  const customOnChange = input.getAttribute('data-onchange');
  if (customOnChange) {
    try {
      const fn = new Function(customOnChange);
      fn.call(input);
    } catch (e) {
      console.error('Error running custom onchange handler:', e);
    }
  }
  const customOnInput = input.getAttribute('data-oninput');
  if (customOnInput) {
    try {
      const fn = new Function(customOnInput);
      fn.call(input);
    } catch (e) {
      console.error('Error running custom oninput handler:', e);
    }
  }
}

// Close dropdown when clicking outside
document.addEventListener('mousedown', function (event) {
  if (!event.target.closest('.custom-select-add-container')) {
    document.querySelectorAll('.custom-select-add-dropdown').forEach(d => {
      d.style.display = 'none';
    });
  }
  if (!event.target.closest('.custom-alloc-select-container')) {
    document.querySelectorAll('.alloc-program-dropdown').forEach(d => {
      d.style.display = 'none';
    });
  }
});

// Handler khi user chọn Request trong form Asset
window.handleAssetRequestChange = function () {
  updateAssetBaseCurrencyLabel();
  // Cũng trigger lại asset type change để cập nhật company prefix trong asset code
  handleAssetTypeChange();
};

window.handleAssetTypeChange = function () {
  const codeEl = document.getElementById('f-office_asset_id');
  const typeEl = document.getElementById('f-type');

  // Chỉ sinh lại nếu field trống HOẶC là ID đã được auto-generate trước đó
  const isEmpty = !codeEl.value || codeEl.value.trim() === '';
  const isAutoGenerated = codeEl && codeEl.dataset.autogenerated === 'true';

  if (codeEl && (isEmpty || isAutoGenerated) && typeEl && typeEl.value) {
    let companyPrefix = 'CO';
    if (authUser && authUser.company_id && selectCache['my_company']) {
      const comp = selectCache['my_company'].find(c => String(c.my_company_id) === String(authUser.company_id));
      if (comp && comp.company_shortname) {
        companyPrefix = getCompanyAbbreviation(comp.company_shortname);
      }
    }

    const reqEl = document.getElementById('f-request');
    if (reqEl && reqEl.value && selectCache['request']) {
      const req = selectCache['request'].find(r => r.request_id === reqEl.value);
      if (req && req.company_id) {
        companyPrefix = getCompanyAbbreviation(req.company_id);
      }
    }

    let typePrefix = 'OTH';
    const val = typeEl.value.toLowerCase();
    if (val.includes('accessories')) {
      typePrefix = 'ACC';
    } else if (val.includes('nội thất') || val.includes('furniture')) {
      typePrefix = 'FUR';
    } else if (val.includes('electronics')) {
      typePrefix = 'ELE';
    }

    const vnDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
    const dd = String(vnDate.getDate()).padStart(2, '0');
    const mm = String(vnDate.getMonth() + 1).padStart(2, '0');
    const yy = String(vnDate.getFullYear()).slice(-2);
    const dateStr = `${dd}${mm}${yy}`;

    const rand = Math.floor(1000 + Math.random() * 9000);
    codeEl.value = `${companyPrefix}-${typePrefix}-${dateStr}-${rand}`;
    // Đánh dấu là auto-generated để lần đổi type tiếp theo vẫn cập nhật
    codeEl.dataset.autogenerated = 'true';
    // Khi user tự sửa field thì bỏ flag auto-generated
    codeEl.oninput = function () { codeEl.dataset.autogenerated = 'false'; };
  }
};

window.handleServiceTypeChange = function () {
  const codeEl = document.getElementById('f-service_id');
  const typeEl = document.getElementById('f-service_type');

  // Chỉ sinh lại nếu field trống HOẶC là ID đã được auto-generate trước đó
  const isEmpty = !codeEl.value || codeEl.value.trim() === '';
  const isAutoGenerated = codeEl && codeEl.dataset.autogenerated === 'true';

  if (codeEl && (isEmpty || isAutoGenerated) && typeEl && typeEl.value) {
    let companyPrefix = 'CO';
    const compEl = document.getElementById('f-my_company');
    if (compEl && compEl.value) {
      companyPrefix = getCompanyAbbreviation(compEl.value);
    } else if (authUser && authUser.company_id && selectCache['my_company']) {
      const comp = selectCache['my_company'].find(c => String(c.my_company_id) === String(authUser.company_id));
      if (comp && comp.company_shortname) {
        companyPrefix = getCompanyAbbreviation(comp.company_shortname);
      }
    }

    let typePrefix = 'OTH';
    const val = String(typeEl.value || '').toLowerCase().trim();
    if (val === '81' || val.includes('sub')) {
      typePrefix = 'SUB';
    } else if (val === '85' || val.includes('làm mới') || val.includes('renew')) {
      typePrefix = 'REN';
    } else if (val === '83' || val.includes('rental') || val.includes('thuê')) {
      typePrefix = 'REN';
    } else if (val === '84' || val.includes('borrow') || val.includes('mượn')) {
      typePrefix = 'BOR';
    } else if (val === '82' || val.includes('1 time') || val.includes('1-time') || val.includes('one time')) {
      typePrefix = 'OTS';
    } else if (val.includes('technical') || val.includes('support')) {
      typePrefix = 'TEC';
    }

    const vnDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
    const dd = String(vnDate.getDate()).padStart(2, '0');
    const mm = String(vnDate.getMonth() + 1).padStart(2, '0');
    const yy = String(vnDate.getFullYear()).slice(-2);
    const dateStr = `${dd}${mm}${yy}`;

    const rand = Math.floor(1000 + Math.random() * 9000);
    codeEl.value = `${companyPrefix}-${typePrefix}-${dateStr}-${rand}`;
    // Đánh dấu là auto-generated để lần đổi type tiếp theo vẫn cập nhật
    codeEl.dataset.autogenerated = 'true';
    // Khi user tự sửa field thì bỏ flag auto-generated
    codeEl.oninput = function () { codeEl.dataset.autogenerated = 'false'; };
  }
};

window.handleCounterPartyTypeChange = function (fieldKey) {
  const typeSelect = document.getElementById(`f-${fieldKey}-type`);
  const companySelect = document.getElementById(`f-${fieldKey}-company-select`);
  const employeeSelect = document.getElementById(`f-${fieldKey}-employee-select`);

  if (typeSelect && companySelect && employeeSelect) {
    if (typeSelect.value === 'company') {
      companySelect.style.setProperty('display', 'block', 'important');
      employeeSelect.style.setProperty('display', 'none', 'important');
    } else {
      companySelect.style.setProperty('display', 'none', 'important');
      employeeSelect.style.setProperty('display', 'block', 'important');
    }
    window.updateCounterPartyHiddenVal(fieldKey);
  }
};

window.updateCounterPartyHiddenVal = function (fieldKey) {
  const typeSelect = document.getElementById(`f-${fieldKey}-type`);
  const companySelect = document.getElementById(`f-${fieldKey}-company-select`);
  const employeeSelect = document.getElementById(`f-${fieldKey}-employee-select`);
  const hiddenInput = document.getElementById(`f-${fieldKey}`);

  if (typeSelect && companySelect && employeeSelect && hiddenInput) {
    const type = typeSelect.value;
    const id = type === 'company' ? companySelect.value : employeeSelect.value;

    if (!id) {
      hiddenInput.value = '';
    } else {
      hiddenInput.value = JSON.stringify({ type, id });
    }
    hiddenInput.dispatchEvent(new Event('input', { bubbles: true }));
    hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
  }
};

window.duplicateRecord = async function (moduleKey, pkVal) {
  const nonDuplicable = ['logs', 'request_activity_log', 'history', 'request_rating', 'rating', 'feedback', 'comment', 'ticket_comment', 'finance', 'assigned_task'];
  if (nonDuplicable.includes(moduleKey)) return;
  const mod = MODULES[moduleKey];
  if (!mod) return;
  const endpointPath = getRecordEndpoint(moduleKey, pkVal);

  let record;
  try {
    record = await apiGet(endpointPath);
  } catch (err) {
    showToast(err.message, 'error');
    return;
  }

  const initialData = { ...record };
  if (mod.pk) {
    delete initialData[mod.pk];
  }

  // Strip audit/meta fields for a clean copy
  const auditFields = ['created_by', 'created_date', 'updated_by', 'updated_date', 'log', 'logs', 'notification_logs', 'deleted_at'];
  auditFields.forEach(f => delete initialData[f]);

  // Clean numeric strings with excessive decimal zeros from DB (e.g., exchange_rate: "1.000000" -> 1)
  for (const [k, v] of Object.entries(initialData)) {
    if (typeof v === 'string' && /^-?\d+\.\d+$/.test(v.trim())) {
      const num = parseFloat(v);
      if (!isNaN(num)) {
        initialData[k] = num;
      }
    }
  }

  if (moduleKey === 'request' || ['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(moduleKey)) {
    delete initialData.request_id;
    initialData.sr_status = 'Draft';
    initialData.approval_status = 'Pending Approval';
    initialData.process_status = 'Not started yet';
    initialData.sr_submitted_date = new Date().toISOString().split('T')[0];
    for (let i = 1; i <= 3; i++) {
      delete initialData[`tier_${i}_approval`];
      delete initialData[`tier_${i}_status`];
      delete initialData[`tier_${i}_update_date`];
    }
  } else if (moduleKey === 'payment') {
    delete initialData.payment_id;
    initialData.payment_status = 'Draft';
    delete initialData.payment_date;
    delete initialData.transaction_id;
    delete initialData.payment_request;
    delete initialData.due_date;
    delete initialData.payment_period;
  } else if (moduleKey === 'invoice') {
    delete initialData.invoice_id;
    initialData.invoice_status = 'Draft';
    delete initialData.invoice_date;
    delete initialData.payment_id;
  } else if (moduleKey === 'contract') {
    delete initialData.contract_id;
    initialData.status = 'Draft';
  } else if (moduleKey === 'expense') {
    delete initialData.expense_id;
  } else if (moduleKey === 'asset') {
    delete initialData.asset_id;
  } else if (moduleKey === 'service') {
    delete initialData.service_id;
  } else if (moduleKey === 'oppotunity') {
    delete initialData.project_id;
  } else if (moduleKey === 'mtr') {
    delete initialData.transaction_id;
  }

  const resolvedAddKey = ['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(moduleKey) ? 'request' : moduleKey;
  await openAddModal(resolvedAddKey, initialData);
};


// My Views Dashboard extracted to js/views/myViewsDashboard.js
// Fix 1: Track table scroll position
document.addEventListener('scroll', (e) => {
  if (currentView === 'table' && currentModule) {
    if (e.target.classList && e.target.classList.contains('table-wrapper')) {
      if (!moduleStates[currentModule]) moduleStates[currentModule] = {};
      moduleStates[currentModule].scrollTop = e.target.scrollTop;
    }
  }
}, true);

// Bulk Actions extracted to js/services/bulkActionService.js
// Setup Wizard extracted to js/views/setupWizard.js

window.switchFormTab = function (btn, tabId) {
  const container = btn.closest('.modal-body') || document;
  container.querySelectorAll('.form-tab-btn').forEach(b => b.classList.remove('active'));
  container.querySelectorAll('.form-tab-pane').forEach(p => p.classList.remove('active'));

  btn.classList.add('active');
  const targetPane = container.querySelector('#' + tabId);
  if (targetPane) targetPane.classList.add('active');
};

window.switchDetailLeftTab = function (btn, tabId) {
  const container = btn.closest('.detail-left') || document;
  container.querySelectorAll('.detail-left-tab-btn').forEach(b => b.classList.remove('active'));
  container.querySelectorAll('.detail-left-tab-pane').forEach(p => p.classList.remove('active'));

  btn.classList.add('active');
  const targetPane = container.querySelector('#' + tabId);
  if (targetPane) targetPane.classList.add('active');
};

// Searchable Dropdowns & Multiselect extracted to js/components/searchableDropdown.js

// ============================================================
// CUSTOM WORKFLOW ACTIONS & DYNAMIC FORM FILTERING HELPERS
// ============================================================

function setFormModalButtons(moduleKey, pkVal = null) {
  const footer = document.querySelector('#form-modal .modal-footer');
  if (!footer) return;

  if (['request', 'my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(moduleKey)) {
    footer.innerHTML = `
      <button class="btn btn-secondary" onclick="handleFormClose('form-modal')" data-i18n="form.cancel">${t('form.cancel', 'Cancel')}</button>
      <button class="btn btn-secondary" style="border: 1px solid #CBD5E1; background: #F8FAFC;" id="form-modal-draft" onclick="submitRequestForm('Draft', '${moduleKey}', ${pkVal ? `'${pkVal}'` : 'null'})">${t('form.save_draft', 'Save Draft')}</button>
      <button class="btn btn-primary" id="form-modal-save" onclick="submitRequestForm('Submitted', '${moduleKey}', ${pkVal ? `'${pkVal}'` : 'null'})">${t('form.submit', 'Submit')}</button>
    `;
  } else {
    footer.innerHTML = `
      <button class="btn btn-secondary" onclick="handleFormClose('form-modal')" data-i18n="form.cancel">${t('form.cancel', 'Cancel')}</button>
      <button class="btn btn-primary" id="form-modal-save" onclick="submitForm()" data-i18n="form.save">${t('form.save', 'Save')}</button>
    `;
  }
}

window.submitRequestForm = async function (status, moduleKey, pkVal) {
  const saveBtn = document.getElementById('form-modal-save');
  const draftBtn = document.getElementById('form-modal-draft');
  if ((saveBtn && saveBtn._isSaving) || (draftBtn && draftBtn._isSaving)) return;

  const statusInput = document.getElementById('f-sr_status');
  if (statusInput) {
    statusInput.value = status;
  }
  const requestSubmitData = ['Submitted', 'Pending Approval', 'Submit'].includes(status)
    ? { sr_status: 'Pending Approval' }
    : { sr_status: status };

  try {
    if (pkVal) {
      await submitEdit(moduleKey, pkVal, requestSubmitData);
    } else {
      await submitAdd(moduleKey, requestSubmitData);
    }
  } catch (err) {
    console.error(err);
  } finally {
    resetSaveButton(saveBtn);
  }
};

window.handleRequestCompanyChange = async function () {
  const companyEl = document.getElementById('f-company_id');
  const typeEl = document.getElementById('f-request_type');
  if (!companyEl || !typeEl) return;

  const selectedCompany = companyEl.value;

  try {
    const policies = await getSelectOptions('policy');
    const companies = await getSelectOptions('my_company');

    const compObj = companies.find(c => String(c.my_company_id) === String(selectedCompany) || c.company_shortname === selectedCompany);
    const companyId = compObj ? String(compObj.my_company_id) : null;

    const filteredPolicies = policies;
    const currentVal = typeEl.value;

    typeEl.innerHTML = '<option value="">-- Select --</option>' +
      filteredPolicies.map(p => {
        const lbl = window.formatProcessLabel(p);
        const pType = p.policy_type || '';
        const pName = p.policy_name || p.ticket_name || p.name || '';
        return `<option value="${p.policy_id}" data-type="${escapeHTML(pType)}" data-name="${escapeHTML(pName)}">${escapeHTML(lbl)}</option>`;
      }).join('');

    if (currentVal && filteredPolicies.some(p => String(p.policy_id) === String(currentVal))) {
      typeEl.value = currentVal;
    } else {
      typeEl.value = '';
      // Reset policy details and visibility if policy selection is no longer valid
      updateProcessDescriptionDetails(null);
      updateApprovalLevelVisibility(null);
    }

    // Refresh searchable dropdown for f-request_type
    if (typeof window.refreshSearchableDropdown === 'function') {
      window.refreshSearchableDropdown(typeEl);
    }
  } catch (err) {
    console.error('Error in handleRequestCompanyChange:', err);
  }
};

window.handlePaymentCompanyChange = async function () {
  const companyEl = document.getElementById('f-my_company');
  const currencyEl = document.getElementById('f-currency');
  if (!companyEl || !currencyEl) return;

  const companyValue = companyEl.value;
  if (!companyValue) return;

  try {
    const companies = await getSelectOptions('my_company');
    const comp = companies.find(c => String(c.my_company_id) === String(companyValue) || c.company_shortname === companyValue);
    if (comp && comp.base_currency) {
      currencyEl.value = comp.base_currency;

      // Update searchable dropdown representation
      const container = currencyEl.closest('.searchable-dropdown-container');
      if (container && typeof initializeSearchableDropdowns === 'function') {
        initializeSearchableDropdowns(container.parentElement);
      }

      if (window.handlePaymentValueChange) {
        window.handlePaymentValueChange();
      }
    }
  } catch (err) {
    console.warn('Error in handlePaymentCompanyChange:', err);
  }
};

window.openChangePasswordModal = function () {
  const form = document.getElementById('change-password-form');
  if (form) form.reset();
  const errorMsg = document.getElementById('cp-error-msg');
  if (errorMsg) {
    errorMsg.style.display = 'none';
    errorMsg.textContent = '';
  }
  openModal('change-password-modal');
};

window.submitChangePassword = async function (event) {
  event.preventDefault();
  const oldPassword = document.getElementById('cp-old-password').value;
  const newPassword = document.getElementById('cp-new-password').value;
  const confirmPassword = document.getElementById('cp-confirm-password').value;
  const errorMsg = document.getElementById('cp-error-msg');

  if (newPassword !== confirmPassword) {
    errorMsg.textContent = (typeof t === 'function' ? t('toast.passwords_do_not_match', 'Mật khẩu mới không trùng khớp!') : 'Mật khẩu mới không trùng khớp!');
    errorMsg.style.display = 'block';
    return;
  }

  try {
    const res = await apiPost('/auth/change-password', { oldPassword, newPassword });
    closeModal('change-password-modal');
    showToast(res.message || 'Đổi mật khẩu thành công!', 'success');
  } catch (err) {
    errorMsg.textContent = err.message || 'Có lỗi xảy ra.';
    errorMsg.style.display = 'block';
  }
};

window.releaseTenantUserSeat = async function (email) {
  const confirmMsg = typeof t === 'function'
    ? t('seat.confirm_release', 'Bạn có chắc chắn muốn giải phóng seat cho user này không?')
    : 'Bạn có chắc chắn muốn giải phóng seat cho user này không?';

  if (!confirm(confirmMsg)) return;

  try {
    const releasingMsg = typeof t === 'function' ? t('seat.releasing', 'Đang giải phóng seat...') : 'Đang giải phóng seat...';
    showToast(releasingMsg, 'info');

    await apiPost('/employees/tenant-seats/release', { email });

    const successMsg = typeof t === 'function' ? t('seat.release_success', 'Giải phóng seat thành công') : 'Giải phóng seat thành công';
    showToast(successMsg, 'success');

    // Refresh the detail view if we are still on the cms_tenant_info tab
    const hash = window.location.hash;
    const parts = hash.replace('#', '').split('/');
    if (parts[0] === 'cms_tenant_info' && parts[1]) {
      openDetailInternal('cms_tenant_info', parts[1], true);
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.resolveFinanceAccountLabel = function (fcid) {
  if (typeof selectCache !== 'undefined' && selectCache['finance']) {
    const matched = selectCache['finance'].find(f => String(f.fcid) === String(fcid));
    if (matched) {
      return matched.finance_account_number + ' | ' + matched.finance_account_name;
    }
  }
  return fcid || '';
};

window.toggleTableSort = function (moduleKey, colKey) {
  if (!moduleStates[moduleKey]) moduleStates[moduleKey] = {};
  const currentState = moduleStates[moduleKey];
  if (currentState.sort_by === colKey) {
    currentState.sort_dir = currentState.sort_dir === 'ASC' ? 'DESC' : 'ASC';
  } else {
    currentState.sort_by = colKey;
    currentState.sort_dir = 'DESC';
  }
  renderTableView(moduleKey, 1, false);
};

window.getSortIcon = function (moduleKey, colKey) {
  const state = moduleStates[moduleKey];
  if (!state || state.sort_by !== colKey) return ' <span style="font-size:10px; opacity:0.3;">↕</span>';
  return state.sort_dir === 'ASC' ? ' <span style="font-size:10px; color:var(--accent);">↑</span>' : ' <span style="font-size:10px; color:var(--accent);">↓</span>';
};

window.setFinanceDateFilter = function (moduleKey, field, value) {
  if (!moduleStates[moduleKey]) moduleStates[moduleKey] = {};
  if (value) {
    moduleStates[moduleKey][field] = value;
  } else {
    delete moduleStates[moduleKey][field];
  }
  moduleStates[moduleKey].page = 1;
  moduleStates[moduleKey].scrollTop = 0;
  renderTableView(moduleKey, 1, false);
};

window.setFinanceQuickFyFilter = function (value) {
  const moduleKey = 'finance';
  if (!activeDropdownFilters[moduleKey]) activeDropdownFilters[moduleKey] = {};
  if (value) {
    activeDropdownFilters[moduleKey]['fy'] = new Set([value]);
  } else {
    delete activeDropdownFilters[moduleKey]['fy'];
  }
  if (!moduleStates[moduleKey]) moduleStates[moduleKey] = {};
  moduleStates[moduleKey].page = 1;
  moduleStates[moduleKey].scrollTop = 0;
  applyAllFilters(moduleKey);
  drawFilterSidebar(moduleKey);
};

window.initFinanceMappingsEditor = async function () {
  const container = document.getElementById('finance-mappings-rows');
  if (!container) return;

  if (!selectCache['finance']) {
    try {
      await getSelectOptions('finance');
    } catch (e) {
      console.error('Failed to load finance options:', e);
    }
  }

  window.renderFinanceMappingsEditorUI();
};

window.renderFinanceMappingsEditorUI = function () {
  const container = document.getElementById('finance-mappings-rows');
  if (!container) return;

  const hiddenInput = document.getElementById('f-finance_mappings');
  if (!hiddenInput) return;

  let mappings = [];
  try {
    mappings = JSON.parse(hiddenInput.value || '[]');
  } catch (e) {
    mappings = [];
  }

  const financeOpts = selectCache['finance'] || [];

  if (mappings.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:16px; color:var(--text-muted); font-style:italic;">
        No accounts mapped yet. Add a mapping below.
      </div>
    `;
    return;
  }

  let html = '';
  mappings.forEach((m, idx) => {
    const matchedCategory = financeOpts.find(o => String(o.fcid) === String(m.finance_category_id));
    const financeType = matchedCategory ? String(matchedCategory.finance_type || '').trim() : '';

    // Resolve fallback nature but always allow manual selection
    const resolvedNature = m.nature || (['dư nợ', 'debit'].includes(financeType.toLowerCase()) ? 'Debit' : (['dư có', 'credit'].includes(financeType.toLowerCase()) ? 'Credit' : 'Debit'));

    const accOptionsHTML = financeOpts.map(o => {
      const label = `${o.finance_account_number} - ${o.finance_account_name}`;
      return `<option value="${o.fcid}" ${String(o.fcid) === String(m.finance_category_id) ? 'selected' : ''}>${escapeHTML(label)}</option>`;
    }).join('');

    html += `
      <div class="mapping-row" style="display:flex; align-items:center; gap:8px; padding:8px; border:1px solid var(--border-light); border-radius:6px; background:var(--bg-card-light);">
        <div style="flex:2; display:flex; flex-direction:column; gap:4px;">
          <label style="font-size:10px; font-weight:600; color:var(--text-secondary);">FINANCE ACCOUNT</label>
          <select class="form-select mapping-finance-select" style="font-size:12px; height:34px; padding:4px 8px;" onchange="updateFinanceMappingRow(${idx}, 'finance_category_id', this.value)">
            <option value="">— Select Account —</option>
            ${accOptionsHTML}
          </select>
        </div>
        
        <div style="flex:1; display:flex; flex-direction:column; gap:4px;">
          <label style="font-size:10px; font-weight:600; color:var(--text-secondary);">NATURE</label>
          <select class="form-select mapping-nature-select" style="font-size:12px; height:34px; padding:4px 8px;" onchange="updateFinanceMappingRow(${idx}, 'nature', this.value)">
            <option value="Debit" ${resolvedNature === 'Debit' ? 'selected' : ''}>Debit</option>
            <option value="Credit" ${resolvedNature === 'Credit' ? 'selected' : ''}>Credit</option>
          </select>
        </div>

        <div style="flex:1; display:flex; flex-direction:column; gap:4px;">
          <label style="font-size:10px; font-weight:600; color:var(--text-secondary);">VALUE COLUMN</label>
          <select class="form-select mapping-value-select" style="font-size:12px; height:34px; padding:4px 8px;" onchange="updateFinanceMappingRow(${idx}, 'value', this.value)">
            <option value="WO VAT" ${m.value === 'WO VAT' ? 'selected' : ''}>WO VAT</option>
            <option value="VAT" ${m.value === 'VAT' ? 'selected' : ''}>VAT</option>
            <option value="TOTAL VALUE" ${m.value === 'TOTAL VALUE' ? 'selected' : ''}>TOTAL VALUE</option>
          </select>
        </div>

        <button type="button" class="btn btn-icon is-danger" style="margin-top:16px; padding:8px; border-radius:6px; display:inline-flex; align-items:center; justify-content:center;" onclick="deleteFinanceMappingRow(${idx})">
          <span class="material-symbols-rounded" style="font-size:18px;">delete</span>
        </button>
      </div>
    `;
  });

  container.innerHTML = html;
};

window.addFinanceMappingRow = function () {
  const hiddenInput = document.getElementById('f-finance_mappings');
  if (!hiddenInput) return;

  let mappings = [];
  try {
    mappings = JSON.parse(hiddenInput.value || '[]');
  } catch (e) {
    mappings = [];
  }

  mappings.push({
    finance_category_id: "",
    nature: "Debit",
    value: "WO VAT"
  });

  hiddenInput.value = JSON.stringify(mappings);
  window.renderFinanceMappingsEditorUI();
};

window.updateFinanceMappingRow = function (idx, key, val) {
  const hiddenInput = document.getElementById('f-finance_mappings');
  if (!hiddenInput) return;

  let mappings = [];
  try {
    mappings = JSON.parse(hiddenInput.value || '[]');
  } catch (e) {
    mappings = [];
  }

  if (mappings[idx]) {
    mappings[idx][key] = val;

    if (key === 'finance_category_id') {
      const financeOpts = selectCache['finance'] || [];
      const matchedCategory = financeOpts.find(o => String(o.fcid) === String(val));
      if (matchedCategory) {
        const type = String(matchedCategory.finance_type || '').trim().toLowerCase();
        if (type === 'debit' || type === 'dư nợ') {
          mappings[idx].nature = 'Debit';
        } else if (type === 'credit' || type === 'dư có') {
          mappings[idx].nature = 'Credit';
        } else {
          mappings[idx].nature = 'Debit';
        }
      }
    }
  }

  hiddenInput.value = JSON.stringify(mappings);
  window.renderFinanceMappingsEditorUI();
};

window.deleteFinanceMappingRow = function (idx) {
  const hiddenInput = document.getElementById('f-finance_mappings');
  if (!hiddenInput) return;

  let mappings = [];
  try {
    mappings = JSON.parse(hiddenInput.value || '[]');
  } catch (e) {
    mappings = [];
  }

  mappings.splice(idx, 1);

  hiddenInput.value = JSON.stringify(mappings);
  window.renderFinanceMappingsEditorUI();
};

window.filterAccountingRulesByType = function (allPrograms, moduleKey, record) {
  if (!Array.isArray(allPrograms)) return [];
  return allPrograms.filter(op => {
    if (!op.payment_type) return false;
    const rawTypes = op.payment_type;
    let opTypes = [];
    if (Array.isArray(rawTypes)) {
      opTypes = rawTypes.map(s => String(s).trim().replace(/^\[|\]$/g, '').toLowerCase());
    } else if (typeof rawTypes === 'string') {
      opTypes = rawTypes.split(',').map(s => String(s).trim().replace(/^\[|\]$/g, '').toLowerCase()).filter(Boolean);
    }
    const matchType = (query) => {
      const q = String(query).trim().toLowerCase();
      return opTypes.some(t => t === q || t.includes(q) || q.includes(t));
    };

    if (moduleKey === 'contract') {
      const typeVal = record ? (record.type || '') : '';
      const isSelling = Number(typeVal) === 69 || String(typeVal).toLowerCase() === 'selling';
      const isBuying = Number(typeVal) === 70 || String(typeVal).toLowerCase() === 'buying';
      const isInternal = Number(typeVal) === 71 || String(typeVal).toLowerCase() === 'internal';
      if (isSelling) {
        return matchType('Contract - Selling') || matchType('Selling');
      } else if (isBuying) {
        return matchType('Contract - Buying') || matchType('Buying');
      } else if (isInternal) {
        return matchType('Contract') || matchType('Internal');
      }
      return matchType('Contract');
    } else if (moduleKey === 'invoice') {
      return matchType('Invoice');
    } else if (moduleKey === 'payment') {
      return matchType('Payment');
    }
    return true;
  });
};

window.openAllocProgramDropdown = function (prefix) {
  const dropdown = document.getElementById(`${prefix}-program-dropdown-list`);
  if (!dropdown) return;
  document.querySelectorAll('.alloc-program-dropdown').forEach(d => {
    if (d.id !== `${prefix}-program-dropdown-list`) d.style.display = 'none';
  });
  dropdown.style.display = 'block';
  window.filterAllocProgramDropdown(prefix);
};

window.toggleAllocProgramDropdown = function (prefix) {
  const dropdown = document.getElementById(`${prefix}-program-dropdown-list`);
  if (!dropdown) return;
  if (dropdown.style.display === 'block') {
    dropdown.style.display = 'none';
  } else {
    window.openAllocProgramDropdown(prefix);
    const input = document.getElementById(`${prefix}-program-search-input`);
    if (input) input.focus();
  }
};

window.closeAllocProgramDropdown = function (prefix) {
  const dropdown = document.getElementById(`${prefix}-program-dropdown-list`);
  if (dropdown) dropdown.style.display = 'none';
};

window.filterAllocProgramDropdown = function (prefix) {
  const input = document.getElementById(`${prefix}-program-search-input`);
  const dropdown = document.getElementById(`${prefix}-program-dropdown-list`);
  if (!input || !dropdown) return;
  const q = (input.value || '').trim().toLowerCase();
  const items = dropdown.querySelectorAll('.alloc-program-item');
  items.forEach(item => {
    const searchVal = (item.dataset.search || item.textContent || '').toLowerCase();
    if (!q || searchVal.includes(q)) {
      item.style.display = 'block';
    } else {
      item.style.display = 'none';
    }
  });
};

window.selectAllocProgramItem = function (prefix, operId, label, modKey, valAmt, vatAmt, totAmt, curr) {
  const hiddenInput = document.getElementById(`${prefix}-program-select`);
  const searchInput = document.getElementById(`${prefix}-program-search-input`);
  const dropdown = document.getElementById(`${prefix}-program-dropdown-list`);
  if (hiddenInput) hiddenInput.value = operId;
  if (searchInput) searchInput.value = operId ? label : '';
  if (dropdown) {
    dropdown.style.display = 'none';
    dropdown.querySelectorAll('.alloc-program-item').forEach(item => {
      const isSel = String(item.dataset.value) === String(operId);
      item.classList.toggle('selected', isSel);
      item.style.background = isSel ? '#E0E7FF' : 'transparent';
      item.style.fontWeight = isSel ? '600' : 'normal';
    });
  }
};




window.loadTargetTableActualRecords = async function (configRecord) {
  const container = document.getElementById('target-table-actual-records-container');
  if (!container) return;

  container.innerHTML = `<div style="padding:20px;text-align:center;color:#64748B;font-size:12px;">Loading target records...</div>`;

  try {
    const parentRequestVal = configRecord.request;
    let processStatus = 'Draft';
    if (parentRequestVal) {
      try {
        const reqRes = await apiGet(`/table/request/${parentRequestVal}`);
        if (reqRes && reqRes.process_status) {
          processStatus = reqRes.process_status;
        }
      } catch (e) {
        console.warn('Failed to load parent request process status:', e);
      }
    }

    const isProcessing = processStatus === 'Processing';
    const isClosed = ['completed', 'closed'].includes(String(processStatus).toLowerCase());

    const targetTable = configRecord.table_name;
    const actionType = configRecord.type || 'Edit';
    const recordIds = Array.isArray(configRecord.record_ids)
      ? configRecord.record_ids
      : (typeof configRecord.record_ids === 'string'
        ? configRecord.record_ids.split(',').map(s => s.trim().replace(/^\[|\]$/g, '')).filter(Boolean)
        : []);

    // Update tab badge count
    const countBadge = document.getElementById('tab-count-target_records');
    if (countBadge) {
      countBadge.textContent = recordIds.length > 0 ? recordIds.length : '';
    }

    if (recordIds.length === 0) {
      const noRecordsMsg = typeof t === 'function' ? t('target_table.no_records', 'Chưa cấu hình bản ghi mục tiêu nào. Bấm Edit bên trên để chọn bản ghi.') : 'Chưa cấu hình bản ghi mục tiêu nào. Bấm Edit bên trên để chọn bản ghi.';
      container.innerHTML = `
        <div style="padding:16px; border:1px dashed #CBD5E1; border-radius:8px; text-align:center; color:#64748B; font-size:12.5px;">
          ${noRecordsMsg}
        </div>
      `;
      return;
    }

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

    const pk = getPkName(targetTable);
    const endpoint = targetTable === 'policy' ? '/policies' : `/table/${targetTable}`;

    let records = [];
    try {
      const recordsRes = await apiGet(`${endpoint}?${pk}=${recordIds.join(',')}&limit=1000`);
      records = recordsRes.data && Array.isArray(recordsRes.data) ? recordsRes.data : (Array.isArray(recordsRes) ? recordsRes : []);
    } catch (err) {
      console.warn(`Failed to load target records for table ${targetTable}:`, err);
    }

    const displayTableName = targetTable.toUpperCase().replace(/_/g, ' ');
    const badgeColor = actionType === 'Edit' ? '#2563EB' : '#DC2626';
    const recordsPrefix = typeof t === 'function' ? t('target_table.records_prefix', 'Bản ghi mục tiêu: ') : 'Bản ghi mục tiêu: ';
    const colDetail = typeof t === 'function' ? t('target_table.col_detail', 'Thông tin chi tiết') : 'Thông tin chi tiết';
    const colStatus = typeof t === 'function' ? t('target_table.col_status', 'Trạng thái') : 'Trạng thái';
    const colAction = typeof t === 'function' ? t('target_table.col_action', 'Thao tác') : 'Thao tác';

    let htmlBlock = `
      <div style="background:#FFF; border:1px solid #E2E8F0; border-radius:12px; box-shadow:0 1px 3px rgba(0,0,0,0.05); overflow:hidden;">
        <div style="padding:14px 18px; background:#F8FAFC; border-bottom:1px solid #E2E8F0; display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="badge" style="background:${badgeColor}; color:#FFF; font-weight:600; padding:3px 8px; border-radius:6px; font-size:11px;">${actionType}</span>
            <span style="font-weight:700; font-size:13px; color:#1E293B;">${recordsPrefix}${escapeHTML(displayTableName)}</span>
          </div>
        </div>
        
        <div style="overflow-x:auto;">
          <table style="width:100%; border-collapse:collapse; font-size:12.5px; text-align:left;">
            <thead>
              <tr style="background:#FFF; border-bottom:1px solid #F1F5F9; color:#475569;">
                <th style="padding:10px 18px; font-weight:600;">ID</th>
                <th style="padding:10px 18px; font-weight:600;">${colDetail}</th>
                <th style="padding:10px 18px; font-weight:600;">${colStatus}</th>
                <th style="padding:10px 18px; font-weight:600; text-align:right;">${colAction}</th>
              </tr>
            </thead>
            <tbody>
              ${recordIds.map(rowId => {
      const row = records.find(r => String(r[pk]) === String(rowId));

      // Tracing edit/delete status
      const logs = Array.isArray(configRecord.log) ? configRecord.log : [];
      const logEntry = logs.find(l => String(l.record_id) === String(rowId));

      let statusText = typeof t === 'function' ? t('target_table.status_not_edited', 'Chưa chỉnh sửa') : 'Chưa chỉnh sửa';
      let statusStyle = 'color: #64748B; font-style: italic;';
      if (logEntry) {
        if (logEntry.action === 'Delete') {
          statusText = typeof t === 'function' ? t('target_table.status_deleted', 'Đã xóa') : 'Đã xóa';
          statusStyle = 'color: #EF4444; font-weight: 600;';
        } else {
          statusText = typeof t === 'function' ? t('target_table.status_edited', 'Đã chỉnh sửa') : 'Đã chỉnh sửa';
          statusStyle = 'color: #10B981; font-weight: 600;';
        }
      }

      const isDeletedState = logEntry && logEntry.action === 'Delete';
      const rowLabel = isDeletedState
        ? (typeof t === 'function' ? t('target_table.deleted_fallback', 'Bản ghi ID {id} (Đã xóa)').replace('{id}', rowId) : `Bản ghi ID ${rowId} (Đã xóa)`)
        : (row ? getRecordLabel(targetTable, row) : (typeof t === 'function' ? t('target_table.general_fallback', 'Bản ghi ID {id}').replace('{id}', rowId) : `Bản ghi ID ${rowId}`));

    const hashModule = window.location.hash.replace('#', '').split('/')[0];
    const effectiveView = (['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(hashModule))
      ? hashModule
      : (typeof currentModule !== 'undefined' && ['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(currentModule) ? currentModule : 'request');
    const canManageTargetRecords = ['my_process_owner', 'my_task', 'my_team'].includes(effectiveView) && isChildTableActionAllowed('target_table', 'edit', effectiveView);

    let actionBtn = '';
    if (canManageTargetRecords && isProcessing) {
      if (isDeletedState) {
        actionBtn = `<span style="font-size:11px; color:#EF4444; font-style:italic;">${typeof t === 'function' ? t('target_table.status_deleted', 'Đã xóa') : 'Đã xóa'}</span>`;
      } else {
        if (actionType === 'Edit') {
          actionBtn = `
                        <button class="btn" onclick="openEditModal('${targetTable}', '${rowId}')" style="background:#2563EB; color:#FFF; border:none; padding:4px 10px; font-size:11.5px; font-weight:600; border-radius:6px; height:28px; cursor:pointer; display:inline-flex; align-items:center; gap:4px;">
                          <span class="material-symbols-rounded" style="font-size:14px;">edit</span> Edit Record
                        </button>
                      `;
        } else {
          actionBtn = `
                        <button class="btn" onclick="confirmDelete('${targetTable}', '${rowId}', '${escapeHTML(rowLabel)}')" style="background:#DC2626; color:#FFF; border:none; padding:4px 10px; font-size:11.5px; font-weight:600; border-radius:6px; height:28px; cursor:pointer; display:inline-flex; align-items:center; gap:4px;">
                          <span class="material-symbols-rounded" style="font-size:14px;">delete</span> Delete Record
                        </button>
                      `;
        }
      }
    } else if (!canManageTargetRecords) {
      actionBtn = `<span style="font-size:11px; color:#94A3B8; font-style:italic;">${typeof t === 'function' ? t('target_table.read_only', 'Chỉ xem') : 'Chỉ xem'}</span>`;
    } else {
      const lockedText = typeof t === 'function' ? t('target_table.locked_draft', 'Khóa (Chờ Processing)') : 'Khóa (Chờ Processing)';
      actionBtn = `
                  <span style="font-size:11px; color:#94A3B8; font-style:italic;">${lockedText}</span>
                `;
    }

      return `
                  <tr style="border-bottom:1px solid #F1F5F9; transition:background 0.1s;" onmouseover="this.style.background='#F8FAFC'" onmouseout="this.style.background='none'">
                    <td style="padding:10px 18px; font-family:monospace; color:#64748B;">${escapeHTML(rowId)}</td>
                    <td style="padding:10px 18px; font-weight:600; color:#1E293B;">${escapeHTML(rowLabel)}</td>
                    <td style="padding:10px 18px; font-size:12px; ${statusStyle}">${escapeHTML(statusText)}</td>
                    <td style="padding:10px 18px; text-align:right;">${actionBtn}</td>
                  </tr>
                `;
    }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    container.innerHTML = htmlBlock;
  } catch (err) {
    console.error('Error rendering target table actual records:', err);
    container.innerHTML = `<div style="padding:16px; color:#DC2626; font-size:12.5px;">Lỗi tải bản ghi thực tế: ${err.message}</div>`;
  }
};



window.switchWizardTab = function (tabName) {
  document.querySelectorAll('.wizard-tab').forEach(el => {
    el.classList.remove('active');
    el.style.borderBottomColor = 'transparent';
    el.style.color = '#6B7280';
  });
  document.querySelectorAll('.wizard-content').forEach(el => {
    el.classList.remove('active');
    el.style.display = 'none';
  });

  const activeBtn = document.querySelector(`.wizard-tab[onclick*="${tabName}"]`);
  if (activeBtn) {
    activeBtn.classList.add('active');
    activeBtn.style.borderBottomColor = '#FF6A00';
    activeBtn.style.color = '#111827';
  }

  const activeContent = document.getElementById('wizard-' + tabName);
  if (activeContent) {
    activeContent.classList.add('active');
    activeContent.style.display = 'block';
  }

  if (tabName === 'assign' && typeof window.initEmbeddedAssignTask === 'function') {
    const container = document.getElementById('embedded-assign-task-wizard-container');
    if (container && (!container.innerHTML || container.innerHTML.trim() === '')) {
      if (container._cleanup) { try { container._cleanup(); } catch (e) { } }
      window.initEmbeddedAssignTask('embedded-assign-task-wizard-container');
    }
  }
};

window.initEmbeddedAssignTask = async function (containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  let employees = [];
  try {
    employees = await getSelectOptions('employee');
  } catch (e) {
    employees = (window.selectCache && window.selectCache['employee']) || [];
  }
  if (!employees || employees.length === 0) {
    try {
      const res = await apiGet('/table/employee?limit=1000');
      employees = res.data || (Array.isArray(res) ? res : []);
    } catch (e) { }
  }

  const resolvedOptions = employees.map(emp => ({
    value: String(emp.employee_id || emp.email),
    label: typeof formatEmployeeLabel === 'function' ? formatEmployeeLabel(emp) : (emp.full_name || emp.email)
  }));

  container.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:16px; padding: 4px 0; min-height: 480px; position: relative;">
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
  `;

  const trigger = container.querySelector('.multiselect-trigger');
  const searchInput = container.querySelector('.multiselect-search-input');
  const dropdownList = container.querySelector('.multiselect-dropdown-list');
  const pillsContainer = container.querySelector('.selected-pills');
  const assigneesContainer = container.querySelector('#atm-assignees-container');
  const selectedEmployees = new Set();

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
            <textarea class="assignee-description" style="width:100%; height:60px; padding:8px 10px; border:1px solid var(--border); border-radius:6px; font-size:12px; outline:none; box-sizing:border-box; resize:none; background:var(--bg-secondary); color:var(--text-primary);" placeholder="Enter task description for this employee..."></textarea>
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
    if (!trigger.contains(e.target) && !dropdownList.contains(e.target)) {
      dropdownList.style.display = 'none';
    }
  };
  document.addEventListener('mousedown', triggerClickOutside);

  container._cleanup = () => {
    document.removeEventListener('mousedown', triggerClickOutside);
  };
};;



// Window Bridge for Field Handlers
window.handleInvoiceValueChange = handleInvoiceValueChange;
window.handlePaymentTypeChange = handlePaymentTypeChange;
window.handlePaymentValueChange = handlePaymentValueChange;
window.handleAssetValueChange = handleAssetValueChange;
window.handleExpenseValueChange = handleExpenseValueChange;
window.handleContractValueChange = handleContractValueChange;
window.updateFormBaseCurrencyLabels = updateFormBaseCurrencyLabels;
window.updateAssetBaseCurrencyLabel = updateAssetBaseCurrencyLabel;
window.switchFormTab = switchFormTab;
window.switchDetailLeftTab = switchDetailLeftTab;
window.setFormModalButtons = setFormModalButtons;
window.openChangePasswordModal = openChangePasswordModal;
window.switchWizardTab = switchWizardTab;
window.initEmbeddedAssignTask = initEmbeddedAssignTask;
