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

// Generate executive summary comment for the newly created payment request
      try {
        let rootReqRes = null;
        let contractsRes = null;
        let invoicesRes = null;
        let expensesRes = null;
        let assetsRes = null;
        let servicesRes = null;
        let otherPaymentsRes = null;

        const [mcRes, compRes, empRes] = await Promise.all([
          pool.query(`SELECT my_company_id, company_shortname, company_fullname FROM my_company`).catch(() => ({ rows: [] })),
          pool.query(`SELECT company_id, company_fullname, company_shortname FROM company`).catch(() => ({ rows: [] })),
          pool.query(`SELECT employee_id, full_name, email FROM employee`).catch(() => ({ rows: [] }))
        ]);

        const myCompMap = new Map();
        (mcRes.rows || []).forEach(r => {
          myCompMap.set(String(r.my_company_id), r.company_shortname || r.company_fullname);
        });
        const compMap = new Map();
        (compRes.rows || []).forEach(r => {
          compMap.set(String(r.company_id), r.company_fullname || r.company_shortname);
        });
        const empMap = new Map();
        (empRes.rows || []).forEach(r => {
          empMap.set(String(r.employee_id), r.full_name);
          if (r.email) empMap.set(String(r.email).toLowerCase(), r.full_name);
        });

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
              `SELECT contract_id, contractspood_no, contract_name_or_description, my_company, contract_owner, contractor, type, contract_signed_date, value_before_vat, vat_value, total_value, currency, exchance_rate, value_before_vat_in_base_currency, vat_value_in_base_currency, total_value_in_base_currency
               FROM contract
               WHERE (request = $1 OR id__request = $1 ${record.contract_id ? 'OR contract_id = $2' : ''})
                 AND deleted_at IS NULL`,
              record.contract_id ? [parentReqId, record.contract_id] : [parentReqId]
            ).catch(err => { console.warn('contracts query err:', err.message); return null; }),
            pool.query(
              `SELECT invoice_id, invoice_no, description, invoice_type, payment_method, invoice_status, invoice_date, value_before_vat, vat_value, total_value, currency, exchange_rate, value_before_vat_in_base_currency, vat_value_in_base_currency, total_value_in_base_currency
               FROM invoice
               WHERE (request = $1 OR invoice_request = $1 ${record.contract_id ? 'OR (contract_id IS NOT NULL AND contract_id = $2)' : ''})
                 AND deleted_at IS NULL`,
              record.contract_id ? [parentReqId, record.contract_id] : [parentReqId]
            ).catch(err => { console.warn('invoices query err:', err.message); return null; }),
            pool.query(
              `SELECT id, description, value_before_vat, vat_value, total_value, id__currency, exchange_rate, value_before_vat_in_base_currency, vat_value_in_base_currency, total_value_in_base_currency, id__employee, id__my_company, id__expense_type, id__expense_cost, fy
               FROM expense
               WHERE id__request = $1
                 AND deleted_at IS NULL`,
              [parentReqId]
            ).catch(err => { console.warn('expenses query err:', err.message); return null; }),
            pool.query(
              `SELECT office_asset_id, asset_name, type, status, qty, identity_number, purchase_date, purchase_cost, currency, exchange_rate, value_in_base_currency, current_owner, location, id__my_company
               FROM asset
               WHERE request = $1
                 AND deleted_at IS NULL`,
              [parentReqId]
            ).catch(err => { console.warn('assets query err:', err.message); return null; }),
            pool.query(
              `SELECT service_id, service_name, service_type, status, note, start_date, end_date, fy, my_company
               FROM service
               WHERE request = $1
                 AND deleted_at IS NULL`,
              [parentReqId]
            ).catch(err => { console.warn('services query err:', err.message); return null; }),
            pool.query(
              `SELECT payment_id, payment_period, payment_description, counter_party, company, employee, value, currency, value_in_base_currency, exchange_rate, payment_type, payment_status, due_date, payment_date, payment_method, my_company, transaction_id
               FROM payment
               WHERE request = $1 AND payment_id != $2 AND deleted_at IS NULL
               ORDER BY payment_id ASC`,
              [parentReqId, record.payment_id || record_id]
            ).catch(err => { console.warn('other payments query err:', err.message); return null; })
          ]);
        }

        const rootReq = (rootReqRes && rootReqRes.rows && rootReqRes.rows.length > 0) ? rootReqRes.rows[0] : null;
        let htmlParts = [];
        htmlParts.push(`
          <div style="font-weight:700; color:#1E293B; margin-bottom:8px; font-size:13px; text-transform:uppercase; letter-spacing:0.5px;">
            [{{msg.root_request_summary::TỔNG HỢP THÔNG TIN TỪ YÊU CẦU GỐC}}]
          </div>
        `);

        if (rootReq) {
          const reqAuthor = rootReq.requester_name || rootReq.requester || rootReq.sr_creater || '—';
          htmlParts.push(`
            <div style="margin-bottom:12px; font-size:12px; color:#475569; line-height:1.5;">
              <div><b>{{col.request_id::Mã yêu cầu}}:</b> ${rootReq.request_id} &nbsp;|&nbsp; <b>{{col.requester::Người yêu cầu}}:</b> ${reqAuthor}</div>
              ${rootReq.description ? `<div><b>{{col.description::Mô tả}}:</b> ${rootReq.description}</div>` : ''}
            </div>
          `);
        }

        // Parse rootReq elements
        let rootElements = [];
        if (rootReq && rootReq.elements) {
          if (Array.isArray(rootReq.elements)) {
            rootElements = rootReq.elements.map(e => String(e).trim().toUpperCase());
          } else if (typeof rootReq.elements === 'string') {
            rootElements = rootReq.elements.toUpperCase().split(/[,{}"]+/).map(s => s.trim()).filter(Boolean);
          }
        }

        const formatDate = (val) => {
          if (!val) return '—';
          if (val instanceof Date) return val.toISOString().split('T')[0];
          const s = String(val).trim();
          if (s.includes('T')) return s.split('T')[0];
          if (s.length >= 10 && /^\\d{4}-\\d{2}-\\d{2}/.test(s)) return s.slice(0, 10);
          return s;
        };

        const resolveCounterParty = (p) => {
          if (p.counter_party) {
            let cpType = 'company';
            let cpId = p.counter_party;
            if (typeof p.counter_party === 'object' && p.counter_party !== null) {
              cpType = p.counter_party.type || 'company';
              cpId = p.counter_party.id;
            } else {
              try {
                const parsed = JSON.parse(p.counter_party);
                if (parsed && parsed.id) {
                  cpType = parsed.type || 'company';
                  cpId = parsed.id;
                }
              } catch (e) {}
            }
            if (cpType === 'employee') {
              const eName = empMap.get(String(cpId));
              if (eName) return eName;
            } else {
              const cName = compMap.get(String(cpId));
              if (cName) return cName;
            }
            return cpId || '—';
          }
          if (p.company) {
            const cName = compMap.get(String(p.company));
            if (cName) return cName;
            return p.company;
          }
          if (p.employee) {
            const eName = empMap.get(String(p.employee));
            if (eName) return eName;
            return p.employee;
          }
          return '—';
        };

        const resolvePaymentStatusToken = (s) => {
          const map = {
            30: '{{val.draft::Bản nháp}}',
            31: '{{val.ready_for_payment::Sẵn sàng thanh toán}}',
            32: '{{val.paid::Đã thanh toán}}',
            33: '{{val.deleted::Đã xóa}}',
            121: '{{val.submitted_for_payment::Đã gửi yêu cầu thanh toán}}'
          };
          return map[s] || (s != null ? String(s) : '—');
        };

        const resolvePaymentTypeToken = (pType) => {
          if (pType === 60 || String(pType).toLowerCase() === '60' || String(pType).toLowerCase() === 'incoming') {
            return '{{val.incoming::Thu vào}}';
          }
          if (pType === 61 || String(pType).toLowerCase() === '61' || String(pType).toLowerCase() === 'outgoing') {
            return '{{val.outgoing::Chi ra}}';
          }
          return String(pType || '—');
        };

        const resolveContractTypeToken = (t) => {
          if (t === 69 || String(t) === '69' || String(t).toLowerCase() === 'selling') {
            return '{{val.selling::Bán ra}}';
          }
          if (t === 70 || String(t) === '70' || String(t).toLowerCase() === 'buying') {
            return '{{val.buying::Mua vào}}';
          }
          return String(t || '—');
        };

        const resolveInvoiceStatusToken = (s) => {
          const map = {
            34: '{{val.draft::Bản nháp}}',
            36: '{{val.issued::Đã phát hành}}',
            37: '{{val.paid::Đã thanh toán}}',
            38: '{{val.void::Đã hủy}}'
          };
          return map[s] || (s != null ? String(s) : '—');
        };

        const resolveExpenseTypeToken = (t) => {
          if (t === 71 || String(t) === '71' || String(t).toUpperCase() === 'CAPEX') return 'CAPEX';
          if (t === 72 || String(t) === '72' || String(t).toUpperCase() === 'OPEX') return 'OPEX';
          return String(t || '—');
        };

        const resolveAssetStatusToken = (s) => {
          const map = {
            21: '{{val.draft::Bản nháp}}',
            22: '{{val.pending::Đang chờ}}',
            23: '{{val.in_progress::Đang xử lý}}',
            24: '{{val.approved::Đã phê duyệt}}',
            25: '{{val.completed::Hoàn thành}}'
          };
          return map[s] || (s != null ? String(s) : '—');
        };

        const resolveServiceStatusToken = (s) => {
          const map = {
            26: '{{val.draft::Bản nháp}}',
            27: '{{val.pending::Đang chờ}}',
            28: '{{val.in_progress::Đang xử lý}}',
            29: '{{val.completed::Hoàn thành}}'
          };
          return map[s] || (s != null ? String(s) : '—');
        };

        // 1. Payments Table (Columns matching payment table view config)
        htmlParts.push(`
          <div style="font-weight:600; color:#0F172A; font-size:12px; margin-top:10px; margin-bottom:4px;">
            {{col.payment::Khoản thanh toán}}:
          </div>
          <div style="width:100%; overflow-x:auto; -webkit-overflow-scrolling:touch; margin-bottom:12px;">
            <table style="width:100%; min-width:1100px; border-collapse:collapse; border:none; font-size:12px; background:transparent;">
              <thead>
                <tr style="border-bottom:2px solid #E2E8F0; background:#F8FAFC; color:#64748B; font-weight:600; text-align:left;">
                  <th style="padding:6px 10px; border:none; white-space:nowrap;">{{col.period::Period}}</th>
                  <th style="padding:6px 10px; border:none;">{{col.description::Description}}</th>
                  <th style="padding:6px 10px; border:none;">{{col.pay_to_from::Pay to / Pay from}}</th>
                  <th style="padding:6px 10px; border:none; text-align:right; white-space:nowrap;">{{col.value::Value}}</th>
                  <th style="padding:6px 10px; border:none; text-align:center;">{{col.currency::Currency}}</th>
                  <th style="padding:6px 10px; border:none; text-align:right; white-space:nowrap;">{{col.value_in_base_currency::Value in VND}}</th>
                  <th style="padding:6px 10px; border:none; text-align:right; white-space:nowrap;">{{col.exchange_rate::Exchange Rate}}</th>
                  <th style="padding:6px 10px; border:none; white-space:nowrap;">{{col.payment_type::Payment Type}}</th>
                  <th style="padding:6px 10px; border:none; white-space:nowrap;">{{col.payment_status::Payment Status}}</th>
                  <th style="padding:6px 10px; border:none; white-space:nowrap;">{{col.due_date::Due Date}}</th>
                  <th style="padding:6px 10px; border:none; white-space:nowrap;">{{col.payment_date::Payment Date}}</th>
                  <th style="padding:6px 10px; border:none; white-space:nowrap;">{{col.payment_method::Payment Method}}</th>
                  <th style="padding:6px 10px; border:none;">{{col.my_company::My Company}}</th>
                  <th style="padding:6px 10px; border:none; white-space:nowrap;">{{col.transaction_id::Transaction ID}}</th>
                </tr>
              </thead>
              <tbody>
                <!-- Highlighted Current Record in subtle light gray -->
                <tr style="background:#F1F5F9; border-bottom:1px solid #E2E8F0; font-weight:600; color:#1E293B;">
                  <td style="padding:7px 10px; border:none; white-space:nowrap;">
                    ${record.payment_period != null ? record.payment_period : '—'}
                    <span style="display:inline-block; margin-left:4px; padding:1px 5px; font-size:10px; font-weight:600; color:#475569; background:#E2E8F0; border-radius:4px;">{{msg.current_proposal::Current}}</span>
                  </td>
                  <td style="padding:7px 10px; border:none;">${record.payment_description || '—'}</td>
                  <td style="padding:7px 10px; border:none;">${partyName || resolveCounterParty(record)}</td>
                  <td style="padding:7px 10px; border:none; text-align:right; white-space:nowrap;">${formatAmount(record.value || 0)}</td>
                  <td style="padding:7px 10px; border:none; text-align:center;">${resolveCurrency(record.currency)}</td>
                  <td style="padding:7px 10px; border:none; text-align:right; white-space:nowrap;">${formatAmount(record.value_in_base_currency || 0)}</td>
                  <td style="padding:7px 10px; border:none; text-align:right; white-space:nowrap;">${record.exchange_rate != null ? formatAmount(record.exchange_rate) : '—'}</td>
                  <td style="padding:7px 10px; border:none; white-space:nowrap;">${resolvePaymentTypeToken(record.payment_type)}</td>
                  <td style="padding:7px 10px; border:none; white-space:nowrap;">{{val.submitted_for_payment::Đã gửi yêu cầu thanh toán}}</td>
                  <td style="padding:7px 10px; border:none; white-space:nowrap;">${formatDate(record.due_date)}</td>
                  <td style="padding:7px 10px; border:none; white-space:nowrap;">${formatDate(record.payment_date)}</td>
                  <td style="padding:7px 10px; border:none; white-space:nowrap;">${record.payment_method || '—'}</td>
                  <td style="padding:7px 10px; border:none;">${myCompMap.get(String(record.my_company)) || record.my_company || '—'}</td>
                  <td style="padding:7px 10px; border:none; white-space:nowrap;">${record.transaction_id || '—'}</td>
                </tr>
        `);

        if (otherPaymentsRes && otherPaymentsRes.rows && otherPaymentsRes.rows.length > 0) {
          otherPaymentsRes.rows.forEach(p => {
            htmlParts.push(`
              <tr style="border-bottom:1px solid #F1F5F9; color:#334155;">
                <td style="padding:6px 10px; border:none; white-space:nowrap;">${p.payment_period != null ? p.payment_period : '—'}</td>
                <td style="padding:6px 10px; border:none;">${p.payment_description || '—'}</td>
                <td style="padding:6px 10px; border:none;">${resolveCounterParty(p)}</td>
                <td style="padding:6px 10px; border:none; text-align:right; white-space:nowrap;">${formatAmount(p.value || 0)}</td>
                <td style="padding:6px 10px; border:none; text-align:center;">${resolveCurrency(p.currency)}</td>
                <td style="padding:6px 10px; border:none; text-align:right; white-space:nowrap;">${formatAmount(p.value_in_base_currency || 0)}</td>
                <td style="padding:6px 10px; border:none; text-align:right; white-space:nowrap;">${p.exchange_rate != null ? formatAmount(p.exchange_rate) : '—'}</td>
                <td style="padding:6px 10px; border:none; white-space:nowrap;">${resolvePaymentTypeToken(p.payment_type)}</td>
                <td style="padding:6px 10px; border:none; white-space:nowrap;">${resolvePaymentStatusToken(p.payment_status)}</td>
                <td style="padding:6px 10px; border:none; white-space:nowrap;">${formatDate(p.due_date)}</td>
                <td style="padding:6px 10px; border:none; white-space:nowrap;">${formatDate(p.payment_date)}</td>
                <td style="padding:6px 10px; border:none; white-space:nowrap;">${p.payment_method || '—'}</td>
                <td style="padding:6px 10px; border:none;">${myCompMap.get(String(p.my_company)) || p.my_company || '—'}</td>
                <td style="padding:6px 10px; border:none; white-space:nowrap;">${p.transaction_id || '—'}</td>
              </tr>
            `);
          });
        }
        htmlParts.push(`</tbody></table></div>`);

        // 2. Contracts Table (Columns matching contract table view config)
        const hasContracts = contractsRes && contractsRes.rows && contractsRes.rows.length > 0;
        const showContracts = hasContracts || rootElements.includes('CONTRACT');
        if (showContracts) {
          if (!hasContracts) {
            htmlParts.push(`
              <div style="font-weight:600; color:#0F172A; font-size:12px; margin-top:10px; margin-bottom:4px;">
                {{col.contract::Hợp đồng}} (0): <span style="font-weight:400; color:#94A3B8; font-style:italic; font-size:11px;">{{msg.no_data::Không có dữ liệu}}</span>
              </div>
            `);
          } else {
            htmlParts.push(`
              <div style="font-weight:600; color:#0F172A; font-size:12px; margin-top:10px; margin-bottom:4px;">
                {{col.contract::Hợp đồng}} (${contractsRes.rows.length}):
              </div>
              <div style="width:100%; overflow-x:auto; -webkit-overflow-scrolling:touch; margin-bottom:12px;">
                <table style="width:100%; min-width:1200px; border-collapse:collapse; border:none; font-size:12px; background:transparent;">
                  <thead>
                    <tr style="border-bottom:2px solid #E2E8F0; background:#F8FAFC; color:#64748B; font-weight:600; text-align:left;">
                      <th style="padding:6px 10px; border:none;">{{col.contract_name_or_description::Contract Name}}</th>
                      <th style="padding:6px 10px; border:none; white-space:nowrap;">{{col.contractspood_no::Contracts/PO/OD No}}</th>
                      <th style="padding:6px 10px; border:none;">{{col.my_company::My Company}}</th>
                      <th style="padding:6px 10px; border:none;">{{col.contract_owner::Contract Owner}}</th>
                      <th style="padding:6px 10px; border:none;">{{col.contractor::Contractor}}</th>
                      <th style="padding:6px 10px; border:none; white-space:nowrap;">{{col.contract_type::Type}}</th>
                      <th style="padding:6px 10px; border:none; white-space:nowrap;">{{col.contract_signed_date::Contract Signed Date}}</th>
                      <th style="padding:6px 10px; border:none; text-align:right; white-space:nowrap;">{{col.value_before_vat::Value Before VAT}}</th>
                      <th style="padding:6px 10px; border:none; text-align:right; white-space:nowrap;">{{col.vat_value::VAT Value}}</th>
                      <th style="padding:6px 10px; border:none; text-align:right; white-space:nowrap;">{{col.total_value::Total Value}}</th>
                      <th style="padding:6px 10px; border:none; text-align:center;">{{col.currency::Currency}}</th>
                      <th style="padding:6px 10px; border:none; text-align:right; white-space:nowrap;">{{col.exchange_rate::Exchange Rate}}</th>
                      <th style="padding:6px 10px; border:none; text-align:right; white-space:nowrap;">{{col.value_before_vat_in_base_currency::Value Before VAT in Base Currency}}</th>
                      <th style="padding:6px 10px; border:none; text-align:right; white-space:nowrap;">{{col.vat_value_in_base_currency::VAT Value in Base Currency}}</th>
                      <th style="padding:6px 10px; border:none; text-align:right; white-space:nowrap;">{{col.total_value_in_base_currency::Total Value in Base Currency}}</th>
                    </tr>
                  </thead>
                  <tbody>
            `);
            contractsRes.rows.forEach(c => {
              htmlParts.push(`
                <tr style="border-bottom:1px solid #F1F5F9; color:#334155;">
                  <td style="padding:6px 10px; border:none;">${c.contract_name_or_description || c.contract_id || '—'}</td>
                  <td style="padding:6px 10px; border:none; white-space:nowrap;">${c.contractspood_no || '—'}</td>
                  <td style="padding:6px 10px; border:none;">${myCompMap.get(String(c.my_company)) || c.my_company || '—'}</td>
                  <td style="padding:6px 10px; border:none;">${empMap.get(String(c.contract_owner)) || c.contract_owner || '—'}</td>
                  <td style="padding:6px 10px; border:none;">${compMap.get(String(c.contractor)) || c.contractor || '—'}</td>
                  <td style="padding:6px 10px; border:none; white-space:nowrap;">${resolveContractTypeToken(c.type)}</td>
                  <td style="padding:6px 10px; border:none; white-space:nowrap;">${formatDate(c.contract_signed_date)}</td>
                  <td style="padding:6px 10px; border:none; text-align:right; white-space:nowrap;">${c.value_before_vat != null ? formatAmount(c.value_before_vat) : '—'}</td>
                  <td style="padding:6px 10px; border:none; text-align:right; white-space:nowrap;">${c.vat_value != null ? formatAmount(c.vat_value) : '—'}</td>
                  <td style="padding:6px 10px; border:none; text-align:right; white-space:nowrap;">${c.total_value != null ? formatAmount(c.total_value) : '—'}</td>
                  <td style="padding:6px 10px; border:none; text-align:center;">${resolveCurrency(c.currency)}</td>
                  <td style="padding:6px 10px; border:none; text-align:right; white-space:nowrap;">${c.exchance_rate != null ? formatAmount(c.exchance_rate) : '—'}</td>
                  <td style="padding:6px 10px; border:none; text-align:right; white-space:nowrap;">${c.value_before_vat_in_base_currency != null ? formatAmount(c.value_before_vat_in_base_currency) : '—'}</td>
                  <td style="padding:6px 10px; border:none; text-align:right; white-space:nowrap;">${c.vat_value_in_base_currency != null ? formatAmount(c.vat_value_in_base_currency) : '—'}</td>
                  <td style="padding:6px 10px; border:none; text-align:right; white-space:nowrap;">${c.total_value_in_base_currency != null ? formatAmount(c.total_value_in_base_currency) : '—'}</td>
                </tr>
              `);
            });
            htmlParts.push(`</tbody></table></div>`);
          }
        }

        // 3. Invoices Table (Columns matching invoice table view config)
        const hasInvoices = invoicesRes && invoicesRes.rows && invoicesRes.rows.length > 0;
        const showInvoices = hasInvoices || rootElements.includes('INVOICE');
        if (showInvoices) {
          if (!hasInvoices) {
            htmlParts.push(`
              <div style="font-weight:600; color:#0F172A; font-size:12px; margin-top:10px; margin-bottom:4px;">
                {{col.invoice::Hóa đơn}} (0): <span style="font-weight:400; color:#94A3B8; font-style:italic; font-size:11px;">{{msg.no_data::Không có dữ liệu}}</span>
              </div>
            `);
          } else {
            htmlParts.push(`
              <div style="font-weight:600; color:#0F172A; font-size:12px; margin-top:10px; margin-bottom:4px;">
                {{col.invoice::Hóa đơn}} (${invoicesRes.rows.length}):
              </div>
              <div style="width:100%; overflow-x:auto; -webkit-overflow-scrolling:touch; margin-bottom:12px;">
                <table style="width:100%; min-width:1150px; border-collapse:collapse; border:none; font-size:12px; background:transparent;">
                  <thead>
                    <tr style="border-bottom:2px solid #E2E8F0; background:#F8FAFC; color:#64748B; font-weight:600; text-align:left;">
                      <th style="padding:6px 10px; border:none; white-space:nowrap;">{{col.invoice_no::Invoice No.}}</th>
                      <th style="padding:6px 10px; border:none;">{{col.description::Description}}</th>
                      <th style="padding:6px 10px; border:none; white-space:nowrap;">{{col.invoice_type::Type}}</th>
                      <th style="padding:6px 10px; border:none; white-space:nowrap;">{{col.payment_method::Payment Method}}</th>
                      <th style="padding:6px 10px; border:none; white-space:nowrap;">{{col.invoice_status::Invoice Status}}</th>
                      <th style="padding:6px 10px; border:none; white-space:nowrap;">{{col.invoice_date::Sent or Received Date}}</th>
                      <th style="padding:6px 10px; border:none; text-align:right; white-space:nowrap;">{{col.value_before_vat::Value Before VAT}}</th>
                      <th style="padding:6px 10px; border:none; text-align:right; white-space:nowrap;">{{col.vat_value::VAT Value}}</th>
                      <th style="padding:6px 10px; border:none; text-align:right; white-space:nowrap;">{{col.total_value::Total Value}}</th>
                      <th style="padding:6px 10px; border:none; text-align:center;">{{col.currency::Currency}}</th>
                      <th style="padding:6px 10px; border:none; text-align:right; white-space:nowrap;">{{col.exchange_rate::Exchange Rate}}</th>
                      <th style="padding:6px 10px; border:none; text-align:right; white-space:nowrap;">{{col.value_before_vat_in_base_currency::Value Before VAT in Base Currency}}</th>
                      <th style="padding:6px 10px; border:none; text-align:right; white-space:nowrap;">{{col.vat_value_in_base_currency::VAT Value in Base Currency}}</th>
                      <th style="padding:6px 10px; border:none; text-align:right; white-space:nowrap;">{{col.total_value_in_base_currency::Total Value in Base Currency}}</th>
                    </tr>
                  </thead>
                  <tbody>
            `);
            invoicesRes.rows.forEach(inv => {
              htmlParts.push(`
                <tr style="border-bottom:1px solid #F1F5F9; color:#334155;">
                  <td style="padding:6px 10px; border:none; white-space:nowrap;">${inv.invoice_no || inv.invoice_id || '—'}</td>
                  <td style="padding:6px 10px; border:none;">${inv.description || '—'}</td>
                  <td style="padding:6px 10px; border:none; white-space:nowrap;">${inv.invoice_type || '—'}</td>
                  <td style="padding:6px 10px; border:none; white-space:nowrap;">${inv.payment_method || '—'}</td>
                  <td style="padding:6px 10px; border:none; white-space:nowrap;">${resolveInvoiceStatusToken(inv.invoice_status)}</td>
                  <td style="padding:6px 10px; border:none; white-space:nowrap;">${formatDate(inv.invoice_date)}</td>
                  <td style="padding:6px 10px; border:none; text-align:right; white-space:nowrap;">${inv.value_before_vat != null ? formatAmount(inv.value_before_vat) : '—'}</td>
                  <td style="padding:6px 10px; border:none; text-align:right; white-space:nowrap;">${inv.vat_value != null ? formatAmount(inv.vat_value) : '—'}</td>
                  <td style="padding:6px 10px; border:none; text-align:right; white-space:nowrap;">${inv.total_value != null ? formatAmount(inv.total_value) : '—'}</td>
                  <td style="padding:6px 10px; border:none; text-align:center;">${resolveCurrency(inv.currency)}</td>
                  <td style="padding:6px 10px; border:none; text-align:right; white-space:nowrap;">${inv.exchange_rate != null ? formatAmount(inv.exchange_rate) : '—'}</td>
                  <td style="padding:6px 10px; border:none; text-align:right; white-space:nowrap;">${inv.value_before_vat_in_base_currency != null ? formatAmount(inv.value_before_vat_in_base_currency) : '—'}</td>
                  <td style="padding:6px 10px; border:none; text-align:right; white-space:nowrap;">${inv.vat_value_in_base_currency != null ? formatAmount(inv.vat_value_in_base_currency) : '—'}</td>
                  <td style="padding:6px 10px; border:none; text-align:right; white-space:nowrap;">${inv.total_value_in_base_currency != null ? formatAmount(inv.total_value_in_base_currency) : '—'}</td>
                </tr>
              `);
            });
            htmlParts.push(`</tbody></table></div>`);
          }
        }

        // 4. Expenses Table (Columns matching expense table view config)
        const hasExpenses = expensesRes && expensesRes.rows && expensesRes.rows.length > 0;
        const showExpenses = hasExpenses || rootElements.includes('EXPENSE');
        if (showExpenses) {
          if (!hasExpenses) {
            htmlParts.push(`
              <div style="font-weight:600; color:#0F172A; font-size:12px; margin-top:10px; margin-bottom:4px;">
                {{col.expense::Chi phí}} (0): <span style="font-weight:400; color:#94A3B8; font-style:italic; font-size:11px;">{{msg.no_data::Không có dữ liệu}}</span>
              </div>
            `);
          } else {
            htmlParts.push(`
              <div style="font-weight:600; color:#0F172A; font-size:12px; margin-top:10px; margin-bottom:4px;">
                {{col.expense::Chi phí}} (${expensesRes.rows.length}):
              </div>
              <div style="width:100%; overflow-x:auto; -webkit-overflow-scrolling:touch; margin-bottom:12px;">
                <table style="width:100%; min-width:1200px; border-collapse:collapse; border:none; font-size:12px; background:transparent;">
                  <thead>
                    <tr style="border-bottom:2px solid #E2E8F0; background:#F8FAFC; color:#64748B; font-weight:600; text-align:left;">
                      <th style="padding:6px 10px; border:none;">{{col.description::Description}}</th>
                      <th style="padding:6px 10px; border:none; text-align:right; white-space:nowrap;">{{col.value_before_vat::Value Before VAT}}</th>
                      <th style="padding:6px 10px; border:none; text-align:right; white-space:nowrap;">{{col.vat_value::VAT Value}}</th>
                      <th style="padding:6px 10px; border:none; text-align:right; white-space:nowrap;">{{col.total_value::Total Value}}</th>
                      <th style="padding:6px 10px; border:none; text-align:center;">{{col.currency::Currency}}</th>
                      <th style="padding:6px 10px; border:none; text-align:right; white-space:nowrap;">{{col.exchange_rate::Exchange Rate}}</th>
                      <th style="padding:6px 10px; border:none; text-align:right; white-space:nowrap;">{{col.value_before_vat_in_base_currency::Value Before VAT in Base Currency}}</th>
                      <th style="padding:6px 10px; border:none; text-align:right; white-space:nowrap;">{{col.vat_value_in_base_currency::VAT Value in Base Currency}}</th>
                      <th style="padding:6px 10px; border:none; text-align:right; white-space:nowrap;">{{col.total_value_in_base_currency::Total Value in Base Currency}}</th>
                      <th style="padding:6px 10px; border:none;">{{col.employee::Employee}}</th>
                      <th style="padding:6px 10px; border:none;">{{col.my_company::My Company}}</th>
                      <th style="padding:6px 10px; border:none; white-space:nowrap;">{{col.id__expense_type::Expense Type}}</th>
                      <th style="padding:6px 10px; border:none;">{{col.id__expense_cost::Expense Cost}}</th>
                      <th style="padding:6px 10px; border:none; white-space:nowrap;">{{col.fy::Fiscal Year}}</th>
                    </tr>
                  </thead>
                  <tbody>
            `);
            expensesRes.rows.forEach(exp => {
              htmlParts.push(`
                <tr style="border-bottom:1px solid #F1F5F9; color:#334155;">
                  <td style="padding:6px 10px; border:none;">${exp.description || '—'}</td>
                  <td style="padding:6px 10px; border:none; text-align:right; white-space:nowrap;">${exp.value_before_vat != null ? formatAmount(exp.value_before_vat) : '—'}</td>
                  <td style="padding:6px 10px; border:none; text-align:right; white-space:nowrap;">${exp.vat_value != null ? formatAmount(exp.vat_value) : '—'}</td>
                  <td style="padding:6px 10px; border:none; text-align:right; white-space:nowrap;">${exp.total_value != null ? formatAmount(exp.total_value) : '—'}</td>
                  <td style="padding:6px 10px; border:none; text-align:center;">${resolveCurrency(exp.id__currency)}</td>
                  <td style="padding:6px 10px; border:none; text-align:right; white-space:nowrap;">${exp.exchange_rate != null ? formatAmount(exp.exchange_rate) : '—'}</td>
                  <td style="padding:6px 10px; border:none; text-align:right; white-space:nowrap;">${exp.value_before_vat_in_base_currency != null ? formatAmount(exp.value_before_vat_in_base_currency) : '—'}</td>
                  <td style="padding:6px 10px; border:none; text-align:right; white-space:nowrap;">${exp.vat_value_in_base_currency != null ? formatAmount(exp.vat_value_in_base_currency) : '—'}</td>
                  <td style="padding:6px 10px; border:none; text-align:right; white-space:nowrap;">${exp.total_value_in_base_currency != null ? formatAmount(exp.total_value_in_base_currency) : '—'}</td>
                  <td style="padding:6px 10px; border:none;">${empMap.get(String(exp.id__employee)) || exp.id__employee || '—'}</td>
                  <td style="padding:6px 10px; border:none;">${myCompMap.get(String(exp.id__my_company)) || exp.id__my_company || '—'}</td>
                  <td style="padding:6px 10px; border:none; white-space:nowrap;">${resolveExpenseTypeToken(exp.id__expense_type)}</td>
                  <td style="padding:6px 10px; border:none;">${exp.id__expense_cost || '—'}</td>
                  <td style="padding:6px 10px; border:none; white-space:nowrap;">${exp.fy || '—'}</td>
                </tr>
              `);
            });
            htmlParts.push(`</tbody></table></div>`);
          }
        }

        // 5. Assets Table (Columns matching asset table view config)
        const hasAssets = assetsRes && assetsRes.rows && assetsRes.rows.length > 0;
        const showAssets = hasAssets || rootElements.includes('ASSET') || rootElements.includes('DEVICE AND ASSET');
        if (showAssets) {
          if (!hasAssets) {
            htmlParts.push(`
              <div style="font-weight:600; color:#0F172A; font-size:12px; margin-top:10px; margin-bottom:4px;">
                {{col.asset::Tài sản}} (0): <span style="font-weight:400; color:#94A3B8; font-style:italic; font-size:11px;">{{msg.no_data::Không có dữ liệu}}</span>
              </div>
            `);
          } else {
            htmlParts.push(`
              <div style="font-weight:600; color:#0F172A; font-size:12px; margin-top:10px; margin-bottom:4px;">
                {{col.asset::Tài sản}} (${assetsRes.rows.length}):
              </div>
              <div style="width:100%; overflow-x:auto; -webkit-overflow-scrolling:touch; margin-bottom:12px;">
                <table style="width:100%; min-width:1150px; border-collapse:collapse; border:none; font-size:12px; background:transparent;">
                  <thead>
                    <tr style="border-bottom:2px solid #E2E8F0; background:#F8FAFC; color:#64748B; font-weight:600; text-align:left;">
                      <th style="padding:6px 10px; border:none;">{{col.asset_name::Asset Name}}</th>
                      <th style="padding:6px 10px; border:none; white-space:nowrap;">{{col.type::Type}}</th>
                      <th style="padding:6px 10px; border:none; white-space:nowrap;">{{col.status::Status}}</th>
                      <th style="padding:6px 10px; border:none; text-align:center; white-space:nowrap;">{{col.qty::Qty}}</th>
                      <th style="padding:6px 10px; border:none; white-space:nowrap;">{{col.identity_number::Identity Number}}</th>
                      <th style="padding:6px 10px; border:none; white-space:nowrap;">{{col.purchase_date::Purchase Date}}</th>
                      <th style="padding:6px 10px; border:none; text-align:right; white-space:nowrap;">{{col.purchase_cost::Purchase Cost}}</th>
                      <th style="padding:6px 10px; border:none; text-align:center;">{{col.currency::Currency}}</th>
                      <th style="padding:6px 10px; border:none; text-align:right; white-space:nowrap;">{{col.exchange_rate::Exchange Rate}}</th>
                      <th style="padding:6px 10px; border:none; text-align:right; white-space:nowrap;">{{col.asset_value_in_base_currency::Purchase Cost in Base Currency}}</th>
                      <th style="padding:6px 10px; border:none;">{{col.current_owner::Current Owner}}</th>
                      <th style="padding:6px 10px; border:none;">{{col.location::Location}}</th>
                      <th style="padding:6px 10px; border:none;">{{col.my_company::My Company}}</th>
                    </tr>
                  </thead>
                  <tbody>
            `);
            assetsRes.rows.forEach(a => {
              htmlParts.push(`
                <tr style="border-bottom:1px solid #F1F5F9; color:#334155;">
                  <td style="padding:6px 10px; border:none;">${a.office_asset_id ? `[${a.office_asset_id}] ` : ''}${a.asset_name || '—'}</td>
                  <td style="padding:6px 10px; border:none; white-space:nowrap;">${a.type || '—'}</td>
                  <td style="padding:6px 10px; border:none; white-space:nowrap;">${resolveAssetStatusToken(a.status)}</td>
                  <td style="padding:6px 10px; border:none; text-align:center; white-space:nowrap;">${a.qty != null ? a.qty : '—'}</td>
                  <td style="padding:6px 10px; border:none; white-space:nowrap;">${a.identity_number || '—'}</td>
                  <td style="padding:6px 10px; border:none; white-space:nowrap;">${formatDate(a.purchase_date)}</td>
                  <td style="padding:6px 10px; border:none; text-align:right; white-space:nowrap;">${a.purchase_cost != null ? formatAmount(a.purchase_cost) : '—'}</td>
                  <td style="padding:6px 10px; border:none; text-align:center;">${resolveCurrency(a.currency)}</td>
                  <td style="padding:6px 10px; border:none; text-align:right; white-space:nowrap;">${a.exchange_rate != null ? formatAmount(a.exchange_rate) : '—'}</td>
                  <td style="padding:6px 10px; border:none; text-align:right; white-space:nowrap;">${a.value_in_base_currency != null ? formatAmount(a.value_in_base_currency) : '—'}</td>
                  <td style="padding:6px 10px; border:none;">${empMap.get(String(a.current_owner)) || a.current_owner || '—'}</td>
                  <td style="padding:6px 10px; border:none;">${a.location || '—'}</td>
                  <td style="padding:6px 10px; border:none;">${myCompMap.get(String(a.id__my_company)) || a.id__my_company || '—'}</td>
                </tr>
              `);
            });
            htmlParts.push(`</tbody></table></div>`);
          }
        }

        // 6. Services Table (Columns matching service table view config)
        const hasServices = servicesRes && servicesRes.rows && servicesRes.rows.length > 0;
        const showServices = hasServices || rootElements.includes('SERVICE');
        if (showServices) {
          if (!hasServices) {
            htmlParts.push(`
              <div style="font-weight:600; color:#0F172A; font-size:12px; margin-top:10px; margin-bottom:4px;">
                {{col.service::Dịch vụ}} (0): <span style="font-weight:400; color:#94A3B8; font-style:italic; font-size:11px;">{{msg.no_data::Không có dữ liệu}}</span>
              </div>
            `);
          } else {
            htmlParts.push(`
              <div style="font-weight:600; color:#0F172A; font-size:12px; margin-top:10px; margin-bottom:4px;">
                {{col.service::Dịch vụ}} (${servicesRes.rows.length}):
              </div>
              <div style="width:100%; overflow-x:auto; -webkit-overflow-scrolling:touch; margin-bottom:12px;">
                <table style="width:100%; min-width:850px; border-collapse:collapse; border:none; font-size:12px; background:transparent;">
                  <thead>
                    <tr style="border-bottom:2px solid #E2E8F0; background:#F8FAFC; color:#64748B; font-weight:600; text-align:left;">
                      <th style="padding:6px 10px; border:none;">{{col.service_name::Service Name}}</th>
                      <th style="padding:6px 10px; border:none; white-space:nowrap;">{{col.service_id::Service Code}}</th>
                      <th style="padding:6px 10px; border:none; white-space:nowrap;">{{col.service_type::Type}}</th>
                      <th style="padding:6px 10px; border:none; white-space:nowrap;">{{col.status::Status}}</th>
                      <th style="padding:6px 10px; border:none;">{{col.note::Note}}</th>
                      <th style="padding:6px 10px; border:none; white-space:nowrap;">{{col.start_date::Start Date}}</th>
                      <th style="padding:6px 10px; border:none; white-space:nowrap;">{{col.end_date::End Date}}</th>
                      <th style="padding:6px 10px; border:none; white-space:nowrap;">{{col.fy::Fiscal Year}}</th>
                      <th style="padding:6px 10px; border:none;">{{col.my_company::My Company}}</th>
                    </tr>
                  </thead>
                  <tbody>
            `);
            servicesRes.rows.forEach(s => {
              htmlParts.push(`
                <tr style="border-bottom:1px solid #F1F5F9; color:#334155;">
                  <td style="padding:6px 10px; border:none;">${s.service_name || '—'}</td>
                  <td style="padding:6px 10px; border:none; white-space:nowrap;">${s.service_id || '—'}</td>
                  <td style="padding:6px 10px; border:none; white-space:nowrap;">${s.service_type || '—'}</td>
                  <td style="padding:6px 10px; border:none; white-space:nowrap;">${resolveServiceStatusToken(s.status)}</td>
                  <td style="padding:6px 10px; border:none;">${s.note || '—'}</td>
                  <td style="padding:6px 10px; border:none; white-space:nowrap;">${formatDate(s.start_date)}</td>
                  <td style="padding:6px 10px; border:none; white-space:nowrap;">${formatDate(s.end_date)}</td>
                  <td style="padding:6px 10px; border:none; white-space:nowrap;">${s.fy || '—'}</td>
                  <td style="padding:6px 10px; border:none;">${myCompMap.get(String(s.my_company)) || s.my_company || '—'}</td>
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
