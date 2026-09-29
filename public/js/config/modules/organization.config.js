/**
 * organization.config.js - Modular Config for CRC / TeraX v2
 * Domain: organization
 */
(function() {
  window.__MODULE_CONFIGS__ = window.__MODULE_CONFIGS__ || {};
  Object.assign(window.__MODULE_CONFIGS__, {
  my_company: {
    label: 'My Company',
    subtitle: 'Manage internal company data',
    endpoint: '/my-company',
    pk: 'my_company_id',
    icon: '🏢',
    columns: [
      { key: 'logo', label: ' ' },
      { key: 'my_company_id', label: 'ID', hidden: true },
      { key: 'company_shortname', label: 'Company Short Name' },
      { key: 'company_fullname', label: 'Company Full Name' },
      { key: 'base_currency', label: 'Base Currency', labelKey: 'col.base_currency' },
      { key: 'status', label: 'Status', labelKey: 'col.status', badge: true },
      { key: 'department', label: ' ', type: 'child_count', icon: 'lan' },
      { key: 'employee', label: ' ', type: 'child_count', icon: 'groups' },
      { key: 'policy', label: ' ', type: 'child_count', icon: 'account_tree', hidden: true },
      { key: 'my_location', label: ' ', type: 'child_count', icon: 'location_on' },
      { key: 'account', label: ' ', type: 'child_count', icon: 'account_balance' },
    ],
    fields: [
      { key: 'tax_code', label: 'Tax Code', type: 'text', onchange: 'handleCompanyTaxCodeChange()' },
      { key: 'country', label: 'Country', type: 'select', optionsFrom: 'cms_country', optionValue: 'name', optionLabel: 'display_name', onchange: 'handleCompanyCountryChange()' },
      { key: 'province', label: 'Province/State', type: 'select', optionsFrom: 'cms_province', optionValue: 'name', optionLabel: 'name', filterByCountryField: 'country', onchange: 'handleCompanyProvinceChange()' },
      { key: 'city', label: 'City', type: 'select', optionsFrom: 'cms_city', optionValue: 'name', optionLabel: 'name', filterByProvinceField: 'province' },
      { key: 'company_fullname', label: 'COMPANY FULL NAME', type: 'text' },
      { key: 'company_shortname', label: 'COMPANY SHORT NAME', type: 'text', required: true, oninput: "this.dataset.vietqrShortName = ''" },
      { key: 'base_currency', label: 'Base Currency', labelKey: 'col.base_currency', type: 'text', createReadonly: true, editReadonly: true, placeholder: 'Được đồng bộ từ lúc đăng ký' },
      { key: 'company_label', label: 'COMPANY LABEL', type: 'text', createReadonly: true, editReadonly: true, virtual: true, full: true },
      { key: 'website', label: 'Website', type: 'text' },
      { key: 'address', label: 'Address', type: 'textarea', full: true },
      { key: 'state', label: 'State', type: 'datalist', hidden: true },
      { key: 'currency_list', label: 'Currency List', type: 'multiselect', optionsFrom: 'cms_currency', optionValue: 'code', optionLabel: 'label', hidden: true },
      { key: 'status', label: 'STATUS', labelKey: 'col.status', type: 'segmented', options: [{ value: 67, label: 'Active' }, { value: 68, label: 'Inactive' }], defaultValue: 67 },
      { key: 'logo', label: 'Logo', type: 'file', accept: 'image/*', full: true },
    ],
    detailSubtitle: (r) => {
      const logo = r.logo ? `<img src="${r.logo}" style="width:40px;height:40px;border-radius:4px;margin-right:12px;object-fit:contain;" />` : '';
      return `${logo} <span style="font-size:18px;font-weight:700;color:var(--text);">${r.company_fullname || ''}</span>`;
    },
    displayName: (r) => {
      const short = r.company_shortname || '';
      const full = r.company_fullname || '';
      return [short, full].filter(Boolean).join(' | ') || r.my_company_id;
    },
    groupBy: ['country', 'province', 'city'],
    detailFields: [
      { section: 'company identity' },
      { key: 'company_fullname', label: 'Company Full Name' },
      { key: 'company_shortname', label: 'Company Short Name' },
      { key: 'base_currency', label: 'Base Currency', labelKey: 'col.base_currency', editReadonly: true },
      { key: 'tax_code', label: 'Tax Code' },
      { section: 'branding & website' },
      { key: 'logo', label: 'Logo', type: 'file' },
      { key: 'website', label: 'Website' },
      { section: 'location information' },
      { key: 'address', label: 'Address' },
      { key: 'country', label: 'Country' },
      { key: 'province', label: 'Province/State' },
      { key: 'city', label: 'City' },
      { key: 'state', label: 'State', hidden: true },
    ],
    children: ['department', 'employee', 'my_location', 'account']
  },

  department: {
    label: 'Departments',
    subtitle: 'Manage company departments',
    endpoint: '/departments',
    writeTable: 'department',
    pk: 'department_id',
    icon: '🏗️',
    columns: [
      { key: 'department_id', label: 'ID', hidden: true },
      { key: 'department_label', label: 'Department Label', hidden: true },
      { key: 'department_code', label: 'Department Code' },
      { key: 'department_name', label: 'Department Name' },
      { key: 'type', label: 'Department Type', labelKey: 'col.department_type', badge: true },
      { key: 'manager_email', label: 'DEPARTMENT MANAGER', labelKey: 'col.manager_email', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name' },
      { key: 'company_id', label: 'MY COMPANY', labelKey: 'col.my_company', type: 'select', optionsFrom: 'my_company', optionValue: 'my_company_id', optionLabel: 'company_fullname', required: true, hidden: true },
      { key: 'company_shortname', label: 'Comp Name', hidden: true },
    ],
    fields: [
      { key: 'department_code', label: 'DEPARTMENT CODE', type: 'text' },
      { key: 'company_id', label: 'MY COMPANY', labelKey: 'col.my_company', type: 'select', optionsFrom: 'my_company', optionValue: 'my_company_id', optionLabel: 'company_fullname', required: true, hidden: true },
      { key: 'department_name', label: 'DEPARTMENT NAME', type: 'text', required: true },
      { key: 'type', label: 'DEPARTMENT TYPE', labelKey: 'col.department_type', type: 'select', options: ['Operation', 'Sale and MKT', 'Finance', 'Technical'], required: true },
      { key: 'manager_email', label: 'DEPARTMENT MANAGER', labelKey: 'col.manager_email', type: 'select', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name' },
      { key: 'department_label', label: 'DEPARTMENT LABEL', type: 'text', createReadonly: true, editReadonly: true, virtual: true, full: true },
      { key: 'company_shortname', label: 'Comp Name', hidden: true },
    ],
    detailFields: [
      { section: 'department information' },
      { key: 'department_code', label: 'DEPARTMENT CODE' },
      { key: 'department_name', label: 'DEPARTMENT NAME' },
      { key: 'type', label: 'DEPARTMENT TYPE', labelKey: 'col.department_type', badge: true },
      { key: 'manager_email', label: 'DEPARTMENT MANAGER', labelKey: 'col.manager_email', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name' },
      { key: 'company_id', label: 'MY COMPANY', labelKey: 'col.my_company', optionsFrom: 'my_company', optionValue: 'my_company_id', optionLabel: 'company_fullname' },
    ],
    displayName: (r) => {
      const comp = r.company_shortname || '';
      const name = r.department_name || '';
      if (name || comp) {
        return [name, comp].filter(Boolean).join(' | ');
      }
      if (r.department_label) return r.department_label;
      return r.department_id || 'Department';
    },
    groupBy: 'company_shortname',
    children: ['employee']
  },

  employee: {
    label: 'Employees',
    subtitle: 'Manage employee records',
    endpoint: '/employees',
    pk: 'employee_id',
    icon: '💼',
    columns: [
      { key: 'employee_id', label: 'Employee ID', hidden: true },
      { key: 'full_name', label: 'Full Name' },
      { key: 'employee_code', label: 'Employee Code' },
      { key: 'nick_name', label: 'Nick Name' },
      { key: 'username', label: 'Username' },
      { key: 'app_user_enabled', label: 'App User Access' },
      { key: 'email', label: 'Email' },
      { key: 'gen', label: 'Gender' },
      { key: 'phone', label: 'Phone' },
      { key: 'position', label: 'Position' },
      { key: 'employee_level', label: 'Level', hidden: true },
      { key: 'role', label: 'Role' },
      { key: 'status', label: 'Status' },
      { key: 'location_base', label: 'Working location', optionsFrom: 'my_location', optionValue: 'my_location_id', optionLabel: 'location_label' },
      { key: 'direct_manager', label: 'Direct Manager', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name' },
      { key: 'head_manager', label: 'HR Manager', labelKey: 'col.head_manager', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name', hidden: true },
      { key: 'start_date', label: 'Start Date', hidden: true },
      { key: 'end_date', label: 'End Date', hidden: true },
      { key: 'contract_type', label: 'Contract Type', hidden: true },
      { key: 'emergency_contact_name', label: 'Emergency Contact Name', hidden: true },
      { key: 'emergency_contact_phone', label: 'Emergency Contact Phone', hidden: true },
      { key: 'social_insurance_code', label: 'Social Insurance Code', hidden: true },
      { key: 'pit_code', label: 'PIT Code', hidden: true },
      { key: 'bank_info', label: 'Bank Information', labelKey: 'col.bank_info', hidden: true },
      { key: 'bank_account', label: 'Bank Account', hidden: true },
      { key: 'bank_name', label: 'Bank Name', hidden: true },
      { key: 'bank_city', label: 'Bank City', hidden: true },
      { key: 'address', label: 'Address', hidden: true },
      { key: 'sow', label: 'SOW', hidden: true }
    ],
    fields: [
      { section: 'employee information' },
      { key: 'employee_id', label: 'EMPLOYEE ID', type: 'text', editReadonly: true, placeholder: 'Auto-generated', hidden: true },
      { key: 'employee_code', label: 'EMPLOYEE CODE', type: 'text' },
      { key: 'full_name', label: 'FULL NAME', type: 'text', required: true },
      { key: 'nick_name', label: 'NICK NAME', type: 'text' },
      { key: 'gen', label: 'GEN', type: 'radio', options: ['Male', 'Female', 'Other'] },
      { key: 'phone', label: 'PHONE', type: 'text' },
      { key: 'email', label: 'EMAIL', type: 'email', required: true },
      { key: 'address', label: 'ADDRESS', type: 'textarea', full: true },
      { key: 'avatar', label: 'Avatar', type: 'file', accept: '.png', full: true },

      { section: 'employment information' },
      { key: 'company_id', label: 'MY COMPANY', labelKey: 'col.my_company', type: 'select', optionsFrom: 'my_company', optionValue: 'my_company_id', optionLabel: 'company_shortname', required: true, onchange: 'handleEmployeeCompanyChange()' },
      { key: 'department_id', label: 'DEPARTMENT', labelKey: 'col.department', type: 'select', optionsFrom: 'department', optionValue: 'department_id', optionLabel: 'department_label' },
      { key: 'position', label: 'POSITION', type: 'select_with_add', options: ['Developer', 'Designer', 'QA', 'Manager', 'Accountant', 'HR', 'Other'] },
      { key: 'role', label: 'ROLE TYPE', type: 'select', options: ['Staff', 'Super Admin'] },
      { key: 'status', label: 'STATUS', type: 'segmented', options: [{ value: 17, label: 'Active' }, { value: 18, label: 'Inactive' }], defaultValue: 17 },
      { key: 'location_base', label: 'WORKING LOCATION', type: 'select', optionsFrom: 'my_location', optionValue: 'my_location_id', optionLabel: 'location_label' },
      { key: 'direct_manager', label: 'DIRECT MANAGER', type: 'select', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name', required: true },
      { key: 'head_manager', label: 'HR MANAGER', labelKey: 'col.head_manager', type: 'select', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name', required: true },
      { key: 'employee_level', label: 'EMPLOYEE LEVEL', type: 'datalist', hidden: true },
      { key: 'contract_type', label: 'CONTACT TYPE', type: 'datalist', hidden: true },
      { key: 'start_date', label: 'START DATE', type: 'date', required: true },
      { key: 'end_date', label: 'END DATE', type: 'date' },
      { key: 'sow', label: 'SOW', type: 'textarea', full: true },

      { section: 'emergency & compliance' },
      { key: 'emergency_contact_name', label: 'EMERGENCY CONTACT NAME', type: 'text', required: true },
      { key: 'emergency_contact_phone', label: 'EMERGENCY CONTACT PHONE', type: 'text', required: true },
      { key: 'social_insurance_code', label: 'SOCIAL INSURANCE CODE', type: 'text' },
      { key: 'pit_code', label: 'PIT CODE', type: 'text' },

      { section: 'bank information' },
      { key: 'bank_info', label: 'BANK INFORMATION', labelKey: 'col.bank_info', type: 'textarea', full: true, placeholder: 'Bank Name, Account Number, Branch / City...' },

      { section: 'account & login credentials' },
      { key: 'username', label: 'USERNAME', type: 'text', placeholder: 'username (e.g. john.doe)', required: true },
      { key: 'password', label: 'PASSWORD', type: 'password', placeholder: 'Set password for account' },
      { key: 'app_user_enabled', label: 'APP USER ACCESS', type: 'segmented', options: [{ value: 'true', label: 'Enabled' }, { value: 'false', label: 'Disabled' }], defaultValue: 'true' }
    ],
    detailFields: [
      { section: 'employee information' },
      { key: 'employee_id', label: 'EMPLOYEE ID' },
      { key: 'employee_code', label: 'EMPLOYEE CODE' },
      { key: 'nick_name', label: 'NICK NAME' },
      { key: 'full_name', label: 'FULL NAME' },
      { key: 'gen', label: 'GENDER' },
      { key: 'email', label: 'EMAIL' },
      { key: 'phone', label: 'PHONE' },
      { key: 'address', label: 'ADDRESS' },
      { key: 'avatar', label: 'AVATAR', type: 'file' },

      { section: 'employment information' },
      { key: 'company_id', label: 'MY COMPANY', labelKey: 'col.my_company', optionsFrom: 'my_company', optionValue: 'my_company_id', optionLabel: 'company_shortname' },
      { key: 'department_id', label: 'DEPARTMENT', labelKey: 'col.department' },
      { key: 'position', label: 'POSITION' },
      { key: 'role', label: 'ROLE TYPE' },
      { key: 'status', label: 'ACCOUNT STATUS' },
      { key: 'location_base', label: 'WORKING LOCATION', optionsFrom: 'my_location', optionValue: 'my_location_id', optionLabel: 'location_label' },
      { key: 'direct_manager', label: 'DIRECT MANAGER' },
      { key: 'head_manager', label: 'HR MANAGER', labelKey: 'col.head_manager', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name' },
      { key: 'contract_type', label: 'CONTRACT TYPE', hidden: true },
      { key: 'start_date', label: 'START DATE' },
      { key: 'end_date', label: 'END DATE' },
      { key: 'sow', label: 'SCOPE OF WORK / RESPONSIBILITIES', full: true },

      { section: 'emergency & compliance' },
      { key: 'emergency_contact_name', label: 'EMERGENCY CONTACT NAME' },
      { key: 'emergency_contact_phone', label: 'EMERGENCY CONTACT PHONE' },
      { key: 'social_insurance_code', label: 'SOCIAL INSURANCE CODE' },
      { key: 'pit_code', label: 'PIT CODE' },

      { section: 'bank information' },
      { key: 'bank_info', label: 'BANK INFORMATION', labelKey: 'col.bank_info', full: true },

      { section: 'account & login' },
      { key: 'username', label: 'USERNAME' },
      { key: 'app_user_enabled', label: 'APP USER ACCESS' },
      { key: 'status', label: 'ACCOUNT STATUS', hidden: true }
    ],
    displayName: (r) => r.full_name || r.email || 'Employee',
    labelTemplate: '{{full_name}}',
    children: ['request', 'asset', 'service', 'payment']
  },

  employee_active: {
    label: 'Active Employees',
    subtitle: 'Currently active workforce',
    endpoint: '/employees?status=Active',
    pk: 'employee_id',
    icon: '👷',
    columns: [
      { key: 'full_name', label: 'Full Name' },
      { key: 'email', label: 'Email' },
      { key: 'gen', label: 'Gen' },
      { key: 'position', label: 'Position' },
      { key: 'direct_manager', label: 'Direct manager', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name' },
      { key: 'head_manager', label: 'HR Manager', labelKey: 'col.head_manager', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name', hidden: true },
      { key: 'location_base', label: 'Working location' },
      { key: 'phone', label: 'Phone' },
      { key: 'sow', label: 'SOW' },
    ],
    fields: [
      { section: 'Personal Info' },
      { key: 'full_name', label: 'Full Name', type: 'text' },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'phone', label: 'Phone', type: 'text' },
      { key: 'gen', label: 'Gender', type: 'radio', options: ['Male', 'Female', 'Other'] },
      { key: 'address', label: 'Address', type: 'textarea', full: true },
      { section: 'Work Info' },
      { key: 'position', label: 'Position', type: 'datalist' },
      { key: 'employee_level', label: 'Level', type: 'datalist' },
      { key: 'role', label: 'Role', type: 'datalist' },
      { key: 'status', label: 'Status', type: 'segmented', options: [{ value: 17, label: 'Active' }, { value: 18, label: 'Inactive' }], defaultValue: 17 },
      { key: 'location_base', label: 'Working location', type: 'datalist' },
      { key: 'company_id', label: 'MY COMPANY', labelKey: 'col.my_company', type: 'select', optionsFrom: 'my_company', optionValue: 'my_company_id', optionLabel: 'company_shortname' },
      { key: 'department_id', label: 'Department', type: 'select', optionsFrom: 'department', optionValue: 'department_id', optionLabel: 'department_label' },
      { key: 'direct_manager', label: 'Direct Manager', type: 'select', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name' },
      { key: 'head_manager', label: 'HR Manager', labelKey: 'col.head_manager', type: 'select', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name' },
      { key: 'start_date', label: 'Start Date', type: 'date' },
      { key: 'end_date', label: 'End Date', type: 'date' },
      // Hidden from detail view
      { key: 'department_name', label: 'Dept Name', hidden: true },
      { key: 'company_shortname', label: 'Comp Name', hidden: true },
      { key: 'manager_name', label: 'Manager Name', hidden: true },
    ],
    displayName: (r) => r.full_name || r.email || 'Employee',
    labelTemplate: '{{full_name}}',
    children: ['request', 'asset', 'service', 'payment']
  },

  company: {
    label: 'Customer / Supplier',
    subtitle: 'Manage Customers and Suppliers',
    endpoint: '/companies',
    writeTable: 'company',
    pk: 'company_id',
    icon: '🏬',
    columns: [
      { key: 'company_shortname', label: 'Company shortname' },
      { key: 'company_fullname', label: 'Company fullname' }, // Logo merged here via buildSingleRowHTML
      { key: 'type', label: 'Type', badge: true },
      { key: 'website', label: 'Website' },
      { key: 'country', label: 'Country' },
      { key: 'city', label: 'City' },
      { key: 'logo', label: 'Logo', hidden: true },
    ],
    fields: [
      { section: 'company information' },
      { key: 'tax_code', label: 'TAX CODE', type: 'text', onchange: 'handleCompanyTaxCodeChange()' },
      { key: 'type', label: 'TYPE', type: 'multiselect', options: ['Partner', 'Customer', 'Supplier'], required: true },
      { key: 'company_shortname', label: 'COMPANY SHORTNAME', type: 'text', required: true, oninput: 'updateCompanyLabel()' },
      { key: 'company_fullname', label: 'COMPANY FULLNAME', type: 'text', required: true, oninput: 'updateCompanyLabel()' },
      { key: 'counter_party_label', label: 'COMPANY LABEL', type: 'text', createReadonly: true, editReadonly: true, hidden: true },
      { section: 'location information' },
      { key: 'country', label: 'COUNTRY', type: 'select', optionsFrom: 'cms_country', optionValue: 'name', optionLabel: 'display_name', required: true, onchange: 'handleCompanyCountryChange()' },
      { key: 'province', label: 'PROVINCE/STATE', type: 'select', optionsFrom: 'cms_province', optionValue: 'name', optionLabel: 'name', required: true, onchange: 'handleCompanyProvinceChange()', filterByCountryField: 'country' },
      { key: 'city', label: 'CITY', type: 'select', optionsFrom: 'cms_city', optionValue: 'name', optionLabel: 'name', required: true, filterByProvinceField: 'province' },
      { key: 'address', label: 'ADDRESS', type: 'textarea', required: true, full: true },
      { section: 'branding & contact' },
      { key: 'logo', label: 'LOGO', type: 'file', accept: 'image/*', full: true },
      { key: 'website', label: 'WEBSITE', type: 'text' },
    ],
    detailFields: [
      { section: 'company information' },
      { key: 'tax_code', label: 'TAX CODE' },
      { key: 'type', label: 'TYPE' },
      { key: 'company_fullname', label: 'COMPANY FULLNAME' },
      { key: 'company_shortname', label: 'COMPANY SHORTNAME' },
      { key: 'counter_party_label', label: 'COMPANY LABEL', hidden: true },
      { section: 'location information' },
      { key: 'country', label: 'COUNTRY' },
      { key: 'province', label: 'PROVINCE/STATE' },
      { key: 'city', label: 'CITY' },
      { key: 'address', label: 'ADDRESS' },
      { section: 'branding & contact' },
      { key: 'website', label: 'WEBSITE' },
    ],
    detailSubtitle: (r) => {
      const logo = r.logo ? `<img src="${r.logo}" style="width:40px;height:40px;border-radius:4px;margin-right:12px;object-fit:contain;" />` : '';
      return `${logo} <span style="font-size:18px;font-weight:700;color:var(--text);">${r.company_fullname || ''}</span>`;
    },
    displayName: (r) => {
      const short = r.company_shortname || '';
      const full = r.company_fullname || '';
      return [short, full].filter(Boolean).join(' | ') || r.company_id;
    },
    groupBy: ['type', 'country', 'province', 'city'],
    children: ['contact', 'contract', 'payment', 'oppotunity']
  },

  contact: {
    label: 'Contacts',
    subtitle: 'Manage partner contact persons',
    endpoint: '/contacts',
    writeTable: 'contact',
    pk: 'contact_id',
    icon: '📎',
    columns: [
      { key: 'contact_id', label: 'ID', hidden: true },
      { key: 'name', label: 'Name' },
      { key: 'title', label: 'Title' },
      { key: 'email', label: 'Email' },
      { key: 'mobile_no', label: 'Mobile' },
      { key: 'company_shortname', label: 'Customer / Supplier', labelKey: 'col.customer_supplier', hidden: true },
      { key: 'gen', label: 'Gender' },
    ],
    fields: [
      { key: 'name', label: 'Full Name', type: 'text' },
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'email', label: 'Email', type: 'email', required: true },
      { key: 'mobile_no', label: 'Mobile No', type: 'text' },
      { key: 'gen', label: 'Gender', type: 'radio', options: ['Male', 'Female', 'Other'] },
      { key: 'birthday', label: 'Birthday', type: 'date' },
      { key: 'company_id', label: 'CUSTOMER / SUPPLIER', labelKey: 'col.customer_supplier', type: 'select', optionsFrom: 'company', optionValue: 'company_id', optionLabel: 'company_shortname', hidden: true },
      { key: 'company_shortname', label: 'Comp Name', hidden: true },
    ],
    displayName: (r) => { const prefix = r.gen === 'Male' ? 'Mr' : (r.gen === 'Female' ? 'Ms' : ''); return (prefix ? prefix + ' ' : '') + (r.name || '') + ' | ' + (r.email || '') + ' | ' + (r.mobile_no || ''); },
    groupBy: 'company_shortname'
  },

  my_location: {
    label: 'Locations',
    subtitle: 'Manage company locations',
    endpoint: '/table/my_location',
    pk: 'my_location_id',
    icon: 'location_on',
    columns: [
      { key: 'my_location_id', label: 'ID', hidden: true },
      { key: 'location_label', label: 'Location Label', hidden: true },
      { key: 'location_code', label: 'Location Code' },
      { key: 'type', label: 'Type' },
      { key: 'address', label: 'Address' },
      { key: 'my_company', label: 'My Company', labelKey: 'col.my_company', optionsFrom: 'my_company', optionValue: 'my_company_id', optionLabel: 'company_shortname', hidden: true },
      { key: 'responsible_employee', label: 'Responsible Employee' },
      { key: 'status', label: 'Status', badge: true },
    ],
    fields: [
      { key: 'my_location_id', label: 'Location ID', type: 'text', hidden: true },
      { key: 'location_code', label: 'Location Code', type: 'text' },
      { key: 'type', label: 'Type', type: 'select_with_add', options: ['Office', 'Warehouse', 'Factory', 'Showroom', 'Other'] },
      { key: 'address', label: 'Address', type: 'textarea', full: true },
      { key: 'my_company', label: 'MY COMPANY', labelKey: 'col.my_company', type: 'select', optionsFrom: 'my_company', optionValue: 'my_company_id', optionLabel: 'company_shortname' },
      { key: 'responsible_employee', label: 'Responsible Employee', type: 'select', optionsFrom: 'employee', optionValue: 'employee_id', optionLabel: 'full_name' },
      { key: 'location_label', label: 'Location Label', type: 'textarea', full: true, createReadonly: true, editReadonly: true, placeholder: 'Auto-generated label' },
      { key: 'status', label: 'Status', type: 'segmented', options: [{ value: 50, label: 'Active' }, { value: 51, label: 'Inactive' }], defaultValue: 50 },
    ],
    detailFields: [
      { key: 'location_code', label: 'Location Code' },
      { key: 'type', label: 'Type' },
      { key: 'address', label: 'Address' },
      { key: 'my_company', label: 'My Company', labelKey: 'col.my_company' },
      { key: 'responsible_employee', label: 'Responsible Employee' },
      { key: 'location_label', label: 'Location Label' },
      { key: 'status', label: 'Status' }
    ],
    displayName: (r) => {
      const code = r.location_code || '';
      const type = r.type || '';
      const comp = r.company_shortname || '';
      return [code, type, comp].filter(Boolean).join(' | ');
    },
  }
  });
})();
