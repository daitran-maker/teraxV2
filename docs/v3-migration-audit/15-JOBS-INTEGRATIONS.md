# 15 — BACKGROUND JOBS & EXTERNAL INTEGRATIONS

**Target Repository:** `D:\CPI\teraxV2`  
**Purpose:** Comprehensive audit of background schedulers, interval automations, message queues, and third-party external integrations for TeraX V3 migration.

---

## 1. Background Jobs & Scheduled Automations

All background tasks in TeraX V2 run **in-process** via the `node-cron` package inside the main Express application server. There is **no external queue runner** (such as BullMQ, Redis streams, or Celery).

### 1.1 Scheduled Jobs Inventory

#### Job 1: Daily Temporary File Pruning & Upload Cleanup
- **Trigger / Frequency:** Cron expression `0 0 * * *` (Daily at 00:00 UTC/Local).
- **Code File:** [server/services/cron.js](file:///d:/CPI/teraxV2/server/services/cron.js) / [modules/storage/server/storage.service.js](file:///d:/CPI/teraxV2/modules/storage/server/storage.service.js)
- **Database Tables:** `storage_files` (where `status = 'temp'`).
- **Filesystem Target:** `public/uploads/temp/`
- **Behavior:** Scans filesystem for files older than 24 hours that were never finalized or linked to an entity. Deletes files from disk and removes unlinked database records.
- **External Dependencies:** Local container filesystem.
- **Failure Behavior:** Logs error via `console.error`; silently fails without retry or alerting.

#### Job 2: Storage Quota Reconciliation
- **Trigger / Frequency:** Cron expression `0 1 * * *` (Daily at 01:00 AM).
- **Code File:** [modules/storage/server/storage.service.js](file:///d:/CPI/teraxV2/modules/storage/server/storage.service.js)
- **Database Tables:** `storage_quota`, `attachment`, `contract_file`.
- **Behavior:** Recalculates total disk usage by summing `file_size` from all attachments grouped by `department_id`, syncing actual totals into `storage_quota.used_bytes` to resolve concurrent drift.
- **Failure Behavior:** Rolls back recalculation transaction; alerts admin if disk mismatch exceeds 10%.

#### Job 3: Contract Expiry Notification & Auto-Status Transition
- **Trigger / Frequency:** Cron expression `0 6 * * *` (Daily at 06:00 AM).
- **Code File:** [modules/contract/server/contract.service.js](file:///d:/CPI/teraxV2/modules/contract/server/contract.service.js)
- **Database Tables:** `contract`, `notifications`, `email_queue`.
- **Behavior:**
  1. Finds contracts where `end_date < CURRENT_DATE` and `contract_status = 'Active'`; updates status to `'Expired'`.
  2. Finds contracts expiring in $\le 30$ days; creates notification records for contract owners.
- **Failure Behavior:** If notification creation fails, status update still commits.

---

## 2. In-Memory Messaging & Notification Engine

### 2.1 Server-Sent Events (SSE) Dispatcher
- **Implementation:** [modules/notifications/server/notifications.service.js](file:///d:/CPI/teraxV2/modules/notifications/server/notifications.service.js)
- **Mechanism:** Maintains an in-memory `Set` of active HTTP response connections:
  ```javascript
  const clients = new Map(); // employee_id -> Set<Response>
  ```
- **Limitation & Architectural Flaw:**
  Because connections are stored in Node.js process memory, when deployed across PM2 cluster workers (`-i 2`) or Kubernetes replicas, an event triggered on Pod A cannot push SSE events to clients connected to Pod B!
- **Suggested V3 Treatment:** Replace in-memory SSE broker with Redis Pub/Sub backplane.

### 2.2 Web Push Notifications
- **Implementation:** Uses `web-push` library with VAPID protocol.
- **Subscriptions Table:** `notification_subscriptions` (stores browser push endpoint and crypt keys).
- **Dispatch:** Dispatches push payload in background asynchronously when approval requests or comments arrive.

---

## 3. External Integrations Matrix

| Integration | Purpose | Configuration / ENV Keys | Implementation Files | Direction | Criticality |
|---|---|---|---|---|---|
| **Google Identity Services** | Single Sign-On (SSO) for employees | `GOOGLE_CLIENT_ID`, Client Secret | `public/login.html`, `modules/auth/server/auth.controller.js` | Inbound (OAuth token verification) | High (Primary corporate login) |
| **Cloudflare Tunnel (`cloudflared`)** | Zero Trust secure ingress routing and DDoS shielding | `TUNNEL_TOKEN` (in `.env` / `docker-compose.yml`) | `docker-compose.yml`, `k8s/deployment.yaml` | Inbound / Outbound tunnel | High (Production gateway) |
| **Nodemailer / SMTP** | Email alerts for request approval requests and status updates | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | `server/services/email.js`, `modules/request/server/request.service.js` | Outbound | Medium (Gracefully degrades) |
| **PostgreSQL Auxiliary (`crc_helpdesk_db`)** | Cross-system Helpdesk ticket mirroring | `HELPDESK_DB_HOST`, `HELPDESK_DB_NAME`, `HELPDESK_DB_USER`, `HELPDESK_DB_PASSWORD` | `modules/ticket/server/ticket.service.js` | Inbound (Read replica / mirror) | Medium |
| **CMS TeraX Sync API (`cms_terax`)** | Multi-tenant customer and company data synchronization | `CMS_SYNC_SECRET`, `CMS_API_URL` | `modules/company/server/company.service.js`, `server/services/sync.js` | Inbound & Outbound (HMAC-signed JSON) | High (Master data authority) |
| **Web Push (VAPID)** | Browser native push notifications | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL` | `modules/notifications/server/notifications.service.js` | Outbound | Low (Enhancement) |

---

## 4. CMS TeraX HMAC Authentication Protocol

Cross-system communication between TeraX V2 and `cms_terax` uses HMAC-SHA256 request signing:
- **Header:** `X-TeraX-Signature`
- **Signing Algorithm:** `crypto.createHmac('sha256', process.env.CMS_SYNC_SECRET).update(JSON.stringify(req.body)).digest('hex')`
- **Replay Protection:** None (lacks nonce or timestamp headers in V2).
- **V3 Requirement:** Add timestamp tolerance window ($\le 5$ minutes) and cryptographic nonce to eliminate replay attack vulnerabilities.
