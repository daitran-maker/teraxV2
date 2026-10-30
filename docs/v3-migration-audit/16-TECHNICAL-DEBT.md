# 16 — TECHNICAL DEBT & ENVIRONMENT AUDIT

**Target Repository:** `D:\CPI\teraxV2`  
**Purpose:** Comprehensive inventory of architectural anti-patterns, security liabilities, dead code, environment variables, and technical debt for TeraX V3 migration.

---

## 1. Environment Variables Audit

| Environment Variable | Classification | Requirement Status | Purpose & Description |
|---|---|---|---|
| `PORT` | DEPLOYMENT | OPTIONAL (Default: 3000) | Express HTTP listening port |
| `NODE_ENV` | DEPLOYMENT | REQUIRED | Environment mode (`development`, `production`, `test`) |
| `DB_HOST` | DATABASE | REQUIRED | Primary PostgreSQL host (`crcdevdb` / `crc_db`) |
| `DB_PORT` | DATABASE | REQUIRED (Default: 5432) | Primary PostgreSQL port |
| `DB_NAME` | DATABASE | REQUIRED | Primary database name |
| `DB_USER` | DATABASE | REQUIRED | Database connection username |
| `DB_PASSWORD` | DATABASE | REQUIRED | Database connection password |
| `DB_SSL` | DATABASE | OPTIONAL | Enforces SSL connection to managed Postgres instances |
| `HELPDESK_DB_HOST` | DATABASE | OPTIONAL | Auxiliary database host for ticket sync |
| `HELPDESK_DB_NAME` | DATABASE | OPTIONAL | Auxiliary database name (`crc_helpdesk_db`) |
| `HELPDESK_DB_USER` | DATABASE | OPTIONAL | Auxiliary database username |
| `HELPDESK_DB_PASSWORD` | DATABASE | OPTIONAL | Auxiliary database password |
| `JWT_SECRET` | AUTH | REQUIRED | Cryptographic key for signing 365-day access tokens |
| `GOOGLE_CLIENT_ID` | AUTH | OPTIONAL | Google OAuth2 Client ID for employee SSO |
| `GOOGLE_CLIENT_SECRET` | AUTH | OPTIONAL | Google OAuth2 Client Secret |
| `SMTP_HOST` | EMAIL | OPTIONAL | Outgoing SMTP server address |
| `SMTP_PORT` | EMAIL | OPTIONAL | Outgoing SMTP server port (587 / 465) |
| `SMTP_USER` | EMAIL | OPTIONAL | Outgoing SMTP user / email |
| `SMTP_PASS` | EMAIL | OPTIONAL | Outgoing SMTP password / app password |
| `SMTP_FROM` | EMAIL | OPTIONAL | Default sender header (e.g. `TeraX <no-reply@terax.vn>`) |
| `VAPID_PUBLIC_KEY` | NOTIFICATION | OPTIONAL | Web Push protocol public key |
| `VAPID_PRIVATE_KEY` | NOTIFICATION | OPTIONAL | Web Push protocol private key |
| `VAPID_EMAIL` | NOTIFICATION | OPTIONAL | Contact email for push service operators |
| `CMS_API_URL` | EXTERNAL API | OPTIONAL | CMS TeraX gateway URL for tenant syncing |
| `CMS_SYNC_SECRET` | EXTERNAL API | OPTIONAL | Shared secret for HMAC-SHA256 signature verification |
| `TUNNEL_TOKEN` | DEPLOYMENT | REQUIRED (Production) | Cloudflare Zero Trust tunnel connection token |
| `UPLOAD_DIR` | STORAGE | LEGACY / UNKNOWN | Legacy upload path variable overridden by relative static path |
| `ENABLE_SWAGGER` | OTHER | OPTIONAL | Flag toggling API documentation endpoints |

---

## 2. Technical Debt Matrix

### 2.1 Critical Severity (Architectural & Security Blockers)

| Debt Item | Affected Files | Description & Manifestation | Risk & Impact |
|---|---|---|---|
| **Unauthenticated User Impersonation** | `modules/auth/server/auth.controller.js` | `POST /api/auth/switch-user` lacks administrative role verification. Any authenticated user can impersonate Super Admin. | Complete privilege escalation; compliance violation. |
| **Ephemerality of Upload Storage** | `server/middleware/upload.js`, `k8s/deployment.yaml` | Files saved directly to `public/uploads/` on container disk. Lacks persistent volumes. | Total data loss of contracts, attachments, and invoices on pod restart. |
| **In-Memory Cluster Desynchronization** | `modules/notifications/server/notifications.service.js`, `modules/request/server/request.service.js` | SSE connections (`clients` Map) and cache counters (`_facetedSummaryCache`) reside in Node.js process memory. | In PM2 cluster mode or multi-replica K8s, users receive stale data and miss real-time notifications. |
| **Missing Physical Foreign Keys** | `sql/init.sql`, `db_design.json` | 90% of relational links rely solely on application code; zero DBMS foreign key constraints. | Orphaned transactional records and data corruption. |
| **Year-Long JWT Expiration** | `modules/auth/server/auth.service.js` | Tokens signed with `{ expiresIn: '365d' }` without refresh token or revocation lists. | Stolen tokens grant indefinite access until global secret rotation. |

---

### 2.2 High Severity (Code Structure & Maintainability)

| Debt Item | Affected Files | Description & Manifestation | Risk & Impact |
|---|---|---|---|
| **God CSS Monolith** | `public/style.css` | 191 KB, 7,255 lines containing global overrides, component styles, and 10 conflicting responsive media queries. | Unmaintainable styling; accidental cascading bugs across modules. |
| **God JavaScript Monoliths** | `public/app.js`, `public/js/layout.js`, `modules/base/server/base.service.js` | `app.js` exceeds 1,400 lines mixing modal management, routing, event listening, and tab switching. | High cognitive overhead; tight coupling preventing unit testing. |
| **Unmounted Zombie Route Files** | `server/routes/` (8 files: `auth.js`, `company.js`, `contact.js`, `department.js`, `employee.js`, `myCompany.js`, `notifications.js`, `permissions.js`) | Leftover files from pre-modular architecture that are no longer imported in `server/server.js`. | Developer confusion; risk of maintaining code that never executes. |
| **Duplicated Module Client Configs** | `public/js/config/modules/*.js` vs `modules/*/client/*.config.js` | Identical configuration files exist in two locations; only the module client paths are loaded. | Drift between configurations; wasted maintenance effort. |
| **Full Table Scan Universal Search** | `modules/base/server/base.service.js` | `col::text ILIKE $query` applied to all columns. Bypasses B-tree indexes. | Database CPU spikes to 100% under search traffic; linear latency degradation. |

---

### 2.3 Medium Severity (Operational & Code Quality)

| Debt Item | Affected Files | Description & Manifestation | Risk & Impact |
|---|---|---|---|
| **Hardcoded Magic Numbers** | Throughout services and triggers | Statuses encoded as raw integers (`1`, `2`, `7`, `30`, `31`) instead of semantic constants or enums. | High error rate during developer onboarding and feature changes. |
| **Synchronous Event Loop Blocking** | `modules/export/server/export.service.js` | Synchronous Excel file parsing and spreadsheet generation using `xlsx` in controller thread. | Event loop freeze; timeouts on incoming HTTP and SSE connections. |
| **Lack of Input Schema Validation** | All API controllers | Request payloads read directly from `req.body` without Zod or Joi schema enforcement. | Silent type coercion errors; unhandled exceptions on missing fields. |
| **MIME Type Spoofing Vulnerability** | `server/middleware/upload.js` | Verifies only client-provided HTTP `file.mimetype` without inspecting magic file header bytes. | Potential upload of malicious executable payloads disguised as PDFs. |
