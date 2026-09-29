const service = require('./payment.service');
const repo = require('./payment.repository');

class PaymentHandler {
  async beforeInsert(req, data) {
    service.validatePaymentData(data, false);
    return data;
  }

  async beforeUpdate(req, id, data, oldRecord) {
    service.validatePaymentData(data, true, oldRecord);
    return data;
  }
}

module.exports = new PaymentHandler();
