const service = require('./finance.service');
const repo = require('./finance.repository');

class FinanceHandler {
  async getAccountCurrencies(req, res) {
    try {
      const currencies = await service.getCurrencies();
      res.json(currencies);
    } catch (err) {
      console.error('[FinanceHandler] Error fetching currencies:', err);
      res.status(500).json({ error: 'Failed to fetch currencies' });
    }
  }

  async getRequestFinanceSummary(req, res) {
    try {
      const { requestId } = req.params;
      const summary = await service.calculateRequestFinanceSummary(requestId);
      if (!summary) {
        return res.status(404).json({ error: 'Request not found' });
      }
      res.json({ success: true, data: summary });
    } catch (err) {
      console.error('[FinanceHandler] Error calculating request finance summary:', err);
      res.status(500).json({ error: 'Failed to calculate finance summary: ' + err.message });
    }
  }
}

module.exports = new FinanceHandler();
