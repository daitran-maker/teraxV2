// Request actions used by POST /api/actions/execute.
// MOVED verbatim from server/routes/actions.js (no logic change); `req.body.data` is passed in as `data`.
const { resolveStatusId } = require('../../../server/helpers/statuses');
const { ratingsDataSchema, processBase64Fields } = require('../../workflow/server/actions.helpers');
const { broadcastSSE } = require('../../../server/helpers/sseHelper');
const { createNotification } = require('../../../server/helpers/notificationHelper');
const { generateSequentialId } = require('../../../server/helpers/idGenerator');

async function changeSrOwner({ client, record, record_id, user, action_id, data }) {
    const { sr_owner } = data || {};
    if (!sr_owner) throw new Error("Vui lòng cung cấp SR Owner mới");
    // sr_owner from frontend is an array of emails
    const newOwnerArr = Array.isArray(sr_owner) ? sr_owner : [sr_owner];
    const oldOwnerArr = Array.isArray(record.sr_owner) ? record.sr_owner : (record.sr_owner ? [record.sr_owner] : []);
    const tzTimeStr = new Date().toISOString();
    const logEntry = {
      timestamp: tzTimeStr,
      user: user.employee_id,
      action: `changed SR Owner from [${oldOwnerArr.join(', ')}] to [${newOwnerArr.join(', ')}]`,
      old_owner: oldOwnerArr,
      new_owner: newOwnerArr,
      changes: { sr_owner: { old: oldOwnerArr, new: newOwnerArr } }
    };
    await client.query(
      `UPDATE request SET sr_owner = $2, log = COALESCE(log, '[]'::jsonb) || $3::jsonb WHERE request_id = $1`,
      [record_id, newOwnerArr, JSON.stringify([logEntry])]
    );
}

async function updateElements({ client, record, record_id, user, action_id, data }) {
    const { elements } = data || {};
    if (!elements) throw new Error("Vui lòng cung cấp thành phần mới");
    let elementArr = [];
    if (Array.isArray(elements)) {
      elementArr = elements;
    } else if (typeof elements === 'string') {
      elementArr = elements.split(',').map(s => s.trim().replace(/^\[|\]$/g, '')).filter(Boolean);
    }
    const tzTimeStr = new Date().toISOString();
    const logEntry = {
      timestamp: tzTimeStr,
      user: user.employee_id,
      action: 'updated elements',
      changes: { elements: { old: record.elements, new: elementArr } }
    };
    await client.query(
      `UPDATE request SET elements = $2, log = COALESCE(log, '[]'::jsonb) || $3::jsonb WHERE request_id = $1`,
      [record_id, elementArr, JSON.stringify([logEntry])]
    );
}

async function rateRequest({ client, record, record_id, user, action_id, data }) {
    const dataParse = ratingsDataSchema.safeParse(data);
    if (!dataParse.success) {
      const issues = dataParse.error.issues || dataParse.error.errors || [];
      throw new Error("Dữ liệu đánh giá không hợp lệ: " + issues.map(e => e.message).join(', '));
    }
    const ratings = dataParse.data.ratings;

    for (const r of ratings) {
      if (r.point <= 3 && !r.comment.trim()) {
        throw new Error(`Vui lòng nhập lý do đánh giá thấp cho nhân viên ${r.to_user}`);
      }
    }

    if (action_id === 'ACT-REQUEST-03-RE') {
      await client.query(
        `DELETE FROM request_rating WHERE request_id = $1 AND from_user = $2`,
        [record_id, user.employee_id]
      );
    }

    for (const r of ratings) {
      await client.query(
        `INSERT INTO request_rating (request_id, from_user, to_user, point, comment)
         VALUES ($1, $2, $3, $4, $5)`,
        [record_id, user.employee_id, r.to_user, r.point, r.comment]
      );
    }

    const avgRes = await client.query(
      `SELECT AVG(point)::numeric(3,2) as avg_point, COUNT(*)::int as cnt 
       FROM request_rating 
       WHERE request_id = $1 AND deleted_at IS NULL`,
      [record_id]
    );
    const avgPoint = avgRes.rows[0]?.avg_point ? parseFloat(avgRes.rows[0].avg_point) : 5.0;
    const count = avgRes.rows[0]?.cnt || 0;

    const ratingSummary = {
      point: avgPoint,
      count: count,
      last_updated: new Date().toISOString()
    };

    await client.query(
      `UPDATE request 
       SET rating = $2::jsonb, 
           sr_status = 5, 
           process_status = 9,
           sr_close_date = COALESCE(sr_close_date, CURRENT_TIMESTAMP)
       WHERE request_id = $1`,
      [record_id, JSON.stringify(ratingSummary)]
    );
}

async function updateProcessStatus({ client, record, record_id, user, action_id, data }) {
    const { process_status: processStatusStr } = data || {};
    const allowedProcessStatuses = ['Not started yet', 'Processing', 'Completed'];
    if (processStatusStr && !allowedProcessStatuses.includes(processStatusStr)) {
      throw new Error("Process Status không hợp lệ");
    }
    if (!processStatusStr) throw new Error("Vui lòng cung cấp Process Status");
    const process_status = resolveStatusId('request', 'process_status', processStatusStr);
    const tzTimeStr = new Date().toISOString();
    const logEntry = { timestamp: tzTimeStr, user: user.employee_id, action: `updated process status to ${processStatusStr}` };
    await client.query(`UPDATE request SET process_status = $2, log = COALESCE(log, '[]'::jsonb) || $3::jsonb WHERE request_id = $1`, [record_id, process_status, JSON.stringify([logEntry])]);
}

async function submitRequest({ client, record, record_id, user, action_id, data }) {
    // Submit
    let flow = null;
    try {
      flow = typeof record.approval_flow === 'string' ? JSON.parse(record.approval_flow) : JSON.parse(JSON.stringify(record.approval_flow || {}));
    } catch (e) {
      console.warn('Error parsing approval_flow:', e);
    }

    let isTier0 = false;
    if (flow && flow.total_levels === 0) {
      isTier0 = true;
    } else if (record.request_type) {
      const polRes = await client.query('SELECT approval_level FROM policy_and_program WHERE policy_id::text = $1 OR policy_name = $1', [record.request_type]);
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
      logEntry = { timestamp: tzTimeStr, user: user.employee_id, action: 'submitted request' };
    } else if (isTier0) {
      if (flow) {
        flow.total_levels = 0;
        flow.current_level = 0;
        flow.steps = [];
      }
      const tzTimeStr = new Date().toISOString();
      logEntry = { timestamp: tzTimeStr, user: user.employee_id, action: 'submitted and auto-approved request (Tier 0)' };
    } else {
      logEntry = { timestamp: new Date().toISOString(), user: user.employee_id, action: 'submitted request' };
    }

    const newSrStatus = isTier0 ? 3 : 2; // 3 = Approved, 2 = Pending Approval
    const newProcessStatus = isTier0 ? (Number(record.process_status) || 7) : record.process_status;

    await client.query(
      `UPDATE request
       SET sr_status = $3,
           process_status = COALESCE($4, process_status),
           sr_submitted_date = CURRENT_TIMESTAMP,
           approval_flow = $2,
           log = COALESCE(log, '[]'::jsonb) || $5::jsonb
       WHERE request_id = $1`,
      [record_id, flow ? JSON.stringify(flow) : record.approval_flow, newSrStatus, newProcessStatus, JSON.stringify([logEntry])]
    );
}

async function withdrawRequest({ client, record, record_id, user, action_id, data }) {
    // Withdraw
    let flow = null;
    try {
      flow = typeof record.approval_flow === 'string' ? JSON.parse(record.approval_flow) : JSON.parse(JSON.stringify(record.approval_flow || {}));
    } catch (e) {
      console.warn('Error parsing approval_flow:', e);
    }
    if (flow && flow.steps && flow.steps.length > 0) {
      flow.current_level = 1;
      flow.steps.forEach(step => {
        step.status = 7;
        step.action_by = null;
        step.action_date = null;
      });
    }
    let policyLead = record.policy_lead;
    let srOwner = record.sr_owner;
    let appLvl = record.approval_level;

    if (record.request_type) {
      const polRes = await client.query(
        `SELECT * FROM policy_and_program WHERE policy_id::text = $1 OR policy_name = $1`,
        [record.request_type]
      );
      if (polRes.rows.length > 0) {
        const policy = polRes.rows[0];
        policyLead = policy.policy_lead || record.policy_lead;
        srOwner = policy.sr_owner ? [policy.sr_owner] : record.sr_owner;
        appLvl = policy.approval_level || record.approval_level;
      }
    }

    const tzTimeStr = new Date().toISOString();
    const logEntry = { timestamp: tzTimeStr, user: user.employee_id, action: 'withdrew request' };

    await client.query(
      `UPDATE request SET 
         sr_status = 1, 
         process_status = 7,
         sr_submitted_date = NULL,
         process_start_date = NULL,
         process_end_date = NULL,
         sr_close_date = NULL,
         rating = NULL,
         policy_lead = $3,
         sr_owner = $4,
         approval_level = $5,
         approval_flow = $2,
         log = COALESCE(log, '[]'::jsonb) || $6::jsonb
       WHERE request_id = $1`,
      [
        record_id, 
        flow ? JSON.stringify(flow) : record.approval_flow, 
        policyLead, 
        srOwner, 
        appLvl,
        JSON.stringify([logEntry])
      ]
    );
}

async function approveOrRejectRequest({ client, record, record_id, user, action_id, data }) {
    let flow = null;
    try {
      flow = typeof record.approval_flow === 'string' ? JSON.parse(record.approval_flow) : JSON.parse(JSON.stringify(record.approval_flow || {}));
    } catch (e) {
      throw new Error("Approval Flow data is missing or invalid");
    }
    if (!flow) throw new Error("Approval Flow data is missing");
    const maxConfiguredTier = Number(flow.total_levels) || (flow.steps ? flow.steps.length : 0) || 1;
    const level = flow.current_level;
    const stepIdx = level - 1;
    if (!Array.isArray(flow.audit_log)) flow.audit_log = [];

    if (action_id === 'approve_request') {
      let level = flow.current_level;
      let emails = [null];
      if (flow && flow.steps) {
        flow.steps.forEach(s => emails[s.level] = s.approver);
      }
      let logUpdates = [];
      let dateUpdates = [];
      console.log(`[APPROVE] record_id=${record_id}, user=${user.employee_id}, level=${level}, emails=${emails.join(',')}`);

      const currentApprover = (emails[level] || '').trim().toLowerCase();
      const userIdentities = [user.employee_id, user.email, user.username]
        .filter(Boolean)
        .map(v => String(v).trim().toLowerCase());
      const isCurrentApprover = currentApprover && userIdentities.includes(currentApprover);
      const isSuperAdminUser = user.role && user.role.toUpperCase() === 'SUPER ADMIN';
      if (!isCurrentApprover && !isSuperAdminUser) {
        throw new Error(`You are not authorized to approve Tier ${level}`);
      }
      flow.total_levels = maxConfiguredTier;

      while (level <= flow.total_levels) {
        const stepIdx = level - 1;
        const approverForThisLevel = (emails[level] || '').trim().toLowerCase();
        const isApprover = approverForThisLevel && userIdentities.includes(approverForThisLevel);
        const isSuperAdmin = user.role && user.role.toUpperCase() === 'SUPER ADMIN';

        console.log(`[APPROVE] Loop iteration for level ${level}. isApprover=${isApprover}, isSuperAdmin=${isSuperAdmin}, flow.current_level=${flow.current_level}`);

        if (isApprover || (isSuperAdmin && level === flow.current_level)) {
          const tzTimeStr = new Date().toISOString();

          flow.steps[stepIdx].status = 3;
          flow.steps[stepIdx].action_by = user.employee_id;
          flow.steps[stepIdx].action_date = tzTimeStr;
          const logEntry = { timestamp: tzTimeStr, user: user.employee_id, action: `approved Tier ${level}` };
          logUpdates.push(logEntry);
          if (!Array.isArray(flow.audit_log)) flow.audit_log = [];
          flow.audit_log.push(logEntry);

          // If the user approved this level via override (i.e., not the designated approver),
          // we must not cascade to subsequent levels.
          if (!isApprover) {
            level++;
            break;
          }
          level++;
        } else {
          break;
        }
      }

      flow.current_level = level;

      console.log(`[APPROVE] Finished loop. new level=${level}, total=${flow.total_levels}`);
      let finalSrStatus = null;
      const nextStepIdx = flow.steps.findIndex(step =>
        Number(step.level) >= level &&
        [7, '7', 'not started yet', 'not_started'].includes(typeof step.status === 'string' ? step.status.trim().toLowerCase() : step.status) &&
        String(step.approver || '').trim()
      );

      if (nextStepIdx >= 0) {
        flow.current_level = Number(flow.steps[nextStepIdx].level) || (nextStepIdx + 1);
        flow.steps[nextStepIdx].status = 2;
      } else {
        flow.current_level = Number(flow.total_levels) + 1;
        finalSrStatus = 3;
      }

      // Safety fallback: if all steps in the flow are Approved, always set sr_status to Approved
      if (!finalSrStatus) {
        const allStepsApproved = flow.steps.length > 0 && flow.steps.every(s => s.status === 3 || s.status === '3' || (typeof s.status === 'string' && s.status.toLowerCase() === 'approved'));
        if (allStepsApproved) {
          finalSrStatus = 3;
          flow.current_level = Number(flow.total_levels) + 1;
        }
      }

      console.log(`[APPROVE] Executing final combined UPDATE for current_level=${flow.current_level}`);

      let updateClauses = [`approval_flow = $2`];
      let values = [record_id, JSON.stringify(flow)];
      let valIdx = 3;

      if (finalSrStatus) {
        const finalSrStatusId = resolveStatusId('request', 'sr_status', finalSrStatus) || 3;
        updateClauses.push(`sr_status = $${valIdx++}`);
        values.push(finalSrStatusId);

        const reqTypeStr = String(record.request_type || '');
        const isPaymentReq = reqTypeStr === '5' || reqTypeStr.toUpperCase() === 'RPM' || reqTypeStr.toUpperCase() === 'PAYMENT';

        // Approval-only requests (like Payment Request): auto-complete without requiring manual Start -> Completed
        if (isPaymentReq && Number(finalSrStatusId) === 3) {
          updateClauses.push(`process_status = 9`); // 9 = Completed
          updateClauses.push(`process_start_date = COALESCE(process_start_date, CURRENT_TIMESTAMP)`);
          updateClauses.push(`process_end_date = CURRENT_TIMESTAMP`);
          logUpdates.push({ timestamp: new Date().toISOString(), user: user.employee_id, action: 'approved and auto-completed request' });
        }

        // Automation: Update linked payment or invoice status when request is approved
        if (isPaymentReq) {
          try {
            const payUpdateRes = await client.query(
              `UPDATE "payment" 
               SET payment_status = 31 
               WHERE payment_request = $1 OR (request = $1 AND payment_status IN (30, 121))
               RETURNING payment_id, request, contract_id`,
              [record.request_id]
            );
            console.log(`[Automation] Updated payment for request ${record.request_id} to Ready for payment (${payUpdateRes.rowCount} rows)`);
            payUpdateRes.rows.forEach(pRow => {
              try {
                broadcastSSE('db_change', {
                  action: 'update',
                  table: 'payment',
                  id: pRow.payment_id,
                  record: { payment_id: pRow.payment_id, payment_status: 31, request: pRow.request || record.request_id, contract_id: pRow.contract_id }
                });
              } catch (bErr) {
                console.warn('Failed to broadcast SSE for payment status update:', bErr);
              }
            });
          } catch (e) {
            console.error('[Automation Error] Payment update failed:', e);
          }
        } else if (reqTypeStr === '12' || reqTypeStr.toUpperCase() === 'INV') {
          try {
            const invUpdateRes = await client.query(
              `UPDATE "invoice" SET invoice_status = 35, updated_date = CURRENT_TIMESTAMP WHERE request = $1 OR invoice_request = $1 RETURNING invoice_id, request`,
              [record.request_id]
            );
            console.log(`[Automation] Updated invoice for request ${record.request_id} to Ready to issue (${invUpdateRes.rowCount} rows)`);
            invUpdateRes.rows.forEach(iRow => {
              try {
                broadcastSSE('db_change', {
                  action: 'update',
                  table: 'invoice',
                  id: iRow.invoice_id,
                  record: { invoice_id: iRow.invoice_id, invoice_status: 35, request: iRow.request || record.request_id }
                });
              } catch (bErr) {
                console.warn('Failed to broadcast SSE for invoice status update:', bErr);
              }
            });
          } catch (e) {
            console.error('[Automation Error] Invoice update failed:', e);
          }
        }
      }

      if (dateUpdates.length > 0) {
        updateClauses.push(...dateUpdates);
      }

      if (logUpdates.length > 0) {
        updateClauses.push(`log = COALESCE(log, '[]'::jsonb) || $${valIdx++}::jsonb`);
        values.push(JSON.stringify(logUpdates));
      }

      await client.query(`UPDATE request SET ${updateClauses.join(', ')} WHERE request_id = $1`, values);

    } else { // Reject
      const level = flow.current_level;
      const stepIdx = level - 1;
      let emails = [null];
      if (flow && flow.steps) {
        flow.steps.forEach(s => emails[s.level] = s.approver);
      }
      const currentApprover = (emails[level] || '').trim().toLowerCase();
      const userIdentities = [user.employee_id, user.email, user.username]
        .filter(Boolean)
        .map(v => String(v).trim().toLowerCase());
      const isCurrentApprover = currentApprover && userIdentities.includes(currentApprover);
      const isSuperAdminUser = user.role && user.role.toUpperCase() === 'SUPER ADMIN';
      if (!isCurrentApprover && !isSuperAdminUser) {
        throw new Error(`You are not authorized to reject Tier ${level}`);
      }

      const tzTimeStr = new Date().toISOString();

      flow.steps[stepIdx].status = 4;
      flow.steps[stepIdx].action_by = user.employee_id;
      flow.steps[stepIdx].action_date = tzTimeStr;
      const rejectLog = { timestamp: tzTimeStr, user: user.employee_id, action: `rejected Tier ${level}` };
      if (!Array.isArray(flow.audit_log)) flow.audit_log = [];
      flow.audit_log.push(rejectLog);

      let updateClauses = [
        `approval_flow = $2`, `sr_status = 4`, `log = COALESCE(log, '[]'::jsonb) || $3::jsonb`
      ];
      let rejectValues = [record_id, JSON.stringify(flow), JSON.stringify([rejectLog])];

      await client.query(
        `UPDATE request SET ${updateClauses.join(', ')} WHERE request_id = $1`,
        rejectValues
      );

      // If Payment Request is rejected, revert linked payment back to Draft (30) and clear payment_request so user can edit and re-submit
      const reqTypeStr = String(record.request_type || '');
      if (reqTypeStr === '5' || reqTypeStr.toUpperCase() === 'RPM') {
        try {
          const payRevertRes = await client.query(
            `UPDATE "payment" 
             SET payment_status = 30, payment_request = NULL 
             WHERE payment_request = $1
             RETURNING payment_id, request, contract_id`,
            [record.request_id]
          );
          payRevertRes.rows.forEach(pRow => {
            try {
              broadcastSSE('db_change', {
                action: 'update',
                table: 'payment',
                id: pRow.payment_id,
                record: { payment_id: pRow.payment_id, payment_status: 30, payment_request: null, request: pRow.request, contract_id: pRow.contract_id }
              });
            } catch (e) {}
          });
        } catch (e) {
          console.error('[Reject Automation Error] Payment revert failed:', e);
        }
      }
    }
}

async function cancelRequest({ client, record, record_id, user, action_id, data }) {
    // Cancel
    const tzTimeStr = new Date().toISOString();
    const logEntry = { timestamp: tzTimeStr, user: user.employee_id, action: 'cancelled request' };
    await client.query(
      `UPDATE request SET sr_status = 5, process_status = 117, sr_close_date = CURRENT_TIMESTAMP, log = COALESCE(log, '[]'::jsonb) || $2::jsonb WHERE request_id = $1`,
      [record_id, JSON.stringify([logEntry])]
    );

    // If Payment Request is cancelled, revert linked payment back to Draft (30) and clear payment_request
    const reqTypeStr = String(record.request_type || '');
    if (reqTypeStr === '5' || reqTypeStr.toUpperCase() === 'RPM') {
      try {
        const payRevertRes = await client.query(
          `UPDATE "payment" 
           SET payment_status = 30, payment_request = NULL 
           WHERE payment_request = $1
           RETURNING payment_id, request, contract_id`,
          [record_id]
        );
        payRevertRes.rows.forEach(pRow => {
          try {
            broadcastSSE('db_change', {
              action: 'update',
              table: 'payment',
              id: pRow.payment_id,
              record: { payment_id: pRow.payment_id, payment_status: 30, payment_request: null, request: pRow.request, contract_id: pRow.contract_id }
            });
          } catch (e) {}
        });
      } catch (e) {
        console.error('[Cancel Automation Error] Payment revert failed:', e);
      }
    }
}

async function closeRequest({ client, record, record_id, user, action_id, data }) {
    // Closed — also saves rating if provided via req.body.data
    const closedData = data || {};
    const ratingVal = closedData.rating != null ? JSON.stringify(closedData.rating) : null;
    const tzTimeStr = new Date().toISOString();
    const logEntry = { timestamp: tzTimeStr, user: user.employee_id, action: 'closed request' };
    await client.query(
      `UPDATE request SET sr_status = 5, process_status = 9, sr_close_date = CURRENT_TIMESTAMP,
       rating = COALESCE($2::jsonb, rating),
       log = COALESCE(log, '[]'::jsonb) || $3::jsonb WHERE request_id = $1`,
      [record_id, ratingVal, JSON.stringify([logEntry])]
    );
}

async function completeRequest({ client, record, record_id, user, action_id, data }) {
    // Complete
    const tzTimeStr = new Date().toISOString();
    const logEntry = { timestamp: tzTimeStr, user: user.employee_id, action: 'completed request' };
    await client.query(
      `UPDATE request SET process_status = 9, process_end_date = CURRENT_TIMESTAMP, log = COALESCE(log, '[]'::jsonb) || $2::jsonb WHERE request_id = $1`,
      [record_id, JSON.stringify([logEntry])]
    );
}

async function startRequest({ client, record, record_id, user, action_id, data }) {
    // Start
    const tzTimeStr = new Date().toISOString();
    const logEntry = { timestamp: tzTimeStr, user: user.employee_id, action: 'started request processing' };
    await client.query(
      `UPDATE request SET process_status = 8, process_start_date = CURRENT_TIMESTAMP, log = COALESCE(log, '[]'::jsonb) || $2::jsonb WHERE request_id = $1`,
      [record_id, JSON.stringify([logEntry])]
    );

    // AUTOMATION: If this request is a Payment Request (type '5') and it is started,
    // update the corresponding payment's status to 'Ready for payment'
    if (record.request_type === '5' || record.request_type === 'RPM') {
      try {
        await client.query(
          `UPDATE "payment" SET payment_status = 31 WHERE request = $1 OR payment_request = $1`,
          [record_id]
        );
        console.log(`[Automation] Started request ${record_id}: updated linked payment to Ready for payment`);
      } catch (e) {
        console.error('[Automation Error] Payment ready update failed:', e);
      }
    }

    // TASK MANAGEMENT: If the request has the ASSIGN_TASK element active, create tasks for the assignees
    let activeElements = [];
    let elementsVal = record.elements;
    if (!elementsVal) {
      try {
        const policyRes = await client.query('SELECT elements FROM policy_and_program WHERE policy_id = $1', [record.request_type]);
        if (policyRes.rows.length > 0) {
          elementsVal = policyRes.rows[0].elements;
        }
      } catch (e) {
        console.error('[Action elements fetch error]', e);
      }
    }
    if (elementsVal) {
      if (Array.isArray(elementsVal)) {
        activeElements = elementsVal.map(s => String(s).replace(/^\[|\]$/g, '').trim().toUpperCase());
      } else if (typeof elementsVal === 'string') {
        activeElements = elementsVal.split(',').map(s => String(s).trim().replace(/^\[|\]$/g, '').toUpperCase()).filter(Boolean);
      }
    }

    if (activeElements.includes('ASSIGN_TASK')) {
      const { assign_to, deadline, description, task_info_link, task_info_guide_file, task_info_notes, tasks, has_existing_tasks } = data || {};
      
      // Check if tasks already exist for this request
      const existingTasksRes = await client.query(
        'SELECT task_id, employee_id, deadline FROM "assigned_task" WHERE "request_id" = $1 AND "deleted_at" IS NULL',
        [record_id]
      );

      let tasksList = [];
      if (Array.isArray(tasks) && tasks.length > 0) {
        tasksList = tasks;
      } else if (assign_to && description) {
        let assignToArr = [];
        if (Array.isArray(assign_to)) {
          assignToArr = assign_to.map(s => String(s).trim().replace(/^\[|\]$/g, '')).filter(Boolean);
        } else if (typeof assign_to === 'string') {
          assignToArr = assign_to.split(',').map(s => String(s).trim().replace(/^\[|\]$/g, '')).filter(Boolean);
        }
        if (assignToArr.length > 0) {
          tasksList = assignToArr.map(empId => ({
            employee_id: empId,
            description,
            deadline,
            task_info_link,
            task_info_guide_file,
            task_info_notes
          }));
        }
      } else if (existingTasksRes.rows.length > 0) {
        // Tasks were already created (e.g. at request creation wizard) - notify assignees
        for (const tRow of existingTasksRes.rows) {
          const title = '[Task Started / Nhiệm vụ bắt đầu]';
          const body = 'Request/Yêu cầu: ' + (record_id || '') + '. Deadline: ' + (tRow.deadline || 'N/A') + '.';
          const link = `#assigned_task/${tRow.task_id}`;
          await createNotification([tRow.employee_id], title, body, link).catch(() => {});
        }
        tasksList = [];
      } else {
        if (!assign_to) {
          throw new Error("task.err.select_assignee");
        }
        if (!description) {
          throw new Error("task.err.enter_description");
        }
        let assignToArr = [];
        if (Array.isArray(assign_to)) {
          assignToArr = assign_to.map(s => String(s).trim().replace(/^\[|\]$/g, '')).filter(Boolean);
        } else if (typeof assign_to === 'string') {
          assignToArr = assign_to.split(',').map(s => String(s).trim().replace(/^\[|\]$/g, '')).filter(Boolean);
        }
        if (assignToArr.length === 0) {
          throw new Error("task.err.require_at_least_one");
        }
        tasksList = assignToArr.map(empId => ({
          employee_id: empId,
          description,
          deadline,
          task_info_link,
          task_info_guide_file,
          task_info_notes
        }));
      }

      // Loop through each assignee to create the tasks
      for (const taskData of tasksList) {
        const employeeId = taskData.employee_id;
        const taskDesc = taskData.description;
        const taskDeadline = taskData.deadline;
        const taskLink = taskData.task_info_link;
        const taskNotes = taskData.task_info_notes;

        if (!employeeId) continue;
        if (!taskDesc) {
          throw new Error("task.err.enter_description");
        }

        // Process guide file upload if it is a base64 string
        let processedData = { task_info_guide_file: taskData.task_info_guide_file };
        processBase64Fields(processedData, 'assigned_task');
        const finalGuideFile = processedData.task_info_guide_file || null;

        const taskId = await generateSequentialId('assigned_task', client);
        
        await client.query(
          `INSERT INTO "assigned_task" (
            task_id, request_id, employee_id, deadline, description, 
            task_info_link, task_info_guide_file, task_info_notes, status, log
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            taskId, record_id, employeeId, taskDeadline || null, taskDesc,
            taskLink || null, finalGuideFile, taskNotes || null, 62,
            JSON.stringify([{ timestamp: tzTimeStr, user: user.employee_id, action: 'created task from request start' }])
          ]
        );

        // Trigger notification to this employee
        const title = '[New Task / Công việc mới]';
        const body = 'Request/Yêu cầu: ' + (record_id || '') + '. Deadline/Hạn hoàn thành: ' + (taskDeadline || 'N/A') + '.';
        const link = `#assigned_task/${taskId}`;
        await createNotification([employeeId], title, body, link);
      }
    }
}

module.exports = {
  changeSrOwner,
  updateElements,
  rateRequest,
  updateProcessStatus,
  submitRequest,
  withdrawRequest,
  approveOrRejectRequest,
  cancelRequest,
  closeRequest,
  completeRequest,
  startRequest
};
