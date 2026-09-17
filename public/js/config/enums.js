// ============================================================
// ENUM DEFINITIONS (Restored from MPS Database Schema)
// ============================================================
const FISCAL_YEAR_OPTIONS = (function () {
  const cur = new Date().getFullYear();
  const arr = [];
  for (let y = cur - 3; y <= cur + 3; y++) {
    arr.push(String(y));
  }
  return arr;
})();

const EXPENSE_TYPE_OPTIONS = [
  { value: 72, label: 'Expense' },
  { value: 73, label: 'Non-Expense' }
];

const EXPENSE_COST_OPTIONS = [
  { value: 74, label: 'Operation Cost' },
  { value: 75, label: 'Sales Cost' },
  { value: 76, label: 'Fixed cost' },
  { value: 77, label: 'Variable cost' },
  { value: 78, label: 'Operation expense' },
  { value: 79, label: 'Sale expense' },
  { value: 80, label: 'Others' }
];

const SERVICE_TYPE_OPTIONS = [
  { value: 81, label: 'Subcription' },
  { value: 82, label: '1 Time service' },
  { value: 83, label: 'Rental | Loan' },
  { value: 84, label: 'Borrow' },
  { value: 85, label: 'Annual Renew' }
];
