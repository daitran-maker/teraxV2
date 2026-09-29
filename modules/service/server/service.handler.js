const service = require('./service.service');
const repo = require('./service.repository');

class ServiceHandler {
  async beforeInsert(req, data) {
    return data;
  }

  async beforeUpdate(req, id, data) {
    return data;
  }
}

module.exports = new ServiceHandler();
