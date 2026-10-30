# 05 — BACKEND API ENDPOINT AUDIT & CATALOG

> **Scope:** Complete API Inventory, HTTP Methods, Controller/Service Paths, Payloads, Auth & RBAC  
> **Source Directory:** `D:\CPI\teraxV2\server`, `D:\CPI\teraxV2\modules`  
> **Target Migration Destination:** `D:\CPI\teraxV3\apps\api`

---

## 1. Auth & Identity Module (`/api/auth`)

### 1.1 Login with Password / Username / Email / Employee ID
```text
Method: POST
URL: /api/auth/login
Controller/route file: modules/identity/server/identity.controller.js (lines 12-27)
Service file: modules/identity/server/identity.service.js (lines 43-90)
Request payload: { "login_id": "string", "password": "string" } (hoặc username/password)
Response payload: {
  "token": "string (JWT 365d)",
  "user": {
    "employee_id": "string",
    "username": "string",
    "email": "string",
    "full_name": "string",
    "nick_name": "string",
    "role": "string",
    "employee_level": "string",
    "position": "string",
    "company_id": "string",
    "department_id": "string"
  }
}
Authentication: Public (chịu authLimiter: max 15 requests / 15 phút)
Permission: Public
Business rules:
  - Kiểm tra mật khẩu bằng bcrypt.compare.
  - Tự động nâng cấp mật khẩu cũ dạng plain-text sang bcrypt hash nếu khớp.
  - Chặn nếu tài khoản có status === 'Inactive' hoặc app_user_enabled === false.
  - Gửi thông tin user active sang CMS không chặn (pushLoginToCMS).
Database tables: employee
Frontend consumers: public/login.html (handlePasswordLogin)
```

### 1.2 Google SSO Direct Login
```text
Method: POST
URL: /api/auth/google-login (hoặc POST /api/auth/login với credential)
Controller/route file: modules/identity/server/identity.controller.js (lines 29-38)
Service file: modules/identity/server/identity.service.js (lines 92-125)
Request payload: { "credential": "string (Google ID Token)" }
Response payload: { "token": "string", "user": { ... } }
Authentication: Public
Permission: Public
Business rules:
  - Xác thực ID token thông qua OAuth2Client của google-auth-library.
  - So khớp email từ Google token với cột email trong bảng employee. Nếu không tìm thấy, từ chối đăng nhập.
Database tables: employee
Frontend consumers: public/login.html (handleGoogleLogin)
```

### 1.3 Centralized SSO Callback
```text
Method: GET
URL: /api/auth/google/sso-callback
Controller/route file: modules/identity/server/identity.controller.js (lines 173-215)
Service file: modules/identity/server/identity.service.js
Request payload: Query params ?sso_token=... (base64 encoded JSON)
Response payload: Redirect 302 sang /#token=...&user=...
Authentication: Public
Permission: Public
Business rules:
  - Giải mã sso_token từ base64, lấy targetEmail.
  - Kiểm tra trạng thái tài khoản: bắt buộc status = 17 (Active).
Database tables: employee
Frontend consumers: Redirect từ cms.terax.ai sau khi đăng nhập Google tập trung.
```

### 1.4 Get Current User Profile (Me)
```text
Method: GET
URL: /api/auth/me
Controller/route file: modules/identity/server/identity.controller.js (lines 61-89)
Service file: modules/identity/server/identity.service.js
Request payload: None (Header Authorization: Bearer <token>)
Response payload: { "employee_id": "...", "username": "...", "email": "...", "full_name": "...", "role": "...", ... }
Authentication: JWT Token Required
Permission: Any authenticated user
Business rules: Trả về thông tin hồ sơ nhân sự mới nhất từ database.
Database tables: employee
Frontend consumers: public/js/core/tabRouter.js, public/app.js
```

### 1.5 Switch User (Test Account Switcher)
```text
Method: POST
URL: /api/auth/switch-user
Controller/route file: modules/identity/server/identity.controller.js (lines 104-121)
Service file: modules/identity/server/identity.service.js (lines 149-179)
Request payload: { "employee_id": "string" }
Response payload: { "token": "string (New JWT for target employee)", "user": { ... } }
Authentication: JWT Token Required
Permission: [LỖ HỔNG BẢO MẬT] Không kiểm tra quyền Super Admin, bất kỳ ai có token đều gọi được.
Business rules: Sinh ngay một token JWT mới đại diện cho nhân viên đích mà không cần mật khẩu.
Database tables: employee
Frontend consumers: public/js/components/userSwitcher.js
```

### 1.6 Change Password
```text
Method: POST
URL: /api/auth/change-password
Controller/route file: modules/identity/server/identity.controller.js (lines 124-141)
Service file: modules/identity/server/identity.service.js (lines 127-144)
Request payload: { "oldPassword": "string", "newPassword": "string" }
Response payload: { "success": true, "message": "Đổi mật khẩu thành công." }
Authentication: JWT Token Required
Permission: Bản thân tài khoản đang đăng nhập
Business rules: Mật khẩu mới tối thiểu 6 ký tự; hash bằng bcrypt(newPassword, 10).
Database tables: employee
Frontend consumers: public/index.html (submitChangePassword modal)
```

---

## 2. Permissions & Authorization Module (`/api/permissions`)

### 2.1 Get Column Permissions (All)
```text
Method: GET
URL: /api/permissions/column-permissions
Controller/route file: modules/identity/server/identity.controller.js (lines 220-227)
Service file: modules/identity/server/identity.repository.js
Request payload: None
Response payload: Array of column permission definitions with levels, positions, roles, exceptions.
Authentication: JWT Token Required
Permission: Admin / Super Admin
Database tables: column_permissions, permission_levels, permission_positions, permission_roles, permission_exceptions
Frontend consumers: public/js/views/tableView.js, #permissions page
```

### 2.2 Get Denied Columns for Current User (My Columns)
```text
Method: GET
URL: /api/permissions/my-columns
Controller/route file: modules/identity/server/identity.controller.js (lines 466-544)
Service file: modules/identity/server/identity.service.js
Request payload: None
Response payload: Object mapping table name to array of hidden columns, ví dụ:
  {
    "employee": ["password", "salary"],
    "payment": ["vat", "value_in_base_currency"]
  }
Authentication: JWT Token Required
Permission: Any authenticated user
Business rules:
  - Nếu user.role === 'SUPER ADMIN': trả về {} (không ẩn bất kỳ cột nào).
  - So khớp 4 chiều: exceptions -> roles -> levels -> positions. Nếu không khớp chiều nào => cột bị đưa vào danh sách denied.
Database tables: column_permissions, permission_levels, permission_positions, permission_roles, permission_exceptions
Frontend consumers: public/js/services/permissionService.js (window.isColumnAllowed)
```

### 2.3 Get Menu / Slice Permissions for Current User (My Slices)
```text
Method: GET
URL: /api/permissions/my-slices
Controller/route file: modules/identity/server/identity.controller.js (lines 334-347)
Service file: server/helpers/permissionHelper.js (checkPermission)
Request payload: None
Response payload: Object mapping slice key to boolean, ví dụ:
  {
    "my_request": true,
    "my_approval": true,
    "payment": false,
    "settings": false
  }
Authentication: JWT Token Required
Permission: Any authenticated user
Business rules: Đọc bảng exception_rules, kiểm tra quyền xem Menu của user hiện tại.
Database tables: exception_rules
Frontend consumers: public/js/core/tabRouter.js (chặn truy cập route), public/app.js (ẩn hiện menu sidebar)
```

### 2.4 Get Action Permissions for Current User (My Action Permissions)
```text
Method: GET
URL: /api/permissions/my-action-permissions
Controller/route file: modules/identity/server/identity.controller.js (lines 350-463)
Service file: modules/identity/server/identity.service.js
Request payload: None
Response payload: Object mapping action verbs ('add', 'edit', 'delete') and custom actions to boolean flags.
Authentication: JWT Token Required
Permission: Any authenticated user
Business rules:
  - Tự động bóc tách quy tắc CRUD (`add_request`, `edit_payment`, `delete_employee`).
  - Hỗ trợ role đặc thù: `[requester]`, `[sr_creater]`.
Database tables: action_rules
Frontend consumers: public/js/services/permissionService.js (window.isActionAllowed)
```

---

## 3. Dynamic Table CRUD Subsystem (`/api/table`)

Hệ thống cung cấp một Generic CRUD Router xử lý cho hơn 20 bảng cơ sở dữ liệu tại [`server/routes/dynamic_crud.js`](file:///d:/CPI/teraxV2/server/routes/dynamic_crud.js).

### 3.1 List Table Records (Master Query)
```text
Method: GET
URL: /api/table/:tableName
Controller/route file: server/routes/dynamic_crud.js (lines 1470-3147)
Request query params:
  - page: int (mặc định 1)
  - limit: int (mặc định 15, tối đa 100)
  - search: string (tìm kiếm full text)
  - sort_by: string (cột cần sắp xếp)
  - sort_dir: 'ASC' | 'DESC'
  - summary: boolean (có kèm bộ đếm status_cards không)
  - <columnName>: lọc giá trị chính xác
Response payload:
  {
    "data": [ { ...record } ],
    "total": 128,
    "page": 1,
    "limit": 15,
    "summary": [ { "status": "Approved", "count": 84 }, ... ]
  }
Authentication: JWT Token Required
Permission: Kiểm tra column_permissions để loại bỏ các cột bị cấm khỏi SELECT.
Business rules:
  - Tự động JOIN với các bảng lookup (employee, my_company, department) để bổ sung tên hiển thị.
  - Bảng Helpdesk ('ticket', 'ticket_comment') tự động định tuyến sang _helpdeskPool (database crc_helpdesk_db).
  - Tự động ánh xạ số nguyên trạng thái sang chuỗi hiển thị qua resolveStatusId / status_catalog.
  - Áp dụng Row-Level Security: Nếu truy vấn bảng 'request' hoặc bảng con của request, lọc theo quyền tiếp cận của nhân viên qua getUserAccessibleRequestIds().
Database tables: Bảng được gọi trong :tableName + các bảng liên quan.
Frontend consumers: public/js/views/tableView.js (renderTableView), public/app.js (loadModule)
```

### 3.2 Get Single Record Detail
```text
Method: GET
URL: /api/table/:tableName/:id
Controller/route file: server/routes/dynamic_crud.js (lines 3165-3431)
Request payload: None
Response payload: { ...recordObject, _audit_logs: [ ... ] }
Authentication: JWT Token Required
Permission: RLS check qua checkRecordAccess() trong fileStorageHelper.
Business rules:
  - Hỗ trợ giải mã HashID nếu ID được truyền dưới dạng băm.
  - Tự động nạp danh sách tệp đính kèm liên kết từ uploaded_files.
Database tables: :tableName, uploaded_files
Frontend consumers: public/js/views/detailView.js (openDetailInternal)
```

### 3.3 Create Table Record
```text
Method: POST
URL: /api/table/:tableName
Controller/route file: server/routes/dynamic_crud.js (lines 3432-3947)
Request payload: JSON object dữ liệu bản ghi mới
Response payload: { "success": true, "id": "generated_id", "data": { ...createdRecord } }
Authentication: JWT Token Required
Permission: Kiểm tra action_rules 'add_<tableName>'.
Business rules:
  - Sinh ID tuần tự qua generateSequentialId() (ví dụ: SR-051026-TL-1, PAY-0012, ASSET-0045).
  - Tự động bóc tách các trường base64 upload, ghi ra đĩa vật lý public/uploads/ và thay bằng đường dẫn URL.
  - Chuyển đổi các trường trạng thái chuỗi thành mã số status ID theo từ điển statuses.js.
  - Nếu tạo mới Request: Tự động phân giải quy trình phê duyệt Tier 1-3 từ Policy qua RequestModel.resolveApprovals().
  - Ghi audit log tự động qua PostgreSQL trigger.
  - Bắn sự kiện realtime SSE event: 'db_change' (action: 'insert').
Database tables: :tableName, audit_logs
Frontend consumers: public/js/views/formModal.js (submitForm)
```

### 3.4 Update Table Record
```text
Method: PUT
URL: /api/table/:tableName/:id
Controller/route file: server/routes/dynamic_crud.js (lines 3948-4687)
Request payload: JSON object các trường thay đổi
Response payload: { "success": true, "data": { ...updatedRecord } }
Authentication: JWT Token Required
Permission: Kiểm tra action_rules 'edit_<tableName>'.
Business rules:
  - Tự động bóc tách base64 và lưu file đính kèm.
  - Xử lý các side-effects khi đổi trạng thái (ví dụ đổi trạng thái Request sang Approved sẽ kích hoạt trigger cập nhật Payment/Invoice tương ứng).
  - Bắn sự kiện realtime SSE event: 'db_change' (action: 'update').
Database tables: :tableName, audit_logs
Frontend consumers: public/js/views/formModal.js (submitForm), public/js/views/fieldHandlers.js
```

### 3.5 Soft Delete / Hard Delete Record
```text
Method: DELETE
URL: /api/table/:tableName/:id
Controller/route file: server/routes/dynamic_crud.js (lines 4688-5035)
Request payload: None
Response payload: { "success": true, "message": "Record deleted successfully" }
Authentication: JWT Token Required
Permission: Kiểm tra action_rules 'delete_<tableName>'.
Business rules:
  - Thiết lập deleted_at = CURRENT_TIMESTAMP (Soft Delete).
  - Kích hoạt PostgreSQL trigger cascade_soft_delete_trigger() tự động cascade soft-delete toàn bộ bản ghi con liên quan.
  - Bắn SSE event: 'db_change' (action: 'delete').
Database tables: :tableName, audit_logs
Frontend consumers: public/js/services/deleteService.js (deleteRecord)
```

### 3.6 Bulk Delete & Bulk Restore
```text
Method: POST
URL: /api/table/:tableName/bulk-delete
URL: /api/table/:tableName/bulk-restore
Controller/route file: server/routes/dynamic_crud.js (lines 5036-5390)
Request payload: { "ids": ["id1", "id2", ...] }
Response payload: { "success": true, "deletedCount": int }
Authentication: JWT Token Required
Permission: Admin / Super Admin
Database tables: :tableName
Frontend consumers: public/js/services/bulkActionService.js
```

---

## 4. Workflow & Action Execution Subsystem (`/api/actions`)

### 4.1 Get Available Actions for Record
```text
Method: GET
URL: /api/actions/:tableName/:recordId
Controller/route file: server/routes/actions.js (lines 532-873)
Request payload: None
Response payload: Array of actionable buttons:
  [
    {
      "action_id": "approve_request",
      "display_name": "Phê duyệt",
      "action_type": "status_transition",
      "confirm": true,
      "requires_input": false
    }
  ]
Authentication: JWT Token Required
Permission: Đánh giá theo action_rules, trạng thái hiện tại của bản ghi, và vai trò của user đối với bản ghi.
Business rules:
  - Nếu user không phải là người duyệt cấp hiện tại (current_level) và không phải Super Admin $\rightarrow$ Không trả về nút Approve/Reject.
  - Nếu Request đang ở trạng thái Draft $\rightarrow$ Trả về nút Submit (`ACT-REQUEST-09`).
Database tables: action_rules, :tableName
Frontend consumers: public/js/views/detailView.js (renderActionButtons)
```

### 4.2 Execute Workflow Action
```text
Method: POST
URL: /api/actions/execute
Controller/route file: server/routes/actions.js (lines 1082-2434)
Request payload:
  {
    "action_id": "approve_request",
    "table_name": "request",
    "record_id": "SR-051026-TL-1",
    "view": "my_approval",
    "data": { ...optionalPayload }
  }
Response payload: { "success": true, "message": "Action executed successfully" }
Authentication: JWT Token Required
Permission: Kiểm tra lại quyền server-side đối với action_id trước khi thực thi.
Business rules:
  - Thực thi trong một Database Transaction nghiêm ngặt (BEGIN ... COMMIT/ROLLBACK).
  - Gán app.current_user trong connection để audit log trigger ghi nhận đúng mã nhân viên thực hiện.
  - Phân nhánh xử lý theo 20 action_id khác nhau (xem chi tiết tại 09-WORKFLOW-MAP.md).
  - Tự động phát SSE broadcast và internal EventBus (`EVENTS.ACTION_EXECUTED`).
Database tables: request, payment, invoice, assigned_task, request_rating, audit_logs
Frontend consumers: public/js/views/detailView.js (executeAction)
```

### 4.3 Get MTR Transactions for Payment Paid
```text
Method: GET
URL: /api/actions/payment/:paymentId/mtrs
Controller/route file: server/routes/actions.js (lines 2438-2504)
Request payload: None
Response payload: { "data": [ { "transaction_id": "...", "amount": 1000000, "currency": "VND", ... } ] }
Authentication: JWT Token Required
Permission: User phải là người quản lý tài khoản (`finance_control` hoặc `transaction_managed_by`) hoặc Super Admin.
Business rules: Lấy danh sách giao dịch ngân hàng sao kê (MTR) chưa gán hoặc hợp lệ thuộc tài khoản công ty của phiếu chi.
Database tables: payment, account, mtr
Frontend consumers: Form modal chọn MTR khi nhấn nút Paid trên phiếu thanh toán.
```

---

## 5. My Views & Workspace Subsystem (`/api/my-views`)

### 5.1 Workspace Statistics Summary
```text
Method: GET
URL: /api/my-views/stats/summary
Controller/route file: server/routes/myViews.js (lines 230-284)
Request payload: None
Response payload:
  {
    "my_request": 3,
    "my_approval": 5,
    "my_process_owner": 2,
    "my_task": 2
  }
Authentication: JWT Token Required
Permission: Any authenticated user
Business rules: Đếm song song số lượng yêu cầu đang chờ xử lý theo từng lát cắt của chính user hiện tại.
Database tables: request
Frontend consumers: public/dashboard.js, public/index.html (badge đếm)
```

### 5.2 Get Slices Records (My Request, My Approval, My Task, My Team)
```text
Method: GET
URL: /api/my-views/:viewType (với viewType: 'my-request' | 'my-approval' | 'my-task' | 'my-team')
Controller/route file: server/routes/myViews.js (lines 287-484)
Request payload: Query params: ?search=..., ?sort_by=..., ?page=...
Response payload: { "data": [ { ...requestRecord } ] }
Authentication: JWT Token Required
Permission: Kiểm tra exception_rules theo tên slice.
Business rules:
  - 'my-request': r.sr_creater = user OR r.requester = user.
  - 'my-approval': user nằm trong approval_flow bước đang chờ duyệt (status = 2).
  - 'my-task' / 'my-process-owner': user nằm trong mảng sr_owner và yêu cầu đã được duyệt (sr_status IN (3, 5)).
  - 'my-team': user là policy_lead và các bước duyệt trước đó đã hoàn tất.
Database tables: request, employee, my_company, policy_and_program
Frontend consumers: public/js/views/myViewsDashboard.js (loadDashboardView)
```

### 5.3 Request Activity Logs & Reports
```text
Method: GET
URL: /api/my-views/request-activity-log
URL: /api/my-views/request-activity-log/:id
Controller/route file: server/routes/myViews.js (lines 14-228)
Request query params: page, limit, search, table_name, month, year
Response payload: Danh sách nhật ký biến động dữ liệu toàn hệ thống từ bảng audit_logs.
Authentication: JWT Token Required
Permission: Admin / Super Admin
Database tables: audit_logs, request, payment, expense
Frontend consumers: #request_activity_log page
```

---

## 6. Organization Module (`/api/my-company`, `/api/departments`, `/api/employees`, `/api/companies`, `/api/contacts`)

```text
Endpoints:
  - GET/POST/PUT/DELETE /api/my-company
  - GET/POST/PUT/DELETE /api/departments
  - GET/POST/PUT/DELETE /api/employees
  - GET/POST/PUT/DELETE /api/companies
  - GET/POST/PUT/DELETE /api/contacts
Controller files: modules/organization/server/organization.controller.js
Service file: modules/organization/server/organization.service.js
Repository file: modules/organization/server/organization.repository.js
Authentication: JWT Token Required
Permission: Admin / HR / Super Admin
Database tables: my_company, department, employee, company, contact
Frontend consumers: Các trang Organization trong Sidebar.
```

---

## 7. System Setup, Automations & Infrastructure APIs

| Endpoint | Method | File Controller | Chức năng chính |
|---|---|---|---|
| `/api/system-status` | GET | `server/index.js:433` | Xem tình trạng CPU, RAM, dung lượng lưu trữ đĩa vật lý của tenant. |
| `/api/system-status/cleanup-logs` | POST | `server/index.js:443` | Truncate bảng `audit_logs` để giải phóng dung lượng đĩa khẩn cấp. |
| `/api/system-setup/status` | GET | `server/routes/systemSetup.js` | Kiểm tra trạng thái đã hoàn thành Setup Wizard chưa. |
| `/api/system-setup/lookups/:type` | GET | `server/routes/systemSetup.js` | Proxy danh mục quốc gia/tiền tệ/tỉnh thành từ CMS. |
| `/api/automations` | GET | `server/routes/automations.js` | Danh sách 6 trigger tự động hóa của hệ thống. |
| `/api/automations/:id/active` | PUT | `server/routes/automations.js` | Bật/Tắt một trigger tự động hóa trong `automation_registry`. |
| `/api/backup` | POST | `server/routes/backup.js` | Chạy lệnh `pg_dump` sao lưu database ra tệp cục bộ `.dump`. |
| `/api/backup/list` | GET | `server/routes/backup.js` | Xem danh sách các bản backup đã lưu trên đĩa. |
| `/api/backup/restore` | POST | `server/routes/backup.js` | Gọi lệnh `pg_restore` phục hồi database từ file dump đã chọn. |
| `/api/cms/tenant-sync` | POST | `server/routes/cmsSync.js` | Nhận webhook đồng bộ gói dịch vụ và tài khoản admin từ CMS trung tâm (HMAC SHA-256). |
| `/api/support/sync-incoming` | POST | `server/routes/support.js` | Nhận đồng bộ ticket và trao đổi từ Helpdesk trung tâm (HMAC SHA-256). |
| `/api/notifications` | GET | `modules/notification/server/` | Danh sách thông báo in-app của người dùng. |
| `/api/notifications/subscribe` | POST | `modules/notification/server/` | Lưu thông tin Web Push Subscription (`endpoint`, `keys`). |
| `/api/stream` | GET | `server/index.js:305` | Endpoint kết nối Server-Sent Events (SSE) realtime. |
| `/api/health` | GET | `server/index.js:321` | Liveness & Readiness probe cho Kubernetes. |
