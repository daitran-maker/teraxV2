/**
 * target_table.config.js - Modular Config for CRC / TeraX v2
 * Domain: target_table
 */
(function() {
  window.__MODULE_CONFIGS__ = window.__MODULE_CONFIGS__ || {};
  Object.assign(window.__MODULE_CONFIGS__, {
  target_table: {
    label: 'Target table',
    labelKey: 'module.target_table.title',
    subtitle: 'Manage target records to Edit/Delete',
    endpoint: '/table/target_table',
    pk: 'target_table_id',
    icon: '🎯',
    columns: [
      { key: 'target_table_id', label: 'ID', hidden: true },
      { key: 'type', label: 'Type' },
      { key: 'table_name', label: 'Table' },
      { key: 'record_ids', label: 'Record IDs' }
    ],
    fields: [
      { key: 'type', label: 'TYPE', type: 'segmented', options: ['Edit', 'Delete'], defaultValue: 'Edit', required: true },
      {
        key: 'table_name',
        label: 'TABLE',
        type: 'select',
        options: [
          { value: 'employee', label: 'Employee' },
          { value: 'my_company', label: 'My Company' },
          { value: 'company', label: 'Customer' },
          { value: 'asset', label: 'Asset' },
          { value: 'service', label: 'Service' },
          { value: 'contact', label: 'Contact' },
          { value: 'policy', label: 'Process' }
        ],
        required: true,
        onchange: 'handleTargetTableChange()'
      },
      { key: 'record_ids', label: 'RECORD IDS', type: 'target_record_multiselect', full: true, required: true },
      { key: 'request', label: 'REQUEST', type: 'select', optionsFrom: 'request', optionValue: 'request_id', optionLabel: 'description', hidden: true }
    ],
    detailFields: [
      { key: 'type', label: 'Type' },
      { key: 'table_name', label: 'Table' },
      { key: 'record_ids', label: 'Record IDs' }
    ],
    displayName: (r) => `${r.type} ${r.table_name}: ${Array.isArray(r.record_ids) ? r.record_ids.join(', ') : r.record_ids || ''}`
  }
  });
})();
