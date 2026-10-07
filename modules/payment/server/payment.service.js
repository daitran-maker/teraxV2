const repo = require('./payment.repository');

class PaymentService {
  /**
   * Validate business rules for payment
   */
  async validatePaymentData(data, isEdit = false, oldRecord = null, dbClient = null) {
    // 1. payment_term is required
    const effectivePaymentTerm = data.payment_term !== undefined ? data.payment_term : (oldRecord && oldRecord.payment_term);
    if (!isEdit || data.payment_term !== undefined) {
      if (!effectivePaymentTerm || String(effectivePaymentTerm).trim() === '') {
        throw new Error('Payment Condition (payment_term) is required.');
      }
    }

    // 2. payment_period must be a positive whole number
    if (data.payment_period !== undefined && data.payment_period !== null && String(data.payment_period).trim() !== '') {
      const p = Number(data.payment_period);
      if (!Number.isInteger(p) || p < 1) {
        throw new Error('Payment Period must be a positive whole number.');
      }
      data.payment_period = p;
    }

    // 3. Default payment_status to 30 (Draft) on insert
    if (!isEdit && !data.payment_status) {
      data.payment_status = 30;
    }

    // 4. payment_type validation (Outgoing / Incoming)
    if (data.payment_type !== undefined && data.payment_type !== null && String(data.payment_type).trim() !== '') {
      const typeStr = String(data.payment_type).trim();
      if (typeStr === '61' || typeStr.toLowerCase() === 'outgoing' || typeStr === '25') {
        data.payment_type = 61;
      } else if (typeStr === '60' || typeStr.toLowerCase() === 'incoming' || typeStr === '24') {
        data.payment_type = 60;
      } else {
        throw new Error("Payment Type must be either 'Outgoing' or 'Incoming'.");
      }
    }

    // 5. Total payment check against contract
    const contractId = data.contract_id !== undefined ? data.contract_id : (oldRecord ? oldRecord.contract_id : null);
    if (contractId && dbClient) {
      const contractRes = await dbClient.query(
        'SELECT type, COALESCE(total_value_in_base_currency, (COALESCE(value_before_vat, 0) + COALESCE(vat_value, 0)) * COALESCE(exchance_rate, 1)) as contract_total FROM contract WHERE contract_id = $1 AND deleted_at IS NULL',
        [contractId]
      );
      if (contractRes.rows.length > 0) {
        const contractTotal = parseFloat(contractRes.rows[0].contract_total) || 0;
        let newTotal = 0;
        if (data.value_in_base_currency !== undefined && data.value_in_base_currency !== null && data.value_in_base_currency !== '') {
          newTotal = parseFloat(String(data.value_in_base_currency).replace(/,/g, '')) || 0;
        } else if (data.value !== undefined || data.exchange_rate !== undefined) {
          const val = parseFloat(String(data.value !== undefined ? data.value : (oldRecord ? oldRecord.value : 0)).replace(/,/g, '')) || 0;
          const rate = parseFloat(String(data.exchange_rate !== undefined ? data.exchange_rate : (oldRecord ? oldRecord.exchange_rate : 1)).replace(/,/g, '')) || 1;
          newTotal = Math.round(val * rate);
        } else {
          newTotal = oldRecord ? (parseFloat(oldRecord.value_in_base_currency) || (parseFloat(oldRecord.value || 0) * parseFloat(oldRecord.exchange_rate || 1))) : 0;
        }

        const queryStr = isEdit && oldRecord && (oldRecord.payment_id || oldRecord.id)
          ? 'SELECT SUM(COALESCE(value_in_base_currency, (COALESCE(value, 0) + COALESCE(vat, 0)) * COALESCE(exchange_rate, 1))) as existing_total FROM payment WHERE contract_id = $1 AND deleted_at IS NULL AND payment_id <> $2'
          : 'SELECT SUM(COALESCE(value_in_base_currency, (COALESCE(value, 0) + COALESCE(vat, 0)) * COALESCE(exchange_rate, 1))) as existing_total FROM payment WHERE contract_id = $1 AND deleted_at IS NULL';
        const params = isEdit && oldRecord && (oldRecord.payment_id || oldRecord.id) ? [contractId, oldRecord.payment_id || oldRecord.id] : [contractId];

        const existingRes = await dbClient.query(queryStr, params);
        const existingTotal = parseFloat(existingRes.rows[0].existing_total) || 0;
        if (existingTotal + newTotal > contractTotal) {
          throw new Error(`Tổng giá trị các thanh toán (${(existingTotal + newTotal).toLocaleString()}) vượt quá tổng giá trị hợp đồng (${contractTotal.toLocaleString()})`);
        }
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
