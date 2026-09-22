const workflowService = require('./workflow.service');
const { ACTION_LOGIC, isRequestParticipant, getBaseTable, isValidTable } = require('./workflow.rules');

module.exports = {
  workflowService,
  ACTION_LOGIC,
  isRequestParticipant,
  getBaseTable,
  isValidTable
};
