# 02 — REPOSITORY & DIRECTORY MAP AUDIT

> **Scope:** Clean Repository Tree, File Size Metrics, Modular Structure & Code Inventory  
> **Source Directory:** `D:\CPI\teraxV2`  
> **Target Migration Destination:** `D:\CPI\teraxV3`

---

## 1. Clean Repository Directory Tree

Dưới đây là cấu trúc cây thư mục sạch của repository TeraX V2 (đã loại bỏ `node_modules`, `.git`, temporary artifacts):

```text
D:\CPI\teraxV2/
├── .agents/                                # AI Agent Skills & rules
│   └── skills/
├── .clinerules/
├── .dockerignore
├── .env.example                            # Biến môi trường mẫu
├── .gitignore
├── .kilo/
├── CRC_AGENT_GUIDELINES.md                 # Nguyên tắc an toàn & bảo toàn DB
├── Dockerfile                              # Node 20 Alpine + PM2 Cluster -i 2
├── README.md                               # Hướng dẫn cài đặt & vận hành
├── VIBE_CODING_RULES.md                    # Quy tắc bảo toàn máy trạng thái & no-flashing
├── db_design.json                          # JSON schema metadata của 47 bảng
├── deploy.sh                               # Shell script deploy
├── docker-compose.standalone.yml           # Docker standalone (internal Postgres)
├── docker-compose.yml                      # Docker compose chuẩn
├── init.sql                                # DDL toàn bộ 47 bảng + Trigger + Functions
├── k8s-dev-cms.yaml                        # Manifest K8s môi trường dev + CMS
├── k8s-dev2.yaml                           # Manifest K8s instance dev2
├── k8s-helpdesk.yaml                       # Manifest K8s Helpdesk service
├── k8s-manifest.yaml                       # Manifest K8s chính thức (App + Cloudflared + Dozzle)
├── package.json                            # Khai báo dependency chính
├── pnpm-workspace.yaml                     # Cấu trúc workspace monorepo
├── schema.dbml                             # Sơ đồ quan hệ DBML xuất từ database
├── setup.ps1                               # Script setup cho Windows PowerShell
├── setup.sh                                # Script setup cho Linux/macOS
├── skills-lock.json
├── task_user.md                            # Ghi chú nhiệm vụ
│
├── docs/                                   # Tài liệu kỹ thuật dự án
│   ├── SO_SANH_DAITRAN_VS_LOANANH.md
│   ├── action_creation_guide.md            # Hướng dẫn tạo action rules mới
│   ├── action_implementation_plan_RQC_0206.md
│   ├── action_rules_report.html            # Báo cáo visual danh sách action rules
│   ├── design template.html
│   ├── multi_tenant_deployment.md          # Tài liệu kiến trúc Multi-tenant
│   ├── payment_gateway_guide.md            # Tài liệu cổng thanh toán
│   ├── skill_view.md
│   ├── skill_view_dashboard2.md
│   ├── skill_view_detail2.md
│   ├── test_cases/
│   ├── vps_security_and_tenant_demo_guide.md
│   └── v3-migration-audit/                 # [MỤC TIÊU TASK HIỆN TẠI] Báo cáo audit
│
├── migrations/                             # Migration SQL gia tăng theo thời gian
│   ├── 006_dual_auth_employee_id.sql
│   ├── 007_rename_independent_id_to_password.sql
│   ├── 2026-04-10_audit_logs_utc7.sql
│   ├── 2026-07-27_dashboard_notification_enhancements.sql
│   ├── 2026-07-27_migrate_identity_to_employee_id.sql
│   ├── 2026-07-27_patch_data_email_to_empid.sql
│   ├── 2026-07-28_create_uploaded_files.sql
│   ├── 2026-07-28_migrate_identity_to_employee_id_fixed.sql
│   ├── 2026-07-28_patch_department_manager.sql
│   ├── 2026-08-01_request_submit_status_trigger.sql
│   ├── 2026-08-12_add_id_request_to_account.sql
│   └── 2026-09-18_utc0_standardization.sql
│
├── modules/                                # [MODULAR MONOLITH CORE] 15 Domain Modules
│   ├── asset/                              # Quản lý tài sản
│   │   ├── client/asset.config.js
│   │   └── server/{asset.handler.js, asset.repository.js, asset.service.js, index.js}
│   ├── contract/                           # Quản lý hợp đồng
│   │   ├── client/contract.config.js
│   │   └── server/{contract.handler.js, contract.repository.js, contract.service.js, index.js}
│   ├── expense/                            # Quản lý chi phí
│   │   ├── client/expense.config.js
│   │   └── server/{expense.handler.js, expense.repository.js, expense.service.js, index.js}
│   ├── finance/                            # Quản lý MTR, tài khoản, đối soát
│   │   ├── client/finance.config.js
│   │   └── server/{finance.handler.js, finance.repository.js, finance.service.js, index.js}
│   ├── identity/                           # Xác thực, JWT, RBAC
│   │   └── server/{identity.controller.js, identity.middleware.js, identity.repository.js, identity.service.js, index.js}
│   ├── invoice/                            # Quản lý hóa đơn VAT
│   │   ├── client/invoice.config.js
│   │   └── server/{invoice.handler.js, invoice.repository.js, invoice.service.js, index.js}
│   ├── notification/                       # Thông báo & Web Push
│   │   └── server/{notification.controller.js, notification.repository.js, notification.service.js, index.js}
│   ├── organization/                       # Doanh nghiệp, phòng ban, nhân viên, liên hệ
│   │   ├── client/organization.config.js
│   │   └── server/{organization.controller.js, organization.repository.js, organization.service.js, index.js}
│   ├── payment/                            # Quản lý thanh toán
│   │   ├── client/payment.config.js
│   │   └── server/{payment.handler.js, payment.repository.js, payment.service.js, index.js}
│   ├── request/                            # Trung tâm yêu cầu (Request Center - SR)
│   │   ├── client/request.config.js
│   │   └── server/{request.handler.js, request.repository.js, request.service.js, index.js}
│   ├── service/                            # Quản lý dịch vụ thuê ngoài & gia hạn
│   │   ├── client/service.config.js
│   │   └── server/{service.handler.js, service.repository.js, service.service.js, index.js}
│   ├── support/                            # Helpdesk & hỗ trợ khách hàng
│   │   └── client/support.config.js
│   ├── system/                             # Cấu hình hệ thống, policy, permissions
│   │   └── client/system.config.js
│   ├── target_table/                       # Bảng chỉ tiêu KPI doanh số
│   │   ├── client/target_table.config.js
│   │   └── server/{target_table.handler.js, target_table.repository.js, target_table.service.js, index.js}
│   └── workflow/                           # Quy tắc luồng duyệt chung
│       └── server/{workflow.rules.js, workflow.service.js, index.js}
│
├── public/                                 # Giao diện người dùng Frontend (Static SPA)
│   ├── access-denied.html                  # Màn hình từ chối truy cập 403
│   ├── actions_doc.html                    # Trang tài liệu & demo các action rules (174KB)
│   ├── app.js                              # Bootstrap & điều phối chính của ứng dụng
│   ├── config.js                           # Cấu hình gộp các module frontend
│   ├── dashboard.js                        # Xử lý widget & biểu đồ dashboard
│   ├── i18n.js                             # Xử lý đa ngôn ngữ (vi, en, km, zh, my)
│   ├── index.html                          # Shell HTML chính của ứng dụng SPA (41KB)
│   ├── login.html                          # Trang đăng nhập mật khẩu & Google SSO (15KB)
│   ├── notifications.js                    # UI hiển thị dropdown & danh sách thông báo
│   ├── style.css                           # Toàn bộ mã định kiểu CSS (191KB, ~7,255 dòng)
│   ├── sw.js                               # Service Worker cho PWA & Web Push
│   ├── assets/                             # Logo, icon, ảnh minh họa
│   ├── locales/                            # 5 file từ điển JSON (vi, en, km, zh, my)
│   └── js/                                 # Mã nguồn JavaScript frontend đã tách module
│       ├── components/
│       │   ├── inlineComments.js           # Bình luận đính kèm trong chi tiết bản ghi
│       │   ├── searchableDropdown.js       # Dropdown tìm kiếm thông minh
│       │   ├── toast.js                    # Thông báo popup toast
│       │   └── userSwitcher.js             # Widget chuyển nhanh user test trên topbar
│       ├── config/
│       │   ├── enums.js                    # Enum trạng thái, năm tài chính, loại chi phí
│       │   └── modules/                    # [BẢN SAO TRÙNG LẶP] 12 file config nhân bản từ modules/
│       ├── core/
│       │   ├── api.js                      # HTTP client bọc fetch với auth token
│       │   ├── tabRouter.js                # Router đa tab giữ trạng thái DOM (30KB)
│       │   ├── uiHelpers.js                # Hàm format tiền tệ, ngày tháng, escape HTML
│       │   └── utils.js                    # Hàm tiện ích dùng chung
│       ├── services/
│       │   ├── bulkActionService.js        # Thao tác hàng loạt trên nhiều bản ghi
│       │   ├── deleteService.js            # Xóa đơn lẻ và xóa hàng loạt
│       │   ├── exportService.js            # Xuất dữ liệu ra Excel (SheetJS)
│       │   ├── lookupService.js            # Cache và nạp danh mục dropdown
│       │   ├── permissionService.js        # Kiểm tra quyền client-side
│       │   ├── recordPolicyService.js      # Áp dụng chính sách theo từng bản ghi
│       │   └── syncService.js              # Nhận diện thay đổi và đồng bộ cache
│       └── views/
│           ├── automationView.js           # Xem danh sách và log trigger tự động hóa
│           ├── childTableView.js           # Render bảng con lồng trong tab chi tiết
│           ├── detailView.js               # Render màn hình chi tiết bản ghi
│           ├── fieldHandlers.js            # Sự kiện thay đổi trường dữ liệu động
│           ├── financeSummary.js           # Tab tổng kết tài chính & dòng tiền
│           ├── formModal.js                # Modal slide-over tạo mới & chỉnh sửa bản ghi
│           ├── kanbanView.js               # Giao diện Kanban cho công việc (assigned_task)
│           ├── myViewsDashboard.js         # Giao diện 4 lát cắt (My Request, Approval, Task, Team)
│           ├── setupWizard.js              # Wizard khởi tạo hệ thống lần đầu
│           └── tableView.js                # Render bảng danh sách, tìm kiếm, phân trang
│
├── scripts/                                # Công cụ vận hành, di chuyển dữ liệu, triển khai
│   ├── add_tenant.sh                       # Khởi tạo tenant mới
│   ├── clone_apps.sh                       # Nhân bản ứng dụng
│   ├── copy_settings_to_clones.sh
│   ├── correct_databases.js
│   ├── deploy_clones.sh
│   ├── deploy_tenant_app.sh
│   ├── export_db_schema.js
│   ├── generate_dbml.js                    # Xuất schema DBML từ database sống
│   ├── loadtest_dashboard.js               # Kịch bản kiểm thử tải dashboard (95KB)
│   ├── migrate_clones_db.js
│   ├── migrate_numeric_ids.js
│   ├── migrate_payment_draft.js
│   ├── query_request_details.js
│   ├── restore_data.js
│   ├── restore_full_crc_data.js
│   ├── revert_numeric_ids.js
│   ├── rollout_006_dual_auth.sh
│   ├── rollout_007_rename_password.sh
│   ├── run_unified_migration.js
│   ├── seed_support_permission.js
│   ├── set_default_passwords.sh
│   ├── switch_terax_to_standalone_dbs.sh
│   ├── sync_all_apps.js
│   ├── sync_to_helpdesk.js
│   ├── test_migration_error.js
│   ├── update_backend.js
│   ├── update_frontend.js
│   ├── db/
│   ├── deploy/
│   ├── import/
│   ├── seed/
│   └── test_automation/
│
└── server/                                 # Backend Server Core
    ├── apply_triggers.sql                  # Script gắn trigger audit log vào các bảng
    ├── create_audit_logs.sql               # Script tạo cấu trúc bảng audit_logs
    ├── cron.js                             # Cron job hàng ngày lúc 00:00
    ├── db.js                               # [GOD FILE] Connection pool + Embedded DDL migrations (194KB)
    ├── index.js                            # Express Server Entry Point (19KB)
    ├── seed_complete.js                    # Script seed dữ liệu mẫu hoàn chỉnh
    ├── core/
    │   ├── events.js                       # Node.js EventEmitter (EventBus nội bộ)
    │   ├── queryBuilder.js                 # Query builder động cho dynamic CRUD
    │   └── tableRegistry.js                # Đăng ký handler xử lý theo từng bảng
    ├── helpers/
    │   ├── auditHelper.js                  # Truy vấn lịch sử thay đổi của bản ghi
    │   ├── automationHelper.js             # Quản lý định nghĩa và log automations
    │   ├── backupCron.js                   # Cron job xoay vòng và dọn dẹp backup lúc 01:00
    │   ├── cmsSeats.js                     # Gửi thông tin user active sang CMS
    │   ├── fileStorageHelper.js            # RLS truy cập tệp và upload base64
    │   ├── hashidHelper.js                 # Mã hóa / giải mã ID số thành chuỗi băm
    │   ├── hashidMiddleware.js             # Middleware tự động decode ID trong request
    │   ├── idGenerator.js                  # Sinh mã ID tuần tự (SR-..., PAY-..., INV-...)
    │   ├── notificationHelper.js           # Bắn thông báo SSE và Push Notifications
    │   ├── permissionHelper.js             # Thuật toán so khớp quyền 4 chiều
    │   ├── sseHelper.js                    # Quản lý kết nối SSE clients và heartbeat
    │   ├── statuses.js                     # Ánh xạ từ điển mã trạng thái số <-> chuỗi (20KB)
    │   ├── systemStatus.js                 # Tính toán dung lượng đĩa và trạng thái hệ thống
    │   └── validation.js                   # Ràng buộc kiểm tra kiểu dữ liệu bảng
    ├── models/
    │   ├── requestModel.js                 # Logic truy vấn và phân giải cấp duyệt (Tier 1-3)
    │   └── ticketModel.js                  # Logic truy vấn hỗ trợ kỹ thuật Helpdesk
    ├── modules/                            # [PROXY WRAPPERS] Re-export từ root modules/
    │   ├── asset/index.js                  # module.exports = require('../../../modules/asset/server')
    │   ├── contract/index.js
    │   ├── expense/index.js
    │   ├── finance/index.js
    │   ├── identity/index.js
    │   ├── invoice/index.js
    │   ├── notification/index.js
    │   ├── organization/index.js
    │   ├── payment/index.js
    │   ├── request/index.js
    │   ├── service/index.js
    │   ├── target_table/index.js
    │   └── workflow/index.js
    └── routes/                             # Express Routers
        ├── actions.js                      # [GOD FILE] Workflow Execution Engine (121KB)
        ├── automations.js                  # Quản lý bật/tắt trigger tự động hóa
        ├── backup.js                       # Gọi pg_dump / pg_restore sao lưu DB
        ├── cmsLookups.js                   # Kết nối DB ngoài lấy quốc gia/tiền tệ/tỉnh thành
        ├── cmsSync.js                      # Endpoint nhận đồng bộ từ CMS (HMAC SHA-256)
        ├── dynamic_crud.js                 # [GOD FILE] Router CRUD động cho 20+ bảng (269KB)
        ├── myViews.js                      # 4 lát cắt (My Request, Approval, Task, Team) & Báo cáo
        ├── policy.js                       # Quản lý chính sách & quy trình duyệt
        ├── schema.js                       # Trả về metadata cột của bảng
        ├── support.js                      # Đồng bộ 2 chiều với hệ thống Helpdesk
        ├── systemSetup.js                  # Wizard thiết lập hệ thống lần đầu
        ├── auth.js                         # [UNMOUNTED / DEAD CODE] Đã chuyển sang modules/identity
        ├── company.js                      # [UNMOUNTED / DEAD CODE] Đã chuyển sang modules/organization
        ├── contact.js                      # [UNMOUNTED / DEAD CODE] Đã chuyển sang modules/organization
        ├── department.js                   # [UNMOUNTED / DEAD CODE] Đã chuyển sang modules/organization
        ├── employee.js                     # [UNMOUNTED / DEAD CODE] Đã chuyển sang modules/organization
        ├── myCompany.js                    # [UNMOUNTED / DEAD CODE] Đã chuyển sang modules/organization
        ├── notifications.js                # [UNMOUNTED / DEAD CODE] Đã chuyển sang modules/notification
        └── permissions.js                  # [UNMOUNTED / DEAD CODE] Đã chuyển sang modules/identity
```

---

## 2. File Size & Complexity Metrics

Các tệp có quy mô lớn nhất hệ thống tập trung toàn bộ trọng tâm kỹ thuật:

| Tệp | Dung lượng | Số dòng code | Bản chất & Đánh giá |
|---|---|---|---|
| [`server/routes/dynamic_crud.js`](file:///d:/CPI/teraxV2/server/routes/dynamic_crud.js) | **269 KB** | **5,526 dòng** | Bộ xử lý CRUD tổng quát, chứa hàng trăm câu query động, subquery phân quyền, cache in-memory, xử lý file base64. |
| [`public/style.css`](file:///d:/CPI/teraxV2/public/style.css) | **192 KB** | **7,255 dòng** | Toàn bộ CSS của toàn hệ thống, chứa biến theme, card, modal, bảng, kanban, hàng chục media query chồng chéo. |
| [`server/db.js`](file:///d:/CPI/teraxV2/server/db.js) | **195 KB** | **3,662 dòng** | Vừa là Connection Pool vừa là Migration Runner tự chế thực thi DDL khi khởi động server. |
| [`public/actions_doc.html`](file:///d:/CPI/teraxV2/public/actions_doc.html) | **175 KB** | **1,520 dòng** | File tài liệu và giao diện test độc lập danh sách action rules. |
| [`server/routes/actions.js`](file:///d:/CPI/teraxV2/server/routes/actions.js) | **121 KB** | **2,506 dòng** | Máy thực thi quy trình phê duyệt, chuyển trạng thái, sinh task, sinh hóa đơn, đối soát ngân hàng. |
| [`init.sql`](file:///d:/CPI/teraxV2/init.sql) | **116 KB** | **3,210 dòng** | File DDL gốc khởi tạo 47 bảng, hàm PL/pgSQL và trigger. |
| [`scripts/loadtest_dashboard.js`](file:///d:/CPI/teraxV2/scripts/loadtest_dashboard.js) | **96 KB** | **2,150 dòng** | Script giả lập tải truy cập vào các widget dashboard. |
| [`server/routes/systemSetup.js`](file:///d:/CPI/teraxV2/server/routes/systemSetup.js) | **49 KB** | **1,092 dòng** | API phục vụ Onboarding Wizard. |
| [`public/index.html`](file:///d:/CPI/teraxV2/public/index.html) | **41 KB** | **667 dòng** | Shell SPA chính chứa toàn bộ HTML markup của sidebar, topbar, modals và toast containers. |
| [`public/js/core/tabRouter.js`](file:///d:/CPI/teraxV2/public/js/core/tabRouter.js) | **31 KB** | **787 dòng** | Trình quản lý hash routing và đa tab DOM. |

---

## 3. Kiến Trúc "Nửa Vời" Giữa Legacy Router và Modular Monolith

Codebase phản ánh rõ nét một giai đoạn tái cấu trúc đang dang dở:
1. **Gốc rễ ban đầu (Monolith):** Mọi router nằm trực tiếp tại `server/routes/*.js`.
2. **Giai đoạn tái cấu trúc (Modular Extraction):** Đội ngũ phát triển tạo thư mục `modules/` ở root dự án và chia thành các domain (`identity`, `organization`, `request`, `payment`, `invoice`, `finance`, `contract`, `asset`, `service`, `target_table`, `workflow`).
3. **Hiện trạng tích hợp tại `server/index.js`:**
   - Đã chuyển hướng các router chính:
     ```javascript
     app.use('/api/auth', identityModule.authRouter);
     app.use('/api/my-company', organizationModule.myCompanyRouter);
     app.use('/api/departments', organizationModule.departmentRouter);
     app.use('/api/employees', organizationModule.employeeRouter);
     app.use('/api/companies', organizationModule.companyRouter);
     app.use('/api/contacts', organizationModule.contactRouter);
     app.use('/api/permissions', identityModule.permissionsRouter);
     app.use('/api/notifications', require('./modules/notification').router);
     ```
   - **Tuy nhiên, các tệp route cũ trong `server/routes/` vẫn tồn tại nguyên vẹn** và không được xóa hay dọn dẹp, tạo ra sự hoang mang lớn cho lập trình viên mới.
   - Các tệp trong `server/modules/` chỉ đóng vai trò là shim proxy: `module.exports = require('../../../modules/.../server')`.
   - File cấu hình client ở `modules/<domain>/client/<domain>.config.js` bị copy-paste song song sang `public/js/config/modules/<domain>.config.js` mà không hề được dọn dẹp.

---

## 4. Kế Hoạch Đóng Gói Sang V3

Toàn bộ kiến trúc lộn xộn này sẽ được chuẩn hóa sang cấu trúc Monorepo tiêu chuẩn tại `teraxV3`:
- `apps/web`: Ứng dụng Frontend (React / Next.js).
- `apps/api`: Backend API Server (NestJS / Fastify).
- `packages/database`: Quản lý schema, migrations (Drizzle ORM / Prisma).
- `packages/ui`: Thư viện Design System (Button, Input, Table, Modal, Drawer, Tabs).
- `packages/shared`: Kiểu dữ liệu TypeScript, Zod schemas và constants dùng chung cả 2 đầu.
