/**
 * contract.config.js - Modular Config for CRC / TeraX v2
 * Domain: contract
 */
(function() {
  window.__MODULE_CONFIGS__ = window.__MODULE_CONFIGS__ || {};
  Object.assign(window.__MODULE_CONFIGS__, {
  contract: {
    label: 'Contracts',
    subtitle: 'Manage contracts',
    endpoint: '/table/contract',
    pk: 'contract_id',
    icon: '📄',
    labelTemplate: '{{type}}-{{contractspood_no}}-{{contract_name_or_description}}',
    columns: [
      { key: 'contract_id', label: 'Contract ID', hidden: true },
      { key: 'contract_label', label: 'Contract Name' },
      { key: 'contractspood_no', label: 'Contracts/PO/OD No' },
      { key: 'my_company', label: 'My Company', optionsFrom: 'my_company', optionValue: 'my_company_id', optionLabel: 'company_shortname' },
      { key: 'contract_owner', label: 'Contract Owner', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name' },
      { key: 'contractor', label: 'Contractor', optionsFrom: 'company', optionValue: 'company_id', optionLabel: 'company_fullname' },
      { key: 'type', label: 'Type', labelKey: 'col.contract_type', badge: true, options: [{ value: 69, label: 'Selling' }, { value: 70, label: 'Buying' }] },
      { key: 'contract_name_or_description', label: 'Contract Name Or Description', hidden: true },
      { key: 'contract_signed_date', label: 'Contract Signed Date' },
      { key: 'value_before_vat', label: 'Value Before VAT', labelKey: 'col.value_before_vat' },
      { key: 'vat_value', label: 'VAT Value', labelKey: 'col.vat_value' },
      { key: 'total_value', label: 'Total Value', labelKey: 'col.total_value', type: 'number' },
      { key: 'currency', label: 'Currency' },
      { key: 'exchance_rate', label: 'Exchange Rate' },
      { key: 'value_before_vat_in_base_currency', label: 'Value Before VAT in Base Currency', labelKey: 'col.value_before_vat_in_base_currency', type: 'number' },
      { key: 'vat_value_in_base_currency', label: 'VAT Value in Base Currency', labelKey: 'col.vat_value_in_base_currency', type: 'number' },
      { key: 'total_value_in_base_currency', label: 'Total Value in Base Currency', labelKey: 'col.total_value_in_base_currency', type: 'number' },
      { key: 'request', label: 'Contract Request', optionsFrom: 'request', optionValue: 'request_id', optionLabel: 'description' }
    ],
    fields: [
      { key: 'request', label: 'REQUEST', type: 'select', optionsFrom: 'request', optionValue: 'request_id', optionLabel: 'description', hidden: true },
      { key: 'my_company', label: 'MY COMPANY', labelKey: 'col.my_company', type: 'select', optionsFrom: 'my_company', optionValue: 'my_company_id', optionLabel: 'company_shortname' },
      { key: 'department_id', label: 'DEPARTMENT', type: 'select', optionsFrom: 'department', optionValue: 'department_id', optionLabel: 'department_label' },
      { key: 'contract_name_or_description', label: 'CONTRACT NAME OR DESCRIPTION', type: 'textarea', full: true, required: true },
      { key: 'type', label: 'CONTRACT TYPE', labelKey: 'col.contract_type', type: 'select', options: [{ value: 69, label: 'Selling' }, { value: 70, label: 'Buying' }], required: true, onchange: 'handleContractTypeChange(this)' },
      { key: 'currency', label: 'CURRENCY', type: 'select', options: ['VND', 'USD', 'EUR', 'MMK', 'SGD', 'THB'], required: true, onchange: 'handleContractValueChange()' },
      { key: 'exchance_rate', label: 'EXCHANGE RATE', type: 'text', required: true, onchange: 'handleContractValueChange()' },
      { key: 'value_before_vat', label: 'VALUE BEFORE VAT', labelKey: 'col.value_before_vat', type: 'text', required: true, onchange: 'handleContractValueChange()' },
      { key: 'value_before_vat_in_base_currency', label: 'VALUE BEFORE VAT IN BASE CURRENCY', labelKey: 'col.value_before_vat_in_base_currency', type: 'text', createReadonly: true, editReadonly: true },
      { key: 'vat_value', label: 'VAT VALUE', labelKey: 'col.vat_value', type: 'text', required: true, onchange: 'handleContractValueChange()' },
      { key: 'vat_value_in_base_currency', label: 'VAT VALUE IN BASE CURRENCY', labelKey: 'col.vat_value_in_base_currency', type: 'text', createReadonly: true, editReadonly: true },
      { key: 'total_value', label: 'TOTAL VALUE', labelKey: 'col.total_value', type: 'text', createReadonly: true, editReadonly: true },
      { key: 'total_value_in_base_currency', label: 'TOTAL VALUE IN BASE CURRENCY', labelKey: 'col.total_value_in_base_currency', type: 'text', createReadonly: true, editReadonly: true },
      { key: 'contract_owner', label: 'CONTRACT OWNER', type: 'select', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name' },
      { key: 'contractor', label: 'CONTRACTOR', type: 'select', optionsFrom: 'company', optionValue: 'company_id', optionLabel: 'company_fullname', required: true },
      { key: 'project', label: 'PROJECT', type: 'select', optionsFrom: 'oppotunity', optionValue: 'project_id', optionLabel: 'project_label' },
      { key: 'contractspood_no', label: 'CONTRACT NO', type: 'text', onchange: 'handleContractNoValidation()' },
      { key: 'contract_signed_date', label: 'SIGNED DATE', type: 'date', onchange: 'handleContractNoValidation()' },
    ],
    detailFields: [
      { section: 'contract information' },
      { key: 'contract_id', label: 'CONTRACT ID', full: true },
      { key: 'my_company', label: 'MY COMPANY', optionsFrom: 'my_company', optionValue: 'my_company_id', optionLabel: 'company_shortname', full: true },
      { key: 'contractspood_no', label: 'CONTRACT NO', full: true },
      { key: 'department_id', label: 'DEPARTMENT', optionsFrom: 'department', optionValue: 'department_id', optionLabel: 'department_label' },
      { key: 'type', label: 'CONTRACT TYPE', labelKey: 'col.contract_type', badge: true, options: [{ value: 69, label: 'Selling' }, { value: 70, label: 'Buying' }] },
      { key: 'contract_signed_date', label: 'SIGNED DATE' },
      { section: 'financial details' },
      { key: 'currency', label: 'CURRENCY' },
      { key: 'exchance_rate', label: 'EXCHANGE RATE' },
      { key: 'value_before_vat', label: 'VALUE BEFORE VAT', labelKey: 'col.value_before_vat' },
      { key: 'value_before_vat_in_base_currency', label: 'VALUE BEFORE VAT IN BASE CURRENCY', labelKey: 'col.value_before_vat_in_base_currency' },
      { key: 'vat_value', label: 'VAT VALUE', labelKey: 'col.vat_value' },
      { key: 'vat_value_in_base_currency', label: 'VAT VALUE IN BASE CURRENCY', labelKey: 'col.vat_value_in_base_currency' },
      { key: 'total_value', label: 'TOTAL VALUE', labelKey: 'col.total_value' },
      { key: 'total_value_in_base_currency', label: 'TOTAL VALUE IN BASE CURRENCY', labelKey: 'col.total_value_in_base_currency' },
      { section: 'parties & project' },
      { key: 'contract_owner', label: 'CONTRACT OWNER', optionsFrom: 'employee', full: true },
      { key: 'contractor', label: 'CONTRACTOR', optionsFrom: 'company', full: true },
      { key: 'project', label: 'PROJECT', optionsFrom: 'oppotunity', optionValue: 'project_id', optionLabel: 'project_label', full: true },
      { key: 'request', label: 'REQUEST', optionsFrom: 'request', full: true },
    ],
    displayName: (r) => {
      const tm = { 69: 'Selling', 70: 'Buying', '69': 'Selling', '70': 'Buying' };
      const t = tm[r.type] || (typeof r.type === 'string' && isNaN(r.type) ? r.type : '');
      return [t, r.contractspood_no, r.contract_name_or_description || r.contract_id].filter(Boolean).join(' | ');
    },
    children: ['invoice', 'payment']
  }
  });
})();
