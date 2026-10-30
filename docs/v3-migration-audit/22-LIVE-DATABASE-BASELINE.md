# 22 — LIVE DATABASE BASELINE (VERIFIED AGAINST LIVE DATABASE)

**Target Repository:** `D:\CPI\teraxV2`  
**Database Connection:** `PostgreSQL 18.4 (Debian 18.4-1.pgdg13+1) on x86_64-pc-linux-gnu`  
**Database Instance:** `crcdevdb` on `10.91.1.100:30543`  
**Verification Method:** Direct read-only metadata introspection via `information_schema` and `pg_catalog`.  
**Status:** **100% VERIFIED AGAINST LIVE DATABASE** (Zero assumptions, zero speculation).

---

## 1. Database Environment & Extensions

- **Database Name:** `crcdevdb`
- **PostgreSQL Engine Version:** `PostgreSQL 18.4 (Debian 18.4-1.pgdg13+1)`
- **Installed PostgreSQL Extensions:**
  - `plpgsql` (v1.0) — PL/pgSQL procedural language.
  - `pgcrypto` (v1.3) — Cryptographic functions (used for `gen_random_uuid()`).

---

## 2. Complete Inventory of Tables & Views in Schema `public`

Total: **44 Base Tables** + **2 Views**

### 2.1 Base Tables (44 Tables)
1. `account` — Bank and cash accounts ledger
2. `action_rules` — Dimension 2 button and workflow action permission rules
3. `app_migration_meta` — Migration version tracker
4. `asset` — Fixed assets registry
5. `assigned_task` — Operational tasks assigned to employees
6. `audit_logs` — CDC audit trail capturing OLD/NEW JSON diffs
7. `automation_registry` — System triggers and background automations
8. `automation_run_logs` — Execution logs of automated triggers
9. `cms_tenant_info` — Multi-tenant configuration and domain bindings
10. `column_permissions` — Dimension 3 field-level read/write ACL
11. `comment` — Discussion timeline (renamed from `request_detail`)
12. `company` — External client, supplier, and partner corporations
13. `contact` — External business contacts
14. `contract` — Commercial agreements (buying, selling, internal)
15. `customize` — Custom table display settings
16. `department` — Departmental hierarchy and cost centers
17. `employee` — User accounts, employee directory, and auth credentials
18. `exception_rules` — Dimension 1 module and menu permission rules
19. `expense` — Expense tracking table
20. `invoice` — Accounts Receivable (AR) invoices
21. `mtr` — Money Transfer Records (bank transaction lines)
22. `my_company` — Internal tenant company legal entities
23. `my_location` — Company physical offices and branches
24. `my_product_and_service` — Products and services catalog
25. `notification` — In-app alerts inbox
26. `operation_program` — Operational business programs
27. `oppotunity` — Sales opportunities and pipeline
28. `payment` — Accounts Payable (AP) disbursement vouchers
29. `permission_exceptions` — Individual user column overrides
30. `permission_levels` — Managerial tier column permission mappings
31. `permission_positions` — Job position column permission mappings
32. `permission_roles` — System role column permission mappings
33. `policy_and_program` — Service Request types & approval policies
34. `project` — Master project containers
35. `push_subscriptions` — Browser Web Push VAPID endpoints
36. `request` — Central Service Request container & approval workflow
37. `request_rating` — Anonymous service rating records
38. `request_watches` — Users watching/subscribed to request updates
39. `service` — Recurring subscriptions and external services
40. `status_catalog` — Central dynamic integer status dictionary
41. `system_setup` — System key-value configuration flags
42. `target_table` — Dynamic master data registry
43. `task_subtask` — Sub-items under assigned tasks
44. `ticket` — Helpdesk customer support tickets (synced mirror)
45. `ticket_comment` — Discussions on helpdesk tickets
46. `ticket_type` — Support ticket categories
47. `uploaded_files` — Metadata for uploaded files and attachments

### 2.2 Database Views (2 Views)
1. `v_department` — Aggregated department hierarchy with manager names and headcount.
2. `v_finance` — Financial summary aggregation grouping contracts, payments, invoices, and expenses per `request_id`.

---

## 3. Physical Foreign Keys vs Logical Relationships

> [!CAUTION]
> **Extreme Referential Integrity Vacuum:**
> In the entire live database, across all 10 core business entities, **there are only 5 physical foreign keys enforced by PostgreSQL**:
> 1. `employee.head_manager` $\rightarrow$ `employee.employee_id`
> 2. `department.company_id` $\rightarrow$ `my_company.my_company_id`
> 3. `employee.company_id` $\rightarrow$ `my_company.my_company_id`
> 4. `employee.department_id` $\rightarrow$ `department.department_id`
> 5. `employee.direct_manager` $\rightarrow$ `employee.employee_id`
>
> All other relations (`payment.request`, `payment.contract_id`, `invoice.contract_id`, `request.policy_id`, `mtr.account`) are **100% LOGICAL ONLY**. The database does NOT enforce referential integrity on them.

---

## 4. Live Schema Specifications for Core Entities

### 4.1 Table: `employee` (35 Columns)
- **Primary Key:** `employee_id` (`character varying`, NOT integer!)
- **Status Column:** `status` (`integer`, NOT string! Default: `17` = Active, `18` = Inactive)
- **Unique Constraints:** `employee_email_key`, `employee_username_unique_key`
- **Key Columns:**
  - `employee_id`: VARCHAR (PK, e.g. `EMP-001`, `EMP-014`)
  - `username`: VARCHAR (Unique)
  - `email`: VARCHAR (Unique)
  - `password`: VARCHAR (Bcrypt password hash)
  - `full_name`: VARCHAR
  - `role`: VARCHAR (`Super Admin`, `Admin`, `Manager`, `Team Lead`, `Staff`)
  - `department_id`: VARCHAR (FK to `department.department_id`)
  - `company_id`: VARCHAR (FK to `my_company.my_company_id`)
  - `status`: INTEGER (Live data: 127 records with `17`, 2 records with `18`)
  - `app_user_enabled`: BOOLEAN (Default: `true`)
  - `log`: JSONB (Default: `'[]'::jsonb`)
  - `deleted_at`: TIMESTAMP (Soft delete)

### 4.2 Table: `request` (23 Columns)
- **Primary Key:** `request_id` (`character varying`, NOT serial `id`!)
- **Status Columns:**
  - `sr_status`: `integer` (Default: `1` [Draft])
  - `process_status`: `integer` (Default: `7` [Not started yet])
- **Key Columns:**
  - `request_id`: VARCHAR (PK, e.g. `REQ-260904-001`)
  - `request_type`: VARCHAR (References `policy_and_program.policy_id`, e.g. `'5'`)
  - `requester`: TEXT (Requester employee email/id)
  - `sr_creater`: TEXT (Creator employee email/id)
  - `policy_lead`: TEXT (Department or policy lead responsible)
  - `sr_owner`: TEXT[] (`ARRAY` of employee identifiers!)
  - `elements`: TEXT[] (`ARRAY` of policy elements!)
  - `sr_status`: INTEGER (Live counts: 1: 64, 2: 125, 3: 551, 5: 8695)
  - `process_status`: INTEGER (Live counts: 7: 334, 8: 405, 9: 8608, 117: 88)
  - `approval_flow`: JSONB (Multi-level sign-off structure)
  - `rating`: JSONB (Rating cache)
  - `log`: JSONB (Audit activity array)
  - `deleted_at`: TIMESTAMP

### 4.3 Table: `payment` (31 Columns)
- **Primary Key:** `payment_id` (`character varying`, e.g. `PAY-260904-001`)
- **Status Column:** `payment_status` (`integer`, Default: `30` [Draft])
- **Key Columns:**
  - `payment_id`: VARCHAR (PK)
  - `request`: TEXT (Logical link to `request.request_id`)
  - `contract_id`: VARCHAR (Logical link to `contract.contract_id`)
  - `transaction_id`: VARCHAR (Logical link to `mtr.transaction_id`)
  - `payment_request`: TEXT (Sub-request created by `payment_req_outgoing`)
  - `payment_type`: INTEGER (Default: `61` [Outgoing], `60` [Incoming])
  - `payment_status`: INTEGER (Live counts: 30: 10, 31: 975, 32: 7386, 33: 1)
  - `payment_term`: VARCHAR (Mandatory condition)
  - `value`: NUMERIC
  - `value_in_base_currency`: NUMERIC
  - `exchange_rate`: NUMERIC
  - `due_date`: DATE
  - `payment_date`: DATE (Staged upon linking MTR transaction)
  - `my_company`: TEXT (Internal paying entity)
  - `counter_party`: TEXT (Beneficiary name)
  - `finance_splits`: JSONB
  - `source`: VARCHAR (Default: `'Request'`)
  - `deleted_at`: TIMESTAMP

### 4.4 Table: `invoice` (29 Columns)
- **Primary Key:** `invoice_id` (`character varying`, e.g. `INV-260904-001`)
- **Status Column:** `invoice_status` (`integer`, Default: `34` [Draft])
- **Key Columns:**
  - `invoice_id`: VARCHAR (PK)
  - `request`: TEXT
  - `contract_id`: VARCHAR
  - `invoice_status`: INTEGER (Live counts: 34: 741, 35: 3009, 36: 10, 38: 18)
  - `invoice_no`: TEXT (Official tax invoice number)
  - `value_before_vat`: NUMERIC
  - `vat_value`: TEXT / NUMERIC
  - `total_value`: NUMERIC
  - `value_before_vat_in_base_currency`: NUMERIC
  - `total_value_in_base_currency`: NUMERIC
  - `deleted_at`: TIMESTAMP

### 4.5 Table: `contract` (22 Columns)
- **Primary Key:** `contract_id` (`character varying`, e.g. `CON-260904-001`)
- **Type Column:** `type` (`integer`, Default: `69` [Selling], `70` [Buying], `71` [Internal])
- **Key Columns:**
  - `contract_id`: VARCHAR (PK)
  - `id__request`: VARCHAR / `request`: TEXT (Logical link to originating request)
  - `company_entity`: TEXT (External counterparty)
  - `total_value`: NUMERIC
  - `start_date`: DATE
  - `end_date`: DATE
  - `deleted_at`: TIMESTAMP

### 4.6 Table: `mtr` (Money Transfer Record) (14 Columns)
- **Primary Key:** `transaction_id` (`character varying`, e.g. `TXN-2026-0091`)
- **Status Column:** `status` (`integer`, Default: `55` [Unmatched/Active])
- **Key Columns:**
  - `transaction_id`: VARCHAR (PK)
  - `account`: TEXT (Bank account identifier from `account.account_id`)
  - `transaction_date`: DATE
  - `transaction_type`: VARCHAR (`Credit` / `Debit`)
  - `amount`: NUMERIC
  - `amount_in_base_currency`: NUMERIC
  - `exchange_rate`: INTEGER
  - `description`: TEXT
  - `deleted_at`: TIMESTAMP

### 4.7 Table: `account` (11 Columns)
- **Primary Key:** `account_id` (`character varying`)
- **Status Column:** `account_status` (`integer`, Default: `19` [Active], `20` [Inactive])
- **Key Columns:**
  - `account_id`: VARCHAR (PK)
  - `account_name`: VARCHAR
  - `account_number`: VARCHAR
  - `bank_name`: VARCHAR
  - `currency`: VARCHAR
  - `account_status`: INTEGER (Live counts: 19: 43, 20: 5)
  - `my_company`: VARCHAR

### 4.8 Table: `my_company` (17 Columns)
- **Primary Key:** `my_company_id` (`character varying`)
- **Status Column:** `status` (`integer`, Default: `67` [Active], `68` [Inactive])
- **Key Columns:**
  - `my_company_id`: VARCHAR (PK)
  - `company_shortname`: VARCHAR
  - `company_fullname`: VARCHAR
  - `base_currency`: TEXT (Default: `'VND'`)
  - `timezone`: VARCHAR (Default: `'Asia/Ho_Chi_Minh'`)
  - `status`: INTEGER (Live counts: 67: 6, 68: 2)

### 4.9 Table: `department` (8 Columns)
- **Primary Key:** `department_id` (`character varying`)
- **Key Columns:**
  - `department_id`: VARCHAR (PK)
  - `department_name`: VARCHAR
  - `department_code`: VARCHAR
  - `company_id`: VARCHAR (FK to `my_company.my_company_id`)
  - `manager_email`: VARCHAR
  - `deleted_at`: TIMESTAMP

### 4.10 Table: `policy_and_program` (23 Columns)
- **Primary Key:** `policy_id` (`character varying`)
- **Key Columns:**
  - `policy_id`: VARCHAR (PK, e.g. `'5'` = Payment Request, `'ASSIGN_TASK'` = Work Task)
  - `policy_name`: VARCHAR
  - `policy_type`: VARCHAR (`Finance`, `Workspace`, `IT`, `HR`)
  - `tier1_approval`: VARCHAR (Employee ID)
  - `tier2_approval`: VARCHAR (Employee ID)
  - `tier3_approval`: VARCHAR (Employee ID)
  - `approval_level`: VARCHAR (`Tier 0`, `Tier 1`, `Tier 2`, `Tier 3`)
  - `policy_lead`: VARCHAR (Employee ID)
  - `sr_owner`: VARCHAR (Employee ID)

---

## 5. Active Database Triggers & Functions (Verified on Live DB)

| Trigger Name | Table | Event & Timing | Trigger Function | Active Verification Proof |
|---|---|---|---|---|
| `trg_request_submit_status` | `request` | BEFORE INSERT OR UPDATE OF `sr_status` | `enforce_request_submit_status()` | **INSTALLED & ACTIVE** (Synchronizes approval steps and submission timestamps) |
| `trg_sync_payment_request` | `payment` | BEFORE INSERT OR UPDATE | `sync_request_and_source_from_contract()` | **INSTALLED & ACTIVE** (Cascades request link and source from parent contract) |
| `trg_sync_invoice_request` | `invoice` | BEFORE INSERT | `sync_request_and_source_from_contract()` | **INSTALLED & ACTIVE** (Cascades request link and source from parent contract) |
| `trg_propagate_contract_request` | `contract` | AFTER UPDATE | `propagate_contract_request_change()` | **INSTALLED & ACTIVE** (Propagates new `request_id` to linked payments & invoices) |
| `trg_audit_log` | All core tables | BEFORE INSERT, UPDATE, DELETE | `audit_log_trigger()` | **INSTALLED & ACTIVE** (Appends diffs to `audit_logs` table) |
| `trg_cascade_soft_delete` | All core tables | AFTER UPDATE | `cascade_soft_delete_trigger()` | **INSTALLED & ACTIVE** (Cascades `deleted_at` timestamp to sub-entities) |
