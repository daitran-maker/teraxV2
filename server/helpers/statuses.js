// ============================================================================
// Unified Status ID Mappings and Helpers
// Matches values in status_catalog in PostgreSQL database
// ============================================================================

const STATUS = {
  request: {
    sr_status: {
      draft: 1,
      pending_approval: 2,
      approved: 3,
      rejected: 4,
      closed: 5,
      cancelled: 6
    },
    process_status: {
      not_started: 7,
      processing: 8,
      completed: 9,
      canceled: 117
    }
  },
  payment: {
    payment_status: {
      draft: 30,
      ready_for_payment: 31,
      paid: 32,
      deleted: 33
    },
    payment_type: {
      incoming: 60,
      outgoing: 61
    }
  },
  contract: {
    type: {
      selling: 69,
      buying: 70,
      internal: 71
    }
  },
  invoice: {
    invoice_status: {
      draft: 34,
      ready_to_issue: 35,
      issued: 36,
      paid: 37,
      void: 38,
      deleted: 39
    }
  },
  employee: {
    status: {
      active: 17,
      inactive: 18
    }
  },
  my_company: {
    status: {
      active: 67,
      inactive: 68
    }
  },
  account: {
    account_status: {
      active: 19,
      inactive: 20
    }
  },
  asset: {
    status: {
      draft: 21,
      pending: 22,
      in_progress: 23,
      approved: 24,
      completed: 25,
      failured: 21,
      in_used: 22,
      no_used: 23
    }
  },
  service: {
    status: {
      draft: 26,
      pending: 27,
      in_progress: 28,
      completed: 29,
      not_started_yet: 26,
      on_going: 27,
      going_to_expired: 28,
      expired: 29
    },
    service_type: {
      subcription: 81,
      subscription: 81,
      '1_time_service': 82,
      rental_loan: 83,
      borrow: 84,
      annual_renew: 85
    }
  },
  expense: {
    id__expense_type: {
      expense: 72,
      non_expense: 73,
      'non-expense': 73
    },
    id__expense_cost: {
      operation_cost: 74,
      sales_cost: 75,
      fixed_cost: 76,
      variable_cost: 77,
      operation_expense: 78,
      sale_expense: 79,
      others: 80
    }
  },
  assigned_task: {
    status: {
      not_started: 62,
      processing: 63,
      completed: 64
    }
  },
  task_subtask: {
    status: {
      pending: 65,
      completed: 66
    }
  },
  my_location: {
    status: {
      active: 50,
      inactive: 51
    }
  },
  finance: {
    status: {
      active: 57,
      inactive: 58
    }
  },
  oppotunity: {
    status: {
      open: 52,
      closed_won: 53,
      closed_lost: 54
    }
  },
  mtr: {
    status: {
      draft: 55,
      approved: 56
    }
  },
  cms_tenant_info: {
    billing_status: {
      active: 40,
      grace: 41,
      expired: 42,
      canceled: 43,
      inactive: 44
    },
    subscription_status: {
      active: 45,
      grace: 46,
      expired: 47,
      canceled: 48,
      inactive: 49
    }
  },
  ticket: {
    sr_status: {
      draft: 10,
      pending: 11,
      in_progress: 12,
      completed: 13,
      cancelled: 118
    },
    process_status: {
      not_started: 14,
      processing: 15,
      completed: 16,
      cancelled: 119,
      draft: 120
    }
  }
};

/**
 * Normalizes a status string to match the object keys (lowercase, underscore)
 */
function normalizeKey(str) {
  if (!str) return '';
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

/**
 * Resolves a status value (either ID number or string label) into its integer ID.
 * Returns null if not found or invalid.
 */
function resolveStatusId(tableName, columnName, value) {
  if (value === null || value === undefined) return null;
  
  // If already a number or a numeric string, parse and return it
  if (typeof value === 'number' && !isNaN(value)) {
    return value;
  }
  const strVal = String(value).trim();
  if (strVal !== '' && !isNaN(Number(strVal))) {
    return parseInt(strVal, 10);
  }

  const table = normalizeKey(tableName);
  const col = normalizeKey(columnName);
  const normalizedVal = normalizeKey(value);

  // Special aliases/backward compatibility mappings
  let lookupVal = normalizedVal;
  if (lookupVal === 'pending') {
    if (col === 'sr_status' && table === 'request') lookupVal = 'pending_approval';
  } else if (lookupVal === 'not_started_yet' || lookupVal === 'not_started') {
    lookupVal = 'not_started';
  } else if (lookupVal === 'submit' || lookupVal === 'submitted' || lookupVal === 'submit_request') {
    if (col === 'sr_status') lookupVal = 'pending_approval';
  } else if (lookupVal === 'open') {
    if (col === 'account_status') lookupVal = 'active';
  } else if (lookupVal === 'closed') {
    if (col === 'account_status') lookupVal = 'inactive';
  } else if (lookupVal === 'active_employees') {
    lookupVal = 'active';
  } else if (lookupVal === 'processing') {
    if (col === 'sr_status' && table === 'ticket') lookupVal = 'in_progress';
  } else if (lookupVal === 'submitted_for_payment' || lookupVal === 'ready_for_payment') {
    if (col === 'payment_status') lookupVal = 'ready_for_payment';
  } else if (lookupVal === 'pending_payment' || lookupVal === 'not_due_yet' || lookupVal === 'overdue') {
    if (col === 'payment_status') lookupVal = 'ready_for_payment';
  } else if (lookupVal === 'ready_to_issue') {
    if (col === 'invoice_status') lookupVal = 'ready_to_issue';
  }

  const mapping = STATUS[table] && STATUS[table][col];
  if (mapping) {
    if (mapping[lookupVal] !== undefined) {
      return mapping[lookupVal];
    }
  }
  return null;
}

/**
 * Resolves a status ID to its string key.
 */
function getStatusKey(tableName, columnName, id) {
  const table = normalizeKey(tableName);
  const col = normalizeKey(columnName);
  
  const mapping = STATUS[table] && STATUS[table][col];
  if (mapping) {
    const numericId = parseInt(id, 10);
    for (const [key, val] of Object.entries(mapping)) {
      if (val === numericId) {
        return key;
      }
    }
  }
  return null;
}

/**
 * Gets the numeric status ID from a record object, checking both standard column, _id suffix, and _key suffix.
 */
function getRecordStatusId(record, tableName, columnName) {
  if (!record || typeof record !== 'object') return null;
  const rawVal = record[columnName];
  if (rawVal !== undefined && rawVal !== null) {
    const res = resolveStatusId(tableName, columnName, rawVal);
    if (res !== null) return res;
  }
  const idCol = `_${columnName}_id`;
  if (record[idCol] !== undefined && record[idCol] !== null) {
    const res = resolveStatusId(tableName, columnName, record[idCol]);
    if (res !== null) return res;
  }
  const keyCol = `${columnName}_key`;
  if (record[keyCol] !== undefined && record[keyCol] !== null) {
    const res = resolveStatusId(tableName, columnName, record[keyCol]);
    if (res !== null) return res;
  }
  return null;
}

/**
 * Gets the string status key from a record object.
 */
function getRecordStatusKey(record, tableName, columnName) {
  if (!record || typeof record !== 'object') return null;
  const id = getRecordStatusId(record, tableName, columnName);
  if (id !== null) {
    return getStatusKey(tableName, columnName, id);
  }
  return null;
}

const pool = require('../db');

const fallbackCatalog = {
  // request.sr_status
  1: { key: 'draft', color: '#64748b', table: 'request', column: 'sr_status' },
  2: { key: 'pending_approval', color: '#3b82f6', table: 'request', column: 'sr_status' },
  3: { key: 'approved', color: '#10b981', table: 'request', column: 'sr_status' },
  4: { key: 'rejected', color: '#ef4444', table: 'request', column: 'sr_status' },
  5: { key: 'closed', color: '#64748b', table: 'request', column: 'sr_status' },
  6: { key: 'cancelled', color: '#ef4444', table: 'request', column: 'sr_status' },
  
  // request.process_status
  7: { key: 'not_started', color: '#64748b', table: 'request', column: 'process_status' },
  8: { key: 'processing', color: '#3b82f6', table: 'request', column: 'process_status' },
  9: { key: 'completed', color: '#10b981', table: 'request', column: 'process_status' },
  117: { key: 'canceled', color: '#ef4444', table: 'request', column: 'process_status' },

  // ticket.sr_status
  10: { key: 'draft', color: '#64748b', table: 'ticket', column: 'sr_status' },
  11: { key: 'pending', color: '#3b82f6', table: 'ticket', column: 'sr_status' },
  12: { key: 'in_progress', color: '#3b82f6', table: 'ticket', column: 'sr_status' },
  13: { key: 'completed', color: '#10b981', table: 'ticket', column: 'sr_status' },
  118: { key: 'cancelled', color: '#ef4444', table: 'ticket', column: 'sr_status' },

  // ticket.process_status
  14: { key: 'not_started', color: '#64748b', table: 'ticket', column: 'process_status' },
  15: { key: 'processing', color: '#3b82f6', table: 'ticket', column: 'process_status' },
  16: { key: 'completed', color: '#10b981', table: 'ticket', column: 'process_status' },
  119: { key: 'cancelled', color: '#ef4444', table: 'ticket', column: 'process_status' },
  120: { key: 'draft', color: '#64748b', table: 'ticket', column: 'process_status' },

  // employee.status
  17: { key: 'active', color: '#10b981', table: 'employee', column: 'status' },
  18: { key: 'inactive', color: '#ef4444', table: 'employee', column: 'status' },

  // account.account_status
  19: { key: 'active', color: '#10b981', table: 'account', column: 'account_status' },
  20: { key: 'inactive', color: '#ef4444', table: 'account', column: 'account_status' },

  // asset.status
  21: { key: 'draft', color: '#64748b', table: 'asset', column: 'status' },
  22: { key: 'pending', color: '#3b82f6', table: 'asset', column: 'status' },
  23: { key: 'in_progress', color: '#3b82f6', table: 'asset', column: 'status' },
  24: { key: 'approved', color: '#10b981', table: 'asset', column: 'status' },
  25: { key: 'completed', color: '#10b981', table: 'asset', column: 'status' },

  // service.status
  26: { key: 'draft', color: '#64748b', table: 'service', column: 'status' },
  27: { key: 'pending', color: '#3b82f6', table: 'service', column: 'status' },
  28: { key: 'in_progress', color: '#3b82f6', table: 'service', column: 'status' },
  29: { key: 'completed', color: '#10b981', table: 'service', column: 'status' },

  // payment.payment_status
  30: { key: 'draft', color: '#64748b', table: 'payment', column: 'payment_status' },
  31: { key: 'ready_for_payment', color: '#3b82f6', table: 'payment', column: 'payment_status' },
  32: { key: 'paid', color: '#10b981', table: 'payment', column: 'payment_status' },
  33: { key: 'deleted', color: '#ef4444', table: 'payment', column: 'payment_status' },

  // invoice.invoice_status
  34: { key: 'draft', color: '#64748b', table: 'invoice', column: 'invoice_status' },
  35: { key: 'ready_to_issue', color: '#3b82f6', table: 'invoice', column: 'invoice_status' },
  36: { key: 'issued', color: '#10b981', table: 'invoice', column: 'invoice_status' },
  37: { key: 'paid', color: '#10b981', table: 'invoice', column: 'invoice_status' },
  38: { key: 'void', color: '#ef4444', table: 'invoice', column: 'invoice_status' },
  39: { key: 'deleted', color: '#ef4444', table: 'invoice', column: 'invoice_status' },

  // my_location.status
  50: { key: 'active', color: '#10b981', table: 'my_location', column: 'status' },
  51: { key: 'inactive', color: '#ef4444', table: 'my_location', column: 'status' },

  // oppotunity.status
  52: { key: 'open', color: '#3b82f6', table: 'oppotunity', column: 'status' },
  53: { key: 'closed_won', color: '#10b981', table: 'oppotunity', column: 'status' },
  54: { key: 'closed_lost', color: '#ef4444', table: 'oppotunity', column: 'status' },

  // mtr.status
  55: { key: 'draft', color: '#64748b', table: 'mtr', column: 'status' },
  56: { key: 'approved', color: '#10b981', table: 'mtr', column: 'status' },

  // finance.status
  57: { key: 'active', color: '#10b981', table: 'finance', column: 'status' },
  58: { key: 'inactive', color: '#ef4444', table: 'finance', column: 'status' },

  // cms_tenant_info.billing_status
  40: { key: 'active', color: '#10b981', table: 'cms_tenant_info', column: 'billing_status' },
  41: { key: 'grace', color: '#ffa500', table: 'cms_tenant_info', column: 'billing_status' },
  42: { key: 'expired', color: '#ef4444', table: 'cms_tenant_info', column: 'billing_status' },
  43: { key: 'canceled', color: '#ef4444', table: 'cms_tenant_info', column: 'billing_status' },
  44: { key: 'inactive', color: '#64748b', table: 'cms_tenant_info', column: 'billing_status' },

  // cms_tenant_info.subscription_status
  45: { key: 'active', color: '#10b981', table: 'cms_tenant_info', column: 'subscription_status' },
  46: { key: 'grace', color: '#ffa500', table: 'cms_tenant_info', column: 'subscription_status' },
  47: { key: 'expired', color: '#ef4444', table: 'cms_tenant_info', column: 'subscription_status' },
  48: { key: 'canceled', color: '#ef4444', table: 'cms_tenant_info', column: 'subscription_status' },
  49: { key: 'inactive', color: '#64748b', table: 'cms_tenant_info', column: 'subscription_status' },

  // payment.payment_type
  60: { key: 'incoming', color: '#10b981', table: 'payment', column: 'payment_type' },
  61: { key: 'outgoing', color: '#f59e0b', table: 'payment', column: 'payment_type' },

  // assigned_task.status
  62: { key: 'not_started', color: '#64748b', table: 'assigned_task', column: 'status' },
  63: { key: 'processing', color: '#3b82f6', table: 'assigned_task', column: 'status' },
  64: { key: 'completed', color: '#10b981', table: 'assigned_task', column: 'status' },

  // task_subtask.status
  65: { key: 'pending', color: '#f59e0b', table: 'task_subtask', column: 'status' },
  66: { key: 'completed', color: '#10b981', table: 'task_subtask', column: 'status' },

  // my_company.status
  67: { key: 'active', color: '#10b981', table: 'my_company', column: 'status' },
  68: { key: 'inactive', color: '#ef4444', table: 'my_company', column: 'status' },

  // contract.type
  69: { key: 'selling', color: '#10b981', table: 'contract', column: 'type' },
  70: { key: 'buying', color: '#ef4444', table: 'contract', column: 'type' },
  71: { key: 'internal', color: '#6366f1', table: 'contract', column: 'type' },

  // expense.id__expense_type
  72: { key: 'expense', color: '#3b82f6', table: 'expense', column: 'id__expense_type' },
  73: { key: 'non_expense', color: '#64748b', table: 'expense', column: 'id__expense_type' },

  // expense.id__expense_cost
  74: { key: 'operation_cost', color: '#10b981', table: 'expense', column: 'id__expense_cost' },
  75: { key: 'sales_cost', color: '#f59e0b', table: 'expense', column: 'id__expense_cost' },
  76: { key: 'fixed_cost', color: '#6366f1', table: 'expense', column: 'id__expense_cost' },
  77: { key: 'variable_cost', color: '#ec4899', table: 'expense', column: 'id__expense_cost' },
  78: { key: 'operation_expense', color: '#06b6d4', table: 'expense', column: 'id__expense_cost' },
  79: { key: 'sale_expense', color: '#8b5cf6', table: 'expense', column: 'id__expense_cost' },
  80: { key: 'others', color: '#94a3b8', table: 'expense', column: 'id__expense_cost' },

  // service.service_type
  81: { key: 'subcription', color: '#3b82f6', table: 'service', column: 'service_type' },
  82: { key: '1_time_service', color: '#10b981', table: 'service', column: 'service_type' },
  83: { key: 'rental_loan', color: '#f59e0b', table: 'service', column: 'service_type' },
  84: { key: 'borrow', color: '#8b5cf6', table: 'service', column: 'service_type' },
  85: { key: 'annual_renew', color: '#06b6d4', table: 'service', column: 'service_type' }
};

let catalogCache = { ...fallbackCatalog };
let isLoaded = false;

async function loadStatusCatalog() {
  if (isLoaded) return;
  try {
    const res = await pool.query('SELECT id, table_name, column_name, status_key, color_code FROM public.status_catalog');
    res.rows.forEach(r => {
      catalogCache[r.id] = {
        key: r.status_key,
        color: r.color_code,
        table: r.table_name,
        column: r.column_name
      };
    });
    isLoaded = true;
  } catch (err) {
    console.error('Failed to load status catalog cache:', err.message);
  }
}

// Start loading the catalog cache asynchronously on module import
loadStatusCatalog();

function normalizeTableName(name) {
  if (!name) return '';
  return name.toLowerCase().replace(/_active$/, '').replace(/_complete$/, '');
}

/**
 * Enriches a database record object with status label keys and colors
 * by inspecting columns and matching against the status catalog cache.
 */
function enrichRecordWithStatusCatalog(tableName, record) {
  if (!record || typeof record !== 'object') return record;
  const table = normalizeTableName(tableName);

  for (const [col, val] of Object.entries(record)) {
    if (val !== undefined && val !== null) {
      const id = parseInt(val, 10);
      if (!isNaN(id) && catalogCache[id]) {
        const item = catalogCache[id];
        const itemTable = normalizeTableName(item.table);
        
        // Match table name and column name
        if (itemTable === table || (table === 'assigned_task' && itemTable === 'request')) {
          if (item.column === col) {
            record[`${col}_key`] = item.key;
            record[`${col}_color`] = item.color;
          }
        }
      }
    }
  }

  // Also enrich steps inside approval_flow or processing_flow
  const flowCols = ['approval_flow', 'processing_flow'];
  for (const fCol of flowCols) {
    if (record[fCol]) {
      let flow = record[fCol];
      let wasString = false;
      if (typeof flow === 'string') {
        try {
          flow = JSON.parse(flow);
          wasString = true;
        } catch (e) {
          flow = null;
        }
      }
      if (flow && Array.isArray(flow.steps)) {
        flow.steps.forEach(step => {
          if (step && step.status !== undefined && step.status !== null) {
            const sId = parseInt(step.status, 10);
            if (!isNaN(sId) && catalogCache[sId]) {
              step.status_key = catalogCache[sId].key;
              step.status_color = catalogCache[sId].color;
            }
          }
        });
        if (!wasString) {
          record[fCol] = flow;
        }
      }
    }
  }

  return record;
}

/**
 * Enriches a database record object by converting numeric status ID columns to their lowercase string key values
 * for backward compatibility based on the table name.
 */
function enrichRecordWithStatusKeys(tableName, record) {
  if (!record || typeof record !== 'object') return record;
  const table = normalizeKey(tableName);
  const tableMappings = STATUS[table];
  if (!tableMappings) return record;

  for (const columnName of Object.keys(tableMappings)) {
    if (record[columnName] !== undefined && record[columnName] !== null) {
      const numericId = parseInt(record[columnName], 10);
      if (!isNaN(numericId)) {
        const key = getStatusKey(table, columnName, numericId);
        if (key) {
          record[`_${columnName}_id`] = numericId;
          // Keep numeric ID in record[columnName]
          record[columnName] = numericId;
          record[`${columnName}_key`] = key;
        }
      }
    }
  }
  return record;
}

module.exports = {
  STATUS,
  resolveStatusId,
  getStatusKey,
  getRecordStatusId,
  getRecordStatusKey,
  enrichRecordWithStatusKeys,
  enrichRecordWithStatusCatalog
};
