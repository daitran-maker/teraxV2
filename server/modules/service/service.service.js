const repo = require('./service.repository');

class ServiceService {
  async getService(id) {
    return await repo.findById(id);
  }

  async getServicesForRequest(requestId) {
    return await repo.findByRequestId(requestId);
  }
}

module.exports = new ServiceService();
