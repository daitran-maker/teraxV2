# 21 — ACTIVE RUNTIME & ROUTE MOUNT VERIFICATION

**Target Repository:** `D:\CPI\teraxV2`  
**Execution Context:** Verification against active application entrypoint (`server/index.js`) and frontend call sites in `public/`.  
**Status:** 100% VERIFIED FROM RUNTIME & SOURCE CODE.

---

## 1. Application Entrypoint & Middleware Pipeline

The actual production application entrypoint is **`server/index.js`** (declared in `package.json`: `"main": "server/index.js"`, `"start": "node server/index.js"`).

```mermaid
flowchart TD
    Index[server/index.js Entrypoint] --> CoreInit[1. Core Events & Table Registry]
    CoreInit --> SvcProxy[2. Helpdesk Transparent Reverse Proxy]
    SvcProxy --> SecMiddleware[3. Compression, CORS, HashID, RateLimiter]
    SecMiddleware --> StaticServe[4. express.static: /public & /modules]
    StaticServe --> PublicRoutes[5. Public API: /api/auth/login, /api/auth, /api/upload-*, /api/stream, /api/brand-info, /api/cms, /api/health]
    PublicRoutes --> AuthGuard[6. Global JWT Guard: app.use('/api', identityModule.authenticate)]
    AuthGuard --> ProtectedRoutes[7. Protected Routers: /api/table, /api/actions, /api/my-views, /api/departments, /api/employees, etc.]
    ProtectedRoutes --> Fallback[8. SPA Fallback: GET * -> public/index.html]
```

---

## 2. Route & Controller Mount Classification

### 2.1 Active Mounted Routers (CANONICAL_V2)

All active business endpoints are mounted in [server/index.js](file:///d:/CPI/teraxV2/server/index.js#L127-L471):

| Route Path | Mounted Handler File | Underlying Implementation | Classification | Description / Purpose |
|---|---|---|---|---|
| `/api/auth/login` | Rate Limiter | `express-rate-limit` (15 req / 15 min) | **ACTIVE** | Brute force protection on login |
| `/api/auth` | `server/modules/identity/auth.router.js` | `server/modules/identity/auth.controller.js` | **ACTIVE** | Login, Google SSO, Me, Switch User |
| `/api/upload-file` | Inline Controller in `server/index.js:167` | Base64 disk writer + quota check | **ACTIVE** | Pre-upload for large attachments |
| `/api/upload-binary` | Inline Controller in `server/index.js:219` | Raw stream writer to `public/uploads/` | **ACTIVE** | Binary streaming upload |
| `/api/upload-chunk` | Inline Controller in `server/index.js:257` | Chunked file appender | **ACTIVE** | Upload bypassing 1MB proxy limit |
| `/api/stream` | Inline Controller in `server/index.js:305` | `server/helpers/sseHelper.js` | **ACTIVE** | Protected Server-Sent Events stream |
| `/api/cms` | `server/routes/cmsSync.js` | `server/routes/cmsSync.js` | **ACTIVE** | Inbound tenant sync from `cms_terax` |
| `/api/support` | `server/routes/support.js` | `server/routes/support.js` | **ACTIVE** | Standalone helpdesk proxy helper |
| `/api/health` | Inline Controller in `server/index.js:321` | Health probe | **ACTIVE** | K8s liveness/readiness check |
| `/api/brand-info` | Inline Controller in `server/index.js:326` | Query `cms_tenant_info` / `my_company` | **ACTIVE** | Multi-tenant branding / logo metadata |
| `/api/system-status` | Inline Controller in `server/index.js:433` | `server/helpers/systemStatus.js` | **ACTIVE** | System health, memory, disk usage |
| `/api/files/download/:id/:filename` | `server/helpers/fileStorageHelper.js` | Local file streaming | **ACTIVE** | Download attachment / uploaded file |
| `/api/system-setup` | `server/routes/systemSetup.js` | System configuration manager | **ACTIVE** | System wizard & environment configs |
| `/api/my-company` | `server/modules/organization/` | `myCompany.router.js` | **ACTIVE** | Internal tenant organization profile |
| `/api/departments` | `server/modules/organization/` | `department.router.js` | **ACTIVE** | Department tree & budget management |
| `/api/employees` | `server/modules/organization/` | `employee.router.js` | **ACTIVE** | Employee directory & accounts |
| `/api/companies` | `server/modules/organization/` | `company.router.js` | **ACTIVE** | Client, Vendor, Partner directory |
| `/api/contacts` | `server/modules/organization/` | `contact.router.js` | **ACTIVE** | Corporate contacts directory |
| `/api/policies` | `server/routes/policy.js` | `server/routes/policy.js` | **ACTIVE** | Policy & request approval templates |
| `/api/permissions` | `server/modules/identity/` | `permissions.router.js` | **ACTIVE** | 4D permission engine matrix |
| `/api/schema` | `server/routes/schema.js` | `server/routes/schema.js` | **ACTIVE** | Dynamic table schema introspection |
| `/api/cms-lookups` | `server/routes/cmsLookups.js` | `server/routes/cmsLookups.js` | **ACTIVE** | Lookup proxy to `cms_terax` |
| **`/api/table`** | **`server/routes/dynamic_crud.js`** | **Dynamic Table Router (5,526 lines)** | **CANONICAL_V2** | **The true Universal Data Engine** |
| **`/api/actions`** | **`server/routes/actions.js`** | **Action Execution Engine (2,506 lines)** | **ACTIVE** | **Workflow action execution & guards** |
| **`/api/my-views`** | **`server/routes/myViews.js`** | **Custom Filtered View Aggregator** | **ACTIVE** | Personal request / task / approval queues |
| `/api/notifications` | `server/modules/notification/` | `notification.router.js` | **ACTIVE** | In-app alerts & web push |
| `/api/backup` | `server/routes/backup.js` | PostgreSQL pg_dump runner | **ACTIVE** | Manual / automated backup endpoints |
| `/api/automations` | `server/routes/automations.js` | System trigger automations | **ACTIVE** | Background automation manager |

---

### 2.2 Critical Reality Finding: `/api/table` vs `/api/base`

> [!IMPORTANT]
> **`/api/base` DOES NOT EXIST IN THE CODEBASE.**
>
> In the preliminary audit documents, `/api/base/:module` was referenced based on an assumed generic architecture pattern.
> 
> **Actual Runtime Reality:**
> 1. `server/index.js` mounts:
>    ```javascript
>    app.use('/api/table', require('./routes/dynamic_crud'));
>    ```
> 2. The universal HTTP client in [public/js/core/api.js](file:///d:/CPI/teraxV2/public/js/core/api.js#L7) sets:
>    ```javascript
>    const API_BASE = '/api';
>    ```
> 3. Frontend module configurations (`request.config.js`, `payment.config.js`, `invoice.config.js`, `contract.config.js`, `finance.config.js`, `asset.config.js`) define:
>    ```javascript
>    endpoint: '/table/request'
>    endpoint: '/table/payment'
>    endpoint: '/table/invoice'
>    endpoint: '/table/contract'
>    endpoint: '/table/mtr'
>    ```
> 4. When concatenated: `API_BASE + endpoint` $\rightarrow$ **`/api/table/request`**, **`/api/table/payment`**, etc.
> 
> **Verification Status:**
> - `/api/base`: **LEGACY_FICTION** (Never existed in codebase).
> - `/api/table/:tableName`: **CANONICAL_V2** (100% active production dynamic CRUD API).

---

### 2.3 Unmounted Legacy Files in `server/routes/`

The following 8 files in `server/routes/` are **completely unmounted** in `server/index.js`:

| File Path | Status | Replaced By / Active Equivalent | Action for V3 |
|---|---|---|---|
| `server/routes/auth.js` | **LEGACY / DEAD** | `server/modules/identity/auth.router.js` | DO NOT MIGRATE (Discard) |
| `server/routes/company.js` | **LEGACY / DEAD** | `server/modules/organization/company.router.js` | DO NOT MIGRATE (Discard) |
| `server/routes/contact.js` | **LEGACY / DEAD** | `server/modules/organization/contact.router.js` | DO NOT MIGRATE (Discard) |
| `server/routes/department.js` | **LEGACY / DEAD** | `server/modules/organization/department.router.js` | DO NOT MIGRATE (Discard) |
| `server/routes/employee.js` | **LEGACY / DEAD** | `server/modules/organization/employee.router.js` | DO NOT MIGRATE (Discard) |
| `server/routes/myCompany.js` | **LEGACY / DEAD** | `server/modules/organization/myCompany.router.js` | DO NOT MIGRATE (Discard) |
| `server/routes/notifications.js` | **LEGACY / DEAD** | `server/modules/notification/notification.router.js` | DO NOT MIGRATE (Discard) |
| `server/routes/permissions.js` | **LEGACY / DEAD** | `server/modules/identity/permissions.router.js` | DO NOT MIGRATE (Discard) |

---

### 2.4 Duplicate Architecture: `server/modules/` vs `modules/*/server/`

- `server/index.js` imports exclusively from `server/modules/`:
  - `require('./modules/identity')`
  - `require('./modules/organization')`
  - `require('./modules/notification')`
- `server/routes/dynamic_crud.js` imports handlers via `require('../modules/request')`, which resolves to `server/modules/request`.
- The root `modules/*/server/` directory contains mirrored copies created during an incomplete modular refactoring.
- **Classification:** `server/modules/` is **ACTIVE**; root `modules/*/server/` is **DUPLICATE**.

---

## 3. Frontend-to-Backend Runtime API Call Mapping

Every call executed by the frontend passes through `public/js/core/api.js`:

| Frontend File & Line | Invocation Pattern | Resolved HTTP URL | Method | Active Backend Handler |
|---|---|---|---|---|
| `public/login.html:456` | `fetch('/api/auth/login', ...)` | `/api/auth/login` | POST | `server/modules/identity/auth.controller.js#login` |
| `public/login.html:404` | `fetch('/api/public/brand-info')` | `/api/brand-info` | GET | `server/index.js:326` |
| `public/js/core/tabRouter.js:747` | `apiGet('/table/cms_tenant_info')` | `/api/table/cms_tenant_info` | GET | `server/routes/dynamic_crud.js` |
| `public/js/views/tableView.js` | `apiGet(mod.endpoint + '?page=...')` | `/api/table/:tableName` | GET | `server/routes/dynamic_crud.js` (Universal Grid Query) |
| `public/js/views/detailView.js` | `apiGet('/table/request/:id?pk=request_id')` | `/api/table/request/:id` | GET | `server/routes/dynamic_crud.js` (Detail Query) |
| `public/js/views/formModal.js` | `apiPost('/table/:tableName', data)` | `/api/table/:tableName` | POST | `server/routes/dynamic_crud.js` (Record Creation) |
| `public/js/views/formModal.js` | `apiPut('/table/:tableName/:id', data)` | `/api/table/:tableName/:id` | PUT | `server/routes/dynamic_crud.js` (Record Update) |
| `public/js/services/deleteService.js` | `apiDelete('/table/:tableName/:id')` | `/api/table/:tableName/:id` | DELETE | `server/routes/dynamic_crud.js` (Soft Delete) |
| `public/js/services/deleteService.js` | `apiPost('/table/:tableName/:id/restore')` | `/api/table/:tableName/:id/restore` | POST | `server/routes/dynamic_crud.js` (Restore Soft Deleted) |
| `public/js/components/actionToolbar.js` | `apiGet('/actions/:table/:id')` | `/api/actions/:table/:id` | GET | `server/routes/actions.js` (Evaluate Visible Actions) |
| `public/js/components/actionToolbar.js` | `apiPost('/actions/execute', payload)` | `/api/actions/execute` | POST | `server/routes/actions.js` (Execute Workflow Action) |
| `public/js/views/myViews.js` | `apiGet('/my-views/:viewName')` | `/api/my-views/:viewName` | GET | `server/routes/myViews.js` (Personal Queues) |
| `public/js/services/permissionService.js` | `apiGet('/permissions/user-permissions')` | `/api/permissions/user-permissions` | GET | `server/modules/identity/permissions.controller.js` |
| `public/js/services/syncService.js:74` | `new EventSource('/api/stream?token=...')` | `/api/stream` | GET | `server/index.js:305` $\rightarrow$ `server/helpers/sseHelper.js` |
| `public/js/components/inlineComments.js`| `apiPost('/table/comment', ...)` | `/api/table/comment` | POST | `server/routes/dynamic_crud.js` |
| `public/js/views/financeSummary.js:24` | `apiGet('/table/finance/request-summary/:id')`| `/api/table/finance/request-summary/:id` | GET | `server/routes/dynamic_crud.js` (Finance Rollup) |

---

## 4. Frontend Storage Keys Verification

| Storage Key | Storage Mechanism | Actual Value Stored | Purpose & Usage |
|---|---|---|---|
| `crc_token` | `localStorage` | JWT Token String | Attached to every HTTP call as `Authorization: Bearer <crc_token>` |
| `crc_user` | `localStorage` | Serialized JSON Object | User profile: `{ employee_id, username, full_name, email, role, department_id }` |
| `crc_lang` | `localStorage` | String (`vi` or `en`) | Multi-language preference attached to `Accept-Language` header |
| `crc_theme` | `localStorage` | String (`dark` or `light`) | UI color theme preference |
