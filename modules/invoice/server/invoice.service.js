const repo = require('./invoice.repository');

class InvoiceService {
  /**
   * Validate business rules for invoice
   */
  async validateInvoiceData(data, isEdit = false, oldRecord = null, dbClient = null) {
    const effectiveDescription = data.description !== undefined ? data.description : (oldRecord && oldRecord.description);
    if (!isEdit || data.description !== undefined) {
      if (!effectiveDescription || !String(effectiveDescription).trim()) {
        throw new Error('Description is required for invoice.');
      }
    }

    const contractId = data.contract_id !== undefined ? data.contract_id : (oldRecord ? oldRecord.contract_id : null);
    if (contractId && dbClient) {
      const contractRes = await dbClient.query(
        'SELECT COALESCE(total_value_in_base_currency, (COALESCE(value_before_vat, 0) + COALESCE(vat_value, 0)) * COALESCE(exchance_rate, 1)) as contract_total FROM contract WHERE contract_id = $1 AND deleted_at IS NULL',
        [contractId]
      );
      if (contractRes.rows.length > 0) {
        const contractTotal = parseFloat(contractRes.rows[0].contract_total) || 0;
        let newTotal = 0;
        if (data.total_value_in_base_currency !== undefined && data.total_value_in_base_currency !== null && data.total_value_in_base_currency !== '') {
          newTotal = parseFloat(String(data.total_value_in_base_currency).replace(/,/g, '')) || 0;
        } else if (data.value_before_vat !== undefined || data.vat_value !== undefined || data.exchange_rate !== undefined) {
          const valBefore = parseFloat(String(data.value_before_vat !== undefined ? data.value_before_vat : (oldRecord ? oldRecord.value_before_vat : 0)).replace(/,/g, '')) || 0;
          const valVat = parseFloat(String(data.vat_value !== undefined ? data.vat_value : (oldRecord ? oldRecord.vat_value : 0)).replace(/,/g, '')) || 0;
          const rate = parseFloat(String(data.exchange_rate !== undefined ? data.exchange_rate : (oldRecord ? oldRecord.exchange_rate : 1)).replace(/,/g, '')) || 1;
          newTotal = Math.round((valBefore + valVat) * rate);
        } else {
          newTotal = oldRecord ? (parseFloat(oldRecord.total_value_in_base_currency) || ((parseFloat(oldRecord.value_before_vat || 0) + parseFloat(oldRecord.vat_value || 0)) * parseFloat(oldRecord.exchange_rate || 1))) : 0;
        }

        const queryStr = isEdit && oldRecord && (oldRecord.invoice_id || oldRecord.id)
          ? 'SELECT SUM(COALESCE(NULLIF(regexp_replace(COALESCE(total_value_in_base_currency::text, \'\'), \'[^0-9.-]\', \'\', \'g\'), \'\')::numeric, (COALESCE(NULLIF(regexp_replace(COALESCE(value_before_vat::text, \'0\'), \'[^0-9.-]\', \'\', \'g\'), \'\')::numeric, 0) + COALESCE(NULLIF(regexp_replace(COALESCE(vat_value::text, \'0\'), \'[^0-9.-]\', \'\', \'g\'), \'\')::numeric, 0)) * COALESCE(NULLIF(regexp_replace(COALESCE(exchange_rate::text, \'1\'), \'[^0-9.-]\', \'\', \'g\'), \'\')::numeric, 1))) as existing_total FROM invoice WHERE contract_id = $1 AND deleted_at IS NULL AND invoice_id <> $2'
          : 'SELECT SUM(COALESCE(NULLIF(regexp_replace(COALESCE(total_value_in_base_currency::text, \'\'), \'[^0-9.-]\', \'\', \'g\'), \'\')::numeric, (COALESCE(NULLIF(regexp_replace(COALESCE(value_before_vat::text, \'0\'), \'[^0-9.-]\', \'\', \'g\'), \'\')::numeric, 0) + COALESCE(NULLIF(regexp_replace(COALESCE(vat_value::text, \'0\'), \'[^0-9.-]\', \'\', \'g\'), \'\')::numeric, 0)) * COALESCE(NULLIF(regexp_replace(COALESCE(exchange_rate::text, \'1\'), \'[^0-9.-]\', \'\', \'g\'), \'\')::numeric, 1))) as existing_total FROM invoice WHERE contract_id = $1 AND deleted_at IS NULL';
        const params = isEdit && oldRecord && (oldRecord.invoice_id || oldRecord.id) ? [contractId, oldRecord.invoice_id || oldRecord.id] : [contractId];

        const existingRes = await dbClient.query(queryStr, params);
        const existingTotal = parseFloat(existingRes.rows[0].existing_total) || 0;
        if (existingTotal + newTotal > contractTotal) {
          throw new Error(`Tổng giá trị các hóa đơn (${(existingTotal + newTotal).toLocaleString()}) vượt quá tổng giá trị hợp đồng (${contractTotal.toLocaleString()})`);
        }
      }
    }
  }

  async getInvoice(id) {
    return await repo.findById(id);
  }

  async getInvoicesForRequest(requestId) {
    return await repo.findByRequestId(requestId);
  }
}

module.exports = new InvoiceService();
