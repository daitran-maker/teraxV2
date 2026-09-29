const service = require('./invoice.service');
const repo = require('./invoice.repository');

class InvoiceHandler {
  async beforeInsert(req, data) {
    return data;
  }

  async beforeUpdate(req, id, data, oldRecord) {
    return data;
  }
}

module.exports = new InvoiceHandler();
