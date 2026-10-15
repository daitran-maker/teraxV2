// Payment actions used by POST /api/actions/execute.
// MOVED verbatim from server/routes/actions.js (no logic change); `req.body.data` is passed in as `data`.
const { broadcastSSE } = require('../../../server/helpers/sseHelper');
const pool = require('../../../server/db');
const RequestModel = require('../../../server/models/requestModel');
const { normalizeEmail } = require('../../workflow/server/actions.helpers');
const { getRecordStatusId } = require('../../../server/helpers/statuses');
const { generateSequentialId } = require('../../../server/helpers/idGenerator');

async function submitForPayment({ client, record, record_id, user, action_id, data }) {
  // Outgoing: Submit for payment → tạo request mới (hoặc re-submit nếu đã có payment_request ở trạng thái Draft/Withdrawn)
  const newPaymentStatusId = 31; // Ready for payment
  const newRequestType = '5'; // Payment Request type ID (5)

  // Check if this payment already has an existing payment_request in Draft/Withdrawn status
  let isReSubmit = false;
  let targetPaymentReqId = record.payment_request;
  let existingReq = null;

  if (targetPaymentReqId) {
    const existRes = await client.query(
      `SELECT * FROM request WHERE request_id = $1`,
      [targetPaymentReqId]
    );
    if (existRes.rows.length > 0) {
      existingReq = existRes.rows[0];
      const srSt = Number(existingReq.sr_status);
      const prSt = Number(existingReq.process_status);
      // sr_status: 1 (Draft), 4 (Withdrawn); process_status: 7 (Not started), 117 (Draft)
      if (srSt === 1 || srSt === 4 || prSt === 7 || prSt === 117) {
        isReSubmit = true;
      }
    }
  }

  if (!isReSubmit) {
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
    targetPaymentReqId = `${prefix}${maxSeq + 1}`;
  }

  // Tạo request mới hoặc update thông tin request cho payment này
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

  if (isReSubmit) {
    let flow = null;
    try {
      flow = typeof existingReq.approval_flow === 'string' ? JSON.parse(existingReq.approval_flow) : JSON.parse(JSON.stringify(existingReq.approval_flow || {}));
    } catch (e) {
      console.warn('Error parsing approval_flow on re-submit:', e);
    }

    let isTier0 = false;
    if (flow && flow.total_levels === 0) {
      isTier0 = true;
    } else if (existingReq.request_type) {
      const polRes = await client.query('SELECT approval_level FROM policy_and_program WHERE policy_id::text = $1 OR policy_name = $1', [existingReq.request_type]);
      if (polRes.rows.length > 0 && String(polRes.rows[0].approval_level || '').toLowerCase().includes('tier 0')) {
        isTier0 = true;
      }
    }

    let logEntry = null;
    if (!isTier0 && flow && flow.steps && flow.steps.length > 0) {
      flow.current_level = 1;
      flow.steps.forEach((step, idx) => {
        step.status = idx === 0 ? 2 : 7;
        step.action_by = null;
        step.action_date = null;
      });
      const tzTimeStr = new Date().toISOString();
      logEntry = { timestamp: tzTimeStr, user: user.employee_id, action: 're-submitted request' };
    } else if (isTier0) {
      if (flow) {
        flow.total_levels = 0;
        flow.current_level = 0;
        flow.steps = [];
      }
      const tzTimeStr = new Date().toISOString();
      logEntry = { timestamp: tzTimeStr, user: user.employee_id, action: 're-submitted and auto-approved request (Tier 0)' };
    } else {
      logEntry = { timestamp: new Date().toISOString(), user: user.employee_id, action: 're-submitted request' };
    }

    const newSrStatus = isTier0 ? 3 : 2;
    const newProcessStatus = isTier0 ? 9 : 7;
    const payStatus = isTier0 ? 31 : 121;

    await client.query(`
      UPDATE request
      SET description = $2,
          sr_status = $3,
          process_status = $4,
          sr_submitted_date = CURRENT_TIMESTAMP,
          approval_flow = $5,
          log = COALESCE(log, '[]'::jsonb) || $6::jsonb
      WHERE request_id = $1
    `, [targetPaymentReqId, desc, newSrStatus, newProcessStatus, flow ? JSON.stringify(flow) : existingReq.approval_flow, JSON.stringify([logEntry])]);

    await client.query(`
      UPDATE payment
      SET payment_status = $2
      WHERE payment_id = $1
    `, [record_id, payStatus]);

    try {
      broadcastSSE('db_change', {
        action: 'update',
        table: 'payment',
        id: record_id,
        record: { payment_id: record_id, payment_status: payStatus, payment_request: targetPaymentReqId, request: record.request, contract_id: record.contract_id }
      });
      broadcastSSE('db_change', {
        action: 'update',
        table: 'request',
        id: targetPaymentReqId,
        record: { ...existingReq, description: desc, sr_status: newSrStatus, process_status: newProcessStatus }
      });
    } catch (e) {
      console.warn('Failed to broadcast SSE for re-submitted payment request:', e);
    }
  } else {
    await client.query(`
      UPDATE payment 
      SET payment_status = 121, payment_request = $1 
      WHERE payment_id = $2
    `, [targetPaymentReqId, record_id]);

    try {
      broadcastSSE('db_change', {
        action: 'update',
        table: 'payment',
        id: record_id,
        record: { payment_id: record_id, payment_status: 121, payment_request: targetPaymentReqId, request: record.request, contract_id: record.contract_id }
      });
    } catch (sseErr) {
      console.warn('Failed to broadcast SSE for payment status update:', sseErr);
    }

    const requestData = {
      request_id: targetPaymentReqId,
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
          record: { payment_id: record_id, payment_status: 31, payment_request: targetPaymentReqId, request: record.request, contract_id: record.contract_id }
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

  // Generate executive summary comment for the payment request
  try {
    let rootReqRes = null;
    let contractsRes = null;
    let invoicesRes = null;
    let expensesRes = null;
    let assetsRes = null;
    let servicesRes = null;

    let otherPaymentsRes = null;
    if (parentReqId) {
      [rootReqRes, contractsRes, invoicesRes, expensesRes, assetsRes, servicesRes, otherPaymentsRes] = await Promise.all([
        pool.query(
          `SELECT r.request_id, r.description, r.requester, r.sr_creater, r.elements, e.full_name as requester_name
           FROM request r
           LEFT JOIN employee e ON (e.employee_id = r.requester OR e.email = r.requester)
           WHERE r.request_id = $1`,
          [parentReqId]
        ).catch(err => { console.warn('rootReq query err:', err.message); return null; }),
        pool.query(
          `SELECT c.contract_id, c.contractspood_no, c.contract_name_or_description, c.contractor, c.total_value, c.currency,
                  cmp.company_fullname as contractor_name
           FROM contract c
           LEFT JOIN company cmp ON (cmp.company_id::text = c.contractor::text)
           WHERE (c.request = $1 OR c.id__request = $1 ${record.contract_id ? 'OR c.contract_id = $2' : ''})
             AND c.deleted_at IS NULL`,
          record.contract_id ? [parentReqId, record.contract_id] : [parentReqId]
        ).catch(err => { console.warn('contracts query err:', err.message); return null; }),
        pool.query(
          `SELECT invoice_id, invoice_no, invoice_type, invoice_date, total_value, currency, description
           FROM invoice
           WHERE (request = $1 OR invoice_request = $1 ${record.contract_id ? 'OR (contract_id IS NOT NULL AND contract_id = $2)' : ''})
             AND deleted_at IS NULL`,
          record.contract_id ? [parentReqId, record.contract_id] : [parentReqId]
        ).catch(err => { console.warn('invoices query err:', err.message); return null; }),
        pool.query(
          `SELECT expense_id, expense_name, total_value, currency, description
           FROM expense
           WHERE (request = $1 OR expense_request = $1)
             AND deleted_at IS NULL`,
          [parentReqId]
        ).catch(err => { console.warn('expenses query err:', err.message); return null; }),
        pool.query(
          `SELECT asset_id, asset_name, model, serial_number, original_value, currency
           FROM asset
           WHERE (request = $1 OR asset_request = $1)
             AND deleted_at IS NULL`,
          [parentReqId]
        ).catch(err => { console.warn('assets query err:', err.message); return null; }),
        pool.query(
          `SELECT service_id, service_name, provider, total_value, currency
           FROM service
           WHERE (request = $1 OR service_request = $1)
             AND deleted_at IS NULL`,
          [parentReqId]
        ).catch(err => { console.warn('services query err:', err.message); return null; }),
        pool.query(
          `SELECT payment_id, payment_description, value, currency, payment_type, payment_status, payment_request
           FROM payment
           WHERE (request = $1 ${record.contract_id ? 'OR contract_id = $2' : ''})
             AND deleted_at IS NULL`,
          record.contract_id ? [parentReqId, record.contract_id] : [parentReqId]
        ).catch(err => { console.warn('otherPayments query err:', err.message); return null; })
      ]);
    }

    const htmlParts = [];

    // Payment Info Table
    htmlParts.push(`
      <div style="margin-bottom:12px;">
        <table style="width:100%; border-collapse:collapse; font-size:12.5px; border:1px solid #E2E8F0; border-radius:6px; overflow:hidden;">
          <thead>
            <tr style="background:#F8FAFC; border-bottom:1px solid #E2E8F0; text-align:left;">
              <th style="padding:6px 10px; font-weight:600; color:#475569; width:30%;">{{col.property::Thuộc tính}}</th>
              <th style="padding:6px 10px; font-weight:600; color:#475569;">{{col.detail::Chi tiết}}</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom:1px solid #F1F5F9;">
              <td style="padding:6px 10px; color:#64748B; font-weight:500;">Payment ID</td>
              <td style="padding:6px 10px; font-weight:600; color:#1E293B;">${record.payment_id || record_id}</td>
            </tr>
            <tr style="border-bottom:1px solid #F1F5F9;">
              <td style="padding:6px 10px; color:#64748B; font-weight:500;">{{col.description::Mô tả}}</td>
              <td style="padding:6px 10px; color:#1E293B;">${record.payment_description || '-'}</td>
            </tr>
            <tr style="border-bottom:1px solid #F1F5F9;">
              <td style="padding:6px 10px; color:#64748B; font-weight:500;">{{col.value::Số tiền}}</td>
              <td style="padding:6px 10px; font-weight:600; color:#0F766E;">${formattedValue}</td>
            </tr>
            <tr style="border-bottom:1px solid #F1F5F9;">
              <td style="padding:6px 10px; color:#64748B; font-weight:500;">{{col.counter_party::Đối tác / Người nhận}}</td>
              <td style="padding:6px 10px; color:#1E293B;">${partyName || '-'}</td>
            </tr>
            <tr style="border-bottom:1px solid #F1F5F9;">
              <td style="padding:6px 10px; color:#64748B; font-weight:500;">{{col.payment_type::Loại thanh toán}}</td>
              <td style="padding:6px 10px; color:#1E293B;">${paymentTypeLabel}</td>
            </tr>
            <tr style="border-bottom:1px solid #F1F5F9;">
              <td style="padding:6px 10px; color:#64748B; font-weight:500;">{{col.payment_term::Hạn thanh toán}}</td>
              <td style="padding:6px 10px; color:#1E293B;">${record.payment_term ? new Date(record.payment_term).toLocaleDateString('vi-VN') : '-'}</td>
            </tr>
            <tr>
              <td style="padding:6px 10px; color:#64748B; font-weight:500;">{{col.payment_method::Phương thức}}</td>
              <td style="padding:6px 10px; color:#1E293B;">${record.payment_method || '-'}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `);

    // Contract Info
    if (contractsRes && contractsRes.rows.length > 0) {
      const cRows = contractsRes.rows;
      htmlParts.push(`
        <div style="margin-bottom:12px;">
          <div style="font-weight:600; color:#334155; margin-bottom:4px; font-size:12px; text-transform:uppercase; letter-spacing:0.5px;">{{table.contract::Hợp đồng liên quan}}</div>
          <table style="width:100%; border-collapse:collapse; font-size:12px; border:1px solid #E2E8F0;">
            <thead>
              <tr style="background:#F8FAFC; border-bottom:1px solid #E2E8F0; text-align:left;">
                <th style="padding:6px 10px; font-weight:600; color:#475569;">{{col.contract_no::Số HĐ}}</th>
                <th style="padding:6px 10px; font-weight:600; color:#475569;">{{col.contract_name::Tên hợp đồng}}</th>
                <th style="padding:6px 10px; font-weight:600; color:#475569;">{{col.contractor::Đối tác}}</th>
                <th style="padding:6px 10px; font-weight:600; color:#475569; text-align:right;">{{col.value::Giá trị}}</th>
              </tr>
            </thead>
            <tbody>
      `);
      cRows.forEach(c => {
        const cVal = `${formatAmount(c.total_value)} ${resolveCurrency(c.currency)}`;
        htmlParts.push(`
          <tr style="border-bottom:1px solid #F1F5F9;">
            <td style="padding:6px 10px; font-weight:500;">${c.contractspood_no || c.contract_id}</td>
            <td style="padding:6px 10px;">${c.contract_name_or_description || '-'}</td>
            <td style="padding:6px 10px;">${c.contractor_name || c.contractor || '-'}</td>
            <td style="padding:6px 10px; text-align:right; font-weight:600;">${cVal}</td>
          </tr>
        `);
      });
      htmlParts.push(`</tbody></table></div>`);
    }

    // Invoices Info
    if (invoicesRes && invoicesRes.rows.length > 0) {
      const invRows = invoicesRes.rows;
      htmlParts.push(`
        <div style="margin-bottom:12px;">
          <div style="font-weight:600; color:#334155; margin-bottom:4px; font-size:12px; text-transform:uppercase; letter-spacing:0.5px;">{{table.invoice::Hóa đơn liên quan}}</div>
          <table style="width:100%; border-collapse:collapse; font-size:12px; border:1px solid #E2E8F0;">
            <thead>
              <tr style="background:#F8FAFC; border-bottom:1px solid #E2E8F0; text-align:left;">
                <th style="padding:6px 10px; font-weight:600; color:#475569;">{{col.invoice_no::Số HĐ/Invoice}}</th>
                <th style="padding:6px 10px; font-weight:600; color:#475569;">{{col.date::Ngày}}</th>
                <th style="padding:6px 10px; font-weight:600; color:#475569;">{{col.description::Mô tả}}</th>
                <th style="padding:6px 10px; font-weight:600; color:#475569; text-align:right;">{{col.value::Giá trị}}</th>
              </tr>
            </thead>
            <tbody>
      `);
      invRows.forEach(inv => {
        const invVal = `${formatAmount(inv.total_value)} ${resolveCurrency(inv.currency)}`;
        const invDate = inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString('vi-VN') : '-';
        htmlParts.push(`
          <tr style="border-bottom:1px solid #F1F5F9;">
            <td style="padding:6px 10px; font-weight:500;">${inv.invoice_no || inv.invoice_id}</td>
            <td style="padding:6px 10px;">${invDate}</td>
            <td style="padding:6px 10px;">${inv.description || '-'}</td>
            <td style="padding:6px 10px; text-align:right; font-weight:600;">${invVal}</td>
          </tr>
        `);
      });
      htmlParts.push(`</tbody></table></div>`);
    }

    // Other Payments under same Contract / Parent Request
    if (otherPaymentsRes && otherPaymentsRes.rows.length > 0) {
      const pRows = otherPaymentsRes.rows;
      htmlParts.push(`
        <div style="margin-bottom:12px;">
          <div style="font-weight:600; color:#334155; margin-bottom:4px; font-size:12px; text-transform:uppercase; letter-spacing:0.5px;">{{msg.payment_plan_schedule::Kế hoạch / Lịch sử thanh toán}}</div>
          <table style="width:100%; border-collapse:collapse; font-size:12px; border:1px solid #E2E8F0;">
            <thead>
              <tr style="background:#F8FAFC; border-bottom:1px solid #E2E8F0; text-align:left;">
                <th style="padding:6px 10px; font-weight:600; color:#475569;">ID</th>
                <th style="padding:6px 10px; font-weight:600; color:#475569;">{{col.description::Mô tả đợt thanh toán}}</th>
                <th style="padding:6px 10px; font-weight:600; color:#475569; text-align:right;">{{col.value::Số tiền}}</th>
                <th style="padding:6px 10px; font-weight:600; color:#475569; text-align:center;">{{col.status::Trạng thái}}</th>
              </tr>
            </thead>
            <tbody>
      `);
      pRows.forEach(p => {
        const isCurrent = (p.payment_id === record.payment_id || p.payment_id === record_id);
        const pVal = `${formatAmount(p.value)} ${resolveCurrency(p.currency)}`;
        const rowBg = isCurrent ? 'background:#F0FDFA; font-weight:600;' : 'border-bottom:1px solid #F1F5F9;';
        const currentBadge = isCurrent ? ' <span style="font-size:10px; background:#0D9488; color:#FFF; padding:1px 5px; border-radius:4px; margin-left:4px;">{{badge.current::Đang yêu cầu}}</span>' : '';
        htmlParts.push(`
          <tr style="${rowBg}">
            <td style="padding:6px 10px;">${p.payment_id}${currentBadge}</td>
            <td style="padding:6px 10px;">${p.payment_description || '-'}</td>
            <td style="padding:6px 10px; text-align:right;">${pVal}</td>
            <td style="padding:6px 10px; text-align:center; font-size:11px;">${p.payment_status || '-'}</td>
          </tr>
        `);
      });
      htmlParts.push(`</tbody></table></div>`);
    }

    // Parent Request Elements Summary
    if (rootReqRes && rootReqRes.rows.length > 0) {
      const rootR = rootReqRes.rows[0];
      let elements = [];
      try {
        if (typeof rootR.elements === 'string') elements = JSON.parse(rootR.elements);
        else if (Array.isArray(rootR.elements)) elements = rootR.elements;
      } catch (e) {}

      if (elements && elements.length > 0) {
        htmlParts.push(`
          <div style="margin-bottom:8px;">
            <div style="font-weight:600; color:#334155; margin-bottom:4px; font-size:12px; text-transform:uppercase; letter-spacing:0.5px;">{{table.elements::Hạng mục chi tiết từ Yêu cầu gốc}} (${rootR.request_id})</div>
            <table style="width:100%; border-collapse:collapse; font-size:12px; border:1px solid #E2E8F0;">
              <thead>
                <tr style="background:#F8FAFC; border-bottom:1px solid #E2E8F0; text-align:left;">
                  <th style="padding:6px 10px; font-weight:600; color:#475569;">#</th>
                  <th style="padding:6px 10px; font-weight:600; color:#475569;">{{col.type::Loại}}</th>
                  <th style="padding:6px 10px; font-weight:600; color:#475569;">{{col.name::Tên hạng mục}}</th>
                  <th style="padding:6px 10px; font-weight:600; color:#475569; text-align:right;">{{col.amount::Thành tiền}}</th>
                  <th style="padding:6px 10px; font-weight:600; color:#475569;">{{col.period::Thời gian}}</th>
                </tr>
              </thead>
              <tbody>
        `);
        elements.forEach((el, idx) => {
          const elVal = `${formatAmount(el.cost || el.total || el.unit_price || 0)} ${resolveCurrency(el.currency)}`;
          const period = (el.from && el.to) ? `${el.from} ~ ${el.to}` : (el.from || el.to || '-');
          htmlParts.push(`
            <tr style="border-bottom:1px solid #F1F5F9;">
              <td style="padding:6px 10px; color:#94A3B8;">${idx + 1}</td>
              <td style="padding:6px 10px; font-weight:500;">${el.type || el.target_table || '-'}</td>
              <td style="padding:6px 10px;">${el.name || el.description || '-'}</td>
              <td style="padding:6px 10px; text-align:right; font-weight:600;">${elVal}</td>
              <td style="padding:6px 10px; border:none;">${period}</td>
            </tr>
          `);
        });
        htmlParts.push(`</tbody></table></div>`);
      }
    }

    if (isReSubmit) {
      htmlParts.unshift(`
        <div style="font-weight:700; color:#1E293B; margin-bottom:8px; font-size:13px; display:flex; align-items:center; gap:6px;">
          <span>🔄</span> <span>{{msg.payment_request_reupdated::Cập nhật yêu cầu thanh toán (Re-submitted Payment Request)}}</span>
        </div>
      `);
    }

    const summaryCommentText = htmlParts.join('').trim();
    const commId = (typeof uuidv4 === 'function' ? uuidv4() : require('crypto').randomUUID());
    await client.query(`
      INSERT INTO "comment" ("comment_id", "request", "comment", "comment_by", "comment_date")
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
    `, [commId, targetPaymentReqId, summaryCommentText, user.employee_id || user.email || 'System']);

    try {
      broadcastSSE('db_change', {
        action: 'insert',
        table: 'comment',
        record: {
          comment_id: commId,
          request: targetPaymentReqId,
          comment: summaryCommentText,
          comment_by: user.employee_id || user.email || 'System',
          comment_date: new Date().toISOString()
        }
      });
    } catch (eCmtSse) {
      console.warn('Failed to broadcast SSE for summary comment:', eCmtSse);
    }

    try {
      const { clearUserReqIdsCache } = require('../../crud/server/crud.helpers');
      if (typeof clearUserReqIdsCache === 'function') clearUserReqIdsCache();
    } catch(e) {}
  } catch (cmtErr) {
    console.error('Failed to create root summary comment for payment request:', cmtErr);
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
