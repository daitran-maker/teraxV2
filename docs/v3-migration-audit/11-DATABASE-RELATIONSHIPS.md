# 11 — DATABASE RELATIONSHIP MAP

**Target Repository:** `D:\CPI\teraxV2`  
**Purpose:** Relational architecture mapping, foreign key topology analysis, and entity-relationship diagrams for migration to TeraX V3.

---

## 1. Relational Integrity Architecture: Physical vs Logical

A critical discovery of this audit is that **over 90% of database relationships in TeraX V2 are LOGICAL, not physical**:
- Only a tiny fraction of tables (`request_items.request_id`, `contract_file.contract_id`) have explicit PostgreSQL `FOREIGN KEY ... REFERENCES ... ON DELETE CASCADE` constraints.
- Crucial entities such as `request.department_id`, `payment.request_id`, `invoice.contract_id`, and `employee.department_id` rely entirely on **application-level code** for referential integrity.
- **Consequence for V3:** Orphaned records exist in production (e.g. payments pointing to deleted requests, employees pointing to non-existent departments). A thorough data cleaning and constraint addition pipeline is mandatory during V3 ETL.

---

## 2. Entity-Relationship Diagrams (ERD)

### 2.1 Organizational & User Hierarchy

```mermaid
erDiagram
    COMPANY ||--o{ DEPARTMENT : "owns / encompasses"
    COMPANY ||--o{ CONTACT : "has commercial contacts"
    COMPANY ||--o{ CONTRACT : "signs agreements"
    COMPANY ||--o{ INVOICE : "billed to"
    COMPANY ||--o{ PAYMENT : "disburses to"
    
    DEPARTMENT ||--o{ DEPARTMENT : "parent_id (hierarchy tree)"
    DEPARTMENT ||--o{ EMPLOYEE : "employs members"
    DEPARTMENT ||--o{ REQUEST : "originates requests"
    DEPARTMENT ||--o{ ASSET : "allocates assets"
    
    EMPLOYEE ||--o{ EMPLOYEE : "manager_id (reporting line)"
    EMPLOYEE ||--o{ REQUEST : "creates / owns (sr_owner)"
    EMPLOYEE ||--o{ REQUEST : "handles / fulfills (handler_id)"
    EMPLOYEE ||--o{ TASK_ASSIGNMENT : "assigned to"
    EMPLOYEE ||--o{ ASSET : "holds custody (current_holder_id)"
    EMPLOYEE ||--o{ COMMENT : "authors comments"
    EMPLOYEE ||--o{ AUDIT_LOGS : "causes changes (changed_by)"
```

---

### 2.2 Operational Core: Request Hub

The `request` table serves as the central operational hub, connecting line items, workflows, tasks, comments, and attachments:

```mermaid
erDiagram
    REQUEST ||--|{ REQUEST_ITEMS : "contains BOQ items (PHYSICAL FK)"
    REQUEST ||--o{ ATTACHMENT : "has files (entity_type='request')"
    REQUEST ||--o{ COMMENT : "discussion timeline"
    REQUEST ||--o{ TASK : "generates fulfillment tasks"
    REQUEST ||--o{ AUDIT_LOGS : "triggers change diffs"
    
    DEPARTMENT ||--o{ REQUEST : "cost center & budget pool"
    EMPLOYEE ||--o{ REQUEST : "created_by & sr_owner"
    EMPLOYEE ||--o{ REQUEST : "handler_id (fulfiller)"
    COMPANY ||--o{ REQUEST : "procured from / billed to"
```

---

### 2.3 Financial & Commercial Flow

Contracts bind companies, incoming customer invoices, and outgoing vendor payments:

```mermaid
erDiagram
    CONTRACT ||--|{ CONTRACT_FILE : "physical PDF contracts (PHYSICAL FK)"
    CONTRACT ||--o{ PAYMENT : "milestone payment disbursements"
    CONTRACT ||--o{ INVOICE : "milestone billing invoices"
    CONTRACT }o--|| REQUEST : "originating proposal / request"
    CONTRACT }o--|| COMPANY : "counterparty client / supplier"
    
    REQUEST ||--o{ PAYMENT : "direct operational disbursement"
    REQUEST ||--o{ INVOICE : "direct project billing"
    
    COMPANY ||--o{ PAYMENT : "beneficiary vendor"
    COMPANY ||--o{ INVOICE : "client debtor"
```

---

### 2.4 Fixed Asset Lifecycle & Chain of Custody

```mermaid
erDiagram
    ASSET ||--o{ ASSET_TRANSFER : "chain of custody history"
    ASSET ||--o{ ASSET_MAINTENANCE : "repair & service logs"
    ASSET ||--o{ ASSET_AUDIT : "physical counting discrepancies"
    
    EMPLOYEE ||--o{ ASSET : "current assigned holder"
    DEPARTMENT ||--o{ ASSET : "physical location / department"
    
    EMPLOYEE ||--o{ ASSET_TRANSFER : "transfer from employee"
    EMPLOYEE ||--o{ ASSET_TRANSFER : "transfer to employee"
```

---

### 2.5 Security & 4D Authorization Matrix

```mermaid
erDiagram
    EMPLOYEE }o--|| ROLE : "employee.role (base tier)"
    EMPLOYEE ||--o{ PERMISSION_EXCEPTIONS : "individual column overrides"
    
    EXCEPTION_RULES ||--o{ MODULE : "controls menu/module visibility"
    ACTION_RULES ||--o{ MODULE : "controls button execution (create/edit/delete)"
    COLUMN_PERMISSIONS ||--o{ MODULE : "controls field-level read/write"
    
    COLUMN_PERMISSIONS ||--o{ PERMISSION_LEVELS : "required managerial level"
    COLUMN_PERMISSIONS ||--o{ PERMISSION_POSITIONS : "allowed job positions"
    COLUMN_PERMISSIONS ||--o{ PERMISSION_ROLES : "allowed system roles"
```

---

## 3. Relational Anomaly Analysis & Migration Directives

| Relationship Pair | Current V2 State | Risk / Defect in V2 | V3 Architecture Directive |
|---|---|---|---|
| `request` $\rightarrow$ `request_items` | Physical FK with trigger cascade | Soft delete leaves items orphaned in historical reports | Add physical `ON DELETE CASCADE` and unified Prisma/Drizzle soft-delete middleware |
| `payment` $\rightarrow$ `request` | Logical FK (no constraint) | Deleting or merging requests leaves dangling `payment.request_id` | Enforce formal foreign key constraint with `ON DELETE SET NULL` |
| `invoice` $\rightarrow$ `contract` | Logical FK | Contracts can be deleted while active invoices exist | Disallow contract deletion if active child invoices exist |
| `employee` $\rightarrow$ `department` | Logical FK | Disbanding a department leaves employees with invalid `department_id` | Enforce foreign key with `ON DELETE RESTRICT` |
| `asset` $\rightarrow$ `employee` | Logical FK | Terminated employees remain listed as active asset custodians | Add automated custodian reassignment workflow upon employee offboarding |
