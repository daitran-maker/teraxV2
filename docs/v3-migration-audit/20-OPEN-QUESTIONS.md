# 20 — OPEN ARCHITECTURE QUESTIONS & DECISIONS

**Target Repository:** `D:\CPI\teraxV2`  
**Purpose:** Formal catalog of high-impact architectural questions, security choices, schema design trade-offs, and infrastructure decisions requiring confirmation from the Lead Architect before initiating TeraX V3 development.

---

## 1. Security & Identity Management

### Question 1.1: Token Lifespan & Session Revocation
- **Context:** TeraX V2 issues stateless JWTs valid for **365 days** with no refresh token mechanism, no token rotation, and no blacklisting.
- **Architectural Question:** Should TeraX V3 adopt a standard short-lived token model (e.g. 15-minute access token + 7-day refresh token stored in HttpOnly secure cookies with Redis-backed revocation)?
- **Impact:** Greatly enhances enterprise security posture; requires frontend HTTP client interceptors to handle token rotation seamlessly.

### Question 1.2: User Impersonation ("Switch User")
- **Context:** `POST /api/auth/switch-user` currently allows any authenticated employee to assume the identity of any other employee without role verification.
- **Architectural Question:** Should this feature be:
  - Option A: Removed entirely.
  - Option B: Strictly restricted to `Super Admin` with mandatory reason prompt and immutable audit logging in `user_activity_logs`.
- **Impact:** Critical security remediation preventing privilege escalation.

### Question 1.3: Google SSO Configuration & Multi-Tenant Restriction
- **Context:** The Google Client ID is hardcoded in frontend files. Any Google account can attempt authentication, though non-registered emails are rejected.
- **Architectural Question:** Should V3 enforce Google Workspace domain-level whitelisting (e.g. `@cpi.com.vn` or `@terax.vn`) at the OAuth token validation level?

---

## 2. Workflow & Data Architecture

### Question 2.1: Normalization of Approval Flow
- **Context:** V2 stores multi-level approvals as a dynamic JSONB document inside `request.approval_flow`.
- **Architectural Question:** Should V3 normalize this structure into relational tables (`workflows`, `workflow_steps`, `workflow_executions`) or maintain a JSONB workflow engine?
- **Trade-off:**
  - *Relational normalization* provides strict referential integrity, easier SQL reporting on approval bottlenecks, and clean audit trails.
  - *JSONB* provides dynamic flexibility without schema alterations when steps change.
- **Recommendation:** Normalize into relational tables for core enterprise workflows.

### Question 2.2: Semantic Enums vs Magic Integer Status Identifiers
- **Context:** Statuses across V2 are stored as integers (`sr_status: 1..6`, `process_status: 7..117`, `payment_status: 30..121`).
- **Architectural Question:** Can V3 replace these magic numbers with semantic string enums (`DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `READY_FOR_PAYMENT`) across the API and database?
- **Impact:** Vastly improves code readability and type-safety in TypeScript, but requires mapping logic during database ETL.

### Question 2.3: Database Triggers vs Application Domain Events
- **Context:** Status synchronization (`trg_request_submit_status`, `trg_propagate_contract_request`) is currently executed by PostgreSQL trigger functions.
- **Architectural Question:** Should business logic triggers be migrated to PostgreSQL in V3, or moved into application-layer domain event handlers in backend services?
- **Recommendation:** Migrate workflow business logic to application services for transparency, unit-testability, and observability, keeping only audit logging triggers in the database.

---

## 3. Database Topology & Multi-System Consolidation

### Question 3.1: Consolidation of Three Databases
- **Context:** The current production deployment connects to three separate PostgreSQL databases:
  1. `crcdevdb` / `crc_db` (Main ERP/Operations)
  2. `crc_helpdesk_db` (Auxiliary Helpdesk ticketing)
  3. `cms_terax` (Multi-tenant company lookups)
- **Architectural Question:** Should TeraX V3 consolidate these disparate databases into a single PostgreSQL instance utilizing schema separation (e.g. `core`, `helpdesk`, `cms`), or maintain isolated database instances?
- **Impact:** Consolidation enables ACID transactions, unified foreign key constraints, and simplified connection pool management.

### Question 3.2: Formal Foreign Key Constraint Enforcement
- **Context:** Over 90% of relations in V2 are logical only. Data corruption (orphaned rows) exists in the production database.
- **Architectural Question:** Will the Lead Architect approve an automated data cleanup/ETL script during migration to nullify or prune orphaned foreign keys so that strict physical `FOREIGN KEY ... REFERENCES` constraints can be enforced in V3?

---

## 4. File Storage & Cloud Infrastructure

### Question 4.1: Cloud Object Storage Selection
- **Context:** Current files reside on local container disks (`public/uploads/`), presenting severe data-loss risks across container restarts.
- **Architectural Question:** What is the approved cloud storage target for V3?
  - Option A: Cloudflare R2 (zero egress fees, S3 compatible).
  - Option B: AWS S3.
  - Option C: Self-hosted MinIO (for on-premise / private cloud deployments).
- **Migration Requirement:** Plan for migrating existing media files from `public/uploads/` to the chosen bucket during cutover.

### Question 4.2: Department Storage Quotas
- **Context:** V2 enforces departmental storage quotas via the `storage_quota` table and cron recalculations.
- **Architectural Question:** Is granular department-level disk quota enforcement still a business requirement in V3, or can it be replaced by organization-wide storage monitoring?

---

## 5. Frontend & UI System

### Question 5.1: Frontend Framework & Architecture
- **Context:** V2 uses vanilla JavaScript with custom DOM manipulation and a 7,255-line global stylesheet (`public/style.css`).
- **Architectural Question:** What is the preferred frontend framework for `teraxV3`?
  - Option A: Next.js (React Server Components + App Router).
  - Option B: Vite + React SPA (Lightweight single-page application).
- **Recommendation:** Vite + React SPA for enterprise dashboard responsiveness and seamless state management.

### Question 5.2: Decommissioning Dead Code
- **Context:** 8 unmounted legacy route files in `server/routes/`, duplicate config files in `public/js/config/modules/`, and the legacy `expense` table exist in V2.
- **Architectural Question:** Confirming that all 8 zombie route files, duplicate configs, and the `expense` schema should be completely excluded from V3.
