// Payment actions used by POST /api/actions/execute.
// MOVED verbatim from server/routes/actions.js (no logic change); `req.body.data` is passed in as `data`.
const { broadcastSSE } = require('../../../server/helpers/sseHelper');
const RequestModel = require('../../../server/models/requestModel');
const { normalizeEmail } = require('../../workflow/server/actions.helpers');
const { getRecordStatusId } = require('../../../server/helpers/statuses');
const { generateSequentialId } = require('../../../server/helpers/idGenerator');

async function submitForPayment({ client, record, record_id, user, action_id, data }) {
  // Outgoing: Submit for payment → tạo request mới, update status = 31 (Ready for payment)
  const newPaymentStatusId = 31; // Ready for payment
  const newRequestType = '5'; // Payment Request type ID (5)

  const nowUtc = new Date();
  const dd = String(nowUtc.getUTCDate()).padStart(2, '0');
  const mm = String(nowUtc.getUTCMonth() + 1).padStart(2, '0');
  const yy = String(nowUtc.getUTCFullYear()).slice(-2);
  const dateStr = `${dd}${mm}${yy}`;

  const requesterEmail = user.email || '';
  const prefixEmail = requesterEmail.includes('@') ? requesterEmail.split('@')[0] : requesterEmail;
  const initials = prefixEmail.slice(0, 2).toUpperCase() || 'XX';
  const prefix = `${newRequestType}-${dateStr}-${initials}-`;

  // Get next sequence number
  const seqResult = await client.query(
    `SELECT request_id FROM request WHERE request_id LIKE $1`,
    [`${prefix}%`]
  );
  let maxSeq = 0;
  seqResult.rows.forEach(row => {
    const parts = row.request_id.split('-');
    const seqPart = parts[parts.length - 1];
    const seqNum = parseInt(seqPart, 10);
    if (!isNaN(seqNum) && seqNum > maxSeq) {
      maxSeq = seqNum;
    }
  });
  const newPaymentReqId = `${prefix}${maxSeq + 1}`;

  // Update payment status (121: Submitted for payment) và payment_request ID
  await client.query(`
    UPDATE payment 
    SET payment_status = 121, payment_request = $1 
    WHERE payment_id = $2
  `, [newPaymentReqId, record_id]);

  try {
    broadcastSSE('db_change', {
      action: 'update',
      table: 'payment',
      id: record_id,
      record: { payment_id: record_id, payment_status: 121, payment_request: newPaymentReqId, request: record.request, contract_id: record.contract_id }
    });
  } catch (sseErr) {
    console.warn('Failed to broadcast SSE for payment status update:', sseErr);
  }

  // Tạo request mới cho payment này
  let partyName = '';
  if (record.employee) {
    const eRes = await client.query(`SELECT full_name FROM employee WHERE employee_id = $1 OR email = $1`, [record.employee]);
    if (eRes.rows.length > 0) partyName = eRes.rows[0].full_name;
  }
  if (!partyName && record.company) {
    const cRes = await client.query(`SELECT company_fullname, company_shortname FROM company WHERE company_id = $1`, [record.company]);
    if (cRes.rows.length > 0) partyName = cRes.rows[0].company_fullname || cRes.rows[0].company_shortname;
  }
  if (!partyName && record.counter_party) {
    let cpType = 'company';
    let cpId = record.counter_party;
    if (typeof record.counter_party === 'object' && record.counter_party !== null) {
      cpType = record.counter_party.type || 'company';
      cpId = record.counter_party.id;
    } else {
      try {
        const parsed = JSON.parse(record.counter_party);
        if (parsed && parsed.id) {
          cpType = parsed.type || 'company';
          cpId = parsed.id;
        }
      } catch (e) {
        // Keep as is
      }
    }

    if (cpType === 'employee') {
      const eRes = await client.query(`SELECT full_name FROM employee WHERE employee_id = $1 OR email = $1`, [cpId]);
      if (eRes.rows.length > 0) {
        partyName = eRes.rows[0].full_name;
      } else {
        partyName = cpId;
      }
    } else {
      const cRes = await client.query(`SELECT company_fullname, company_shortname FROM company WHERE company_id = $1`, [cpId]);
      if (cRes.rows.length > 0) {
        partyName = cRes.rows[0].company_fullname || cRes.rows[0].company_shortname;
      } else {
        partyName = cpId;
      }
    }
  }

  const resolveCurrency = (curr) => {
    if (!curr) return 'VND';
    const mapping = {
      '1': 'VND',
      '2': 'USD',
      '3': 'EUR',
      '4': 'SGD',
      '5': 'THB',
      '6': 'MMK',
      '7': 'SGD'
    };
    return mapping[curr] || curr;
  };

  const formatAmount = (val) => {
    if (val === null || val === undefined || val === '') return '0';
    const num = parseFloat(String(val).replace(/,/g, ''));
    if (isNaN(num)) return String(val);
    return num.toLocaleString('en-US');
  };

  const resolvePaymentTypeLabel = (pType) => {
    if (pType === 60 || String(pType).toLowerCase() === '60' || String(pType).toLowerCase() === 'incoming') {
      return 'Incoming';
    }
    if (pType === 61 || String(pType).toLowerCase() === '61' || String(pType).toLowerCase() === 'outgoing') {
      return 'Outgoing';
    }
    return String(pType || '');
  };

  const paymentTypeLabel = resolvePaymentTypeLabel(record.payment_type);
  const formattedValue = `${formatAmount(record.value || 0)} ${resolveCurrency(record.currency)}`;
  const desc = `${record.payment_description || ''} | ${formattedValue} | ${partyName} | ${paymentTypeLabel} (${record.payment_id})`;

  let parentReqId = record.request || null;
  if (!parentReqId && record.contract_id) {
    try {
      const cRes = await client.query('SELECT request FROM contract WHERE contract_id = $1', [record.contract_id]);
      if (cRes.rows.length > 0 && cRes.rows[0].request) {
        parentReqId = cRes.rows[0].request;
      }
    } catch (cErr) {
      console.error('Error finding parent contract request:', cErr);
    }
  }

  const requestData = {
    request_id: newPaymentReqId,
    request_type: newRequestType,
    sr_creater: user.employee_id,
    requester: user.employee_id,
    description: desc,
    sr_status: 2, // Pending Approval ID
    process_status: 7, // Not started ID
    parent__id_request: parentReqId
  };

  const tzTimeStr = new Date().toISOString();
  const logEntries = [
    { timestamp: tzTimeStr, user: user.employee_id, action: 'created request' },
    { timestamp: tzTimeStr, user: user.employee_id, action: 'submitted request' }
  ];
  requestData.log = JSON.stringify(logEntries);

  await RequestModel.resolveApprovals(requestData, client);

  const ptUpper = String(requestData.request_type || '').toUpperCase();
  const isPay = ptUpper === '5' || ptUpper === 'RPM' || ptUpper === 'PAYMENT';
  if (isPay && Number(requestData.sr_status) === 3) {
    requestData.process_status = 9;
    requestData.process_start_date = requestData.process_start_date || new Date().toISOString();
    requestData.process_end_date = requestData.process_end_date || new Date().toISOString();
  }

  // Normalize sr_owner if present
  if (requestData.sr_owner !== undefined && requestData.sr_owner !== null) {
    if (Array.isArray(requestData.sr_owner)) {
      requestData.sr_owner = requestData.sr_owner.map(s => s.trim().replace(/^\[|\]$/g, '').toLowerCase()).filter(Boolean);
    } else if (typeof requestData.sr_owner === 'string') {
      requestData.sr_owner = requestData.sr_owner.split(',').map(s => s.trim().replace(/^\[|\]$/g, '').toLowerCase()).filter(Boolean);
    }
  }

  await client.query(`
    INSERT INTO request (
      request_id, request_type, sr_creater, requester, description, 
      sr_status, process_status, 
      sr_submitted_date, sr_created_date,  
      policy_lead, sr_owner, approval_flow, approval_level, log,
      parent__id_request,
      process_start_date, process_end_date
    ) VALUES (
      $1, $2, $3, $4, $5, 
      $6, $7, 
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 
      $8, $9, $10, $11, $12,
      $13,
      CASE WHEN $7 = 9 THEN CURRENT_TIMESTAMP ELSE NULL END,
      CASE WHEN $7 = 9 THEN CURRENT_TIMESTAMP ELSE NULL END
    )
  `, [
    requestData.request_id,
    requestData.request_type,
    requestData.sr_creater,
    requestData.requester,
    requestData.description,
    requestData.sr_status,
    requestData.process_status,
    requestData.policy_lead || null,
    requestData.sr_owner || null,
    requestData.approval_flow || null,
    requestData.approval_level || null,
    requestData.log || null,
    requestData.parent__id_request || null
  ]);

  if (isPay && Number(requestData.sr_status) === 3) {
    try {
      await client.query(
        `UPDATE "payment" SET payment_status = 31 WHERE payment_id = $1`,
        [record_id]
      );
      broadcastSSE('db_change', {
        action: 'update',
        table: 'payment',
        id: record_id,
        record: { payment_id: record_id, payment_status: 31, payment_request: newPaymentReqId, request: record.request, contract_id: record.contract_id }
      });
    } catch (paySyncErr) {
      console.warn('Failed to sync payment status on auto-approval:', paySyncErr);
    }
  }

  try {
    broadcastSSE('db_change', { action: 'insert', table: 'request', record: requestData });
  } catch (e) {
    console.warn('Failed to broadcast SSE for created request:', e);
  }
}

async function markPaidOrUpdateMtr({ client, record, record_id, user, action_id, data }) {
  // Paid / Change MTR / Update Transaction: nhập transaction_id, tự động lấy transaction_date làm payment_date (ưu tiên)
  const { transaction_id, payment_date } = data || {};
  if (!transaction_id) throw new Error("Vui lòng chọn MTR Transaction");

  // Kiểm tra quyền đối với MTR transaction được chọn (chỉ check nếu không phải Super Admin)
  const isSuperAdmin = user.role && user.role.toUpperCase() === 'SUPER ADMIN';
  if (!isSuperAdmin) {
    const checkRes = await client.query(
      `SELECT a.finance_control, a.transaction_managed_by 
       FROM mtr m
       JOIN account a ON m.account = a.account_id
       WHERE m.transaction_id = $1`,
      [transaction_id]
    );
    if (checkRes.rows.length === 0) {
      throw new Error("MTR Transaction không hợp lệ hoặc không tồn tại.");
    }
    const row = checkRes.rows[0];
    const uIdentities = [user.employee_id, user.email, user.username].filter(Boolean).map(s => normalizeEmail(s.trim()));
    let hasAccess = false;

    if (row.finance_control && uIdentities.length > 0) {
      const controls = row.finance_control.split(',').map(s => normalizeEmail(s.trim()));
      if (controls.some(c => uIdentities.includes(c))) {
        hasAccess = true;
      }
    }

    if (row.transaction_managed_by && uIdentities.length > 0) {
      const managers = row.transaction_managed_by.split(',').map(s => normalizeEmail(s.trim()));
      if (managers.some(m => uIdentities.includes(m))) {
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      throw new Error("Bạn không có quyền sử dụng MTR Transaction thuộc tài khoản này.");
    }
  }

  // Lấy transaction_date từ MTR để gán vào payment_date (ưu tiên)
  let finalPaymentDate = payment_date || null;
  try {
    const mtrRes = await client.query(
      `SELECT transaction_date FROM mtr WHERE transaction_id = $1`,
      [transaction_id]
    );
    if (mtrRes.rows.length > 0 && mtrRes.rows[0].transaction_date) {
      finalPaymentDate = mtrRes.rows[0].transaction_date; // Ưu tiên transaction_date
    }
  } catch (mtrErr) {
    console.error('[payment_paid] Error fetching MTR transaction_date:', mtrErr);
  }

  const logMsg = action_id === 'payment_change_mtr'
    ? `Changed MTR transaction to ${transaction_id}`
    : (action_id === 'payment_update_transaction' ? `Updated transaction to ${transaction_id}` : `Marked as paid with MTR ${transaction_id}`);
  const tzTimeStr = new Date().toISOString();
  const logEntry = { timestamp: tzTimeStr, user: user.employee_id || 'system', action: logMsg };

  await client.query(
    `UPDATE payment SET payment_status = 32, transaction_id = $2, payment_date = $3, log = COALESCE(log, '[]'::jsonb) || $4::jsonb WHERE payment_id = $1`,
    [record_id, transaction_id, finalPaymentDate, JSON.stringify([logEntry])]
  );

  // Automated invoice generation for Selling contracts (only on initial mark as paid)
  if (action_id === 'payment_paid') {
    try {
      const payRes = await client.query(
        `SELECT p.*, c.type AS contract_type 
         FROM payment p 
         LEFT JOIN contract c ON p.contract_id = c.contract_id 
         WHERE p.payment_id = $1`,
        [record_id]
      );
      if (payRes.rows.length > 0) {
        const payment = payRes.rows[0];
        if (payment.contract_type && (getRecordStatusId(payment, 'contract', 'type') === 69 || String(payment.contract_type).toLowerCase() === 'selling')) {
          // Check if invoice already exists for this payment (to avoid duplicates)
          const invExists = await client.query(
            `SELECT 1 FROM invoice WHERE payment_id = $1 AND deleted_at IS NULL`,
            [record_id]
          );
          if (invExists.rows.length === 0) {
            // Generate invoice ID using generateSequentialId helper
            const invoiceId = await generateSequentialId('invoice', client);
            const invoiceNo = `INV-${invoiceId}`;

            const valBeforeVat = parseFloat(payment.value) || 0;
            const vatVal = parseFloat(payment.vat) || 0;
            const totalValue = valBeforeVat + vatVal;
            const rate = parseFloat(payment.exchange_rate) || 1.0;
            const totalValVnd = totalValue * rate;
            const valVnd = valBeforeVat * rate;
            const vatVnd = vatVal * rate;

            // Insert new invoice record
            await client.query(
              `INSERT INTO invoice (
                invoice_id, request, contract_id, payment_id, my_company, invoice_type, 
                counter_party, invoice_no, description, invoice_date, invoice_status, 
                payment_method, value_before_vat, vat_value, currency, exchange_rate, 
                source, total_value, value_before_vat_in_base_currency, vat_value_in_base_currency, total_value_in_base_currency,
                created_by
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)`,
              [
                invoiceId, payment.request, payment.contract_id, payment.payment_id, payment.my_company, 'Standard',
                payment.counter_party, invoiceNo, `Generated from paid payment: ${payment.payment_description || payment.payment_id}`, finalPaymentDate || new Date(), 'Paid',
                payment.payment_method, valBeforeVat, String(vatVal), payment.currency, rate,
                'Contract', totalValue, Math.round(valVnd), Math.round(vatVnd), Math.round(totalValVnd),
                user.employee_id || 'system'
              ]
            );

            try {
              broadcastSSE('db_change', {
                action: 'insert',
                table: 'invoice',
                record: {
                  invoice_id: invoiceId,
                  request: payment.request,
                  contract_id: payment.contract_id,
                  payment_id: payment.payment_id,
                  my_company: payment.my_company,
                  invoice_no: invoiceNo,
                  invoice_status: 'Paid',
                  total_value: totalValue
                }
              });
            } catch (e) {
              console.warn('Failed to broadcast SSE for created invoice:', e);
            }
          }
        }
      }
    } catch (autoInvErr) {
      console.error('[payment_paid] Error generating automatic invoice for selling contract payment:', autoInvErr);
    }
  }
}

async function readyForPayment({ client, record, record_id, user, action_id, data }) {
  await client.query(`UPDATE payment SET payment_status = 31 WHERE payment_id = $1`, [record_id]);
}

module.exports = {
  submitForPayment,
  markPaidOrUpdateMtr,
  readyForPayment
};
