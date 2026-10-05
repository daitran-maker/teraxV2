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
      const { sr_owner } = req.body.data || {};
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
    } else if (action_id === 'ACT-REQUEST-02') {
      const { elements } = req.body.data || {};
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
    } else if (action_id === 'ACT-REQUEST-03' || action_id === 'ACT-REQUEST-03-RE') {
      const dataParse = ratingsDataSchema.safeParse(req.body.data);
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
    } else if (action_id === 'ACT-REQUEST-04') {
      const { process_status: processStatusStr } = req.body.data || {};
      const allowedProcessStatuses = ['Not started yet', 'Processing', 'Completed'];
      if (processStatusStr && !allowedProcessStatuses.includes(processStatusStr)) {
        throw new Error("Process Status không hợp lệ");
      }
      if (!processStatusStr) throw new Error("Vui lòng cung cấp Process Status");
      const process_status = resolveStatusId('request', 'process_status', processStatusStr);
      const tzTimeStr = new Date().toISOString();
      const logEntry = { timestamp: tzTimeStr, user: user.employee_id, action: `updated process status to ${processStatusStr}` };
      await client.query(`UPDATE request SET process_status = $2, log = COALESCE(log, '[]'::jsonb) || $3::jsonb WHERE request_id = $1`, [record_id, process_status, JSON.stringify([logEntry])]);
    } else if (action_id === 'ACT-REQUEST-09') {
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
    } else if (action_id === 'withdraw_request') {
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
    } else if (action_id === 'approve_request' || action_id === 'reject_request') {
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
    } else if (action_id === 'ACT-REQUEST-05') {
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
    } else if (action_id === 'ACT-REQUEST-06') {
      // Closed — also saves rating if provided via req.body.data
      const closedData = req.body.data || {};
      const ratingVal = closedData.rating != null ? JSON.stringify(closedData.rating) : null;
      const tzTimeStr = new Date().toISOString();
      const logEntry = { timestamp: tzTimeStr, user: user.employee_id, action: 'closed request' };
      await client.query(
        `UPDATE request SET sr_status = 5, process_status = 9, sr_close_date = CURRENT_TIMESTAMP,
         rating = COALESCE($2::jsonb, rating),
         log = COALESCE(log, '[]'::jsonb) || $3::jsonb WHERE request_id = $1`,
        [record_id, ratingVal, JSON.stringify([logEntry])]
      );
    } else if (action_id === 'ACT-REQUEST-07') {
      // Complete
      const tzTimeStr = new Date().toISOString();
      const logEntry = { timestamp: tzTimeStr, user: user.employee_id, action: 'completed request' };
      await client.query(
        `UPDATE request SET process_status = 9, process_end_date = CURRENT_TIMESTAMP, log = COALESCE(log, '[]'::jsonb) || $2::jsonb WHERE request_id = $1`,
        [record_id, JSON.stringify([logEntry])]
      );
    } else if (action_id === 'ACT-REQUEST-08') {
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
        const { assign_to, deadline, description, task_info_link, task_info_guide_file, task_info_notes, tasks, has_existing_tasks } = req.body.data || {};
        
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

    } else if (action_id === 'payment_req_outgoing') {
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

    } else if (action_id === 'payment_paid' || action_id === 'payment_change_mtr' || action_id === 'payment_update_transaction') {
      // Paid / Change MTR / Update Transaction: nhập transaction_id, tự động lấy transaction_date làm payment_date (ưu tiên)
      const { transaction_id, payment_date } = req.body.data || {};
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
              const { generateSequentialId } = require('../helpers/idGenerator');
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
    } else if (action_id === 'payment_ready') {
      await client.query(`UPDATE payment SET payment_status = 31 WHERE payment_id = $1`, [record_id]);
    } else if (action_id === 'ACT-TICKET-03' || action_id === 'ACT-TICKET-03-RE') {
      const { rating } = req.body.data || {};
      if (!rating || typeof rating !== 'object' || !rating.point) {
        throw new Error("Vui lòng cung cấp đầy đủ thông tin Rating (điểm)");
      }
      const point = Number(rating.point);
      const comment = rating.comment || '';
      if (point < 3 && !comment.trim()) {
        throw new Error("Vui lòng nhập lý do đánh giá thấp");
      }
      const ratingObj = {
        point,
        comment,
        by: user.employee_id,
        at: new Date().toISOString()
      };
      const tzTimeStr = new Date().toISOString();
      const logEntry = { timestamp: tzTimeStr, user: user.employee_id, action: `rated request: ${point} stars - ${comment}` };
      await client.query(
        `UPDATE ticket 
         SET rating = $2::jsonb, 
             sr_status = 13, 
             sr_close_date = CURRENT_TIMESTAMP, 
             log = COALESCE(log, '[]'::jsonb) || $3::jsonb 
         WHERE ticket_id = $1`,
        [record_id, JSON.stringify(ratingObj), JSON.stringify([logEntry])]
      );
    } else if (action_id === 'ACT-TICKET-05') {
      const tzTimeStr = new Date().toISOString();
      const logEntry = { timestamp: tzTimeStr, user: user.employee_id, action: 'cancelled ticket' };
      await client.query(
        `UPDATE ticket SET sr_status = 118, process_status = 119, sr_close_date = CURRENT_TIMESTAMP, log = COALESCE(log, '[]'::jsonb) || $2::jsonb WHERE ticket_id = $1`,
        [record_id, JSON.stringify([logEntry])]
      );
    } else if (action_id === 'withdraw_ticket') {
      let flow = null;
      try {
        flow = typeof record.processing_flow === 'string' ? JSON.parse(record.processing_flow) : JSON.parse(JSON.stringify(record.processing_flow || {}));
      } catch (e) {
        console.warn('Error parsing processing_flow:', e);
      }
      let logEntry = null;
      const tzTimeStr = new Date().toISOString();
      if (flow && flow.steps && flow.steps.length > 0) {
        flow.current_level = 1;
        flow.steps.forEach(step => {
          step.status = 'Not started yet';
          step.history = [];
        });
        logEntry = { timestamp: tzTimeStr, user: user.employee_id, action: 'withdrew request' };
      } else {
        logEntry = { timestamp: new Date().toISOString(), user: user.employee_id, action: 'withdrew request' };
      }
      await client.query(
        `UPDATE ticket SET process_status = 120, processing_flow = $2, log = COALESCE(log, '[]'::jsonb) || $3::jsonb WHERE ticket_id = $1`,
        [record_id, flow ? JSON.stringify(flow) : record.processing_flow, JSON.stringify([logEntry])]
      );
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
