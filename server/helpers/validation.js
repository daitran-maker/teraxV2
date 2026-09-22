const { z } = require('zod');

// Schema for Employee validation
const employeeSchema = z.object({
  employee_id: z.union([z.string(), z.number()]).optional().nullable(),
  username: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  full_name: z.string().min(1, 'Họ và tên là bắt buộc'),
  independent_id: z.union([z.string(), z.number()]).optional().nullable(),
  phone: z.string().optional().nullable(),
  gen: z.string().optional().nullable(),
  position: z.string().optional().nullable(),
  employee_level: z.union([z.string(), z.number()]).optional().nullable(),
  role: z.string().optional().nullable(),
  status: z.union([z.number(), z.string()]).optional().nullable(),
  location_base: z.string().optional().nullable(),
  company_id: z.union([z.string(), z.number()]).optional().nullable(),
  department_id: z.union([z.string(), z.number()]).optional().nullable(),
  direct_manager: z.union([z.string(), z.number()]).optional().nullable(),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  emergency_contact_name: z.string().optional().nullable(),
  emergency_contact_phone: z.string().optional().nullable(),
  social_insurance_code: z.string().optional().nullable(),
  pit_code: z.string().optional().nullable(),
  bank_account: z.string().optional().nullable(),
  bank_name: z.string().optional().nullable(),
  bank_city: z.string().optional().nullable(),
  bank_info: z.string().optional().nullable(),
  sow: z.string().optional().nullable(),
  avatar: z.string().optional().nullable(),
  app_user_enabled: z.any().optional()
}).passthrough();

// Schema for Request validation
const requestSchema = z.object({
  request_type: z.union([z.string(), z.number()]).optional().nullable(),
  requester: z.union([z.string(), z.number()]).optional().nullable(),
  company_id: z.union([z.string(), z.number()]).optional().nullable(),
  description: z.string().optional().nullable(),
  tier_1_approval: z.union([z.string(), z.number()]).optional().nullable(),
  tier_1_status: z.union([z.string(), z.number()]).optional().nullable(),
  tier_2_approval: z.union([z.string(), z.number()]).optional().nullable(),
  tier_2_status: z.union([z.string(), z.number()]).optional().nullable(),
  tier_3_approval: z.union([z.string(), z.number()]).optional().nullable(),
  tier_3_status: z.union([z.string(), z.number()]).optional().nullable(),
  sr_status: z.union([z.number(), z.string()]).optional().nullable(),
  process_status: z.union([z.number(), z.string()]).optional().nullable(),
  policy_lead: z.union([z.string(), z.number()]).optional().nullable(),
  sr_owner: z.union([z.array(z.any()), z.string(), z.number()]).optional().nullable(),
  approval_level: z.string().optional().nullable(),
  elements: z.union([z.array(z.any()), z.string()]).optional().nullable(),
  approval_flow: z.any().optional(),
  comment: z.string().optional().nullable(),
  file: z.any().optional()
}).passthrough();

// Schema for Payment validation
const paymentSchema = z.object({
  my_company: z.union([z.string(), z.number()]).optional().nullable(),
  due_date: z.string().optional().nullable(),
  currency: z.string().optional().nullable(),
  exchange_rate: z.union([z.number(), z.string()]).optional().nullable(),
  value: z.union([z.number(), z.string()]).optional().nullable(),
  payment_method: z.union([z.string(), z.number()]).optional().nullable(),
  payment_type: z.union([z.string(), z.number()]).optional().nullable(),
  payment_description: z.string().optional().nullable(),
  payment_period: z.union([z.number(), z.string()]).optional().nullable(),
  request: z.union([z.string(), z.number()]).optional().nullable(),
  contractspood: z.union([z.string(), z.number()]).optional().nullable(),
  contract_id: z.union([z.string(), z.number()]).optional().nullable(),
  source: z.string().optional().nullable(),
  counter_party: z.union([z.string(), z.number()]).optional().nullable(),
  company: z.union([z.string(), z.number()]).optional().nullable(),
  employee: z.union([z.string(), z.number()]).optional().nullable(),
  bank_info: z.string().optional().nullable(),
  payment_status: z.union([z.number(), z.string()]).optional().nullable(),
  payment_date: z.string().optional().nullable(),
  transaction_id: z.union([z.string(), z.number()]).optional().nullable(),
  payment_request: z.union([z.string(), z.number()]).optional().nullable()
}).passthrough();

// Schema for Service validation
const serviceSchema = z.object({
  service_name: z.string().optional().nullable(),
  service_type: z.string().optional().nullable(),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  service_id: z.union([z.string(), z.number()]).optional().nullable(),
  request: z.union([z.string(), z.number()]).optional().nullable(),
  status: z.union([z.number(), z.string()]).optional().nullable(),
  note: z.string().optional().nullable(),
  fy: z.string().optional().nullable(),
  my_company: z.union([z.string(), z.number()]).optional().nullable()
}).passthrough();

// Schema for Asset validation
const assetSchema = z.object({
  asset_name: z.string().optional().nullable(),
  type: z.string().optional().nullable(),
  status: z.union([z.number(), z.string()]).optional().nullable(),
  qty: z.union([z.number(), z.string()]).optional().nullable(),
  current_owner: z.union([z.string(), z.number()]).optional().nullable(),
  location: z.union([z.string(), z.number()]).optional().nullable(),
  purchase_cost: z.union([z.number(), z.string()]).optional().nullable(),
  currency: z.string().optional().nullable(),
  exchange_rate: z.union([z.number(), z.string()]).optional().nullable(),
  purchase_date: z.string().optional().nullable(),
  office_asset_id: z.union([z.string(), z.number()]).optional().nullable(),
  request: z.union([z.string(), z.number()]).optional().nullable(),
  identity_number: z.union([z.string(), z.number()]).optional().nullable(),
  value_in_base_currency: z.union([z.number(), z.string()]).optional().nullable(),
  note: z.string().optional().nullable()
}).passthrough();

// Schema for Ticket validation
const ticketSchema = z.object({
  ticket_type: z.union([z.string(), z.number()]).optional().nullable(),
  description: z.string().optional().nullable(),
  subdomain: z.string().optional().nullable()
}).passthrough();

// Schema for My Company validation
const myCompanySchema = z.object({
  company_shortname: z.string().optional().nullable(),
  company_fullname: z.string().optional().nullable(),
  logo: z.any().optional().nullable(),
  tax_code: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  province: z.string().optional().nullable(),
  base_currency: z.string().optional().nullable(),
  currency_list: z.string().optional().nullable(),
  status: z.union([z.number(), z.string()]).optional().nullable()
}).passthrough();

// Schema for Target Table validation
const targetTableSchema = z.object({
  type: z.string().optional().nullable(),
  table_name: z.string().optional().nullable(),
  record_ids: z.union([z.array(z.any()), z.string(), z.number()]).optional().nullable(),
  request: z.union([z.string(), z.number()]).optional().nullable()
}).passthrough();

// Schema for Assigned Task validation
const assignedTaskSchema = z.object({
  task_id: z.union([z.string(), z.number()]).optional().nullable(),
  request_id: z.union([z.string(), z.number()]).optional().nullable(),
  employee_id: z.union([z.string(), z.number()]).optional().nullable(),
  deadline: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  task_info_link: z.string().optional().nullable(),
  task_info_guide_file: z.string().optional().nullable(),
  task_info_notes: z.string().optional().nullable(),
  task_info_report: z.string().optional().nullable(),
  status: z.union([z.number(), z.string()]).optional().nullable(),
  log: z.any().optional()
}).passthrough();

// Schema for Task Subtask validation
const taskSubtaskSchema = z.object({
  subtask_id: z.union([z.string(), z.number()]).optional().nullable(),
  task_id: z.union([z.string(), z.number()]).optional().nullable(),
  description: z.string().optional().nullable(),
  status: z.union([z.number(), z.string()]).optional().nullable(),
  log: z.any().optional()
}).passthrough();

// Table Schemas Mapping
const tableSchemas = {
  employee: employeeSchema,
  request: requestSchema,

  payment: paymentSchema,
  service: serviceSchema,
  asset: assetSchema,
  ticket: ticketSchema,
  support: ticketSchema,
  my_company: myCompanySchema,
  target_table: targetTableSchema,
  assigned_task: assignedTaskSchema,
  task_subtask: taskSubtaskSchema
};

function validateTableData(tableName, data, isUpdate = false) {
  const schema = tableSchemas[tableName];
  if (!schema) return null;

  const activeSchema = isUpdate ? schema.partial() : schema;
  const result = activeSchema.safeParse(data);
  if (!result.success) {
    const errorMap = {};
    if (result.error && result.error.issues) {
      result.error.issues.forEach(err => {
        const field = err.path.join('.');
        errorMap[field] = err.message;
      });
    }
    return errorMap;
  }
  return null;
}

module.exports = {
  validateTableData,
  employeeSchema,
  requestSchema,

  paymentSchema,
  serviceSchema,
  assetSchema,
  myCompanySchema,
  targetTableSchema
};
