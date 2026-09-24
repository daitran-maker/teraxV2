/**
 * expense.config.js - Modular Config for CRC / TeraX v2
 * Domain: expense
 */
(function() {
  window.__MODULE_CONFIGS__ = window.__MODULE_CONFIGS__ || {};
  Object.assign(window.__MODULE_CONFIGS__, {
  expense: {
    label: 'Expenses',
    subtitle: 'Manage expense records',
    endpoint: '/table/expense',
    pk: 'id',
    icon: 'receipt_long',
    groupBy: ['fy', 'id__my_company', 'id__expense_cost', 'id__expense_type'],
    columns: [
      { key: 'description', label: 'Description' },
      { key: 'value_before_vat', label: 'Value Before VAT', labelKey: 'col.value_before_vat', type: 'number' },
      { key: 'vat_value', label: 'VAT Value', labelKey: 'col.vat_value', type: 'number' },
      { key: 'total_value', label: 'Total Value', labelKey: 'col.total_value', type: 'number' },
      { key: 'id__currency', label: 'Currency' },
      { key: 'exchange_rate', label: 'Exchange Rate' },
      { key: 'value_before_vat_in_base_currency', label: 'Value Before VAT in Base Currency', labelKey: 'col.value_before_vat_in_base_currency', type: 'number' },
      { key: 'vat_value_in_base_currency', label: 'VAT Value in Base Currency', labelKey: 'col.vat_value_in_base_currency', type: 'number' },
      { key: 'total_value_in_base_currency', label: 'Total Value in Base Currency', labelKey: 'col.total_value_in_base_currency', type: 'number' },
      { key: 'id__employee', label: 'Employee', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name' },
      { key: 'id__my_company', label: 'My Company', labelKey: 'col.my_company', optionsFrom: 'my_company', optionValue: 'my_company_id', optionLabel: 'company_shortname' },
      { key: 'id__expense_type', label: 'Expense Type', labelKey: 'col.id__expense_type', badge: true, options: EXPENSE_TYPE_OPTIONS },
      { key: 'id__expense_cost', label: 'Expense Cost', labelKey: 'col.id__expense_cost', badge: true, options: EXPENSE_COST_OPTIONS },
      { key: 'fy', label: 'Fiscal Year', labelKey: 'col.fy' },
      { key: 'id__request', label: 'Request', optionsFrom: 'request', optionValue: 'request_id', optionLabel: 'description' }
    ],
    fields: [
      { section: 'expense details' },
      { key: 'description', label: 'DESCRIPTION', type: 'textarea', full: true, required: true },
      { key: 'id__request', label: 'REQUEST', type: 'select', optionsFrom: 'request', optionValue: 'request_id', optionLabel: 'description', full: true, onchange: 'handleExpenseRequestChange()', hidden: true },
      { key: 'id__employee', label: 'EMPLOYEE', type: 'select', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name' },
      { key: 'id__my_company', label: 'MY COMPANY', labelKey: 'col.my_company', type: 'select', optionsFrom: 'my_company', optionValue: 'my_company_id', optionLabel: 'company_shortname' },
      { section: 'financial values' },
      { key: 'id__currency', label: 'CURRENCY', type: 'select', optionsFrom: 'account_currency', optionValue: 'code', optionLabel: 'label', onchange: 'handleExpenseValueChange()' },
      { key: 'exchange_rate', label: 'EXCHANGE RATE', type: 'text', defaultValue: '1', onchange: 'handleExpenseValueChange()' },
      { key: 'value_before_vat', label: 'VALUE BEFORE VAT', labelKey: 'col.value_before_vat', type: 'text', required: true, onchange: 'handleExpenseValueChange()' },
      { key: 'value_before_vat_in_base_currency', label: 'VALUE BEFORE VAT IN BASE CURRENCY', labelKey: 'col.value_before_vat_in_base_currency', type: 'text', createReadonly: true, editReadonly: true },
      { key: 'vat_value', label: 'VAT VALUE', labelKey: 'col.vat_value', type: 'text', defaultValue: '0', onchange: 'handleExpenseValueChange()' },
      { key: 'vat_value_in_base_currency', label: 'VAT VALUE IN BASE CURRENCY', labelKey: 'col.vat_value_in_base_currency', type: 'text', createReadonly: true, editReadonly: true },
      { key: 'total_value', label: 'TOTAL VALUE', labelKey: 'col.total_value', type: 'text', createReadonly: true, editReadonly: true },
      { key: 'total_value_in_base_currency', label: 'TOTAL VALUE IN BASE CURRENCY', labelKey: 'col.total_value_in_base_currency', type: 'text', createReadonly: true, editReadonly: true },
      { section: 'classification' },
      { key: 'id__expense_type', label: 'EXPENSE TYPE', labelKey: 'col.id__expense_type', type: 'segmented', options: EXPENSE_TYPE_OPTIONS, defaultValue: 72 },
      { key: 'id__expense_cost', label: 'EXPENSE COST', labelKey: 'col.id__expense_cost', type: 'select', options: EXPENSE_COST_OPTIONS },
      { key: 'fy', label: 'FISCAL YEAR', labelKey: 'col.fy', type: 'select', options: FISCAL_YEAR_OPTIONS, defaultValue: String(new Date().getFullYear()) }
    ],
    detailFields: [
      { section: 'expense details' },
      { key: 'description', label: 'DESCRIPTION' },
      { key: 'id__my_company', label: 'MY COMPANY', labelKey: 'col.my_company', optionsFrom: 'my_company', optionValue: 'my_company_id', optionLabel: 'company_shortname' },
      { key: 'id__employee', label: 'EMPLOYEE', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name' },
      { key: 'id__request', label: 'REQUEST', optionsFrom: 'request', optionValue: 'request_id', optionLabel: 'description' },
      { section: 'financial values' },
      { key: 'id__currency', label: 'CURRENCY', optionsFrom: 'account_currency', optionValue: 'code', optionLabel: 'label' },
      { key: 'exchange_rate', label: 'EXCHANGE RATE' },
      { key: 'value_before_vat', label: 'VALUE BEFORE VAT', labelKey: 'col.value_before_vat' },
      { key: 'value_before_vat_in_base_currency', label: 'VALUE BEFORE VAT IN BASE CURRENCY', labelKey: 'col.value_before_vat_in_base_currency' },
      { key: 'vat_value', label: 'VAT VALUE', labelKey: 'col.vat_value' },
      { key: 'vat_value_in_base_currency', label: 'VAT VALUE IN BASE CURRENCY', labelKey: 'col.vat_value_in_base_currency' },
      { key: 'total_value', label: 'TOTAL VALUE', labelKey: 'col.total_value' },
      { key: 'total_value_in_base_currency', label: 'TOTAL VALUE IN BASE CURRENCY', labelKey: 'col.total_value_in_base_currency' },
      { section: 'classification' },
      { key: 'id__expense_type', label: 'EXPENSE TYPE', labelKey: 'col.id__expense_type', options: EXPENSE_TYPE_OPTIONS },
      { key: 'id__expense_cost', label: 'EXPENSE COST', labelKey: 'col.id__expense_cost', options: EXPENSE_COST_OPTIONS },
      { key: 'fy', label: 'FISCAL YEAR', labelKey: 'col.fy', options: FISCAL_YEAR_OPTIONS }
    ],
    displayName: (r) => r.description || r.id__expense_type || `Expense #${r.id}`
  }
  });
})();
