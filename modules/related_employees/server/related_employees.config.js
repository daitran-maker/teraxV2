/**
 * Related Employees Extension - Configuration Registry
 * 
 * Defines how related employee IDs are extracted for each table.
 * Designed as a modular extension: any new table can be registered easily!
 */

const { resolveChain } = require('./related_employees.chain');

const tableConfigs = new Map();

/**
 * Register a table configuration for related employees extraction
 * @param {string|string[]} tableNames
 * @param {object} config
 *   sources: string[] - column names containing employee IDs or arrays of employee IDs
 *   async resolveCustom(record, client, resolveEmpId): returns string[] of extra employee IDs
 */
function registerRelatedEmployeesTable(tableNames, config) {
  const names = Array.isArray(tableNames) ? tableNames : [tableNames];
  for (const name of names) {
    tableConfigs.set(String(name).toLowerCase().trim(), config);
  }
}

// Opportunity, Contract, Service Delivery Contract and Service Task Request: related = own people + people of
// all ancestors + people of all descendants + everyone related to the request (see related_employees.chain.js),
// so parent/child visibility is always consistent in both directions.

// 1. Opportunity
registerRelatedEmployeesTable(['oppotunity', 'opportunity', 'oppo'], {
  sources: ['sale_lead', 'sale_team', 'created_by'],
  async resolveCustom(record, client) {
    return (await resolveChain(client, 'oppotunity', record)).people;
  }
});

// 2. Contract (includes Service Contract)
registerRelatedEmployeesTable(['contract', 'service_contract'], {
  sources: ['contract_owner', 'sc_coordinator__employee', 'created_by'],
  async resolveCustom(record, client) {
    return (await resolveChain(client, 'contract', record)).people;
  }
});

// 3. Service Delivery Contract (SDC)
registerRelatedEmployeesTable(['service_delivery_contract'], {
  sources: ['coordinator__employee', 'created_by'],
  async resolveCustom(record, client) {
    return (await resolveChain(client, 'service_delivery_contract', record)).people;
  }
});

// 4. Service Task Request (STR)
registerRelatedEmployeesTable(['service_task_request'], {
  sources: ['tier1_engineer__employee', 'service_coordinator__employee', 'created_by'],
  async resolveCustom(record, client) {
    return (await resolveChain(client, 'service_task_request', record)).people;
  }
});


// 5. Request
registerRelatedEmployeesTable(['request'], {
  sources: ['requester', 'sr_creater', 'policy_lead', 'sr_owner', 'created_by'],
  async resolveCustom(record, client, resolveEmpId) {
    const extra = [];
    // Extract approvers from approval_flow JSONB
    if (record.approval_flow) {
      try {
        const flow = typeof record.approval_flow === 'string'
          ? JSON.parse(record.approval_flow)
          : record.approval_flow;
        const steps = (flow && Array.isArray(flow.steps)) ? flow.steps : [];
        for (const step of steps) {
          if (step && step.approver) extra.push(step.approver);
        }
      } catch (e) {}
    }
    // Tagged employees in comments for this request (Replaces direct_manager of sr_owner as requested)
    if (client && record.request_id) {
      try {
        const cRes = await client.query(
          'SELECT tag FROM "comment" WHERE request = $1 AND tag IS NOT NULL AND tag != \'\' AND deleted_at IS NULL',
          [String(record.request_id)]
        );
        cRes.rows.forEach(r => {
          if (r.tag) {
            const tags = Array.isArray(r.tag)
              ? r.tag
              : String(r.tag).split(',').map(s => s.trim().replace(/^\[|\]$/g, '').replace(/^"|"$/g, '')).filter(Boolean);
            tags.forEach(t => extra.push(t));
          }
        });
      } catch (e) {}
    }
    return extra;
  }
});

module.exports = {
  tableConfigs,
  registerRelatedEmployeesTable
};
