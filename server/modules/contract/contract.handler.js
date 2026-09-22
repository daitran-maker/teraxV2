const service = require('./contract.service');
const repo = require('./contract.repository');

class ContractHandler {
  async beforeInsert(req, data) {
    service.validateContractData(data, false);
    return data;
  }

  async beforeUpdate(req, id, data) {
    service.validateContractData(data, true);
    return data;
  }
}

module.exports = new ContractHandler();
