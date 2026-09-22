/**
 * CRC App - Dynamic Form Modal Subsystem
 * Extracted as part of Modularization
 * Contains openAddModal, openEditModal, buildFormHTML, renderFieldHTML, form submission, and field handlers
 */

async function handleOperationProgramCompanyChange() {
  const companySelect = document.getElementById('f-company_id');
  const deptSelect = document.getElementById('f-department_id');
  if (!companySelect || !deptSelect) return;

  const companyId = companySelect.value;
  const currentDeptId = deptSelect.value;

  // Pre-warm departments cache if empty
  if (!selectCache['department'] || selectCache['department'].length === 0) {
    try {
      await getSelectOptions('department');
    } catch (e) {
      console.warn('Failed to pre-warm departments:', e);
    }
  }

  const allDepts = selectCache['department'] || [];
  const filteredDepts = allDepts.filter(d => !companyId || String(d.company_id) === String(companyId));

  let isCurrentDeptValid = false;
  let optionsHTML = '<option value="">— Select —</option>';
  filteredDepts.forEach(d => {
    const isSelected = String(d.department_id) === String(currentDeptId);
    if (isSelected) isCurrentDeptValid = true;
    optionsHTML += `<option value="${d.department_id}" ${isSelected ? 'selected' : ''}>${escapeHTML(d.department_label || d.department_name)}</option>`;
  });

  if (!isCurrentDeptValid && currentDeptId) {
    deptSelect.value = '';
    deptSelect.dispatchEvent(new Event('change', { bubbles: true }));
  }

  deptSelect.innerHTML = optionsHTML;
  deptSelect.dispatchEvent(new Event('change', { bubbles: true }));
}

window.handleContractTypeChange = async function (typeSelect) {
  if (!typeSelect) return;
  const typeVal = typeSelect.value;
  const isSelling = Number(typeVal) === 69 || String(typeVal).toLowerCase() === 'selling';
  const isBuying = Number(typeVal) === 70 || String(typeVal).toLowerCase() === 'buying';
  const opSelect = document.getElementById('f-operation_program_id');
  if (!opSelect) return;

  const currentVal = opSelect.value;

  opSelect.innerHTML = '<option value="">— Select —</option>';

  try {
    const ops = await getSelectOptions('operation_program');
    const filteredOps = ops.filter(op => {
      if (!op.payment_type) return false;
      if (isSelling) {
        return op.payment_type.includes('Contract - Selling') || op.payment_type.includes('Selling');
      } else if (isBuying) {
        return op.payment_type.includes('Contract - Buying') || op.payment_type.includes('Buying');
      }
      return op.payment_type.includes('Contract');
    });
    filteredOps.forEach(op => {
      const opt = document.createElement('option');
      opt.value = op.oper_id;
      opt.textContent = MODULES.operation_program.displayName(op);
      opSelect.appendChild(opt);
    });

    if (filteredOps.some(op => String(op.oper_id) === String(currentVal))) {
      opSelect.value = currentVal;
    } else {
      opSelect.value = '';
    }
    opSelect.dispatchEvent(new Event('change', { bubbles: true }));
  } catch (e) {
    console.error('Failed to update filtered operation programs:', e);
  }
};

window.handleContractNoValidation = function () {
  const signedDateEl = document.getElementById('f-contract_signed_date');
  const contractNoEl = document.getElementById('f-contractspood_no');
  if (!contractNoEl) return;

  const formField = contractNoEl.closest('.form-field');
  const labelEl = formField ? formField.querySelector('label') : document.querySelector('label[for="f-contractspood_no"]');
  const hasSignedDate = signedDateEl && signedDateEl.value && signedDateEl.value.trim() !== '';

  if (labelEl) {
    let asterisk = labelEl.querySelector('.required-asterisk');
    if (hasSignedDate) {
      if (!asterisk) {
        asterisk = document.createElement('span');
        asterisk.className = 'required-asterisk';
        asterisk.style.color = '#EF4444';
        asterisk.style.fontWeight = 'bold';
        asterisk.textContent = ' *';
        labelEl.appendChild(asterisk);
      }
    } else {
      if (asterisk) asterisk.remove();
    }
  }

  contractNoEl.dispatchEvent(new Event('input', { bubbles: true }));
};

async function openAddModal(moduleKey, initialData = null) {
  const mod = MODULES[moduleKey];
  const isRequestForm = ['request', 'my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(moduleKey);
  document.getElementById('form-modal').classList.toggle('request-form-modal', isRequestForm);

  if (!initialData) initialData = {};

  // Auto-inject and lock company field when adding child records under My Company or Company
  if (initialData._lock_company || (window.location.hash && (window.location.hash.startsWith('#my_company/') || window.location.hash.startsWith('#company/')))) {
    initialData._lock_company = true;
    if (mod && mod.fields) {
      const compField = mod.fields.find(f => f.optionsFrom === 'my_company' || f.optionsFrom === 'company' || f.key === 'company_id' || f.key === 'my_company' || f.key === 'company_entity');
      if (compField) {
        let valToSet = initialData[compField.key] || initialData.my_company || initialData.company_id || initialData.company_entity;
        if (compField.optionValue === 'company_shortname' && valToSet && !isNaN(valToSet)) {
          const companies = selectCache['my_company'] || [];
          const matched = companies.find(c => String(c.my_company_id) === String(valToSet));
          if (matched && matched.company_shortname) {
            valToSet = matched.company_shortname;
          }
        }
        if (valToSet) {
          initialData[compField.key] = valToSet;
        }
      }
    }
  }



  // Auto-inject default company for all modules that have a my_company field if not already provided
  if (authUser && authUser.company_id && mod && mod.fields) {
    const compField = mod.fields.find(f => f.optionsFrom === 'my_company' || f.key === 'my_company' || f.key === 'company_id' || f.key === 'id__my_company' || f.key === 'company_entity');
    if (compField && !initialData[compField.key]) {
      if (compField.optionValue === 'company_shortname') {
        const companies = selectCache['my_company'] || [];
        const matched = companies.find(c => String(c.my_company_id) === String(authUser.company_id));
        if (matched && matched.company_shortname) {
          initialData[compField.key] = matched.company_shortname;
        } else {
          initialData[compField.key] = authUser.company_id;
        }
      } else {
        initialData[compField.key] = authUser.company_id;
      }
    }
  }

  // Auto-inject company_id defaults for request module
  if (['request', 'my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(moduleKey)) {
    // Always pre-warm my_company cache so the dropdown renders correctly
    if (!selectCache['my_company'] || !selectCache['my_company'].isFullList) {
      await getSelectOptions('my_company').catch(() => { });
    }
    if (!initialData.company_id && authUser && authUser.company_id) {
      try {
        const companies = await getSelectOptions('my_company');
        const comp = companies.find(c => String(c.my_company_id) === String(authUser.company_id));
        if (comp) {
          initialData.company_id = comp.my_company_id;
        }
      } catch (err) {
        console.warn('Error setting default request company:', err);
      }
    }
  }

  // Auto-inject my_company and currency defaults for payment module
  if (moduleKey === 'payment') {
    if (!initialData.my_company && authUser && authUser.company_id) {
      try {
        const companies = await getSelectOptions('my_company');
        const comp = companies.find(c => String(c.my_company_id) === String(authUser.company_id));
        if (comp) {
          initialData.my_company = comp.my_company_id;
        }
      } catch (err) {
        console.warn('Error setting default payment company:', err);
      }
    }
    if (!initialData.currency && initialData.my_company) {
      try {
        const companies = await getSelectOptions('my_company');
        const comp = companies.find(c => String(c.my_company_id) === String(initialData.my_company) || c.company_shortname === initialData.my_company);
        if (comp && comp.base_currency) {
          initialData.currency = comp.base_currency;
        }
      } catch (err) {
        console.warn('Error setting default payment currency:', err);
      }
    }
  }

  // Auto-inject my_company and status defaults for service module
  if (moduleKey === 'service') {
    if (!initialData.status) {
      initialData.status = 'Active';
    }
    if (!initialData.my_company && authUser && authUser.company_id) {
      try {
        const companies = await getSelectOptions('my_company');
        const comp = companies.find(c => String(c.my_company_id) === String(authUser.company_id));
        if (comp) {
          initialData.my_company = comp.my_company_id;
        }
      } catch (err) {
        console.warn('Error setting default service company:', err);
      }
    }
  }

  // Auto-inject default currency for asset module based on company
  if (moduleKey === 'asset') {
    if (!initialData.currency) {
      try {
        let compShortname = null;
        if (initialData.request) {
          const reqs = await getSelectOptions('request');
          const req = reqs.find(r => r.request_id === initialData.request);
          if (req) {
            compShortname = req.company_id;
          }
        }
        if (!compShortname && authUser && authUser.company_id) {
          const companies = await getSelectOptions('my_company');
          const comp = companies.find(c => String(c.my_company_id) === String(authUser.company_id));
          if (comp) {
            compShortname = comp.my_company_id;
          }
        }
        if (compShortname) {
          const companies = await getSelectOptions('my_company');
          const comp = companies.find(c => String(c.my_company_id) === String(compShortname) || c.company_shortname === compShortname);
          if (comp && comp.base_currency) {
            initialData.currency = comp.base_currency;
          }
        }
      } catch (err) {
        console.warn('Error setting default asset currency:', err);
      }
    }
  }

  // Auto-inject defaults for expense module
  if (moduleKey === 'expense') {
    if (!initialData.id__employee && authUser && authUser.employee_id) {
      initialData.id__employee = authUser.employee_id;
    }
    if (!initialData.id__my_company && authUser && authUser.company_id) {
      initialData.id__my_company = authUser.company_id;
    }
    if (!initialData.id__currency) {
      try {
        const companies = await getSelectOptions('my_company');
        const comp = companies.find(c => String(c.my_company_id) === String(initialData.id__my_company || authUser?.company_id) || c.company_shortname === initialData.id__my_company);
        if (comp && comp.base_currency) {
          initialData.id__currency = comp.base_currency;
        }
      } catch (err) {
        console.warn('Error setting default expense currency:', err);
      }
    }
    // Auto-inject Fiscal Year (fy): default to year of request creation date, or current year
    if (!initialData.fy) {
      let reqCreatedYear = null;
      if (initialData.id__request) {
        try {
          const reqs = await getSelectOptions('request');
          const req = reqs.find(r => String(r.request_id) === String(initialData.id__request));
          if (req && (req.sr_created_date || req.created_date || req.created_at)) {
            const d = new Date(req.sr_created_date || req.created_date || req.created_at);
            if (!isNaN(d.getFullYear())) {
              reqCreatedYear = String(d.getFullYear());
            }
          }
        } catch (e) {
          console.warn('Error looking up request for expense fy:', e);
        }
      }
      initialData.fy = reqCreatedYear || String(new Date().getFullYear());
    }
  }

  if (moduleKey === 'support') {
    document.getElementById('form-modal-title').textContent = 'New Support Ticket';
  } else {
    document.getElementById('form-modal-title').textContent = `${t('form.add_title', 'Add')} ${getModuleMeta(moduleKey).title}`;
  }
  const body = await buildFormHTML(moduleKey, initialData);
  document.getElementById('form-modal-body').innerHTML = body;
  initializeSearchableDropdowns(document.getElementById('form-modal-body'));
  if (moduleKey === 'operation_program') {
    await initFinanceMappingsEditor();
    const companySelect = document.getElementById('f-company_id');
    if (companySelect) {
      companySelect.addEventListener('change', handleOperationProgramCompanyChange);
      await handleOperationProgramCompanyChange();
    }
  }
  if (moduleKey === 'employee') {
    const companySelect = document.getElementById('f-company_id');
    if (companySelect) {
      companySelect.addEventListener('change', handleEmployeeCompanyChange);
      await handleEmployeeCompanyChange();
    }
  }
  if (moduleKey === 'my_location') {
    const inputs = ['f-location_code', 'f-type', 'f-my_company'];
    inputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', handleLocationFormChange);
        el.addEventListener('change', handleLocationFormChange);
      }
    });
    handleLocationFormChange();
  }
  if (moduleKey === 'my_company') {
    initCompanyFormLabel();
  }
  if (moduleKey === 'account') {
    initAccountFormLabel();
  }
  if (moduleKey === 'department') {
    initDepartmentFormLabel();
  }
  if (moduleKey === 'contract') {
    const typeSelect = document.getElementById('f-type');
    if (typeSelect) {
      await handleContractTypeChange(typeSelect);
    }
  }

  // Set custom footer buttons
  setFormModalButtons(moduleKey, null);

  submitCallback = () => submitAdd(moduleKey);
  openModal('form-modal');
  const tableSelect = document.getElementById('f-table_name');
  initFormRealtimeValidation(moduleKey);
  initFormNumericFormatting(moduleKey);

  if (moduleKey === 'payment') {
    if (typeof handlePaymentTypeChange === 'function') handlePaymentTypeChange();
    if (typeof handlePaymentValueChange === 'function') handlePaymentValueChange();
  } else if (moduleKey === 'invoice') {
    if (typeof handleInvoiceValueChange === 'function') handleInvoiceValueChange();
  } else if (moduleKey === 'asset') {
    if (typeof handleAssetValueChange === 'function') handleAssetValueChange();
  } else if (moduleKey === 'expense') {
    if (typeof handleExpenseValueChange === 'function') handleExpenseValueChange();
  } else if (moduleKey === 'contract') {
    if (typeof handleContractValueChange === 'function') handleContractValueChange();
  }
  if (typeof updateFormBaseCurrencyLabels === 'function') {
    setTimeout(() => updateFormBaseCurrencyLabels(moduleKey), 50);
  }

  if (['request', 'my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team', 'support'].includes(moduleKey)) {
    await handleRequestCompanyChange();
    await handleRequestTypeChange(moduleKey === 'support' ? 'ticket_type' : 'request_type');
    await initProcessDescriptionAndVisibility();
  }
}



async function openEditModal(moduleKey, pkVal) {
  if (shouldHideRequestEditDeleteActions(moduleKey)) {
    return;
  }

  const mod = MODULES[moduleKey];
  const isRequestForm = ['request', 'my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(moduleKey);
  document.getElementById('form-modal').classList.toggle('request-form-modal', isRequestForm);
  document.getElementById('form-modal-title').textContent = `${t('form.edit_title', 'Edit Record')}`;

  // Fetch latest record
  const endpointPath = getRecordEndpoint(moduleKey, pkVal);

  let record;
  try {
    record = await apiGet(endpointPath);
  } catch (err) {
    showToast(err.message, 'error');
    return;
  }

  // Auto-inject company_id defaults for request module in edit mode - Disabled to keep REQUESTER and MY COMPANY independent
  /*
  if (['request', 'my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(moduleKey)) {
    if (record && !record.company_id && record.requester) {
      try {
        const emp = await apiGet(`/table/employee/${record.requester}?pk=email`);
        if (emp && emp.company_id) {
          const companies = await getSelectOptions('my_company');
          const comp = companies.find(c => String(c.my_company_id) === String(emp.company_id));
          if (comp) {
            record.company_id = comp.company_shortname;
          }
        }
      } catch (err) {
        console.warn('Could not resolve company for requester in edit:', err);
      }
    }
  }
  */

  if (window.location.hash && (window.location.hash.startsWith('#my_company/') || window.location.hash.startsWith('#company/'))) {
    if (record) record._lock_company = true;
  }

  if ((moduleKey === 'employee' || moduleKey === 'employee_active') && record && !record.bank_info) {
    const parts = [record.bank_name, record.bank_account, record.bank_city].filter(v => v && String(v).trim());
    if (parts.length > 0) {
      record.bank_info = parts.join(' - ');
    }
  }

  const body = await buildFormHTML(moduleKey, record);
  document.getElementById('form-modal-body').innerHTML = body;
  initializeSearchableDropdowns(document.getElementById('form-modal-body'));
  if (moduleKey === 'operation_program') {
    await initFinanceMappingsEditor();
    const companySelect = document.getElementById('f-company_id');
    if (companySelect) {
      companySelect.addEventListener('change', handleOperationProgramCompanyChange);
      await handleOperationProgramCompanyChange();
    }
  }
  if (moduleKey === 'employee') {
    const companySelect = document.getElementById('f-company_id');
    if (companySelect) {
      companySelect.addEventListener('change', handleEmployeeCompanyChange);
      await handleEmployeeCompanyChange();
    }
  }
  if (moduleKey === 'my_location') {
    const inputs = ['f-location_code', 'f-type', 'f-my_company'];
    inputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', handleLocationFormChange);
        el.addEventListener('change', handleLocationFormChange);
      }
    });
    handleLocationFormChange();
  }
  if (moduleKey === 'my_company') {
    initCompanyFormLabel();
  }
  if (moduleKey === 'account') {
    initAccountFormLabel();
  }
  if (moduleKey === 'department') {
    initDepartmentFormLabel();
  }
  if (moduleKey === 'contract') {
    const typeSelect = document.getElementById('f-type');
    if (typeSelect) {
      await handleContractTypeChange(typeSelect);
    }
  }

  // Set custom footer buttons
  setFormModalButtons(moduleKey, pkVal);

  submitCallback = () => submitEdit(moduleKey, pkVal);
  openModal('form-modal');
  const tableSelect = document.getElementById('f-table_name');
  initFormRealtimeValidation(moduleKey);
  initFormNumericFormatting(moduleKey);

  if (moduleKey === 'payment') {
    if (typeof handlePaymentTypeChange === 'function') handlePaymentTypeChange();
    if (typeof handlePaymentValueChange === 'function') handlePaymentValueChange();
  } else if (moduleKey === 'invoice') {
    if (typeof handleInvoiceValueChange === 'function') handleInvoiceValueChange();
  } else if (moduleKey === 'asset') {
    if (typeof handleAssetValueChange === 'function') handleAssetValueChange();
  } else if (moduleKey === 'expense') {
    if (typeof handleExpenseValueChange === 'function') handleExpenseValueChange();
  } else if (moduleKey === 'contract') {
    if (typeof handleContractValueChange === 'function') handleContractValueChange();
  }
  if (typeof updateFormBaseCurrencyLabels === 'function') {
    setTimeout(() => updateFormBaseCurrencyLabels(moduleKey), 50);
  }

  if (['request', 'my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(moduleKey)) {
    await handleRequestCompanyChange();
    await initProcessDescriptionAndVisibility();
  }
}

async function renderFieldHTML(moduleKey, fieldOrig, record) {
  if (!fieldOrig || fieldOrig.section || !fieldOrig.key) return '';
  let field = { ...fieldOrig };
  const mod = MODULES[moduleKey];
  let html = '';
  let val = '';

  // Custom constraint for payment/invoice reference field when source is Contract
  if (field.key === 'request' && (moduleKey === 'payment' || moduleKey === 'invoice') && record && record.source === 'Contract') {
    field.key = 'contract_id';
    field.label = 'Contract';
    field.labelKey = 'col.contract';
    field.optionsFrom = 'contract';
  }

  const isEdit = record && mod && mod.pk && record[mod.pk] !== undefined && record[mod.pk] !== null && String(record[mod.pk]).trim() !== '' && String(record[mod.pk]).toLowerCase() !== 'auto-generated';

  if (record && record[field.key] !== null && record[field.key] !== undefined) {
    val = parseBufferVal(record[field.key]);
    if (field.type === 'date' && val) {
      try {
        if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}$/)) {
          val = val;
        } else {
          const d = new Date(val);
          if (!isNaN(d.getTime())) {
            const year = d.getUTCFullYear();
            const month = String(d.getUTCMonth() + 1).padStart(2, '0');
            const day = String(d.getUTCDate()).padStart(2, '0');
            val = `${year}-${month}-${day}`;
          }
        }
      } catch (e) { }
    }
  } else if (!isEdit && field.defaultValue !== undefined) {
    val = typeof field.defaultValue === 'function' ? field.defaultValue() : field.defaultValue;
  }

  if (typeof val === 'object' && val !== null && !field.arrayField && !(val instanceof Array)) {
    val = JSON.stringify(val, null, 2);
  }
  const isFull = field.full || ['description', 'payment_description', 'address', 'full_name', 'company_fullname', 'process_type_description', 'bank_info', 'sow', 'comment'].includes(field.key);
  const fullClass = isFull ? ' full' : '';
  let disabledAttr = '';
  const isUnderContract = record && record.contract_id && (field.key === 'request' || field.key === 'contract_id' || field.key === 'source');

  let contractObj = null;
  if (moduleKey === 'payment' && record && record.contract_id) {
    contractObj = (selectCache['contract'] || []).find(c => c.contract_id === record.contract_id);
    if (!contractObj) {
      try {
        contractObj = await apiGet(`/table/contract/${record.contract_id}`);
        if (contractObj) {
          if (!selectCache['contract']) selectCache['contract'] = [];
          selectCache['contract'].push(contractObj);
        }
      } catch (e) { }
    }
  }

  let isSellingContractPayment = false;
  let isPaymentTypeContract = false;
  if (contractObj) {
    const isSelling = Number(contractObj.type) === 69 || String(contractObj.type || '').toLowerCase() === 'selling';
    const isBuying = Number(contractObj.type) === 70 || String(contractObj.type || '').toLowerCase() === 'buying';
    if (field.key === 'operation_program_id') {
      if (isSelling) {
        isSellingContractPayment = true;
      }
      field.hidden = true;
    }
    if (field.key === 'payment_type') {
      isPaymentTypeContract = true;
      val = isBuying ? 61 : (isSelling ? 60 : val);
    }
  }
  let isContractPaymentCounterParty = false;
  if (contractObj && field.key === 'counter_party') {
    // Payment from Contract: lock counter_party to the contract's contractor
    isContractPaymentCounterParty = true;
    if (contractObj.contractor) {
      // Pre-fill counter_party with contract's contractor
      const compOpts = selectCache['company'] || [];
      const comp = compOpts.find(c => String(c.company_id) === String(contractObj.contractor));
      const compLabel = comp ? (comp.company_label || [comp.company_shortname, comp.company_fullname].filter(Boolean).join(' | ')) : String(contractObj.contractor);
      const cpPayload = { type: 'company', id: contractObj.contractor, label: compLabel };
      val = JSON.stringify(cpPayload);
    }
  }

  const isProtected = (!isEdit && field.createReadonly) || (isEdit && field.editReadonly) || isUnderContract || isSellingContractPayment || isPaymentTypeContract || isContractPaymentCounterParty || (record && record._lock_company && (field.key === 'company_id' || field.key === 'my_company' || field.key === 'company_entity' || field.optionsFrom === 'my_company' || field.optionsFrom === 'company'));
  if (isProtected) {
    if (isSellingContractPayment) {
      val = '';
    }
    const isSmallOptionSelect = (field.type === 'select' || !field.type) && Array.isArray(field.options) && field.options.length > 0 && field.options.length < 3 && !field.optionsFrom && !field.multiple;
    if (field.type === 'segmented' || field.type === 'radio' || isSmallOptionSelect) {
      // segmented/radio handle disabled via data-disabled or disabled attr internally
      disabledAttr = '';
    } else if (field.type === 'select' || field.type === 'multiselect' || field.type === 'schema_table' || field.type === 'counter_party') {
      disabledAttr = 'disabled style="background:var(--bg-hover); opacity:0.8; pointer-events:none; cursor:not-allowed; background-image:none !important; padding-right:14px !important;"';
    } else {
      disabledAttr = 'readonly style="background:var(--bg-hover); opacity:0.8; pointer-events:none; cursor:not-allowed;"';
    }
  }

  if (!isColumnAllowed(moduleKey, field.key)) return '';

  if (!isEdit && field.createHidden) return '';

  if (field.hidden) {
    return `<input type="hidden" id="f-${field.key}" name="${field.key}" value="${escapeHTML(val || '')}" />`;
  }

  html += `<div class="form-field${fullClass}">`;
  let rawLabel = field.label || field.key;
  let labelKey = field.labelKey || ('col.' + field.key);
  // Dynamic label for counter_party based on payment_type
  if (field.key === 'counter_party' && moduleKey === 'payment') {
    const payTypeField = mod.fields.find(f => f.key === 'payment_type');
    const defaultPayType = payTypeField ? (typeof payTypeField.defaultValue === 'function' ? payTypeField.defaultValue() : payTypeField.defaultValue) : 61;
    const pTypeVal = (record && record.payment_type !== undefined) ? record.payment_type : defaultPayType;
    const isIncoming = Number(pTypeVal) === 60 || String(pTypeVal || '').toLowerCase() === 'incoming';
    if (isIncoming) {
      rawLabel = 'Pay From';
      labelKey = 'col.pay_from';
    } else {
      rawLabel = 'Pay To';
      labelKey = 'col.pay_to';
    }
  }
  const uppercaseLabel = (typeof t === 'function' ? t(labelKey, rawLabel) : rawLabel).toUpperCase();
  const requiredIndicator = field.required ? ' <span class="required-asterisk" style="color: #EF4444; font-weight: bold;">*</span>' : '';
  html += `<label class="form-label" for="f-${field.key}">${uppercaseLabel}${requiredIndicator}</label>`;

  if (field.type === 'textarea') {
    if (field.key === 'process_type_description') {
      html += `
        <div id="process-description-container" style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 10px 14px; font-size: 13px; color: #334155; min-height: 60px; width: 100%; box-sizing: border-box;">
          <div id="process-description-text" style="white-space: pre-wrap; line-height: 1.5; color: #1E293B; font-size: 13px;">${escapeHTML(val || '')}</div>
          <div id="process-description-attachments" style="display: flex; flex-direction: column; gap: 6px; margin-top: 8px; border-top: 1px dashed #E2E8F0; padding-top: 6px; display: none;"></div>
        </div>
        <input type="hidden" id="f-process_type_description" name="process_type_description" value="${escapeHTML(val || '')}" />
      `;
    } else {
      html += `<textarea class="form-textarea" id="f-${field.key}" name="${field.key}" rows="3" ${disabledAttr}>${val}</textarea>`;
    }
  } else if (field.type === 'finance_mappings') {
    html += `
      <div id="finance-mappings-editor-container" class="finance-mappings-editor-container" style="width: 100%; border: 1px solid var(--border-light); border-radius: 8px; padding: 16px; background: var(--bg-card);">
        <div id="finance-mappings-rows" style="display:flex; flex-direction:column; gap:8px;"></div>
        <button type="button" class="btn btn-secondary" style="margin-top:12px; font-size:12px; display:inline-flex; align-items:center; gap:4px; padding:6px 12px; border-radius:6px;" onclick="addFinanceMappingRow()">
          <span class="material-symbols-rounded" style="font-size:16px;">add</span> Add Mapping Account
        </button>
        <input type="hidden" id="f-${field.key}" name="${field.key}" value="${escapeHTML(typeof val === 'string' ? val : JSON.stringify(val || []))}" />
      </div>
    `;
  } else if (field.type === 'target_record_multiselect') {
    let currentSelection = [];
    if (record && record[field.key]) {
      const rawVal = record[field.key];
      if (Array.isArray(rawVal)) {
        currentSelection = rawVal;
      } else if (typeof rawVal === 'string') {
        currentSelection = rawVal.split(',').map(s => s.trim().replace(/^\[|\]$/g, '')).filter(Boolean);
      }
    }
    const checkboxes = currentSelection.map(val => {
      return `<input type="checkbox" name="multi-${field.key}" value="${escapeHTML(val)}" checked style="display: none;" />`;
    }).join('');
    const selStr = currentSelection.length ? escapeHTML(JSON.stringify(currentSelection)) : '[]';

    html += `
      <div class="searchable-multiselect-container target-record-multiselect" id="container-${field.key}" data-field-key="${field.key}" data-selected="${selStr}" style="position: relative; width: 100%;">
        <div class="checkbox-store" style="display: none;">${checkboxes}</div>
        <div class="multiselect-trigger" style="display: flex; flex-wrap: wrap; gap: 6px; align-items: center; min-height: 40px; padding: 6px 12px; cursor: pointer; background: #ffffff; border: 1px solid #E5E7EB; border-radius: 8px; box-sizing: border-box;">
          <div class="selected-pills" style="display: flex; flex-wrap: wrap; gap: 6px;"></div>
          <input type="text" class="multiselect-search-input" placeholder="Search and select..." style="border: none; outline: none; background: transparent; flex: 1; min-width: 120px; font-size: 13px; padding: 0; margin: 0; height: 28px; color: #111827; font-family: inherit;" autocomplete="off" ${disabledAttr} />
          <span class="material-symbols-rounded" style="color: #6B7280; margin-left: auto; font-size: 20px; pointer-events: none;">arrow_drop_down</span>
        </div>
        <div class="multiselect-dropdown-list" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: #ffffff; border: 1px solid #c1c5cb; border-radius: 8px; margin-top: 4px; max-height: 200px; overflow-y: auto; z-index: 9999; box-shadow: 0 10px 25px -3px rgba(0, 0, 0, 0.15); box-sizing: border-box; text-align: left;">
        </div>
      </div>
    `;
  } else if (field.type === 'counter_party') {
    // Parse current value
    let currentType = 'company';
    let currentId = '';
    try {
      if (val) {
        const parsed = typeof val === 'string' ? JSON.parse(val) : val;
        if (parsed && (parsed.type === 'company' || parsed.type === 'employee') && parsed.id) {
          currentType = parsed.type;
          currentId = parsed.id;
        }
      }
    } catch (e) {
      currentType = 'company';
      currentId = '';
    }

    const hiddenVal = currentId ? JSON.stringify({ type: currentType, id: currentId }) : '';

    // Render widget immediately with empty selects; options populated async after DOM insert
    html += `
      <div style="display: flex; gap: 8px; width: 100%; align-items: center;">
        <select class="form-select" id="f-${field.key}-type" style="width: 120px !important; flex-shrink: 0 !important; padding-right: 20px !important; font-size: 12px !important;"
          onchange="handleCounterPartyTypeChange('${field.key}')" ${disabledAttr}>
          <option value="company" ${currentType === 'company' ? 'selected' : ''}>Company</option>
          <option value="employee" ${currentType === 'employee' ? 'selected' : ''}>Employee</option>
        </select>
        <select class="form-select" id="f-${field.key}-company-select"
          style="flex: 1 !important; width: auto !important; min-width: 0 !important; display: ${currentType === 'company' ? 'block' : 'none'} !important;"
          onchange="updateCounterPartyHiddenVal('${field.key}')" ${disabledAttr}>
          <option value="">— Loading... —</option>
        </select>
        <select class="form-select" id="f-${field.key}-employee-select"
          style="flex: 1 !important; width: auto !important; min-width: 0 !important; display: ${currentType === 'employee' ? 'block' : 'none'} !important;"
          onchange="updateCounterPartyHiddenVal('${field.key}')" ${disabledAttr}>
          <option value="">— Loading... —</option>
        </select>
        <input type="hidden" id="f-${field.key}" name="${field.key}" value="${escapeHTML(hiddenVal)}" />
      </div>
    `;

    // Defer option population until after DOM insertion
    setTimeout(async () => {
      try {
        const compSel = document.getElementById(`f-${field.key}-company-select`);
        const empSel = document.getElementById(`f-${field.key}-employee-select`);
        if (!compSel || !empSel) return;

        const compOpts = (await getSelectOptions('company')) || [];
        const empOpts = (await getSelectOptions('employee')) || [];

        compSel.innerHTML = `<option value="">— Select Customer/Supplier —</option>` +
          compOpts.map(c => {
            const sel = currentType === 'company' && String(currentId) === String(c.company_id) ? 'selected' : '';
            return `<option value="${c.company_id}" ${sel}>${escapeHTML(c.company_label || [c.company_shortname, c.company_fullname].filter(Boolean).join(' | ') || c.company_name || '')}</option>`;
          }).join('');

        empSel.innerHTML = `<option value="">— Select Employee —</option>` +
          empOpts.map(e => {
            const sel = currentType === 'employee' && (String(currentId) === String(e.email) || String(currentId) === String(e.employee_id)) ? 'selected' : '';
            return `<option value="${e.email || e.employee_id}" ${sel}>${escapeHTML(e.full_name || e.email || '')}</option>`;
          }).join('');

        if (isProtected || isContractPaymentCounterParty) {
          compSel.disabled = true;
          empSel.disabled = true;
          const typeEl = document.getElementById(`f-${field.key}-type`);
          if (typeEl) typeEl.disabled = true;
        }
      } catch (err) {
        console.error('[counter_party populate error]', err);
      }
    }, 50);
  } else if (field.key === 'sr_owner' || (field.type === 'multiselect' && field.optionsFrom)) {
    let opts = [];
    const optValKey = field.optionValue || (field.key === 'sr_owner' ? 'employee_id' : 'id');
    const optLabelKey = field.optionLabel || (field.key === 'sr_owner' ? 'full_name' : 'name');
    const optionsFrom = field.optionsFrom || (field.key === 'sr_owner' ? 'employee' : null);

    if (optionsFrom) {
      opts = await getSelectOptions(optionsFrom);
      if (optionsFrom === 'my_company') {
        const optValKey = field.optionValue || 'my_company_id';
        opts = opts.filter(o => Number(o.status) === 67 || String(o.status || '').toLowerCase() === 'active' || (!o.status && Number(o.status) !== 68 && String(o.status || '').toLowerCase() !== 'inactive'));
      }
    }

    let currentSelection = [];
    if (record) {
      const rawVal = record[field.key];
      if (Array.isArray(rawVal)) {
        const subKey = field.key.slice(0, -1);
        currentSelection = rawVal.map(x => String(x[subKey] || x.email || x.employee_id || x).trim().replace(/^\[|\]$/g, '')).filter(Boolean);
      } else if (typeof rawVal === 'string') {
        currentSelection = rawVal.split(',').map(s => s.trim().replace(/^\[|\]$/g, '')).filter(Boolean);
      }
    }

    const resolvedOptions = opts.map(o => {
      const val = typeof o === 'object' ? (o[optValKey] !== undefined ? o[optValKey] : o.value) : o;
      let lbl = typeof o === 'object' ? (o[optLabelKey] !== undefined ? o[optLabelKey] : o.label) : o;
      if (optionsFrom === 'employee' && typeof o === 'object') {
        lbl = typeof formatEmployeeLabel === 'function' ? formatEmployeeLabel(o) : (o.full_name || o.email || val);
      } else if (optionsFrom === 'request') {
        lbl = window.formatRequestLabel ? window.formatRequestLabel(o) : lbl;
      } else if (optionsFrom === 'my_company' || optionsFrom === 'company') {
        lbl = window.formatCompanyLabel ? window.formatCompanyLabel(o) : lbl;
      } else if (optionsFrom === 'policy' || optionsFrom === 'helpdesk_policy') {
        lbl = window.formatProcessLabel ? window.formatProcessLabel(o) : lbl;
      }
      return { value: String(val).trim().replace(/^\[|\]$/g, ''), label: String(lbl) };
    });

    const uniqueOpts = [];
    const seen = new Set();
    resolvedOptions.forEach(o => {
      const ov = o.value.trim();
      const ovLower = ov.toLowerCase();
      if (ov && !seen.has(ovLower)) {
        seen.add(ovLower);
        uniqueOpts.push(o);
      }
    });

    currentSelection.forEach(val => {
      const cleanVal = val.trim().replace(/^\[|\]$/g, '');
      const valLower = cleanVal.toLowerCase();
      if (!seen.has(valLower)) {
        seen.add(valLower);
        let lbl = cleanVal;
        if (optionsFrom === 'employee' && typeof resolveEmployeeLabel === 'function') {
          lbl = resolveEmployeeLabel(cleanVal) || cleanVal;
        } else if (typeof resolveLookupValue === 'function') {
          lbl = resolveLookupValue(moduleKey, field.key, cleanVal) || cleanVal;
        }
        uniqueOpts.push({ value: cleanVal, label: lbl });
      }
    });

    const checkboxHTML = uniqueOpts.map(o => {
      const checked = currentSelection.some(sel => sel.toLowerCase() === o.value.toLowerCase()) ? 'checked' : '';
      return `<input type="checkbox" name="multi-${field.key}" value="${escapeHTML(o.value)}" ${checked} style="display: none;" />`;
    }).join('');

    const selStr = currentSelection.length ? escapeHTML(JSON.stringify(currentSelection)) : '[]';

    html += `
      <div class="searchable-multiselect-container" id="container-${field.key}" data-field-key="${field.key}" data-selected="${selStr}" data-options-from="${optionsFrom || ''}" data-val-key="${optValKey}" data-label-key="${optLabelKey}" style="position: relative; width: 100%;">
        <div class="checkbox-store" style="display: none;">${checkboxHTML}</div>
        <div class="multiselect-trigger" style="display: flex; flex-wrap: wrap; gap: 6px; align-items: center; min-height: 40px; padding: 6px 12px; cursor: pointer; background: #ffffff; border: 1px solid #E5E7EB; border-radius: 8px; box-sizing: border-box;">
          <div class="selected-pills" style="display: flex; flex-wrap: wrap; gap: 6px;"></div>
          <input type="text" class="multiselect-search-input" placeholder="Search and select..." style="border: none; outline: none; background: transparent; flex: 1; min-width: 120px; font-size: 13px; padding: 0; margin: 0; height: 28px; color: #111827; font-family: inherit;" autocomplete="off" ${disabledAttr} />
          <span class="material-symbols-rounded" style="color: #6B7280; margin-left: auto; font-size: 20px; pointer-events: none;">arrow_drop_down</span>
        </div>
        <div class="multiselect-dropdown-list" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: #ffffff; border: 1px solid #c1c5cb; border-radius: 8px; margin-top: 4px; max-height: 200px; overflow-y: auto; z-index: 9999; box-shadow: 0 10px 25px -3px rgba(0, 0, 0, 0.15); box-sizing: border-box; text-align: left;">
        </div>
      </div>
    `;
  } else if (field.type === 'segmented' || ((field.type === 'select' || !field.type) && Array.isArray(field.options) && field.options.length > 0 && field.options.length < 3 && !field.optionsFrom && !field.multiple)) {
    // ── SEGMENTED CONTROL ── Single-choice, ≤2 options or explicit segmented, replaces <select>
    const segId = `f-${field.key}`;
    const currentVal = String(val !== undefined && val !== null && val !== '' ? val : (field.defaultValue !== undefined ? (typeof field.defaultValue === 'function' ? field.defaultValue() : field.defaultValue) : ''));
    const isDisabled = !!isProtected;
    const segOptions = field.options || [];
    const pillsHTML = segOptions.map(o => {
      const optionVal = typeof o === 'object' ? o.value : o;
      const rawOptLabel = typeof o === 'object' ? o.label : o;
      const optionLabel = typeof t_val === 'function' ? t_val(rawOptLabel) : rawOptLabel;
      const isActive = String(currentVal).toLowerCase() === String(optionVal).toLowerCase() ? 'active' : '';
      const disabledStyle = isDisabled ? 'pointer-events:none; opacity:0.6;' : '';
      return `<div class="segmented-option ${isActive}" data-value="${escapeHTML(String(optionVal))}" style="${disabledStyle}" onclick="if(!this.closest('.segmented-control').dataset.disabled){this.closest('.segmented-control').querySelectorAll('.segmented-option').forEach(el=>el.classList.remove('active'));this.classList.add('active');const input=this.closest('.segmented-control').querySelector('input[type=hidden]');input.value=this.dataset.value;input.dispatchEvent(new Event('change',{bubbles:true}));${field.onchange || ''}}">${escapeHTML(String(optionLabel))}</div>`;
    }).join('');
    html += `
      <div class="segmented-control" id="${segId}-control" ${isDisabled ? 'data-disabled="true"' : ''}>
        ${pillsHTML}
        <input type="hidden" id="${segId}" name="${field.key}" value="${escapeHTML(currentVal)}" />
      </div>
    `;
  } else if (field.type === 'radio') {
    // ── RADIO GROUP ── Single-choice with radio buttons styled as pills (e.g., Gender)
    const radioName = `radio-${field.key}`;
    const currentVal2 = String(val || '');
    const isDisabled2 = !!isProtected;
    const radioOptions = field.options || [];
    const radiosHTML = radioOptions.map((o, idx) => {
      const optionVal = typeof o === 'object' ? o.value : o;
      const optionLabel = typeof o === 'object' ? (typeof t_val === 'function' ? t_val(o.label) : o.label) : (typeof t_val === 'function' ? t_val(o) : o);
      const isChecked = String(currentVal2) === String(optionVal);
      const checkedAttr = isChecked ? 'checked' : '';
      const checkedClass = isChecked ? 'checked' : '';
      return `
        <label class="radio-option ${checkedClass}" onclick="this.classList.toggle('checked', true); this.closest('.radio-group').querySelectorAll('.radio-option').forEach(el=>{if(el!==this)el.classList.remove('checked')});">
          <input type="radio" name="${radioName}" id="f-${field.key}-${idx}" value="${escapeHTML(optionVal)}" ${checkedAttr} ${isDisabled2 ? 'disabled' : ''} onchange="document.getElementById('f-${field.key}').value=this.value;" />
          ${escapeHTML(optionLabel)}
        </label>
      `;
    }).join('');
    html += `
      <div class="radio-group" id="f-${field.key}-group">
        ${radiosHTML}
        <input type="hidden" id="f-${field.key}" name="${field.key}" value="${escapeHTML(currentVal2)}" />
      </div>
    `;
  } else if (field.type === 'select' && field.options) {
    const onChangeStr = field.onchange ? `onchange="${field.onchange}"` : '';
    let selectOpts = [...field.options];
    if (val !== undefined && val !== null && val !== '' && !selectOpts.some(o => String(typeof o === 'object' ? o.value : o) === String(val))) {
      selectOpts.push(val);
    }
    html += `<select class="form-select" id="f-${field.key}" name="${field.key}" ${onChangeStr} ${disabledAttr}>
      <option value="">— Select —</option>
      ${selectOpts.map(o => {
      const optionVal = typeof o === 'object' ? o.value : o;
      const optionLabel = typeof o === 'object' ? (typeof t_val === 'function' ? t_val(o.label) : o.label) : (typeof t_val === 'function' ? t_val(o) : o);
      return `<option value="${optionVal}" ${String(val) === String(optionVal) ? 'selected' : ''}>${optionLabel}</option>`;
    }).join('')}
    </select>`;
  } else if (field.type === 'select' && field.optionsFrom) {
    let sourceKey = field.optionsFrom;
    let opts;
    if (sourceKey === 'request') {
      // Fetch only the current user's requests for dropdowns in child forms
      const MY_REQ_CACHE_KEY = 'my_request_dropdown';
      if (selectCache[MY_REQ_CACHE_KEY] && selectCache[MY_REQ_CACHE_KEY].isFullList) {
        opts = selectCache[MY_REQ_CACHE_KEY];
      } else {
        try {
          const res = await apiGet('/my-views/my-request?limit=1000000');
          const data = res.data && Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []);
          data.isFullList = true;
          selectCache[MY_REQ_CACHE_KEY] = data;
          opts = data;
        } catch (e) {
          opts = [];
        }
      }
    } else if (sourceKey === 'cms_province') {
      const selectedCountry = record ? (record.country || '') : '';
      if (selectedCountry) {
        try {
          const res = await apiGet(`/cms-lookups/provinces?country=${encodeURIComponent(selectedCountry)}`);
          opts = res.data || [];
        } catch (e) { opts = []; }
      } else {
        opts = [];
      }
    } else if (sourceKey === 'cms_city') {
      const selectedProvince = record ? (record.province || '') : '';
      const selectedCountry = record ? (record.country || '') : '';
      if (selectedProvince || selectedCountry) {
        try {
          let u = '/cms-lookups/cities?';
          if (selectedProvince) u += `province=${encodeURIComponent(selectedProvince)}`;
          else if (selectedCountry) u += `country=${encodeURIComponent(selectedCountry)}`;
          const res = await apiGet(u);
          opts = res.data || [];
        } catch (e) { opts = []; }
      } else {
        opts = [];
      }
    } else {
      opts = await getSelectOptions(sourceKey);
    }
    const onChangeStr = field.onchange ? `onchange="${field.onchange}"` : '';

    if (false) {
      let selectedLabel = '';
      const optHTML = opts.map(o => {
        const ov = String(o[field.optionValue] || '');
        const ol = getFinanceOptionLabel(o) || String(o[field.optionLabel] || ov);
        const example = getFinanceOptionExample(o);
        if (String(val) === ov) selectedLabel = ol;
        return `
          <button type="button"
            class="finance-select-option"
            data-value="${escapeHTML(ov)}"
            data-label="${escapeHTML(ol)}"
            data-search="${escapeHTML(`${ol} ${example}`)}"
            onmousedown="event.preventDefault(); selectFinanceOption('${field.key}', this.dataset.value, this.dataset.label)"
            onmouseenter="showFinanceOptionTooltip(this, this.dataset.example)"
            onmouseleave="hideFinanceOptionTooltip()"
            data-example="${escapeHTML(example)}">
            ${escapeHTML(ol)}
          </button>
        `;
      }).join('');

      if (val && !selectedLabel) {
        selectedLabel = typeof resolveSelectDisplayVal === 'function'
          ? (resolveSelectDisplayVal(field.optionsFrom, val) || val)
          : val;
      }

      html += `
        <div class="finance-select-container" id="finance-select-${field.key}">
          <input type="hidden" id="f-${field.key}" name="${field.key}" value="${escapeHTML(val || '')}" ${onChangeStr} />
          <input class="form-input finance-select-search" type="text" value="${escapeHTML(selectedLabel || '')}" placeholder="Search account name..." autocomplete="off" ${disabledAttr}
            onfocus="const c=this.closest('.finance-select-container'); closeFinanceSelectDropdowns(c); c.classList.add('is-open'); c.querySelector('.finance-select-list').style.display='block'; showAllFinanceOptions('${field.key}')"
            oninput="const h=document.getElementById('f-${field.key}'); h.value=''; h.dispatchEvent(new Event('input',{bubbles:true})); const c=this.closest('.finance-select-container'); c.classList.add('is-open'); c.querySelector('.finance-select-list').style.display='block'; filterFinanceOptions('${field.key}')"
            onkeydown="if(event.key==='Escape'){this.closest('.finance-select-container').classList.remove('is-open'); this.closest('.finance-select-container').querySelector('.finance-select-list').style.display='none'; hideFinanceOptionTooltip();}" />
          <span class="material-symbols-rounded finance-select-caret">arrow_drop_down</span>
          <div class="finance-select-list" style="display:none;">
            <button type="button" class="finance-select-option is-empty"
              onmousedown="event.preventDefault(); selectFinanceOption('${field.key}', '', '')">— Select —</button>
            ${optHTML}
          </div>
        </div>
      `;
    }

    if (true) {
      let staticOptionsHTML = '';
      if (field.staticOptions) {
        staticOptionsHTML = field.staticOptions.map(o => {
          const ov = typeof o === 'object' ? o.value : o;
          const ol = typeof o === 'object' ? o.label : o;
          return `<option value="${ov}" ${String(val) === String(ov) ? 'selected' : ''}>${ol}</option>`;
        }).join('');
      }

      let displayOpts = opts;
      if (sourceKey === 'my_company') {
        const pk = field.optionValue || 'my_company_id';
        displayOpts = opts.filter(o => Number(o.status) === 67 || String(o.status || '').toLowerCase() === 'active' || (!o.status && Number(o.status) !== 68 && String(o.status || '').toLowerCase() !== 'inactive') || String(o[pk]) === String(val));
      } else if (sourceKey === 'employee' || sourceKey === 'employee_active') {
        const pk = field.optionValue || 'employee_id';
        displayOpts = opts.filter(o => Number(o.status) === 17 || String(o.status || '').toLowerCase() === 'active' || String(o[pk]) === String(val));
      } else if (sourceKey === 'my_location') {
        const pk = field.optionValue || 'my_location_id';
        displayOpts = opts.filter(o => !o.status || Number(o.status) === 50 || String(o.status || '').toLowerCase() === 'active' || String(o[pk]) === String(val));
      }

      if (field.key === 'requester') {
        displayOpts = displayOpts.filter(o => Number(o.status) === 17 || String(o.status || '').toLowerCase() === 'active' || String(o[field.optionValue]) === String(val));
      } else if (sourceKey === 'operation_program') {
        if (moduleKey === 'contract') {
          displayOpts = opts.filter(o => !o.payment_type || o.payment_type.includes('Contract') || String(o[field.optionValue]) === String(val));
        } else if (moduleKey === 'invoice') {
          displayOpts = opts.filter(o => !o.payment_type || o.payment_type.includes('Invoice') || String(o[field.optionValue]) === String(val));
        } else if (moduleKey === 'payment') {
          displayOpts = opts.filter(o => !o.payment_type || o.payment_type.includes('Payment') || String(o[field.optionValue]) === String(val));
        }
      } else if (field.filterByCountryField || field.filterByProvinceField) {
        displayOpts = opts || [];
        if (val && !displayOpts.some(o => String(o[field.optionValue]) === String(val))) {
          displayOpts = displayOpts.concat([{ [field.optionValue]: val, [field.optionLabel]: val }]);
        }
      }
      let hasCurrentVal = false;
      const optHTML = displayOpts.map(o => {
        const ov = o[field.optionValue];
        let ol = o[field.optionLabel] || ov;
        if (sourceKey === 'my_location' && MODULES[sourceKey] && MODULES[sourceKey].displayName) {
          ol = MODULES[sourceKey].displayName(o);
        } else if (sourceKey === 'employee') {
          ol = formatEmployeeLabel(o);
        } else if (sourceKey === 'request') {
          ol = window.formatRequestLabel ? window.formatRequestLabel(o) : ol;
        } else if (sourceKey === 'my_company' || sourceKey === 'company') {
          ol = window.formatCompanyLabel ? window.formatCompanyLabel(o) : ol;
        } else if (sourceKey === 'policy' || sourceKey === 'helpdesk_policy') {
          ol = window.formatProcessLabel ? window.formatProcessLabel(o) : ol;
        } else if (sourceKey === 'operation_program' && MODULES[sourceKey] && MODULES[sourceKey].displayName) {
          ol = MODULES[sourceKey].displayName(o);
        } else if (sourceKey === 'oppotunity' || sourceKey === 'opportunity') {
          ol = window.formatOpportunityLabel ? window.formatOpportunityLabel(o) : (MODULES.oppotunity && MODULES.oppotunity.displayName ? MODULES.oppotunity.displayName(o) : ol);
        }
        let typeAttrs = '';
        if (sourceKey === 'policy' || sourceKey === 'helpdesk_policy') {
          const pType = o.policy_type || o.ticket_type || '';
          const pName = o.policy_name || o.ticket_name || o.name || '';
          typeAttrs = ` data-type="${escapeHTML(pType)}" data-name="${escapeHTML(pName)}"`;
        }
        return `<option value="${ov}"${typeAttrs} ${String(val) === String(ov) ? 'selected' : ''}>${ol}</option>`;
      }).join('');

      let currentValOptionHTML = '';
      if (val && !hasCurrentVal) {
        let resolvedDisplay = val;
        if (sourceKey === 'employee') {
          const emp = opts.find(x => String(x.employee_id).toLowerCase() === String(val).toLowerCase());
          if (emp) resolvedDisplay = formatEmployeeLabel(emp);
        } else if (sourceKey === 'oppotunity' || sourceKey === 'opportunity') {
          const opp = opts.find(x => String(x.project_id).toLowerCase() === String(val).toLowerCase());
          if (opp) resolvedDisplay = window.formatOpportunityLabel ? window.formatOpportunityLabel(opp) : (opp.project_name || val);
        } else if (typeof resolveSelectDisplayVal === 'function') {
          resolvedDisplay = resolveSelectDisplayVal(field.optionsFrom, val) || val;
        }
        currentValOptionHTML = `<option value="${val}" selected>${resolvedDisplay}</option>`;
      }

      html += `<select class="form-select" id="f-${field.key}" name="${field.key}" ${onChangeStr} ${disabledAttr}>
      <option value="">— Select —</option>
      ${staticOptionsHTML}
      ${currentValOptionHTML}
      ${optHTML}
    </select>`;
    }
  } else if (field.arrayField) {
    let arrayVal = '';
    if (record) {
      const arrData = record[field.key];
      if (Array.isArray(arrData)) {
        const subKey = field.key.slice(0, -1);
        arrayVal = arrData.map(x => x[subKey] || x.email || x).join(', ');
      }
    }
    html += `<input class="form-input" type="text" id="f-${field.key}" name="${field.key}" value="${arrayVal}" placeholder="val1, val2, ..." ${disabledAttr} />`;
  } else if (field.type === 'schema_table') {
    const schemaData = await getSelectOptions('_schemaData');
    const tables = Object.keys(schemaData || {});
    html += `<select class="form-select" id="f-${field.key}" name="${field.key}" onchange="handleSchemaTableChange(this, '${field.key}')" ${disabledAttr}>
      <option value="">— Select Table —</option>
      ${tables.map(t => `<option value="${t}" ${val === t ? 'selected' : ''}>${t}</option>`).join('')}
    </select>`;
  } else if (field.type === 'schema_column') {
    html += `<select class="form-select" id="f-${field.key}" name="${field.key}" ${disabledAttr}>
      <option value="">— Select Column —</option>
      ${val ? `<option value="${val}" selected>${val}</option>` : ''}
    </select>`;
  } else if (field.type === 'multiselect') {
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
    let currentSelection = [];
    if (record) {
      const rawVal = record[field.key];
      if (Array.isArray(rawVal)) {
        const subKey = field.key.slice(0, -1);
        currentSelection = rawVal.map(x => String(x[subKey] || x.email || x));
      } else if (typeof rawVal === 'string') {
        currentSelection = rawVal.split(',').map(s => s.trim().replace(/^\[|\]$/g, '')).filter(Boolean);
      }
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

    // Ensure any currently selected values that aren't in the option list are preserved as pills
    const optValKey = field.optionValue || 'value';
    const optLabelKey = field.optionLabel || 'label';
    currentSelection.forEach(val => {
      const valLower = val.toLowerCase();
      if (!seen.has(valLower)) {
        seen.add(valLower);
        uniqueOpts.push({
          [optValKey]: val,
          [optLabelKey]: val
        });
      }
    });

    const isContractSelected = currentSelection.some(x => String(x).toUpperCase() === 'CONTRACT');
    const isPaymentOrInvoiceSelected = currentSelection.some(x => {
      const u = String(x).toUpperCase();
      return u === 'PAYMENT' || u === 'INVOICE';
    });
    const optStr = uniqueOpts.map(o => {
      const ov = String(o[field.optionValue]);
      const ol = o[field.optionLabel] || ov;
      const checked = currentSelection.includes(ov) ? 'checked' : '';
      const activeClass = checked ? 'active' : '';

      let disabledClass = '';
      let disabledAttr = '';
      if (field.key === 'elements') {
        const u = ov.toUpperCase();
        if (isContractSelected && (u === 'PAYMENT' || u === 'INVOICE')) {
          disabledClass = 'pill-disabled';
          disabledAttr = 'disabled';
        } else if (isPaymentOrInvoiceSelected && u === 'CONTRACT') {
          disabledClass = 'pill-disabled';
          disabledAttr = 'disabled';
        }
      }

      const displayLabel = typeof t_val === 'function' ? t_val(ol) : ol;

      return `
        <label class="form-multiselect-pill ${activeClass} ${disabledClass}">
          <input type="checkbox" name="multi-${field.key}" value="${ov}" ${checked} ${disabledAttr} style="display: none;" onchange="toggleMultiselectPill(this)" />
          <span>${displayLabel}</span>
        </label>
      `;
    }).join('');
    const selStr = currentSelection.length ? escapeHTML(JSON.stringify(currentSelection)) : '[]';
    html += `<div class="form-multiselect-container" id="container-${field.key}" data-selected="${selStr}">${optStr}</div>`;
  } else if (field.type === 'datalist') {
    const listId = `dl-${field.key}`;
    const uniqueVals = [];
    const seenVals = new Set();
    if (field.options && Array.isArray(field.options)) {
      field.options.forEach(o => {
        const valStr = String(o).trim();
        const valLower = valStr.toLowerCase();
        if (valStr && !seenVals.has(valLower)) {
          seenVals.add(valLower);
          uniqueVals.push(valStr);
        }
      });
    }
    currentData.forEach(r => {
      let val = r[field.key];
      if (val) {
        val = String(val).trim().replace(/^\[|\]$/g, '');
        if (val.toLowerCase() === 'staff') val = 'Staff';
        const valLower = val.toLowerCase();
        if (!seenVals.has(valLower)) {
          seenVals.add(valLower);
          uniqueVals.push(val);
        }
      }
    });
    const onChangeStr = field.onchange ? `onchange="${field.onchange}"` : '';
    const onInputStr = field.oninput ? `oninput="${field.oninput}"` : '';
    html += `<input class="form-input" type="text" id="f-${field.key}" name="${field.key}" value="${val}" list="${listId}" autocomplete="off" ${onChangeStr} ${onInputStr} ${disabledAttr} />`;
    html += `<datalist id="${listId}">${uniqueVals.map(v => `<option value="${v}">`).join('')}</datalist>`;
  } else if (field.type === 'select_with_add') {
    const uniqueVals = [];
    const seenVals = new Set();
    if (field.options && Array.isArray(field.options)) {
      field.options.forEach(o => {
        const valStr = String(o).trim();
        const valLower = valStr.toLowerCase();
        if (valStr && !seenVals.has(valLower)) {
          seenVals.add(valLower);
          uniqueVals.push(valStr);
        }
      });
    }
    const cached = selectCache[moduleKey] || [];
    cached.forEach(r => {
      let val = r[field.key];
      if (val) {
        val = String(val).trim().replace(/^\[|\]$/g, '');
        const valLower = val.toLowerCase();
        if (!seenVals.has(valLower)) {
          seenVals.add(valLower);
          uniqueVals.push(val);
        }
      }
    });
    currentData.forEach(r => {
      let val = r[field.key];
      if (val) {
        val = String(val).trim().replace(/^\[|\]$/g, '');
        const valLower = val.toLowerCase();
        if (!seenVals.has(valLower)) {
          seenVals.add(valLower);
          uniqueVals.push(val);
        }
      }
    });
    const onChangeStr = field.onchange ? `data-onchange="${field.onchange}"` : '';
    const onInputStr = field.oninput ? `data-oninput="${field.oninput}"` : '';
    const escVal = val ? escapeHTML(val) : '';
    html += `
        <div class="custom-select-add-container" id="container-${field.key}" style="position: relative; width: 100%;">
          <input class="form-input custom-select-add-input" type="text" id="f-${field.key}" name="${field.key}" value="${escVal}" autocomplete="off" ${onChangeStr} ${onInputStr} ${disabledAttr} placeholder="Select or type..."
            onfocus="openCustomSelectAddDropdown('${field.key}')"
            oninput="filterCustomSelectAddDropdown('${field.key}')"
            onkeydown="handleCustomSelectAddKeydown(event, '${field.key}')"
            style="padding-right: 32px;" />
          <span class="custom-select-add-caret" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); pointer-events: none; color: #64748B; display: flex; align-items: center; justify-content: center;">
            <span class="material-symbols-rounded" style="font-size: 20px;">arrow_drop_down</span>
          </span>
          <div class="custom-select-add-dropdown" id="dropdown-${field.key}" style="display: none; position: absolute; top: 100%; left: 0; width: 100%; max-height: 200px; overflow-y: auto; background: #fff; border: 1px solid #E2E8F0; border-radius: 8px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05); z-index: 1000; margin-top: 4px;">
            ${uniqueVals.map(v => `
              <div class="custom-select-add-item" style="padding: 8px 12px; cursor: pointer; font-size: 13px; color: #1E293B; transition: background 0.15s ease;"
                onmouseover="this.style.background='#F1F5F9'"
                onmouseout="const input=document.getElementById('f-${field.key}'); const selected=(input && input.value.trim().toLowerCase() === this.textContent.trim().toLowerCase()); this.style.background=selected ? '#E2E8F0' : 'transparent';"
                onmousedown="selectCustomSelectAddValue('${field.key}', '${escapeHTML(v).replace(/'/g, "\\'")}')">
                ${escapeHTML(v)}
              </div>
            `).join('')}
            <div class="custom-select-add-item add-new-item" id="add-new-${field.key}" style="display: none; padding: 8px 12px; cursor: pointer; font-size: 13px; color: #475569; font-weight: 600; border-top: 1px solid #F1F5F9; transition: background 0.15s ease;"
              onmouseover="this.style.background='#F1F5F9'"
              onmouseout="this.style.background='transparent'"
              onmousedown="addNewCustomSelectAddValue('${field.key}')">
              + Add "<span class="new-val-span"></span>"
            </div>
          </div>
        </div>
      `;
  } else if (field.type === 'file') {
    const acceptStr = field.accept ? `accept="${field.accept}"` : '';
    html += `<div class="files-list-container" id="files-list-container-${field.key}" style="width: 100%;">`;

    let existingFiles = [];
    if (val) {
      try {
        if (String(val).startsWith('[')) {
          existingFiles = JSON.parse(val);
        } else {
          existingFiles = String(val).split(',').map(s => s.trim()).filter(Boolean);
        }
      } catch (e) {
        existingFiles = [val];
      }
    }

    if (existingFiles.length > 0) {
      existingFiles.forEach((fileUrl, idx) => {
        html += window.renderFileUploadSlotHTML(field.key, idx, fileUrl, acceptStr);
      });
      html += window.renderFileUploadSlotHTML(field.key, existingFiles.length, '', acceptStr);
    } else {
      html += window.renderFileUploadSlotHTML(field.key, 0, '', acceptStr);
    }
    html += `</div>`;
    html += `<div class="file-upload-hint" style="font-size: 11px; color: #64748B; margin-top: 4px;">Max file size: 10MB (PDF, DOC, DOCX, XLS, XLSX, PNG, JPG)</div>`;
  } else {
    const onChangeStr = field.onchange ? `onchange="${field.onchange}"` : '';
    const onInputStr = field.oninput ? `oninput="${field.oninput}"` : '';
    let extraAttrs = '';
    if (field.type === 'date' && field.minDate === 'today') {
      const d = new Date();
      const offset = d.getTimezoneOffset();
      const local = new Date(d.getTime() - (offset * 60 * 1000));
      extraAttrs += ` min="${local.toISOString().split('T')[0]}"`;
    }
    if (field.type === 'number') {
      if (field.step) {
        extraAttrs += ` step="${field.step}"`;
      } else {
        extraAttrs += ` step="0.01"`;
      }
      if (field.min !== undefined) extraAttrs += ` min="${field.min}"`;
      if (field.max !== undefined) extraAttrs += ` max="${field.max}"`;
    }
    if (field.placeholder) {
      extraAttrs += ` placeholder="${escapeHTML(field.placeholder)}"`;
    }
    html += `<input class="form-input" type="${field.type || 'text'}" id="f-${field.key}" name="${field.key}" value="${val}" ${onChangeStr} ${onInputStr} ${disabledAttr}${extraAttrs} />`;
  }
  if (field.hint) {
    html += `<div class="field-hint" style="font-size:11.5px; color:#64748B; margin-top:5px; font-weight:500;">${field.hint}</div>`;
  }
  html += `</div>`;
  return html;
}

function shouldHideFormField(moduleKey, field) {
  if (!field || field.key !== 'elements') return false;

  const hashModule = window.location.hash.replace('#', '').split('/')[0];
  return [moduleKey, hashModule, currentModule]
    .map(v => String(v || '').toLowerCase())
    .includes('my_request');
}

async function buildFormHTML(moduleKey, record) {
  const mod = MODULES[moduleKey];

  // Segment fields by section
  const sections = [];
  let currentSection = { name: 'General', fields: [] };
  sections.push(currentSection);

  for (const field of mod.fields) {
    if (shouldHideFormField(moduleKey, field)) continue;

    if (field.section) {
      currentSection = { name: field.section, fields: [] };
      sections.push(currentSection);
    } else {
      currentSection.fields.push(field);
    }
  }

  const activeSections = sections.filter(s => s.fields.length > 0);
  const useTabs = activeSections.length > 1;

  let html = '';

  const useRequestSections = ['request', 'my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(moduleKey);

  if (useTabs && !useRequestSections) {
    // Generate tabs header
    html += '<div class="form-tabs-header">';
    activeSections.forEach((sec, idx) => {
      const secLabel = (typeof t === 'function' ? t('section.' + sec.name.toLowerCase().replace(/[^a-z0-9]/g, '_'), sec.name) : sec.name).toUpperCase();
      const activeClass = idx === 0 ? ' active' : '';
      const tabId = `form-tab-${moduleKey}-${idx}`;
      html += `<button type="button" class="form-tab-btn${activeClass}" onclick="switchFormTab(this, '${tabId}')">${secLabel}</button>`;
    });
    html += '</div>';

    // Generate tab panes
    for (let idx = 0; idx < activeSections.length; idx++) {
      const sec = activeSections[idx];
      const activeClass = idx === 0 ? ' active' : '';
      const tabId = `form-tab-${moduleKey}-${idx}`;
      html += `<div class="form-tab-pane${activeClass}" id="${tabId}"><div class="form-grid">`;

      for (const field of sec.fields) {
        html += await renderFieldHTML(moduleKey, field, record);
      }

      html += '</div></div>';
    }
  } else if (useRequestSections) {
    // 3-Tab Request Wizard: 1. Request, 2. Request detail, 3. Assign task
    let isEdit = false;
    if (record && mod && mod.pk && record[mod.pk] !== undefined && record[mod.pk] !== null) {
      isEdit = true;
    }

    const tab2Keys = ['comment', 'file', 'attachment', 'procedure_file', 'files', 'attachments'];
    const tab1Fields = [];
    const tab2Fields = [];

    for (const field of mod.fields) {
      if (!field || field.section || !field.key) continue;
      if (shouldHideFormField(moduleKey, field)) continue;
      if (field.key === 'elements' && !isEdit) continue;
      if (isEdit) {
        const allowedEditFields = ['requester', 'company_id', 'request_type', 'description', 'sr_status', 'comment', 'file'];
        if (!allowedEditFields.includes(field.key)) continue;
      }
      if (tab2Keys.includes(field.key)) {
        tab2Fields.push(field);
      } else {
        tab1Fields.push(field);
      }
    }

    html += `
      <div class="wizard-header" style="display:flex; border-bottom:1px solid #E5E7EB; margin-bottom:20px; gap:8px;">
        <button type="button" class="wizard-tab active" onclick="switchWizardTab('request')" style="padding:10px 16px; font-size:13px; font-weight:600; color:#111827; background:none; border:none; border-bottom:2px solid #FF6A00; cursor:pointer; font-family:'Inter',sans-serif;">
          ${typeof t === 'function' ? t('wizard.tab_request', '1. Yêu cầu') : '1. Request'}
        </button>
        <button type="button" class="wizard-tab" onclick="switchWizardTab('detail')" style="padding:10px 16px; font-size:13px; font-weight:600; color:#6B7280; background:none; border:none; border-bottom:2px solid transparent; cursor:pointer; font-family:'Inter',sans-serif;">
          ${typeof t === 'function' ? t('wizard.tab_detail', '2. Chi tiết yêu cầu') : '2. Request detail'}
        </button>
        <button type="button" class="wizard-tab" id="wizard-tab-assign" onclick="switchWizardTab('assign')" style="display:none; padding:10px 16px; font-size:13px; font-weight:600; color:#6B7280; background:none; border:none; border-bottom:2px solid transparent; cursor:pointer; font-family:'Inter',sans-serif;">
          ${typeof t === 'function' ? t('wizard.tab_assign', '3. Giao việc') : '3. Assign task'}
        </button>
      </div>

      <div id="wizard-request" class="wizard-content active" style="display:block;">
        <div class="form-grid">
    `;

    for (const field of tab1Fields) {
      html += await renderFieldHTML(moduleKey, field, record);
    }

    html += `
        </div>
      </div>

      <div id="wizard-detail" class="wizard-content" style="display:none;">
        <div class="form-grid">
    `;

    for (const field of tab2Fields) {
      html += await renderFieldHTML(moduleKey, field, record);
    }

    html += `
        </div>
      </div>

      <div id="wizard-assign" class="wizard-content" style="display:none; min-height:260px; overflow:visible !important;">
        <div id="embedded-assign-task-wizard-container"></div>
      </div>
    `;
  } else {
    // Render standard single form-grid
    html += '<div class="form-grid">';
    const targetFields = activeSections.length > 0 ? activeSections[0].fields : mod.fields;
    for (const field of targetFields) {
      html += await renderFieldHTML(moduleKey, field, record);
    }
    html += '</div>';
  }

  // Append localized GHI CHÚ block matching user design image specs
  const notesTitle = typeof t === 'function' ? t('form.notes.title', 'GHI CHÚ') : 'GHI CHÚ';
  const notesReq = typeof t === 'function' ? t('form.notes.required', 'Các trường có dấu * là bắt buộc') : 'Các trường có dấu * là bắt buộc';
  const notesRealtime = typeof t === 'function' ? t('form.notes.realtime', 'Sử dụng validation realtime khi người dùng nhập liệu') : 'Sử dụng validation realtime khi người dùng nhập liệu';
  const notesDisableSave = typeof t === 'function' ? t('form.notes.disable_save', 'Disable nút Save nếu chưa điền đủ thông tin bắt buộc') : 'Disable nút Save nếu chưa điền đủ thông tin bắt buộc';
  const notesDragDrop = typeof t === 'function' ? t('form.notes.drag_drop', 'Hỗ trợ kéo thả file vào vùng upload') : 'Hỗ trợ kéo thả file vào vùng upload';

  html += `
    <div class="form-notes-container" style="margin-top: 24px; padding: 16px; background: #FFF7ED; border: 1px solid #FFEDD5; border-radius: 8px; font-size: 12px; color: #C2410C;">
      <div style="font-weight: 700; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
        <span class="material-symbols-rounded" style="font-size: 16px;">lightbulb</span> ${notesTitle}
      </div>
      <ul style="margin: 0; padding-left: 18px; line-height: 1.6; font-family: 'Inter', sans-serif;">
        <li>${notesReq.replace('*', '<span style="color:#EF4444; font-weight:bold;">*</span>')}</li>
        <li>${notesRealtime}</li>
        <li>${notesDisableSave}</li>
        <li>${notesDragDrop}</li>
      </ul>
    </div>
  `;

  return html;
}

window.toggleMultiselectPill = function (input) {
  const pill = input.closest('.form-multiselect-pill');
  if (pill) {
    if (input.checked) {
      pill.classList.add('active');
    } else {
      pill.classList.remove('active');
    }
  }

  const containerEl = input.closest('.form-multiselect-container');
  if (containerEl) {
    const anyChecked = containerEl.querySelectorAll('input[type="checkbox"]:checked').length > 0;
    if (anyChecked) {
      containerEl.style.border = '';
      containerEl.style.padding = '';
    }
  }

  // Custom constraint for Request elements multiselect:
  // If 'Contract' is selected, automatically uncheck and disable 'Payment' and 'Invoice'
  // If 'Payment' or 'Invoice' is selected, automatically uncheck and disable 'Contract'
  if (input.name === 'multi-elements') {
    const val = String(input.value).toUpperCase();
    const container = input.closest('.form-multiselect-container') || document;
    const checkboxes = Array.from(container.querySelectorAll('input[name="multi-elements"]'));

    const contractCheckbox = checkboxes.find(c => String(c.value).toUpperCase() === 'CONTRACT');
    const paymentCheckbox = checkboxes.find(c => String(c.value).toUpperCase() === 'PAYMENT');
    const invoiceCheckbox = checkboxes.find(c => String(c.value).toUpperCase() === 'INVOICE');

    const isContractChecked = contractCheckbox && contractCheckbox.checked;
    const isPaymentChecked = paymentCheckbox && paymentCheckbox.checked;
    const isInvoiceChecked = invoiceCheckbox && invoiceCheckbox.checked;

    if (isContractChecked) {
      // Contract is selected: uncheck and disable Payment and Invoice
      if (paymentCheckbox) {
        paymentCheckbox.checked = false;
        paymentCheckbox.disabled = true;
        paymentCheckbox.closest('.form-multiselect-pill')?.classList.remove('active');
        paymentCheckbox.closest('.form-multiselect-pill')?.classList.add('pill-disabled');
      }
      if (invoiceCheckbox) {
        invoiceCheckbox.checked = false;
        invoiceCheckbox.disabled = true;
        invoiceCheckbox.closest('.form-multiselect-pill')?.classList.remove('active');
        invoiceCheckbox.closest('.form-multiselect-pill')?.classList.add('pill-disabled');
      }
    } else {
      // Contract is NOT selected: re-enable Payment and Invoice (unless disabled by something else)
      if (paymentCheckbox) {
        paymentCheckbox.disabled = false;
        paymentCheckbox.closest('.form-multiselect-pill')?.classList.remove('pill-disabled');
      }
      if (invoiceCheckbox) {
        invoiceCheckbox.disabled = false;
        invoiceCheckbox.closest('.form-multiselect-pill')?.classList.remove('pill-disabled');
      }
    }

    if (isPaymentChecked || isInvoiceChecked) {
      // Payment or Invoice is selected: uncheck and disable Contract
      if (contractCheckbox) {
        contractCheckbox.checked = false;
        contractCheckbox.disabled = true;
        contractCheckbox.closest('.form-multiselect-pill')?.classList.remove('active');
        contractCheckbox.closest('.form-multiselect-pill')?.classList.add('pill-disabled');
      }
    } else {
      // Neither Payment nor Invoice is selected: re-enable Contract
      if (contractCheckbox) {
        contractCheckbox.disabled = false;
        contractCheckbox.closest('.form-multiselect-pill')?.classList.remove('pill-disabled');
      }
    }
  }
};

// ===== REALTIME FORM VALIDATION & DRAG-AND-DROP HANDLERS =====
function initDragAndDropFileUpload() {
  const containers = document.querySelectorAll('.file-upload-container');
  containers.forEach(container => {
    if (container.dataset.dragAndDropInitialized) return;
    container.dataset.dragAndDropInitialized = 'true';
    const input = container.querySelector('input[type="file"]');
    if (!input) return;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      container.addEventListener(eventName, e => {
        e.preventDefault();
        e.stopPropagation();
      }, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
      container.addEventListener(eventName, () => {
        container.style.borderColor = '#F97316';
        container.style.background = 'rgba(249, 115, 22, 0.05)';
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      container.addEventListener(eventName, () => {
        container.style.borderColor = '#E5E7EB';
        container.style.background = '#F9FAFB';
      }, false);
    });

    container.addEventListener('drop', e => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files && files.length) {
        input.files = files;
        if (typeof input.onchange === 'function') {
          input.onchange();
        } else {
          input.dispatchEvent(new Event('change'));
        }
      }
    });
  });
}

function validateFormAndNotify(moduleKey, showNotification = false) {
  const mod = MODULES[moduleKey];
  if (!mod || !mod.fields) return true;

  const formModalBody = document.getElementById('form-modal-body');
  if (!formModalBody) return true;

  const missingFields = [];
  const tabErrorsCount = {};

  const requiredFields = mod.fields.filter(f => f.required && f.key && !f.hidden);
  requiredFields.forEach(field => {
    const key = field.key;
    const isMultiselect = field.type === 'multiselect' || field.type === 'target_record_multiselect' || key === 'sr_owner';
    const el = document.getElementById(`f-${key}`) || document.getElementById(`files-list-container-${key}`) || document.getElementById(`container-${key}`);
    if (!el) return;

    let hasVal = false;
    let targetEl = el;

    if (isMultiselect) {
      const checkedBoxes = document.querySelectorAll(`input[name="multi-${key}"]:checked`);
      hasVal = checkedBoxes.length > 0;
      targetEl = document.getElementById(`container-${key}`) || el;
    } else if (el.classList.contains('files-list-container') || (el.tagName === 'INPUT' && el.type === 'file')) {
      const hiddenEls = document.querySelectorAll(`input[id^="f-${key}-base64-"]`);
      hasVal = Array.from(hiddenEls).some(h => h.value && h.value.trim());
    } else {
      hasVal = !!(el.value !== undefined && el.value !== null && String(el.value).trim() !== '');
      const sContainer = el.closest ? el.closest('.searchable-dropdown-container') : (el.parentNode && el.parentNode.classList.contains('searchable-dropdown-container') ? el.parentNode : null);
      if (sContainer) {
        const searchInp = sContainer.querySelector('.searchable-dropdown-input');
        if (searchInp) {
          const inpVal = searchInp.value.trim();
          if (inpVal === '') {
            hasVal = false;
          } else {
            const selectedOpt = el.options ? el.options[el.selectedIndex] : null;
            if (!selectedOpt || selectedOpt.value === '') {
              hasVal = false;
            }
          }
        }
      }
    }

    if (!isMultiselect) {
      if (el.parentNode && el.parentNode.classList.contains('searchable-dropdown-container')) {
        targetEl = el.parentNode.querySelector('.searchable-dropdown-input');
      } else if (el.closest && el.closest('.searchable-multiselect-container')) {
        targetEl = el.closest('.searchable-multiselect-container').querySelector('.multiselect-trigger');
      } else if (el.closest && el.closest('.segmented-control')) {
        targetEl = el.closest('.segmented-control');
      }
    }

    const pane = el.closest('.form-tab-pane') || el.closest('.wizard-content');
    const tabId = pane ? pane.id : null;

    if (!hasVal) {
      if (targetEl) {
        if (isMultiselect) {
          targetEl.style.border = '1px solid #EF4444';
          targetEl.style.borderRadius = '8px';
          targetEl.style.padding = '4px';
        } else {
          targetEl.style.borderColor = '#EF4444';
        }
      }
      const rawLabel = field.labelKey && typeof t === 'function' ? t(field.labelKey, field.label) : (field.label || key);
      const labelText = typeof rawLabel === 'string' ? rawLabel.replace(/^[*\s]+|[*\s]+$/g, '') : key;
      missingFields.push({
        key,
        label: labelText,
        targetEl,
        tabId,
        pane
      });
      if (tabId) {
        tabErrorsCount[tabId] = (tabErrorsCount[tabId] || 0) + 1;
      }
    } else {
      if (targetEl) {
        if (isMultiselect) {
          targetEl.style.border = '';
          targetEl.style.padding = '';
        } else {
          targetEl.style.borderColor = '#E5E7EB';
        }
      }
    }
  });

  // Contract conditional validation: CONTRACT NO required when Signed Date is set
  if (moduleKey === 'contract') {
    const sDate = document.getElementById('f-contract_signed_date');
    const cNo = document.getElementById('f-contractspood_no');
    const hasSignedDate = sDate && sDate.value && sDate.value.trim() !== '';
    const hasContractNo = cNo && cNo.value && cNo.value.trim() !== '';
    if (hasSignedDate && !hasContractNo) {
      if (cNo) cNo.style.borderColor = '#EF4444';
      const pane = cNo ? (cNo.closest('.form-tab-pane') || cNo.closest('.wizard-content')) : null;
      const tabId = pane ? pane.id : null;
      missingFields.push({
        key: 'contractspood_no',
        label: 'Contract No',
        targetEl: cNo,
        tabId,
        pane
      });
      if (tabId) tabErrorsCount[tabId] = (tabErrorsCount[tabId] || 0) + 1;
    } else if (cNo && hasContractNo) {
      cNo.style.borderColor = '#E5E7EB';
    }
  }

  // Update tab headers with error indicator dot
  const tabBtns = formModalBody.querySelectorAll('.form-tab-btn');
  tabBtns.forEach(btn => {
    const onclickStr = btn.getAttribute('onclick') || '';
    const m = onclickStr.match(/switchFormTab\([^,]+,\s*'([^']+)'\)/);
    const tabId = m ? m[1] : null;
    let badge = btn.querySelector('.tab-error-dot');
    if (tabId && tabErrorsCount[tabId]) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'tab-error-dot';
        badge.style.cssText = 'display:inline-block;width:6px;height:6px;background:#EF4444;border-radius:50%;margin-left:6px;vertical-align:middle;';
        btn.appendChild(badge);
      }
    } else if (badge) {
      badge.remove();
    }
  });

  if (missingFields.length > 0) {
    if (showNotification) {
      const missingNames = missingFields.map(f => f.label);
      const prefix = typeof t === 'function' ? t('form.missing_fields_warning', 'Vui lòng điền đủ các trường bắt buộc còn thiếu: ') : 'Vui lòng điền đủ các trường bắt buộc còn thiếu: ';
      showToast(prefix + missingNames.join(', '), 'error');

      // Auto switch to tab containing the first missing field
      const firstMissing = missingFields[0];
      if (firstMissing.tabId) {
        const targetBtn = Array.from(tabBtns).find(b => (b.getAttribute('onclick') || '').includes(firstMissing.tabId));
        if (targetBtn && typeof window.switchFormTab === 'function') {
          window.switchFormTab(targetBtn, firstMissing.tabId);
        }
      }
      if (firstMissing.targetEl && typeof firstMissing.targetEl.focus === 'function') {
        setTimeout(() => firstMissing.targetEl.focus(), 150);
      }
    }
    return false;
  }

  return true;
}

function initFormRealtimeValidation(moduleKey) {
  const mod = MODULES[moduleKey];
  const requiredKeys = mod && mod.fields ? mod.fields.filter(f => f.required).map(f => f.key) : [];
  const saveBtn = document.getElementById('form-modal-save');
  if (saveBtn) {
    saveBtn.disabled = false;
  }
  const draftBtn = document.getElementById('form-modal-draft');
  if (draftBtn) {
    draftBtn.disabled = false;
  }

  initDragAndDropFileUpload();

  function validate() {
    validateFormAndNotify(moduleKey, false);
  }

  requiredKeys.forEach(key => {
    const el = document.getElementById(`f-${key}`) || document.getElementById(`files-list-container-${key}`);
    if (el) {
      ['input', 'change'].forEach(evt => {
        el.addEventListener(evt, validate);
      });
      const hiddenEls = document.querySelectorAll(`input[id^="f-${key}-base64-"]`);
      hiddenEls.forEach(base64El => {
        base64El.addEventListener('change', validate);
      });
    }
  });

  const formModalBody = document.getElementById('form-modal-body');
  if (formModalBody) {
    formModalBody.querySelectorAll('input, select, textarea').forEach(inp => {
      ['input', 'change', 'blur'].forEach(evt => {
        inp.addEventListener(evt, validate);
      });
    });
  }

  if (moduleKey === 'contract') {
    const sDate = document.getElementById('f-contract_signed_date');
    if (sDate) {
      ['change', 'input'].forEach(evt => {
        sDate.addEventListener(evt, () => {
          if (typeof window.handleContractNoValidation === 'function') {
            window.handleContractNoValidation();
          }
          validate();
        });
      });
    }
    const cNo = document.getElementById('f-contractspood_no');
    if (cNo) {
      ['input', 'change'].forEach(evt => {
        cNo.addEventListener(evt, validate);
      });
    }
    if (typeof window.handleContractNoValidation === 'function') {
      window.handleContractNoValidation();
    }
  }

  validate();
}

function initFormNumericFormatting(moduleKey) {
  const mod = MODULES[moduleKey];
  if (!mod || !mod.fields) return;

  window.formatInputAsNumber = function (inputEl, isTyping = false) {
    const cursorPosition = inputEl.selectionStart;
    const originalLength = inputEl.value.length;

    let rawVal = inputEl.value.replace(/,/g, '');
    rawVal = rawVal.replace(/[^\d.]/g, '');
    const dotIdx = rawVal.indexOf('.');
    if (dotIdx !== -1) {
      rawVal = rawVal.substring(0, dotIdx + 1) + rawVal.substring(dotIdx + 1).replace(/\./g, '');
    }

    if (rawVal === '') {
      inputEl.value = '';
      return;
    }

    // When initializing from DB/duplicate, clean excessive decimal zeros (e.g. "1.000000" -> 1, "25400.000000" -> 25400)
    if (!isTyping && rawVal.includes('.')) {
      const num = parseFloat(rawVal);
      if (!isNaN(num)) {
        rawVal = String(num);
      }
    }

    const parts = rawVal.split('.');
    const integerPart = parts[0];
    const decimalPart = parts[1];

    let formatted = '';
    if (integerPart) {
      formatted = parseInt(integerPart, 10).toLocaleString('en-US');
    } else {
      formatted = '0';
    }
    if (parts.length > 1) {
      formatted += '.' + (decimalPart !== undefined ? decimalPart : '');
    }

    inputEl.value = formatted;

    if (isTyping && cursorPosition !== null) {
      const newLength = formatted.length;
      const diff = newLength - originalLength;
      inputEl.setSelectionRange(cursorPosition + diff, cursorPosition + diff);
    }
  };

  mod.fields.forEach(field => {
    if (field.section) return;
    const el = document.getElementById(`f-${field.key}`);
    if (!el || el.tagName !== 'INPUT') return;

    const k = String(field.key).toLowerCase();
    const isNumericField = isNumericFieldKey(field.key, field.type);

    if (isNumericField) {
      if (field.createReadonly || field.editReadonly) {
        if (el.value) {
          formatInputAsNumber(el, false);
        }
        return;
      }

      if (el.value) {
        formatInputAsNumber(el, false);
      }

      el.addEventListener('input', () => {
        formatInputAsNumber(el, true);
        if (field.onchange) {
          try {
            if (field.onchange === 'handlePaymentValueChange()') {
              window.handlePaymentValueChange();
            } else if (field.onchange === 'handleInvoiceValueChange()') {
              window.handleInvoiceValueChange();
            } else if (field.onchange === 'handleAssetValueChange()') {
              window.handleAssetValueChange();
            } else {
              eval(field.onchange);
            }
          } catch (e) {
            console.error('Error invoking onchange handler:', e);
          }
        }
      });
    }
  });
}

function collectFormData(moduleKey) {
  const mod = MODULES[moduleKey];
  const data = {};
  for (const field of mod.fields) {
    if (field.section) continue;
    if (field.virtual) continue;
    const isSrOwner = field.key === 'sr_owner';
    const el = document.getElementById(`f-${field.key}`);
    if (!el && field.type !== 'multiselect' && field.type !== 'target_record_multiselect' && !isSrOwner) continue;
    if (field.arrayField) {
      // Convert comma-separated string to array
      data[field.key] = el.value.split(',').map(s => s.trim()).filter(Boolean);
    } else if (field.type === 'multiselect' || field.type === 'target_record_multiselect' || isSrOwner) {
      const checkboxes = document.querySelectorAll(`input[name="multi-${field.key}"]:checked`);
      const selectedVals = Array.from(checkboxes).map(cb => String(cb.value).trim().replace(/^\[|\]$/g, '')).filter(Boolean);
      if (moduleKey === 'permissions' || field.type === 'target_record_multiselect') {
        data[field.key] = selectedVals;
      } else {
        data[field.key] = selectedVals.length > 0 ? selectedVals.join(', ') : null;
      }
    } else if (field.type === 'file') {
      const hiddenEls = document.querySelectorAll(`input[id^="f-${field.key}-base64-"]`);
      if (hiddenEls.length > 0) {
        const vals = Array.from(hiddenEls).map(el => el.value).filter(Boolean);
        data[field.key] = vals.length > 0 ? JSON.stringify(vals) : null;
      } else {
        const hiddenEl = document.getElementById(`f-${field.key}-base64`);
        data[field.key] = hiddenEl ? (hiddenEl.value || null) : null;
      }
    } else {
      let val = el.value || null;
      const sContainer = el.closest ? el.closest('.searchable-dropdown-container') : (el.parentNode && el.parentNode.classList.contains('searchable-dropdown-container') ? el.parentNode : null);
      if (sContainer) {
        const searchInp = sContainer.querySelector('.searchable-dropdown-input');
        if (searchInp) {
          const inpVal = searchInp.value.trim();
          if (inpVal === '') {
            val = null;
          } else {
            const selectedOpt = el.options ? el.options[el.selectedIndex] : null;
            if (!selectedOpt || selectedOpt.value === '') {
              val = null;
            }
          }
        }
      }
      if (val && typeof val === 'string') {
        const isNumericField = isNumericFieldKey(field.key, field.type);
        if (isNumericField) {
          val = val.replace(/,/g, '');
        }
      }
      data[field.key] = val;
    }
  }

  return data;
}

function processNonImageFile(file, dataUrl, hiddenEl, previewEl, textEl, fieldKey) {
  if (previewEl) previewEl.style.display = 'none';

  if (!file) {
    if (hiddenEl) {
      hiddenEl.value = dataUrl || '';
      hiddenEl.dispatchEvent(new Event('change'));
    }
    return;
  }

  const container = textEl ? textEl.closest('.file-upload-container') : null;
  const iconEl = container ? container.querySelector('.file-upload-icon') : null;

  if (file.size > 10 * 1024 * 1024) {
    showToast(typeof t === 'function' ? t('toast.file_too_large', 'File too large! Max size is 10MB.') : 'File too large! Max size is 10MB.', 'error');
    if (hiddenEl) hiddenEl.value = '';
    if (textEl) {
      textEl.textContent = 'Choose File or Drag & Drop here';
      textEl.style.whiteSpace = 'nowrap';
    }
    if (iconEl) iconEl.style.display = 'inline-block';
    return;
  }

  const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
  if (container) container.classList.add('has-file');
  if (iconEl) iconEl.style.display = 'none';
  if (textEl) {
    textEl.style.whiteSpace = 'normal';
    textEl.style.width = '100%';
    textEl.style.maxWidth = '100%';
    textEl.innerHTML = renderGmailProgressHTML(file.name, fileSizeMB, 0, false, null, false);
  }

  uploadBinaryFile(file, pct => {
    if (textEl) textEl.innerHTML = renderGmailProgressHTML(file.name, fileSizeMB, pct, false, null, false);
  })
    .then(url => {
      if (hiddenEl) {
        hiddenEl.value = url;
        hiddenEl.dispatchEvent(new Event('change'));
      }
      if (textEl) textEl.innerHTML = renderGmailProgressHTML(file.name, fileSizeMB, 100, true, null, false);
    })
    .catch(err => {
      console.error('Binary upload failed:', err);
      showToast('File upload failed: ' + err.message, 'error');
      if (textEl) textEl.innerHTML = renderGmailProgressHTML(file.name, fileSizeMB, 0, false, err.message, false);
    });
}

function handleFileChange(inputProxy, fieldKey) {
  const file = inputProxy.files[0];
  if (!file) return;

  const disallowedExts = ['exe', 'bat', 'cmd', 'sh', 'vbs', 'msi', 'dll', 'com', 'ps1', 'scr', 'bin', 'pif', 'application', 'gadget', 'hta', 'cpl', 'msc', 'jar'];
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (disallowedExts.includes(ext)) {
    showToast(`File "${file.name}" không hợp lệ. Không được phép tải lên file thực thi hoặc script (.${ext}).`, 'error');
    inputProxy.value = '';
    return;
  }

  const hiddenEl = document.getElementById(`f-${fieldKey}-base64`);
  const previewEl = document.getElementById(`preview-${fieldKey}`);
  const container = inputProxy.closest('.file-upload-container');
  const textEl = container ? container.querySelector('.file-upload-text') : null;
  const iconEl = container ? container.querySelector('.file-upload-icon') : null;

  if (file.size > 10 * 1024 * 1024) {
    showToast(typeof t === 'function' ? t('toast.file_too_large', 'File too large! Max size is 10MB.') : 'File too large! Max size is 10MB.', 'error');
    inputProxy.value = '';
    if (hiddenEl) hiddenEl.value = '';
    if (textEl) {
      textEl.textContent = 'Choose File or Drag & Drop here';
      textEl.style.whiteSpace = 'nowrap';
    }
    if (iconEl) iconEl.style.display = 'inline-block';
    return;
  }

  const isImage = file.type.startsWith('image/');
  if (isImage && previewEl) {
    try {
      previewEl.src = URL.createObjectURL(file);
      previewEl.style.display = 'block';
    } catch (e) {}
  } else if (previewEl) {
    previewEl.style.display = 'none';
  }

  processNonImageFile(file, null, hiddenEl, previewEl, textEl, fieldKey);
}

window.clearFileUploadSlot = function (fieldKey, idx) {
  const slotEl = document.getElementById(`file-slot-${fieldKey}-${idx}`);
  const parentContainer = slotEl ? slotEl.closest('.files-list-container') : document.getElementById(`files-list-container-${fieldKey}`);

  if (parentContainer) {
    const allSlots = Array.from(parentContainer.querySelectorAll('.file-upload-slot'));
    if (allSlots.length > 1) {
      if (slotEl) slotEl.remove();
      const remainingSlots = Array.from(parentContainer.querySelectorAll('.file-upload-slot'));
      const hasEmptySlot = remainingSlots.some(s => {
        const h = s.querySelector('input[id*="-base64"]');
        return !h || !h.value;
      });
      if (!hasEmptySlot) {
        const uniqueNextIndex = Date.now();
        const acceptStr = (slotEl && slotEl.querySelector('input[type="file"]')?.accept) ? `accept="${slotEl.querySelector('input[type="file"]').accept}"` : '';
        const newSlotHTML = window.renderFileUploadSlotHTML(fieldKey, uniqueNextIndex, '', acceptStr);
        parentContainer.insertAdjacentHTML('beforeend', newSlotHTML);
        initDragAndDropFileUpload();
      }
      return;
    }
  }

  const hiddenEl = document.getElementById(`f-${fieldKey}-base64-${idx}`);
  const inputEl = document.getElementById(`f-${fieldKey}-${idx}`);
  const previewEl = document.getElementById(`preview-${fieldKey}-${idx}`);
  const container = slotEl ? slotEl.querySelector('.file-upload-container') : null;
  const textEl = container ? container.querySelector('.file-upload-text') : null;
  const iconEl = container ? container.querySelector('.file-upload-icon') : null;
  const removeBtn = slotEl ? slotEl.querySelector('.file-remove-btn') : null;

  if (hiddenEl) {
    hiddenEl.value = '';
    hiddenEl.dispatchEvent(new Event('change'));
  }
  if (inputEl) inputEl.value = '';
  if (previewEl) {
    previewEl.style.display = 'none';
    previewEl.innerHTML = '';
  }
  if (textEl) {
    textEl.textContent = 'Choose File or Drag & Drop here';
    textEl.style.whiteSpace = 'nowrap';
    textEl.style.width = '';
    textEl.style.maxWidth = '';
  }
  if (iconEl) {
    iconEl.textContent = 'upload_file';
    iconEl.style.display = 'inline-block';
  }
  if (container) {
    container.classList.remove('has-file');
  }
  if (removeBtn) removeBtn.style.display = 'none';
};

window.renderFileUploadSlotHTML = function (fieldKey, idx, val = '', acceptStr = '') {
  const cleanName = val ? formatFileNameDisplay(val, 28) : '';
  const displayVal = val ? cleanName : 'Choose File or Drag & Drop here';
  const previewStyle = val ? 'display:block;' : 'display:none;';
  let previewContent = '';
  if (val && val.startsWith('data:image')) {
    previewContent = `<img src="${val}" alt="Preview" style="max-width:100px; max-height:100px; border-radius:4px;" />`;
  } else if (val) {
    const shortCleanName = typeof truncateFileName === 'function' ? truncateFileName(cleanName, 28) : cleanName;
    previewContent = `<div style="display:inline-flex; align-items:center; gap:6px; font-size:11px; color:var(--accent); font-weight:600; max-width:100%; min-width:0; overflow:hidden;" title="${escapeHTML(cleanName)}"><span class="material-symbols-rounded" style="font-size:14px; flex-shrink:0;">attach_file</span> <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:240px;">${escapeHTML(shortCleanName)}</span></div>`;
  }
  const removeBtnStyle = val ? 'display:inline-flex;' : 'display:none;';
  return `
      <div class="file-upload-slot" id="file-slot-${fieldKey}-${idx}" style="position:relative; margin-bottom:12px; border:1px dashed #CBD5E1; padding:12px; border-radius:8px; box-sizing:border-box; width:100%;">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; width:100%; min-width:0;">
          <div class="file-upload-container" onclick="document.getElementById('f-${fieldKey}-${idx}').click()" style="display:flex; align-items:center; gap:10px; cursor:pointer; flex:1; min-width:0; width:100%; overflow:hidden;">
            <span class="material-symbols-rounded file-upload-icon" style="flex-shrink:0;">${val ? 'attach_file' : 'upload_file'}</span>
            <div class="file-upload-text" style="font-size:12px; font-weight:500; color:#1E293B; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; min-width:0; width:100%;" title="${escapeHTML(displayVal)}">${escapeHTML(displayVal)}</div>
            <input type="file" id="f-${fieldKey}-${idx}" name="${fieldKey}" ${acceptStr} onchange="handleMultipleFileChange(this, '${fieldKey}', ${idx})" style="display: none;" />
          </div>
          <button type="button" class="file-remove-btn" onclick="event.stopPropagation(); window.clearFileUploadSlot('${fieldKey}', ${idx})" title="Xóa file" style="${removeBtnStyle} align-items:center; justify-content:center; width:28px; height:28px; background:#FEE2E2; color:#DC2626; border:none; border-radius:6px; cursor:pointer; flex-shrink:0;">
            <span class="material-symbols-rounded" style="font-size:16px;">close</span>
          </button>
        </div>
        <input type="hidden" id="f-${fieldKey}-base64-${idx}" value="${val}" />
        <div id="preview-${fieldKey}-${idx}" style="margin-top:8px;${previewStyle}; max-width:100%; min-width:0; overflow:hidden;">${previewContent}</div>
      </div>
    `;
};

window.handleMultipleFileChange = function (inputProxy, fieldKey, idx) {
  const file = inputProxy.files[0];
  if (!file) return;

  const disallowedExts = ['exe', 'bat', 'cmd', 'sh', 'vbs', 'msi', 'dll', 'com', 'ps1', 'scr', 'bin', 'pif', 'application', 'gadget', 'hta', 'cpl', 'msc', 'jar'];
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (disallowedExts.includes(ext)) {
    showToast(`File "${file.name}" không hợp lệ. Không được phép tải lên file thực thi hoặc script (.${ext}).`, 'error');
    inputProxy.value = '';
    return;
  }

  const hiddenEl = document.getElementById(`f-${fieldKey}-base64-${idx}`);
  const previewEl = document.getElementById(`preview-${fieldKey}-${idx}`);
  const container = inputProxy.closest('.file-upload-container');
  const textEl = container ? container.querySelector('.file-upload-text') : null;
  const iconEl = container ? container.querySelector('.file-upload-icon') : null;

  const showRemoveBtn = () => {
    const slotEl = document.getElementById(`file-slot-${fieldKey}-${idx}`);
    const removeBtn = slotEl ? slotEl.querySelector('.file-remove-btn') : null;
    if (removeBtn) removeBtn.style.display = 'inline-flex';
  };

  if (file.size > 10 * 1024 * 1024) {
    showToast(typeof t === 'function' ? t('toast.file_too_large', 'File too large! Max size is 10MB.') : 'File too large! Max size is 10MB.', 'error');
    inputProxy.value = '';
    if (hiddenEl) hiddenEl.value = '';
    if (textEl) {
      textEl.textContent = 'Choose File or Drag & Drop here';
      textEl.style.whiteSpace = 'nowrap';
    }
    if (iconEl) iconEl.style.display = 'inline-block';
    return;
  }

  const parentContainer = document.getElementById(`files-list-container-${fieldKey}`);

  const appendNextSlotIfNeeded = () => {
    showRemoveBtn();
    if (!parentContainer) return;
    const allSlots = Array.from(parentContainer.querySelectorAll('.file-upload-slot'));
    const hasEmptySlot = allSlots.some(s => {
      const h = s.querySelector('input[id*="-base64"]');
      return !h || !h.value;
    });
    if (!hasEmptySlot) {
      const uniqueNextIndex = Date.now();
      const acceptStr = inputProxy.accept ? `accept="${inputProxy.accept}"` : '';
      const newSlotHTML = window.renderFileUploadSlotHTML(fieldKey, uniqueNextIndex, '', acceptStr);
      parentContainer.insertAdjacentHTML('beforeend', newSlotHTML);
      initDragAndDropFileUpload();
    }
  };

  const isImage = file.type.startsWith('image/');
  if (isImage && previewEl) {
    try {
      previewEl.style.display = 'block';
      previewEl.innerHTML = `<img src="${URL.createObjectURL(file)}" alt="Preview" style="max-width:100px; max-height:100px; border-radius:4px;" />`;
    } catch (e) {}
  } else if (previewEl) {
    const shortUploadName = typeof truncateFileName === 'function' ? truncateFileName(file.name, 28) : file.name;
    previewEl.style.display = 'block';
    previewEl.innerHTML = `<div style="display:inline-flex; align-items:center; gap:6px; font-size:11px; color:var(--accent); font-weight:600; max-width:100%; min-width:0; overflow:hidden;" title="${escapeHTML(file.name)}"><span class="material-symbols-rounded" style="font-size:14px; flex-shrink:0;">attach_file</span> <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:240px;">${escapeHTML(shortUploadName)}</span></div>`;
  }

  const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
  if (container) container.classList.add('has-file');
  if (iconEl) iconEl.style.display = 'none';
  if (textEl) {
    textEl.style.whiteSpace = 'normal';
    textEl.style.width = '100%';
    textEl.style.maxWidth = '100%';
    textEl.innerHTML = renderGmailProgressHTML(file.name, fileSizeMB, 0, false, null, false);
  }
  uploadBinaryFile(file, pct => {
    if (textEl) textEl.innerHTML = renderGmailProgressHTML(file.name, fileSizeMB, pct, false, null, false);
  })
    .then(url => {
      if (hiddenEl) {
        hiddenEl.value = url;
        hiddenEl.dispatchEvent(new Event('change'));
      }
      if (textEl) textEl.innerHTML = renderGmailProgressHTML(file.name, fileSizeMB, 100, true, null, false);
      appendNextSlotIfNeeded();
    })
    .catch(err => {
      console.error('Binary chunked upload failed:', err);
      showToast('File upload failed: ' + err.message, 'error');
      if (textEl) textEl.innerHTML = renderGmailProgressHTML(file.name, fileSizeMB, 0, false, err.message, false);
    });
};


function getWriteEndpoint(mod) {
  if (mod.writeTable) return `/table/${mod.writeTable}`;
  if (mod.endpoint.startsWith('/table/')) return mod.endpoint.split('?')[0];
  return mod.endpoint;
}

// ============================================================
// IN-PLACE / SILENT TABLE REFRESH
// ============================================================
async function refreshTableData(moduleKey, silent = false) {
  if (moduleKey === 'assigned_task') {
    await renderAssignedTaskKanbanView('assigned_task', true);
    return;
  }
  const mod = MODULES[moduleKey];
  const tbody = document.getElementById(`tbody-${moduleKey}`);

  if (currentView !== 'table' || currentModule !== moduleKey || !tbody) {
    // Fallback to full render if we are not on the table view of this module
    await renderTableView(moduleKey);
    return;
  }

  try {
    const sep = mod.endpoint.includes('?') ? '&' : '?';
    // Fetch fresh data in the background silently
    const res = await apiGet(`${mod.endpoint}${sep}slice=${moduleKey}`);
    const data = res.data && Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []);

    currentData = data;

    // Update the tbody content immediately for instant feedback
    tbody.innerHTML = buildTableRows(moduleKey, data);
    requestAnimationFrame(() => {
      if (typeof initStickyOffsets === 'function') initStickyOffsets(moduleKey);
    });

    // Reapply existing searches and column filters immediately
    applyAllFilters(moduleKey);

    // Fetch missing lookups in background and softly redraw when done
    prefetchLookups(moduleKey).then(() => {
      if (currentView === 'table' && currentModule === moduleKey && document.getElementById(`tbody-${moduleKey}`)) {
        document.getElementById(`tbody-${moduleKey}`).innerHTML = buildTableRows(moduleKey, currentData);
        drawFilterSidebar(moduleKey);
        applyAllFilters(moduleKey);
      }
    });

    // Update count indicator
    const countEl = document.getElementById(`count-${moduleKey}`);
    if (countEl) {
      countEl.textContent = `${data.length} records`;
    }
  } catch (err) {
    console.error("Failed to refresh table data in background:", err);
    if (!silent) {
      showToast(err.message, 'error');
    }
  }
}

function getCompanyAbbreviation(shortName) {
  if (!shortName) return 'CO';
  // Remove Vietnamese diacritics/accents and convert to uppercase
  const cleanName = shortName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  // Keep only alphanumeric characters, spaces, hyphens, and underscores
  const safeName = cleanName.replace(/[^A-Z0-9\s\-_]/g, '');
  // Split based on spaces, hyphens, underscores
  const words = safeName.split(/[\s\-_]+/).filter(Boolean);
  if (words.length > 1) {
    // If multiple words, take the first letter/digit of each word
    return words.map(w => {
      return /^\d+$/.test(w) ? w : w[0];
    }).join('');
  }
  // If single word, take up to 4 characters
  return cleanName.slice(0, 4);
}

function getCmsCountryByName(countryName) {
  if (!countryName || !selectCache['cms_country']) return null;
  return selectCache['cms_country'].find(country => String(country.name || '').trim() === String(countryName).trim()) || null;
}

function getCmsProvinceByName(provinceName) {
  if (!provinceName || !selectCache['cms_province']) return null;
  return selectCache['cms_province'].find(prov => String(prov.name || '').trim() === String(provinceName).trim()) || null;
}

function getFilteredCmsProvinces(countryName) {
  const provinces = selectCache['cms_province'] || [];
  const country = getCmsCountryByName(countryName);
  if (!country) return [];
  return provinces.filter(prov => String(prov.country_id || '') === String(country.id || ''));
}

function getFilteredCmsCitiesByProvince(provinceName) {
  const cities = selectCache['cms_city'] || [];
  const province = getCmsProvinceByName(provinceName);
  if (!province) return [];
  return cities.filter(city => String(city.province_id || '') === String(province.id || ''));
}

function getFilteredCmsCitiesByCountry(countryName) {
  const cities = selectCache['cms_city'] || [];
  const country = getCmsCountryByName(countryName);
  if (!country) return [];
  return cities.filter(city => String(city.country_id || '') === String(country.id || ''));
}

// Keep getFilteredCmsCities for potential backward compatibility
function getFilteredCmsCities(countryName) {
  return getFilteredCmsCitiesByCountry(countryName);
}

window.fetchBusinessInfoByTaxCode = async function () {
  const taxCodeEl = document.getElementById('f-tax_code');
  if (!taxCodeEl) return;
  const taxCode = taxCodeEl.value.trim();
  if (!taxCode) {
    showToast('Vui lòng nhập mã số thuế', 'warning');
    return;
  }
  await window.lookupTaxCode(taxCode, true);
};

window.handleCompanyTaxCodeChange = async function () {
  const taxCodeEl = document.getElementById('f-tax_code');
  if (!taxCodeEl) return;
  const taxCode = taxCodeEl.value.trim();
  if (!taxCode) return;
  await window.lookupTaxCode(taxCode, false);
};

window.lookupTaxCode = async function (taxCode, forceOverwrite) {
  const lookupKey = taxCode.replace(/[^0-9A-Za-z-]/g, '');
  if (!lookupKey) return;

  const taxCodeEl = document.getElementById('f-tax_code');
  if (taxCodeEl && taxCodeEl.dataset.lastLookupTaxCode === lookupKey && !forceOverwrite) return;
  if (taxCodeEl) taxCodeEl.dataset.lastLookupTaxCode = lookupKey;

  try {
    showToast('Đang tra cứu thông tin doanh nghiệp...', 'info');
    const response = await fetch(`https://api.vietqr.io/v2/business/${encodeURIComponent(lookupKey)}`);
    if (!response.ok) throw new Error(`VietQR returned ${response.status}`);

    const payload = await response.json();
    if (payload.code !== '00' || !payload.data) {
      if (forceOverwrite) showToast(payload.desc || 'Không tìm thấy thông tin doanh nghiệp', 'warning');
      return;
    }

    const shortNameEl = document.getElementById('f-company_shortname');
    const fullnameEl = document.getElementById('f-company_fullname');
    const addressEl = document.getElementById('f-address');

    if (fullnameEl && (forceOverwrite || !fullnameEl.value.trim())) {
      fullnameEl.value = payload.data.name || '';
    }
    if (shortNameEl && (forceOverwrite || !shortNameEl.value.trim())) {
      shortNameEl.value = payload.data.shortName || payload.data.name || '';
      shortNameEl.dataset.vietqrShortName = payload.data.shortName || payload.data.name || '';
      window.applyCompanyCountryCodeToShortName();
    }
    if (addressEl && (forceOverwrite || !addressEl.value.trim())) {
      addressEl.value = payload.data.address || '';
    }

    // Update read-only Company Label
    window.updateCompanyLabel();
    showToast('Tra cứu thông tin doanh nghiệp thành công!', 'success');
  } catch (error) {
    console.warn('[VietQR] Business lookup failed:', error.message);
    if (forceOverwrite) showToast('Lỗi kết nối API tra cứu thông tin doanh nghiệp', 'error');
  }
};

window.updateCompanyLabel = function () {
  const shortEl = document.getElementById('f-company_shortname');
  const fullEl = document.getElementById('f-company_fullname');
  const labelEl = document.getElementById('f-counter_party_label');
  if (shortEl && fullEl && labelEl) {
    const shortVal = shortEl.value.trim();
    const fullVal = fullEl.value.trim();
    labelEl.value = [shortVal, fullVal].filter(Boolean).join(' | ');
  }
};

window.applyCompanyCountryCodeToShortName = function () {
  const countryEl = document.getElementById('f-country');
  const shortNameEl = document.getElementById('f-company_shortname');
  if (!countryEl || !shortNameEl || !shortNameEl.dataset.vietqrShortName) return;

  const country = getCmsCountryByName(countryEl.value);
  const countryCode = String(country?.code || '').trim();
  const shortName = shortNameEl.dataset.vietqrShortName;
  shortNameEl.value = countryCode ? `${countryCode}-${shortName}` : shortName;
  shortNameEl.dispatchEvent(new Event('change', { bubbles: true }));
  window.updateCompanyLabel();
};

window.handleCompanyCountryChange = async function () {
  const countryEl = document.getElementById('f-country');
  const provinceEl = document.getElementById('f-province');
  const cityEl = document.getElementById('f-city');
  if (!countryEl) return;

  window.applyCompanyCountryCodeToShortName();

  const selectedCountry = (countryEl.value || '').trim();

  if (provinceEl) {
    let provinces = [];
    if (selectedCountry) {
      try {
        const res = await apiGet(`/cms-lookups/provinces?country=${encodeURIComponent(selectedCountry)}`);
        provinces = res.data || [];
      } catch (e) {
        console.warn('Failed to load provinces:', e);
      }
    }
    const currentProvince = provinceEl.value;
    provinceEl.innerHTML = `<option value="">— Select —</option>` + provinces.map(prov => {
      const provName = prov.name || '';
      return `<option value="${escapeHTML(provName)}" ${String(currentProvince) === String(provName) ? 'selected' : ''}>${escapeHTML(provName)}</option>`;
    }).join('');

    if (currentProvince && !provinces.some(prov => String(prov.name) === String(currentProvince))) {
      provinceEl.value = '';
    }
    if (window.handleCompanyProvinceChange) {
      await window.handleCompanyProvinceChange();
    }
  } else if (cityEl) {
    let cities = [];
    if (selectedCountry) {
      try {
        const res = await apiGet(`/cms-lookups/cities?country=${encodeURIComponent(selectedCountry)}`);
        cities = res.data || [];
      } catch (e) {
        console.warn('Failed to load cities:', e);
      }
    }
    const currentCity = cityEl.value;
    cityEl.innerHTML = `<option value="">— Select —</option>` + cities.map(city => {
      const cityName = city.name || '';
      return `<option value="${escapeHTML(cityName)}" ${String(currentCity) === String(cityName) ? 'selected' : ''}>${escapeHTML(cityName)}</option>`;
    }).join('');

    if (currentCity && !cities.some(city => String(city.name) === String(currentCity))) {
      cityEl.value = '';
    }
  }
};

window.handleCompanyProvinceChange = async function () {
  const countryEl = document.getElementById('f-country');
  const provinceEl = document.getElementById('f-province');
  const cityEl = document.getElementById('f-city');
  if (!provinceEl || !cityEl) return;

  const selectedProvince = (provinceEl.value || '').trim();
  const selectedCountry = countryEl ? (countryEl.value || '').trim() : '';

  let cities = [];
  if (selectedProvince || selectedCountry) {
    try {
      let u = '/cms-lookups/cities?';
      if (selectedProvince) u += `province=${encodeURIComponent(selectedProvince)}`;
      else if (selectedCountry) u += `country=${encodeURIComponent(selectedCountry)}`;
      const res = await apiGet(u);
      cities = res.data || [];
    } catch (e) {
      console.warn('Failed to load cities:', e);
    }
  }

  const currentCity = cityEl.value;
  cityEl.innerHTML = `<option value="">— Select —</option>` + cities.map(city => {
    const cityName = city.name || '';
    return `<option value="${escapeHTML(cityName)}" ${String(currentCity) === String(cityName) ? 'selected' : ''}>${escapeHTML(cityName)}</option>`;
  }).join('');

  if (currentCity && !cities.some(city => String(city.name) === String(currentCity))) {
    cityEl.value = '';
  }
};

window.handleEmployeeCompanyChange = async function () {
  const companySelect = document.getElementById('f-company_id');
  const employeeIdInput = document.getElementById('f-employee_id');
  if (!companySelect || !employeeIdInput) return;

  // Don't overwrite if it's already set (except if it is empty or placeholder)
  if (employeeIdInput.value && employeeIdInput.value !== 'Auto-generated') return;

  const companyId = companySelect.value;
  if (!companyId) return;

  try {
    const companies = await getSelectOptions('my_company');
    const company = companies.find(c => String(c.my_company_id) === String(companyId));
    if (!company) return;

    const shortName = (company.company_shortname || '').trim();
    if (!shortName) return;

    const parts = shortName.split(/[\s\-_]+/);
    let initials = '';
    if (parts.length === 1) {
      initials = parts[0].substring(0, 3).toUpperCase();
    } else {
      initials = parts.map(p => p[0]).join('').toUpperCase();
    }

    const employees = await getSelectOptions('employee');
    const nextNum = employees.length + 1;
    employeeIdInput.value = `${initials}-${nextNum}`;
  } catch (err) {
    console.error('Failed to auto-generate employee_id:', err);
  }
};

window.handleLocationFormChange = function () {
  const codeEl = document.getElementById('f-location_code');
  const typeEl = document.getElementById('f-type');
  const companyEl = document.getElementById('f-my_company');
  const labelEl = document.getElementById('f-location_label');
  if (!labelEl) return;

  const code = codeEl ? codeEl.value.trim() : '';
  const type = typeEl ? typeEl.value.trim() : '';

  let companyShortName = '';
  if (companyEl) {
    const companyValue = companyEl.value;
    const company = (selectCache['my_company'] || []).find(item =>
      String(item.my_company_id) === String(companyValue) || String(item.company_shortname) === String(companyValue)
    );
    companyShortName = company?.company_shortname?.trim() || '';
  }

  labelEl.value = [code, type, companyShortName].filter(Boolean).join(' | ');
};

window.handleAccountFormLabelChange = function () {
  const labelEl = document.getElementById('f-account_label');
  if (!labelEl) return;

  const accountName = document.getElementById('f-account_name')?.value.trim() || '';
  const accountNumber = document.getElementById('f-account_number')?.value.trim() || '';
  const accountType = document.getElementById('f-type')?.value.trim() || '';
  const companyEl = document.getElementById('f-company_entity');
  let companyShortName = '';
  if (companyEl) {
    const companyValue = companyEl.value;
    const company = (selectCache['my_company'] || []).find(item =>
      String(item.my_company_id) === String(companyValue) ||
      String(item.company_shortname) === String(companyValue)
    );
    companyShortName = company?.company_shortname?.trim() || '';
  }

  labelEl.value = [accountName, companyShortName, accountType, accountNumber].filter(Boolean).join(' - ');
};

window.initAccountFormLabel = function () {
  ['f-account_name', 'f-account_number', 'f-company_entity', 'f-type'].forEach(id => {
    const el = document.getElementById(id);
    if (!el || el.dataset.accountLabelBound) return;
    el.dataset.accountLabelBound = 'true';
    el.addEventListener('input', window.handleAccountFormLabelChange);
    el.addEventListener('change', window.handleAccountFormLabelChange);
  });
  window.handleAccountFormLabelChange();
};

window.handleCompanyFormLabelChange = function () {
  const labelEl = document.getElementById('f-company_label');
  if (!labelEl) return;

  const fullName = document.getElementById('f-company_fullname')?.value.trim() || '';
  const shortName = document.getElementById('f-company_shortname')?.value.trim() || '';
  labelEl.value = [shortName, fullName].filter(Boolean).join(' | ');
};

window.initCompanyFormLabel = function () {
  ['f-company_fullname', 'f-company_shortname'].forEach(id => {
    const el = document.getElementById(id);
    if (!el || el.dataset.companyLabelBound) return;
    el.dataset.companyLabelBound = 'true';
    el.addEventListener('input', window.handleCompanyFormLabelChange);
    el.addEventListener('change', window.handleCompanyFormLabelChange);
  });
  window.handleCompanyFormLabelChange();
};

window.handleDepartmentFormLabelChange = function () {
  const labelEl = document.getElementById('f-department_label');
  if (!labelEl) return;

  const deptName = document.getElementById('f-department_name')?.value.trim() || '';
  const companyEl = document.getElementById('f-company_id');
  let companyShortName = '';
  if (companyEl) {
    const companyValue = companyEl.value;
    const company = (selectCache['my_company'] || []).find(item =>
      String(item.my_company_id) === String(companyValue) || String(item.company_shortname) === String(companyValue)
    );
    companyShortName = company?.company_shortname?.trim() || '';
  }

  labelEl.value = [deptName, companyShortName].filter(Boolean).join(' | ');
};

window.initDepartmentFormLabel = function () {
  ['f-department_name', 'f-company_id'].forEach(id => {
    const el = document.getElementById(id);
    if (!el || el.dataset.departmentLabelBound) return;
    el.dataset.departmentLabelBound = 'true';
    el.addEventListener('input', window.handleDepartmentFormLabelChange);
    el.addEventListener('change', window.handleDepartmentFormLabelChange);
  });
  window.handleDepartmentFormLabelChange();
};

function resetSaveButton(saveBtn) {
  if (!saveBtn) saveBtn = document.getElementById('form-modal-save');
  const draftBtn = document.getElementById('form-modal-draft');
  if (draftBtn) {
    draftBtn._isSaving = false;
    draftBtn.disabled = false;
    draftBtn.textContent = (typeof t === 'function') ? t('form.save_draft', 'Save Draft') : 'Save Draft';
  }
  if (saveBtn) {
    saveBtn._isSaving = false;
    saveBtn.disabled = false;
    const isRequestForm = !!draftBtn;
    if (isRequestForm) {
      saveBtn.textContent = (typeof t === 'function') ? t('form.submit', 'Submit') : 'Submit';
    } else {
      saveBtn.textContent = (typeof t === 'function') ? t('form.save', 'Save') : 'Save';
    }
  }
}

async function submitAdd(moduleKey, extraData = {}) {
  const saveBtn = document.getElementById('form-modal-save');
  const draftBtn = document.getElementById('form-modal-draft');
  if ((saveBtn && saveBtn._isSaving) || (draftBtn && draftBtn._isSaving)) return;
  if (saveBtn) {
    saveBtn._isSaving = true;
    saveBtn.disabled = true;
    saveBtn.textContent = (typeof t === 'function') ? t('form.saving', 'Saving...') : 'Saving...';
  }
  if (draftBtn) {
    draftBtn._isSaving = true;
    draftBtn.disabled = true;
    draftBtn.textContent = (typeof t === 'function') ? t('form.saving', 'Saving...') : 'Saving...';
  }

  const isValid = validateFormAndNotify(moduleKey, true);
  if (!isValid) {
    resetSaveButton(saveBtn);
    return;
  }

  const mod = MODULES[moduleKey];
  const data = { ...collectFormData(moduleKey), ...extraData };
  const activeHashModule = getActiveHashModule();
  const isRequestChildAdd = REQUEST_CHILD_RELOAD_MODULES.includes(moduleKey) && currentView === 'detail' && currentModule && currentRecord;
  const parentModuleKeyForAdd = isRequestChildAdd ? currentModule : null;
  const parentPkFieldForAdd = parentModuleKeyForAdd && MODULES[parentModuleKeyForAdd] ? MODULES[parentModuleKeyForAdd].pk : null;
  const parentPkValForAdd = parentPkFieldForAdd && currentRecord ? currentRecord[parentPkFieldForAdd] : null;
  const parentViewKeyForAdd = ['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(activeHashModule)
    ? activeHashModule
    : parentModuleKeyForAdd;

  if (moduleKey === 'payment') {
    if (!data.payment_status) {
      data.payment_status = 'Draft';
    }
    if (data.due_date) {
      const dueStr = String(data.due_date).split('T')[0];
      const todayStr = new Date().toISOString().split('T')[0];
      if (dueStr < todayStr) {
        showToast(typeof t === 'function' ? t('msg.due_date_past', 'Due Date cannot be in the past. Please select today or a future date.') : 'Due Date cannot be in the past. Please select today or a future date.', 'error');
        if (saveBtn) saveBtn._isSaving = false;
        return;
      }
    }
  }

  if (moduleKey === 'asset' && (!data.office_asset_id || data.office_asset_id.trim() === '')) {
    let companyPrefix = 'CO';
    if (authUser && authUser.company_id && selectCache['my_company']) {
      const comp = selectCache['my_company'].find(c => String(c.my_company_id) === String(authUser.company_id));
      if (comp && comp.company_shortname) companyPrefix = getCompanyAbbreviation(comp.company_shortname);
    }
    const reqEl = document.getElementById('f-request');
    if (reqEl && reqEl.value && selectCache['request']) {
      const req = selectCache['request'].find(r => r.request_id === reqEl.value);
      if (req && req.company_id) companyPrefix = getCompanyAbbreviation(req.company_id);
    }
    let typePrefix = 'OTH';
    if (data.type) {
      const val = data.type.toLowerCase();
      if (val.includes('accessories')) typePrefix = 'ACC';
      else if (val.includes('nội thất') || val.includes('furniture')) typePrefix = 'FUR';
      else if (val.includes('electronics')) typePrefix = 'ELE';
    }
    const vnDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
    const dd = String(vnDate.getDate()).padStart(2, '0');
    const mm = String(vnDate.getMonth() + 1).padStart(2, '0');
    const yy = String(vnDate.getFullYear()).slice(-2);
    const dateStr = `${dd}${mm}${yy}`;
    const rand = Math.floor(1000 + Math.random() * 9000);
    data.office_asset_id = `${companyPrefix}-${typePrefix}-${dateStr}-${rand}`;
  }

  if (moduleKey === 'service' && (!data.service_id || data.service_id.trim() === '')) {
    let companyPrefix = 'CO';
    if (data.my_company) {
      companyPrefix = getCompanyAbbreviation(data.my_company);
    } else if (authUser && authUser.company_id && selectCache['my_company']) {
      const comp = selectCache['my_company'].find(c => String(c.my_company_id) === String(authUser.company_id));
      if (comp && comp.company_shortname) companyPrefix = getCompanyAbbreviation(comp.company_shortname);
    }
    let typePrefix = 'OTH';
    if (data.service_type) {
      const val = data.service_type.toLowerCase();
      if (val.includes('subscription')) typePrefix = 'SUB';
      else if (val.includes('làm mới') || val.includes('renew')) typePrefix = 'REN';
      else if (val.includes('technical') || val.includes('support')) typePrefix = 'TEC';
    }
    const vnDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
    const dd = String(vnDate.getDate()).padStart(2, '0');
    const mm = String(vnDate.getMonth() + 1).padStart(2, '0');
    const yy = String(vnDate.getFullYear()).slice(-2);
    const dateStr = `${dd}${mm}${yy}`;
    const rand = Math.floor(1000 + Math.random() * 9000);
    data.service_id = `${companyPrefix}-${typePrefix}-${dateStr}-${rand}`;
  }
  if (moduleKey === 'invoice') {
    if (!data.description || !data.description.trim()) {
      showToast(typeof t === 'function' ? t('msg.invoice_description_required', 'Description is required.') : 'Description is required.', 'error');
      if (saveBtn) { saveBtn._isSaving = false; }
      return;
    }
  }

  if (moduleKey === 'contract') {
    // Contract No is required when Signed Date has a value
    const signedDateEl = document.getElementById('f-contract_signed_date');
    const contractNoEl = document.getElementById('f-contractspood_no');
    if (signedDateEl && signedDateEl.value && contractNoEl && !contractNoEl.value.trim()) {
      showToast(typeof t === 'function' ? t('msg.contract_no_required', 'Contract No is required when Signed Date is set.') : 'Contract No is required when Signed Date is set.', 'error');
      if (saveBtn) { saveBtn._isSaving = false; }
      return;
    }
  }

  if (moduleKey === 'payment') {
    // Validate payment_period is a positive integer
    const ppEl = document.getElementById('f-payment_period');
    if (ppEl && ppEl.value !== '' && ppEl.value !== null) {
      const ppVal = Number(ppEl.value);
      if (!Number.isInteger(ppVal) || ppVal < 1) {
        showToast(typeof t === 'function' ? t('msg.payment_period_integer', 'Payment Period must be a positive whole number.') : 'Payment Period must be a positive whole number.', 'error');
        if (saveBtn) { saveBtn._isSaving = false; }
        return;
      }
      data.payment_period = ppVal;
    }
  }

  const saveBtnEl = document.getElementById('form-modal-save');
  if (saveBtnEl) {
    saveBtnEl.disabled = true;
    saveBtnEl.textContent = t('form.saving', 'Saving...');
  }
  try {
    let postEndpoint = getWriteEndpoint(mod);
    if (currentView === 'detail' && moduleKey !== currentModule && currentModule) {
      const sep = postEndpoint.includes('?') ? '&' : '?';
      postEndpoint += `${sep}view=${currentModule}`;
    }
    const newRecord = await apiPost(postEndpoint, data);

    // Auto-create assigned tasks if any were configured in the wizard
    if (moduleKey === 'request' && newRecord) {
      const requestId = newRecord.request_id || newRecord.id || data.request_id || data.sr_id;
      const assigneeCards = document.querySelectorAll('#atm-assignees-container .assignee-card');
      if (assigneeCards.length > 0 && requestId) {
        for (const card of assigneeCards) {
          const empId = card.getAttribute('data-employee-id');
          const desc = card.querySelector('.assignee-description')?.value || '';
          const deadline = card.querySelector('.assignee-deadline')?.value || null;
          const link = card.querySelector('.assignee-info-link')?.value || null;
          const fileB64 = card.querySelector('.assignee-guide-file-b64')?.value || null;
          const notes = card.querySelector('.assignee-info-notes')?.value || null;
          try {
            await apiPost('/table/assigned_task?view=request', {
              request_id: requestId,
              employee_id: empId,
              description: desc || 'Assigned Task',
              deadline: deadline,
              task_info_link: link,
              task_info_guide_file: fileB64,
              task_info_notes: notes,
              status: 'Not started yet'
            });
          } catch (e) {
            console.warn('Failed to auto-assign task for employee:', empId, e);
          }
        }
      }
    }
    closeModal('form-modal');
    showToast(`${getModuleMeta(moduleKey).title} ${t('toast.record_added', 'record added successfully!')}`, 'success');
    delete selectCache[moduleKey]; // Clear only current module cache
    markReportPanesDirty([moduleKey]);
    if (isRequestChildAdd && parentPkValForAdd) {
      clearChildTableCache(moduleKey, parentViewKeyForAdd || parentModuleKeyForAdd, parentPkValForAdd);
      markReportPanesDirty([moduleKey, activeHashModule]);
    }
    lastCurrencyCache = { key: null, value: 'VND' };
    if (['permissions', 'exception_rules', 'action_rules'].includes(moduleKey)) {
      await applyMenuPermissions();
    }

    if (currentView === 'detail' && currentModule && moduleKey !== currentModule) {
      // Added a child record from parent detail: refresh parent detail view in-place
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
      // Added a top-level record: navigate to it or refresh table / dashboard
      if (currentModule === 'setup' || window.location.hash.startsWith('#setup')) {
        if (typeof renderSetupContent === 'function') {
          await renderSetupContent();
        }
      } else if (['permissions', 'exception_rules', 'action_rules', 'account'].includes(moduleKey)) {
        await refreshTableData(moduleKey, true);
      } else {
        const pkField = mod.pk;
        if (newRecord && newRecord[pkField]) {
          let targetModule = moduleKey;
          if (moduleKey === 'request' && ['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(currentModule)) {
            targetModule = currentModule;
          }
          window.location.hash = `#${targetModule}/${newRecord[pkField]}`;
        } else if (currentView === 'dashboard' && ['my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(currentModule)) {
          await loadDashboardView(currentModule);
        } else if (currentView === 'kanban' && currentModule === 'assigned_task') {
          if (typeof renderAssignedTaskKanbanView === 'function') {
            await renderAssignedTaskKanbanView('assigned_task', true);
          }
        } else {
          await refreshTableData(currentModule || moduleKey, true);
        }
      }
    }
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    resetSaveButton();
  }
}

async function submitEdit(moduleKey, pkVal, extraData = {}) {
  const saveBtn = document.getElementById('form-modal-save');
  const draftBtn = document.getElementById('form-modal-draft');
  if ((saveBtn && saveBtn._isSaving) || (draftBtn && draftBtn._isSaving)) return;
  if (saveBtn) {
    saveBtn._isSaving = true;
    saveBtn.disabled = true;
    saveBtn.textContent = (typeof t === 'function') ? t('form.saving', 'Saving...') : 'Saving...';
  }
  if (draftBtn) {
    draftBtn._isSaving = true;
    draftBtn.disabled = true;
    draftBtn.textContent = (typeof t === 'function') ? t('form.saving', 'Saving...') : 'Saving...';
  }

  const isValid = validateFormAndNotify(moduleKey, true);
  if (!isValid) {
    resetSaveButton(saveBtn);
    return;
  }

  const mod = MODULES[moduleKey];
  const data = { ...collectFormData(moduleKey), ...extraData };

  if (moduleKey === 'invoice') {
    if (!data.description || !data.description.trim()) {
      showToast(typeof t === 'function' ? t('msg.invoice_description_required', 'Description is required.') : 'Description is required.', 'error');
      if (saveBtn) { saveBtn._isSaving = false; }
      return;
    }
  }

  if (moduleKey === 'contract') {
    // Contract No is required when Signed Date has a value
    const signedDateEl = document.getElementById('f-contract_signed_date');
    const contractNoEl = document.getElementById('f-contractspood_no');
    if (signedDateEl && signedDateEl.value && contractNoEl && !contractNoEl.value.trim()) {
      showToast(typeof t === 'function' ? t('msg.contract_no_required', 'Contract No is required when Signed Date is set.') : 'Contract No is required when Signed Date is set.', 'error');
      if (saveBtn) { saveBtn._isSaving = false; }
      return;
    }
  }

  if (moduleKey === 'payment') {
    // Validate payment_period is a positive integer
    const ppEl = document.getElementById('f-payment_period');
    if (ppEl && ppEl.value !== '' && ppEl.value !== null) {
      const ppVal = Number(ppEl.value);
      if (!Number.isInteger(ppVal) || ppVal < 1) {
        showToast(typeof t === 'function' ? t('msg.payment_period_integer', 'Payment Period must be a positive whole number.') : 'Payment Period must be a positive whole number.', 'error');
        if (saveBtn) { saveBtn._isSaving = false; }
        return;
      }
      data.payment_period = ppVal;
    }
  }

  if (moduleKey === 'payment' && data.due_date) {
    const dueStr = String(data.due_date).split('T')[0];
    const todayStr = new Date().toISOString().split('T')[0];
    if (dueStr < todayStr) {
      showToast(typeof t === 'function' ? t('msg.due_date_past', 'Due Date cannot be in the past. Please select today or a future date.') : 'Due Date cannot be in the past. Please select today or a future date.', 'error');
      if (saveBtn) saveBtn._isSaving = false;
      return;
    }
  }

  let endpointPath = `${getWriteEndpoint(mod)}/${pkVal}${mod.pk ? '?pk=' + mod.pk : ''}`;
  if (currentView === 'detail' && moduleKey !== currentModule && currentModule) {
    const sep = endpointPath.includes('?') ? '&' : '?';
    endpointPath += `${sep}view=${currentModule}`;
  }

  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = t('form.saving', 'Saving...');
  }
  try {
    await apiPut(endpointPath, data);
    closeModal('form-modal');
    showToast(t('toast.record_updated', 'Record updated successfully!'), 'success');
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
    if (moduleKey === 'cms_tenant_info') {
      try {
        const tenantInfoRes = await apiGet('/table/cms_tenant_info');
        const tenantData = tenantInfoRes && tenantInfoRes.data && Array.isArray(tenantInfoRes.data) ? tenantInfoRes.data : (Array.isArray(tenantInfoRes) ? tenantInfoRes : []);
        if (tenantData.length > 0) {
          window.cmsTenantInfo = tenantData[0];
          if (typeof applyCustomBranding === 'function') await applyCustomBranding();
        }
      } catch (e) {
        console.warn('Could not refresh cmsTenantInfo after edit:', e);
      }
    }
    if (['permissions', 'exception_rules', 'action_rules'].includes(moduleKey)) {
      await applyMenuPermissions();
    }

    // If in detail view, reload detail silently in-place; else reload table/dashboard/kanban silently in-place!
    if (currentView === 'detail') {
      if (currentModule && moduleKey !== currentModule) {
        // Edited a child record: refresh the parent detail view in-place
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
        await openDetailInternal(moduleKey, pkVal, true, true);
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
  } finally {
    resetSaveButton(saveBtn);
  }
}

function submitForm() {
  const saveBtn = document.getElementById('form-modal-save');
  if (saveBtn && saveBtn._isSaving) return;
  if (submitCallback) {
    submitCallback();
  }
}


// Window Bridge for Dynamic Form Modal
window.openAddModal = openAddModal;
window.openEditModal = openEditModal;
window.buildFormHTML = buildFormHTML;
window.renderFieldHTML = renderFieldHTML;
window.collectFormData = collectFormData;
window.submitForm = submitForm;
window.submitAdd = submitAdd;
window.submitEdit = submitEdit;
window.validateFormAndNotify = validateFormAndNotify;
window.initFormRealtimeValidation = initFormRealtimeValidation;
window.initFormNumericFormatting = initFormNumericFormatting;
window.refreshTableData = refreshTableData;
window.handleOperationProgramCompanyChange = handleOperationProgramCompanyChange;
window.handleFileChange = handleFileChange;
