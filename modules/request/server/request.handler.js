const repo = require('./request.repository');
const service = require('./request.service');

class RequestHandler {
  /**
   * Intercept and enrich query filters specifically for request table
   */
  async beforeListQuery(req, tableName, whereClauses, values, valIdx) {
    if (tableName === 'request') {
      const user = req.user;
      const isSuperAdmin = user && user.role && user.role.toUpperCase() === 'SUPER ADMIN';
      
      // If user is not superadmin and has no explicit bypass, apply RLS accessible IDs
      if (!isSuperAdmin && user && user.employee_id) {
        const accessibleIds = await repo.getUserAccessibleRequestIds(user.employee_id);
        if (accessibleIds.length > 0) {
          whereClauses.push(`LOWER("request"."request_id") = ANY($${valIdx}::text[])`);
          values.push(accessibleIds);
          valIdx++;
        }
      }
    }
    return { whereClauses, values, valIdx };
  }

  onRecordMutated(action, record) {
    repo.clearCache();
  }
}

module.exports = new RequestHandler();
