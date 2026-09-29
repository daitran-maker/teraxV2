const repo = require('./payment.repository');

class PaymentService {
  /**
   * Validate business rules for payment
   */
  validatePaymentData(data, isEdit = false, oldRecord = null) {
    // 1. payment_term is required
    const effectivePaymentTerm = data.payment_term !== undefined ? data.payment_term : (oldRecord && oldRecord.payment_term);
    if (!isEdit || data.payment_term !== undefined) {
      if (!effectivePaymentTerm || String(effectivePaymentTerm).trim() === '') {
        throw new Error('Payment Condition (payment_term) is required.');
      }
    }

    // 2. payment_period must be an integer if provided
    if (data.payment_period !== undefined && data.payment_period !== null && String(data.payment_period).trim() !== '') {
      const p = Number(data.payment_period);
      if (!Number.isInteger(p) || p < 1) {
        throw new Error('Payment Period (payment_period) must be a positive integer.');
      }
    }

    // 3. payment_type validation (Outgoing / Incoming)
    if (data.payment_type !== undefined && data.payment_type !== null) {
      const typeStr = String(data.payment_type).trim();
      const validTypes = ['Outgoing', 'Incoming', '24', '25']; // Support both string and status ID
      if (!validTypes.includes(typeStr) && !validTypes.map(t => t.toLowerCase()).includes(typeStr.toLowerCase())) {
        throw new Error("Payment Type must be either 'Outgoing' or 'Incoming'.");
      }
    }
  }

  async getPayment(id) {
    return await repo.findById(id);
  }

  async getPaymentsForRequest(requestId) {
    return await repo.findByRequestId(requestId);
  }
}

module.exports = new PaymentService();
