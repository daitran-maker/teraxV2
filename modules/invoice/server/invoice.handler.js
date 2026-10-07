const service = require('./invoice.service');
const repo = require('./invoice.repository');

class InvoiceHandler {
  async beforeInsert(req, data, client) {
    await service.validateInvoiceData(data, false, null, client);
    return data;
  }

  async beforeUpdate(req, id, data, oldRecord, client) {
    await service.validateInvoiceData(data, true, oldRecord, client);
    return data;
  }
}

module.exports = new InvoiceHandler();
