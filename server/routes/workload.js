const express = require('express');
const router = express.Router();
const pool = require('../db');
const { checkPermission } = require('../helpers/permissionHelper');

// Cache configuration (60s TTL)
let _workloadCache = new Map();
const CACHE_TTL_MS = 60 * 1000;

// Table metadata (roles/tasks)
const TABLE_METAS = {
  request: { label: 'Yêu cầu (Request)', icon: 'assignment', color: '#1D4ED8', category: 'Workflow' },
  oppotunity: { label: 'Cơ hội (Opportunity)', icon: 'cases', color: '#8B5CF6', category: 'Business' },
  service_delivery_contract: { label: 'HĐ Triển khai (SDC)', icon: 'handshake', color: '#059669', category: 'Delivery' },
  service_task_request: { label: 'Nhiệm vụ DV (Task Request)', icon: 'task', color: '#D97706', category: 'Delivery' },
  contract: { label: 'Hợp đồng (Contract)', icon: 'history_edu', color: '#0284C7', category: 'Business' },
  payment: { label: 'Thanh toán (Payment)', icon: 'payments', color: '#10B981', category: 'Finance' },
  expense: { label: 'Chi phí (Expense)', icon: 'receipt_long', color: '#EA580C', category: 'Finance' },
  invoice: { label: 'Hóa đơn (Invoice)', icon: 'description', color: '#6366F1', category: 'Finance' },
  account: { label: 'Tài khoản (Account)', icon: 'wallet', color: '#0D9488', category: 'Finance' },
  service: { label: 'Dịch vụ (Service)', icon: 'settings_suggest', color: '#4F46E5', category: 'Admin' },
  asset: { label: 'Tài sản (Asset)', icon: 'inventory_2', color: '#14B8A6', category: 'Admin' },
  mtr: { label: 'MTR', icon: 'sync_alt', color: '#64748B', category: 'Finance' },
  comment: { label: 'Trao đổi / Thảo luận', icon: 'forum', color: '#EC4899', category: 'Communication' },
  ticket: { label: 'Hỗ trợ (Ticket)', icon: 'support_agent', color: '#F43F5E', category: 'Support' },
  action_rules: { label: 'Quy tắc hành động', icon: 'bolt', color: '#F59E0B', category: 'System' },
  exception_rules: { label: 'Phân quyền Menu', icon: 'manage_search', color: '#84CC16', category: 'System' },
  policy_and_program: { label: 'Quy trình & Chính sách', icon: 'schema', color: '#EAB308', category: 'Workflow' }
};

let _cachedEmployees = null;
let _cachedEmployeesTime = 0;
async function getAllEmployeesMap() {
  const now = Date.now();
  if (_cachedEmployees && (now - _cachedEmployeesTime < 5 * 60 * 1000)) {
    return _cachedEmployees;
  }
  const empRes = await pool.query(`
    SELECT e.employee_id, e.full_name, e.email, e.department_id, e.position,
           COALESCE(e.avatar, e.picture) as avatar, d.department_name
    FROM employee e
    LEFT JOIN department d ON e.department_id = d.department_id
    WHERE e.deleted_at IS NULL
  `);
  const empById = {};
  const empByEmail = {};
  empRes.rows.forEach(e => {
    empById[e.employee_id] = e;
    empById[e.employee_id.toUpperCase()] = e;
    empById[e.employee_id.toLowerCase()] = e;
    if (e.email) empByEmail[e.email.toLowerCase()] = e;
  });
  _cachedEmployees = { empById, empByEmail };
  _cachedEmployeesTime = now;
  return _cachedEmployees;
}

// Middleware: restrict to Super Admin or permission in exception_rules
async function requireWorkloadAccess(req, res, next) {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const isSuperAdmin = user.role && user.role.toUpperCase() === 'SUPER ADMIN';
  if (isSuperAdmin) return next();

  try {
    const hasPerm = await checkPermission('exception_rules', 'workload_report', user);
    if (hasPerm) return next();
  } catch (err) {
    console.error('[Workload] Permission check failed:', err);
  }
  return res.status(403).json({ error: 'Chỉ có Super Admin mới có quyền truy cập báo cáo Workload & Hoạt động.' });
}

router.use(requireWorkloadAccess);

/**
 * GET /api/workload/overview
 * Query params:
 *   - time_range: 'today' | '7d' | '30d' | 'this_month' | 'last_month' | 'all' (default: '30d')
 *   - department_id: optional filter
 *   - refresh: '1' to bypass cache
 */
router.get('/overview', async (req, res) => {
  const timeRange = (req.query.time_range || '30d').toLowerCase();
  const deptFilter = req.query.department_id || null;
  const forceRefresh = req.query.refresh === '1';

  const cacheKey = `${timeRange}::${deptFilter || 'all'}`;
  const now = Date.now();
  if (!forceRefresh && _workloadCache.has(cacheKey)) {
    const cached = _workloadCache.get(cacheKey);
    if (now - cached.timestamp < CACHE_TTL_MS) {
      return res.json({ ...cached.data, _cached: true, _cachedAt: cached.timestamp });
    }
  }

  try {
    // 1. Fetch Employees & Departments
    const [empRes, deptRes] = await Promise.all([
      pool.query(`
        SELECT 
          employee_id, full_name, email, username, 
          department_id, position, employee_level, role,
          COALESCE(avatar, picture) AS avatar
        FROM employee 
        WHERE deleted_at IS NULL
      `),
      pool.query(`
        SELECT department_id, department_name, department_code, type
        FROM department 
        WHERE deleted_at IS NULL
      `)
    ]);

    const depts = {};
    deptRes.rows.forEach(d => {
      depts[d.department_id] = d.department_name;
    });

    const empById = {};
    const empByEmail = {};
    const empByUsername = {};

    empRes.rows.forEach(e => {
      e.department_name = depts[e.department_id] || 'Chưa phân bổ';
      empById[e.employee_id] = e;
      empById[e.employee_id.toUpperCase()] = e;
      empById[e.employee_id.toLowerCase()] = e;
      if (e.email) empByEmail[e.email.toLowerCase()] = e;
      if (e.username) empByUsername[e.username.toLowerCase()] = e;
    });

    function resolveEmployee(key) {
      if (!key) return null;
      const k = String(key).trim();
      return empById[k] || empById[k.toUpperCase()] || empById[k.toLowerCase()] || empByEmail[k.toLowerCase()] || empByUsername[k.toLowerCase()] || null;
    }

    // 2. Prepare Time Condition for Audit Logs
    let auditTimeSql = '';
    if (timeRange === 'today') {
      auditTimeSql = 'created_at >= CURRENT_DATE';
    } else if (timeRange === '7d') {
      auditTimeSql = "created_at >= NOW() - INTERVAL '7 days'";
    } else if (timeRange === '30d') {
      auditTimeSql = "created_at >= NOW() - INTERVAL '30 days'";
    } else if (timeRange === 'this_month') {
      auditTimeSql = "created_at >= DATE_TRUNC('month', CURRENT_DATE)";
    } else if (timeRange === 'last_month') {
      auditTimeSql = "created_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') AND created_at < DATE_TRUNC('month', CURRENT_DATE)";
    } else {
      auditTimeSql = '1=1';
    }

    // 3. Aggregate Workflow Roles from Request and Opportunity tables
    const [reqRes, oppRes] = await Promise.all([
      pool.query(`
        SELECT 
          request_id, requester, sr_creater, sr_owner, 
          policy_lead, approval_flow, sr_status, sr_created_date,
          sr_submitted_date
        FROM request 
        WHERE deleted_at IS NULL
      `),
      pool.query(`
        SELECT 
          project_id, project_name, estimated_revenue, currency,
          status, stage, sources, close_date, sale_lead, create_date,
          sale_team, related_employees, id__company
        FROM oppotunity 
        WHERE deleted_at IS NULL
      `)
    ]);

    // Initialize Employee Workload Bucket
    const employeeWorkload = {};
    function ensureEmployeeRecord(emp) {
      if (!employeeWorkload[emp.employee_id]) {
        employeeWorkload[emp.employee_id] = {
          employee_id: emp.employee_id,
          full_name: emp.full_name,
          email: emp.email,
          position: emp.position || '',
          employee_level: emp.employee_level || '',
          department_id: emp.department_id || '',
          department_name: emp.department_name,
          role: emp.role || 'Staff',
          avatar: emp.avatar || null,
          // Request metrics
          as_requester: 0,
          as_owner: 0,
          as_owner_active: 0,
          as_owner_completed: 0,
          as_policy_lead: 0,
          as_policy_lead_active: 0,
          as_tier_1: 0,
          as_tier_2: 0,
          as_tier_3: 0,
          approvals_approved: 0,
          approvals_rejected: 0,
          pending_my_approval: 0,
          // Opportunity metrics
          as_sale_lead: 0,
          as_sale_lead_active: 0,
          as_sale_lead_won: 0,
          as_sale_lead_lost: 0,
          as_collaborator: 0,
          pipeline_revenue: 0,
          won_revenue: 0,
          total_revenue: 0,
          win_rate: 0,
          // Audit activity metrics in period
          tasks_created: 0,
          tasks_updated: 0,
          tasks_deleted: 0,
          audit_actions: 0,
          last_active: null,
          table_actions: {},
          action_types: { INSERT: 0, UPDATE: 0, DELETE: 0 }
        };
      }
      return employeeWorkload[emp.employee_id];
    }

    // Seed all employees
    empRes.rows.forEach(e => ensureEmployeeRecord(e));

    let totalActiveRequests = 0;
    let totalPendingApprovals = 0;

    for (const r of reqRes.rows) {
      const isClosed = [4, 5, 6, 9, 117].includes(r.sr_status);
      const isPending = (r.sr_status === 2 || String(r.sr_status).toLowerCase() === 'pending approval');
      if (!isClosed) totalActiveRequests++;
      if (isPending) totalPendingApprovals++;

      const reqEmp = resolveEmployee(r.requester) || resolveEmployee(r.sr_creater);
      if (reqEmp) ensureEmployeeRecord(reqEmp).as_requester++;

      const owners = Array.isArray(r.sr_owner) ? r.sr_owner : (r.sr_owner ? [r.sr_owner] : []);
      owners.forEach(o => {
        const oEmp = resolveEmployee(o);
        if (oEmp) {
          const s = ensureEmployeeRecord(oEmp);
          s.as_owner++;
          if (!isClosed) {
            s.as_owner_active++;
          } else {
            s.as_owner_completed++;
          }
        }
      });

      const plEmp = resolveEmployee(r.policy_lead);
      if (plEmp) {
        const s = ensureEmployeeRecord(plEmp);
        s.as_policy_lead++;
        if (!isClosed) s.as_policy_lead_active++;
      }

      if (r.approval_flow && Array.isArray(r.approval_flow.steps)) {
        const curLevel = r.approval_flow.current_level;
        for (const step of r.approval_flow.steps) {
          const appEmp = resolveEmployee(step.approver);
          if (appEmp) {
            const s = ensureEmployeeRecord(appEmp);
            if (step.level === 1) s.as_tier_1++;
            else if (step.level === 2) s.as_tier_2++;
            else if (step.level === 3) s.as_tier_3++;

            if (step.status === 3) {
              s.approvals_approved++;
            } else if (step.status === 4) {
              s.approvals_rejected++;
            }

            if (isPending && curLevel === step.level) {
              s.pending_my_approval++;
            }
          }
        }
      }
    }

    // Process Opportunity Metrics
    let totalActivePipeline = 0;
    let totalWonDeals = 0;
    let totalLostDeals = 0;
    let totalPipelineRev = 0;
    let totalWonRev = 0;

    for (const o of oppRes.rows) {
      const isWon = o.status === 8;
      const isLost = o.status === 5;
      const isClosed = [1, 2, 5, 8].includes(o.status);
      const isActive = !isClosed;
      const rev = parseFloat(o.estimated_revenue) || 0;

      if (isActive) {
        totalActivePipeline++;
        totalPipelineRev += rev;
      }
      if (isWon) {
        totalWonDeals++;
        totalWonRev += rev;
      }
      if (isLost) totalLostDeals++;

      const leadEmp = resolveEmployee(o.sale_lead);
      if (leadEmp) {
        const s = ensureEmployeeRecord(leadEmp);
        s.as_sale_lead++;
        if (isActive) {
          s.as_sale_lead_active++;
          s.pipeline_revenue += rev;
        } else if (isWon) {
          s.as_sale_lead_won++;
          s.won_revenue += rev;
        } else if (isLost) {
          s.as_sale_lead_lost++;
        }
        s.total_revenue += rev;
      }

      // Collaborators
      const relEmps = Array.isArray(o.related_employees) ? o.related_employees : [];
      relEmps.forEach(rel => {
        const rEmp = resolveEmployee(rel);
        if (rEmp && (!leadEmp || rEmp.employee_id !== leadEmp.employee_id)) {
          const s = ensureEmployeeRecord(rEmp);
          s.as_collaborator++;
        }
      });
    }

    // Calculate win rates
    Object.values(employeeWorkload).forEach(s => {
      const finished = s.as_sale_lead_won + s.as_sale_lead_lost;
      s.win_rate = finished > 0 ? Math.round((s.as_sale_lead_won / finished) * 100) : 0;
    });

    // 4. Query Audit Logs (Grouped by user, table, action)
    const [auditGroupRes, timelineRes, hourlyRes, recentAuditRes] = await Promise.all([
      pool.query(`
        SELECT 
          changed_by, 
          table_name, 
          UPPER(COALESCE(action, 'UPDATE')) as action_type, 
          COUNT(*)::int as count, 
          MAX(created_at) as last_active
        FROM audit_logs
        WHERE ${auditTimeSql}
        GROUP BY changed_by, table_name, UPPER(COALESCE(action, 'UPDATE'))
      `),
      pool.query(`
        SELECT 
          to_char(created_at, 'YYYY-MM-DD') as day,
          COUNT(*)::int as total,
          COUNT(CASE WHEN table_name = 'request' THEN 1 END)::int as request_cnt,
          COUNT(CASE WHEN table_name = 'oppotunity' THEN 1 END)::int as oppo_cnt,
          COUNT(CASE WHEN table_name IN ('service_delivery_contract', 'service_task_request') THEN 1 END)::int as delivery_cnt,
          COUNT(CASE WHEN table_name IN ('payment', 'expense', 'invoice', 'contract') THEN 1 END)::int as finance_cnt
        FROM audit_logs
        WHERE ${auditTimeSql}
        GROUP BY to_char(created_at, 'YYYY-MM-DD')
        ORDER BY day ASC
      `),
      pool.query(`
        SELECT 
          EXTRACT(HOUR FROM created_at)::int as hour,
          COUNT(*)::int as count
        FROM audit_logs
        WHERE ${auditTimeSql}
        GROUP BY EXTRACT(HOUR FROM created_at)::int
        ORDER BY hour ASC
      `),
      pool.query(`
        SELECT 
          id, table_name, record_id, action, changed_by, created_at, changes
        FROM audit_logs
        WHERE ${auditTimeSql}
        ORDER BY created_at DESC, id DESC
        LIMIT 25
      `)
    ]);

    // Map audit data to employees and table summaries
    const tableSummaries = {};
    const tableContributors = {}; // table_name -> { userKey -> { user, creates, updates, deletes, total } }
    let totalAuditPeriod = 0;
    const activeEmployeeIdsInPeriod = new Set();

    for (const row of auditGroupRes.rows) {
      totalAuditPeriod += row.count;

      // Table summary
      if (!tableSummaries[row.table_name]) {
        const meta = TABLE_METAS[row.table_name] || {
          label: row.table_name.replace(/_/g, ' ').toUpperCase(),
          icon: 'table_view',
          color: '#6B7280',
          category: 'Other'
        };
        tableSummaries[row.table_name] = {
          table_name: row.table_name,
          label: meta.label,
          icon: meta.icon,
          color: meta.color,
          category: meta.category,
          total_actions: 0,
          unique_users: new Set(),
          actions: { INSERT: 0, UPDATE: 0, DELETE: 0 }
        };
        tableContributors[row.table_name] = {};
      }
      tableSummaries[row.table_name].total_actions += row.count;
      tableSummaries[row.table_name].unique_users.add(row.changed_by);
      if (tableSummaries[row.table_name].actions[row.action_type] !== undefined) {
        tableSummaries[row.table_name].actions[row.action_type] += row.count;
      }

      // Track per-table contributors
      const emp = resolveEmployee(row.changed_by);
      const userKey = emp ? emp.employee_id : (row.changed_by || 'unknown');
      if (!tableContributors[row.table_name][userKey]) {
        tableContributors[row.table_name][userKey] = {
          employee_id: emp ? emp.employee_id : null,
          name: emp ? emp.full_name : (row.changed_by === 'system' ? 'System Bot' : row.changed_by),
          email: emp ? emp.email : '',
          avatar: emp ? emp.avatar : null,
          department_name: emp ? emp.department_name : '',
          creates: 0,
          updates: 0,
          deletes: 0,
          total: 0
        };
      }
      const contrib = tableContributors[row.table_name][userKey];
      contrib.total += row.count;
      if (row.action_type === 'INSERT') contrib.creates += row.count;
      else if (row.action_type === 'DELETE') contrib.deletes += row.count;
      else contrib.updates += row.count;

      // Employee summary
      if (emp) {
        activeEmployeeIdsInPeriod.add(emp.employee_id);
        const s = ensureEmployeeRecord(emp);
        s.audit_actions += row.count;
        if (row.action_type === 'INSERT') s.tasks_created += row.count;
        else if (row.action_type === 'DELETE') s.tasks_deleted += row.count;
        else s.tasks_updated += row.count;

        if (!s.table_actions[row.table_name]) {
          s.table_actions[row.table_name] = { total: 0, creates: 0, updates: 0, deletes: 0 };
        }
        s.table_actions[row.table_name].total += row.count;
        if (row.action_type === 'INSERT') s.table_actions[row.table_name].creates += row.count;
        else if (row.action_type === 'DELETE') s.table_actions[row.table_name].deletes += row.count;
        else s.table_actions[row.table_name].updates += row.count;

        if (s.action_types[row.action_type] !== undefined) {
          s.action_types[row.action_type] += row.count;
        }
        if (!s.last_active || new Date(row.last_active) > new Date(s.last_active)) {
          s.last_active = row.last_active;
        }
      }
    }

    // Convert table summaries unique_users set to count and attach top contributors
    const tableSummaryList = Object.values(tableSummaries).map(t => {
      const topList = Object.values(tableContributors[t.table_name] || {})
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);
      return {
        ...t,
        unique_users_count: t.unique_users.size,
        unique_users: undefined,
        top_contributors: topList
      };
    }).sort((a, b) => b.total_actions - a.total_actions);

    // Format recent activities with human readable details
    const recentActivities = recentAuditRes.rows.map(r => {
      const emp = resolveEmployee(r.changed_by);
      const meta = TABLE_METAS[r.table_name] || {
        label: r.table_name,
        icon: 'dataset',
        color: '#6B7280'
      };
      return {
        id: r.id,
        table_name: r.table_name,
        table_label: meta.label,
        table_icon: meta.icon,
        table_color: meta.color,
        record_id: r.record_id,
        action: (r.action || 'UPDATE').toUpperCase(),
        created_at: r.created_at,
        changed_by: r.changed_by,
        user_name: emp ? emp.full_name : (r.changed_by === 'system' ? 'System Bot' : r.changed_by),
        user_dept: emp ? emp.department_name : '',
        changes: r.changes
      };
    });

    // 24-hour distribution map
    const hourlyMap = {};
    for (let h = 0; h < 24; h++) hourlyMap[h] = 0;
    hourlyRes.rows.forEach(r => {
      hourlyMap[r.hour] = r.count;
    });

    // Filter employees by department if specified
    let employeeList = Object.values(employeeWorkload);
    if (deptFilter && deptFilter !== 'all') {
      employeeList = employeeList.filter(e => String(e.department_id) === String(deptFilter));
    }

    // Calculate contract and payment values per project
    const [conAggRes, payAggRes, reqAggRes, taskAggRes] = await Promise.all([
      pool.query(`
        SELECT project, 
               SUM(CASE WHEN type = 69 THEN COALESCE(NULLIF(total_value_in_base_currency, 0), total_value, 0) ELSE 0 END) as selling_contract_val,
               SUM(CASE WHEN type = 70 THEN COALESCE(NULLIF(total_value_in_base_currency, 0), total_value, 0) ELSE 0 END) as buying_contract_val,
               SUM(COALESCE(NULLIF(total_value_in_base_currency, 0), total_value, 0)) as all_contract_val,
               COUNT(CASE WHEN type = 69 THEN 1 END) as selling_count,
               COUNT(CASE WHEN type = 70 THEN 1 END) as buying_count
        FROM contract 
        WHERE project IS NOT NULL AND deleted_at IS NULL
        GROUP BY project
      `),
      pool.query(`
        SELECT project, 
               SUM(CASE WHEN (payment_type = 60 OR payment_type IS NULL) AND (payment_status = 32 OR LOWER(payment_status::text) = 'paid') THEN COALESCE(NULLIF(value_in_base_currency, 0), total_value, value, 0) ELSE 0 END) as incoming_paid_val,
               SUM(CASE WHEN payment_type = 61 AND (payment_status = 32 OR LOWER(payment_status::text) = 'paid') THEN COALESCE(NULLIF(value_in_base_currency, 0), total_value, value, 0) ELSE 0 END) as outgoing_paid_val,
               COUNT(CASE WHEN payment_type = 60 THEN 1 END) as incoming_count,
               COUNT(CASE WHEN payment_type = 61 THEN 1 END) as outgoing_count
        FROM payment 
        WHERE project IS NOT NULL 
          AND deleted_at IS NULL
        GROUP BY project
      `),
      pool.query(`
        SELECT id__oppotunity as project, COUNT(*)::int as req_cnt
        FROM request 
        WHERE id__oppotunity IS NOT NULL AND deleted_at IS NULL
        GROUP BY id__oppotunity
      `),
      pool.query(`
        SELECT sdc.project, COUNT(t.id)::int as task_cnt, COUNT(CASE WHEN t.status = 5 THEN 1 END)::int as task_completed_cnt
        FROM service_task_request t
        JOIN service_delivery_contract sdc ON t.service_delivery = sdc.id
        WHERE sdc.project IS NOT NULL AND t.deleted_at IS NULL
        GROUP BY sdc.project
      `)
    ]);

    const projectContractMap = {};
    conAggRes.rows.forEach(r => { 
      projectContractMap[r.project] = {
        selling: parseFloat(r.selling_contract_val) || 0,
        buying: parseFloat(r.buying_contract_val) || 0,
        all: parseFloat(r.all_contract_val) || 0,
        selling_count: parseInt(r.selling_count, 10) || 0,
        buying_count: parseInt(r.buying_count, 10) || 0
      };
    });
    const projectPaidMap = {};
    payAggRes.rows.forEach(r => { 
      projectPaidMap[r.project] = {
        incoming: parseFloat(r.incoming_paid_val) || 0,
        outgoing: parseFloat(r.outgoing_paid_val) || 0,
        incoming_count: parseInt(r.incoming_count, 10) || 0,
        outgoing_count: parseInt(r.outgoing_count, 10) || 0
      };
    });
    const projectReqMap = {};
    reqAggRes.rows.forEach(r => { projectReqMap[r.project] = r.req_cnt; });
    const projectTaskMap = {};
    taskAggRes.rows.forEach(r => { 
      projectTaskMap[r.project] = { 
        total: r.task_cnt, 
        completed: r.task_completed_cnt 
      }; 
    });

    // Enriched Opportunities List
    const enrichedOpportunities = oppRes.rows.map(o => {
      const pid = String(o.project_id);
      const leadEmp = resolveEmployee(o.sale_lead);
      const cInfo = projectContractMap[pid] || { selling: 0, buying: 0, all: 0, selling_count: 0, buying_count: 0 };
      const pInfo = projectPaidMap[pid] || { incoming: 0, outgoing: 0, incoming_count: 0, outgoing_count: 0 };
      const sVal = cInfo.selling > 0 ? cInfo.selling : (cInfo.buying === 0 ? cInfo.all : 0);
      const bVal = cInfo.buying;
      const inPaid = pInfo.incoming;
      const outPaid = pInfo.outgoing;
      const marginVal = sVal > 0 ? (sVal - bVal) : 0;

      const rCnt = (projectReqMap[pid] || 0) + (o.id__request ? 1 : 0);
      const tInfo = projectTaskMap[pid] || { total: 0, completed: 0 };
      const teamSet = new Set();
      if (leadEmp) {
        teamSet.add(leadEmp.employee_id.toUpperCase());
      }
      if (Array.isArray(o.related_employees)) {
        o.related_employees.forEach(id => {
          if (!id) return;
          const re = resolveEmployee(id);
          if (re) teamSet.add(re.employee_id.toUpperCase());
        });
      }
      const teamCount = Math.max(1, teamSet.size);

      // Attribute contract & paid values to the Sale Lead employee
      if (leadEmp) {
        const s = ensureEmployeeRecord(leadEmp);
        s.contract_value = (s.contract_value || 0) + sVal;
        s.paid_value = (s.paid_value || 0) + inPaid;
      }

      return {
        project_id: o.project_id,
        project_name: o.project_name || 'N/A',
        status: o.status,
        status_info: OPP_STATUS_MAP[o.status] || { key: 'unknown', vi: 'Khác', en: 'Other', color: '#9CA3AF' },
        estimated_revenue: parseFloat(o.estimated_revenue) || 0,
        currency: o.currency || 'VND',
        sale_lead: o.sale_lead,
        sale_lead_name: leadEmp ? leadEmp.full_name : (o.sale_lead || 'N/A'),
        sale_lead_avatar: leadEmp ? leadEmp.avatar : null,
        department_name: leadEmp ? leadEmp.department_name : '',
        contract_val: sVal || cInfo.all,
        selling_contract_val: sVal,
        buying_contract_val: bVal,
        paid_val: inPaid,
        incoming_paid_val: inPaid,
        outgoing_paid_val: outPaid,
        margin_val: marginVal,
        selling_contract_count: cInfo.selling_count,
        buying_contract_count: cInfo.buying_count,
        incoming_payment_count: pInfo.incoming_count,
        outgoing_payment_count: pInfo.outgoing_count,
        requests_count: rCnt,
        tasks_count: tInfo.total,
        tasks_completed_count: tInfo.completed,
        team_count: teamCount,
        create_date: o.create_date,
        close_date: o.close_date
      };
    });

    // Calculate score / rank
    employeeList.forEach(e => {
      e.workload_score = (e.as_owner_active * 10) +
                         (e.pending_my_approval * 12) +
                         (e.as_policy_lead_active * 8) +
                         (e.as_tier_1 + e.as_tier_2 + e.as_tier_3) * 2 +
                         Math.round(e.audit_actions * 0.1);
      e.opp_workload_score = (e.as_sale_lead_active * 10) +
                             (e.as_sale_lead_won * 5) +
                             (e.as_collaborator * 3) +
                             Math.round(e.audit_actions * 0.1);
    });

    employeeList.sort((a, b) => b.workload_score - a.workload_score || b.audit_actions - a.audit_actions);

    const responseData = {
      time_range: timeRange,
      summary: {
        total_employees: empRes.rows.length,
        active_employees_period: activeEmployeeIdsInPeriod.size,
        total_audit_actions: totalAuditPeriod,
        // Request metrics
        total_active_requests: totalActiveRequests,
        total_pending_approvals: totalPendingApprovals,
        // Opportunity metrics
        total_opportunities: oppRes.rows.length,
        total_active_pipeline: totalActivePipeline,
        total_won_deals: totalWonDeals,
        total_lost_deals: totalLostDeals,
        total_pipeline_value: totalPipelineRev,
        total_won_value: totalWonRev
      },
      departments: deptRes.rows.map(d => ({
        id: d.department_id,
        name: d.department_name,
        code: d.department_code
      })),
      employees: employeeList,
      opportunities: enrichedOpportunities,
      table_breakdown: tableSummaryList,
      timeline: timelineRes.rows,
      hourly_distribution: hourlyMap,
      recent_activities: recentActivities
    };

    // Cache result
    _workloadCache.set(cacheKey, { timestamp: now, data: responseData });

    res.json(responseData);
  } catch (err) {
    console.error('[Workload API Error]:', err);
    res.status(500).json({ error: 'Lỗi tải báo cáo workload: ' + err.message });
  }
});

const OPP_STATUS_MAP = {
  1: { key: 'cancel', vi: 'Đã hủy', en: 'Cancel', color: '#EF4444' },
  2: { key: 'closed', vi: 'Đã đóng', en: 'Closed', color: '#64748B' },
  3: { key: 'commit', vi: 'Cam kết', en: 'Commit', color: '#3B82F6' },
  4: { key: 'internal', vi: 'Nội bộ', en: 'Internal', color: '#8B5CF6' },
  5: { key: 'lost', vi: 'Thất bại', en: 'Lost', color: '#DC2626' },
  6: { key: 'open', vi: 'Đang mở', en: 'Open', color: '#0EA5E9' },
  7: { key: 'pending', vi: 'Chờ xử lý', en: 'Pending', color: '#F59E0B' },
  8: { key: 'won', vi: 'Thành công', en: 'Won', color: '#10B981' },
  9: { key: 'upside', vi: 'Tiềm năng cao', en: 'Upside', color: '#06B6D4' },
  10: { key: 'at_risk', vi: 'Rủi ro', en: 'At risk', color: '#F97316' }
};

/**
 * GET /api/workload/opportunity/:id
 * Deep-dive into an opportunity: team members, roles, requests, tasks progress
 */
router.get('/opportunity/:id', async (req, res) => {
  const oppId = req.params.id;
  try {
    const oppRes = await pool.query(`
      SELECT o.*, 
             COALESCE(c.company_shortname, c.company_fullname) as company_name,
             e.full_name as sale_lead_name,
             COALESCE(e.avatar, e.picture) as sale_lead_avatar,
             d.department_name as sale_lead_dept,
             e.position as sale_lead_position
      FROM oppotunity o
      LEFT JOIN company c ON o.id__company = c.company_id
      LEFT JOIN employee e ON o.sale_lead = e.employee_id OR o.sale_lead = e.email
      LEFT JOIN department d ON e.department_id = d.department_id
      WHERE o.project_id = $1 AND o.deleted_at IS NULL
    `, [oppId]);

    if (!oppRes.rows[0]) {
      return res.status(404).json({ error: 'Không tìm thấy cơ hội' });
    }
    const opp = oppRes.rows[0];

    // Linked requests
    const reqRes = await pool.query(`
      SELECT request_id, description, sr_status, requester, sr_creater, sr_owner, policy_lead, approval_flow, sr_created_date
      FROM request
      WHERE (id__oppotunity = $1 OR request_id = $2) AND deleted_at IS NULL
      ORDER BY sr_created_date DESC
    `, [oppId, opp.id__request || '']);

    // Linked contracts with contractor company name
    const conRes = await pool.query(`
      SELECT c.contract_id, c.contract_name_or_description, c.contractspood_no,
             c.total_value, c.total_value_in_base_currency, c.currency, 
             c.contract_owner, c.type, c.contractor, c.contract_signed_date,
             co.company_shortname, co.company_fullname
      FROM contract c
      LEFT JOIN company co ON c.contractor::text = co.company_id::text
      WHERE c.project = $1 AND c.deleted_at IS NULL
      ORDER BY c.type ASC, c.contract_signed_date DESC NULLS LAST
    `, [oppId]);

    // Linked payments with counterparty details
    const payRes = await pool.query(`
      SELECT p.payment_id, p.contractspood, p.contract_id, p.value, p.total_value, 
             p.value_in_base_currency, p.currency, p.payment_status, p.payment_type,
             p.payment_date, p.payment_description, p.counter_party, p.company, p.employee, p.transaction_id,
             CASE 
               WHEN NULLIF(p.company, '') IS NOT NULL THEN p.company 
               WHEN NULLIF(p.employee, '') IS NOT NULL THEN p.employee 
               WHEN p.counter_party NOT IN ('Counter party (Company or Individual)', 'Employee', 'Company', '—') THEN p.counter_party 
               ELSE NULL 
             END AS counter_party_id,
             co.company_shortname as cp_company_shortname,
             co.company_fullname as cp_company_fullname,
             e.full_name as cp_employee_name
      FROM payment p
      LEFT JOIN company co ON (NULLIF(p.company, '') IS NOT NULL AND p.company::text = co.company_id::text)
                           OR (NULLIF(p.company, '') IS NULL AND p.counter_party NOT IN ('Counter party (Company or Individual)', 'Employee', 'Company') AND p.counter_party::text = co.company_id::text)
      LEFT JOIN employee e ON (NULLIF(p.employee, '') IS NOT NULL AND (LOWER(TRIM(p.employee::text)) = LOWER(TRIM(e.employee_id::text)) OR LOWER(TRIM(p.employee::text)) = LOWER(TRIM(e.email))))
                           OR (NULLIF(p.employee, '') IS NULL AND p.counter_party NOT IN ('Counter party (Company or Individual)', 'Employee', 'Company') AND (LOWER(TRIM(p.counter_party::text)) = LOWER(TRIM(e.employee_id::text)) OR LOWER(TRIM(p.counter_party::text)) = LOWER(TRIM(e.email))))
      WHERE p.project = $1 AND p.deleted_at IS NULL
      ORDER BY p.payment_type ASC, p.payment_date DESC NULLS LAST
    `, [oppId]);

    // Linked Service Delivery Contracts with contract number
    const sdcRes = await pool.query(`
      SELECT sdc.id, sdc.project, sdc.service_scope, sdc.service, sdc.status,
             sdc.start_date, sdc.end_date, sdc.fy, sdc.coordinator__employee,
             sdc.id__contract, sdc.id__service_request, sdc.note, sdc.sd_old_id,
             con.contractspood_no as contract_no,
             e.full_name as coordinator_name,
             COALESCE(e.avatar, e.picture) as coordinator_avatar,
             COUNT(t.id)::int as task_count,
             COUNT(CASE WHEN t.status IN (4, 5) THEN 1 END)::int as completed_tasks,
             COUNT(CASE WHEN t.status IN (2, 3) THEN 1 END)::int as processing_tasks,
             COUNT(CASE WHEN t.status = 1 THEN 1 END)::int as not_started_tasks
      FROM service_delivery_contract sdc
      LEFT JOIN contract con ON sdc.id__contract::text = con.contract_id::text
      LEFT JOIN employee e ON sdc.coordinator__employee = e.employee_id OR sdc.coordinator__employee = e.email
      LEFT JOIN service_task_request t ON t.service_delivery = sdc.id AND t.deleted_at IS NULL
      WHERE (sdc.project = $1 OR sdc.id__contract IN (SELECT contract_id::text FROM contract WHERE project = $1))
        AND sdc.deleted_at IS NULL
      GROUP BY sdc.id, con.contractspood_no, e.full_name, e.avatar, e.picture
      ORDER BY sdc.start_date DESC NULLS LAST
    `, [oppId]);

    // Linked tasks via SDC
    const taskRes = await pool.query(`
      SELECT t.id, t.task_id_view, t.title, t.status, t.tier1_engineer__employee,
             t.service_coordinator__employee, t.created_by, t.related_employees,
             t.started_date, t.end_date, t.service_delivery,
             e.full_name as engineer_name
      FROM service_task_request t
      LEFT JOIN employee e ON t.tier1_engineer__employee = e.employee_id OR t.tier1_engineer__employee = e.email
      JOIN service_delivery_contract sdc ON t.service_delivery = sdc.id
      WHERE (sdc.project = $1 OR sdc.id__contract IN (SELECT contract_id::text FROM contract WHERE project = $1))
        AND t.deleted_at IS NULL
      ORDER BY t.started_date DESC NULLS LAST
    `, [oppId]);

    // All employees lookup with cache
    const { empById, empByEmail } = await getAllEmployeesMap();
    function resolveEmp(key) {
      if (!key) return null;
      const k = String(key).trim();
      return empById[k] || empById[k.toUpperCase()] || empById[k.toLowerCase()] || empByEmail[k.toLowerCase()] || null;
    }

    // Build team breakdown
    const teamMap = {};
    function ensureTeamMember(e) {
      const empKey = e.employee_id.toUpperCase();
      if (!teamMap[empKey]) {
        teamMap[empKey] = {
          employee_id: e.employee_id,
          full_name: e.full_name,
          email: e.email,
          position: e.position || '',
          department_name: e.department_name || '',
          avatar: e.avatar,
          roles: new Set(),
          requests_count: 0,
          request_roles_detail: {},
          tasks_count: 0,
          task_status: { completed: 0, in_progress: 0, pending: 0, other: 0 }
        };
      }
      return teamMap[empKey];
    }

    // 1. Sale Lead
    if (opp.sale_lead) {
      const e = resolveEmp(opp.sale_lead);
      if (e) {
        ensureTeamMember(e).roles.add('Sale Lead');
      }
    }

    // 2. Related employees in opportunity
    if (Array.isArray(opp.related_employees)) {
      opp.related_employees.forEach(id => {
        const e = resolveEmp(id);
        if (e) ensureTeamMember(e).roles.add('Team Member');
      });
    }

    // 3. Process requests
    reqRes.rows.forEach(r => {
      const reqOwners = Array.isArray(r.sr_owner) ? r.sr_owner : (r.sr_owner ? [r.sr_owner] : []);
      reqOwners.forEach(o => {
        const e = resolveEmp(o);
        if (e) {
          const m = ensureTeamMember(e);
          m.roles.add('SR Owner');
          m.requests_count++;
          m.request_roles_detail['SR Owner'] = (m.request_roles_detail['SR Owner'] || 0) + 1;
        }
      });

      const reqUser = resolveEmp(r.requester) || resolveEmp(r.sr_creater);
      if (reqUser) {
        const m = ensureTeamMember(reqUser);
        m.roles.add('Requester');
        m.requests_count++;
        m.request_roles_detail['Requester'] = (m.request_roles_detail['Requester'] || 0) + 1;
      }

      const plUser = resolveEmp(r.policy_lead);
      if (plUser) {
        const m = ensureTeamMember(plUser);
        m.roles.add('Policy Lead');
        m.requests_count++;
        m.request_roles_detail['Policy Lead'] = (m.request_roles_detail['Policy Lead'] || 0) + 1;
      }

      if (r.approval_flow && Array.isArray(r.approval_flow.steps)) {
        r.approval_flow.steps.forEach(st => {
          const appUser = resolveEmp(st.approver);
          if (appUser) {
            const m = ensureTeamMember(appUser);
            m.roles.add(`Approver T${st.level}`);
            m.requests_count++;
            m.request_roles_detail[`Approver T${st.level}`] = (m.request_roles_detail[`Approver T${st.level}`] || 0) + 1;
          }
        });
      }
    });

    // 4. Process service tasks
    taskRes.rows.forEach(t => {
      const eng = resolveEmp(t.tier1_engineer__employee);
      if (eng) {
        const m = ensureTeamMember(eng);
        m.roles.add('Engineer (T1)');
        m.tasks_count++;
        if (t.status === 5) m.task_status.completed++;
        else if (t.status === 4 || t.status === 2) m.task_status.in_progress++;
        else if (t.status === 1 || t.status === 6) m.task_status.pending++;
        else m.task_status.other++;
      }

      const coord = resolveEmp(t.service_coordinator__employee);
      if (coord && (!eng || coord.employee_id !== eng.employee_id)) {
        const m = ensureTeamMember(coord);
        m.roles.add('Coordinator');
        m.tasks_count++;
        if (t.status === 5) m.task_status.completed++;
        else if (t.status === 4 || t.status === 2) m.task_status.in_progress++;
        else if (t.status === 1 || t.status === 6) m.task_status.pending++;
        else m.task_status.other++;
      }
    });

    const teamList = Object.values(teamMap).map(m => ({
      ...m,
      roles: Array.from(m.roles),
      task_completed_pct: m.tasks_count > 0 ? Math.round((m.task_status.completed / m.tasks_count) * 100) : 0
    }));

    // Sort: Sale Lead first, then by task / request counts
    teamList.sort((a, b) => {
      const aLead = a.roles.includes('Sale Lead') ? 1 : 0;
      const bLead = b.roles.includes('Sale Lead') ? 1 : 0;
      if (aLead !== bLead) return bLead - aLead;
      return (b.requests_count + b.tasks_count) - (a.requests_count + a.tasks_count);
    });

    function getConBaseVal(c) {
      const b = parseFloat(c.total_value_in_base_currency);
      if (!isNaN(b) && b > 0) return b;
      const t = parseFloat(c.total_value);
      if (!isNaN(t)) return t;
      return 0;
    }
    function getPayBaseVal(p) {
      const b = parseFloat(p.value_in_base_currency);
      if (!isNaN(b) && b > 0) return b;
      const t = parseFloat(p.total_value);
      if (!isNaN(t) && t > 0) return t;
      const v = parseFloat(p.value);
      if (!isNaN(v)) return v;
      return 0;
    }

    const sellingContracts = conRes.rows.filter(c => c.type === 69);
    const buyingContracts = conRes.rows.filter(c => c.type === 70);
    const sellingContractVal = sellingContracts.reduce((sum, c) => sum + getConBaseVal(c), 0);
    const buyingContractVal = buyingContracts.reduce((sum, c) => sum + getConBaseVal(c), 0);
    const allContractVal = conRes.rows.reduce((sum, c) => sum + getConBaseVal(c), 0);

    const incomingPayments = payRes.rows.filter(p => (p.payment_type === 60 || !p.payment_type) && (p.payment_status === 32 || String(p.payment_status).toLowerCase() === 'paid'));
    const outgoingPayments = payRes.rows.filter(p => p.payment_type === 61 && (p.payment_status === 32 || String(p.payment_status).toLowerCase() === 'paid'));
    const incomingPaidVal = incomingPayments.reduce((sum, p) => sum + getPayBaseVal(p), 0);
    const outgoingPaidVal = outgoingPayments.reduce((sum, p) => sum + getPayBaseVal(p), 0);
    const marginVal = (sellingContractVal > 0 ? sellingContractVal : allContractVal) - buyingContractVal;

    res.json({
      opportunity: {
        ...opp,
        status_info: OPP_STATUS_MAP[opp.status] || { key: 'unknown', vi: 'Khác', en: 'Other', color: '#9CA3AF' },
        contract_value: sellingContractVal || allContractVal,
        paid_value: incomingPaidVal,
        selling_contract_value: sellingContractVal,
        buying_contract_value: buyingContractVal,
        all_contract_value: allContractVal,
        incoming_paid_value: incomingPaidVal,
        outgoing_paid_value: outgoingPaidVal,
        margin_value: marginVal,
        selling_count: sellingContracts.length,
        buying_count: buyingContracts.length,
        incoming_count: incomingPayments.length,
        outgoing_count: outgoingPayments.length
      },
      team_breakdown: teamList,
      requests: reqRes.rows,
      service_deliveries: sdcRes.rows,
      tasks: taskRes.rows,
      contracts: conRes.rows,
      payments: payRes.rows
    });
  } catch (err) {
    console.error('[Opportunity Detail Error]:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/workload/employee/:id
 * Detailed profile & dossier for a single employee
 */
router.get('/employee/:id', async (req, res) => {
  const empId = req.params.id;
  try {
    const [empRes, reqRes, oppRes, taskRes] = await Promise.all([
      pool.query(`
        SELECT e.*, d.department_name
        FROM employee e
        LEFT JOIN department d ON e.department_id = d.department_id
        WHERE e.employee_id = $1 AND e.deleted_at IS NULL
      `, [empId]),
      pool.query(`
        SELECT 
          request_id, description, sr_status, requester, 
          policy_lead, sr_owner, sr_created_date, sr_submitted_date
        FROM request
        WHERE deleted_at IS NULL 
          AND (
            requester = $1 OR 
            sr_creater = $1 OR 
            policy_lead = $1 OR 
            $1 = ANY(sr_owner)
          )
        ORDER BY sr_created_date DESC
        LIMIT 50
      `, [empId]),
      pool.query(`
        SELECT 
          project_id, project_name, estimated_revenue, currency,
          status, stage, create_date, close_date, sale_lead, id__company
        FROM oppotunity
        WHERE deleted_at IS NULL 
          AND (
            sale_lead = $1 OR 
            sale_lead = (SELECT email FROM employee WHERE employee_id = $1) OR
            $1 = ANY(related_employees)
          )
        ORDER BY create_date DESC
        LIMIT 50
      `, [empId]),
      pool.query(`
        SELECT t.id, t.task_id_view, t.title, t.status, t.started_date, t.end_date,
               t.tier1_engineer__employee, t.service_coordinator__employee
        FROM service_task_request t
        WHERE t.deleted_at IS NULL
          AND (
            t.tier1_engineer__employee = $1 OR 
            t.service_coordinator__employee = $1 OR 
            t.created_by = $1 OR 
            $1 = ANY(t.related_employees)
          )
        ORDER BY t.started_date DESC NULLS LAST
        LIMIT 50
      `, [empId])
    ]);

    if (empRes.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy nhân viên' });
    }

    const emp = empRes.rows[0];

    const formattedOpps = oppRes.rows.map(o => ({
      ...o,
      status_info: OPP_STATUS_MAP[o.status] || { key: 'unknown', vi: 'Khác', en: 'Other', color: '#9CA3AF' }
    }));

    res.json({
      employee: emp,
      requests: reqRes.rows,
      opportunities: formattedOpps,
      tasks: taskRes.rows
    });
  } catch (err) {
    console.error('[Workload Employee Detail Error]:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

