const pool = require('../db');

/**
 * Normalizes table names to match how they are stored in audit_logs.
 * Handles views and schema aliases (e.g. policy -> policy_and_program, support -> ticket).
 */
function resolveAuditTableNames(tableName) {
  if (!tableName) return [];
  const lower = tableName.toLowerCase().trim();
  const set = new Set([lower]);

  if (['request', 'my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team'].includes(lower)) {
    set.add('request');
  } else if (lower === 'policy' || lower === 'policy_and_program' || lower === 'opportunity_list') {
    set.add('policy_and_program');
    set.add('policy');
  } else if (lower === 'support' || lower === 'ticket') {
    set.add('ticket');
    set.add('support');
  } else if (lower === 'oppo' || lower === 'opportunity' || lower === 'oppotunity') {
    set.add('oppotunity');
  } else if (lower === 'my_company' || lower === 'my-company') {
    set.add('my_company');
  } else if (lower === 'v_department' || lower === 'departments' || lower === 'department') {
    set.add('department');
  } else if (lower === 'employee_active' || lower === 'employees' || lower === 'employee') {
    set.add('employee');
  } else if (lower === 'companies' || lower === 'company') {
    set.add('company');
  } else if (lower === 'contacts' || lower === 'contact') {
    set.add('contact');
  } else if (lower === 'target_records' || lower === 'target_table') {
    set.add('target_table');
  }

  return Array.from(set);
}

/**
 * Fetches audit log records for a given table and record ID, and merges with any
 * existing JSON logs stored directly in the record's log column.
 * Deduplicates entries and returns them in chronological order.
 *
 * @param {string} tableName
 * @param {string|number} recordId
 * @param {Array|string|null} existingRecordLog
 * @returns {Promise<Array>}
 */
async function getRecordAuditLogs(tableName, recordId, existingRecordLog = null) {
  if (!recordId) {
    if (existingRecordLog) {
      return typeof existingRecordLog === 'string' ? JSON.parse(existingRecordLog) : existingRecordLog;
    }
    return [];
  }

  try {
    const tableNames = resolveAuditTableNames(tableName);
    let logsRes;
    if (tableNames.includes('request')) {
      const childQueries = await Promise.all([
        pool.query('SELECT comment_id::text AS id FROM comment WHERE request::text = $1', [recordId]).catch(() => ({ rows: [] })),
        pool.query('SELECT payment_id::text AS id FROM payment WHERE request::text = $1', [recordId]).catch(() => ({ rows: [] })),
        pool.query('SELECT invoice_id::text AS id FROM invoice WHERE request::text = $1', [recordId]).catch(() => ({ rows: [] })),
        pool.query('SELECT id::text AS id FROM expense WHERE id__request::text = $1', [recordId]).catch(() => ({ rows: [] })),
        pool.query('SELECT contract_id::text AS id FROM contract WHERE request::text = $1', [recordId]).catch(() => ({ rows: [] })),
        pool.query('SELECT office_asset_id::text AS id FROM asset WHERE request::text = $1', [recordId]).catch(() => ({ rows: [] })),
        pool.query('SELECT service_id::text AS id FROM service WHERE request::text = $1', [recordId]).catch(() => ({ rows: [] })),
        pool.query('SELECT task_id::text AS id FROM assigned_task WHERE request_id::text = $1', [recordId]).catch(() => ({ rows: [] })),
        pool.query('SELECT id::text AS id FROM target_table WHERE request::text = $1', [recordId]).catch(() => ({ rows: [] })),
        pool.query('SELECT id::text AS id FROM request_rating WHERE request_id::text = $1', [recordId]).catch(() => ({ rows: [] })),
      ]);

      const tableMap = ['comment', 'payment', 'invoice', 'expense', 'contract', 'asset', 'service', 'assigned_task', 'target_table', 'request_rating'];
      const targetPairs = tableNames.map(t => ({ table: t, id: String(recordId) }));
      childQueries.forEach((q, idx) => {
        const tbl = tableMap[idx];
        q.rows.forEach(r => {
          if (r.id) targetPairs.push({ table: tbl, id: String(r.id) });
        });
      });

      const whereClauses = targetPairs.map((_, i) => `(table_name = $${i * 2 + 1} AND record_id::text = $${i * 2 + 2}::text)`).join(' OR ');
      const params = [];
      targetPairs.forEach(p => { params.push(p.table); params.push(p.id); });

      logsRes = await pool.query(`
        SELECT created_at as timestamp, changed_by as user, 
               table_name, record_id,
               CASE WHEN table_name = 'comment' THEN 'commented' ELSE action END as action, 
               changes 
        FROM audit_logs 
        WHERE ${whereClauses}
        ORDER BY created_at ASC
      `, params);
    } else {
      const placeholders = tableNames.map((_, i) => `$${i + 1}`).join(',');
      const idParamIdx = tableNames.length + 1;
      const logsQuery = `
        SELECT created_at as timestamp, changed_by as user, 
               table_name, record_id,
               CASE WHEN table_name = 'comment' THEN 'commented' ELSE action END as action, 
               changes 
        FROM audit_logs 
        WHERE (table_name IN (${placeholders}) AND record_id::text = $${idParamIdx}::text)
        ORDER BY created_at ASC
      `;
      logsRes = await pool.query(logsQuery, [...tableNames, String(recordId)]);
    }

    // Filter out internal notification log changes and format child actions
    const filteredRows = logsRes.rows.filter(row => {
      if (row.changes && typeof row.changes === 'object') {
        const keys = Object.keys(row.changes);
        if (keys.length === 1 && keys[0] === 'notification_logs') {
          return false;
        }
      }
      return true;
    }).map(row => {
      if (row.action === 'commented' || (row.changes && row.changes.comment && row.table_name === 'comment')) {
        const cmtVal = row.changes?.comment?.new !== undefined ? row.changes.comment.new : row.changes?.comment;
        return {
          ...row,
          action: 'commented',
          comment_text: typeof cmtVal === 'string' ? cmtVal.trim() : cmtVal
        };
      }

      // Detect approval / rejection in approval_flow
      if (row.changes && row.changes.approval_flow) {
        const newFlow = row.changes.approval_flow.new || row.changes.approval_flow;
        const oldFlow = row.changes.approval_flow.old;
        if (newFlow && Array.isArray(newFlow.steps)) {
          // Find step with action
          const actedStep = newFlow.steps.find(ns => {
            if (!oldFlow || !Array.isArray(oldFlow.steps)) return ns.status === 3 || ns.status === 4;
            const os = oldFlow.steps.find(s => s.level === ns.level);
            return (!os || os.status !== ns.status || (!os.action_by && ns.action_by));
          });
          if (actedStep) {
            const isApproved = actedStep.status === 3 || actedStep.status_key === 'approved';
            const isRejected = actedStep.status === 4 || actedStep.status_key === 'rejected';
            if (isApproved || isRejected) {
              const actWord = isApproved ? 'approved' : 'rejected';
              return {
                ...row,
                action: `${actWord} Tier ${actedStep.level}`,
                approval_step: actedStep.level,
                approval_status: isApproved ? 'Approved' : 'Rejected'
              };
            }
          }
        }
      }

      // Detect request workflow status transitions
      if (row.table_name === 'request' && row.changes && typeof row.changes === 'object') {
        const ch = row.changes;
        if (ch.sr_status && (Number(ch.sr_status.new) === 5 || ch.sr_status.new === 'Cancelled')) {
          return { ...row, action: 'cancelled request' };
        }
        if ((ch.sr_status && Number(ch.sr_status.old) === 1 && [2, 3].includes(Number(ch.sr_status.new))) ||
            (ch.sr_submitted_date && ch.sr_submitted_date.new && !ch.sr_submitted_date.old)) {
          return { ...row, action: 'submitted request' };
        }
        if ((ch.sr_status && Number(ch.sr_status.old) === 2 && Number(ch.sr_status.new) === 1) ||
            (ch.sr_submitted_date && !ch.sr_submitted_date.new && ch.sr_submitted_date.old)) {
          return { ...row, action: 'withdrew request' };
        }
        if (ch.process_status && (Number(ch.process_status.new) === 9 || ch.process_status.new === 'Completed')) {
          return { ...row, action: 'completed request' };
        }
        if (ch.process_status && Number(ch.process_status.new) === 8 && Number(ch.process_status.old) === 7) {
          return { ...row, action: 'started request processing' };
        }
        if (ch.sr_owner && Object.keys(ch).filter(k => k !== 'updated_date').length <= 2 && !ch.sr_status) {
          const newO = ch.sr_owner.new;
          const ownersStr = Array.isArray(newO) ? newO.join(', ') : (newO || '');
          return { ...row, action: `reassigned SR Owner to [${ownersStr}]` };
        }
        if (ch.elements && Object.keys(ch).filter(k => k !== 'updated_date').length <= 2 && !ch.sr_status) {
          return { ...row, action: 'updated elements' };
        }
        if (ch.rating && ch.rating.new) {
          return { ...row, action: 'rated and closed request' };
        }
      }

      // Detect payment status transitions
      if (row.table_name === 'payment' && row.changes && typeof row.changes === 'object') {
        const ch = row.changes;
        if (ch.payment_status && [32, '32', 'Paid', 'paid'].includes(ch.payment_status.new)) {
          return { ...row, action: 'paid payment' };
        }
        if (ch.payment_status && [31, '31', 'Ready for payment'].includes(ch.payment_status.new)) {
          return { ...row, action: 'ready for payment' };
        }
      }

      // Detect invoice status transitions
      if (row.table_name === 'invoice' && row.changes && typeof row.changes === 'object') {
        const ch = row.changes;
        if (ch.invoice_status && [37, '37', 'Paid', 'paid'].includes(ch.invoice_status.new)) {
          return { ...row, action: 'paid invoice' };
        }
        if (ch.invoice_status && [36, '36', 'Issued', 'issued'].includes(ch.invoice_status.new)) {
          return { ...row, action: 'issued invoice' };
        }
      }

      if (row.table_name && !tableNames.includes(row.table_name)) {
        const act = String(row.action || '').toLowerCase();
        let formattedAction = act;
        const targetEntity = row.table_name === 'request_rating' ? 'feedback' : row.table_name;
        if (act.includes('created') || act === 'insert') {
          formattedAction = `added ${targetEntity}`;
        } else if (act.includes('updated') || act === 'update') {
          if (row.changes && row.changes.deleted_at && (row.changes.deleted_at.new || row.changes.deleted_at)) {
            formattedAction = `deleted ${targetEntity}`;
          } else {
            formattedAction = `updated ${targetEntity}`;
          }
        } else if (act.includes('deleted') || act === 'delete') {
          formattedAction = `deleted ${targetEntity}`;
        }
        return {
          ...row,
          action: formattedAction
        };
      }

      return row;
    });

    // Merge existingRecordLog entries if present
    let existingLogs = [];
    if (existingRecordLog) {
      if (typeof existingRecordLog === 'string') {
        try {
          existingLogs = JSON.parse(existingRecordLog);
        } catch (e) {
          existingLogs = [{ action: existingRecordLog }];
        }
      } else if (Array.isArray(existingRecordLog)) {
        existingLogs = existingRecordLog;
      } else if (typeof existingRecordLog === 'object') {
        existingLogs = [existingRecordLog];
      }
    }

    if (tableNames.includes('request')) {
      const combined = [...filteredRows];
      existingLogs.forEach(eLog => {
        const eTime = eLog.timestamp ? new Date(eLog.timestamp).getTime() : 0;
        const eAction = String(eLog.action || '').trim().toLowerCase();
        const exists = combined.some(r => {
          const rTime = r.timestamp ? new Date(r.timestamp).getTime() : 0;
          const rAction = String(r.action || '').trim().toLowerCase();
          return Math.abs(rTime - eTime) < 5000 && (rAction === eAction || (rAction.includes('create') && eAction.includes('create')));
        });
        if (!exists) {
          combined.push({
            timestamp: eLog.timestamp || new Date().toISOString(),
            user: eLog.user || 'system',
            action: eLog.action || 'updated record',
            changes: eLog.changes || null
          });
        }
      });
      combined.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      return combined;
    }

    const combined = [...existingLogs];

    logsRes.rows.forEach(row => {
      const rowDate = row.timestamp ? new Date(row.timestamp).getTime() : 0;
      const rowAction = String(row.action || '').trim().toLowerCase();
      const rowUser = String(row.user || '').trim().toLowerCase();

      const matchingIdx = combined.findIndex(item => {
        const itemDateStr = item.timestamp || item.at || item.log_time || item.created_at || '';
        const itemDate = itemDateStr ? new Date(itemDateStr).getTime() : 0;
        const timeDiff = Math.abs(rowDate - itemDate);

        const itemAction = String(item.action || '').trim().toLowerCase();
        const itemUser = String(item.user || item.by || item.username || item.changed_by || '').trim().toLowerCase();

        // 1. Exact match within 5s
        if (timeDiff <= 5000 && itemAction === rowAction && (itemUser === rowUser || itemUser === 'system' || rowUser === 'system' || !itemUser || !rowUser)) {
          return true;
        }

        // 2. Generic trigger 'updated record' vs specific manual action within 5s
        if (timeDiff <= 5000) {
          const isRowGeneric = rowAction === 'updated record' || rowAction === 'created record';
          const isItemGeneric = itemAction === 'updated record' || itemAction === 'created record';
          if (isRowGeneric !== isItemGeneric) {
            if (!itemUser || !rowUser || itemUser === rowUser || itemUser === 'system' || rowUser === 'system') {
              return true;
            }
          }
        }

        return false;
      });

      if (matchingIdx !== -1) {
        const existingItem = combined[matchingIdx];
        if (row.changes && !existingItem.changes) {
          existingItem.changes = row.changes;
        }
        if ((!existingItem.user || existingItem.user === 'system') && row.user && row.user !== 'system') {
          existingItem.user = row.user;
        }
        if (existingItem.action === 'updated record' && row.action && row.action !== 'updated record') {
          existingItem.action = row.action;
        }
      } else {
        combined.push(row);
      }
    });

    return combined;
  } catch (err) {
    console.error(`[getRecordAuditLogs] Error for ${tableName} #${recordId}:`, err.message);
    if (existingRecordLog) {
      return typeof existingRecordLog === 'string' ? JSON.parse(existingRecordLog) : (existingRecordLog || []);
    }
    return [];
  }
}

module.exports = {
  resolveAuditTableNames,
  getRecordAuditLogs
};
