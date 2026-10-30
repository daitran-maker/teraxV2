# 26 — V3 MIGRATION SOURCE OF TRUTH (VERIFIED BASELINE)

**Target System:** TeraX V2 (`D:\CPI\teraxV2`) $\rightarrow$ Migration Target: TeraX V3 (`D:\CPI\teraxV3`)  
**Database Verified:** `crcdevdb` on PostgreSQL 18.4 (`10.91.1.100:30543`)  
**Status:** **100% CANONICAL SOURCE OF TRUTH**. Every claim in this document is backed by code inspection, runtime routing, or direct live database queries.

---

## 1. Evidence Verification Legend

- `[VERIFIED_FROM_RUNTIME]`: Proved via active entrypoint (`server/index.js`), route execution, middleware pipeline, or active JavaScript services.
- `[VERIFIED_FROM_DATABASE]`: Proved via live read-only SQL introspection of `information_schema`, `pg_catalog`, or table rows in `crcdevdb`.
- `[VERIFIED_FROM_FRONTEND_USAGE]`: Proved via client HTTP call sites in `public/js/core/api.js`, `public/js/views/`, or `public/login.html`.
- `[NOT_VERIFIED]`: Items that could not be proved from active code or database and are explicitly flagged.

---

## 2. Canonical Active API Architecture

| API Domain | Canonical Mounted Path | Underlying Handler File | Verification Evidence |
|---|---|---|---|
| **Universal Data Engine** | `GET, POST, PUT, DELETE /api/table/:tableName` | `server/routes/dynamic_crud.js` | `[VERIFIED_FROM_RUNTIME]` + `[VERIFIED_FROM_FRONTEND_USAGE]` |
| **Workflow Actions Gateway** | `GET /api/actions/:table/:id`<br>`POST /api/actions/execute` | `server/routes/actions.js` | `[VERIFIED_FROM_RUNTIME]` + `[VERIFIED_FROM_FRONTEND_USAGE]` |
| **Authentication & Profile** | `POST /api/auth/login`<br>`GET /api/auth/me`<br>`POST /api/auth/google` | `server/modules/identity/auth.router.js` | `[VERIFIED_FROM_RUNTIME]` + `[VERIFIED_FROM_FRONTEND_USAGE]` |
| **Permission Matrix** | `GET /api/permissions/user-permissions` | `server/modules/identity/permissions.router.js` | `[VERIFIED_FROM_RUNTIME]` + `[VERIFIED_FROM_FRONTEND_USAGE]` |
| **Personal Queues** | `GET /api/my-views/:viewName` | `server/routes/myViews.js` | `[VERIFIED_FROM_RUNTIME]` + `[VERIFIED_FROM_FRONTEND_USAGE]` |
| **Organization Directory** | `/api/departments`<br>`/api/employees`<br>`/api/companies`<br>`/api/contacts`<br>`/api/my-company` | `server/modules/organization/` routers | `[VERIFIED_FROM_RUNTIME]` |
| **Policies & Programs** | `/api/policies` | `server/routes/policy.js` | `[VERIFIED_FROM_RUNTIME]` |
| **Realtime Stream (SSE)** | `GET /api/stream?token=...` | `server/index.js:305` $\rightarrow$ `server/helpers/sseHelper.js` | `[VERIFIED_FROM_RUNTIME]` + `[VERIFIED_FROM_FRONTEND_USAGE]` |
| **Multi-Part Uploads** | `POST /api/upload-chunk`<br>`POST /api/upload-binary` | `server/index.js:219-300` | `[VERIFIED_FROM_RUNTIME]` + `[VERIFIED_FROM_FRONTEND_USAGE]` |

> [!CAUTION]
> **Definitive Finding:** `/api/base/:module` DOES NOT EXIST in the active codebase. Any references to `/api/base` in early draft documents were errors and are classified as **`LEGACY_FICTION`**. The true canonical CRUD API for TeraX V2 is **`/api/table/:tableName`**.

---

## 3. Canonical Database Schema (Live PostgreSQL Baseline)

`[VERIFIED_FROM_DATABASE]`

Total Live Database Scope: **44 Base Tables** + **2 Views** (`v_department`, `v_finance`).

### 3.1 Primary Keys & Key Column Types of Core Entities

| Table Name | Primary Key Column | PK Data Type | Physical Status Column & Type | Soft Delete Column |
|---|---|---|---|---|
| **`employee`** | `employee_id` | `VARCHAR` (e.g. `EMP-001`) | `status` (`INTEGER`, default `17`) | `deleted_at` (`TIMESTAMP`) |
| **`request`** | `request_id` | `VARCHAR` (e.g. `REQ-260904-001`) | `sr_status` (`INTEGER`, default `1`)<br>`process_status` (`INTEGER`, default `7`) | `deleted_at` (`TIMESTAMP`) |
| **`payment`** | `payment_id` | `VARCHAR` (e.g. `PAY-260904-001`) | `payment_status` (`INTEGER`, default `30`)<br>`payment_type` (`INTEGER`, default `61`) | `deleted_at` (`TIMESTAMP`) |
| **`invoice`** | `invoice_id` | `VARCHAR` (e.g. `INV-260904-001`) | `invoice_status` (`INTEGER`, default `34`) | `deleted_at` (`TIMESTAMP`) |
| **`contract`** | `contract_id` | `VARCHAR` (e.g. `CON-260904-001`) | `type` (`INTEGER`, default `69`) | `deleted_at` (`TIMESTAMP`) |
| **`mtr`** | `transaction_id` | `VARCHAR` (e.g. `TXN-2026-0091`) | `status` (`INTEGER`, default `55`) | `deleted_at` (`TIMESTAMP`) |
| **`account`** | `account_id` | `VARCHAR` (e.g. `ACC-VCB-01`) | `account_status` (`INTEGER`, default `19`) | `deleted_at` (none) |
| **`my_company`**| `my_company_id` | `VARCHAR` (e.g. `1`) | `status` (`INTEGER`, default `67`) | `deleted_at` (`TIMESTAMP`) |
| **`department`**| `department_id` | `VARCHAR` (e.g. `DEP-TECH`) | None (`deleted_at` controls lifecycle) | `deleted_at` (`TIMESTAMP`) |
| **`policy_and_program`** | `policy_id` | `VARCHAR` (e.g. `'5'`) | None | `deleted_at` (`TIMESTAMP`) |

### 3.2 Physical vs Logical Foreign Key Reality

`[VERIFIED_FROM_DATABASE]`
- **The only 5 physical foreign keys in the live DB are internal to organization:**
  1. `employee.head_manager` $\rightarrow$ `employee.employee_id`
  2. `department.company_id` $\rightarrow$ `my_company.my_company_id`
  3. `employee.company_id` $\rightarrow$ `my_company.my_company_id`
  4. `employee.department_id` $\rightarrow$ `department.department_id`
  5. `employee.direct_manager` $\rightarrow$ `employee.employee_id`
- **All transactional relations (`payment` $\rightarrow$ `request`, `invoice` $\rightarrow$ `contract`, `mtr` $\rightarrow$ `account`) are 100% LOGICAL ONLY.**

---

## 4. Canonical Status Representations

`[VERIFIED_FROM_DATABASE]` + `[VERIFIED_FROM_RUNTIME]`

| Entity | Column | Physical Type | Live Values in Database | Display Label (VI / EN) | Status Key | Meaning |
|---|---|---|---|---|---|---|
| `employee` | `status` | `INTEGER` | **17** (127 rows)<br>**18** (2 rows) | Hoạt động / Active<br>Không hoạt động / Inactive | `active`<br>`inactive` | User login and operational eligibility |
| `request` | `sr_status` | `INTEGER` | **1** (64 rows)<br>**2** (125 rows)<br>**3** (551 rows)<br>**5** (8,695 rows) | Bản nháp / Draft<br>Chờ duyệt / Pending Approval<br>Đã duyệt / Approved<br>Đã đóng / Closed | `draft`<br>`pending_approval`<br>`approved`<br>`closed` | Governance and sign-off state |
| `request` | `process_status` | `INTEGER` | **7** (334 rows)<br>**8** (405 rows)<br>**9** (8,608 rows)<br>**117** (88 rows) | Chưa bắt đầu / Not started yet<br>Đang xử lý / Processing<br>Đã hoàn thành / Completed<br>Đã hủy / Canceled | `not_started`<br>`processing`<br>`completed`<br>`canceled` | Physical execution progress |
| `payment` | `payment_status` | `INTEGER` | **30** (10 rows)<br>**31** (975 rows)<br>**32** (7,386 rows)<br>**33** (1 row) | Bản nháp / Draft<br>Sẵn sàng thanh toán / Ready for payment<br>Đã thanh toán / Paid<br>Đã xóa / Deleted | `draft`<br>`ready_for_payment`<br>`paid`<br>`deleted` | Disbursement payment states |
| `invoice` | `invoice_status` | `INTEGER` | **34** (741 rows)<br>**35** (3,009 rows)<br>**36** (10 rows)<br>**38** (18 rows) | Bản nháp / Draft<br>Sẵn sàng xuất / Ready to issue<br>Đã xuất / Issued<br>Bị hủy / Void | `draft`<br>`ready_to_issue`<br>`issued`<br>`void` | Accounts Receivable billing lifecycle |
| `account` | `account_status` | `INTEGER` | **19** (43 rows)<br>**20** (5 rows) | Hoạt động / Active<br>Không hoạt động / Inactive | `active`<br>`inactive` | Bank account active flag |
| `my_company`| `status` | `INTEGER` | **67** (6 rows)<br>**68** (2 rows) | Hoạt động / Active<br>Ngưng hoạt động / Inactive | `active`<br>`inactive` | Tenant legal entity active flag |

---

## 5. Canonical Request Workflow Trace

`[VERIFIED_FROM_RUNTIME]` + `[VERIFIED_FROM_DATABASE]`

All transitions run through `POST /api/actions/execute`:

```mermaid
stateDiagram-v2
    [*] --> Draft : Record Creation (sr_status = 1)
    Draft --> PendingApproval : Submit (ACT-REQUEST-03)
    note right of PendingApproval
        Trigger trg_request_submit_status sets sr_submitted_date
        Sets approval_flow.steps[0].status = 2
    end note
    
    PendingApproval --> Approved : approve_request (all tiers approved)
    note right of Approved
        sr_status = 3
        process_status transitions to 8 (Processing)
    end note

    PendingApproval --> Rejected : reject_request (requires comment)
    note right of Rejected
        sr_status = 4
    end note

    PendingApproval --> Draft : withdraw_request (requester pulls back)
    Draft --> ClosedCancelled : ACT-REQUEST-05 (sr_status = 5, process_status = 117)
    
    Approved --> Completed : ACT-REQUEST-07 (process_status = 9)
    Completed --> Closed : ACT-REQUEST-06 (sr_status = 5, prompts for ratings)
    Closed --> [*]
```

---

## 6. Canonical Payment Workflow Trace

`[VERIFIED_FROM_RUNTIME]` + `[VERIFIED_FROM_DATABASE]`

All transitions run through `POST /api/actions/execute`:

```mermaid
stateDiagram-v2
    [*] --> Draft : Record Creation (payment_status = 30)
    Draft --> ReadyForPayment : payment_req_outgoing
    note right of ReadyForPayment
        1. Auto-creates Request (type '5', ID '5-YYMMDD-XX-001')
        2. Sets payment.payment_status = 31
        3. Sets payment.payment_request = newRequestId
    end note

    Draft --> ReadyForPayment : payment_ready (direct manager approval)
    
    ReadyForPayment --> Paid : payment_paid
    note right of Paid
        1. Requires valid transaction_id from mtr
        2. Checks account.finance_control permission
        3. Sets payment.payment_status = 32
        4. Copies mtr.transaction_date to payment.payment_date
    end note

    Paid --> Paid : payment_change_mtr (swaps linked MTR transaction)
    Paid --> [*]
```

---

## 7. Required Migration Dependency Order (Topological DAG)

`[VERIFIED_FROM_RUNTIME]` + `[VERIFIED_FROM_DATABASE]`

The migration sequence is strictly dictated by data foreign keys, user context requirements, and action preconditions:

```mermaid
flowchart TD
    subgraph Step 1: Identity & Entity Root
        MyComp[my_company: Tenant Entity]
        Dept[department: Department Tree]
        Emp[employee: Users & Accounts]
        Auth[Auth & Permission Security Matrix]
    end

    subgraph Step 2: Financial Prerequisite Foundation
        Acc[account: Bank Accounts]
        MTR[mtr: Money Transfer Records]
    end

    subgraph Step 3: Golden Module Execution
        Policy[policy_and_program: Policy ID '5' Payment]
        Payment[PAYMENT MODULE<br/>Full Grid, Form, Ready & Paid Actions, MTR Linking]
    end

    subgraph Step 4: Operational Core
        Req[request: Service Request Engine & Approval Flow]
        Task[assigned_task & task_subtask]
    end

    subgraph Step 5: Commercial & Fixed Assets
        Contract[contract & contract_file]
        Invoice[invoice: AR Billing]
        Asset[asset: Fixed Assets]
    end

    %% Topological links
    MyComp --> Dept
    Dept --> Emp
    Emp --> Auth
    MyComp --> Payment
    Emp --> Payment

    MyComp --> Acc
    Acc --> MTR
    MTR --> Payment

    Policy --> Payment
    Payment -.-> Req
    Req --> Task
    Contract --> Invoice
    Req --> Contract
    Emp --> Asset
```

---

## 8. Legacy Files to NEVER Use as Migration Reference

The following files exist in the repository but represent **zombie code, obsolete architectures, or abandoned refactoring artifacts**. They must be **strictly excluded** from V3:

| File / Folder Path | Why It Must Be Ignored |
|---|---|
| `server/routes/auth.js` | Unmounted legacy file; active authentication is in `server/modules/identity/auth.router.js`. |
| `server/routes/company.js` | Unmounted legacy file; active company router is in `server/modules/organization/company.router.js`. |
| `server/routes/contact.js` | Unmounted legacy file; active contact router is in `server/modules/organization/contact.router.js`. |
| `server/routes/department.js` | Unmounted legacy file; active department router is in `server/modules/organization/department.router.js`. |
| `server/routes/employee.js` | Unmounted legacy file; active employee router is in `server/modules/organization/employee.router.js`. |
| `server/routes/myCompany.js` | Unmounted legacy file; active myCompany router is in `server/modules/organization/myCompany.router.js`. |
| `server/routes/notifications.js` | Unmounted legacy file; active notification router is in `server/modules/notification/notification.router.js`. |
| `server/routes/permissions.js` | Unmounted legacy file; active permissions router is in `server/modules/identity/permissions.router.js`. |
| `modules/*/server/` (root) | Duplicated code mirror; active application runtime exclusively loads from `server/modules/`. |
| `public/js/config/modules/` | Redundant copy of module configs; runtime loads from `modules/*/client/`. |
| `expense` table & legacy code | Deprecated expense schema superseded by `payment` and `request_items`. |
| `/api/base/:module` references | Fictional endpoint from early draft audit notes; the active canonical endpoint is `/api/table/:tableName`. |
