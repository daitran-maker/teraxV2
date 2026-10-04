const repo = require('./request.repository');
const { eventBus, EVENTS } = require('../../../server/core/events');
const { enrichRecordWithStatusCatalog } = require('../../../server/helpers/statuses');

class RequestService {
  async getAccessibleRequestIds(employeeId) {
    return await repo.getUserAccessibleRequestIds(employeeId);
  }

  async getRequestDetails(requestId) {
    const record = await repo.getRequestById(requestId);
    if (record) {
      enrichRecordWithStatusCatalog('request', record);
    }
    return record;
  }

  notifyStatusChanged(requestId, oldStatus, newStatus, user) {
    eventBus.safeEmit(EVENTS.REQUEST_STATUS_CHANGED, {
      requestId,
      oldStatus,
      newStatus,
      user
    });
  }
}

module.exports = new RequestService();
