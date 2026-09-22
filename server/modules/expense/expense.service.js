const repo = require('./expense.repository');

class ExpenseService {
  async getExpense(id) {
    return await repo.findById(id);
  }

  async getExpensesForRequest(requestId) {
    return await repo.findByRequestId(requestId);
  }

  async ensureExpenseId(data, client) {
    if (!data.id) {
      data.id = await repo.getNextSequence(client);
    }
    return data;
  }
}

module.exports = new ExpenseService();
