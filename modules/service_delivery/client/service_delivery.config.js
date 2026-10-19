/**
 * service_delivery.config.js - Service Delivery Contract & Service Task Request Module Extension
 * Domain: service_delivery
 */
(function() {
  window.__MODULE_EXTENSIONS__ = window.__MODULE_EXTENSIONS__ || [];
  window.__MODULE_EXTENSIONS__.push(function(MODULES) {

    // 1. MODULE: Service Delivery Contract (Element of Opportunity)
    MODULES.service_delivery_contract = {
      label: 'Service Delivery Contracts',
      labelKey: 'nav.service_delivery_contract',
      subtitle: 'Manage service delivery agreements and SLA',
      endpoint: '/table/service_delivery_contract',
      pk: 'id',
      icon: '🛠️',
      groupBy: ['fy', 'status', 'coordinator__employee'],
      columns: [
        { key: 'id', label: 'SD ID', labelKey: 'col.service_delivery_id', width: '120px' },
        { key: 'sd_old_id', label: 'Legacy ID', labelKey: 'col.sd_old_id', width: '110px' },
        { key: 'project', label: 'Opportunity', labelKey: 'col.opportunity', optionsFrom: 'oppotunity', optionValue: 'project_id', optionLabel: 'project_label' },
        { key: 'service_scope', label: 'Service Scope', labelKey: 'col.service_scope', full: true },
        { key: 'coordinator__employee', label: 'Coordinator', labelKey: 'col.coordinator__employee', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name' },
        { key: 'service', label: 'Service', labelKey: 'col.service', optionsFrom: 'service', optionValue: 'service_id', optionLabel: 'service_name' },
        { key: 'status', label: 'Status', labelKey: 'col.status', badge: true },
        { key: 'fy', label: 'FY', labelKey: 'col.fy', width: '80px' },
        { key: 'start_date', label: 'Start Date', labelKey: 'col.start_date' },
        { key: 'end_date', label: 'End Date', labelKey: 'col.end_date' },
        { key: 'id__sla_response_time', label: 'SLA Response', labelKey: 'col.id__sla_response_time' },
        { key: 'id__sla_completed_time', label: 'SLA Completed', labelKey: 'col.id__sla_completed_time' },
        { key: 'id__service_request', label: 'Service Request', labelKey: 'col.id__service_request', optionsFrom: 'request', optionValue: 'request_id', optionLabel: 'description', hidden: true }
      ],
      fields: [
        { section: 'contract information' },
        { key: 'service_scope', label: 'SERVICE SCOPE', labelKey: 'col.service_scope', type: 'textarea', required: true, full: true },
        { key: 'coordinator__employee', label: 'COORDINATOR', labelKey: 'col.coordinator__employee', type: 'select', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name', required: true },
        { key: 'status', label: 'STATUS', labelKey: 'col.status', type: 'segmented', options: [{ value: 140, label: 'Active' }, { value: 141, label: 'Pending' }, { value: 142, label: 'Expired' }, { value: 143, label: 'Terminated' }], defaultValue: 140 },
        { key: 'service', label: 'SERVICE', labelKey: 'col.service', type: 'select', optionsFrom: 'service', optionValue: 'service_id', optionLabel: 'service_name' },
        { key: 'sd_old_id', label: 'LEGACY ID', labelKey: 'col.sd_old_id', type: 'text' },
        { key: 'fy', label: 'FISCAL YEAR (FY)', labelKey: 'col.fy', type: 'text', placeholder: 'e.g. FY26' },
        { section: 'period & sla' },
        { key: 'start_date', label: 'START DATE', labelKey: 'col.start_date', type: 'date', required: true },
        { key: 'end_date', label: 'END DATE', labelKey: 'col.end_date', type: 'date', required: true },
        { key: 'id__sla_response_time', label: 'SLA RESPONSE TIME', labelKey: 'col.id__sla_response_time', type: 'select', options: ['15m', '30m', '1h', '2h', '4h', '8h', '24h'] },
        { key: 'id__sla_completed_time', label: 'SLA COMPLETED TIME', labelKey: 'col.id__sla_completed_time', type: 'select', options: ['2h', '4h', '8h', '24h', 'NBD (Next Business Day)', '48h', '72h'] },
        { section: 'relations' },
        { key: 'project', label: 'OPPORTUNITY', labelKey: 'col.opportunity', type: 'select', optionsFrom: 'oppotunity', optionValue: 'project_id', optionLabel: 'project_label' },
        { key: 'id__service_request', label: 'SERVICE REQUEST', labelKey: 'col.id__service_request', type: 'select', optionsFrom: 'request', optionValue: 'request_id', optionLabel: 'description', hidden: true },
        { key: 'note', label: 'NOTE', labelKey: 'col.note', type: 'textarea', full: true }
      ],
      detailFields: [
        { section: 'contract information' },
        { key: 'id', label: 'SERVICE DELIVERY ID', labelKey: 'col.service_delivery_id', full: true },
        { key: 'service_scope', label: 'SERVICE SCOPE', labelKey: 'col.service_scope', full: true },
        { key: 'coordinator__employee', label: 'COORDINATOR', labelKey: 'col.coordinator__employee', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name' },
        { key: 'status', label: 'STATUS', labelKey: 'col.status', badge: true },
        { key: 'service', label: 'SERVICE', labelKey: 'col.service', optionsFrom: 'service', optionValue: 'service_id', optionLabel: 'service_name' },
        { key: 'sd_old_id', label: 'LEGACY ID', labelKey: 'col.sd_old_id' },
        { key: 'fy', label: 'FISCAL YEAR', labelKey: 'col.fy' },
        { section: 'period & sla' },
        { key: 'start_date', label: 'START DATE', labelKey: 'col.start_date' },
        { key: 'end_date', label: 'END DATE', labelKey: 'col.end_date' },
        { key: 'id__sla_response_time', label: 'SLA RESPONSE TIME', labelKey: 'col.id__sla_response_time' },
        { key: 'id__sla_completed_time', label: 'SLA COMPLETED TIME', labelKey: 'col.id__sla_completed_time' },
        { section: 'relations' },
        { key: 'project', label: 'OPPORTUNITY', labelKey: 'col.opportunity', optionsFrom: 'oppotunity', optionValue: 'project_id', optionLabel: 'project_label', full: true },
        { key: 'id__service_request', label: 'SERVICE REQUEST', labelKey: 'col.id__service_request', optionsFrom: 'request', optionValue: 'request_id', optionLabel: 'description', hidden: true, full: true },
        { key: 'note', label: 'NOTE', labelKey: 'col.note', full: true }
      ],
      displayName: (r) => {
        if (!r || !r.id) return 'SD Contract';
        const desc = r.service_scope || r.note || r.description || '';
        return desc ? `${r.id} | ${desc}` : r.id;
      },
      children: ['service_task_request', 'comment', 'logs']
    };

    // 2. MODULE: Service Task Request (Element inside Service Delivery Contract)
    MODULES.service_task_request = {
      label: 'Service Task Requests',
      labelKey: 'nav.service_task_request',
      subtitle: 'Manage technical tasks under service delivery contracts',
      endpoint: '/table/service_task_request',
      pk: 'id',
      icon: '📋',
      groupBy: ['fy', 'status', 'severity_level', 'method'],
      columns: [
        { key: 'id', label: 'Task ID', labelKey: 'col.service_task_id', width: '120px' },
        { key: 'title', label: 'Title', labelKey: 'col.task_title', full: true },
        { key: 'service_delivery', label: 'SD Contract', labelKey: 'col.service_delivery', optionsFrom: 'service_delivery_contract', optionValue: 'id', optionLabel: 'service_delivery_label' },
        { key: 'severity_level', label: 'Severity', labelKey: 'col.severity_level', badge: true },
        { key: 'method', label: 'Method', labelKey: 'col.method', badge: true },
        { key: 'status', label: 'Status', labelKey: 'col.status', badge: true },
        { key: 'tier1_engineer__employee', label: 'T1 Engineer', labelKey: 'col.tier1_engineer__employee', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name' },
        { key: 'service_coordinator__employee', label: 'Coordinator', labelKey: 'col.service_coordinator__employee', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name' },
        { key: 'report_status', label: 'Report Status', labelKey: 'col.report_status', badge: true },
        { key: 'fy', label: 'FY', labelKey: 'col.fy', width: '80px' },
        { key: 'started_date', label: 'Started Date', labelKey: 'col.started_date' },
        { key: 'end_date', label: 'End Date', labelKey: 'col.end_date' },
        // Hidden columns according to user requirement (marked with * and support ticket)
        { key: 'task_id_view', label: 'Task View ID', labelKey: 'col.task_id_view', hidden: true },
        { key: 'report', label: 'Report File', labelKey: 'col.report', hidden: true },
        { key: 'report_template', label: 'Report Template', labelKey: 'col.report_template', hidden: true },
        { key: 'report_status_app', label: 'Report Status App', labelKey: 'col.report_status_app', hidden: true },
        { key: 'id__support_ticket', label: 'Support Ticket', labelKey: 'col.id__support_ticket', hidden: true },
        { key: 'id__contact', label: 'Contact', labelKey: 'col.id__contact', hidden: true },
        { key: 'id__engineer_request', label: 'Engineer Request', labelKey: 'col.id__engineer_request', hidden: true },
        { key: 'id__sc_request', label: 'SC Request', labelKey: 'col.id__sc_request', hidden: true },
        { key: 'id__hc_review_request', label: 'HC Review Request', labelKey: 'col.id__hc_review_request', hidden: true }
      ],
      fields: [
        { section: 'task information' },
        { key: 'title', label: 'TITLE', labelKey: 'col.task_title', type: 'text', required: true, full: true },
        { key: 'description', label: 'DESCRIPTION', labelKey: 'col.description', type: 'textarea', full: true },
        { key: 'service_delivery', label: 'SERVICE DELIVERY CONTRACT', labelKey: 'col.service_delivery', type: 'select', optionsFrom: 'service_delivery_contract', optionValue: 'id', optionLabel: 'service_delivery_label', required: true },
        { key: 'severity_level', label: 'SEVERITY LEVEL', labelKey: 'col.severity_level', type: 'segmented', options: ['Critical', 'High', 'Medium', 'Low'], defaultValue: 'Medium' },
        { key: 'method', label: 'METHOD', labelKey: 'col.method', type: 'segmented', options: ['Remote', 'Onsite', 'Hybrid'], defaultValue: 'Remote' },
        { key: 'type', label: 'TYPE', labelKey: 'col.task_type', type: 'select', options: ['Incident', 'Maintenance', 'Configuration', 'Consulting'] },
        { key: 'delivery_onsite', label: 'ONSITE DELIVERY', labelKey: 'col.delivery_onsite', type: 'segmented', options: [{ value: true, label: 'Yes' }, { value: false, label: 'No' }], defaultValue: false },
        { section: 'personnel' },
        { key: 'tier1_engineer__employee', label: 'TIER 1 ENGINEER', labelKey: 'col.tier1_engineer__employee', type: 'select', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name' },
        { key: 'service_coordinator__employee', label: 'SERVICE COORDINATOR', labelKey: 'col.service_coordinator__employee', type: 'select', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name' },
        { key: 'id__contact', label: 'CONTACT', labelKey: 'col.id__contact', type: 'select', optionsFrom: 'contact', optionValue: 'contact_id', optionLabel: 'name' },
        { key: 'request_source', label: 'REQUEST SOURCE', labelKey: 'col.request_source', type: 'select', options: ['Portal', 'Email', 'Phone', 'Direct', 'Ticket'] },
        { section: 'schedule & status' },
        { key: 'started_date', label: 'STARTED DATE', labelKey: 'col.started_date', type: 'datetime' },
        { key: 'end_date', label: 'END DATE', labelKey: 'col.end_date', type: 'datetime' },
        { key: 'service', label: 'SERVICE', labelKey: 'col.service', type: 'select', optionsFrom: 'service', optionValue: 'service_id', optionLabel: 'service_name' },
        { key: 'status', label: 'STATUS', labelKey: 'col.status', type: 'segmented', options: [{ value: 150, label: 'New' }, { value: 151, label: 'In Progress' }, { value: 152, label: 'Pending Customer' }, { value: 153, label: 'Resolved' }, { value: 154, label: 'Closed' }, { value: 155, label: 'Cancelled' }], defaultValue: 150 },
        { key: 'fy', label: 'FISCAL YEAR (FY)', labelKey: 'col.fy', type: 'text', placeholder: 'e.g. FY26' },
        { section: 'reports' },
        { key: 'report_status', label: 'REPORT STATUS', labelKey: 'col.report_status', type: 'segmented', options: ['Not Required', 'Pending', 'Approved', 'Rejected'], defaultValue: 'Not Required' },
        { key: 'report_content', label: 'REPORT CONTENT', labelKey: 'col.report_content', type: 'textarea', full: true },
        { section: 'linked requests' },
        { key: 'id__engineer_request', label: 'ENGINEER REQUEST', labelKey: 'col.id__engineer_request', type: 'select', optionsFrom: 'request', optionValue: 'request_id', optionLabel: 'description' },
        { key: 'id__sc_request', label: 'SC REQUEST', labelKey: 'col.id__sc_request', type: 'select', optionsFrom: 'request', optionValue: 'request_id', optionLabel: 'description' },
        { key: 'id__hc_review_request', label: 'HC REVIEW REQUEST', labelKey: 'col.id__hc_review_request', type: 'select', optionsFrom: 'request', optionValue: 'request_id', optionLabel: 'description' },
        // Hidden fields in form according to user requirement
        { key: 'task_id_view', label: 'TASK ID VIEW', type: 'text', hidden: true },
        { key: 'report', label: 'REPORT', type: 'text', hidden: true },
        { key: 'report_template', label: 'REPORT TEMPLATE', type: 'text', hidden: true },
        { key: 'report_status_app', label: 'REPORT STATUS APP', type: 'text', hidden: true },
        { key: 'id__support_ticket', label: 'SUPPORT TICKET', type: 'text', hidden: true }
      ],
      detailFields: [
        { section: 'task information' },
        { key: 'id', label: 'TASK ID', labelKey: 'col.service_task_id', full: true },
        { key: 'title', label: 'TITLE', labelKey: 'col.task_title', full: true },
        { key: 'description', label: 'DESCRIPTION', labelKey: 'col.description', full: true },
        { key: 'service_delivery', label: 'SERVICE DELIVERY CONTRACT', labelKey: 'col.service_delivery', optionsFrom: 'service_delivery_contract', optionValue: 'id', optionLabel: 'service_delivery_label', full: true },
        { key: 'severity_level', label: 'SEVERITY LEVEL', labelKey: 'col.severity_level', badge: true },
        { key: 'method', label: 'METHOD', labelKey: 'col.method', badge: true },
        { key: 'type', label: 'TYPE', labelKey: 'col.task_type' },
        { key: 'delivery_onsite', label: 'ONSITE DELIVERY', labelKey: 'col.delivery_onsite' },
        { section: 'personnel' },
        { key: 'tier1_engineer__employee', label: 'TIER 1 ENGINEER', labelKey: 'col.tier1_engineer__employee', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name' },
        { key: 'service_coordinator__employee', label: 'SERVICE COORDINATOR', labelKey: 'col.service_coordinator__employee', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name' },
        { key: 'id__contact', label: 'CONTACT', labelKey: 'col.id__contact', optionsFrom: 'contact', optionValue: 'contact_id', optionLabel: 'name' },
        { key: 'request_source', label: 'REQUEST SOURCE', labelKey: 'col.request_source' },
        { section: 'schedule & status' },
        { key: 'started_date', label: 'STARTED DATE', labelKey: 'col.started_date' },
        { key: 'end_date', label: 'END DATE', labelKey: 'col.end_date' },
        { key: 'service', label: 'SERVICE', labelKey: 'col.service', optionsFrom: 'service', optionValue: 'service_id', optionLabel: 'service_name' },
        { key: 'status', label: 'STATUS', labelKey: 'col.status', badge: true },
        { key: 'fy', label: 'FISCAL YEAR', labelKey: 'col.fy' },
        { section: 'reports' },
        { key: 'report_status', label: 'REPORT STATUS', labelKey: 'col.report_status', badge: true },
        { key: 'report_content', label: 'REPORT CONTENT', labelKey: 'col.report_content', full: true },
        { section: 'linked requests' },
        { key: 'id__engineer_request', label: 'ENGINEER REQUEST', labelKey: 'col.id__engineer_request', optionsFrom: 'request', optionValue: 'request_id', optionLabel: 'description' },
        { key: 'id__sc_request', label: 'SC REQUEST', labelKey: 'col.id__sc_request', optionsFrom: 'request', optionValue: 'request_id', optionLabel: 'description' },
        { key: 'id__hc_review_request', label: 'HC REVIEW REQUEST', labelKey: 'col.id__hc_review_request', optionsFrom: 'request', optionValue: 'request_id', optionLabel: 'description' }
      ],
      displayName: (r) => r.title ? `${r.id} - ${r.title}` : (r.id || 'Service Task'),
      children: ['comment', 'logs']
    };

    // 3. ENHANCE OPPORTUNITY CHILDREN: Liên thông contract, payment, invoice, service, asset, comment và service_delivery_contract
    if (MODULES.oppotunity) {
      MODULES.oppotunity.children = [
        'contract',
        'payment',
        'invoice',
        'service',
        'asset',
        'service_delivery_contract',
        'comment',
        'logs'
      ];
    }
    if (MODULES.opportunity) {
      MODULES.opportunity.children = MODULES.oppotunity.children;
    }
    if (MODULES.oppo) {
      MODULES.oppo.children = MODULES.oppotunity.children;
    }

  });

  // Global helper for formatting Service Delivery Contract label: ID | Description
  window.formatServiceDeliveryContractLabel = function(r) {
    if (!r) return '';
    const id = r.id || '';
    const desc = r.service_scope || r.note || r.description || '';
    return desc ? `${id} | ${desc}` : String(id);
  };
})();
