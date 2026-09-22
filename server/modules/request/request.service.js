const repo = require('./request.repository');
const { eventBus, EVENTS } = require('../../core/events');
const { enrichRecordWithStatusCatalog } = require('../../helpers/statuses');

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
