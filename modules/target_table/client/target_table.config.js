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
    subtitle: 'Manage target records to Add/Edit/Delete',
    endpoint: '/table/target_table',
    pk: 'target_table_id',
    icon: '🎯',
    columns: [
      { key: 'target_table_id', label: 'ID', hidden: true },
      { key: 'target', label: 'Target', labelKey: 'col.target', virtual: true, html: true },
      { key: 'record_ids', label: 'Scope / Records', labelKey: 'col.scope_records', html: true }
    ],
    fields: [
      { key: 'type', label: 'TYPE', type: 'segmented', options: ['Add', 'Edit', 'Delete'], defaultValue: 'Add', required: true, onchange: 'handleTargetTableTypeChange()' },
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
      { key: 'record_ids', label: 'RECORD IDS', type: 'target_record_multiselect', full: true, required: false },
      { key: 'request', label: 'REQUEST', type: 'select', optionsFrom: 'request', optionValue: 'request_id', optionLabel: 'description', hidden: true }
    ],
    detailFields: [
      { key: 'type', label: 'Type' },
      { key: 'table_name', label: 'Table' },
      { key: 'record_ids', label: 'Record IDs' }
    ],
    displayName: (r) => {
      const tblLabels = { employee: 'Employee', my_company: 'My Company', company: 'Customer', asset: 'Asset', service: 'Service', contact: 'Contact', policy: 'Process' };
      const tbl = (r && r.table_name) ? (tblLabels[r.table_name] || r.table_name.toUpperCase().replace(/_/g, ' ')) : '';
      if (!r || !r.type) return tbl;
      if (r.type === 'Add') return `${r.type} ${tbl}`;
      const recs = Array.isArray(r.record_ids) && r.record_ids.length > 0 ? r.record_ids.join(', ') : (typeof r.record_ids === 'string' && r.record_ids ? r.record_ids : '');
      return `${r.type} ${tbl}${recs ? ': ' + recs : ''}`;
    }
  }
  });
})();
