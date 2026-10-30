# 10 — DATABASE TABLE MAP

**Target Repository:** `D:\CPI\teraxV2`  
**Database Technology:** PostgreSQL 15 / 16  
**Primary Schema:** `public` in database `crcdevdb` / `crc_db`  
**Auxiliary Databases:** `crc_helpdesk_db` (tickets/helpdesk), `cms_terax` (CMS/tenants)  
**Total Tables:** 47 tables mapped across `db_design.json`, `schema.dbml`, and `sql/init.sql`.

---

## 1. Table Classification Summary

| Classification | Count | Description |
|---|---|---|
| **CORE** | 4 | Foundational structural tables (`employee`, `department`, `company`, `contact`) |
| **TRANSACTION** | 16 | Operational business records (`request`, `payment`, `invoice`, `contract`, `asset`, `task`, `ticket`, `expense`, etc.) |
| **CONFIG** | 8 | Permissions, exception matrices, drop-down configurations, system setups |
| **MASTER DATA** | 4 | Reference registries (`project`, `dropdown_options`, `email_templates`, `system_settings`) |
| **AUDIT** | 4 | System trails, activity trackers, sync history (`audit_logs`, `user_activity_logs`, `sync_logs`, `webhook_logs`) |
| **FILE** | 4 | Uploaded media, attachments, quota tracking (`attachment`, `contract_file`, `storage_files`, `storage_folders`, `storage_quota`) |
| **LOOKUP** | 4 | Association and junction tables (`task_assignment`, `ticket_assignment`, `notification_subscriptions`, `permission_*`) |
| **LEGACY** | 3 | Deprecated or unmaintained schemas (`expense`, `cron_jobs`, `api_tokens`) |

---

## 2. Comprehensive 47-Table Data Dictionary

### 2.1 Core & Organizational Tables

#### 1. `employee`
- **Classification:** `CORE`
- **Purpose:** Central user, authentication credential, organizational role, and employee registry.
- **Primary Key:** `employee_id` (SERIAL)
- **Foreign Keys:**
  - `department_id` $\rightarrow$ `department.department_id` (Logical)
  - `company_id` $\rightarrow$ `company.company_id` (Logical)
- **Important Columns:** `username`, `email`, `password_hash`, `full_name`, `avatar_url`, `phone`, `role`, `position`, `status`, `manager_id`.
- **Status Columns:** `status` (VARCHAR: `Active`, `Inactive`, `Terminated`).
- **JSON/JSONB Columns:** `metadata` (JSONB - user UI preferences, display configuration).
- **Audit Columns:** `created_at`, `updated_at`, `created_by`, `updated_by`, `deleted_at`.
- **Indexes:** `idx_employee_username` (UNIQUE), `idx_employee_email` (UNIQUE), `idx_employee_dept`, `idx_employee_role`, `idx_employee_deleted_at`.
- **Referenced by Modules:** Auth, Base, Employee, Request, Payment, Invoice, Contract, Asset, Task, Ticket, Audit.

#### 2. `department`
- **Classification:** `CORE`
- **Purpose:** Departmental hierarchy, cost centers, and approval tree groupings.
- **Primary Key:** `department_id` (SERIAL)
- **Foreign Keys:**
  - `company_id` $\rightarrow$ `company.company_id` (Logical)
  - `parent_id` $\rightarrow$ `department.department_id` (Self-referential, tree hierarchy)
  - `manager_id` $\rightarrow$ `employee.employee_id` (Logical)
- **Important Columns:** `department_name`, `department_code`, `description`, `budget_quota`.
- **Status Columns:** `status` (`Active`, `Inactive`).
- **Audit Columns:** `created_at`, `updated_at`, `deleted_at`.
- **Indexes:** `idx_department_code` (UNIQUE), `idx_department_parent`, `idx_department_company`.
- **Referenced by Modules:** Organization, Employee, Request, Payment, Budget, RBAC.

#### 3. `company`
- **Classification:** `CORE`
- **Purpose:** Multi-entity corporate legal entities, subsidiaries, suppliers, and customer corporations.
- **Primary Key:** `company_id` (SERIAL)
- **Important Columns:** `company_name`, `tax_code`, `legal_name`, `address`, `phone`, `email`, `company_type` (`InternalEntity`, `Customer`, `Vendor`, `Partner`).
- **Status Columns:** `status` (`Active`, `Suspended`).
- **Audit Columns:** `created_at`, `updated_at`, `deleted_at`.
- **Indexes:** `idx_company_tax_code`, `idx_company_type`.
- **Referenced by Modules:** Company, Contract, Invoice, Payment, Asset.

#### 4. `contact`
- **Classification:** `CORE`
- **Purpose:** External customer and vendor contact directory associated with companies.
- **Primary Key:** `contact_id` (SERIAL)
- **Foreign Keys:** `company_id` $\rightarrow$ `company.company_id` (Logical)
- **Important Columns:** `contact_name`, `email`, `phone`, `job_title`, `is_primary`.
- **Status Columns:** `status` (`Active`, `Inactive`).
- **Audit Columns:** `created_at`, `updated_at`, `deleted_at`.
- **Referenced by Modules:** Contact, Contract, Invoice.

---

### 2.2 Transaction & Workflow Tables

#### 5. `request`
- **Classification:** `TRANSACTION`
- **Purpose:** Central operational service request, purchase order, procurement, and approval container.
- **Primary Key:** `id` (SERIAL)
- **Foreign Keys:**
  - `department_id` $\rightarrow$ `department.department_id` (Logical)
  - `sr_owner` $\rightarrow$ `employee.employee_id` (Logical)
  - `handler_id` $\rightarrow$ `employee.employee_id` (Logical)
  - `company_id` $\rightarrow$ `company.company_id` (Logical)
- **Important Columns:** `request_code`, `title`, `description`, `total_amount`, `currency`, `priority`, `service_type`.
- **Status Columns:**
  - `sr_status` (INT: 1=Draft, 2=Pending, 3=Approved, 4=Rejected, 5=Closed, 6=Cancelled)
  - `process_status` (INT: 7=Not started, 8=Processing, 9=Completed, 117=Canceled)
- **JSON/JSONB Columns:** `approval_flow` (JSONB multi-tier sign-off tree), `custom_fields` (JSONB).
- **Audit Columns:** `created_at`, `updated_at`, `created_by`, `updated_by`, `deleted_at`.
- **Indexes:** `idx_request_code` (UNIQUE), `idx_request_sr_status`, `idx_request_process_status`, `idx_request_created_by`, `idx_request_dept`.
- **Referenced by Modules:** Request, Payment, Invoice, Contract, Task, Audit.

#### 6. `request_items`
- **Classification:** `TRANSACTION`
- **Purpose:** Granular line items, bill of quantities (BOQ), materials, and price breakdown per request.
- **Primary Key:** `id` (SERIAL)
- **Foreign Keys:** `request_id` $\rightarrow$ `request.id` (Formal FK, CASCADE on soft delete via trigger)
- **Important Columns:** `item_name`, `unit`, `quantity`, `unit_price`, `total_price`, `remarks`.
- **Audit Columns:** `created_at`, `updated_at`.
- **Referenced by Modules:** Request, Finance, Procurement.

#### 7. `payment`
- **Classification:** `TRANSACTION`
- **Purpose:** Accounts Payable (AP) and outgoing disbursement vouchers.
- **Primary Key:** `payment_id` (SERIAL)
- **Foreign Keys:**
  - `request_id` $\rightarrow$ `request.id` (Logical)
  - `contract_id` $\rightarrow$ `contract.contract_id` (Logical)
  - `company_id` $\rightarrow$ `company.company_id` (Logical)
- **Important Columns:** `payment_code`, `amount`, `payment_method`, `bank_account`, `bank_name`, `payment_date`, `source` (`Contract`, `Request`, `Direct`).
- **Status Columns:** `payment_status` (INT: 30=Draft, 31=Ready for payment, 32=Paid, 33=Deleted, 121=Submitted for payment).
- **Audit Columns:** `created_at`, `updated_at`, `created_by`, `updated_by`, `deleted_at`.
- **Indexes:** `idx_payment_code`, `idx_payment_status`, `idx_payment_request_id`.
- **Referenced by Modules:** Payment, Request, Contract, Finance Analytics.

#### 8. `invoice`
- **Classification:** `TRANSACTION`
- **Purpose:** Accounts Receivable (AR) e-invoices and billing records issued to customers.
- **Primary Key:** `invoice_id` (SERIAL)
- **Foreign Keys:**
  - `company_id` $\rightarrow$ `company.company_id` (Logical)
  - `contract_id` $\rightarrow$ `contract.contract_id` (Logical)
  - `request_id` $\rightarrow$ `request.id` (Logical)
- **Important Columns:** `invoice_code`, `invoice_number`, `subtotal`, `vat_rate`, `vat_amount`, `total_amount`, `issue_date`, `due_date`.
- **Status Columns:** `invoice_status` (INT: 34=Draft, 35=Ready to issue, 36=Issued, 37=Paid, 38=Void).
- **Audit Columns:** `created_at`, `updated_at`, `created_by`, `updated_by`, `deleted_at`.
- **Indexes:** `idx_invoice_code`, `idx_invoice_number`, `idx_invoice_status`.
- **Referenced by Modules:** Invoice, Contract, Company, Finance.

#### 9. `contract`
- **Classification:** `TRANSACTION`
- **Purpose:** Commercial legal contracts with clients, vendors, and partners.
- **Primary Key:** `contract_id` (SERIAL)
- **Foreign Keys:**
  - `company_id` $\rightarrow$ `company.company_id` (Logical)
  - `request_id` $\rightarrow$ `request.id` (Logical)
  - `signatory_id` $\rightarrow$ `employee.employee_id` (Logical)
- **Important Columns:** `contract_number`, `title`, `contract_type`, `contract_value`, `start_date`, `end_date`, `terms_conditions`.
- **Status Columns:** `contract_status` (VARCHAR: `Draft`, `Active`, `Expired`, `Terminated`).
- **Audit Columns:** `created_at`, `updated_at`, `created_by`, `deleted_at`.
- **Indexes:** `idx_contract_number` (UNIQUE), `idx_contract_company`, `idx_contract_dates`.
- **Referenced by Modules:** Contract, Payment, Invoice, Storage.

#### 10. `contract_file`
- **Classification:** `FILE`
- **Purpose:** Physical digital attachments and PDF contracts bound to legal agreements.
- **Primary Key:** `id` (SERIAL)
- **Foreign Keys:** `contract_id` $\rightarrow$ `contract.contract_id` (Formal FK)
- **Important Columns:** `file_name`, `file_path`, `file_size`, `mime_type`, `version`.
- **Audit Columns:** `created_at`, `created_by`.

#### 11. `asset`
- **Classification:** `TRANSACTION`
- **Purpose:** Physical fixed assets, IT hardware, machines, and tools tracking.
- **Primary Key:** `asset_id` (SERIAL)
- **Foreign Keys:**
  - `current_holder_id` $\rightarrow$ `employee.employee_id` (Logical)
  - `department_id` $\rightarrow$ `department.department_id` (Logical)
- **Important Columns:** `asset_code`, `asset_name`, `serial_number`, `category`, `purchase_price`, `purchase_date`, `warranty_expiry`.
- **Status Columns:** `status` (VARCHAR: `InUse`, `InStock`, `Maintenance`, `Disposed`, `Lost`).
- **Audit Columns:** `created_at`, `updated_at`, `deleted_at`.

#### 12. `asset_transfer`
- **Classification:** `TRANSACTION`
- **Purpose:** Chain-of-custody transfer logs moving assets between employees or departments.
- **Primary Key:** `id` (SERIAL)
- **Foreign Keys:** `asset_id` $\rightarrow$ `asset.asset_id`, `from_employee_id`, `to_employee_id`.

#### 13. `asset_maintenance`
- **Classification:** `TRANSACTION`
- **Purpose:** Repair, calibration, and maintenance logs for physical assets.
- **Primary Key:** `id` (SERIAL)
- **Foreign Keys:** `asset_id` $\rightarrow$ `asset.asset_id`.

#### 14. `asset_audit`
- **Classification:** `TRANSACTION`
- **Purpose:** Periodic physical inventory counting and audit discrepancies.
- **Primary Key:** `id` (SERIAL)
- **Foreign Keys:** `asset_id` $\rightarrow$ `asset.asset_id`.

#### 15. `task`
- **Classification:** `TRANSACTION`
- **Purpose:** General operational tasks, request fulfillment work items, and ad-hoc todos.
- **Primary Key:** `task_id` (SERIAL)
- **Foreign Keys:** `request_id` $\rightarrow$ `request.id`, `project_id` $\rightarrow$ `project.project_id`.
- **Status Columns:** `task_status` (`Todo`, `InProgress`, `UnderReview`, `Completed`, `Cancelled`).
- **Audit Columns:** `created_at`, `updated_at`, `deleted_at`.

#### 16. `task_assignment`
- **Classification:** `LOOKUP`
- **Purpose:** Multi-employee assignment junction for tasks.
- **Primary Key:** `id` (SERIAL)
- **Foreign Keys:** `task_id` $\rightarrow$ `task.task_id`, `employee_id` $\rightarrow$ `employee.employee_id`.

#### 17. `project`
- **Classification:** `MASTER DATA`
- **Purpose:** Project umbrella grouping requests, tasks, and budgets.
- **Primary Key:** `project_id` (SERIAL)
- **Important Columns:** `project_name`, `project_code`, `budget`, `start_date`, `end_date`.

#### 18. `ticket` (Auxiliary DB / Mirror)
- **Classification:** `TRANSACTION`
- **Purpose:** Helpdesk customer support tickets synced from `crc_helpdesk_db`.
- **Primary Key:** `ticket_id` (SERIAL)
- **Status Columns:** `ticket_status` (`Open`, `Pending`, `Resolved`, `Closed`).

#### 19. `ticket_comment` & 20. `ticket_assignment`
- **Classification:** `TRANSACTION` / `LOOKUP`
- **Purpose:** Support discussions and agent assignments.

#### 21. `expense`
- **Classification:** `LEGACY`
- **Purpose:** Legacy expense tracking schema superseded by `payment` and `request_items`.
- **Primary Key:** `id` (SERIAL)

---

### 2.3 Permissions & Configuration Tables

#### 22. `exception_rules`
- **Classification:** `CONFIG`
- **Purpose:** Dimension 1 module/menu visibility access rules.
- **Primary Key:** `id` (SERIAL)
- **Columns:** `module_name`, `target_type` (`role`, `department`, `position`, `employee`), `target_id`, `permission` (`allow`, `deny`).

#### 23. `action_rules`
- **Classification:** `CONFIG`
- **Purpose:** Dimension 2 button/action execution rules (supports dynamic roles like `[request.sr_owner]`).
- **Primary Key:** `id` (SERIAL)
- **Columns:** `module_name`, `action_name`, `allowed_roles`, `conditions` (JSONB).

#### 24. `column_permissions`
- **Classification:** `CONFIG`
- **Purpose:** Dimension 3 field-level read/write ACL definitions.
- **Primary Key:** `id` (SERIAL)
- **Columns:** `module_name`, `column_name`, `is_readable`, `is_writable`, `min_level`.

#### 25. `permission_levels`, 26. `permission_positions`, 27. `permission_roles`, 28. `permission_exceptions`
- **Classification:** `LOOKUP` / `CONFIG`
- **Purpose:** Subordinate mapping tables granting fine-grained column permissions to managerial levels, roles, and employee IDs.

#### 29. `dropdown_options`
- **Classification:** `MASTER DATA`
- **Purpose:** Central dynamic enum and select options registry (`payment_method`, `currency`, `service_category`, etc.).
- **Primary Key:** `id` (SERIAL)
- **Columns:** `category`, `value_key`, `label_vi`, `label_en`, `sort_order`, `is_active`.

#### 30. `system_settings`
- **Classification:** `CONFIG`
- **Purpose:** Key-value configuration parameters for system runtime.
- **Primary Key:** `key` (VARCHAR)
- **Columns:** `value` (TEXT/JSONB), `description`, `updated_at`.

---

### 2.4 Files, Storage & Quotas

#### 31. `attachment`
- **Classification:** `FILE`
- **Purpose:** Generic file attachments linked to any system entity (`request`, `payment`, `task`).
- **Primary Key:** `id` (SERIAL)
- **Columns:** `entity_type`, `entity_id`, `file_name`, `file_path`, `file_size`, `mime_type`, `uploaded_by`.

#### 32. `storage_files` & 33. `storage_folders`
- **Classification:** `FILE`
- **Purpose:** Virtual file manager and folder hierarchy.
- **Columns:** `folder_id`, `parent_id`, `owner_id`, `file_hash`, `disk_path`.

#### 34. `storage_quota`
- **Classification:** `CONFIG`
- **Purpose:** Departmental and system-level disk storage caps and usage counters.
- **Columns:** `department_id`, `allocated_bytes`, `used_bytes`, `max_file_size_bytes`.

---

### 2.5 Auditing, Notifications & Automation

#### 35. `audit_logs`
- **Classification:** `AUDIT`
- **Purpose:** Automated database trigger change log capturing JSON diffs of `OLD` vs `NEW` record states.
- **Primary Key:** `id` (BIGSERIAL)
- **Columns:** `table_name`, `record_id`, `action` (`INSERT`, `UPDATE`, `DELETE`), `old_values` (JSONB), `new_values` (JSONB), `changed_by` (INT), `changed_at` (TIMESTAMP).

#### 36. `user_activity_logs`
- **Classification:** `AUDIT`
- **Purpose:** Application-level user interaction trails (logins, exports, report runs, impersonations).
- **Primary Key:** `id` (BIGSERIAL)

#### 37. `notifications` & 38. `notification_subscriptions`
- **Classification:** `TRANSACTION` / `CONFIG`
- **Purpose:** Real-time in-app notification inbox and Web Push subscription endpoints.
- **Columns:** `recipient_id`, `title`, `body`, `link_url`, `is_read`, `read_at`, `subscription_json` (JSONB).

#### 39. `comment`
- **Classification:** `TRANSACTION`
- **Purpose:** Multi-module conversational timeline attached to requests, payments, and tasks.
- **Columns:** `entity_type`, `entity_id`, `author_id`, `content`, `parent_comment_id`.

#### 40. `user_preferences`
- **Classification:** `CONFIG`
- **Purpose:** Personal UI settings, column visibility configs, and dark/light mode states.

#### 41. `email_templates` & 42. `email_queue`
- **Classification:** `MASTER DATA` / `TRANSACTION`
- **Purpose:** SMTP notification templates and pending email dispatch queue.

#### 43. `cron_jobs`
- **Classification:** `LEGACY`
- **Purpose:** Deprecated DB-stored cron configurations (superseded by in-process `node-cron`).

#### 44. `sync_logs`
- **Classification:** `AUDIT`
- **Purpose:** Audit tracking for data imports/exports with `cms_terax`.

#### 45. `api_tokens` & 46. `webhooks` & 47. `webhook_logs`
- **Classification:** `CONFIG` / `AUDIT`
- **Purpose:** External API access tokens, registered outbound webhook endpoints, and dispatch delivery logs.
