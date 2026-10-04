const repo = require('./invoice.repository');

class InvoiceService {
  async getInvoice(id) {
    return await repo.findById(id);
  }

  async getInvoicesForRequest(requestId) {
    return await repo.findByRequestId(requestId);
  }
}

module.exports = new InvoiceService();
