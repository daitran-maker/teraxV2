const pool = require('../../../server/db');
const hashidHelper = require('../../../server/helpers/hashidHelper');
const { STATUS, getRecordStatusId, enrichRecordWithStatusCatalog } = require('../../../server/helpers/statuses');
const { ACTION_LOGIC, isRequestParticipant, getBaseTable, isValidTable } = require('./workflow.rules');
const { eventBus, EVENTS } = require('../../../server/core/events');

class WorkflowService {
  /**
   * Determine primary key column based on table name
   */
  getPrimaryKeyColumn(tableName) {
    if (tableName === 'employee') return 'employee_id';
    if (['policy_and_program', 'policy', 'my_product_and_service'].includes(tableName)) return 'policy_id';
    if (['finance', 'v_finance'].includes(tableName)) return 'id';
    if (tableName === 'asset') return 'office_asset_id';
    if (tableName === 'my_company') return 'my_company_id';
    if (tableName === 'operation_program') return 'oper_id';
    if (tableName === 'assigned_task') return 'task_id';
    if (tableName === 'task_subtask') return 'subtask_id';
    if (tableName === 'mtr') return 'transaction_id';
    if (['oppotunity', 'opportunity'].includes(tableName)) return 'project_id';
    if (['expense', 'column_permissions', 'exception_rules', 'action_rules', 'uploaded_files', 'permission_positions', 'permission_roles', 'permission_exceptions'].includes(tableName)) return 'id';
    return `${tableName}_id`;
  }

  /**
   * Evaluates available workflow actions for a specific record
   */
  async getAvailableActions(tableName, recordId, user, viewName = null) {
    if (['finance', 'v_finance'].includes(tableName)) return [];
    const baseTable = getBaseTable(tableName);
    if (!isValidTable(baseTable)) return [];

    const pkColumn = this.getPrimaryKeyColumn(baseTable);
    const rawRecordId = String(recordId);
    const decodedRecordId = String(hashidHelper.decode(recordId));

    let whereClause = `(${pkColumn}::text = $1 OR ${pkColumn}::text = $2`;
    if (baseTable === 'action_rules') {
      whereClause += ` OR action_id = $1 OR action_id = $2`;
    }
    whereClause += `)`;

    const queryStr = baseTable === 'employee'
      ? `SELECT * FROM "employee" WHERE employee_id = $1 OR email = $1 OR username = $1 OR employee_id = $2 OR email = $2 OR username = $2`
      : `SELECT * FROM "${baseTable}" WHERE ${whereClause}`;

    const recordResult = await pool.query(queryStr, [rawRecordId, decodedRecordId]);
    if (recordResult.rows.length === 0) return [];

    const record = recordResult.rows[0];
    enrichRecordWithStatusCatalog(baseTable, record);

    const targetView = viewName || baseTable;
    const rulesResult = await pool.query(`SELECT * FROM action_rules`);
    const allowedTicketActions = ['ACT-TICKET-03', 'ACT-TICKET-03-RE', 'ACT-TICKET-05', 'withdraw_ticket'];

    const rules = rulesResult.rows.filter(rule => {
      if (rule.display === false || String(rule.display).toLowerCase() === 'false') return false;
      if (/^(add|edit|delete)(_.*)?$/i.test(rule.action_id || '')) return false;
      if (baseTable === 'ticket' && !allowedTicketActions.includes(rule.action_id)) return false;
      if (!rule.view_name) return true;
      const views = rule.view_name.split(',').map(v => v.trim().replace(/^\[|\]$/g, '').toLowerCase());
      return views.includes(targetView.toLowerCase());
    });

    const availableActions = [];
    for (const rule of rules) {
      const actionDef = ACTION_LOGIC[rule.action_id];
      if (!actionDef) continue;

      let canPerform = false;
      try {
        if (typeof actionDef.when === 'function') {
          canPerform = await actionDef.when(record, user, pool);
        } else {
          canPerform = true;
        }
      } catch (err) {
        console.error(`[WorkflowService] Error evaluating when condition for ${rule.action_id}:`, err);
        canPerform = false;
      }

      if (canPerform) {
        availableActions.push({
          action_id: rule.action_id,
          display_name: rule.display_name || actionDef.label || rule.action_id,
          color: rule.color || actionDef.color || 'var(--accent)',
          icon: rule.icon || actionDef.icon || '',
          description: rule.description || actionDef.description || '',
          form_schema: actionDef.form_schema || null
        });
      }
    }

    return availableActions;
  }

  /**
   * Safely emit workflow action event
   */
  notifyActionExecuted(payload) {
    eventBus.safeEmit(EVENTS.ACTION_EXECUTED, payload);
  }
}

module.exports = new WorkflowService();
