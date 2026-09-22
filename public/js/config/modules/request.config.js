/**
 * request.config.js - Modular Config for CRC / TeraX v2
 * Domain: request
 */
(function() {
  window.__MODULE_CONFIGS__ = window.__MODULE_CONFIGS__ || {};
  Object.assign(window.__MODULE_CONFIGS__, {
  request: {
    label: 'Requests',
    subtitle: 'Manage internal requests',
    endpoint: '/table/request',
    pk: 'request_id',
    icon: '🛠️',
    children: ['comment', 'payment', 'expense', 'invoice', 'service', 'asset', 'contract', 'target_table', 'request_rating', 'logs'],
    columns: [
      { key: 'request_id', label: 'ID', hidden: true },
      { key: 'description', label: 'Description' },
      { key: 'request_type', label: 'Process Type', labelKey: 'col.process_type', optionsFrom: 'policy', optionValue: 'policy_id', optionLabel: 'policy_name' },
      { key: 'requester', label: 'Requester', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name' },
      { key: 'sr_creater', label: 'SR Creater', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name' },
      { key: 'sr_status', label: 'SR Status', labelKey: 'col.sr_status', badge: true },
      { key: 'sr_submitted_date', label: 'Submited Date', labelKey: 'col.sr_submitted_date' },
      { key: 'sr_owner', label: 'SR Owner', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name' },
      { key: 'policy_lead', label: 'Policy Lead', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name' },
      { key: 'process_status', label: 'Process Status', badge: true },
      { key: 'process_duration', label: 'Processing Time', labelKey: 'col.process_duration' },
      { key: 'sla_status', label: 'SLA Qualification', labelKey: 'col.sla_status', badge: true },
    ],
    fields: [
      { section: 'requester' },
      { key: 'sr_status', type: 'text', hidden: true, defaultValue: 1 },
      { key: 'requester', label: 'REQUESTER', type: 'select', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name', defaultValue: () => authUser.employee_id, onchange: 'handleRequestTypeChange(\'requester\')', full: true, required: true },
      {
        key: 'company_id',
        label: 'MY COMPANY',
        labelKey: 'col.my_company',
        type: 'select',
        optionsFrom: 'my_company',
        optionValue: 'my_company_id',
        optionLabel: 'company_shortname',
        onchange: 'handleRequestCompanyChange()',
        required: true
      },
      { key: 'request_type', label: 'PROCESS TYPE', labelKey: 'col.process_type', type: 'select', optionsFrom: 'policy', optionValue: 'policy_id', optionLabel: 'policy_name', onchange: 'handleRequestTypeChange(\'request_type\')', required: true },
      { key: 'approval_level', labelKey: 'col.non_standard', label: 'Non Standard', type: 'select', options: ['Standard', 'Non-Standard'], defaultValue: 'Standard' },
      { key: 'process_type_description', label: 'PROCESS TYPE DESCRIPTION', type: 'textarea', createReadonly: true, editReadonly: true, full: true },
      { key: 'description', label: 'DESCRIPTION', type: 'textarea', full: true, required: true },
      { section: 'request detail' },
      { key: 'elements', label: 'ELEMENTS', labelKey: 'col.elements', type: 'multiselect', options: ['Contract', 'Payment', 'Invoice', 'Expense', 'Service', 'Asset', 'Target table', 'Assign task', 'Opportunity', 'Finance'], createHidden: true, editReadonly: true, full: true },
      { key: 'comment', label: 'COMMENT', type: 'textarea', full: true },
      { key: 'file', label: 'FILE', type: 'file', full: true },
    ],
    detailFields: [
      { section: 'request information' },
      { key: 'non_standard', label: 'Non Standard' },
      { key: 'request_type', label: 'Process Type', labelKey: 'col.process_type', optionsFrom: 'policy', optionValue: 'policy_id', optionLabel: 'policy_name' },
      { key: 'requester', label: 'Requester', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name' },
      { key: 'request_id', label: 'Request id' },
      { key: 'sr_creater', label: 'SR Creater', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name' },
      { key: 'sr_created_date', label: 'Created date', labelKey: 'col.sr_created_date' },
      { key: 'sr_submitted_date', label: 'Submited Date' },
      { key: 'sr_close_date', label: 'Closed Date', labelKey: 'col.sr_close_date' },
      { section: 'approval status' },
      { key: 'approval_flow', label: 'Approval Status', full: true },
      { section: 'process information' },
      { key: 'policy_lead', label: 'Policy Lead', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name' },
      { key: 'sr_owner', label: 'SR Owner', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name' },
      { key: 'process_start_date', label: 'Process Start Date' },
      { key: 'process_end_date', label: 'Process End Date' },
      { key: 'policy_sla', label: 'Process SLA (Days)', labelKey: 'col.policy_sla' },
      { key: 'process_duration', label: 'Processing Time', labelKey: 'col.process_duration' },
      { key: 'sla_status', label: 'SLA Qualification', labelKey: 'col.sla_status', badge: true, full: true },
      { key: 'elements', label: 'Elements', labelKey: 'col.elements', full: true },
    ],
    displayName: (r) => {
      let pName = r.request_type || '';
      try {
        if (typeof selectCache !== 'undefined' && selectCache['policy']) {
          const p = selectCache['policy'].find(x => x.policy_id === r.request_type);
          if (p) pName = p.policy_name || r.request_type;
        }
      } catch (e) { }
      const reqId = (window.getFormattedRequestCode ? window.getFormattedRequestCode(r) : r.request_id) || '';
      const desc = r.description || '';
      return [pName, desc, reqId].filter(x => x !== null && x !== undefined && x !== '').join(' | ');
    },
  },

  comment: {
    label: 'Comment',
    subtitle: 'Comments and attachments for requests',
    endpoint: '/table/comment',
    pk: 'comment_id',
    icon: '💬',
    columns: [
      { key: 'comment_id', label: 'ID', hidden: true },
      { key: 'request', label: 'Request ID' },
      { key: 'comment', label: 'Comment' },
      { key: 'tag', label: 'Tag' },
      { key: 'link', label: 'Link' },
      { key: 'comment_date', label: 'Comment Date' }
    ],
    fields: [
      { key: 'request', label: 'Request ID', type: 'select', optionsFrom: 'request', optionValue: 'request_id', optionLabel: 'request_id', createReadonly: true, editReadonly: true },
      { key: 'comment', label: 'Comment', type: 'textarea', full: true },
      { key: 'file', label: 'File', type: 'file', full: true },
      { key: 'link', label: 'Link', type: 'text', full: true },
      { key: 'reply_to', label: 'Reply To', type: 'text', hidden: true },
      { key: 'tag', label: 'Tag', type: 'multiselect', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name', full: true }
    ],
    displayName: (r) => r.comment_id || r.comment || 'Comment'
  },

  request_activity_log: {
    label: 'Audit and Backup',
    subtitle: 'Track database activity logs and manage backups',
    endpoint: '/my-views/request-activity-log',
    pk: 'id',
    icon: 'history',
    hasRowActions: false,
    columns: [
      { key: 'log_time', label: 'Time' },
      { key: 'table_name', label: 'Table' },
      { key: 'request_id', label: 'Record ID' },
      { key: 'description', label: 'Description' },
      { key: 'username', label: 'User', optionsFrom: 'employee', optionValue: 'email', optionLabel: 'full_name' },
      { key: 'changes', label: 'Changes' },
    ],
    fields: [
      { key: 'log_time', label: 'Time', type: 'text', readOnly: true },
      { key: 'table_name', label: 'Table', type: 'text', readOnly: true },
      { key: 'request_id', label: 'Record ID', type: 'text', readOnly: true },
      { key: 'description', label: 'Description', type: 'text', readOnly: true },
      { key: 'username', label: 'User', type: 'text', readOnly: true, optionsFrom: 'employee', optionValue: 'email', optionLabel: 'full_name' },
      { key: 'changes', label: 'Changes', type: 'textarea', readOnly: true, full: true },
    ],
    readOnly: true,
    displayName: (r) => `${r.table_name ? (r.table_name.charAt(0).toUpperCase() + r.table_name.slice(1).replace(/_/g, ' ')) : ''} #${r.request_id} - ${r.action}`,
  },

  logs: {
    label: 'History & Logs',
    icon: 'history',
    pk: 'request_id',
    endpoint: '/table/request',
    columns: [],
    fields: []
  }
  });

  // Post-initialization: Extensions for Request & My Views
  window.__MODULE_EXTENSIONS__ = window.__MODULE_EXTENSIONS__ || [];
  window.__MODULE_EXTENSIONS__.push(function(MODULES) {
    // Define "My" views that extend the core request module definition
    MODULES.my_request = {
      ...MODULES.request,
      label: 'My Requests',
      subtitle: 'Track your requests',
      endpoint: '/my-views/my-request',
      writeTable: 'request',
      icon: 'check_box',
      fields: MODULES.request.fields
    };
    
    MODULES.my_approval = {
      ...MODULES.request,
      label: 'My Approvals',
      subtitle: 'Approve pending requests',
      endpoint: '/my-views/my-approval',
      writeTable: 'request',
      icon: 'person'
    };
    
    MODULES.my_process_owner = {
      ...MODULES.request,
      label: 'My Task',
      subtitle: 'Process owner requests',
      endpoint: '/my-views/my-process-owner',
      writeTable: 'request',
      icon: 'assignment_ind'
    };
    
    MODULES.my_task = MODULES.my_process_owner;
    
    MODULES.my_team = {
      ...MODULES.request,
      label: 'My Process',
      subtitle: 'Processes led by you',
      endpoint: '/my-views/my-team',
      writeTable: 'request',
      icon: 'account_tree'
    };
    
    MODULES.assigned_task = {
      label: 'My Tasks',
      subtitle: 'Tasks assigned to you',
      endpoint: '/table/assigned_task',
      pk: 'task_id',
      icon: 'task',
      children: ['task_subtask', 'logs'],
      columns: [
        { key: 'task_id', label: 'ID', hidden: true },
        { key: 'employee_id', label: 'Assignee', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name' },
        { key: 'deadline', label: 'Deadline' },
        { key: 'status', label: 'Status', badge: true },
        { key: 'description', label: 'Description' }
      ],
      fields: [
        { key: 'task_id', label: 'Task ID', type: 'text', editReadonly: true, placeholder: 'Auto-generated' },
        { key: 'request_id', label: 'Request', type: 'select', optionsFrom: 'request', optionValue: 'request_id', optionLabel: 'description', editReadonly: true, required: true },
        { key: 'employee_id', label: 'Assignee', type: 'select', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name', required: true },
        { key: 'deadline', label: 'Deadline', type: 'date', minDate: 'today' },
        { key: 'description', label: 'Description', type: 'textarea', full: true },
        { section: 'Task Information' },
        { key: 'task_info_link', label: 'Link', type: 'text' },
        { key: 'task_info_guide_file', label: 'Guide File', type: 'file', full: true },
        { key: 'task_info_notes', label: 'Notes', type: 'textarea', full: true },
        { key: 'task_info_report', label: 'Report / Feedback', type: 'textarea', full: true },
        { key: 'task_info_comment', label: 'Evaluation / Comment', type: 'textarea', full: true },
        { key: 'status', label: 'Status', type: 'segmented', options: [{ value: 62, label: 'Not started yet' }, { value: 63, label: 'Processing' }, { value: 64, label: 'Completed' }], defaultValue: 62 }
      ],
      detailFields: [
        { section: 'Task Details' },
        { key: 'task_id', label: 'Task ID' },
        { key: 'request_id', label: 'Request' },
        { key: 'employee_id', label: 'Assignee' },
        { key: 'deadline', label: 'Deadline' },
        { key: 'description', label: 'Description' },
        { key: 'status', label: 'Status' },
        { section: 'Task Information' },
        { key: 'task_info_link', label: 'Link', type: 'link' },
        { key: 'task_info_guide_file', label: 'Guide File', type: 'file' },
        { key: 'task_info_notes', label: 'Notes' },
        { key: 'task_info_report', label: 'Report / Feedback' },
        { key: 'task_info_comment', label: 'Evaluation / Comment' },
      ],
      displayName: (r) => r.task_id || 'Task'
    };
    
    MODULES.task_subtask = {
      label: 'Subtasks',
      subtitle: 'Manage subtasks',
      endpoint: '/table/task_subtask',
      pk: 'subtask_id',
      icon: 'subdirectory_arrow_right',
      columns: [
        { key: 'subtask_id', label: 'ID', hidden: true },
        { key: 'task_id', label: 'Task ID', hidden: true },
        { key: 'description', label: 'Description' },
        { key: 'status', label: 'Status', badge: true }
      ],
      fields: [
        { key: 'subtask_id', label: 'Subtask ID', type: 'text', editReadonly: true, placeholder: 'Auto-generated' },
        { key: 'task_id', label: 'Task ID', type: 'text', hidden: true },
        { key: 'description', label: 'Description', type: 'text', required: true },
        { key: 'status', label: 'Status', type: 'segmented', options: [{ value: 65, label: 'Pending' }, { value: 66, label: 'Completed' }], defaultValue: 65 }
      ],
      displayName: (r) => r.description || r.subtask_id || 'Subtask'
    };
    
    MODULES.request_rating = {
      label: 'Feedback',
      labelKey: 'module.request_rating.title',
      subtitle: 'Manage request ratings',
      endpoint: '/table/request_rating',
      pk: 'id',
      icon: 'star',
      columns: [
        { key: 'to_user', label: 'Employee', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name' },
        { key: 'point', label: 'Points' },
        { key: 'comment', label: 'Comment' },
        { key: 'created_at', label: 'Created At' }
      ],
      fields: [
        { key: 'to_user', label: 'Employee', type: 'select', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name', required: true },
        { key: 'point', label: 'Points', type: 'number', required: true },
        { key: 'comment', label: 'Comment', type: 'textarea', full: true }
      ],
      displayName: (r) => `Rating for ${r.to_user}`
    };
  });
})();
