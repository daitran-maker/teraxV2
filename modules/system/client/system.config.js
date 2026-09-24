/**
 * system.config.js - Modular Config for CRC / TeraX v2
 * Domain: system
 */
(function() {
  window.__MODULE_CONFIGS__ = window.__MODULE_CONFIGS__ || {};
  Object.assign(window.__MODULE_CONFIGS__, {
  policy: {
    label: 'Process',
    subtitle: 'Manage company policies and programs',
    endpoint: '/policies',
    writeTable: 'policy_and_program',
    pk: 'policy_id',
    icon: '📑',
    columns: [
      { key: 'policy_name', label: 'Process Name' },
      { key: 'policy_type', label: 'Process Type' },
      { key: 'description', label: 'Description' },
      { key: 'sla', label: 'SLA (Days)', labelKey: 'col.sla' },
      { key: 'request_count', label: 'NO OF REQUEST', type: 'child_count', display: 'number' },
      { key: 'policy_lead', label: 'Policy Lead', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name' },
      { key: 'sr_owner', label: 'SR Owner', type: 'multiselect', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name' },
      { key: 'tier1_approval', label: 'Tier 1', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name' },
      { key: 'tier2_approval', label: 'Tier 2', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name' },
      { key: 'tier3_approval', label: 'Tier 3', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name' },
      { key: 'approval_level', label: 'Approval Level' },
      { key: 'company_id', label: 'My company shortname', optionsFrom: 'my_company', optionValue: 'my_company_id', optionLabel: 'company_shortname', hidden: true },
      { key: 'department_id', label: 'Department', optionsFrom: 'department', optionValue: 'department_id', optionLabel: 'department_label' },
      { key: 'procedure_link', label: 'Procedure Link' },
      { key: 'procedure_file', label: 'Procedure File' },
      { key: 'elements', label: 'Elements', labelKey: 'col.elements' }
    ],
    fields: [
      { key: 'policy_name', label: 'Process Name', type: 'text', required: true },
      { key: 'policy_type', label: 'Process Type', type: 'select', optionsFrom: 'department', optionValue: 'type', optionLabel: 'type', required: true },
      { key: 'sla', label: 'SLA (DAYS)', labelKey: 'col.sla', type: 'number', step: '0.01', min: '0', placeholder: '0.00' },
      { key: 'approval_level', label: 'Approval Level', type: 'select', options: ['Tier 0', 'Tier 1', 'Tier 2', 'Tier 3'], defaultValue: 'Tier 3' },
      { key: 'tier1_approval', label: 'Tier 1 Approval', type: 'select', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name', staticOptions: [{ value: 'Direct Manager', label: '👥 Direct Manager' }], required: true },
      { key: 'tier2_approval', label: 'Tier 2 Approval', type: 'select', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name' },
      { key: 'tier3_approval', label: 'Tier 3 Approval', type: 'select', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name' },
      { key: 'sr_owner', label: 'SR Owner', type: 'multiselect', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name', required: true },
      { key: 'policy_lead', label: 'Policy Lead', type: 'select', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name', required: true },
      { key: 'company_id', label: 'Restrict to My company shortname', type: 'select', optionsFrom: 'my_company', optionValue: 'my_company_id', optionLabel: 'company_shortname', required: true, hidden: true },
      { key: 'department_id', label: 'Restrict to Department', type: 'select', optionsFrom: 'department', optionValue: 'department_id', optionLabel: 'department_label', required: true },
      { key: 'procedure_link', label: 'Procedure Link', type: 'text', full: true },
      { key: 'procedure_file', label: 'Procedure File', type: 'file', full: true },
      { key: 'elements', label: 'Elements', labelKey: 'col.elements', type: 'multiselect', options: ['CONTRACT', 'PAYMENT', 'SERVICE', 'ASSET', 'INVOICE', 'TARGET TABLE', 'ASSIGN_TASK', 'OPPORTUNITY', 'EXPENSE', 'FINANCE'], full: true, required: true },
      { key: 'description', label: 'Description', type: 'textarea', full: true, required: true },

      // Hidden logic fields
      { key: 'tier1_name', label: 'T1 Name', hidden: true },
      { key: 'tier2_name', label: 'T2 Name', hidden: true },
      { key: 'tier3_name', label: 'T3 Name', hidden: true },
      { key: 't1_name', label: 'T1 Name', hidden: true },
      { key: 't2_name', label: 'T2 Name', hidden: true },
      { key: 't3_name', label: 'T3 Name', hidden: true },
      { key: 'sr_owner_name', label: 'Owner Name', hidden: true },
      { key: 'owner_name', label: 'Owner Name', hidden: true },
    ],
    detailFields: [
      { section: 'process information' },
      { key: 'policy_name', label: 'PROCESS NAME' },
      { key: 'policy_type', label: 'PROCESS TYPE' },
      { key: 'company_id', label: 'MY COMPANY', optionsFrom: 'my_company', optionValue: 'my_company_id', optionLabel: 'company_shortname', full: true },
      { key: 'department_id', label: 'DEPARTMENT', optionsFrom: 'department', optionValue: 'department_id', optionLabel: 'department_label', full: true },
      { key: 'description', label: 'DESCRIPTION', full: true },

      { section: 'ownership & approval' },
      { key: 'approval_level', label: 'APPROVAL LEVEL', full: true },
      { key: 'tier1_approval', label: 'TIER 1 APPROVAL', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name' },
      { key: 'tier2_approval', label: 'TIER 2 APPROVAL', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name' },
      { key: 'tier3_approval', label: 'TIER 3 APPROVAL', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name' },
      { key: 'policy_lead', label: 'POLICY LEAD', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name' },
      { key: 'sr_owner', label: 'SR OWNER', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name' },
      { key: 'sla', label: 'SLA (DAYS)', labelKey: 'col.sla' },

      { section: 'process documentation' },
      { key: 'procedure_link', label: 'PROCEDURE LINK', full: true },
      { key: 'procedure_file', label: 'PROCEDURE FILE', full: true },

      { section: 'process elements' },
      { key: 'elements', label: 'ELEMENTS', labelKey: 'col.elements' }
    ],
    displayName: (r) => {
      const id = r.policy_id || '';
      let name = r.policy_name || '';
      if (name.toUpperCase().startsWith('OPPORTUNITY')) {
        name = 'Opportunity';
      }
      return [id, name].filter(Boolean).join(' | ');
    },
    groupBy: ['company_id', 'department_id', 'policy_type'],
    children: ['request']
  },

  opportunity_list: {
    label: 'Opportunities',
    subtitle: 'List of all opportunities',
    endpoint: '/policies',
    pk: 'policy_id',
    icon: '🎯',
    columns: [
      { key: 'policy_name', label: 'Opportunity Name' },
      { key: 'description', label: 'Description' },
      { key: 'policy_lead', label: 'Policy Lead', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name' },
      { key: 'sr_owner', label: 'SR Owner', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name' },
      { key: 'tier1_approval', label: 'Tier 1', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name' },
      { key: 'tier2_approval', label: 'Tier 2', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name' },
      { key: 'tier3_approval', label: 'Tier 3', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name' },
      { key: 'policy_type', label: 'Type' }
    ],
    fields: [],
    displayName: (r) => r.policy_name || r.policy_id,
    children: ['request']
  },

  operation_program: {
    label: 'Accounting Rules',
    subtitle: 'Manage accounting rules (payment names)',
    endpoint: '/table/operation_program',
    pk: 'oper_id',
    icon: 'event',
    columns: [
      { key: 'oper_id', label: 'ID', hidden: true },
      { key: 'payment_code', label: 'Payment Code' },
      { key: 'payment_name', label: 'Payment Name' },
      { key: 'payment_type', label: 'Payment Type' },
      { key: 'finance_mappings', label: 'Finance Mappings' },
      { key: 'company_id', label: 'Company', optionsFrom: 'my_company', optionValue: 'my_company_id', optionLabel: 'company_shortname' },
      { key: 'department_id', label: 'Department', optionsFrom: 'department', optionValue: 'department_id', optionLabel: 'department_label' },
      { key: 'description', label: 'Description' }
    ],
    fields: [
      { key: 'payment_code', label: 'Payment Code', type: 'text' },
      { key: 'payment_name', label: 'Payment Name', type: 'text', required: true },
      { key: 'payment_type', label: 'Payment Type', type: 'multiselect', options: ['Contract - Selling', 'Contract - Buying', 'Invoice', 'Payment'], required: true },
      { key: 'company_id', label: 'Company', type: 'select', optionsFrom: 'my_company', optionValue: 'my_company_id', optionLabel: 'company_shortname', required: true },
      { key: 'department_id', label: 'Department', type: 'select', optionsFrom: 'department', optionValue: 'department_id', optionLabel: 'department_label' },
      { key: 'description', label: 'Description', type: 'textarea', full: true },
      { key: 'finance_mappings', label: 'Finance Mappings', type: 'finance_mappings', full: true }
    ],
    displayName: (r) => {
      const code = r.payment_code || '';
      const name = r.payment_name || '';
      let deptName = '';
      if (r.department_id) {
        deptName = r.department_id;
        if (typeof selectCache !== 'undefined' && selectCache['department']) {
          const dept = selectCache['department'].find(d => String(d.department_id) === String(r.department_id));
          if (dept) deptName = dept.department_label || dept.department_name;
        }
      }
      const deptPart = deptName ? deptName + (code ? ' ' : '') : '';
      const prefix = deptPart + code;
      return prefix ? `${prefix} | ${name}` : name || r.oper_id;
    }
  },

  permissions: {
    label: 'Column Permissions',
    subtitle: 'Manage column-level access control',
    endpoint: '/permissions/column-permissions',
    writeTable: 'column_permissions',
    pk: 'id',
    icon: '🛡️',
    columns: [
      { key: 'id', label: 'ID', hidden: true },
      { key: 'table_name', label: 'Table Name' },
      { key: 'column_name', label: 'Column Name' },
      { key: 'levels', label: 'Levels' },
      { key: 'positions', label: 'Positions' },
      { key: 'roles', label: 'Roles' },
      { key: 'exceptions', label: 'Exceptions' },
    ],
    fields: [
      { key: 'table_name', label: 'Table Name', type: 'schema_table' },
      { key: 'column_name', label: 'Column Name', type: 'schema_column' },
      { key: 'levels', label: 'Levels', type: 'multiselect', optionsFrom: 'employee', optionValue: 'employee_level', optionLabel: 'employee_level' },
      { key: 'positions', label: 'Positions', type: 'multiselect', optionsFrom: 'employee', optionValue: 'position', optionLabel: 'position' },
      { key: 'roles', label: 'Roles', type: 'multiselect', optionsFrom: 'employee', optionValue: 'role', optionLabel: 'role' },
      { key: 'exceptions', label: 'Exceptions (Emails)', type: 'multiselect', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name', full: true },
    ],
    displayName: (r) => `${r.table_name}.${r.column_name}`,
  },

  // ================= RQC Process =================,

  action_rules: {
    label: 'Action Rules',
    subtitle: 'Manage button visibility and access',
    endpoint: '/table/action_rules',
    pk: 'id',
    icon: 'bolt',
    columns: [
      { key: 'id', label: 'ID', hidden: true },
      { key: 'action_id', label: 'Action ID' },
      { key: 'view_name', label: 'View Name' },
      { key: 'display_name', label: 'Display Name' },
      { key: 'display', label: 'Display', badge: true },
      { key: 'description', label: 'Description' },
      { key: 'levels', label: 'Levels' },
      { key: 'positions', label: 'Positions' },
      { key: 'roles', label: 'Roles' },
      { key: 'exceptions', label: 'Exceptions' },
    ],
    fields: [
      { key: 'action_id', label: 'Action ID', type: 'text' },
      {
        key: 'view_name', label: 'View Name', type: 'multiselect', options: [
          // My Views
          'my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team',
          // Request process tables
          'request', 'comment', 'payment', 'expense', 'invoice', 'mtr', 'service', 'asset', 'contract', 'target_table',
          // Organization
          'my_company', 'department', 'employee', 'employee_active',
          // Process & configuration
          'policy', 'account', 'my_location',
          // Partner
          'company', 'contact',
        ]
      },
      { key: 'display_name', label: 'Display Name', type: 'text' },
      { key: 'display', label: 'Display (Active)', type: 'segmented', options: ['true', 'false'], defaultValue: 'true' },
      { key: 'description', label: 'Description', type: 'textarea', full: true },
      { key: 'levels', label: 'Levels', type: 'multiselect', optionsFrom: 'employee', optionValue: 'employee_level', optionLabel: 'employee_level' },
      { key: 'positions', label: 'Positions', type: 'multiselect', optionsFrom: 'employee', optionValue: 'position', optionLabel: 'position' },
      { key: 'roles', label: 'Roles', type: 'multiselect', optionsFrom: 'employee', optionValue: 'role', optionLabel: 'role' },
      { key: 'exceptions', label: 'Exceptions (Emails)', type: 'multiselect', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name', full: true },
    ],
    displayName: (r) => r.action_id || r.id,
    groupBy: 'view_name',
  },

  exception_rules: {
    label: 'Menu',
    subtitle: 'Manage slice and automation access',
    endpoint: '/table/exception_rules',
    pk: 'id',
    icon: '🔎',
    columns: [
      { key: 'id', label: 'ID', hidden: true },
      { key: 'name', label: 'Rule Name' },
      { key: 'table_name', label: 'Table' },
      { key: 'levels', label: 'Levels' },
      { key: 'positions', label: 'Positions' },
      { key: 'roles', label: 'Roles' },
      { key: 'exceptions', label: 'Exceptions' },
    ],
    fields: [
      { key: 'name', label: 'Name (Slice/Bot)', type: 'text' },
      { key: 'table_name', label: 'Table', type: 'schema_table' },
      { key: 'levels', label: 'Levels', type: 'multiselect', optionsFrom: 'employee', optionValue: 'employee_level', optionLabel: 'employee_level' },
      { key: 'positions', label: 'Positions', type: 'multiselect', optionsFrom: 'employee', optionValue: 'position', optionLabel: 'position' },
      { key: 'roles', label: 'Roles', type: 'multiselect', optionsFrom: 'employee', optionValue: 'role', optionLabel: 'role' },
      { key: 'exceptions', label: 'Exceptions (Emails)', type: 'multiselect', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name', full: true },
    ],
    displayName: (r) => r.name || r.id,
  },

  cms_tenant_info: {
    label: 'Subscription',
    subtitle: 'View your service subscription details',
    endpoint: '/table/cms_tenant_info',
    pk: 'id',
    icon: 'card_membership',
    columns: [
      { key: 'tenant_domain', label: 'Domain' },
      { key: 'plan_name', label: 'Plan Name' },
      { key: 'base_currency', label: 'Base Currency', labelKey: 'col.base_currency' },
      { key: 'subscription_status', label: 'Subscription Status', badge: true },
      { key: 'billing_status', label: 'Billing Status', badge: true },
      { key: 'next_payment_date', label: 'Next Payment Date' },
      { key: 'last_billing_amount', label: 'Last Billing Amount' },
    ],
    fields: [
      { section: 'subscription info' },
      { key: 'plan_name', label: 'PLAN NAME', type: 'text', editReadonly: true },
      { key: 'base_currency', label: 'BASE CURRENCY', labelKey: 'col.base_currency', type: 'select', options: ['VND', 'USD', 'EUR', 'MMK', 'SGD', 'THB'], required: true },
      { key: 'tenant_domain', label: 'TENANT DOMAIN', type: 'text', editReadonly: true },
      { key: 'super_admin_email', label: 'SUPER ADMIN EMAIL', type: 'text', editReadonly: true },
      { section: 'billing info' },
      { key: 'subscription_status', label: 'SUBSCRIPTION STATUS', type: 'text', editReadonly: true },
      { key: 'billing_status', label: 'BILLING STATUS', type: 'text', editReadonly: true },
      { key: 'next_payment_date', label: 'NEXT PAYMENT DATE', type: 'date', editReadonly: true },
      { key: 'last_billing_amount', label: 'LAST BILLING AMOUNT', type: 'text', editReadonly: true }
    ],
    detailFields: [
      { section: 'subscription info' },
      { key: 'plan_name', label: 'Plan Name' },
      { key: 'base_currency', label: 'Base Currency', labelKey: 'col.base_currency' },
      { key: 'subscription_status', label: 'Subscription Status' },
      { key: 'subscription_start_date', label: 'Subscription Start Date' },
      { key: 'tenant_domain', label: 'Tenant Domain' },
      { key: 'super_admin_email', label: 'Super Admin Email' },
      { section: 'billing info' },
      { key: 'billing_status', label: 'Billing Status' },
      { key: 'next_payment_date', label: 'Next Payment Date' },
      { key: 'last_billing_amount', label: 'Last Billing Amount' },
      { key: 'updated_at', label: 'Last Synced' },
    ],
    displayName: (r) => r.plan_name || 'My Subscription',
  },

  cms_country: {
    label: 'CMS Countries',
    endpoint: '/cms-lookups/countries',
    pk: 'id',
    columns: [],
    fields: []
  },

  cms_province: {
    label: 'CMS Provinces',
    endpoint: '/cms-lookups/provinces',
    pk: 'id',
    columns: [],
    fields: []
  },

  cms_city: {
    label: 'CMS Cities',
    endpoint: '/cms-lookups/cities',
    pk: 'id',
    columns: [],
    fields: []
  },

  cms_currency: {
    label: 'CMS Currencies',
    endpoint: '/cms-lookups/currencies',
    pk: 'code',
    columns: [],
    fields: []
  }
  });

  // Opportunity aliases
  window.__MODULE_EXTENSIONS__ = window.__MODULE_EXTENSIONS__ || [];
  window.__MODULE_EXTENSIONS__.push(function(MODULES) {
    MODULES.oppotunity = {
      label: 'Opportunities',
      labelKey: 'nav.oppotunity',
      subtitle: 'Manage sales opportunities',
      endpoint: '/table/oppotunity',
      pk: 'project_id',
      icon: '🎯',
      groupBy: ['fy_recognized', 'fy_target_closed_date', 'quarter_by_closed_date', 'id__my_company', 'status', 'sale_lead'],
      columns: [
        { key: 'project_id', label: 'Project ID', hidden: true },
        { key: 'project_name', label: 'Project Name', hidden: true },
        { key: 'project_label', label: 'PROJECT LABEL' },
        { key: 'fy_recognized', label: 'Fy Recognized', hidden: true },
        { key: 'fy_target_closed_date', label: 'Fy Target Closed Date', hidden: true },
        { key: 'quarter_by_closed_date', label: 'Quarter By Closed Date', hidden: true },
        { key: 'id__my_company', label: 'My Company', optionsFrom: 'my_company', optionValue: 'my_company_id', optionLabel: 'company_shortname' },
        { key: 'id__company', label: 'END USER', optionsFrom: 'company', optionValue: 'company_id', optionLabel: 'company_fullname' },
        { key: 'status', label: 'STATUS', badge: true },
        { key: 'estimated_revenue', label: 'Estimated Revenue' },
        { key: 'currency', label: 'Currency' },
        { key: 'stage', label: 'Stage' },
        { key: 'sources', label: 'Sources' },
        { key: 'sale_lead', label: 'Sale Lead', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name' },
        { key: 'sale_team', label: 'Sale Team', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name' },
        { key: 'close_date', label: 'Closed Date' },
        { key: 'create_date', label: 'Create Date' }
      ],
      fields: [
        { key: 'project_name', label: 'PROJECT NAME', type: 'text', required: true, full: true },
        { key: 'id__my_company', label: 'MY COMPANY', type: 'select', optionsFrom: 'my_company', optionValue: 'my_company_id', optionLabel: 'company_shortname' },
        { key: 'id__company', label: 'CUSTOMER / END USER', type: 'select', optionsFrom: 'company', optionValue: 'company_id', optionLabel: 'company_fullname', required: true },
        { key: 'id__request', label: 'REQUEST', type: 'select', optionsFrom: 'request', optionValue: 'request_id', optionLabel: 'request_title' },
        { key: 'estimated_revenue', label: 'ESTIMATED REVENUE', type: 'text' },
        { key: 'currency', label: 'CURRENCY', type: 'select', optionsFrom: 'cms_currency', optionValue: 'code', optionLabel: 'label', required: true },
        { key: 'exchange_rate', label: 'EXCHANGE RATE', type: 'text' },
        { key: 'status', label: 'STATUS', type: 'segmented', options: [{ value: 52, label: 'Open' }, { value: 53, label: 'Closed Won' }, { value: 54, label: 'Closed Lost' }], defaultValue: 52 },
        { key: 'stage', label: 'STAGE', type: 'text' },
        { key: 'sources', label: 'SOURCES', type: 'text' },
        { key: 'close_date', label: 'CLOSE DATE', type: 'date' },
        { key: 'create_date', label: 'CREATE DATE', type: 'date' },
        { key: 'sale_lead', label: 'SALE LEAD', type: 'select', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name' },
        { key: 'sale_team', label: 'SALE TEAM', type: 'multiselect', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name' }
      ],
      detailFields: [
        { section: 'opportunity information' },
        { key: 'project_name', label: 'PROJECT NAME', full: true },
        { key: 'project_id', label: 'PROJECT ID', full: true },
        { key: 'id__my_company', label: 'MY COMPANY', optionsFrom: 'my_company', optionValue: 'my_company_id', optionLabel: 'company_shortname', full: true },
        { key: 'id__company', label: 'CUSTOMER / END USER', optionsFrom: 'company', optionValue: 'company_id', optionLabel: 'company_fullname', full: true },
        { key: 'stage', label: 'STAGE' },
        { key: 'sources', label: 'SOURCES' },
        { key: 'create_date', label: 'CREATE DATE' },
        { key: 'close_date', label: 'CLOSE DATE' },
        { section: 'financial information' },
        { key: 'estimated_revenue', label: 'ESTIMATED REVENUE' },
        { key: 'currency', label: 'CURRENCY' },
        { key: 'exchange_rate', label: 'EXCHANGE RATE' },
        { section: 'opportunity person' },
        { key: 'sale_lead', label: 'SALE LEAD', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name' },
        { key: 'sale_team', label: 'SALE TEAM', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name' }
      ],
      displayName: (r) => r.project_label || [r.project_id, r.project_name].filter(Boolean).join(' - ') || r.project_name || r.project_id
    };
    
    MODULES.oppo = MODULES.oppotunity;
    MODULES.opportunity = MODULES.oppotunity;
    
    // Ensure all table modules with detail views have 'logs' in their children
  });
})();
