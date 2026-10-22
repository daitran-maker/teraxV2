// Service Delivery Contract (SDC) approval flow.
//  - action `sdc_submit`  : Draft -> creates/re-uses an RSDC_service_delivery request (+ executive summary comment)
//  - request hooks        : keep SDC status in sync with the approval request (submit / withdraw / approve / reject / cancel)
//  - syncSdcRunningStatuses: daily job that derives running status from start/end date after approval
const crypto = require('crypto');
const pool = require('../../../server/db');
const RequestModel = require('../../../server/models/requestModel');
const { broadcastSSE } = require('../../../server/helpers/sseHelper');
const {
  SDC_APPROVAL_PROCESS_ID,
  SDC_STATUS,
  AUTO_RUNNING_STATUSES,
  computeRunningStatus
} = require('./service_delivery.constants');

const isSdcApprovalRequest = (request) =>
  !!request && String(request.request_type || '') === SDC_APPROVAL_PROCESS_ID;

const esc = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const fmtDate = (val) => {
  if (!val) return '—';
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(val).trim();
  return s.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : s;
};

const fmtAmount = (val) => {
  if (val === null || val === undefined || val === '') return '—';
  const num = parseFloat(String(val).replace(/,/g, ''));
  return isNaN(num) ? String(val) : num.toLocaleString('en-US');
};

const STATUS_TOKENS = {
  1: '{{val.not_started_yet::Chưa bắt đầu}}',
  2: '{{val.on_going::Đang thực hiện}}',
  3: '{{val.going_to_expire::Sắp hết hạn}}',
  4: '{{val.completed::Hoàn thành}}',
  5: '{{val.expired::Đã hết hạn}}',
  6: '{{val.no_task_created::Chưa tạo task}}',
  7: '{{val.canceled::Đã hủy}}',
  10: '{{val.draft::Bản nháp}}',
  11: '{{val.waiting_for_approval::Chờ phê duyệt}}',
  22: '{{val.on_hold::Tạm dừng}}'
};

function appendLog(action, user) {
  return JSON.stringify([{
    timestamp: new Date().toISOString(),
    user: (user && (user.employee_id || user.email)) || 'system',
    action
  }]);
}

function safeBroadcast(payload) {
  try { broadcastSSE('db_change', payload); } catch (e) { /* non-blocking */ }
}

function clearReqCache() {
  try {
    const { clearUserReqIdsCache } = require('../../crud/server/crud.helpers');
    if (typeof clearUserReqIdsCache === 'function') clearUserReqIdsCache();
  } catch (e) { /* non-blocking */ }
}

/** Root request of a SDC: id__service_request, else the request that owns its opportunity. */
async function resolveRootRequestId(db, sdc) {
  if (sdc.id__service_request) return sdc.id__service_request;
  if (sdc.project) {
    try {
      const r = await db.query('SELECT id__request FROM oppotunity WHERE project_id::text = $1', [String(sdc.project)]);
      if (r.rows.length > 0 && r.rows[0].id__request) return r.rows[0].id__request;
    } catch (e) { /* ignore */ }
  }
  return null;
}

/**
 * SDC has no `request` column; expose its root request as `record.request` so that
 * action roles such as [request.sr_owner] / [request.policy_lead] resolve against the root request.
 */
async function attachRootRequest(db, record) {
  if (!record || record.request) return record;
  record.request = await resolveRootRequestId(db, record);
  return record;
}

async function nextRequestId(client, user) {
  await client.query('LOCK TABLE request IN SHARE ROW EXCLUSIVE MODE');
  const now = new Date();
  const dateStr = `${String(now.getUTCDate()).padStart(2, '0')}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCFullYear()).slice(-2)}`;
  const email = (user && (user.email || user.employee_id)) || '';
  const prefixEmail = email.includes('@') ? email.split('@')[0] : email;
  const initials = prefixEmail.slice(0, 2).toUpperCase() || 'XX';
  const prefix = `${SDC_APPROVAL_PROCESS_ID}-${dateStr}-${initials}-`;
  const seqRes = await client.query('SELECT request_id FROM request WHERE request_id LIKE $1', [`${prefix}%`]);
  let maxSeq = 0;
  seqRes.rows.forEach((row) => {
    const n = parseInt(row.request_id.split('-').pop(), 10);
    if (!isNaN(n) && n > maxSeq) maxSeq = n;
  });
  return `${prefix}${maxSeq + 1}`;
}

async function buildSummaryHtml({ sdc, rootRequestId, isReSubmit }) {
  const [empRes, compRes, catRes] = await Promise.all([
    pool.query('SELECT employee_id, full_name, email FROM employee').catch(() => ({ rows: [] })),
    pool.query('SELECT company_id, company_fullname, company_shortname FROM company').catch(() => ({ rows: [] })),
    pool.query(`SELECT column_name, status_value, display_name_en FROM status_catalog
                WHERE table_name = 'service_delivery_contract'
                  AND column_name IN ('service', 'id__sla_response_time', 'id__sla_completed_time')`).catch(() => ({ rows: [] }))
  ]);
  const empMap = new Map();
  empRes.rows.forEach((r) => {
    empMap.set(String(r.employee_id), r.full_name);
    if (r.email) empMap.set(String(r.email).toLowerCase(), r.full_name);
  });
  const compMap = new Map();
  compRes.rows.forEach((r) => compMap.set(String(r.company_id), r.company_fullname || r.company_shortname));
  const catMap = new Map();
  catRes.rows.forEach((r) => catMap.set(`${r.column_name}:${r.status_value}`, r.display_name_en));
  const empName = (v) => (v ? (empMap.get(String(v)) || empMap.get(String(v).toLowerCase()) || v) : '—');
  const cat = (col, v) => (v == null || v === '' ? '—' : (catMap.get(`${col}:${v}`) || v));

  const rootReqRes = rootRequestId
    ? await pool.query(
      `SELECT r.request_id, r.description, r.requester, r.sr_creater, e.full_name AS requester_name
         FROM request r LEFT JOIN employee e ON (e.employee_id = r.requester OR e.email = r.requester)
        WHERE r.request_id = $1`, [rootRequestId]
    ).catch(() => null)
    : null;
  const rootReq = rootReqRes && rootReqRes.rows[0] ? rootReqRes.rows[0] : null;

  const oppoRes = sdc.project
    ? await pool.query('SELECT * FROM oppotunity WHERE project_id::text = $1', [String(sdc.project)]).catch(() => null)
    : null;
  const oppo = oppoRes && oppoRes.rows[0] ? oppoRes.rows[0] : null;

  const sibParams = [sdc.id];
  const sibConds = [];
  if (sdc.project) { sibParams.push(String(sdc.project)); sibConds.push(`project = $${sibParams.length}`); }
  if (rootRequestId) { sibParams.push(rootRequestId); sibConds.push(`id__service_request = $${sibParams.length}`); }
  const sibRes = sibConds.length
    ? await pool.query(
      `SELECT id, service_scope, coordinator__employee, service, status, fy, start_date, end_date,
              id__sla_response_time, id__sla_completed_time, note
         FROM service_delivery_contract
        WHERE id <> $1 AND deleted_at IS NULL AND (${sibConds.join(' OR ')})
        ORDER BY id ASC`, sibParams
    ).catch(() => null)
    : null;

  const contractParams = [];
  const contractConds = [];
  if (rootRequestId) { contractParams.push(rootRequestId); contractConds.push(`request = $${contractParams.length} OR id__request = $${contractParams.length}`); }
  const contractsRes = contractConds.length
    ? await pool.query(
      `SELECT contract_id, contractspood_no, contract_name_or_description, contractor, type, contract_signed_date, total_value, currency
         FROM contract WHERE deleted_at IS NULL AND (${contractConds.join(' OR ')})`, contractParams
    ).catch(() => null)
    : null;

  const TH = 'padding:6px 10px; border:none; white-space:nowrap;';
  const TD_CUR = 'padding:7px 10px; border:none; white-space:nowrap;';
  const TD = 'padding:6px 10px; border:none; white-space:nowrap;';
  const WRAP = 'max-width:240px; min-width:140px; white-space:normal; word-break:break-word; line-height:1.4;';
  const SECTION = 'font-weight:600; color:#0F172A; font-size:12px; margin-top:10px; margin-bottom:4px;';
  const TABLE = 'width:100%; min-width:1100px; border-collapse:collapse; border:none; font-size:12px; background:transparent;';
  const HEAD_ROW = 'border-bottom:2px solid #E2E8F0; background:#F8FAFC; color:#64748B; font-weight:600; text-align:left;';

  const htmlParts = [];
  htmlParts.push(`
    <div style="font-weight:700; color:#1E293B; margin-bottom:8px; font-size:13px; text-transform:uppercase; letter-spacing:0.5px;">
      [{{msg.sdc_approval_summary::TỔNG HỢP THÔNG TIN DUYỆT SERVICE DELIVERY CONTRACT}}]
    </div>
  `);

  if (rootReq) {
    const author = rootReq.requester_name || rootReq.requester || rootReq.sr_creater || '—';
    htmlParts.push(`
      <div style="margin-bottom:12px; font-size:12px; color:#475569; line-height:1.5;">
        <div><b>{{col.request_id::Mã yêu cầu}}:</b> ${esc(rootReq.request_id)} &nbsp;|&nbsp; <b>{{col.requester::Người yêu cầu}}:</b> ${esc(author)}</div>
        ${rootReq.description ? `<div><b>{{col.description::Mô tả}}:</b> ${esc(rootReq.description)}</div>` : ''}
      </div>
    `);
  }

  if (oppo) {
    const revenue = oppo.estimated_revenue != null && oppo.estimated_revenue !== ''
      ? `${fmtAmount(oppo.estimated_revenue)} ${esc(oppo.currency || '')}`.trim() : '—';
    htmlParts.push(`
      <div style="margin-bottom:12px; font-size:12px; color:#475569; line-height:1.5;">
        <div><b>{{col.opportunity::Cơ hội}}:</b> ${esc(oppo.project_label || oppo.project_name || oppo.project_id)}</div>
        <div><b>{{col.id__company::Khách hàng}}:</b> ${esc(compMap.get(String(oppo.id__company)) || oppo.id__company || '—')}
          &nbsp;|&nbsp; <b>{{col.sale_lead::Sale Lead}}:</b> ${esc(empName(oppo.sale_lead))}</div>
        <div><b>{{col.estimated_revenue::Doanh thu dự kiến}}:</b> ${revenue}
          &nbsp;|&nbsp; <b>{{col.close_date::Ngày chốt}}:</b> ${fmtDate(oppo.close_date)}</div>
      </div>
    `);
  }

  const sdcRow = (s, isCurrent, statusToken) => `
    <tr style="${isCurrent ? 'background:#F1F5F9; border-bottom:1px solid #E2E8F0; font-weight:600; color:#1E293B;' : 'border-bottom:1px solid #F1F5F9; color:#334155;'}">
      <td style="${isCurrent ? TD_CUR : TD}">${esc(s.id)}${isCurrent ? ' <span style="display:inline-block; margin-left:4px; padding:1px 5px; font-size:10px; font-weight:600; color:#475569; background:#E2E8F0; border-radius:4px;">{{msg.current_proposal::Current}}</span>' : ''}</td>
      <td style="${isCurrent ? TD_CUR : TD} vertical-align:top;"><div style="${WRAP}">${esc(s.service_scope || '—')}</div></td>
      <td style="${isCurrent ? TD_CUR : TD}">${esc(empName(s.coordinator__employee))}</td>
      <td style="${isCurrent ? TD_CUR : TD}">${esc(cat('service', s.service))}</td>
      <td style="${isCurrent ? TD_CUR : TD}">${statusToken || STATUS_TOKENS[Number(s.status)] || esc(s.status)}</td>
      <td style="${isCurrent ? TD_CUR : TD}">${esc(s.fy || '—')}</td>
      <td style="${isCurrent ? TD_CUR : TD}">${fmtDate(s.start_date)}</td>
      <td style="${isCurrent ? TD_CUR : TD}">${fmtDate(s.end_date)}</td>
      <td style="${isCurrent ? TD_CUR : TD}">${esc(cat('id__sla_response_time', s.id__sla_response_time))}</td>
      <td style="${isCurrent ? TD_CUR : TD}">${esc(cat('id__sla_completed_time', s.id__sla_completed_time))}</td>
      <td style="${isCurrent ? TD_CUR : TD} vertical-align:top;"><div style="${WRAP}">${esc(s.note || '—')}</div></td>
    </tr>`;

  const sibRows = (sibRes && sibRes.rows) || [];
  htmlParts.push(`
    <div style="${SECTION}">{{col.service_delivery_contract::Service Delivery Contract}} (${1 + sibRows.length}):</div>
    <div style="width:100%; overflow-x:auto; -webkit-overflow-scrolling:touch; margin-bottom:12px;">
      <table style="${TABLE}">
        <thead>
          <tr style="${HEAD_ROW}">
            <th style="${TH}">{{col.service_delivery_id::SD ID}}</th>
            <th style="${TH}">{{col.service_scope::Service Scope}}</th>
            <th style="${TH}">{{col.coordinator__employee::Coordinator}}</th>
            <th style="${TH}">{{col.service::Service}}</th>
            <th style="${TH}">{{col.status::Status}}</th>
            <th style="${TH}">{{col.fy::FY}}</th>
            <th style="${TH}">{{col.start_date::Start Date}}</th>
            <th style="${TH}">{{col.end_date::End Date}}</th>
            <th style="${TH}">{{col.id__sla_response_time::SLA Response}}</th>
            <th style="${TH}">{{col.id__sla_completed_time::SLA Completed}}</th>
            <th style="${TH}">{{col.note::Note}}</th>
          </tr>
        </thead>
        <tbody>
          ${sdcRow(sdc, true, STATUS_TOKENS[SDC_STATUS.WAITING_FOR_APPROVAL])}
          ${sibRows.map((s) => sdcRow(s, false)).join('')}
        </tbody>
      </table>
    </div>
  `);

  const contractRows = (contractsRes && contractsRes.rows) || [];
  if (contractRows.length > 0) {
    htmlParts.push(`
      <div style="${SECTION}">{{col.contract::Hợp đồng}} (${contractRows.length}):</div>
      <div style="width:100%; overflow-x:auto; -webkit-overflow-scrolling:touch; margin-bottom:12px;">
        <table style="${TABLE}">
          <thead>
            <tr style="${HEAD_ROW}">
              <th style="${TH}">{{col.contract_name_or_description::Contract Name}}</th>
              <th style="${TH}">{{col.contractspood_no::Contracts/PO/OD No}}</th>
              <th style="${TH}">{{col.contractor::Contractor}}</th>
              <th style="${TH}">{{col.contract_type::Type}}</th>
              <th style="${TH}">{{col.contract_signed_date::Contract Signed Date}}</th>
              <th style="${TH} text-align:right;">{{col.total_value::Total Value}}</th>
              <th style="${TH} text-align:center;">{{col.currency::Currency}}</th>
            </tr>
          </thead>
          <tbody>
            ${contractRows.map((c) => `
            <tr style="border-bottom:1px solid #F1F5F9; color:#334155;">
              <td style="${TD} vertical-align:top;"><div style="${WRAP}">${esc(c.contract_name_or_description || c.contract_id || '—')}</div></td>
              <td style="${TD}">${esc(c.contractspood_no || '—')}</td>
              <td style="${TD}">${esc(compMap.get(String(c.contractor)) || c.contractor || '—')}</td>
              <td style="${TD}">${Number(c.type) === 69 ? '{{val.selling::Bán ra}}' : (Number(c.type) === 70 ? '{{val.buying::Mua vào}}' : esc(c.type || '—'))}</td>
              <td style="${TD}">${fmtDate(c.contract_signed_date)}</td>
              <td style="${TD} text-align:right;">${fmtAmount(c.total_value)}</td>
              <td style="${TD} text-align:center;">${esc(c.currency || '—')}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    `);
  }

  if (isReSubmit) {
    htmlParts.unshift(`
      <div style="font-weight:700; color:#1E293B; margin-bottom:8px; font-size:13px; display:flex; align-items:center; gap:6px;">
        <span>🔄</span> <span>{{msg.sdc_request_resubmitted::Cập nhật yêu cầu duyệt Service Delivery Contract (Re-submitted)}}</span>
      </div>
    `);
  }
  return htmlParts.join('').trim();
}

async function insertSummaryComment(client, requestId, user, html) {
  const commId = crypto.randomUUID();
  const by = user.employee_id || user.email || 'System';
  await client.query(
    `INSERT INTO "comment" ("comment_id", "request", "comment", "comment_by", "comment_date")
     VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
    [commId, requestId, html, by]
  );
  safeBroadcast({
    action: 'insert',
    table: 'comment',
    record: { comment_id: commId, request: requestId, comment: html, comment_by: by, comment_date: new Date().toISOString() }
  });
}

/** Action `sdc_submit`: Draft -> Waiting for approval (creates the approval request + summary comment). */
async function submitSdc({ client, record, record_id, user }) {
  const sdcRes = await client.query(
    'SELECT * FROM service_delivery_contract WHERE id::text = $1 AND deleted_at IS NULL FOR UPDATE',
    [String(record_id)]
  );
  if (sdcRes.rows.length === 0) throw new Error('Không tìm thấy Service Delivery Contract.');
  const sdc = sdcRes.rows[0];

  if (Number(sdc.status) !== SDC_STATUS.DRAFT) {
    throw new Error('Chỉ có thể submit Service Delivery Contract đang ở trạng thái Draft.');
  }
  if (!sdc.start_date || !sdc.end_date) {
    throw new Error('Vui lòng nhập đầy đủ Start Date và End Date trước khi submit.');
  }
  if (toTime(sdc.end_date) < toTime(sdc.start_date)) {
    throw new Error('End Date phải lớn hơn hoặc bằng Start Date.');
  }

  const rootRequestId = await resolveRootRequestId(client, sdc);

  let coordinatorName = sdc.coordinator__employee || '';
  if (sdc.coordinator__employee) {
    const eRes = await client.query('SELECT full_name FROM employee WHERE employee_id = $1 OR email = $1', [sdc.coordinator__employee]);
    if (eRes.rows.length > 0 && eRes.rows[0].full_name) coordinatorName = eRes.rows[0].full_name;
  }
  const desc = `${sdc.service_scope || ''} | ${fmtDate(sdc.start_date)} → ${fmtDate(sdc.end_date)} | ${coordinatorName} (${sdc.id})`;

  // Re-use an existing approval request that was withdrawn / rejected (Draft or Rejected)
  let existingReq = null;
  if (sdc.id__approval_request) {
    const r = await client.query('SELECT * FROM request WHERE request_id = $1', [sdc.id__approval_request]);
    if (r.rows.length > 0) {
      const srSt = Number(r.rows[0].sr_status);
      if (srSt === 1 || srSt === 4) existingReq = r.rows[0];
    }
  }
  const isReSubmit = !!existingReq;
  let approvalRequestId = isReSubmit ? existingReq.request_id : await nextRequestId(client, user);
  let autoApproved = false;

  if (isReSubmit) {
    let flow = null;
    try {
      flow = typeof existingReq.approval_flow === 'string' ? JSON.parse(existingReq.approval_flow) : JSON.parse(JSON.stringify(existingReq.approval_flow || {}));
    } catch (e) { flow = null; }
    autoApproved = !!(flow && flow.total_levels === 0);
    if (!autoApproved && flow && Array.isArray(flow.steps) && flow.steps.length > 0) {
      flow.current_level = 1;
      flow.steps.forEach((step, idx) => { step.status = idx === 0 ? 2 : 7; step.action_by = null; step.action_date = null; });
    }
    await client.query(
      `UPDATE request
          SET description = $2, sr_status = $3, process_status = $4,
              sr_submitted_date = CURRENT_TIMESTAMP, approval_flow = $5,
              process_start_date = CASE WHEN $4 = 9 THEN CURRENT_TIMESTAMP ELSE NULL END,
              process_end_date = CASE WHEN $4 = 9 THEN CURRENT_TIMESTAMP ELSE NULL END,
              log = COALESCE(log, '[]'::jsonb) || $6::jsonb
        WHERE request_id = $1`,
      [
        approvalRequestId, desc,
        autoApproved ? 3 : 2, autoApproved ? 9 : 7,
        flow ? JSON.stringify(flow) : existingReq.approval_flow,
        appendLog(autoApproved ? 're-submitted and auto-approved request (Tier 0)' : 're-submitted request', user)
      ]
    );
  } else {
    const requestData = {
      request_id: approvalRequestId,
      request_type: SDC_APPROVAL_PROCESS_ID,
      sr_creater: user.employee_id,
      requester: user.employee_id,
      description: desc,
      sr_status: 2,
      process_status: 7,
      parent__id_request: rootRequestId,
      log: JSON.stringify([
        { timestamp: new Date().toISOString(), user: user.employee_id, action: 'created request' },
        { timestamp: new Date().toISOString(), user: user.employee_id, action: 'submitted request' }
      ])
    };
    await RequestModel.resolveApprovals(requestData, client);
    if (Number(requestData.sr_status) === 3) {
      autoApproved = true;
      requestData.process_status = 9;
    }
    if (requestData.sr_owner !== undefined && requestData.sr_owner !== null) {
      if (Array.isArray(requestData.sr_owner)) {
        requestData.sr_owner = requestData.sr_owner.map((s) => s.trim().replace(/^\[|\]$/g, '').toLowerCase()).filter(Boolean);
      } else if (typeof requestData.sr_owner === 'string') {
        requestData.sr_owner = requestData.sr_owner.split(',').map((s) => s.trim().replace(/^\[|\]$/g, '').toLowerCase()).filter(Boolean);
      }
    }
    await client.query(
      `INSERT INTO request (
         request_id, request_type, sr_creater, requester, description,
         sr_status, process_status, sr_submitted_date, sr_created_date,
         policy_lead, sr_owner, approval_flow, approval_level, log,
         parent__id_request, process_start_date, process_end_date
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
         $8, $9, $10, $11, $12, $13,
         CASE WHEN $7 = 9 THEN CURRENT_TIMESTAMP ELSE NULL END,
         CASE WHEN $7 = 9 THEN CURRENT_TIMESTAMP ELSE NULL END
       )`,
      [
        requestData.request_id, requestData.request_type, requestData.sr_creater, requestData.requester, requestData.description,
        requestData.sr_status, requestData.process_status,
        requestData.policy_lead || null, requestData.sr_owner || null, requestData.approval_flow || null,
        requestData.approval_level || null, requestData.log || null, requestData.parent__id_request || null
      ]
    );
    safeBroadcast({ action: 'insert', table: 'request', record: requestData });
  }

  // Link request to SDC + status
  const newStatus = autoApproved
    ? computeRunningStatus(sdc.start_date, sdc.end_date)
    : SDC_STATUS.WAITING_FOR_APPROVAL;
  await client.query(
    `UPDATE service_delivery_contract
        SET id__approval_request = $2, status = $3,
            log = COALESCE(log, '[]'::jsonb) || $4::jsonb
      WHERE id = $1`,
    [
      sdc.id, approvalRequestId, newStatus,
      appendLog(autoApproved ? 'submitted and auto-approved (Tier 0)' : 'submitted for approval', user)
    ]
  );
  safeBroadcast({
    action: 'update', table: 'service_delivery_contract', id: sdc.id,
    record: { id: sdc.id, status: newStatus, id__approval_request: approvalRequestId }
  });

  // Executive summary comment (does not block the submit on failure)
  try {
    const html = await buildSummaryHtml({ sdc, rootRequestId, isReSubmit });
    await insertSummaryComment(client, approvalRequestId, user, html);
  } catch (cmtErr) {
    console.error('Failed to create summary comment for SDC approval request:', cmtErr);
  }
  clearReqCache();
}

function toTime(v) {
  if (v instanceof Date) return v.getTime();
  const t = new Date(v).getTime();
  return isNaN(t) ? 0 : t;
}

async function findSdcsByApprovalRequest(client, requestId) {
  const res = await client.query(
    'SELECT * FROM service_delivery_contract WHERE id__approval_request = $1 AND deleted_at IS NULL',
    [requestId]
  );
  return res.rows;
}

async function setSdcStatus(client, sdc, status, logText, user, extraSql = '') {
  await client.query(
    `UPDATE service_delivery_contract
        SET status = $2 ${extraSql}, log = COALESCE(log, '[]'::jsonb) || $3::jsonb
      WHERE id = $1`,
    [sdc.id, status, appendLog(logText, user)]
  );
  safeBroadcast({ action: 'update', table: 'service_delivery_contract', id: sdc.id, record: { id: sdc.id, status } });
}

/** Called after a request is (re)submitted from the generic request UI. */
async function onRequestSubmitted({ client, record, user, autoApproved }) {
  if (!isSdcApprovalRequest(record)) return;
  const rows = await findSdcsByApprovalRequest(client, record.request_id);
  for (const sdc of rows) {
    if (autoApproved) {
      await client.query(
        `UPDATE request SET process_status = 9,
                process_start_date = COALESCE(process_start_date, CURRENT_TIMESTAMP),
                process_end_date = CURRENT_TIMESTAMP
          WHERE request_id = $1`, [record.request_id]
      );
      await setSdcStatus(client, sdc, computeRunningStatus(sdc.start_date, sdc.end_date), 'approved (Tier 0)', user);
    } else {
      await setSdcStatus(client, sdc, SDC_STATUS.WAITING_FOR_APPROVAL, 'submitted for approval', user);
    }
  }
  clearReqCache();
}

/** Final approval: start running status according to the contract period. */
async function onRequestApproved({ client, record, user }) {
  if (!isSdcApprovalRequest(record)) return;
  const rows = await findSdcsByApprovalRequest(client, record.request_id);
  for (const sdc of rows) {
    await setSdcStatus(client, sdc, computeRunningStatus(sdc.start_date, sdc.end_date), 'approved - contract activated', user);
  }
  clearReqCache();
}

async function onRequestRejected({ client, record, user }) {
  if (!isSdcApprovalRequest(record)) return;
  const rows = await findSdcsByApprovalRequest(client, record.request_id);
  for (const sdc of rows) {
    if (Number(sdc.status) !== SDC_STATUS.WAITING_FOR_APPROVAL) continue; // already activated: leave as is
    await setSdcStatus(client, sdc, SDC_STATUS.DRAFT, 'approval rejected - back to draft', user);
  }
}

async function onRequestWithdrawn({ client, record, user }) {
  if (!isSdcApprovalRequest(record)) return;
  const rows = await findSdcsByApprovalRequest(client, record.request_id);
  for (const sdc of rows) {
    if (Number(sdc.status) !== SDC_STATUS.WAITING_FOR_APPROVAL) continue; // already activated: leave as is
    await setSdcStatus(client, sdc, SDC_STATUS.DRAFT, 'approval withdrawn - back to draft', user);
  }
}

async function onRequestCancelled({ client, record, user }) {
  if (!isSdcApprovalRequest(record)) return;
  const rows = await findSdcsByApprovalRequest(client, record.request_id);
  for (const sdc of rows) {
    await setSdcStatus(client, sdc, SDC_STATUS.DRAFT, 'approval cancelled - back to draft', user, ', id__approval_request = NULL');
  }
}

/** Daily job: derive running status from start/end date for approved contracts. */
async function syncSdcRunningStatuses(db = pool) {
  const res = await db.query(
    `SELECT id, status, start_date, end_date FROM service_delivery_contract
      WHERE deleted_at IS NULL AND start_date IS NOT NULL AND end_date IS NOT NULL
        AND status = ANY($1::int[])`,
    [AUTO_RUNNING_STATUSES]
  );
  let changed = 0;
  for (const row of res.rows) {
    const next = computeRunningStatus(row.start_date, row.end_date);
    if (next !== Number(row.status)) {
      await db.query('UPDATE service_delivery_contract SET status = $2 WHERE id = $1', [row.id, next]);
      safeBroadcast({ action: 'update', table: 'service_delivery_contract', id: row.id, record: { id: row.id, status: next } });
      changed++;
    }
  }
  return changed;
}

module.exports = {
  isSdcApprovalRequest,
  resolveRootRequestId,
  attachRootRequest,
  submitSdc,
  onRequestSubmitted,
  onRequestApproved,
  onRequestRejected,
  onRequestWithdrawn,
  onRequestCancelled,
  syncSdcRunningStatuses
};
