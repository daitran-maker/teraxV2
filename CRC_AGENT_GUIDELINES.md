# CRC App - AI Agent Guidelines

This document outlines the core architecture, established patterns, and strict guidelines for the CRC_app. All future AI agents interacting with this codebase MUST read and strictly adhere to these rules.

## 1. Security & Authentication (MANDATORY)

- **No Plain-Text Passwords**: The `password` MUST always be hashed using `bcryptjs` before being stored or compared. Never query the database using the raw `password`. Use `bcrypt.compare` in `auth.js`.
- **JWT Secrets**: `process.env.JWT_SECRET` is required. The application must crash (`throw new Error` or `process.exit(1)`) if this environment variable is missing. Do not use hardcoded fallback secrets like `'super_secret'`.
- **XSS Prevention**: When rendering data to the DOM in Vanilla JS (`app.js`), ALL dynamic strings MUST be escaped using the `escapeHTML(str)` utility function. Never concatenate raw data directly into HTML strings.

## 2. Database & Data Integrity

- **Database Triggers & Audit Logging**: Individual audit columns (`created_by`, `created_date`, `updated_by`, `updated_date`) are dropped from tables. Instead, all inserts, updates, and deletes are automatically captured and stored in the `audit_logs` table via PostgreSQL triggers (`trg_set_audit_fields` and logging functions). 
  - **DO NOT** try to manually query or update individual audit columns. 
  - Simply execute database queries normally. The database triggers will auto-resolve the active user via `current_setting('app.current_user')` or fallback logs.
- **Dynamic CRUD**: `/api/table/:tableName` is handled by `dynamic_crud.js`. Any future modifications here must be cautious to prevent SQL injection or schema leaks. Validate data types and ensure only expected columns are inserted/updated.

## 3. Frontend Architecture

- **Config-Driven UI**: The UI is largely driven by the `MODULES` configuration object in `public/app.js`. When adding new tables or views, try to configure them within `MODULES` rather than writing custom HTML templates.
- **State Management & Cache Syncing**: The application relies on frontend memory arrays (`currentData` for Master lists, `dashboardData` for My Views) to prevent constant reloading and eliminate screen flashing. **Rule:** Whenever performing a server-side action (e.g., executing an approval/action in `executeAction`), you MUST manually splice/update the modified record into `currentData` and `dashboardData` using the fresh API response. Do NOT force a full page reload or rely on re-fetching the entire list when returning to a table view.
- **Monolith Mitigation**: The frontend is a large Vanilla JS application. When adding complex new features, consider extracting logic into separate script files (e.g., `utils.js`, `api.js`) to prevent `app.js` from growing unmanageably.

## 4. Dependencies

- Use `bcryptjs` for hashing (not `bcrypt` natively to avoid cross-platform binary issues).
- Use `zod` for any new complex data validation needs in the backend.

Always review existing code patterns before introducing new libraries or architectures.

## 5. Seeding Data Guidelines (MANDATORY)

When seeding or mock-populating data, you MUST strictly adhere to the application state machines and validation logic:
- **Request Statuses**: The `sr_status` column in the `request` table must ONLY use: `['Draft', 'Pending Approval', 'Approved', 'Rejected', 'Closed', 'Cancelled']`.
- **Process Statuses**: The `process_status` column in the `request` table must ONLY use: `['Not started yet', 'Processing', 'Completed']`.
  - Align them logically: `Draft`, `Pending Approval`, `Rejected`, `Cancelled` mapped to `Not started yet`; `Closed` mapped to `Completed`; `Approved` mapped to `Not started yet`, `Processing`, or `Completed`.
- **Payment Types**: The `payment_type` column in the `payment` table must ONLY contain: `'Outgoing'` or `'Incoming'`.
- **Cleanup**: Always clear audit logs (`audit_logs`), backup tables, notifications (`notification`), and push subscriptions (`push_subscriptions`) when executing a clean database reset.

