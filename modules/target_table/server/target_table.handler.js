const service = require('./target_table.service');
const repo = require('./target_table.repository');

class TargetTableHandler {
  async beforeInsert(req, data) {
    return data;
  }

  async beforeUpdate(req, id, data) {
    return data;
  }
}

module.exports = new TargetTableHandler();
