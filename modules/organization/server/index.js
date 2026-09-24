const {
  employeeRouter,
  departmentRouter,
  companyRouter,
  contactRouter,
  myCompanyRouter
} = require('./organization.controller');
const organizationService = require('./organization.service');
const organizationRepository = require('./organization.repository');

module.exports = {
  employeeRouter,
  departmentRouter,
  companyRouter,
  contactRouter,
  myCompanyRouter,
  organizationService,
  organizationRepository
};
