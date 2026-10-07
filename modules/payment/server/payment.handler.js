const service = require('./payment.service');
const repo = require('./payment.repository');

class PaymentHandler {
  async beforeInsert(req, data, client) {
    await service.validatePaymentData(data, false, null, client);
    return data;
  }

  async beforeUpdate(req, id, data, oldRecord, client) {
    await service.validatePaymentData(data, true, oldRecord, client);
    return data;
  }
}

module.exports = new PaymentHandler();
