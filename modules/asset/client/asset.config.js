/**
 * asset.config.js - Modular Config for CRC / TeraX v2
 * Domain: asset
 */
(function() {
  window.__MODULE_CONFIGS__ = window.__MODULE_CONFIGS__ || {};
  Object.assign(window.__MODULE_CONFIGS__, {
  asset: {
    label: 'Assets',
    subtitle: 'Manage company assets',
    endpoint: '/table/asset',
    pk: 'office_asset_id',
    icon: '📦',
    columns: [
      { key: 'office_asset_id', label: 'Asset Code', hidden: true },
      { key: 'asset_name', label: 'Asset Name' },
      { key: 'type', label: 'Type' },
      { key: 'status', label: 'Status', badge: true },
      { key: 'qty', label: 'Qty' },
      { key: 'identity_number', label: 'Identity Number' },
      { key: 'purchase_date', label: 'Purchase Date' },
      { key: 'purchase_cost', label: 'Purchase Cost', labelKey: 'col.purchase_cost' },
      { key: 'currency', label: 'Currency' },
      { key: 'exchange_rate', label: 'Exchange Rate' },
      { key: 'value_in_base_currency', label: 'Purchase Cost in Base Currency', labelKey: 'col.asset_value_in_base_currency', type: 'number' },
      { key: 'current_owner', label: 'Current Owner', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name' },
      { key: 'location', label: 'Location' },
      { key: 'request', label: 'Request', optionsFrom: 'request', optionValue: 'request_id', optionLabel: 'description' },
      { key: 'id__my_company', label: 'My Company', labelKey: 'col.my_company', optionsFrom: 'my_company', optionValue: 'my_company_id', optionLabel: 'company_shortname' }
    ],
    fields: [
      { section: 'asset information' },
      { key: 'asset_name', label: 'ASSET NAME', type: 'text', required: true },
      { key: 'type', label: 'TYPE', type: 'select_with_add', options: ['Accessories', 'Nội thất văn phòng', 'Electronics', 'Khác'], onchange: 'handleAssetTypeChange()', required: true },
      { key: 'status', label: 'STATUS', type: 'select', options: [{ value: 21, label: 'Draft' }, { value: 22, label: 'Pending' }, { value: 23, label: 'In Progress' }, { value: 24, label: 'Approved' }, { value: 25, label: 'Completed' }], defaultValue: 21, required: true },
      { key: 'qty', label: 'QTY', type: 'number', required: true },
      { key: 'note', label: 'NOTE', type: 'textarea', full: true },
      { key: 'office_asset_id', label: 'ASSET CODE', type: 'text', hint: 'Auto-generated code, feel free to edit if needed' },
      { section: 'ownership & location' },
      { key: 'current_owner', label: 'CURRENT OWNER', type: 'select', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name', required: true },
      { key: 'location', label: 'LOCATION', type: 'select', optionsFrom: 'my_location', optionValue: 'my_location_id', required: true },
      { key: 'id__my_company', label: 'MY COMPANY', labelKey: 'col.my_company', type: 'select', optionsFrom: 'my_company', optionValue: 'my_company_id', optionLabel: 'company_shortname' },
      { section: 'financial' },
      { key: 'purchase_date', label: 'PURCHASE DATE', type: 'date', full: true },
      { key: 'currency', label: 'CURRENCY', type: 'select', optionsFrom: 'account_currency', optionValue: 'code', optionLabel: 'label', onchange: 'handleAssetValueChange()', required: true },
      { key: 'exchange_rate', label: 'EXCHANGE RATE', type: 'text', oninput: 'handleAssetValueChange()' },
      { key: 'purchase_cost', label: 'PURCHASE COST', labelKey: 'col.purchase_cost', type: 'text', oninput: 'handleAssetValueChange()', required: true },
      { key: 'value_in_base_currency', label: 'PURCHASE COST IN BASE CURRENCY', labelKey: 'col.asset_value_in_base_currency', type: 'text', createReadonly: true, editReadonly: true },
      { section: 'identification' },
      { key: 'identity_number', label: 'IDENTITY NUMBER', type: 'text' },
      { key: 'request', label: 'REQUEST', type: 'select', optionsFrom: 'request', optionValue: 'request_id', optionLabel: 'description', onchange: 'handleAssetRequestChange()', hidden: true }
    ],
    detailFields: [
      { section: 'asset information' },
      { key: 'office_asset_id', label: 'ASSET CODE' },
      { key: 'qty', label: 'QTY' },
      { key: 'note', label: 'NOTE' },
      { section: 'ownership & location' },
      { key: 'current_owner', label: 'CURRENT OWNER' },
      { key: 'location', label: 'LOCATION' },
      { key: 'id__my_company', label: 'MY COMPANY', labelKey: 'col.my_company', optionsFrom: 'my_company', optionValue: 'my_company_id', optionLabel: 'company_shortname', full: true },
      { section: 'financial' },
      { key: 'purchase_date', label: 'PURCHASE DATE', full: true },
      { key: 'currency', label: 'CURRENCY' },
      { key: 'exchange_rate', label: 'EXCHANGE RATE' },
      { key: 'purchase_cost', label: 'PURCHASE COST', labelKey: 'col.purchase_cost' },
      { key: 'value_in_base_currency', label: 'PURCHASE COST IN BASE CURRENCY', labelKey: 'col.asset_value_in_base_currency' },
      { section: 'identification' },
      { key: 'identity_number', label: 'IDENTITY NUMBER' },
      { key: 'request', label: 'REQUEST', hidden: true }
    ],
    displayName: (r) => r.office_asset_id || r.asset_name,
  }
  });
})();
