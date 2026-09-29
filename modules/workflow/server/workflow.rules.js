const pool = require('../../../server/db');
const { z } = require('zod');
const { STATUS, getStatusKey, resolveStatusId, getRecordStatusId, getRecordStatusKey, enrichRecordWithStatusCatalog } = require('../../../server/helpers/statuses');
const hashidHelper = require('../../../server/helpers/hashidHelper');

async function isRequestParticipant(record, user, dbClient) {
  if (!user) return false;
  const userIds = [user.employee_id, user.email, user.username]
    .filter(Boolean)
    .map(v => String(v).trim().toLowerCase());
  if (userIds.length === 0) return false;

  // 1. Check requester
  if (record.requester && userIds.includes(String(record.requester).trim().toLowerCase())) return true;

  // 2. Check sr_creater
  if (record.sr_creater && userIds.includes(String(record.sr_creater).trim().toLowerCase())) return true;

  // 3. Check policy_lead
  if (record.policy_lead && userIds.includes(String(record.policy_lead).trim().toLowerCase())) return true;

  // 4. Check sr_owner (which is text[] / Array)
  if (record.sr_owner) {
    const owners = Array.isArray(record.sr_owner) ? record.sr_owner : [record.sr_owner];
    if (owners.some(o => o && userIds.includes(String(o).trim().toLowerCase()))) return true;
  }

  // 5. Check approval tiers
  if (record.approval_flow) {
    let flow = record.approval_flow;
    if (typeof flow === 'string') {
      try {
        flow = JSON.parse(flow);
      } catch (e) {}
    }
    if (flow && Array.isArray(flow.steps)) {
      if (flow.steps.some(step => step.approver && userIds.includes(String(step.approver).trim().toLowerCase()))) return true;
    }
  }

  // 6. Check if mentioned in comment tags
  if (record.request_id) {
    try {
      for (const uId of userIds) {
        const tagRes = await dbClient.query(
          `SELECT 1 FROM comment WHERE request::text = $1::text AND LOWER(tag) LIKE $2 LIMIT 1`,
          [record.request_id, `%${uId}%`]
        );
        if (tagRes.rows.length > 0) return true;
      }
    } catch (err) {
      console.error('Error checking comment tags in isRequestParticipant:', err);
    }
  }

  return false;
}
const ACTION_LOGIC = {
  // --- REQUEST ACTIONS ---
  'change_sr_owner': {
    label: 'Change SR Owner',
    color: 'var(--accent)',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="19" height="19" fill="none" style="vertical-align: middle;"><circle cx="9" cy="6" r="3.5" fill="currentColor"></circle><path d="M2 15a7 7 0 0 1 14 0" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"></path><text x="9" y="21" font-size="6" font-family="-apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif" font-weight="bold" fill="currentColor" text-anchor="middle" style="stroke:none;">SR</text><path d="M18 3l3 3-7 7h-3v-3l7-7z" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"></path></svg>`,
    when: (r, u) => {
      const srStatus = getRecordStatusId(r, 'request', 'sr_status');
      const isValidStatus = srStatus !== 5 && srStatus !== 6; // 5=closed, 6=cancelled

      const isPolicyLead = r.policy_lead && u && r.policy_lead.toLowerCase() === u.employee_id.toLowerCase();
      const isSuperAdmin = u && u.role && u.role.toUpperCase() === 'SUPER ADMIN';

      return isValidStatus && (isPolicyLead || isSuperAdmin);
    }
  },
  'ACT-REQUEST-02': {
    label: 'Elements',
    color: 'var(--accent)',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="19" height="19" fill="none" style="vertical-align: middle;"><path d="M12 20h9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><text x="10" y="14" font-size="8" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="bold" fill="currentColor" style="stroke:none;">E</text></svg>`,
    when: (r) => {
      const sr = getRecordStatusId(r, 'request', 'sr_status');
      const pr = getRecordStatusId(r, 'request', 'process_status');
      return sr !== 1 && (pr === 8 || pr === 9); // Not Draft (1), and is Processing (8) or Completed (9)
    }
  },
  'ACT-REQUEST-03': {
    label: 'FeedBack',
    color: 'var(--accent)',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`,
    when: async (r, u) => {
      const pr = getRecordStatusId(r, 'request', 'process_status');
      if (pr !== 9) return false; // 9=completed
      if (!u || !u.employee_id) return false;
      try {
        const checkRes = await pool.query(
          'SELECT 1 FROM request_rating WHERE request_id = $1 AND from_user = $2 AND deleted_at IS NULL LIMIT 1',
          [r.request_id, u.employee_id]
        );
        return checkRes.rows.length === 0;
      } catch (e) {
        return false;
      }
    }
  },
  'ACT-REQUEST-03-RE': {
    label: 'FeedBack again',
    color: 'var(--accent)',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`,
    when: async (r, u) => {
      const pr = getRecordStatusId(r, 'request', 'process_status');
      if (pr !== 9) return false; // 9=completed
      if (!u || !u.employee_id) return false;
      try {
        const checkRes = await pool.query(
          'SELECT 1 FROM request_rating WHERE request_id = $1 AND from_user = $2 AND deleted_at IS NULL LIMIT 1',
          [r.request_id, u.employee_id]
        );
        return checkRes.rows.length > 0;
      } catch (e) {
        return false;
      }
    }
  },
  'ACT-REQUEST-04': {
    label: 'Re-update Process Status',
    color: 'var(--accent)',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="19" height="19" fill="none" style="vertical-align: middle;"><path d="M12 20h9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><text x="9" y="12" font-size="6" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="bold" fill="currentColor" style="stroke:none;">PS</text></svg>`,
    when: (r) => getRecordStatusId(r, 'request', 'sr_status') === 3 && getRecordStatusId(r, 'request', 'process_status') === 9 // 3=Approved, 9=Completed
  },
  'ACT-REQUEST-05': {
    label: 'Request Cancel',
    color: 'var(--accent-red)',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    when: (r) => {
      const sr = getRecordStatusId(r, 'request', 'sr_status');
      const pr = getRecordStatusId(r, 'request', 'process_status');
      return sr === 3 && (pr === 7 || pr === 8); // 3=Approved, 7=Not started, 8=Processing
    }
  },
  'ACT-REQUEST-06': {
    label: 'Request Closed',
    color: 'var(--accent-red)',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
    when: (r) => getRecordStatusId(r, 'request', 'sr_status') === 3 && getRecordStatusId(r, 'request', 'process_status') === 9 // 3=Approved, 9=Completed
  },
  'ACT-REQUEST-07': {
    label: 'Request Complete',
    color: 'var(--accent-green)',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    when: (r) => getRecordStatusId(r, 'request', 'sr_status') === 3 && getRecordStatusId(r, 'request', 'process_status') === 8 // 3=Approved, 8=Processing
  },
  'ACT-REQUEST-08': {
    label: 'Request Start',
    color: 'var(--accent)',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
    when: (r) => getRecordStatusId(r, 'request', 'sr_status') === 3 && getRecordStatusId(r, 'request', 'process_status') === 7 // 3=Approved, 7=Not started
  },
  'ACT-REQUEST-09': {
    label: 'Submit',
    color: 'var(--accent-green)',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`,
    when: (r) => {
      const sr = getRecordStatusId(r, 'request', 'sr_status');
      return sr === 1 || sr === 4; // 1=Draft, 4=Rejected
    }
  },
  'withdraw_request': {
    label: 'Withdraw',
    color: 'var(--accent-red)',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`,
    when: (r) => {
      const sr = getRecordStatusId(r, 'request', 'sr_status');
      const pr = getRecordStatusId(r, 'request', 'process_status');
      return sr === 2 || sr === 4 || pr === 117; // 2=Pending Approval, 4=Rejected, 117=Canceled
    }
  },
  'approve_request': {
    label: 'Approve',
    color: 'var(--accent-green)',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><polyline points="9 14 11 16 15 11"/></svg>`,
    when: (r, u) => {
      const sr = getRecordStatusId(r, 'request', 'sr_status');
      if (sr !== 2) return false; // 2=Pending Approval
      if (!r.approval_flow) return false;
      let flow = null;
      try {
        flow = typeof r.approval_flow === 'string' ? JSON.parse(r.approval_flow) : r.approval_flow;
      } catch (e) { return false; }
      if (!flow || !flow.steps) return false;
      const curLevel = flow.current_level;
      if (curLevel > flow.total_levels) return false;
      const curStep = flow.steps[curLevel - 1];
      if (!curStep || Number(curStep.status) !== 2) return false;

      let approvers = [null];
      if (r.approval_flow && typeof r.approval_flow === 'string') {
        try {
          const fl = JSON.parse(r.approval_flow);
          if (fl.steps) fl.steps.forEach(s => approvers[s.level] = s.approver);
        } catch(e) {}
      } else if (r.approval_flow && r.approval_flow.steps) {
        r.approval_flow.steps.forEach(s => approvers[s.level] = s.approver);
      }
      const curApprover = approvers[curLevel];
      return (curApprover && curApprover.toLowerCase() === u.employee_id.toLowerCase()) || (u && u.role && u.role.toUpperCase() === 'SUPER ADMIN');
    }
  },
  'reject_request': {
    label: 'Reject',
    color: 'var(--accent-red)',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><line x1="10" y1="11" x2="14" y2="15"/><line x1="14" y1="11" x2="10" y2="15"/></svg>`,
    when: (r, u) => {
      const sr = getRecordStatusId(r, 'request', 'sr_status');
      if (sr !== 2) return false; // 2=Pending Approval
      if (!r.approval_flow) return false;
      let flow = typeof r.approval_flow === 'string' ? JSON.parse(r.approval_flow) : r.approval_flow;
      if (!flow || !flow.steps) return false;
      const curLevel = flow.current_level;
      if (curLevel > flow.total_levels) return false;
      const curStep = flow.steps[curLevel - 1];
      if (!curStep || Number(curStep.status) !== 2) return false;

      let approvers = [null];
      if (r.approval_flow && typeof r.approval_flow === 'string') {
        try {
          const fl = JSON.parse(r.approval_flow);
          if (fl.steps) fl.steps.forEach(s => approvers[s.level] = s.approver);
        } catch(e) {}
      } else if (r.approval_flow && r.approval_flow.steps) {
        r.approval_flow.steps.forEach(s => approvers[s.level] = s.approver);
      }
      const curApprover = approvers[curLevel];
      return (curApprover && curApprover.toLowerCase() === u.employee_id.toLowerCase()) || (u && u.role && u.role.toUpperCase() === 'SUPER ADMIN');
    }
  },
  'ACT-REQUEST-016': {
    label: 'View Main Request',
    color: 'var(--accent)',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="19" height="19" fill="none" style="vertical-align: middle;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><text x="18" y="22" font-size="8" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="bold" fill="currentColor" style="stroke:none;">Main</text></svg>`,
    when: async (r) => {
      if (!r.request_id) return false;
      if (r.parent__id_request || r.parent_request_id) return true;
      try {
        const res = await pool.query(
          `SELECT COALESCE(p.request, c.request) AS parent_req
           FROM payment p
           LEFT JOIN contract c ON p.contract_id = c.contract_id
           WHERE p.payment_request = $1
           UNION
           SELECT COALESCE(i.request, c.request) AS parent_req
           FROM invoice i
           LEFT JOIN contract c ON i.contract_id = c.contract_id
           WHERE i.invoice_request = $1`,
          [r.request_id]
        );
        return res.rows.some(row => !!row.parent_req);
      } catch (err) {
        console.error('Error checking View Main Request condition:', err);
        return false;
      }
    }
  },

  // --- TICKET / SUPPORT ACTIONS ---
  'ACT-TICKET-03': {
    label: 'Rating',
    color: 'var(--accent)',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`,
    when: (r) => {
      const pr = getRecordStatusId(r, 'ticket', 'process_status');
      return (pr === 16 || pr === 119) && (r.rating == null); // 16=Completed, 119=Cancelled
    }
  },
  'ACT-TICKET-03-RE': {
    label: 'Rate again',
    color: 'var(--accent)',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`,
    when: (r) => {
      return (r.rating != null);
    }
  },
  'ACT-TICKET-05': {
    label: 'Cancel',
    color: 'var(--accent-red)',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    when: (r) => {
      const pr = getRecordStatusId(r, 'ticket', 'process_status');
      return pr === 14 || pr === 15; // 14=Not started, 15=Processing
    }
  },
  'withdraw_ticket': {
    label: 'Withdraw',
    color: 'var(--accent-red)',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`,
    when: (r) => {
      const pr = getRecordStatusId(r, 'ticket', 'process_status');
      const sr = getRecordStatusId(r, 'ticket', 'sr_status');
      return pr === 14 || pr === 120 || sr === 10; // 14=Not started, 120=Draft, 10=Draft
    }
  },

  // --- PAYMENT ACTIONS ---
  'payment_req_outgoing': {
    label: 'Submit for payment', color: 'var(--accent)',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><path d="M12 15h4"/></svg>`,
    when: (r) => {
      const pType = getRecordStatusId(r, 'payment', 'payment_type');
      const pStatus = getRecordStatusId(r, 'payment', 'payment_status');
      return pType === 61 && pStatus === 30 && (!r.payment_request || String(r.payment_request).trim() === ''); // 61=Outgoing, 30=Draft, haven't submitted request yet
    }
  },
  'payment_paid': {
    label: 'Paid', color: 'var(--accent-green)',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/><path d="M16 21l2 2 4-4" stroke="currentColor" stroke-width="3"/></svg>`,
    when: (r) => getRecordStatusId(r, 'payment', 'payment_status') !== 32 // 32=Paid
  },
  'payment_ready': {
    label: 'Ready for Payment', color: 'var(--accent)',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"/><path d="M4 6v12a2 2 0 0 0 2 2h14v-4"/><path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z"/><circle cx="12" cy="12" r="1"/></svg>`,
    when: (r) => false // Chạy ngầm tự động, ẩn trên giao diện
  },
  'payment_update_transaction': {
    label: 'Update Transaction', color: 'var(--accent)',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`,
    when: (r) => getRecordStatusId(r, 'payment', 'payment_status') === 32 && (!r.transaction_id || String(r.transaction_id).trim() === '')
  },
  'payment_change_mtr': {
    label: 'Change MTR', color: 'var(--accent)',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`,
    when: (r) => getRecordStatusId(r, 'payment', 'payment_status') === 32 && (r.transaction_id && String(r.transaction_id).trim() !== '')
  },
  'update_task_status': {
    label: 'Update Status', color: 'var(--accent-green)',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    when: async (r, u) => {
      if (!r || !u) return false;
      const userEmpId = String(u.employee_id || '').toLowerCase();
      const userEmail = String(u.email || '').toLowerCase();
      if (String(r.employee_id).toLowerCase() === userEmpId) return true;
      if (u.role && u.role.toUpperCase() === 'SUPER ADMIN') return true;

      if (r.request_id) {
        try {
          const reqRes = await pool.query('SELECT sr_owner, policy_lead FROM request WHERE request_id = $1', [r.request_id]);
          if (reqRes.rows.length > 0) {
            const req = reqRes.rows[0];
            const srOwnerArr = Array.isArray(req.sr_owner)
              ? req.sr_owner.map(s => String(s).toLowerCase())
              : (req.sr_owner ? [String(req.sr_owner).toLowerCase()] : []);
            const policyLead = String(req.policy_lead || '').toLowerCase();
            if (srOwnerArr.includes(userEmpId) || srOwnerArr.includes(userEmail) || policyLead === userEmpId || policyLead === userEmail) {
              return true;
            }
          }
        } catch (e) {
          console.error('[update_task_status when check error]', e);
        }
      }
      return false;
    }
  }
};

function getBaseTable(tableName) {
  const VIEW_MAP = {
    'request': 'request',
    'support': 'ticket',
    'my_request': 'request',
    'my_approval': 'request',
    'my_process_owner': 'request',
    'my_task': 'request',
    'my_team': 'request',
    'my_payment': 'payment',
    'my_invoice': 'invoice',
    'my_asset': 'asset',
    'my_contract': 'contract',
    'my_opportunity': 'oppotunity',
    'my_project': 'project',
    'employee_active': 'employee'
  };
  return VIEW_MAP[tableName] || tableName;
}

module.exports = {
  isRequestParticipant,
  ACTION_LOGIC,
  VIEW_MAP: typeof VIEW_MAP !== 'undefined' ? VIEW_MAP : {},
  getBaseTable: typeof getBaseTable !== 'undefined' ? getBaseTable : (t => t),
  isValidTable: typeof isValidTable !== 'undefined' ? isValidTable : (() => true)
};
