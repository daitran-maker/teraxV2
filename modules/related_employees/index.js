/**
 * Related Employees Extension - Main Entry Point
 * 
 * Reusable extension for auto-calculating, indexing, and applying
 * Row-Level Security (RLS) on records based on unique participant employees.
 */

const installRelatedEmployees = require('./install');
const {
  tableConfigs,
  registerRelatedEmployeesTable
} = require('./server/related_employees.config');
const {
  getEmployeeLookup,
  computeRelatedEmployees,
  hasTable,
  buildRlsClause,
  backfillTable,
  syncRequestRelatedEmployees,
  syncChain,
  syncChainForRecord,
  isUserRelated
} = require('./server/related_employees.service');

module.exports = {
  install: installRelatedEmployees,
  tableConfigs,
  registerRelatedEmployeesTable,
  getEmployeeLookup,
  computeRelatedEmployees,
  hasTable,
  buildRlsClause,
  backfillTable,
  syncRequestRelatedEmployees,
  syncChain,
  syncChainForRecord,
  isUserRelated
};
