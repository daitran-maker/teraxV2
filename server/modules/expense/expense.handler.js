const service = require('./expense.service');
const repo = require('./expense.repository');

class ExpenseHandler {
  async beforeInsert(req, data, client) {
    await service.ensureExpenseId(data, client);
    return data;
  }

  async beforeUpdate(req, id, data, oldRecord) {
    return data;
  }
}

module.exports = new ExpenseHandler();
