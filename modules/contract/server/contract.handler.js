const service = require('./contract.service');
const repo = require('./contract.repository');

class ContractHandler {
  async beforeInsert(req, data, client) {
    service.validateContractData(data, false);
    return data;
  }

  async beforeUpdate(req, id, data, oldRecord, dbClient) {
    service.validateContractData(data, true, oldRecord);
    return data;
  }
}

module.exports = new ContractHandler();
