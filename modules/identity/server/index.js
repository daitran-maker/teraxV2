const { authRouter, permissionsRouter } = require('./identity.controller');
const identityService = require('./identity.service');
const identityRepository = require('./identity.repository');
const { authenticate } = require('./identity.middleware');

module.exports = {
  authRouter,
  permissionsRouter,
  authenticate,
  identityService,
  identityRepository,
  checkPermission: (table, column, user) => identityService.checkFieldPermission(table, column, user),
  clearPermissionCache: () => identityService.clearPermissions()
};
