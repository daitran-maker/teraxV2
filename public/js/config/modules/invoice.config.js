/**
 * invoice.config.js - Modular Config for CRC / TeraX v2
 * Domain: invoice
 */
(function() {
  window.__MODULE_CONFIGS__ = window.__MODULE_CONFIGS__ || {};
  Object.assign(window.__MODULE_CONFIGS__, {
  invoice: {
    label: 'Invoices',
    subtitle: 'Manage generated invoices',
    endpoint: '/table/invoice',
    pk: 'invoice_id',
    icon: '📁',
    groupBy: ['invoice_status', 'invoice_type', 'currency'],
    columns: [
      { key: 'invoice_id', label: 'ID', hidden: true },
      { key: 'contract_id', label: 'Contract', optionsFrom: 'contract', optionValue: 'contract_id', hidden: true },
      { key: 'invoice_no', label: 'Invoice No.' },
      { key: 'description', label: 'Description' },
      { key: 'invoice_type', label: 'Type', badge: true },
      { key: 'payment_method', label: 'Payment Method' },
      { key: 'invoice_status', label: 'Invoice Status', labelKey: 'col.invoice_status', badge: true },
      { key: 'invoice_date', label: 'Sent or Received Date' },
      { key: 'value_before_vat', label: 'Value Before VAT', labelKey: 'col.value_before_vat' },
      { key: 'vat_value', label: 'VAT Value', labelKey: 'col.vat_value' },
      { key: 'total_value', label: 'Total Value', labelKey: 'col.total_value', type: 'number' },
      { key: 'currency', label: 'Currency' },
      { key: 'exchange_rate', label: 'Exchange Rate' },
      { key: 'value_before_vat_in_base_currency', label: 'Value Before VAT in Base Currency', labelKey: 'col.value_before_vat_in_base_currency', type: 'number' },
      { key: 'vat_value_in_base_currency', label: 'VAT Value in Base Currency', labelKey: 'col.vat_value_in_base_currency', type: 'number' },
      { key: 'total_value_in_base_currency', label: 'Total Value in Base Currency', labelKey: 'col.total_value_in_base_currency', type: 'number' },
      { key: 'request', label: 'Request', optionsFrom: 'request', optionValue: 'request_id', optionLabel: 'description', hidden: true },
      { key: 'attached_file', label: 'Attached File', hidden: true }
    ],
    fields: [
      { key: 'request', label: 'Request ID', type: 'select', optionsFrom: 'request', optionValue: 'request_id', optionLabel: 'description', required: true },
      { key: 'contract_id', label: 'CONTRACT ID', type: 'select', optionsFrom: 'contract', optionValue: 'contract_id', optionLabel: 'contract_name_or_description' },
      { key: 'source', label: 'SOURCE', type: 'select', options: ['Contract', 'Request'], defaultValue: 'Request', hidden: true },
      { key: 'invoice_no', label: 'Invoice No.', type: 'text' },
      { key: 'description', label: 'Description', type: 'textarea', full: true, required: true },
      { key: 'invoice_type', label: 'Type', type: 'segmented', options: ['Selling', 'Buying'], defaultValue: 'Selling' },
      { key: 'invoice_status', label: 'Invoice Status', labelKey: 'col.invoice_status', type: 'segmented', options: [{ value: 34, label: 'Draft' }, { value: 36, label: 'Issued' }, { value: 37, label: 'Paid' }, { value: 38, label: 'Void' }], defaultValue: 34 },
      { key: 'payment_method', label: 'Payment Method', type: 'segmented', options: ['Bank', 'Cash', 'Others'], defaultValue: 'Bank' },
      { key: 'invoice_date', label: 'Invoice Date', type: 'date', required: true },
      { key: 'my_company', label: 'MY COMPANY', labelKey: 'col.my_company', type: 'select', optionsFrom: 'my_company', optionValue: 'my_company_id', optionLabel: 'company_shortname' },
      { key: 'counter_party', label: 'Company', type: 'select', optionsFrom: 'company', optionValue: 'company_id' },
      { key: 'request_date', label: 'Request Date', type: 'date' },
      { key: 'invoice_request', label: 'Invoice Request', type: 'select', optionsFrom: 'request', optionValue: 'request_id', optionLabel: 'description', hidden: true },
      { key: 'currency', label: 'Currency', type: 'select', optionsFrom: 'account_currency', optionValue: 'code', optionLabel: 'label', required: true, onchange: 'handleInvoiceValueChange()' },
      { key: 'exchange_rate', label: 'Exchange Rate', type: 'text', onchange: 'handleInvoiceValueChange()' },
      { key: 'value_before_vat', label: 'VALUE BEFORE VAT', labelKey: 'col.value_before_vat', type: 'text', required: true, onchange: 'handleInvoiceValueChange()' },
      { key: 'value_before_vat_in_base_currency', label: 'VALUE BEFORE VAT IN BASE CURRENCY', labelKey: 'col.value_before_vat_in_base_currency', type: 'text', createReadonly: true, editReadonly: true },
      { key: 'vat_value', label: 'VAT VALUE', labelKey: 'col.vat_value', type: 'text', onchange: 'handleInvoiceValueChange()' },
      { key: 'vat_value_in_base_currency', label: 'VAT VALUE IN BASE CURRENCY', labelKey: 'col.vat_value_in_base_currency', type: 'text', createReadonly: true, editReadonly: true },
      { key: 'total_value', label: 'TOTAL VALUE', labelKey: 'col.total_value', type: 'text', createReadonly: true, editReadonly: true },
      { key: 'total_value_in_base_currency', label: 'TOTAL VALUE IN BASE CURRENCY', labelKey: 'col.total_value_in_base_currency', type: 'text', createReadonly: true, editReadonly: true },
      { key: 'attached_file', label: 'Attached File', type: 'file', full: true }
    ],
    detailFields: [
      { section: 'invoice summary' },
      { key: 'description', label: 'DESCRIPTION', full: true },
      { key: 'contract_id', label: 'CONTRACT', optionsFrom: 'contract', optionValue: 'contract_id' },
      { key: 'invoice_no', label: 'INVOICE NO' },
      { key: 'invoice_status', label: 'INVOICE STATUS', labelKey: 'col.invoice_status' },
      { key: 'payment_method', label: 'PAYMENT METHOD' },
      { key: 'invoice_type', label: 'INVOICE TYPE' },
      { key: 'invoice_date', label: 'INVOICE DATE' },
      { key: 'my_company', label: 'MY COMPANY', labelKey: 'col.my_company', optionsFrom: 'my_company', optionValue: 'my_company_id', optionLabel: 'company_shortname', full: true },
      { key: 'counter_party', label: 'COMPANY', optionsFrom: 'company', optionValue: 'company_id', full: true },
      { section: 'financial information' },
      { key: 'currency', label: 'CURRENCY' },
      { key: 'exchange_rate', label: 'EXCHANGE RATE' },
      { key: 'value_before_vat', label: 'VALUE BEFORE VAT', labelKey: 'col.value_before_vat' },
      { key: 'value_before_vat_in_base_currency', label: 'VALUE BEFORE VAT IN BASE CURRENCY', labelKey: 'col.value_before_vat_in_base_currency' },
      { key: 'vat_value', label: 'VAT VALUE', labelKey: 'col.vat_value' },
      { key: 'vat_value_in_base_currency', label: 'VAT VALUE IN BASE CURRENCY', labelKey: 'col.vat_value_in_base_currency' },
      { key: 'total_value', label: 'TOTAL VALUE', labelKey: 'col.total_value' },
      { key: 'total_value_in_base_currency', label: 'TOTAL VALUE IN BASE CURRENCY', labelKey: 'col.total_value_in_base_currency' },
      { section: 'request information' },
      { key: 'request', label: 'REQUEST', optionsFrom: 'request', optionValue: 'request_id', full: true },
      { key: 'invoice_request', label: 'INVOICE REQUEST', optionsFrom: 'request', optionValue: 'request_id', full: true },
      { key: 'request_date', label: 'REQUEST DATE', full: true },
      { key: 'attached_file', label: 'ATTACHED FILE', type: 'file', full: true }
    ],
    displayName: (r) => r.invoice_no || r.description || r.invoice_id,
  }
  });
})();
