const { eventBus, EVENTS } = require('../core/events');
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { z } = require('zod');
const { STATUS, getStatusKey, resolveStatusId, getRecordStatusId, getRecordStatusKey, enrichRecordWithStatusCatalog } = require('../helpers/statuses');
const hashidHelper = require('../helpers/hashidHelper');

const {
  executeSchema,
  ratingsDataSchema,
  isRequestParticipant,
  processBase64Fields,
  isValidTable,
  getPoolForTable,
  normalizeEmail,
  ACTION_LOGIC,
  getBaseTable,
} = require('../../modules/workflow/server/actions.helpers');
const requestActions = require('../../modules/request/server/request.actions');
const paymentActions = require('../../modules/payment/server/payment.actions');
const supportActions = require('../../modules/support/server/support.actions');
const { broadcastSSE } = require('../helpers/sseHelper');
const { triggerNotifications, createNotification } = require('../helpers/notificationHelper');
const { isAutomationActive, logAutomationRun } = require('../helpers/automationHelper');
const RequestModel = require('../models/requestModel');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { generateSequentialId } = require('../helpers/idGenerator');

router.get('/:tableName/:recordId', async (req, res) => {
  let { tableName, recordId } = req.params;

  if (['finance', 'v_finance'].includes(tableName)) {
    return res.json([]);
  }
  tableName = getBaseTable(tableName);
  if (!isValidTable(tableName)) {
    return res.status(403).json({ error: `Access denied: table '${tableName}' is invalid or restricted.` });
  }
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    // Determine primary key column based on table name
    let pkColumn = `${tableName}_id`;
    if (tableName === 'employee') pkColumn = 'employee_id';
    if (tableName === 'policy_and_program' || tableName === 'policy' || tableName === 'my_product_and_service') pkColumn = 'policy_id';
    if (tableName === 'finance' || tableName === 'v_finance') pkColumn = 'id';
    if (tableName === 'asset') pkColumn = 'office_asset_id';
    if (tableName === 'my_company') pkColumn = 'my_company_id';
    if (tableName === 'operation_program') pkColumn = 'oper_id';
    if (tableName === 'assigned_task') pkColumn = 'task_id';
    if (tableName === 'task_subtask') pkColumn = 'subtask_id';
    if (tableName === 'mtr') pkColumn = 'transaction_id';
    if (tableName === 'oppotunity' || tableName === 'opportunity') pkColumn = 'project_id';
    if (['expense', 'column_permissions', 'exception_rules', 'action_rules', 'uploaded_files', 'permission_positions', 'permission_roles', 'permission_exceptions'].includes(tableName)) pkColumn = 'id';

    // Fetch the record
    const rawRecordId = String(recordId);
    const decodedRecordId = String(hashidHelper.decode(recordId));
    let whereClause = `(${pkColumn}::text = $1 OR ${pkColumn}::text = $2`;
    if (tableName === 'action_rules') {
      whereClause += ` OR action_id = $1 OR action_id = $2`;
    }
    whereClause += `)`;
    const queryStr = tableName === 'employee'
      ? `SELECT * FROM "employee" WHERE employee_id = $1 OR email = $1 OR username = $1 OR employee_id = $2 OR email = $2 OR username = $2`
      : `SELECT * FROM "${tableName}" WHERE ${whereClause}`;
    const recordResult = await getPoolForTable(tableName).query(queryStr, [rawRecordId, decodedRecordId]);
    if (recordResult.rows.length === 0) return res.status(404).json({ error: 'Record not found' });
    const record = recordResult.rows[0];
    enrichRecordWithStatusCatalog(tableName, record);

    // Fetch action rules for this table or view
    const viewName = req.query.view || tableName;
    const rulesResult = await getPoolForTable(tableName).query(`SELECT * FROM action_rules`);
    const allowedTicketActions = ['ACT-TICKET-03', 'ACT-TICKET-03-RE', 'ACT-TICKET-05', 'withdraw_ticket'];
    const rules = rulesResult.rows.filter(rule => {
      if (rule.display === false || String(rule.display).toLowerCase() === 'false') return false;
      // Exclude CRUD permission rules (add_*, edit_*, delete_*) — these control
      // the toolbar Add/Edit/Delete buttons, NOT custom workflow action buttons.
      if (/^(add|edit|delete)(_.*)?$/i.test(rule.action_id || '')) return false;
      if (tableName === 'ticket' && !allowedTicketActions.includes(rule.action_id)) return false;
      if (!rule.view_name) return true;
      const views = rule.view_name.split(',').map(v => v.trim().replace(/^\[|\]$/g, '').toLowerCase());
      return views.includes(viewName.toLowerCase());
    });

    // --- DOT NOTATION PREFETCH LOGIC ---
    // Scan all rules to find if we need to prefetch any parent records like [request.sr_owner]
    const parentRecords = {};
    for (const rule of rules) {
      const roles = rule.roles ? rule.roles.split(',').map(s => s.trim()) : [];
      for (const r of roles) {
        if (r.startsWith('[') && r.endsWith(']')) {
          const roleStr = r.slice(1, -1).trim();
          const parts = roleStr.split('.');
          if (parts.length === 2) {
            const refCol = parts[0].toLowerCase(); // e.g., 'request'
            const foreignKeyVal = record[refCol] || record[refCol + '_id'];
            if (foreignKeyVal && typeof foreignKeyVal === 'string' && !parentRecords[refCol]) {
              // Predict PK as table_id (e.g., request -> request_id)
              const pk = `${refCol}_id`;
              try {
                const pRes = await getPoolForTable(refCol).query(`SELECT * FROM "${refCol}" WHERE "${pk}" = $1`, [foreignKeyVal]);
                if (pRes.rows.length > 0) parentRecords[refCol] = pRes.rows[0];
              } catch (err) {
                console.log(`Dynamic dot notation fetch failed for ${refCol}:`, err.message);
                parentRecords[refCol] = null; // Mark as failed to avoid re-querying
              }
            }
          }
        }
      }
    }

    const availableActions = [];

    for (const rule of rules) {
      const actionId = rule.action_id;
      if (viewName === 'my_request' && actionId === 'ACT-REQUEST-02') continue;
      if (viewName === 'my_approval' && actionId === 'ACT-REQUEST-02') continue;
      if (['my_task', 'my_process_owner'].includes(viewName) && actionId === 'ACT-REQUEST-04') continue;
      if (
        ['my_task', 'my_process_owner'].includes(viewName) &&
        actionId === 'ACT-REQUEST-02' &&
        (
          getRecordStatusId(record, 'request', 'process_status') !== 8 ||
          getRecordStatusId(record, 'request', 'sr_status') === 5
        )
      ) continue;
      if (
        viewName === 'my_team' &&
        actionId === 'ACT-REQUEST-02' &&
        getRecordStatusId(record, 'request', 'process_status') === 9
      ) continue;
      let hasAccess = false;

      if (tableName === 'request' && ['ACT-REQUEST-03', 'ACT-REQUEST-03-RE'].includes(actionId)) {
        const isParticipant = await isRequestParticipant(record, user, pool);
        if (isParticipant) {
          hasAccess = true;
        }
      }

      if (!hasAccess) {
        if (user.role && user.role.toUpperCase() === 'SUPER ADMIN') {
          hasAccess = true;
        } else {
          // 1. Check exceptions (Email, Employee ID, Username)
          const exceptions = rule.exceptions ? rule.exceptions.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : [];
          const userIds = [user.employee_id, user.email, user.username].filter(Boolean).map(s => String(s).trim().toLowerCase());
          if (exceptions.some(ex => userIds.includes(ex))) hasAccess = true;
        }
      }

      // 2. Check levels
      const levels = rule.levels ? rule.levels.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : [];
      if (!hasAccess && levels.includes(String(user.employee_level || '').trim().toLowerCase())) hasAccess = true;

      // 3. Check positions
      const positions = rule.positions ? rule.positions.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : [];
      if (!hasAccess && positions.includes(String(user.position || '').trim().toLowerCase())) hasAccess = true;

      // 4. Check roles (Static and Dynamic with Dot Notation)
      if (!hasAccess) {
        const userRole = String(user.role || '').trim().toLowerCase();
        const roles = rule.roles ? rule.roles.split(',').map(s => s.trim()).filter(Boolean) : [];
        for (const r of roles) {
          if (!r) continue;
          const cleanRole = r.replace(/^\[|\]$/g, '').trim().toLowerCase();
          // Check static role match first (e.g. 'staff' === 'staff' or '[staff]' === 'staff')
          if (cleanRole === userRole) {
            hasAccess = true;
            break;
          }
          if (r.startsWith('[') && r.endsWith(']')) {
            const roleStr = r.slice(1, -1).trim();
            const parts = roleStr.split('.');

            if (parts.length === 2) {
              // DOT NOTATION: [request.sr_owner]
              const refCol = parts[0].toLowerCase();
              let targetField = parts[1].toLowerCase().replace(/\s+/g, '_');
              if (targetField.endsWith('_approver')) targetField = targetField.replace('_approver', '_approval');

              const pRec = parentRecords[refCol];
              if (pRec) {
                let valArr = [];
                if (targetField.startsWith('tier_') && targetField.endsWith('_approval')) {
                  try {
                    const flow = typeof pRec.approval_flow === 'string' ? JSON.parse(pRec.approval_flow) : pRec.approval_flow;
                    if (flow && Array.isArray(flow.steps)) {
                      const level = parseInt(targetField.replace('tier_', '').replace('_approval', ''));
                      const step = flow.steps.find(s => s.level === level);
                      if (step && step.approver) {
                        valArr = [step.approver.toLowerCase()];
                      }
                    }
                  } catch (e) {}
                } else if (pRec[targetField]) {
                  const fieldVal = pRec[targetField];
                  valArr = Array.isArray(fieldVal) ? fieldVal.map(s => String(s).toLowerCase()) : [String(fieldVal).toLowerCase()];
                }
                const userIds = [user.employee_id, user.email, user.username].filter(Boolean).map(s => String(s).toLowerCase());
                if (valArr.some(v => userIds.includes(v))) {
                  hasAccess = true;
                  break;
                }
              }
            } else {
              // NORMAL DYNAMIC ROLE: [sr_owner]
              let targetField = roleStr.toLowerCase().replace(/\s+/g, '_');
              if (targetField.endsWith('_approver')) targetField = targetField.replace('_approver', '_approval');

              let valArr = [];
              if (targetField.startsWith('tier_') && targetField.endsWith('_approval')) {
                try {
                  const flow = typeof record.approval_flow === 'string' ? JSON.parse(record.approval_flow) : JSON.parse(JSON.stringify(record.approval_flow || {}));
                  if (flow && Array.isArray(flow.steps)) {
                    const level = parseInt(targetField.replace('tier_', '').replace('_approval', ''));
                    const step = flow.steps.find(s => s.level === level);
                    if (step && step.approver) {
                      valArr = [step.approver.toLowerCase()];
                    }
                  }
                } catch (e) {}
              } else if (record[targetField]) {
                const fieldVal = record[targetField];
                valArr = Array.isArray(fieldVal) ? fieldVal.map(s => String(s).toLowerCase()) : [String(fieldVal).toLowerCase()];
              }
              const userIds = [user.employee_id, user.email, user.username].filter(Boolean).map(s => String(s).toLowerCase());
              if (valArr.some(v => userIds.includes(v))) {
                hasAccess = true;
                break;
              }
            }
          } else {
            // Static role
            if (r.toLowerCase().trim() === userRole) {
              hasAccess = true;
              break;
            }
          }
        }
      }

      if (!hasAccess && actionId === 'ACT-REQUEST-016' && viewName === 'my_approval') {
        try {
          const flow = typeof record.approval_flow === 'string' ? JSON.parse(record.approval_flow) : JSON.parse(JSON.stringify(record.approval_flow || {}));
          const userIds = [user.employee_id, user.email, user.username]
            .filter(Boolean)
            .map(v => String(v).trim().toLowerCase());
          hasAccess = !!(flow && Array.isArray(flow.steps) && flow.steps.some(step => {
            const approver = step && step.approver ? String(step.approver).trim().toLowerCase() : '';
            return approver && userIds.includes(approver);
          }));
        } catch (e) {
          hasAccess = false;
        }
      }

      // --- CUSTOM ACCOUNT FINANCE_CONTROL CHECK FOR MTR ACTIONS (AND CONDITION) ---
      // payment_paid, payment_update_transaction, và payment_change_mtr chỉ hiện khi 
      // thỏa mãn đồng thời phân quyền của vai trò (hasAccess = true) VÀ 
      // người dùng thuộc danh sách quản lý tài chính (finance_control hoặc transaction_managed_by) của công ty
      const mtrRequiredActions = ['payment_paid', 'payment_update_transaction', 'payment_change_mtr'];
      if (hasAccess && tableName === 'payment' && mtrRequiredActions.includes(actionId)) {
        const isSuperAdmin = user.role && user.role.toUpperCase() === 'SUPER ADMIN';
        if (!isSuperAdmin) {
          let hasFinanceAccess = false;
          try {
            const accRes = await pool.query(
              `SELECT finance_control, transaction_managed_by FROM account WHERE company_entity = $1`,
              [record.my_company]
            );
            const userIdentities = [user.employee_id, user.email, user.username].filter(Boolean).map(s => normalizeEmail(s.trim()));
            for (const row of accRes.rows) {
              if (row.finance_control) {
                const controls = row.finance_control.split(',').map(s => normalizeEmail(s.trim()));
                if (controls.some(c => userIdentities.includes(c))) {
                  hasFinanceAccess = true;
                  break;
                }
              }
              if (row.transaction_managed_by) {
                const managers = row.transaction_managed_by.split(',').map(s => normalizeEmail(s.trim()));
                if (managers.some(m => userIdentities.includes(m))) {
                  hasFinanceAccess = true;
                  break;
                }
              }
            }
          } catch (err) {
            console.error('Error checking account finance access for MTR actions:', err);
          }
          if (!hasFinanceAccess) {
            hasAccess = false;
          }
        }
      }

      // If user has access based on action_rules, check business logic (When the action to be appeared)
      if (hasAccess) {
        const logic = ACTION_LOGIC[actionId];
        // If logic is defined, evaluate it. If not defined, default to showing it for now (or false if we want strict mode).
        const meetsCondition = logic ? await logic.when(record, user) : true;

        if (meetsCondition) {
          let label = (rule.display_name && rule.display_name.trim() !== '') ? rule.display_name.trim() : (logic ? logic.label : actionId);

          // Append Tier dynamically if the action is approve_request or reject_request
          if (actionId === 'approve_request' || actionId === 'reject_request') {
            try {
              const flow = typeof record.approval_flow === 'string' ? JSON.parse(record.approval_flow) : JSON.parse(JSON.stringify(record.approval_flow || {}));
              if (flow && flow.current_level) {
                if (actionId === 'approve_request') {
                  const level = flow.current_level;
                  let emails = [null];
                  if (flow && flow.steps) {
                    flow.steps.forEach(s => emails[s.level] = s.approver);
                  }
                  let checkLevel = level;
                  let approvedCount = 0;
                  const userIdentities = [user.employee_id, user.email, user.username].filter(Boolean).map(s => String(s).trim().toLowerCase());
                  while (checkLevel <= flow.total_levels) {
                    const approverEmailForThisLevel = (emails[checkLevel] || '').trim().toLowerCase();
                    const isApprover = approverEmailForThisLevel && userIdentities.includes(approverEmailForThisLevel);
                    const isSuperAdmin = user.role && user.role.toUpperCase() === 'SUPER ADMIN';
                    if (isApprover || (isSuperAdmin && checkLevel === level)) {
                      approvedCount++;
                      if (!isApprover) {
                        break;
                      }
                      checkLevel++;
                    } else {
                      break;
                    }
                  }
                  if (approvedCount > 1) {
                    label = (rule.display_name && rule.display_name.trim() !== '') ? rule.display_name.trim() : 'Approve';
                  } else {
                    label = `${label} (Tier ${level})`;
                  }
                } else {
                  label = `${label} (Tier ${flow.current_level})`;
                }
              }
            } catch (e) {
              console.warn('Error parsing approval_flow for dynamic label:', e);
            }
          }

          availableActions.push({
            action_id: actionId,
            label: label,
            description: (rule.description && rule.description.trim() !== '') ? rule.description.trim() : '',
            color: logic ? logic.color : 'var(--accent)',
            icon: logic ? logic.icon : null
          });
        }
      }
    }

    res.json(availableActions);
  } catch (err) {
    console.error('Error fetching actions:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/request/:id/participants', async (req, res) => {
  const { id } = req.params;
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const reqRes = await pool.query('SELECT requester, sr_creater, sr_owner, policy_lead, approval_flow FROM request WHERE request_id = $1', [id]);
    if (reqRes.rows.length === 0) return res.status(404).json({ error: 'Request not found' });
    const r = reqRes.rows[0];

    const rawIds = new Set();
    const roleMap = new Map();

    const addRole = (identifier, role) => {
      if (!identifier) return;
      const clean = String(identifier).trim();
      if (!clean) return;
      rawIds.add(clean);
      const lc = clean.toLowerCase();
      if (!roleMap.has(lc)) roleMap.set(lc, new Set());
      roleMap.get(lc).add(role);
    };

    if (r.requester) addRole(r.requester, 'Requester');
    if (r.sr_creater) addRole(r.sr_creater, 'SR Creator');
    if (r.policy_lead) addRole(r.policy_lead, 'Policy Lead');
    if (r.sr_owner) {
      const owners = Array.isArray(r.sr_owner) ? r.sr_owner : [r.sr_owner];
      owners.forEach(o => addRole(o, 'SR Owner'));
    }
    if (r.approval_flow) {
      let flow = r.approval_flow;
      if (typeof flow === 'string') {
        try { flow = JSON.parse(flow); } catch(e){}
      }
      if (flow && Array.isArray(flow.steps)) {
        flow.steps.forEach(step => {
          if (step.approver) {
            const roleName = step.level !== undefined ? `Approver Tier ${step.level}` : (step.role || 'Approver');
            addRole(step.approver, roleName);
          }
        });
      }
    }

    // Get assigned tasks
    try {
      const taskRes = await pool.query('SELECT employee_id FROM assigned_task WHERE request_id = $1 AND deleted_at IS NULL', [id]);
      taskRes.rows.forEach(t => addRole(t.employee_id, 'Task Assignee'));
    } catch (e) {}

    // Get tags from comments
    const commentRes = await pool.query('SELECT tag FROM comment WHERE request::text = $1::text AND tag IS NOT NULL AND tag <> \'\'', [id]);
    commentRes.rows.forEach(row => {
      const tags = row.tag.split(',').map(t => t.trim()).filter(Boolean);
      tags.forEach(t => addRole(t, 'Participant'));
    });

    const uniqueIds = Array.from(rawIds);
    if (uniqueIds.length === 0) {
      return res.json({ data: [] });
    }

    const queryIds = uniqueIds.map(id => id.toLowerCase());
    const empRes = await pool.query(
      `SELECT employee_id, full_name, email, username 
       FROM employee 
       WHERE LOWER(employee_id) = ANY($1) 
          OR LOWER(email) = ANY($1) 
          OR LOWER(username) = ANY($1)`,
      [queryIds]
    );

    // Filter out the current user
    const curEmpId = (user.employee_id || '').toLowerCase();
    const curEmail = (user.email || '').toLowerCase();
    const curUsername = (user.username || '').toLowerCase();
    const participants = empRes.rows.filter(emp => {
      const empId = (emp.employee_id || '').toLowerCase();
      const email = (emp.email || '').toLowerCase();
      const username = (emp.username || '').toLowerCase();
      return empId !== curEmpId && email !== curEmail && username !== curUsername;
    }).map(emp => {
      const empId = (emp.employee_id || '').toLowerCase();
      const email = (emp.email || '').toLowerCase();
      const username = (emp.username || '').toLowerCase();
      const rolesSet = new Set([
        ...(roleMap.get(empId) || []),
        ...(roleMap.get(email) || []),
        ...(roleMap.get(username) || [])
      ]);
      const roles = Array.from(rolesSet);
      return {
        ...emp,
        roles,
        role_label: roles.length > 0 ? roles.join(', ') : 'Participant'
      };
    });

    res.json({ data: participants });
  } catch (err) {
    console.error('Error fetching participants:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/request/:id/my-ratings', async (req, res) => {
  const { id } = req.params;
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const checkRes = await pool.query(
      'SELECT to_user, point, comment FROM request_rating WHERE request_id = $1 AND from_user = $2 AND deleted_at IS NULL',
      [id, user.employee_id]
    );
    res.json({ data: checkRes.rows });
  } catch (err) {
    console.error('Error fetching my ratings:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/request/:id/all-ratings', async (req, res) => {
  const { id } = req.params;
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const ratingsRes = await pool.query(
      `SELECT r.id, r.request_id, r.to_user, r.point, r.comment, r.created_at,
              et.full_name as to_user_name, et.email as to_user_email, et.username as to_user_username
       FROM request_rating r
       LEFT JOIN employee et ON (LOWER(et.employee_id) = LOWER(r.to_user) OR LOWER(et.email) = LOWER(r.to_user) OR LOWER(et.username) = LOWER(r.to_user))
       WHERE r.request_id = $1 AND r.deleted_at IS NULL
       ORDER BY r.created_at DESC`,
      [id]
    );

    const reqRes = await pool.query('SELECT requester, sr_creater, sr_owner, policy_lead, approval_flow, rating FROM request WHERE request_id = $1', [id]);
    const reqData = reqRes.rows[0] || {};
    
    // Map participant roles
    const roleMap = new Map();
    const addRole = (identifier, role) => {
      if (!identifier) return;
      const clean = String(identifier).trim().toLowerCase();
      if (!clean) return;
      if (!roleMap.has(clean)) roleMap.set(clean, new Set());
      roleMap.get(clean).add(role);
    };

    if (reqData.requester) addRole(reqData.requester, 'Requester');
    if (reqData.sr_creater) addRole(reqData.sr_creater, 'SR Creator');
    if (reqData.policy_lead) addRole(reqData.policy_lead, 'Policy Lead');
    if (reqData.sr_owner) {
      const owners = Array.isArray(reqData.sr_owner) ? reqData.sr_owner : [reqData.sr_owner];
      owners.forEach(o => addRole(o, 'SR Owner'));
    }
    if (reqData.approval_flow) {
      let flow = reqData.approval_flow;
      if (typeof flow === 'string') {
        try { flow = JSON.parse(flow); } catch(e){}
      }
      if (flow && Array.isArray(flow.steps)) {
        flow.steps.forEach(step => {
          if (step.approver) {
            const roleName = step.level !== undefined ? `Approver Tier ${step.level}` : (step.role || 'Approver');
            addRole(step.approver, roleName);
          }
        });
      }
    }

    const ratingsWithRoles = ratingsRes.rows.map(item => {
      const toId = (item.to_user || '').toLowerCase();
      const toEmail = (item.to_user_email || '').toLowerCase();
      const toUsername = (item.to_user_username || '').toLowerCase();
      const toRoles = Array.from(new Set([
        ...(roleMap.get(toId) || []),
        ...(roleMap.get(toEmail) || []),
        ...(roleMap.get(toUsername) || [])
      ]));

      const { from_user, from_user_name, from_user_email, from_user_username, created_by, updated_by, ...safeItem } = item;

      return {
        ...safeItem,
        to_roles: toRoles,
        to_role_label: toRoles.length > 0 ? toRoles.join(', ') : 'Participant'
      };
    });

    let ratingSummary = reqData.rating;
    if (typeof ratingSummary === 'string') {
      try { ratingSummary = JSON.parse(ratingSummary); } catch(e){}
    }

    res.json({
      data: ratingsWithRoles,
      summary: ratingSummary || null
    });
  } catch (err) {
    console.error('Error fetching all ratings:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/execute', async (req, res) => {
  console.log('--- EXECUTE ACTION CALLED ---');
  console.log('Body:', req.body);
  try {
    const parseResult = executeSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issues = parseResult.error.issues || parseResult.error.errors || [];
      return res.status(400).json({ error: 'Payload không hợp lệ: ' + issues.map(e => e.message).join(', ') });
    }
    let { action_id, table_name, record_id, view } = parseResult.data;
    table_name = getBaseTable(table_name);
    if (!isValidTable(table_name)) {
      return res.status(403).json({ error: `Access denied: table '${table_name}' is invalid or restricted.` });
    }
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    if (view === 'my_request' && action_id === 'ACT-REQUEST-02') {
      return res.status(403).json({ error: 'Elements action is not available in My Request.' });
    }

    if (['my_task', 'my_process_owner'].includes(view) && action_id === 'ACT-REQUEST-04') {
      return res.status(403).json({ error: 'Re-update Process Status is only available in My Team.' });
    }

  // Add robust transaction logic
  const client = await getPoolForTable(table_name).connect();
  try {
    await client.query('BEGIN');
    const userEmployeeId = user && user.employee_id ? user.employee_id : (req.user && req.user.employee_id ? req.user.employee_id : 'system');
    await client.query("SELECT set_config('app.current_user', $1, true)", [userEmployeeId]);

    // Determine primary key column
    let pkColumn = `${table_name}_id`;
    if (table_name === 'employee') pkColumn = 'employee_id';
    if (table_name === 'policy_and_program' || table_name === 'policy' || table_name === 'my_product_and_service') pkColumn = 'policy_id';
    if (table_name === 'finance' || table_name === 'v_finance') pkColumn = 'id';
    if (table_name === 'asset') pkColumn = 'office_asset_id';
    if (table_name === 'my_company') pkColumn = 'my_company_id';
    if (table_name === 'operation_program') pkColumn = 'oper_id';
    if (table_name === 'assigned_task') pkColumn = 'task_id';
    if (table_name === 'task_subtask') pkColumn = 'subtask_id';
    if (table_name === 'mtr') pkColumn = 'transaction_id';
    if (table_name === 'oppotunity' || table_name === 'opportunity') pkColumn = 'project_id';
    if (['expense', 'column_permissions', 'exception_rules', 'action_rules', 'uploaded_files', 'permission_positions', 'permission_roles', 'permission_exceptions'].includes(table_name)) pkColumn = 'id';

    // Verify record exists
    const rawRecordId = String(record_id);
    const decodedRecordId = String(hashidHelper.decode(record_id));
    let whereClause = `(${pkColumn}::text = $1 OR ${pkColumn}::text = $2`;
    if (table_name === 'action_rules') {
      whereClause += ` OR action_id = $1 OR action_id = $2`;
    }
    whereClause += `)`;
    const queryStr = table_name === 'employee'
      ? `SELECT * FROM "employee" WHERE employee_id = $1 OR email = $1 OR username = $1 OR employee_id = $2 OR email = $2 OR username = $2`
      : `SELECT * FROM "${table_name}" WHERE ${whereClause}`;
    const recordRes = await client.query(queryStr, [rawRecordId, decodedRecordId]);
    if (recordRes.rows.length === 0) throw new Error('Record not found');
    const record = recordRes.rows[0];
    enrichRecordWithStatusCatalog(table_name, record);

    // ✅ SECURITY: Only allow rating, cancel, and withdraw actions for tickets in App Dev client portal
    const allowedTicketActions = ['ACT-TICKET-03', 'ACT-TICKET-03-RE', 'ACT-TICKET-05', 'withdraw_ticket'];
    if (table_name === 'ticket' && !allowedTicketActions.includes(action_id)) {
      throw new Error("Bạn không có quyền thực hiện hành động này tại trang khách hàng.");
    }

    // ✅ SECURITY: Re-verify action permission server-side.
    // Do NOT trust that frontend called GET first. An attacker can call POST directly.
    const actionIsSystemInternal = ['payment_ready'].includes(action_id);
    if (!actionIsSystemInternal) {
      const rulesResult = await client.query('SELECT * FROM action_rules WHERE action_id = $1', [action_id]);
      const rules = rulesResult.rows.filter(rule =>
        rule.display !== false && String(rule.display).toLowerCase() !== 'false'
      );

      if (rules.length > 0) { // If a rule exists, enforce it
        let hasAccess = false;

        // Scan all rules to find if we need to prefetch any parent records like [request.sr_owner]
        const parentRecords = {};
        for (const rule of rules) {
          const roles = rule.roles ? rule.roles.split(',').map(s => s.trim()) : [];
          for (const r of roles) {
            if (r.startsWith('[') && r.endsWith(']')) {
              const roleStr = r.slice(1, -1).trim();
              const parts = roleStr.split('.');
              if (parts.length === 2) {
                const refCol = parts[0].toLowerCase(); // e.g., 'request'
                if (record[refCol] && typeof record[refCol] === 'string' && !parentRecords[refCol]) {
                  const pk = `${refCol}_id`;
                  try {
                    const pRes = await client.query(`SELECT * FROM "${refCol}" WHERE "${pk}" = $1`, [record[refCol]]);
                    if (pRes.rows.length > 0) parentRecords[refCol] = pRes.rows[0];
                  } catch (err) {
                    console.log(`Dynamic dot notation fetch failed for ${refCol}:`, err.message);
                    parentRecords[refCol] = null;
                  }
                }
              }
            }
          }
        }

        if (table_name === 'request' && ['ACT-REQUEST-03', 'ACT-REQUEST-03-RE'].includes(action_id)) {
          const isParticipant = await isRequestParticipant(record, user, client);
          if (isParticipant) {
            hasAccess = true;
          }
        }

        if (!hasAccess) {
          if (user.role && user.role.toUpperCase() === 'SUPER ADMIN') {
            hasAccess = true;
          } else {
          for (const rule of rules) {
            const exceptions = rule.exceptions ? rule.exceptions.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : [];
            const levels = rule.levels ? rule.levels.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : [];
            const positions = rule.positions ? rule.positions.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : [];
            const roles = rule.roles ? rule.roles.split(',').map(s => s.trim()).filter(Boolean) : [];
            const userRole = String(user.role || '').trim().toLowerCase();
            const userIds = [user.employee_id, user.email, user.username].filter(Boolean).map(s => String(s).trim().toLowerCase());

            if (exceptions.some(ex => userIds.includes(ex))) { hasAccess = true; break; }
            if (roles.some(r => r.replace(/^\[|\]$/g, '').trim().toLowerCase() === userRole)) { hasAccess = true; break; }
            if (levels.includes(String(user.employee_level || '').trim().toLowerCase())) { hasAccess = true; break; }
            if (positions.includes(String(user.position || '').trim().toLowerCase())) { hasAccess = true; break; }

            // Dynamic role check: [sr_owner], [policy_lead], [tier_1_approval], etc.
            for (const r of roles) {
              const cleanRole = r.replace(/^\[|\]$/g, '').trim().toLowerCase();
              if (cleanRole === userRole) {
                hasAccess = true;
                break;
              }
              if (r.startsWith('[') && r.endsWith(']')) {
                const roleStr = r.slice(1, -1).trim();
                const parts = roleStr.split('.');

                if (parts.length === 2) {
                  // DOT NOTATION: [request.sr_owner]
                  const refCol = parts[0].toLowerCase();
                  let targetField = parts[1].toLowerCase().replace(/\s+/g, '_');
                  if (targetField.endsWith('_approver')) targetField = targetField.replace('_approver', '_approval');

                  const pRec = parentRecords[refCol];
                  if (pRec) {
                    let valArr = [];
                    if (targetField.startsWith('tier_') && targetField.endsWith('_approval')) {
                      try {
                        const flow = typeof pRec.approval_flow === 'string' ? JSON.parse(pRec.approval_flow) : pRec.approval_flow;
                        if (flow && Array.isArray(flow.steps)) {
                          const level = parseInt(targetField.replace('tier_', '').replace('_approval', ''));
                          const step = flow.steps.find(s => s.level === level);
                          if (step && step.approver) {
                            valArr = [step.approver.toLowerCase()];
                          }
                        }
                      } catch (e) {}
                    } else if (pRec[targetField]) {
                      const fieldVal = pRec[targetField];
                      valArr = Array.isArray(fieldVal) ? fieldVal.map(s => s.toLowerCase()) : [fieldVal.toLowerCase()];
                    }
                    const userIds = [user.employee_id, user.email, user.username].filter(Boolean).map(s => s.toLowerCase());
                    if (valArr.some(v => userIds.includes(v))) {
                      hasAccess = true;
                      break;
                    }
                  }
                } else {
                  // NORMAL DYNAMIC ROLE: [sr_owner]
                  let targetField = roleStr.toLowerCase().replace(/\s+/g, '_');
                  if (targetField.endsWith('_approver')) targetField = targetField.replace('_approver', '_approval');

                  let valArr = [];
                  if (targetField.startsWith('tier_') && targetField.endsWith('_approval')) {
                    try {
                      const flow = typeof record.approval_flow === 'string' ? JSON.parse(record.approval_flow) : JSON.parse(JSON.stringify(record.approval_flow || {}));
                      if (flow && Array.isArray(flow.steps)) {
                        const level = parseInt(targetField.replace('tier_', '').replace('_approval', ''));
                        const step = flow.steps.find(s => s.level === level);
                        if (step && step.approver) {
                          valArr = [step.approver.toLowerCase()];
                        }
                      }
                    } catch (e) {}
                  } else if (record[targetField]) {
                    const fieldVal = record[targetField];
                    valArr = Array.isArray(fieldVal) ? fieldVal.map(s => s.toLowerCase()) : [fieldVal.toLowerCase()];
                  }
                  const userIds = [user.employee_id, user.email, user.username].filter(Boolean).map(s => s.toLowerCase());
                  if (valArr.some(v => userIds.includes(v))) {
                    hasAccess = true;
                    break;
                  }
                }
              }
            }
            if (hasAccess) break;
          }
        }
        }

        if (!hasAccess) {
          await client.query('ROLLBACK');
          return res.status(403).json({ error: 'Bạn không có quyền thực hiện hành động này.' });
        }
      }
    }

    // Execute logic based on action_id
    if (action_id === 'ACT-REQUEST-01' || action_id === 'change_sr_owner') {
      await requestActions.changeSrOwner({ client, record, record_id, user, action_id, data: req.body.data });
    } else if (action_id === 'ACT-REQUEST-02') {
      await requestActions.updateElements({ client, record, record_id, user, action_id, data: req.body.data });
    } else if (action_id === 'ACT-REQUEST-03' || action_id === 'ACT-REQUEST-03-RE') {
      await requestActions.rateRequest({ client, record, record_id, user, action_id, data: req.body.data });
    } else if (action_id === 'ACT-REQUEST-09') {
      await requestActions.submitRequest({ client, record, record_id, user, action_id, data: req.body.data });
    } else if (action_id === 'withdraw_request') {
      await requestActions.withdrawRequest({ client, record, record_id, user, action_id, data: req.body.data });
    } else if (action_id === 'approve_request' || action_id === 'reject_request') {
      await requestActions.approveOrRejectRequest({ client, record, record_id, user, action_id, data: req.body.data });
    } else if (action_id === 'ACT-REQUEST-05') {
      await requestActions.cancelRequest({ client, record, record_id, user, action_id, data: req.body.data });
    } else if (action_id === 'ACT-REQUEST-06') {
      await requestActions.closeRequest({ client, record, record_id, user, action_id, data: req.body.data });
    } else if (action_id === 'ACT-REQUEST-07') {
      await requestActions.completeRequest({ client, record, record_id, user, action_id, data: req.body.data });
    } else if (action_id === 'ACT-REQUEST-08') {
      await requestActions.startRequest({ client, record, record_id, user, action_id, data: req.body.data });
    } else if (action_id === 'payment_req_outgoing') {
      await paymentActions.submitForPayment({ client, record, record_id, user, action_id, data: req.body.data });
    } else if (action_id === 'payment_paid' || action_id === 'payment_change_mtr' || action_id === 'payment_update_transaction') {
      await paymentActions.markPaidOrUpdateMtr({ client, record, record_id, user, action_id, data: req.body.data });
    } else if (action_id === 'payment_ready') {
      await paymentActions.readyForPayment({ client, record, record_id, user, action_id, data: req.body.data });
    } else if (action_id === 'ACT-TICKET-03' || action_id === 'ACT-TICKET-03-RE') {
      await supportActions.rateTicket({ client, record, record_id, user, action_id, data: req.body.data });
    } else if (action_id === 'ACT-TICKET-05') {
      await supportActions.cancelTicket({ client, record, record_id, user, action_id, data: req.body.data });
    } else if (action_id === 'withdraw_ticket') {
      await supportActions.withdrawTicket({ client, record, record_id, user, action_id, data: req.body.data });
    } else {
      // Default: Log action or ignore if no logic yet
      console.log(`Action ${action_id} executed with no specific handler`);
    }

    await client.query('COMMIT');

    // Broadcast the updated record to all connected clients for real-time UI sync
    try {
      let whereClause = `(${pkColumn}::text = $1 OR ${pkColumn}::text = $2`;
      if (table_name === 'action_rules') {
        whereClause += ` OR action_id = $1 OR action_id = $2`;
      }
      whereClause += `)`;
      const queryStr = table_name === 'employee'
        ? `SELECT * FROM "employee" WHERE employee_id = $1 OR email = $1 OR username = $1 OR employee_id = $2 OR email = $2 OR username = $2`
        : `SELECT * FROM "${table_name}" WHERE ${whereClause}`;
      const finalRes = await getPoolForTable(table_name).query(queryStr, [rawRecordId, decodedRecordId]);
      if (finalRes.rows.length > 0) {
        broadcastSSE('db_change', { action: 'update', table: table_name, record: finalRes.rows[0] });
        eventBus.safeEmit(EVENTS.ACTION_EXECUTED, {
          actionId: action_id,
          tableName: table_name,
          recordId: record_id,
          user,
          record,
          nextRecord: finalRes.rows[0]
        });
      }
    } catch (err) {
      console.error('Failed to broadcast SSE for action update:', err);
    }

    res.json({ success: true, message: 'Action executed successfully' });
  } catch (err) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch(e){}
    }
    console.error('Action execution failed:', err);
    return res.status(500).json({ error: err.message });
  } finally {
    if (client) client.release();
  }
  } catch (outerErr) {
    console.error('Execute route error:', outerErr);
    return res.status(500).json({ error: outerErr.message });
  }
});

// GET /api/actions/payment/:paymentId/mtrs
// Trả về danh sách MTR thuộc account của payment (lọc theo my_company)
// Dùng cho dropdown khi user nhấn action Paid
router.get('/payment/:paymentId/mtrs', async (req, res) => {
  const { paymentId } = req.params;
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    // Lấy thông tin payment để biết my_company
    const payRes = await pool.query(
      `SELECT my_company FROM payment WHERE payment_id = $1`,
      [paymentId]
    );
    if (payRes.rows.length === 0) return res.status(404).json({ error: 'Payment not found' });
    const myCompany = payRes.rows[0].my_company;

    // Lấy account thuộc my_company
    const accRes = await pool.query(
      `SELECT account_id, finance_control, transaction_managed_by FROM account WHERE company_entity = $1`,
      [myCompany]
    );

    const uIdentities = [user.employee_id, user.email, user.username].filter(Boolean).map(s => normalizeEmail(s.trim()));
    const isSuperAdmin = user.role && user.role.toUpperCase() === 'SUPER ADMIN';

    // Lọc danh sách account mà user được quyền quản lý (chỉ check nếu không phải Super Admin)
    const allowedAccounts = accRes.rows.filter(row => {
      if (isSuperAdmin) return true;
      if (uIdentities.length === 0) return false;

      // Check finance_control (comma-separated list of emails)
      if (row.finance_control) {
        const controls = row.finance_control.split(',').map(s => normalizeEmail(s.trim()));
        if (controls.some(c => uIdentities.includes(c))) return true;
      }

      // Check transaction_managed_by (comma-separated list of emails)
      if (row.transaction_managed_by) {
        const managers = row.transaction_managed_by.split(',').map(s => normalizeEmail(s.trim()));
        if (managers.some(m => uIdentities.includes(m))) return true;
      }

      return false;
    });

    const accountIds = allowedAccounts.map(r => r.account_id);

    if (accountIds.length === 0) {
      return res.json({ data: [] });
    }

    // Lấy danh sách MTR thuộc các account được phân quyền đó
    const mtrRes = await pool.query(
      `SELECT m.transaction_id, m.account, m.description, m.amount, a.currency, m.transaction_date, m.status, m.transaction_type
       FROM mtr m
       LEFT JOIN account a ON m.account = a.account_id
       WHERE m.account = ANY($1)
       ORDER BY m.transaction_date DESC NULLS LAST
       LIMIT 200`,
      [accountIds]
    );

    res.json({ data: mtrRes.rows });
  } catch (err) {
    console.error('Error fetching MTRs for payment:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
