/**
 * service.config.js - Modular Config for CRC / TeraX v2
 * Domain: service
 */
(function() {
  window.__MODULE_CONFIGS__ = window.__MODULE_CONFIGS__ || {};
  Object.assign(window.__MODULE_CONFIGS__, {
  service: {
    label: 'Services',
    subtitle: 'Manage company services',
    endpoint: '/table/service',
    pk: 'service_id',
    icon: '⚙️',
    groupBy: ['my_company', 'status', 'service_type'],
    columns: [
      { key: 'service_name', label: 'Service Name' },
      { key: 'service_id', label: 'Service Code' },
      { key: 'service_type', label: 'Type', labelKey: 'col.service_type', badge: true, options: SERVICE_TYPE_OPTIONS },
      { key: 'status', label: 'Status', badge: true },
      { key: 'note', label: 'Note' },
      { key: 'start_date', label: 'Start Date' },
      { key: 'end_date', label: 'End Date' },
      { key: 'fy', label: 'Fiscal Year', labelKey: 'col.fy' },
      { key: 'my_company', label: 'My Company', labelKey: 'col.my_company', optionsFrom: 'my_company', optionValue: 'my_company_id', optionLabel: 'company_shortname' },
      { key: 'request', label: 'Request', optionsFrom: 'request', optionValue: 'request_id', optionLabel: 'description' },
    ],
    fields: [
      { section: 'service information' },
      { key: 'my_company', label: 'MY COMPANY', labelKey: 'col.my_company', type: 'select', optionsFrom: 'my_company', optionValue: 'my_company_id', optionLabel: 'company_shortname' },
      { key: 'service_name', label: 'SERVICE NAME', type: 'text', required: true },
      { key: 'service_type', label: 'SERVICE TYPE', labelKey: 'col.service_type', type: 'select', options: SERVICE_TYPE_OPTIONS, onchange: 'handleServiceTypeChange()', required: true },
      { key: 'status', label: 'SERVICE STATUS', type: 'select', options: [{ value: 26, label: 'Draft' }, { value: 27, label: 'Pending' }, { value: 28, label: 'In Progress' }, { value: 29, label: 'Completed' }], defaultValue: 26 },
      { key: 'service_owner', label: 'SERVICE OWNER', type: 'select', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name', required: true },
      { key: 'note', label: 'NOTE', type: 'textarea', full: true },
      { key: 'service_id', label: 'SERVICE CODE', type: 'text', hint: 'Auto-generated code, feel free to edit if needed', hidden: true },
      { section: 'service period' },
      { key: 'start_date', label: 'START DATE', type: 'date', required: true },
      { key: 'end_date', label: 'END DATE', type: 'date', required: true },
      { key: 'fy', label: 'FISCAL YEAR', labelKey: 'col.fy', type: 'select', options: FISCAL_YEAR_OPTIONS },
      { key: 'request', label: 'REQUEST', type: 'select', optionsFrom: 'request', optionValue: 'request_id', optionLabel: 'description', hidden: true }
    ],
    detailFields: [
      { section: 'service information' },
      { key: 'my_company', label: 'MY COMPANY', labelKey: 'col.my_company', full: true },
      { key: 'service_owner', label: 'SERVICE OWNER', full: true },
      { key: 'service_id', label: 'SERVICE CODE', hidden: true },
      { key: 'service_type', label: 'SERVICE TYPE', labelKey: 'col.service_type' },
      { key: 'fy', label: 'FISCAL YEAR', labelKey: 'col.fy' },
      { key: 'note', label: 'NOTE' },
      { section: 'service period' },
      { key: 'start_date', label: 'START DATE' },
      { key: 'end_date', label: 'END DATE' },
      { key: 'request', label: 'REQUEST', hidden: true }
    ],
    displayName: (r) => r.service_id || r.service_name,
  }
  });
})();
