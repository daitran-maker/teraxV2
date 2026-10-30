# 17 — MIGRATION CLASSIFICATION MATRIX

**Target Repository:** `D:\CPI\teraxV2`  
**Purpose:** Granular component-by-component migration classification for all frontend assets, backend services, database artifacts, and scripts preparing for TeraX V3.

---

## 1. Classification Categories Definition

- **`KEEP`**: Code, schema, or configuration retained with minimal to zero alterations.
- **`REUSE LOGIC`**: Preserve domain validation, business calculations, and status transitions, but rewrite using modern TypeScript, Clean Architecture, and type-safe ORM (Prisma / Drizzle).
- **`REWRITE UI`**: Preserve user workflows and interaction patterns, but rebuild the UI from scratch using the new Design System in `packages/ui` (React, Tailwind CSS, Headless UI).
- **`REFACTOR`**: Boundaries and architectural seams are incorrectly placed; decouple into proper domain services and interfaces.
- **`REPLACE`**: Discard custom or primitive implementation in favor of cloud-native or modern industry-standard platforms (e.g. S3 Object Storage, Redis Pub/Sub, Casbin).
- **`DEPRECATED`**: Zombie code, dead files, or obsolete tables that should be permanently dropped and excluded from V3.

---

## 2. Module & File Classification Matrix

### 2.1 Backend Modules & Services

| Module / Artifact | Path | Classification | Detailed Migration Rationale & V3 Treatment |
|---|---|---|---|
| **Auth Service** | `modules/auth/server/auth.service.js` | **REUSE LOGIC + REPLACE** | Retain bcrypt password hashing and Google SSO verification. Replace 365-day token with 15-min JWT + Redis refresh token rotation. Fix switch-user security flaw. |
| **Permissions Engine** | `modules/permissions/server/` | **REPLACE** | Replace ad-hoc 4-dimensional permission tables (`exception_rules`, `action_rules`, `column_permissions`, etc.) with a declarative policy engine (Casbin or OpenFGA). |
| **Dynamic Base CRUD** | `modules/base/server/base.service.js` | **REFACTOR** | Replace string-concatenated SQL queries and `::text ILIKE` with type-safe query builders (Prisma / Drizzle) with keyset pagination and full-text search. |
| **Organization (Employee & Dept)** | `modules/employee/`, `modules/department/` | **REUSE LOGIC** | Preserve reporting hierarchy and department ownership rules. Port to strict TypeScript domain models and clean service layers. |
| **Request & Approval Engine** | `modules/request/server/` | **REUSE LOGIC + REFACTOR** | Preserve multi-tier approval amount thresholds. Normalize `approval_flow` JSONB into relational tables (`workflows`, `workflow_steps`, `workflow_executions`). |
| **Payment (AP)** | `modules/payment/server/` | **REUSE LOGIC** | Retain disbursement states (30, 31, 32, 121) and contract balance verification. Re-implement in V3 Finance domain service. |
| **Invoice (AR)** | `modules/invoice/server/` | **REUSE LOGIC** | Retain VAT calculation, invoice issuance rules, and status lifecycle. Port to V3 Finance service. |
| **Contract Management** | `modules/contract/server/` | **REUSE LOGIC** | Retain expiration notifications and contract request syncing. Port to V3 Commercial domain. |
| **Asset Management** | `modules/asset/server/` | **REUSE LOGIC** | Retain asset transfer chain of custody, maintenance, and auditing flows. Port to V3 Fixed Asset service. |
| **Task Module** | `modules/task/server/` | **REFACTOR** | Decouple tasks from hardcoded request dependencies; turn into an enterprise universal task engine. |
| **Storage Service** | `modules/storage/server/` | **REPLACE** | Discard Multer local container disk storage (`public/uploads/`). Replace with AWS S3 / Cloudflare R2 presigned upload URLs. |
| **Realtime Notifications** | `modules/notifications/server/` | **REPLACE** | Discard in-process `clients` Map. Replace with Redis Pub/Sub backed Server-Sent Events / WebSockets. |
| **Background Scheduler** | `server/services/cron.js` | **REPLACE** | Replace in-process `node-cron` with distributed BullMQ job queues running on dedicated worker pods. |
| **Legacy Routes** | `server/routes/*.js` (8 unmounted files) | **DEPRECATED** | Dead code from early V2 monolith. Delete completely; do not migrate. |
| **Expense Table/Service** | `expense` table / legacy references | **DEPRECATED** | Obsolete expense schema superseded by `payment` and `request_items`. Exclude from V3 migration. |
| **Database Cron Table** | `cron_jobs` table | **DEPRECATED** | Database table unused by runtime scheduler. Exclude from V3 schema. |

---

### 2.2 Frontend & UI Assets

| Component / File | Path | Classification | Detailed Migration Rationale & V3 Treatment |
|---|---|---|---|
| **Global Stylesheet** | `public/style.css` (7,255 lines) | **REPLACE** | Completely discard. Rebuild atomic design tokens and components in `packages/ui` using Tailwind CSS and CSS Variables. |
| **App Shell & Layout** | `public/index.html`, `public/js/layout.js` | **REWRITE UI** | Rebuild sidebar, topbar, tab router, and breadcrumbs as modern React layout components. |
| **Universal Grid Component** | `public/js/components/grid.js` | **REWRITE UI** | Rebuild as a high-performance Data Grid component (TanStack Table + virtualized rows). |
| **Dynamic Form Modal** | `public/js/components/modal.js` | **REWRITE UI** | Rebuild using React Hook Form + Zod schema validation and accessible Radix UI dialog primitives. |
| **Request Management UI** | `public/views/request/` (or dynamic tabs) | **REWRITE UI** | Build modern request creation wizard, interactive approval timeline, and line-item spreadsheet editor. |
| **Payment & Invoice UI** | Financial views | **REWRITE UI** | Build unified Finance Ledger with bank account auto-complete and PDF invoice viewer. |
| **Duplicate Configs** | `public/js/config/modules/*.js` | **DEPRECATED** | Delete redundant copies; keep single source of truth in TypeScript configuration objects. |
| **Login View** | `public/login.html` | **REWRITE UI** | Rebuild with modern responsive card layout, Google OAuth button, and field-level validation. |

---

### 2.3 Database Schema & Triggers

| Database Entity | Type | Classification | Detailed Migration Rationale & V3 Treatment |
|---|---|---|---|
| **Core Tables (`employee`, `department`, `company`)** | Table | **KEEP + REFACTOR** | Keep schema structure. Add strict DBMS foreign key constraints (`REFERENCES department(id)`). |
| **Triggers (`trg_request_submit_status`, etc.)** | Trigger | **REPLACE** | Deprecate database triggers in favor of explicit domain event handlers in backend application code. |
| **Audit Logs Trigger** | Trigger | **KEEP** | Retain PostgreSQL CDC/audit log trigger as an immutable database-level fallback for compliance. |
| **Views (`v_department`, `v_finance`)** | View | **REFACTOR** | Replace raw SQL database views with optimized query methods in repository layer. |
