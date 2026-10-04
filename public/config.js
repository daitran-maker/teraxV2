// ============================================================
// ENUM DEFINITIONS (Fallback if enums.js is loaded separately)
// ============================================================
if (typeof FISCAL_YEAR_OPTIONS === 'undefined') {
  window.FISCAL_YEAR_OPTIONS = (function () {
    const cur = new Date().getFullYear();
    const arr = [];
    for (let y = cur - 3; y <= cur + 3; y++) {
      arr.push(String(y));
    }
    return arr;
  })();
}
if (typeof EXPENSE_TYPE_OPTIONS === 'undefined') {
  window.EXPENSE_TYPE_OPTIONS = [
    { value: 72, label: 'Expense' },
    { value: 73, label: 'Non-Expense' }
  ];
}
if (typeof EXPENSE_COST_OPTIONS === 'undefined') {
  window.EXPENSE_COST_OPTIONS = [
    { value: 74, label: 'Operation Cost' },
    { value: 75, label: 'Sales Cost' },
    { value: 76, label: 'Fixed cost' },
    { value: 77, label: 'Variable cost' },
    { value: 78, label: 'Operation expense' },
    { value: 79, label: 'Sale expense' },
    { value: 80, label: 'Others' }
  ];
}
if (typeof SERVICE_TYPE_OPTIONS === 'undefined') {
  window.SERVICE_TYPE_OPTIONS = [
    { value: 81, label: 'Subcription' },
    { value: 82, label: '1 Time service' },
    { value: 83, label: 'Rental | Loan' },
    { value: 84, label: 'Borrow' },
    { value: 85, label: 'Annual Renew' }
  ];
}

// ============================================================
// MODULE CONFIGURATION (Aggregator for Modular Architecture)
// ============================================================
window.MODULES = window.MODULES || {};
if (window.__MODULE_CONFIGS__) {
  Object.assign(window.MODULES, window.__MODULE_CONFIGS__);
}
var MODULES = window.MODULES;

// Run registered module extensions (My Views, Aliases, etc.)
if (window.__MODULE_EXTENSIONS__) {
  window.__MODULE_EXTENSIONS__.forEach(fn => {
    try {
      fn(MODULES);
    } catch (e) {
      console.error('[ModuleExtensionError]', e);
    }
  });
}

// Ensure all table modules with detail views have 'logs' in their children
const TABLE_DETAIL_MODULES = [
  'my_company', 'department', 'employee', 'employee_active', 'company', 'contact',
  'policy', 'opportunity_list', 'request', 'my_request', 'my_approval', 'my_process_owner',
  'my_task', 'my_team', 'contract', 'support', 'expense', 'payment', 'invoice', 'mtr',
  'account', 'target_table', 'service', 'asset', 'my_location',
  'assigned_task', 'oppotunity', 'oppo', 'opportunity'
];

TABLE_DETAIL_MODULES.forEach(modKey => {
  if (MODULES[modKey]) {
    if (!MODULES[modKey].children) {
      MODULES[modKey].children = ['logs'];
    } else if (!MODULES[modKey].children.includes('logs')) {
      MODULES[modKey].children = [...MODULES[modKey].children, 'logs'];
    }
  }
});
