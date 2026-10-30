# 12 — DATABASE PERFORMANCE AUDIT

**Target Repository:** `D:\CPI\teraxV2`  
**Database:** PostgreSQL 15 / 16  
**Purpose:** Exhaustive code-level audit of database query patterns, latency bottlenecks, connection pool risks, and indexing deficiencies for TeraX V3 migration.

---

## 1. Executive Performance Finding

TeraX V2 relies on generic SQL string concatenation in [base.service.js](file:///d:/CPI/teraxV2/modules/base/server/base.service.js) and module services. While this minimized boilerplate during early development, it introduced several severe database performance anti-patterns that will cause severe latency and high CPU usage as data scales in V3.

---

## 2. Granular Query Anti-Pattern Audit

### 2.1 Full-Table Sequential Scan via `::text ILIKE` Universal Search
- **Location:** [modules/base/server/base.service.js](file:///d:/CPI/teraxV2/modules/base/server/base.service.js#L145-L168)
- **Problem:** When a user types into the grid search input, the backend dynamically constructs a WHERE clause comparing search terms against every visible column cast to text:
  ```sql
  WHERE (t.id::text ILIKE '%searchTerm%' OR t.title::text ILIKE '%searchTerm%' OR t.created_at::text ILIKE '%searchTerm%')
  ```
- **Potential Impact:** Explicit type casting (`::text`) completely bypasses B-tree indexes on indexed columns (`request_code`, `id`, `title`). Every single keystroke forces a PostgreSQL `Seq Scan` (Sequential Table Scan) across the entire table and all its pages.
- **Suggested V3 Treatment:** Implement PostgreSQL Full-Text Search using `tsvector` and `GIN` indexes, or utilize Elasticsearch/Meilisearch for multi-column search.

---

### 2.2 Deep Pagination Overhead (`OFFSET / LIMIT`)
- **Location:** [modules/base/server/base.service.js](file:///d:/CPI/teraxV2/modules/base/server/base.service.js#L210)
- **Problem:** Pagination is implemented via standard SQL:
  ```sql
  SELECT * FROM request ORDER BY id DESC LIMIT 50 OFFSET 10000;
  ```
- **Potential Impact:** At high page numbers, PostgreSQL must read, sort, and discard the first 10,000 tuples before returning 50 rows. This leads to linear degradation ($O(N)$) of API response times as records accumulate.
- **Suggested V3 Treatment:** Implement Keyset / Cursor-based pagination (`WHERE id < $lastSeenId ORDER BY id DESC LIMIT 50`) for data tables and infinite scroll lists.

---

### 2.3 Redundant Uncached `COUNT(*)` on Every Pagination Call
- **Location:** [modules/base/server/base.service.js](file:///d:/CPI/teraxV2/modules/base/server/base.service.js#L185-L202)
- **Problem:** Every time a user changes page, sorts, or filters, the server executes two consecutive full queries:
  1. `SELECT COUNT(*) FROM table WHERE [filters]`
  2. `SELECT * FROM table WHERE [filters] LIMIT 50 OFFSET X`
- **Potential Impact:** In PostgreSQL, `COUNT(*)` must scan the visibility map or heap tuples to guarantee MVCC snapshot isolation. On tables with >100,000 rows (e.g. `audit_logs`, `request_items`), the count query often takes 3–5x longer than the data query itself.
- **Suggested V3 Treatment:** Cache total counts in Redis for common filters, return estimated counts (`reltuples` from `pg_class`) for large master lists, or use a window function `COUNT(*) OVER()` within a single query pass.

---

### 2.4 Unbounded `SELECT *` Projection
- **Location:** [modules/base/server/base.service.js](file:///d:/CPI/teraxV2/modules/base/server/base.service.js#L95) and throughout custom module services.
- **Problem:** Queries default to `SELECT *` or `SELECT t.*`, fetching heavy JSONB blobs (`approval_flow`, `metadata`, `custom_fields`) and large text bodies even when populating simple summary list tables.
- **Potential Impact:** Drastic network payload bloat between PostgreSQL and Node.js; excessive heap memory consumption in Node.js processes; inability to use Index-Only Scans.
- **Suggested V3 Treatment:** Use Prisma/Drizzle select projections to query strictly the fields required by the requesting frontend grid schema.

---

### 2.5 N+1 Subquery Loops for Sub-Entities
- **Location:** [modules/request/server/request.service.js](file:///d:/CPI/teraxV2/modules/request/server/request.service.js#L180-L215)
- **Problem:** In several detail and reporting endpoints, after fetching parent request records, the code iterates over each record in JavaScript to query associated child entities (`request_items`, `attachments`, `comments`) individually:
  ```javascript
  for (const req of requests) {
    req.items = await db.query('SELECT * FROM request_items WHERE request_id = $1', [req.id]);
    req.attachments = await db.query('SELECT * FROM attachment WHERE entity_id = $1', [req.id]);
  }
  ```
- **Potential Impact:** Fetching 50 requests triggers $1 + 50 + 50 = 101$ network round trips to the database, causing significant latency spikes.
- **Suggested V3 Treatment:** Replace with relational `JOIN` + `json_agg()` in SQL or batch-loading techniques (DataLoader pattern in Prisma).

---

### 2.6 In-Memory Cache Desynchronization Across Cluster Pods
- **Location:** [modules/request/server/request.service.js](file:///d:/CPI/teraxV2/modules/request/server/request.service.js#L42)
- **Problem:** Summary counts and user request IDs are cached in local JavaScript memory:
  ```javascript
  const _facetedSummaryCache = new Map();
  const _userReqIdsCache = new Map();
  ```
- **Potential Impact:** TeraX V2 runs in PM2 cluster mode (`-i 2`) and is deployed with multiple Kubernetes replicas (`replicas: 2`). A mutation executed on Pod A invalidates only Pod A's local Map. Pod B continues serving stale cached summaries, causing inconsistent UI counts for users depending on load balancer routing.
- **Suggested V3 Treatment:** Migrate all distributed caching to Redis with standardized key invalidation channels (Pub/Sub or Redis keyspace notifications).

---

### 2.7 Database Connection Pool Exhaustion Risk
- **Location:** [server/config/database.js](file:///d:/CPI/teraxV2/server/config/database.js#L12)
- **Problem:** The connection pool is configured with `max: 20` per Node.js process:
  - Each container pod runs PM2 cluster with 2 workers ($2 \times 20 = 40$ connections).
  - 2 Kubernetes deployment pods = 80 active connections.
  - Adding staging or auxiliary worker pods easily exceeds PostgreSQL's default `max_connections = 100`.
- **Potential Impact:** Under traffic bursts or long-running report queries, connection acquisition times out with `timeout exceeded when connecting to database`.
- **Suggested V3 Treatment:** Deploy PgBouncer or Supabase Supavisor as a connection pooling sidecar/proxy, and set worker pool size to a lean 5–10 connections.

---

### 2.8 Unindexed Foreign Key & Filter Candidates

The following frequently queried columns lack B-tree indexes in the V2 schema:

| Table | Column | Query Context | Recommended Index in V3 |
|---|---|---|---|
| `request` | `department_id` | Filter by department | `CREATE INDEX idx_request_dept_id ON request(department_id);` |
| `request` | `handler_id` | Filter "My Assigned Requests" | `CREATE INDEX idx_request_handler_id ON request(handler_id);` |
| `payment` | `request_id` | Join payments to parent request | `CREATE INDEX idx_payment_request_id ON payment(request_id);` |
| `invoice` | `company_id` | Customer billing ledger | `CREATE INDEX idx_invoice_company_id ON invoice(company_id);` |
| `attachment` | `entity_type, entity_id` | Fetching files for record | `CREATE INDEX idx_attachment_entity ON attachment(entity_type, entity_id);` |
| `audit_logs` | `table_name, record_id` | Entity audit history timeline | `CREATE INDEX idx_audit_logs_target ON audit_logs(table_name, record_id);` |
