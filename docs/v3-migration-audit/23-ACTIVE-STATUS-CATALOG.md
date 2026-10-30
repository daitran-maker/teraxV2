# 23 — ACTIVE STATUS SYSTEM & STATUS CATALOG

**Target Repository:** `D:\CPI\teraxV2`  
**Data Source:** PostgreSQL Database `status_catalog` table & Live Table Column Value Introspection.  
**Status:** **100% VERIFIED AGAINST LIVE DATABASE & RUNTIME CODE**.

---

## 1. Resolution of the Status Ambiguity

### The Problem
Preliminary audit notes exhibited contradictions:
- `employee.status = 'Active'` vs `employee.status = 17`
- `request.sr_status = 'Pending Approval'` vs `request.sr_status = 2`

### The Truth
1. **The Physical Database Storage Type is INTEGER across ALL entities.**
   - In table `employee`, `status` is physically an `INTEGER` column (Default: `17`).
   - Querying the live database returns:
     - `status = 17`: 127 employees
     - `status = 18`: 2 employees
     - There are **ZERO records** containing the string `'Active'`.
2. **Where does `'Active'` come from?**
   - The string `'Active'` is purely the **UI DISPLAY LABEL** defined in `status_catalog.display_name_en` and frontend module configs (`organization.config.js:191`: `options: [{ value: 17, label: 'Active' }, { value: 18, label: 'Inactive' }]`).
   - In legacy query parameters (e.g. `/api/employees?status=Active`), the backend controller intercepts the string and runs `resolveStatusId('employee', 'status', 'Active')` from [server/helpers/statuses.js](file:///d:/CPI/teraxV2/server/helpers/statuses.js) which converts `'Active'` $\rightarrow$ `17`.
3. **Active Implementation:**
   - **Database Layer:** Strictly **INTEGER IDs** (`17`, `18`).
   - **Backend Layer:** Translates between strings and integer IDs via `server/helpers/statuses.js` using `STATUS` dictionary.
   - **Frontend Layer:** Receives integer IDs from API; uses `status_catalog` metadata or module configs to render localized badges (`display_name_vi` / `display_name_en`) with matching `color_code`.

---

## 2. Core Entity Status Catalog (Live Production Baseline)

| Entity / Table | Column Name | Physical DB Type | Actual Live Values in DB | Display Label (EN / VI) | Status Key | Hex Color | Business Meaning |
|---|---|---|---|---|---|---|---|
| **`employee`** | `status` | `INTEGER` | **`17`** (127 rows)<br>**`18`** (2 rows) | Active / Hoạt động<br>Inactive / Không hoạt động | `active`<br>`inactive` | `#10b981`<br>`#ef4444` | Employee active in directory and permitted to log in; inactive accounts are locked. |
| **`request`** | `sr_status` | `INTEGER` | **`1`** (64 rows)<br>**`2`** (125 rows)<br>**`3`** (551 rows)<br>**`5`** (8,695 rows)<br>`4` (0 rows)<br>`6` (0 rows) | Draft / Bản nháp<br>Pending Approval / Chờ duyệt<br>Approved / Đã duyệt<br>Rejected / Từ chối<br>Closed / Đã đóng<br>Cancelled / Đã hủy | `draft`<br>`pending_approval`<br>`approved`<br>`rejected`<br>`closed`<br>`cancelled` | `#64748b`<br>`#3b82f6`<br>`#10b981`<br>`#ef4444`<br>`#64748b`<br>`#ef4444` | Governance approval lifecycle. `2` initiates approval workflow; `3` unlocks task creation; `5` marks full completion and archiving. |
| **`request`** | `process_status` | `INTEGER` | **`7`** (334 rows)<br>**`8`** (405 rows)<br>**`9`** (8,608 rows)<br>**`117`** (88 rows) | Not started yet / Chưa bắt đầu<br>Processing / Đang xử lý<br>Completed / Đã hoàn thành<br>Canceled / Đã hủy | `not_started`<br>`processing`<br>`completed`<br>`canceled` | `#64748b`<br>`#3b82f6`<br>`#10b981`<br>`#ef4444` | Operational execution lifecycle. Managed independently from `sr_status`. |
| **`payment`** | `payment_status` | `INTEGER` | **`30`** (10 rows)<br>**`31`** (975 rows)<br>**`32`** (7,386 rows)<br>**`33`** (1 row)<br>`121` (0 rows) | Draft / Bản nháp<br>Ready for payment / Sẵn sàng thanh toán<br>Paid / Đã thanh toán<br>Deleted / Đã xóa<br>Submitted for payment / Chờ duyệt thanh toán | `draft`<br>`ready_for_payment`<br>`paid`<br>`deleted`<br>`submitted_for_payment` | `#64748b`<br>`#3b82f6`<br>`#10b981`<br>`#ef4444`<br>`#f59e0b` | Disbursement voucher states. `31` requires approval; `32` requires linking an active MTR bank transaction. |
| **`payment`** | `payment_type` | `INTEGER` | `60`<br>`61` (Default) | Incoming / Khoản thu<br>Outgoing / Khoản chi | `incoming`<br>`outgoing` | `#10b981`<br>`#f59e0b` | Financial cashflow direction. Outgoing payments trigger sub-requests. |
| **`invoice`** | `invoice_status` | `INTEGER` | **`34`** (741 rows)<br>**`35`** (3,009 rows)<br>**`36`** (10 rows)<br>**`38`** (18 rows)<br>`37` (0 rows)<br>`39` (0 rows) | Draft / Bản nháp<br>Ready to issue / Sẵn sàng xuất<br>Issued / Đã xuất<br>Paid / Đã thanh toán<br>Void / Bị hủy<br>Deleted / Đã xóa | `draft`<br>`ready_to_issue`<br>`issued`<br>`paid`<br>`void`<br>`deleted` | `#64748b`<br>`#3b82f6`<br>`#3b82f6`<br>`#10b981`<br>`#ef4444`<br>`#ef4444` | Billing invoice lifecycle. `36` assigns tax invoice number; `37` clears balance. |
| **`contract`** | `type` | `INTEGER` | `69`<br>`70`<br>`71` | Selling / Bán ra<br>Buying / Mua vào<br>Internal / Nội bộ | `selling`<br>`buying`<br>`internal` | `#10B981`<br>`#EF4444`<br>`#6366F1` | Contract commercial classification governing invoice and payment direction. |
| **`mtr`** | `status` | `INTEGER` | `55`<br>`56` | Draft / Bản nháp<br>Approved / Đã duyệt | `draft`<br>`approved` | `#64748b`<br>`#10b981` | Bank transaction reconciliation state. Unmatched lines are `55`. |
| **`account`** | `account_status` | `INTEGER` | **`19`** (43 rows)<br>**`20`** (5 rows) | Active / Hoạt động<br>Inactive / Không hoạt động | `active`<br>`inactive` | `#10b981`<br>`#ef4444` | Bank / cash account availability for payments and transaction matching. |
| **`my_company`**| `status` | `INTEGER` | **`67`** (6 rows)<br>**`68`** (2 rows) | Active / Hoạt động<br>Inactive / Ngưng hoạt động | `active`<br>`inactive` | `#10b981`<br>`#ef4444` | Tenant corporate entity active status. |
| **`assigned_task`**| `status` | `INTEGER` | `62`<br>`63`<br>`64` | Not started yet / Chưa bắt đầu<br>Processing / Đang xử lý<br>Completed / Hoàn thành | `not_started`<br>`processing`<br>`completed` | `#64748b`<br>`#3b82f6`<br>`#10b981` | Task execution lifecycle for operational assignees. |
| **`asset`** | `status` | `INTEGER` | `21`..`25` | Draft $\rightarrow$ Pending $\rightarrow$ In Progress $\rightarrow$ Approved $\rightarrow$ Completed | `draft`..`completed` | Varied | Fixed asset procurement and custody status. |

---

## 3. Status Transformation & Resolution Pipeline

```mermaid
sequenceDiagram
    autonumber
    actor UI as Browser Frontend (UI Grid / Form)
    participant API as Dynamic Table Route (/api/table/:tableName)
    participant Helper as Status Helper (server/helpers/statuses.js)
    participant DB as PostgreSQL (crcdevdb)

    Note over UI: User selects 'Active' in dropdown
    UI->>API: POST /api/table/employee { status: 17 } (or 'Active')
    API->>Helper: convertStatusFieldsToIds('employee', data)
    Helper->>Helper: resolveStatusId('employee', 'status', 'Active') -> returns 17
    API->>DB: INSERT INTO employee (..., status) VALUES (..., 17)
    DB-->>API: Row persisted with status = 17
    API->>Helper: enrichRecordWithStatusCatalog(row)
    Helper->>Helper: Attaches status_key='active', color_code='#10b981', display_name_vi='Hoạt động'
    API-->>UI: Returns JSON with status: 17, status_key: "active", status_label: "Hoạt động"
    Note over UI: Renders green badge: "Hoạt động"
```

---

## 4. Recommendations for TeraX V3 Migration

1. **Eliminate Magic Numbers in V3:**
   - Migrate integer status codes (`17`, `1`, `7`, `30`, `31`) to **type-safe string enums** (`ACTIVE`, `DRAFT`, `PENDING_APPROVAL`, `PAID`) using PostgreSQL native `ENUM` or TypeScript string literal types in Prisma/Drizzle.
2. **Automated ETL Status Conversion Script:**
   - Create a deterministic mapping table from V2 integer IDs to V3 string enums during data migration.
3. **Decouple Labels into i18n Dictionary:**
   - Eliminate hardcoded `display_name_vi` and `display_name_en` columns in the database; manage display strings purely within the frontend translation dictionary (`i18n.json`).
