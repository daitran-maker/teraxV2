/**
 * service_delivery.config.js - Service Delivery Contract & Service Task Request Module Extension
 * Domain: service_delivery
 */
(function() {
  window.__MODULE_EXTENSIONS__ = window.__MODULE_EXTENSIONS__ || [];
  window.__MODULE_EXTENSIONS__.push(function(MODULES) {

    // Common Option Catalogs for Service Delivery Contract
    const SD_STATUS_OPTIONS = [
      { value: 1, label: 'Not started yet' },
      { value: 2, label: 'On going' },
      { value: 3, label: 'Going to expire' },
      { value: 4, label: 'Completed' },
      { value: 5, label: 'Expired' },
      { value: 6, label: 'No task created' },
      { value: 7, label: 'Canceled' },
      { value: 10, label: 'Draft' },
      { value: 11, label: 'Waiting for approval' },
      { value: 22, label: 'On hold' }
    ];

    const SD_SLA_TIME_OPTIONS = [
      { value: 1, label: '30 days from start date' },
      { value: 2, label: 'Equal to End Date' },
      { value: 3, label: '21 days from start date' },
      { value: 4, label: '14 days from start date' }
    ];
    const SD_SLA_COMPLETED_OPTIONS = SD_SLA_TIME_OPTIONS;

    const SD_SERVICE_OPTIONS = [
      { value: 1, label: 'Oracle premier support for system (PS)', code: 'PS' },
      { value: 2, label: 'Oracle license support and update (LSU)', code: 'LSU' },
      { value: 3, label: 'Managed service (MS)', code: 'MS' },
      { value: 4, label: 'Implementation (IP)', code: 'IP' },
      { value: 5, label: 'Health check (HC)', code: 'HC' },
      { value: 6, label: 'MPS Technical Support (MTS)', code: 'MTS' },
      { value: 7, label: 'Implementation Technical Support (IPTS)', code: 'IPTS' },
      { value: 8, label: 'Leasing (LS)', code: 'LS' },
      { value: 9, label: 'Training (TN)', code: 'TN' },
      { value: 10, label: 'Report | Training | Other (RTO)', code: 'RTO' },
      { value: 11, label: 'Technical Support for Application (TSA)', code: 'TSA' },
      { value: 12, label: 'Implementation - Application and AI (IPA)', code: 'IPA' },
      { value: 13, label: 'Yêu cầu 1: Kiểm tra định kỳ (YC1)', code: 'YC1' },
      { value: 14, label: 'Yêu cầu 2: Cập nhật các bản vá, bản sửa lỗi CSDL (YC2)', code: 'YC2' },
      { value: 15, label: 'Yêu cầu 3: Nâng cấp phiên bản CSDL (YC3)', code: 'YC3' },
      { value: 16, label: 'Yêu cầu 4: Tối ưu CSDL (YC4)', code: 'YC4' },
      { value: 17, label: 'Yêu cầu 5: Phục hồi dữ liệu (YC5)', code: 'YC5' },
      { value: 18, label: 'Yêu cầu 6: Di chuyển CSDL (YC6)', code: 'YC6' },
      { value: 19, label: 'Yêu cầu 7: Rà soát toàn bộ cấu hình bảo mật CSDL (YC7)', code: 'YC7' },
      { value: 20, label: 'Yêu cầu 8: Xây dựng, chuẩn hóa các tài liệu, quy trình (YC8)', code: 'YC8' },
      { value: 21, label: 'Yêu cầu 9: Thực hiện khắc phục các vấn đề nghiêm trọng, phức tạp của CSDL (YC9)', code: 'YC9' },
      { value: 22, label: 'Yêu cầu 10: Tổng hợp báo cáo định kỳ (YC10)', code: 'YC10' }
    ];

    // Common Option Catalogs for Service Task Request
    const STR_STATUS_OPTIONS = [
      { value: 1, label: 'Not started yet' },
      { value: 2, label: 'Processing' },
      { value: 3, label: 'Customer review' },
      { value: 4, label: 'Completed' },
      { value: 5, label: 'Closed' },
      { value: 6, label: 'Pending' },
      { value: 7, label: 'Spare in custom' },
      { value: 8, label: 'Monitoring' },
      { value: 9, label: 'Canceled' }
    ];

    const STR_DELIVERY_ONSITE_OPTIONS = [
      { value: 1, label: 'Onsite' },
      { value: 2, label: 'Remote' }
    ];

    const STR_SERVICE_OPTIONS = [
      { value: 1, label: 'Oracle premier support for system' },
      { value: 2, label: 'Implementation' },
      { value: 3, label: 'Health check' },
      { value: 4, label: 'MPS Technical Support' },
      { value: 5, label: 'Implementation Technical Support' },
      { value: 6, label: 'Technical Support for Application' },
      { value: 7, label: 'Other' }
    ];

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
        { key: 'service', label: 'Service', labelKey: 'col.service', options: SD_SERVICE_OPTIONS },
        { key: 'status', label: 'Status', labelKey: 'col.status', badge: true, options: SD_STATUS_OPTIONS },
        { key: 'fy', label: 'FY', labelKey: 'col.fy', width: '80px' },
        { key: 'start_date', label: 'Start Date', labelKey: 'col.start_date' },
        { key: 'end_date', label: 'End Date', labelKey: 'col.end_date' },
        { key: 'id__sla_response_time', label: 'SLA Response', labelKey: 'col.id__sla_response_time', options: SD_SLA_TIME_OPTIONS },
        { key: 'id__sla_completed_time', label: 'SLA Completed', labelKey: 'col.id__sla_completed_time', options: SD_SLA_TIME_OPTIONS },
        { key: 'id__service_request', label: 'Service Request', labelKey: 'col.id__service_request', optionsFrom: 'request', optionValue: 'request_id', optionLabel: 'description', hidden: true }
      ],
      fields: [
        { section: 'contract information' },
        { key: 'service_scope', label: 'SERVICE SCOPE', labelKey: 'col.service_scope', type: 'textarea', required: true, full: true },
        { key: 'coordinator__employee', label: 'COORDINATOR', labelKey: 'col.coordinator__employee', type: 'select', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name', required: true },
        { key: 'status', label: 'STATUS', labelKey: 'col.status', type: 'select', options: SD_STATUS_OPTIONS, defaultValue: 10, createHidden: true, disabled: true },
        { key: 'service', label: 'SERVICE', labelKey: 'col.service', type: 'select', options: SD_SERVICE_OPTIONS },
        { key: 'sd_old_id', label: 'LEGACY ID', labelKey: 'col.sd_old_id', type: 'text' },
        { key: 'fy', label: 'FISCAL YEAR (FY)', labelKey: 'col.fy', type: 'text', placeholder: 'e.g. FY26' },
        { section: 'period & sla' },
        { key: 'start_date', label: 'START DATE', labelKey: 'col.start_date', type: 'date', required: true },
        { key: 'end_date', label: 'END DATE', labelKey: 'col.end_date', type: 'date', required: true },
        { key: 'id__sla_response_time', label: 'SLA RESPONSE TIME', labelKey: 'col.id__sla_response_time', type: 'select', options: SD_SLA_TIME_OPTIONS },
        { key: 'id__sla_completed_time', label: 'SLA COMPLETED TIME', labelKey: 'col.id__sla_completed_time', type: 'select', options: SD_SLA_TIME_OPTIONS },
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
        { key: 'status', label: 'STATUS', labelKey: 'col.status', badge: true, options: SD_STATUS_OPTIONS },
        { key: 'service', label: 'SERVICE', labelKey: 'col.service', options: SD_SERVICE_OPTIONS },
        { key: 'sd_old_id', label: 'LEGACY ID', labelKey: 'col.sd_old_id' },
        { key: 'fy', label: 'FISCAL YEAR', labelKey: 'col.fy' },
        { section: 'period & sla' },
        { key: 'start_date', label: 'START DATE', labelKey: 'col.start_date' },
        { key: 'end_date', label: 'END DATE', labelKey: 'col.end_date' },
        { key: 'id__sla_response_time', label: 'SLA RESPONSE TIME', labelKey: 'col.id__sla_response_time', options: SD_SLA_TIME_OPTIONS },
        { key: 'id__sla_completed_time', label: 'SLA COMPLETED TIME', labelKey: 'col.id__sla_completed_time', options: SD_SLA_TIME_OPTIONS },
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
        { key: 'severity_level', label: 'Severity', labelKey: 'col.severity_level' },
        { key: 'delivery_onsite', label: 'Delivery Onsite', labelKey: 'col.delivery_onsite', badge: true, options: STR_DELIVERY_ONSITE_OPTIONS },
        { key: 'service', label: 'Service', labelKey: 'col.service', options: STR_SERVICE_OPTIONS },
        { key: 'method', label: 'Method', labelKey: 'col.method', badge: true },
        { key: 'status', label: 'Status', labelKey: 'col.status', badge: true, options: STR_STATUS_OPTIONS },
        { key: 'tier1_engineer__employee', label: 'T1 Engineer', labelKey: 'col.tier1_engineer__employee', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name' },
        { key: 'service_coordinator__employee', label: 'Coordinator', labelKey: 'col.service_coordinator__employee', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name' },
        { key: 'report_status', label: 'Report Status', labelKey: 'col.report_status', badge: true },
        { key: 'fy', label: 'FY', labelKey: 'col.fy', width: '80px' },
        { key: 'started_date', label: 'Started Date', labelKey: 'col.started_date' },
        { key: 'end_date', label: 'End Date', labelKey: 'col.end_date' },
        // Hidden columns according to user requirement
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
        { key: 'severity_level', label: 'SEVERITY LEVEL', labelKey: 'col.severity_level', type: 'number', placeholder: 'Enter numeric severity level' },
        { key: 'delivery_onsite', label: 'ONSITE DELIVERY', labelKey: 'col.delivery_onsite', type: 'select', options: STR_DELIVERY_ONSITE_OPTIONS, defaultValue: 1 },
        { key: 'method', label: 'METHOD', labelKey: 'col.method', type: 'segmented', options: ['Remote', 'Onsite', 'Hybrid'], defaultValue: 'Remote' },
        { key: 'type', label: 'TYPE', labelKey: 'col.task_type', type: 'select', options: ['Incident', 'Maintenance', 'Configuration', 'Consulting'] },
        { section: 'personnel' },
        { key: 'tier1_engineer__employee', label: 'TIER 1 ENGINEER', labelKey: 'col.tier1_engineer__employee', type: 'select', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name' },
        { key: 'service_coordinator__employee', label: 'SERVICE COORDINATOR', labelKey: 'col.service_coordinator__employee', type: 'select', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name' },
        { key: 'id__contact', label: 'CONTACT', labelKey: 'col.id__contact', type: 'select', optionsFrom: 'contact', optionValue: 'contact_id', optionLabel: 'name' },
        { key: 'request_source', label: 'REQUEST SOURCE', labelKey: 'col.request_source', type: 'select', options: ['Portal', 'Email', 'Phone', 'Direct', 'Ticket'] },
        { section: 'schedule & status' },
        { key: 'started_date', label: 'STARTED DATE', labelKey: 'col.started_date', type: 'datetime' },
        { key: 'end_date', label: 'END DATE', labelKey: 'col.end_date', type: 'datetime' },
        { key: 'service', label: 'SERVICE', labelKey: 'col.service', type: 'select', options: STR_SERVICE_OPTIONS },
        { key: 'status', label: 'STATUS', labelKey: 'col.status', type: 'select', options: STR_STATUS_OPTIONS, defaultValue: 1 },
        { key: 'fy', label: 'FISCAL YEAR (FY)', labelKey: 'col.fy', type: 'text', placeholder: 'e.g. FY26' },
        { section: 'reports' },
        { key: 'report_status', label: 'REPORT STATUS', labelKey: 'col.report_status', type: 'segmented', options: ['Not Required', 'Pending', 'Approved', 'Rejected'], defaultValue: 'Not Required' },
        { key: 'report_content', label: 'REPORT CONTENT', labelKey: 'col.report_content', type: 'textarea', full: true },
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
        { key: 'severity_level', label: 'SEVERITY LEVEL', labelKey: 'col.severity_level' },
        { key: 'delivery_onsite', label: 'ONSITE DELIVERY', labelKey: 'col.delivery_onsite', options: STR_DELIVERY_ONSITE_OPTIONS },
        { key: 'service', label: 'SERVICE', labelKey: 'col.service', options: STR_SERVICE_OPTIONS },
        { key: 'method', label: 'METHOD', labelKey: 'col.method', badge: true },
        { key: 'type', label: 'TYPE', labelKey: 'col.task_type' },
        { section: 'personnel' },
        { key: 'tier1_engineer__employee', label: 'TIER 1 ENGINEER', labelKey: 'col.tier1_engineer__employee', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name' },
        { key: 'service_coordinator__employee', label: 'SERVICE COORDINATOR', labelKey: 'col.service_coordinator__employee', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name' },
        { key: 'id__contact', label: 'CONTACT', labelKey: 'col.id__contact', optionsFrom: 'contact', optionValue: 'contact_id', optionLabel: 'name' },
        { key: 'request_source', label: 'REQUEST SOURCE', labelKey: 'col.request_source' },
        { section: 'schedule & status' },
        { key: 'started_date', label: 'STARTED DATE', labelKey: 'col.started_date' },
        { key: 'end_date', label: 'END DATE', labelKey: 'col.end_date' },
        { key: 'status', label: 'STATUS', labelKey: 'col.status', badge: true, options: STR_STATUS_OPTIONS },
        { key: 'fy', label: 'FISCAL YEAR', labelKey: 'col.fy' },
        { section: 'reports' },
        { key: 'report_status', label: 'REPORT STATUS', labelKey: 'col.report_status', badge: true },
        { key: 'report_content', label: 'REPORT CONTENT', labelKey: 'col.report_content', full: true }
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
