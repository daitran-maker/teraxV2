/**
 * service_delivery.config.js - Service Delivery Contract & Service Task Request Module Extension
 * Domain: service_delivery
 */
(function() {
  const oppoNum = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
  const oppoEsc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const oppoFmt = (n) => Math.round(n || 0).toLocaleString('en-US');
  const oppoFmtFull = oppoFmt;

  window.oppoNum = oppoNum;
  window.oppoEsc = oppoEsc;
  window.oppoFmt = oppoFmt;
  window.oppoFmtFull = oppoFmtFull;

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
        { key: 'id', label: 'SD ID', labelKey: 'col.service_delivery_id', hidden: true },
        { key: 'sd_old_id', label: 'Legacy ID', labelKey: 'col.sd_old_id', hidden: true },
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
        { key: 'id__contract', label: 'SERVICE CONTRACT', labelKey: 'nav.service_contract', type: 'select', optionsFrom: 'contract', optionValue: 'contract_id', optionLabel: 'contract_label' },
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
        { key: 'id__contract', label: 'SERVICE CONTRACT', labelKey: 'nav.service_contract', optionsFrom: 'contract', optionValue: 'contract_id', optionLabel: 'contract_label', full: true },
        { key: 'id__service_request', label: 'SERVICE REQUEST', labelKey: 'col.id__service_request', optionsFrom: 'request', optionValue: 'request_id', optionLabel: 'description', hidden: true, full: true },
        { key: 'note', label: 'NOTE', labelKey: 'col.note', full: true }
      ],
      displayName: (r) => {
        if (!r) return 'SD Contract';
        return r.service_scope || r.sd_old_id || r.note || r.description || r.id || 'SD Contract';
      },
      children: ['service_task_request', 'logs']
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
        { key: 'id', label: 'Task ID', labelKey: 'col.service_task_id', hidden: true },
        { key: 'title', label: 'Title', labelKey: 'col.task_title', full: true },
        {
          key: 'service_delivery',
          label: 'SD Contract',
          labelKey: 'col.service_delivery',
          optionsFrom: 'service_delivery_contract',
          optionValue: 'id',
          optionLabel: 'service_delivery_label',
          renderCell: (row) => {
            const desc = row.sd_service_scope || row.service_delivery_label || (typeof resolveLookupValue === 'function' ? resolveLookupValue('service_task_request', 'service_delivery', row.service_delivery) : '');
            return oppoEsc(desc || (row.service_delivery ? String(row.service_delivery) : '—'));
          }
        },
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
        { key: 'fy', label: 'FISCAL YEAR (FY)', labelKey: 'col.fy', type: 'text', placeholder: 'Auto from start date', createReadonly: true, editReadonly: true },
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
      displayName: (r) => r.title || (r.id ? `Task #${r.id}` : 'Service Task'),
      children: ['logs']
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

    // 4. DASHBOARD METRIC COLUMNS (computed server-side by service_delivery.metrics.js, rendered as bars)
    //    Same 3 columns on: Opportunity, Contract, Service Delivery Contract, Service Task Request.
    //    `renderCell` is a generic column hook honoured by tableView / childTableView.
    // Which metric columns each view shows: Opportunity = payment + progress, Contract = payment only.
    const METRIC_COLS_BY_MODULE = {
      oppotunity: ['oppo_payment_ratio', 'oppo_progress'],
      contract: ['oppo_payment_ratio'],
      service_contract: ['oppo_payment_ratio', 'oppo_progress', 'oppo_remaining_time'],
      service_delivery_contract: ['oppo_payment_ratio', 'oppo_progress', 'oppo_remaining_time'],
      service_task_request: ['oppo_payment_ratio', 'oppo_progress', 'oppo_remaining_time']
    };
    // Views of the service-delivery family call the payment column "PAID RATIO".
    const PAID_RATIO_VIEWS = ['service_contract', 'service_delivery_contract'];
    const buildMetricCols = (moduleKey) => ([
      PAID_RATIO_VIEWS.includes(moduleKey)
        ? { key: 'oppo_payment_ratio', label: 'PAID RATIO', labelKey: 'col.oppo_paid_ratio', width: '160px', renderCell: (row) => window.renderOppoMetricCell('payment', row, moduleKey) }
        : { key: 'oppo_payment_ratio', label: 'PAYMENT RATIO', labelKey: 'col.oppo_payment_ratio', width: '160px', renderCell: (row) => window.renderOppoMetricCell('payment', row, moduleKey) },
      { key: 'oppo_progress', label: 'PROGRESS', labelKey: 'col.oppo_progress', width: '150px', renderCell: (row) => window.renderOppoMetricCell('progress', row, moduleKey) },
      { key: 'oppo_remaining_time', label: 'REMAINING TIME', labelKey: 'col.oppo_remaining_time', width: '180px', renderCell: (row) => window.renderOppoMetricCell('remaining', row, moduleKey) }
    ].filter(c => (METRIC_COLS_BY_MODULE[moduleKey] || []).includes(c.key)));
    const injectMetricCols = (mod, moduleKey) => {
      if (!mod || !Array.isArray(mod.columns)) return;
      if (mod.columns.some(c => c.key === 'oppo_payment_ratio')) return;
      const statusIdx = mod.columns.findIndex(c => c.key === 'status');
      const at = statusIdx >= 0 ? statusIdx + 1 : mod.columns.length;
      mod.columns.splice(at, 0, ...buildMetricCols(moduleKey));
    };
    // 5. SERVICE CONTRACT = another view of the `contract` table (extra sc_* columns, see install.js).
    const SC_STATUS_OPTIONS = [
      { value: 10, label: 'Draft' },
      { value: 1, label: 'Not started yet' },
      { value: 2, label: 'On going' },
      { value: 3, label: 'Going to expire' },
      { value: 4, label: 'Completed' },
      { value: 5, label: 'Expired' },
      { value: 7, label: 'Canceled' },
      { value: 22, label: 'On hold' }
    ];
    const CONTRACT_TYPE_OPTIONS = [{ value: 69, label: 'Selling' }, { value: 70, label: 'Buying' }];
    const EMP_OPT = { optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name' };
    const EMP_ACTIVE_OPT = { optionsFrom: 'employee_active', optionValue: 'employee_id', optionLabel: 'full_name' };
    const COMPANY_OPT = { optionsFrom: 'company', optionValue: 'company_id', optionLabel: 'company_fullname' };
    const CONTACT_OPT = { optionsFrom: 'contact', optionValue: 'contact_id', optionLabel: 'name' };

    // Plain renderers (all dynamic text escaped)
    const moneyCell = (k) => (row) => {
      const n = oppoNum(row[k]);
      return `<div style="text-align:right;font-variant-numeric:tabular-nums;${n < 0 ? 'color:#dc2626;' : ''}">${oppoEsc(oppoFmt(n))}</div>`;
    };
    const countCell = (k) => (row) => {
      const n = oppoNum(row[k]);
      return n > 0 ? `<span style="font-weight:600;">${oppoEsc(n)}</span>` : '<span class="oppo-na">—</span>';
    };

    // Service-contract columns: nullable fields added to the contract form so data can be entered.
    const SC_FIELDS = [
      { section: 'service contract' },
      { key: 'sc_status', label: 'SERVICE CONTRACT STATUS', labelKey: 'col.status', type: 'select', options: SC_STATUS_OPTIONS },
      { key: 'sc_start_date', label: 'START DATE', labelKey: 'col.start_date', type: 'date' },
      { key: 'sc_end_date', label: 'END DATE', labelKey: 'col.end_date', type: 'date' },
      Object.assign({ key: 'sc_coordinator__employee', label: 'SERVICE COORDINATOR', labelKey: 'col.sd_service_coordinator', type: 'select' }, EMP_ACTIVE_OPT),
      Object.assign({ key: 'sc_contact', label: 'CONTACT', labelKey: 'col.sd_contact', type: 'select' }, CONTACT_OPT),
      Object.assign({ key: 'sc_partner', label: 'PARTNER', labelKey: 'col.sd_partner', type: 'select' }, COMPANY_OPT),
      { key: 'sc_product', label: 'PRODUCT', labelKey: 'col.sd_product', type: 'text', hidden: true }
    ];
    const SC_DETAIL_FIELDS = SC_FIELDS.map(f => {
      const d = Object.assign({}, f); delete d.type; return d;
    });
    if (MODULES.contract) {
      const addOnce = (arr, items) => { if (Array.isArray(arr) && !arr.some(f => f.key === 'sc_status')) arr.push(...items.map(f => Object.assign({}, f))); };
      addOnce(MODULES.contract.fields, SC_FIELDS);
      addOnce(MODULES.contract.detailFields, SC_DETAIL_FIELDS);
    }

    // Virtual columns (computed by service_delivery.metrics.js)
    const COL_DEFS = {
      oppo_end_user: Object.assign({ key: 'oppo_end_user', label: 'END USER', labelKey: 'col.sd_end_user' }, COMPANY_OPT),
      oppo_country: { key: 'oppo_country', label: 'COUNTRY', labelKey: 'col.sd_country' },
      oppo_task_count: { key: 'oppo_task_count', label: 'TASK REQUEST', labelKey: 'col.sd_task_request_count', renderCell: countCell('oppo_task_count') },
      sc_sd_count: { key: 'sc_sd_count', label: 'SERVICE DELIVERY', labelKey: 'col.sd_service_delivery', renderCell: countCell('sc_sd_count') },
      eff_start_date: { key: 'eff_start_date', label: 'START DATE', labelKey: 'col.start_date' },
      eff_end_date: { key: 'eff_end_date', label: 'END DATE', labelKey: 'col.end_date' },
      eff_coordinator: Object.assign({ key: 'eff_coordinator', label: 'SERVICE COORDINATOR', labelKey: 'col.sd_service_coordinator' }, EMP_OPT),
      oppo_fin_paid_gm: { key: 'oppo_fin_paid_gm', label: 'PAID GM', labelKey: 'col.sd_fin_paid_gm', renderCell: moneyCell('oppo_fin_paid_gm') },
      oppo_fin_sell_wo_vat: { key: 'oppo_fin_sell_wo_vat', label: 'SELLING PRICE WO VAT', labelKey: 'col.sd_fin_sell_wo_vat', renderCell: moneyCell('oppo_fin_sell_wo_vat') },
      oppo_fin_buy_wo_vat: { key: 'oppo_fin_buy_wo_vat', label: 'BUYING PRICE WO VAT', labelKey: 'col.sd_fin_buy_wo_vat', renderCell: moneyCell('oppo_fin_buy_wo_vat') },
      oppo_fin_gm_wo_vat: { key: 'oppo_fin_gm_wo_vat', label: 'GM WO VAT', labelKey: 'col.sd_fin_gm_wo_vat', renderCell: moneyCell('oppo_fin_gm_wo_vat') },
      oppo_fin_sell: { key: 'oppo_fin_sell', label: 'SELLING PRICE', labelKey: 'col.sd_fin_sell', renderCell: moneyCell('oppo_fin_sell') },
      oppo_fin_buy: { key: 'oppo_fin_buy', label: 'BUYING PRICE', labelKey: 'col.sd_fin_buy', renderCell: moneyCell('oppo_fin_buy') },
      oppo_fin_gm: { key: 'oppo_fin_gm', label: 'GM', labelKey: 'col.sd_fin_gm', renderCell: moneyCell('oppo_fin_gm') },
      oppo_fin_paid_sell: { key: 'oppo_fin_paid_sell', label: 'PAID SELLING', labelKey: 'col.sd_fin_paid_sell', renderCell: moneyCell('oppo_fin_paid_sell') },
      oppo_fin_paid_buy: { key: 'oppo_fin_paid_buy', label: 'PAID BUYING', labelKey: 'col.sd_fin_paid_buy', renderCell: moneyCell('oppo_fin_paid_buy') },
      // Placeholders kept hidden until their child tables / data exist (requested by the business)
      sd_activity: { key: 'sd_activity', label: 'ACTIVITY', labelKey: 'col.sd_activity', hidden: true },
      sd_person_in_charge: { key: 'sd_person_in_charge', label: 'PERSON IN CHARGE', labelKey: 'col.sd_person_in_charge', hidden: true },
      sd_sla: { key: 'sd_sla', label: 'SLA', labelKey: 'col.sd_sla', hidden: true },
      sd_product: { key: 'sd_product', label: 'PRODUCT', labelKey: 'col.sd_product', hidden: true }
    };

    MODULES.service_contract = {
      label: 'Service Contracts',
      labelKey: 'nav.service_contract',
      subtitle: 'Service contracts (view of contracts)',
      endpoint: '/table/contract',
      pk: 'contract_id',
      icon: '📄',
      groupBy: ['sc_status', 'type'],
      columns: [
        { key: 'contract_id', label: 'Contract ID', hidden: true },
        Object.assign({ key: 'project', label: 'PROJECT', labelKey: 'col.sd_project' }, { optionsFrom: 'oppotunity', optionValue: 'project_id', optionLabel: 'project_label' }),
        { key: 'sc_status', label: 'STATUS', labelKey: 'col.status', badge: true, options: SC_STATUS_OPTIONS },
        { key: 'sc_start_date', label: 'START DATE', labelKey: 'col.start_date' },
        { key: 'sc_end_date', label: 'END DATE', labelKey: 'col.end_date' },
        COL_DEFS.sc_sd_count,
        { key: 'sc_product', label: 'PRODUCT', labelKey: 'col.sd_product', hidden: true },
        Object.assign({ key: 'sc_coordinator__employee', label: 'SERVICE COORDINATOR', labelKey: 'col.sd_service_coordinator' }, EMP_ACTIVE_OPT),
        { key: 'type', label: 'TYPE', labelKey: 'col.sd_contract_type', badge: true, options: CONTRACT_TYPE_OPTIONS },
        Object.assign({ key: 'sc_contact', label: 'CONTACT', labelKey: 'col.sd_contact' }, CONTACT_OPT),
        COL_DEFS.oppo_country,
        COL_DEFS.oppo_end_user,
        Object.assign({ key: 'sc_partner', label: 'PARTNER', labelKey: 'col.sd_partner' }, COMPANY_OPT)
      ],
      // Same record as the contract; the form / detail reuse the contract definition + service fields.
      fields: (MODULES.contract && MODULES.contract.fields) || SC_FIELDS,
      detailFields: (MODULES.contract && MODULES.contract.detailFields) || SC_DETAIL_FIELDS,
      displayName: (r) => (MODULES.contract && MODULES.contract.displayName) ? MODULES.contract.displayName(r) : (r.contract_id || 'Service Contract'),
      children: []
    };

    // 6. COLUMN ARRANGEMENT per view (unlisted columns stay in the config but hidden).
    const arrangeColumns = (mod, order, defs) => {
      if (!mod || !Array.isArray(mod.columns)) return;
      const existing = new Map(mod.columns.map(c => [c.key, c]));
      const used = new Set();
      const out = [];
      order.forEach(k => {
        const base = existing.get(k) || COL_DEFS[k];
        if (!base) return;
        const col = Object.assign({}, base, (defs && defs[k]) || {});
        if (!(defs && defs[k] && defs[k].hidden)) delete col.hidden;
        if (!(defs && defs[k] && defs[k].hidden) && base.hidden && COL_DEFS[k] && COL_DEFS[k].hidden) col.hidden = true;
        used.add(k); out.push(col);
      });
      mod.columns.forEach(c => { if (!used.has(c.key)) out.push(Object.assign({}, c, { hidden: true })); });
      mod.columns = out;
    };

    // 7. STATUS BADGE CARDS from the view's own status (generic MODULE hook `buildStatusCards`).
    const makeStatusCards = (group, options, colors, statusKey) => (data) => {
      const rows = Array.isArray(data) ? data : [];
      const counts = {};
      rows.forEach(r => { const v = r[statusKey]; if (v != null && v !== '') counts[String(v)] = (counts[String(v)] || 0) + 1; });
      const items = options.filter(o => counts[String(o.value)] > 0).map(o => ({
        label: sdT(`sd.card.${group}.${o.value}`) === `sd.card.${group}.${o.value}` ? o.label : sdT(`sd.card.${group}.${o.value}`),
        count: counts[String(o.value)],
        color: colors[o.value] || '#64748b'
      }));
      items.unshift({ label: sdT('sd.card.total'), count: rows.length, color: '#334155' });
      return `<div class="dv-status-cards" style="display:flex; gap:12px; width:100%; overflow-x:auto; padding-bottom:2px;">${items.map(c => `
      <div class="dv-status-card" style="flex:1; min-width:150px; height:64px; background:#ffffff; border:1px solid #E5E7EB; border-radius:4px; padding:10px 12px; display:flex; align-items:center; gap:12px; box-shadow:0 1px 2px rgba(16,24,40,0.04); border-bottom:3px solid ${oppoEsc(c.color)};">
        <div style="display:flex; flex-direction:column; gap:2px; min-width:0;">
          <div style="font-size:15px; font-weight:700; color:#111827; line-height:1; font-family:Inter,sans-serif;">${oppoEsc(c.count)}</div>
          <div style="font-size:11px; font-weight:500; color:#6B7280; font-family:Inter,sans-serif; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${oppoEsc(c.label)}">${oppoEsc(c.label)}</div>
        </div>
      </div>`).join('')}</div>`;
    };
    const SDC_COLORS = { 1: '#64748b', 2: '#3b82f6', 3: '#f59e0b', 4: '#10b981', 5: '#ef4444', 6: '#94a3b8', 7: '#dc2626', 10: '#64748b', 11: '#8b5cf6', 22: '#f97316' };
    const STR_COLORS = { 1: '#64748b', 2: '#3b82f6', 3: '#f59e0b', 4: '#10b981', 5: '#475569', 6: '#ec4899', 7: '#8b5cf6', 8: '#06b6d4', 9: '#ef4444' };

    const seenMods = new Set();
    ['oppotunity', 'contract', 'service_contract', 'service_delivery_contract', 'service_task_request'].forEach(k => {
      const m = MODULES[k];
      if (m && !seenMods.has(m)) { seenMods.add(m); injectMetricCols(m, k); }
    });

    // --- Opportunity ---
    const oppoMods = new Set(['oppotunity', 'opportunity', 'oppo'].map(k => MODULES[k]).filter(Boolean));
    oppoMods.forEach(m => {
      arrangeColumns(m, [
        'project_label', 'id__company', 'status', 'oppo_payment_ratio', 'oppo_progress', 'type',
        'oppo_fin_paid_gm', 'oppo_fin_sell_wo_vat', 'oppo_fin_buy_wo_vat', 'oppo_fin_gm_wo_vat',
        'oppo_fin_sell', 'oppo_fin_buy', 'oppo_fin_gm', 'oppo_fin_paid_sell', 'oppo_fin_paid_buy',
        'sale_lead', 'id__my_company', 'fy_recognized', 'fy_target_closed_date'
      ], {
        id__company: { label: 'END USER' },
        type: { label: 'TYPE', labelKey: 'col.sd_oppo_type' },
        sale_lead: { label: 'SALE PERSON', labelKey: 'col.sd_sale_person' },
        id__my_company: { label: 'MY COMPANY' },
        fy_recognized: { label: 'FY RECOGNIZED', labelKey: 'col.sd_fy_recognized' },
        fy_target_closed_date: { label: 'FY TARGET CLOSED DATE', labelKey: 'col.sd_fy_target_closed' }
      });
      m.statusCards = false; // no badge cards on Opportunity
    });

    // --- Service contract (view of contract) ---
    arrangeColumns(MODULES.service_contract, [
      'project', 'sc_status', 'oppo_remaining_time', 'oppo_progress', 'oppo_payment_ratio', 'sc_start_date', 'sc_end_date',
      'sc_sd_count', 'sc_product', 'sc_coordinator__employee', 'type', 'sc_contact', 'oppo_country', 'oppo_end_user', 'sc_partner'
    ], { sc_product: { hidden: true } });
    MODULES.service_contract.buildStatusCards = makeStatusCards('sc', SC_STATUS_OPTIONS, SDC_COLORS, 'sc_status');

    // --- Service delivery contract ---
    arrangeColumns(MODULES.service_delivery_contract, [
      'service_scope', 'status', 'oppo_remaining_time', 'oppo_progress', 'oppo_payment_ratio',
      'start_date', 'end_date', 'oppo_task_count', 'oppo_end_user', 'coordinator__employee'
    ], {
      id: { hidden: true },
      sd_old_id: { hidden: true },
      service_scope: { label: 'DESCRIPTION', labelKey: 'col.sd_description' },
      coordinator__employee: { label: 'SERVICE COORDINATOR', labelKey: 'col.sd_service_coordinator' }
    });
    MODULES.service_delivery_contract.buildStatusCards = makeStatusCards('sdc', SD_STATUS_OPTIONS, SDC_COLORS, 'status');

    // --- Service task request (info inherited from its Service Delivery Contract when available) ---
    arrangeColumns(MODULES.service_task_request, [
      'title', 'service_delivery', 'status', 'eff_start_date', 'eff_end_date', 'service', 'severity_level', 'eff_coordinator',
      'tier1_engineer__employee', 'oppo_end_user', 'report_status'
    ], {
      id: { hidden: true },
      title: { label: 'TASK REQUEST', labelKey: 'col.sd_task_request' },
      service_delivery: {
        label: 'SERVICE DELIVERY',
        labelKey: 'col.sd_service_delivery',
        renderCell: (row) => {
          const desc = row.sd_service_scope || row.service_delivery_label || (typeof resolveLookupValue === 'function' ? resolveLookupValue('service_task_request', 'service_delivery', row.service_delivery) : '');
          return oppoEsc(desc || (row.service_delivery ? String(row.service_delivery) : '—'));
        }
      },
      severity_level: { label: 'SEVERITY LEVEL', labelKey: 'col.sd_severity' },
      tier1_engineer__employee: { label: 'TIER 1 ENGINEER', labelKey: 'col.sd_tier1' },
      report_status: { label: 'REPORT STATUS', labelKey: 'col.sd_report_status' }
    });
    MODULES.service_task_request.buildStatusCards = makeStatusCards('str', STR_STATUS_OPTIONS, STR_COLORS, 'status');

  });

  // Global helper for formatting Service Delivery Contract label: show description / scope instead of raw ID
  window.formatServiceDeliveryContractLabel = function(r) {
    if (!r) return '';
    return r.service_scope || r.sd_old_id || r.note || r.description || String(r.id || '');
  };

  // Self-contained hook for column pinning: ensures portability across apps without modifying core uiHelpers.js
  if (typeof window !== 'undefined') {
    const origPinned = window.isColumnPinned;
    window.isColumnPinned = function(moduleKey, columnKey) {
      if (moduleKey === 'service_delivery_contract' && (columnKey === 'service_scope' || columnKey === 'description')) return true;
      if (moduleKey === 'service_task_request' && columnKey === 'title') return true;
      return typeof origPinned === 'function' ? origPinned(moduleKey, columnKey) : false;
    };
  }

  // ---------------------------------------------------------------------------
  // Dashboard metric bars (Payment ratio / Progress / Remaining time)
  // Data = computed columns oppo_* from modules/service_delivery/server/service_delivery.metrics.js
  // ---------------------------------------------------------------------------

  // --- i18n: module-owned dictionaries merged into the app translations (no core locale edits) ---
  const SD_METRIC_I18N = {
    en: {
      'col.oppo_payment_ratio': 'Payment Ratio', 'col.oppo_progress': 'Progress', 'col.oppo_remaining_time': 'Remaining Time',
      'oppo.pay.selling': 'Selling', 'oppo.pay.buying': 'Buying', 'oppo.pay.no_payment': 'No payment',
      'oppo.pay.paid_of': '{name}: paid {paid} / {total} ({pct}%)', 'oppo.pay.none': 'No {name} payment',
      'oppo.prog.completed': 'Completed', 'oppo.prog.processing': 'Processing', 'oppo.prog.not_started': 'Not started yet',
      'oppo.prog.no_task': 'No task', 'oppo.prog.detail': '{name}: {pct}% · {tasks} task(s) in {sdc} contract(s)',
      'oppo.rem.days_left': '{n}d left', 'oppo.rem.starts_in': 'Starts in {n}d', 'oppo.rem.expired': 'Expired {n}d ago',
      'oppo.rem.range': '{from} → {to} ({days} days)'
    },
    vi: {
      'col.oppo_payment_ratio': 'Tỉ lệ thanh toán', 'col.oppo_progress': 'Tiến độ', 'col.oppo_remaining_time': 'Thời gian còn lại',
      'oppo.pay.selling': 'Bán', 'oppo.pay.buying': 'Mua', 'oppo.pay.no_payment': 'Chưa có thanh toán',
      'oppo.pay.paid_of': '{name}: đã thanh toán {paid} / {total} ({pct}%)', 'oppo.pay.none': 'Chưa có thanh toán {name}',
      'oppo.prog.completed': 'Hoàn thành', 'oppo.prog.processing': 'Đang xử lý', 'oppo.prog.not_started': 'Chưa bắt đầu',
      'oppo.prog.no_task': 'Chưa có task', 'oppo.prog.detail': '{name}: {pct}% · {tasks} task trong {sdc} hợp đồng',
      'oppo.rem.days_left': 'Còn {n} ngày', 'oppo.rem.starts_in': 'Bắt đầu sau {n} ngày', 'oppo.rem.expired': 'Hết hạn {n} ngày',
      'oppo.rem.range': '{from} → {to} ({days} ngày)'
    },
    zh: {
      'col.oppo_payment_ratio': '付款比例', 'col.oppo_progress': '进度', 'col.oppo_remaining_time': '剩余时间',
      'oppo.pay.selling': '销售', 'oppo.pay.buying': '采购', 'oppo.pay.no_payment': '暂无付款',
      'oppo.pay.paid_of': '{name}：已付 {paid} / {total} ({pct}%)', 'oppo.pay.none': '无{name}付款',
      'oppo.prog.completed': '已完成', 'oppo.prog.processing': '处理中', 'oppo.prog.not_started': '未开始',
      'oppo.prog.no_task': '无任务', 'oppo.prog.detail': '{name}：{pct}% · {sdc} 份合同共 {tasks} 个任务',
      'oppo.rem.days_left': '剩余 {n} 天', 'oppo.rem.starts_in': '{n} 天后开始', 'oppo.rem.expired': '已过期 {n} 天',
      'oppo.rem.range': '{from} → {to}（{days} 天）'
    }
    // km / my: fall back to English through t(key, fallback), like the other locales of this app
  };

  // Labels of the re-arranged views (Opportunity / Service contract / SD contract / Task) + status cards.
  // zh / km / my fall back to English through t(key, fallback).
  const SD_VIEW_I18N = { en: {
    'nav.service_contract': 'Service Contracts', 'sd.card.total': 'Total', 'col.oppo_paid_ratio': 'Paid Ratio',
    'col.sd_oppo_type': 'Type', 'col.sd_sale_person': 'Sale Person', 'col.sd_fy_recognized': 'FY Recognized', 'col.sd_fy_target_closed': 'FY Target Closed Date',
    'col.sd_end_user': 'End User', 'col.sd_country': 'Country', 'col.sd_project': 'Project',
    'col.sd_fin_paid_gm': 'Paid GM', 'col.sd_fin_sell_wo_vat': 'Selling Price WO VAT', 'col.sd_fin_buy_wo_vat': 'Buying Price WO VAT',
    'col.sd_fin_gm_wo_vat': 'GM WO VAT', 'col.sd_fin_sell': 'Selling Price', 'col.sd_fin_buy': 'Buying Price', 'col.sd_fin_gm': 'GM',
    'col.sd_fin_paid_sell': 'Paid Selling', 'col.sd_fin_paid_buy': 'Paid Buying',
    'col.sd_service_delivery': 'Service Delivery', 'col.sd_description': 'Description', 'col.sd_task_request_count': 'Task Request',
    'col.sd_service_coordinator': 'Service Coordinator', 'col.sd_product': 'Product', 'col.sd_contract_type': 'Type',
    'col.sd_contact': 'Contact', 'col.sd_partner': 'Partner', 'col.sd_task_request': 'Task Request', 'col.sd_severity': 'Severity Level',
    'col.sd_tier1': 'Tier 1 Engineer', 'col.sd_activity': 'Activity', 'col.sd_person_in_charge': 'Person In Charge',
    'col.sd_report_status': 'Report Status', 'col.sd_sla': 'SLA'
  }, vi: {
    'nav.service_contract': 'Hợp đồng dịch vụ', 'sd.card.total': 'Tổng', 'col.oppo_paid_ratio': 'Tỉ lệ đã thanh toán',
    'col.sd_oppo_type': 'Loại', 'col.sd_sale_person': 'Người bán hàng', 'col.sd_fy_recognized': 'FY ghi nhận', 'col.sd_fy_target_closed': 'FY dự kiến chốt',
    'col.sd_end_user': 'Khách hàng cuối', 'col.sd_country': 'Quốc gia', 'col.sd_project': 'Dự án',
    'col.sd_fin_paid_gm': 'GM đã thu', 'col.sd_fin_sell_wo_vat': 'Giá bán chưa VAT', 'col.sd_fin_buy_wo_vat': 'Giá mua chưa VAT',
    'col.sd_fin_gm_wo_vat': 'GM chưa VAT', 'col.sd_fin_sell': 'Giá bán', 'col.sd_fin_buy': 'Giá mua', 'col.sd_fin_gm': 'GM',
    'col.sd_fin_paid_sell': 'Đã thu', 'col.sd_fin_paid_buy': 'Đã chi',
    'col.sd_service_delivery': 'Service Delivery', 'col.sd_description': 'Mô tả', 'col.sd_task_request_count': 'Task request',
    'col.sd_service_coordinator': 'Điều phối dịch vụ', 'col.sd_product': 'Sản phẩm', 'col.sd_contract_type': 'Loại',
    'col.sd_contact': 'Liên hệ', 'col.sd_partner': 'Đối tác', 'col.sd_task_request': 'Task request', 'col.sd_severity': 'Mức độ nghiêm trọng',
    'col.sd_tier1': 'Kỹ sư Tier 1', 'col.sd_activity': 'Hoạt động', 'col.sd_person_in_charge': 'Người phụ trách',
    'col.sd_report_status': 'Trạng thái báo cáo', 'col.sd_sla': 'SLA'
  } };
  // Status-card labels (vi): group -> status value -> label
  const SD_CARD_VI = {
    sc: { 10: 'Nháp', 1: 'Chưa bắt đầu', 2: 'Đang thực hiện', 3: 'Sắp hết hạn', 4: 'Hoàn thành', 5: 'Hết hạn', 7: 'Đã hủy', 22: 'Tạm dừng' },
    sdc: { 1: 'Chưa bắt đầu', 2: 'Đang thực hiện', 3: 'Sắp hết hạn', 4: 'Hoàn thành', 5: 'Hết hạn', 6: 'Chưa có task', 7: 'Đã hủy', 10: 'Nháp', 11: 'Chờ duyệt', 22: 'Tạm dừng' },
    str: { 1: 'Chưa bắt đầu', 2: 'Đang xử lý', 3: 'Khách hàng đánh giá', 4: 'Hoàn thành', 5: 'Đã đóng', 6: 'Chờ xử lý', 7: 'Spare in custom', 8: 'Đang theo dõi', 9: 'Đã hủy' }
  };
  Object.keys(SD_CARD_VI).forEach(g => Object.keys(SD_CARD_VI[g]).forEach(v => { SD_VIEW_I18N.vi[`sd.card.${g}.${v}`] = SD_CARD_VI[g][v]; }));

  function mergeSdMetricI18n() {
    try {
      const lang = (typeof currentLang !== 'undefined' && currentLang) ? currentLang : 'en';
      const dict = Object.assign({}, SD_METRIC_I18N.en, SD_VIEW_I18N.en, SD_METRIC_I18N[lang] || {}, SD_VIEW_I18N[lang] || {});
      if (typeof _translations === 'object' && _translations) {
        Object.keys(dict).forEach(k => { if (!(k in _translations)) _translations[k] = dict[k]; });
      }
    } catch (e) { /* i18n engine not ready yet: t() fallbacks keep English text */ }
  }
  function hookSdMetricI18n() {
    mergeSdMetricI18n();
    if (typeof window.loadLocale === 'function' && !window.loadLocale.__sdMetrics) {
      const orig = window.loadLocale;
      const wrapped = async function (...args) { const r = await orig.apply(this, args); mergeSdMetricI18n(); return r; };
      wrapped.__sdMetrics = true;
      window.loadLocale = wrapped;
    }
  }
  hookSdMetricI18n();
  window.addEventListener('load', hookSdMetricI18n);

  /** Translate with {param} substitution; English default when the key is missing. */
  const sdT = (key, params) => {
    const fallback = SD_METRIC_I18N.en[key] || SD_VIEW_I18N.en[key] || key;
    let s = (typeof t === 'function') ? t(key, fallback) : fallback;
    if (params) Object.keys(params).forEach(p => { s = String(s).split('{' + p + '}').join(params[p]); });
    return s;
  };
  const sdDateLocale = () => ({ vi: 'vi-VN', zh: 'zh-CN', km: 'km-KH', my: 'my-MM', en: 'en-GB' }[(typeof currentLang !== 'undefined' && currentLang) || 'en'] || 'en-GB');

  (function injectOppoMetricStyles() {
    if (document.getElementById('oppo-metric-styles')) return;
    const st = document.createElement('style');
    st.id = 'oppo-metric-styles';
    st.textContent = `
      .oppo-m { min-width: 140px; display: flex; flex-direction: column; gap: 4px; justify-content: center; font-family: inherit; }
      
      .oppo-bar { position: relative; height: 18px; border-radius: 4px; overflow: hidden; background: #E2E8F0; width: 100%; box-shadow: inset 0 1px 2px rgba(0,0,0,0.06); cursor: default; }
      .oppo-bar:hover { filter: brightness(1.05); }

      .oppo-track { display: flex; height: 100%; width: 100%; border-radius: 4px; overflow: hidden; }
      .oppo-fill { height: 100%; transition: width 0.3s ease; }
      .oppo-seg { height: 100%; transition: width 0.3s ease; }

      .oppo-lbl {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
        font-size: 11px;
        font-weight: 600;
        white-space: nowrap;
        letter-spacing: 0.2px;
        color: #FFFFFF;
        text-shadow: 0 1px 2px rgba(15,23,42,0.7);
        z-index: 2;
      }
      .oppo-lbl.dark {
        color: #1E293B;
        text-shadow: 0 0 2px rgba(255,255,255,0.8);
      }

      .oppo-pay-row { display: flex; align-items: center; gap: 6px; width: 100%; }
      .oppo-pay-tag { font-size: 9px; font-weight: 700; width: 14px; height: 14px; line-height: 14px; text-align: center; border-radius: 3px; flex-shrink: 0; }
      .oppo-pay-tag.sell { background: #ECFDF5; color: #047857; border: 1px solid #A7F3D0; }
      .oppo-pay-tag.buy { background: #EFF6FF; color: #1D4ED8; border: 1px solid #BFDBFE; }
      .oppo-pay-row .oppo-bar { flex: 1; }

      .oppo-na { color: #94A3B8; font-size: 11.5px; font-weight: 500; font-style: italic; }
    `;
    document.head.appendChild(st);
  })();


  window.oppoSegHover = function(el, lbl, isDark) {
    var b = el && el.closest ? el.closest('.oppo-bar') : null;
    if (!b) return;
    var l = b.querySelector('.oppo-lbl');
    if (!l) return;
    if (lbl) {
      l.textContent = lbl;
      if (isDark) l.classList.add('dark'); else l.classList.remove('dark');
    } else {
      l.textContent = b.dataset.dom || '';
      if (b.dataset.dark === 'true') l.classList.add('dark'); else l.classList.remove('dark');
    }
  };

  /** One payment bar. kind: 'sell' | 'buy' */
  function oppoPayBar(kind, total, paid) {
    const isSell = kind === 'sell';
    const tag = isSell ? 'S' : 'B';
    const tagClass = isSell ? 'sell' : 'buy';
    const name = sdT(isSell ? 'oppo.pay.selling' : 'oppo.pay.buying');
    if (total <= 0) {
      return `
        <div class="oppo-pay-row" title="${oppoEsc(sdT('oppo.pay.none', { name: name.toLowerCase() }))}">
          <span class="oppo-pay-tag ${tagClass}">${tag}</span>
          <div class="oppo-bar">
            <span class="oppo-lbl dark">—</span>
          </div>
        </div>
      `;
    }
    const pct = Math.max(0, Math.min(100, (paid / total) * 100));
    const color = isSell ? '#10B981' : '#3B82F6';
    const title = sdT('oppo.pay.paid_of', { name, paid: oppoFmtFull(paid), total: oppoFmtFull(total), pct: pct.toFixed(0) });
    return `
      <div class="oppo-pay-row" title="${oppoEsc(title)}">
        <span class="oppo-pay-tag ${tagClass}">${tag}</span>
        <div class="oppo-bar">
          <div class="oppo-track">
            <div class="oppo-fill" style="width:${pct}%;background:${color};"></div>
          </div>
          <span class="oppo-lbl${pct < 40 ? ' dark' : ''}">${pct.toFixed(0)}%</span>
        </div>
      </div>
    `;
  }

  function oppoPaymentCell(row, moduleKey) {
    const sellT = oppoNum(row.oppo_pay_sell_total), sellP = oppoNum(row.oppo_pay_sell_paid);
    const buyT = oppoNum(row.oppo_pay_buy_total), buyP = oppoNum(row.oppo_pay_buy_paid);
    if (sellT <= 0 && buyT <= 0) return `<div class="oppo-m"><span class="oppo-na">—</span></div>`;
    if (moduleKey === 'contract' || moduleKey === 'service_contract') {
      const isBuy = Number(row.type) === 70 || String(row.type_key || '').toLowerCase() === 'buying' || (sellT <= 0 && buyT > 0);
      return `<div class="oppo-m">${isBuy ? oppoPayBar('buy', buyT, buyP) : oppoPayBar('sell', sellT, sellP)}</div>`;
    }
    return `<div class="oppo-m">${oppoPayBar('sell', sellT, sellP)}${oppoPayBar('buy', buyT, buyP)}</div>`;
  }

  function oppoProgressCell(row) {
    const comp = oppoNum(row.oppo_prog_completed);
    const proc = oppoNum(row.oppo_prog_processing);
    const nots = oppoNum(row.oppo_prog_not_started);
    const sum = comp + proc + nots;
    if (sum <= 0) {
      return `
        <div class="oppo-m">
          <div class="oppo-bar" title="${oppoEsc(sdT('oppo.prog.no_task'))}">
            <span class="oppo-lbl dark">${oppoEsc(sdT('oppo.prog.no_task'))}</span>
          </div>
        </div>
      `;
    }

    const tasks = oppoNum(row.oppo_prog_task_count);
    const sdc = oppoNum(row.oppo_prog_sdc_count);

    const segsAll = [
      { key: 'completed', name: sdT('oppo.prog.completed'), pct: comp, color: '#10B981', isDark: false },
      { key: 'processing', name: sdT('oppo.prog.processing'), pct: proc, color: '#F59E0B', isDark: false },
      { key: 'not_started', name: sdT('oppo.prog.not_started'), pct: nots, color: '#CBD5E1', isDark: true }
    ];

    const segs = segsAll.filter(s => s.pct > 0);
    const maxPct = Math.max(...segs.map(s => s.pct));
    const domSeg = segs.find(s => s.pct === maxPct) || segs[0];

    const domShown = ((domSeg.pct / sum) * 100).toFixed(0);
    const domLabel = `${domSeg.name} ${domShown}%`;
    const domDark = domSeg.isDark || domSeg.pct < 40;

    const trackHtml = segs.map(s => {
      const w = ((s.pct / sum) * 100).toFixed(1);
      const shown = ((s.pct / sum) * 100).toFixed(0);
      const label = `${s.name} ${shown}%`;
      const detail = sdT('oppo.prog.detail', { name: s.name, pct: shown, tasks, sdc });
      const isDark = s.isDark || s.pct < 40;
      return `<div class="oppo-seg" style="width:${w}%;background:${s.color};cursor:pointer;" title="${oppoEsc(detail)}" onmouseenter="window.oppoSegHover(this,'${oppoEsc(label)}',${isDark})" onmouseleave="window.oppoSegHover(this)"></div>`;
    }).join('');

    return `
      <div class="oppo-m">
        <div class="oppo-bar oppo-prog" data-dom="${oppoEsc(domLabel)}" data-dark="${domDark}">
          <div class="oppo-track">${trackHtml}</div>
          <span class="oppo-lbl${domDark ? ' dark' : ''}">${oppoEsc(domLabel)}</span>
        </div>
      </div>
    `;
  }

  function oppoRemainingCell(row) {
    const parse = (v) => {
      if (!v) return null;
      const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
      return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
    };
    const start = parse(row.oppo_start_date);
    const end = parse(row.oppo_end_date);
    if (!start || !end) {
      return '<div class="oppo-m"><div class="oppo-bar"><span class="oppo-lbl dark">—</span></div></div>';
    }

    const DAY = 86400000;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const endIncl = new Date(end.getTime() + DAY);
    const totalDays = Math.max(1, Math.round((endIncl - start) / DAY));
    const loc = sdDateLocale();
    const range = sdT('oppo.rem.range', { from: start.toLocaleDateString(loc), to: end.toLocaleDateString(loc), days: totalDays });

    let pct = 0;
    let color = '#10B981';
    let fullTitle = '';

    if (today < start) {
      const startsIn = Math.max(1, Math.round((start - today) / DAY));
      pct = 100;
      color = '#94A3B8';
      fullTitle = `${range} · ${sdT('oppo.rem.starts_in', { n: startsIn })}`;
    } else if (today >= endIncl) {
      const expiredDays = Math.max(1, Math.round((today - end) / DAY));
      pct = 0;
      color = '#EF4444';
      fullTitle = `${range} · ${sdT('oppo.rem.expired', { n: expiredDays })}`;
    } else {
      const leftDays = Math.max(0, Math.round((endIncl - today) / DAY));
      pct = Math.max(0, Math.min(100, Math.round((leftDays / totalDays) * 100)));
      color = leftDays <= 30 ? '#F59E0B' : '#10B981';
      fullTitle = `${range} · ${sdT('oppo.rem.days_left', { n: leftDays })}`;
    }

    return `
      <div class="oppo-m">
        <div class="oppo-bar" title="${oppoEsc(fullTitle)}">
          <div class="oppo-track">
            <div class="oppo-fill" style="width:${pct}%;background:${color};"></div>
          </div>
          <span class="oppo-lbl${pct < 40 ? ' dark' : ''}">${pct}%</span>
        </div>
      </div>
    `;
  }

  /**
   * Inner HTML of a metric cell.
   * @param {'payment'|'progress'|'remaining'} metric
   * @param {object} row
   * @param {string} [moduleKey]
   */
  window.renderOppoMetricCell = function(metric, row, moduleKey) {
    row = row || {};
    if (metric === 'payment') return oppoPaymentCell(row, moduleKey);
    if (metric === 'progress') return oppoProgressCell(row);
    if (metric === 'remaining') return oppoRemainingCell(row);
    return '';
  };
})();
