const { v4: uuidv4 } = require('uuid');

// Define table configurations for sequential ID generation
const tableConfigs = {
  account: { pk: 'account_id', prefix: '', regex: /^(?:ACC-)?(\d+)$/i },
  company: { pk: 'company_id', prefix: '', regex: /^(?:COMP-)?(\d+)$/i, padding: 3 },
  contact: { pk: 'contact_id', prefix: '', regex: /^(?:CONT-)?(\d+)$/i, padding: 3 },
  contract: { pk: 'contract_id', prefix: 'CON-', regex: /^(?:CTR-|CON-)?(\d+)$/i, padding: 3 },
  employee: { pk: 'employee_id', prefix: '', regex: /^(?:EMP-)?(\d+)$/i, padding: 4 },
  employee_active: { pk: 'employee_id', prefix: '', regex: /^(?:EMP-)?(\d+)$/i, padding: 4 },
  invoice: { pk: 'invoice_id', prefix: '', regex: /^(?:INV-)?(\d+)$/i },
  my_company: { pk: 'my_company_id', prefix: '', regex: /^(?:MYCOMP-|MC-)?(\d+)$/i },
  my_location: { pk: 'my_location_id', prefix: '', regex: /^(?:LOC-)?(\d+)$/i },
  policy_and_program: { pk: 'policy_id', prefix: '', regex: /^(?:POL-)?(\d+)$/i },
  ticket: { pk: 'ticket_id', prefix: '', regex: /^(?:TKT-)?(\d+)$/i },
  ticket_type: { pk: 'ticket_type_id', prefix: '', regex: /^(?:TTY-)?(\d+)$/i },
  
  // Existing tables from dynamic_crud
  department: { pk: 'department_id', prefix: '', regex: /^(?:DEP-)?(\d+)$/i },
  service: { pk: 'service_id', prefix: '', regex: /^(?:SRV-)?(\d+)$/i },
  asset: { pk: 'office_asset_id', prefix: '', regex: /^(?:AST-)?(\d+)$/i },
  assigned_task: { pk: 'task_id', prefix: 'TSK-', regex: /^(?:TSK-)?(\d+)$/i, padding: 3 },
  task_subtask: { pk: 'subtask_id', prefix: 'SUB-', regex: /^(?:SUB-)?(\d+)$/i, padding: 3 },
};

/**
 * Generates a transaction-safe sequential ID with custom prefix
 * @param {string} tableName 
 * @param {object} client pg client connection 
 * @returns {Promise<string>} sequential ID
 */
async function generateSequentialId(tableName, client) {
  const config = tableConfigs[tableName];
  if (!config) {
    return uuidv4();
  }

  const pk = config.pk;
  
  // Select all current IDs
  const result = await client.query(`SELECT "${pk}" FROM "${tableName}"`);
  
  let maxSeq = 0;
  result.rows.forEach(row => {
    const val = row[pk];
    if (val) {
      const match = String(val).match(config.regex);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      }
    }
  });

  const nextSeq = maxSeq + 1;
  const seqStr = config.padding ? String(nextSeq).padStart(config.padding, '0') : String(nextSeq);
  return `${config.prefix}${seqStr}`;
}

module.exports = {
  generateSequentialId,
  tableConfigs
};
