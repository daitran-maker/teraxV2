const repo = require('./target_table.repository');

class TargetTableService {
  async getTargetTable(id) {
    return await repo.findById(id);
  }

  async getTargetTablesForRequest(requestId) {
    return await repo.findByRequestId(requestId);
  }
}

module.exports = new TargetTableService();
