const service = require('./target_table.service');
const repo = require('./target_table.repository');

class TargetTableHandler {
  async beforeInsert(req, data) {
    // If type is Add, ensure record_ids defaults to empty array if not provided
    if (data.type === 'Add' && (!data.record_ids || !Array.isArray(data.record_ids))) {
      data.record_ids = [];
    }
    return data;
  }

  async beforeUpdate(req, id, data) {
    return data;
  }
}

module.exports = new TargetTableHandler();
