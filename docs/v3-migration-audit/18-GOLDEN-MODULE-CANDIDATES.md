# 18 — GOLDEN MODULE CANDIDATE EVALUATION

**Target Repository:** `D:\CPI\teraxV2`  
**Purpose:** Multi-criteria scoring, risk evaluation, and definitive recommendation of the "Golden Module" to be migrated first as the architectural benchmark for TeraX V3.

---

## 1. Candidate Selection

To establish the architectural patterns for TeraX V3, three distinct modules were selected as potential Golden Module candidates:
1. **Candidate A: Payment Management (`payment`)** — Core financial disbursement workflow.
2. **Candidate B: Organization & Employees (`employee` + `department`)** — Core structural foundation.
3. **Candidate C: Service Request Engine (`request`)** — Core operational container and approval engine.

---

## 2. Multi-Criteria Evaluation Scorecard

Each candidate is evaluated on a scale from 1 (Poor / Low) to 10 (Excellent / High).

| Evaluation Criteria | Weight | Candidate A: Payment | Candidate B: Organization | Candidate C: Request |
|---|---|---|---|---|
| **Business Importance** | 15% | 9 / 10 | 9 / 10 | 10 / 10 |
| **UI Completeness** (Grid, Modal, Tabs, Drawer) | 15% | 9 / 10 | 8 / 10 | 10 / 10 |
| **CRUD Completeness** (Create, Read, Update, Delete, Export) | 10% | 10 / 10 | 9 / 10 | 9 / 10 |
| **Workflow & State Machine Complexity** | 15% | 8 / 10 | 3 / 10 | 10 / 10 |
| **Permissions Depth** (Roles, Actions, Field-level) | 15% | 9 / 10 | 7 / 10 | 10 / 10 |
| **Relational Richness** (Parent, Child, Lookup entities) | 10% | 8 / 10 | 6 / 10 | 10 / 10 |
| **Representative Architecture Value** | 10% | 9 / 10 | 6 / 10 | 10 / 10 |
| **Migration Safety & Risk Profile** (Inverted: 10 = Lowest Risk) | 10% | 8 / 10 | 10 / 10 | 4 / 10 |
| **WEIGHTED TOTAL SCORE** | **100%** | **8.75 / 10** | **7.30 / 10** | **8.65 / 10** |

---

## 3. Comparative Candidate Analysis

### Candidate B: Organization (`employee` + `department`)
- **Pros:** Essential prerequisite for user authentication, reporting hierarchies, and department cost centers. Extremely low migration risk due to lack of complex approval workflows.
- **Cons:** Too simple to serve as a comprehensive architectural benchmark. It lacks multi-level approval workflows, line-item child tables, financial state machines, and file attachment pipelines.
- **Verdict:** Must be ported first as a **prerequisite foundation**, but does not qualify as the full-spectrum Golden Module.

### Candidate C: Service Request Engine (`request`)
- **Pros:** Represents 100% of system features (dual state machine, amount-tiered multi-level JSONB approval flow, dynamic dot-notation permissions, line items, comments, attachments).
- **Cons:** Highest migration risk. Migrating `request` first while `employee`, `department`, `company`, and `storage` are still in flux risks stalling early progress due to complex trigger dependencies (`trg_request_submit_status`, `trg_propagate_contract_request`).
- **Verdict:** Should be migrated as Module #3 immediately following the Golden Module.

### Candidate A: Payment Management (`payment`) — RECOMMENDED GOLDEN MODULE
- **Pros:**
  1. **Perfect Complexity Balance:** Contains a complete linear state machine (Draft 30 $\rightarrow$ Submitted 121 $\rightarrow$ Ready for Payment 31 $\rightarrow$ Paid 32) without the circular trigger entanglements of `request`.
  2. **Full UI Representation:** Requires every core UI component in `packages/ui`: Filter toolbar, data grid with currency formatting, dynamic status badges, payment creation modal with bank auto-complete, file attachment drawer, and PDF export.
  3. **Permission Coverage:** Implements role-based action gating (Accountant submit, Finance Lead approval, Cashier mark as paid) and field-level permissions.
  4. **Manageable Boundaries:** Clearly bounded inputs (`company`, `department`, optional `request_id`).

---

## 4. Final Recommendation: The Golden Slice Strategy

We recommend executing a **two-phase Golden Slice**:
1. **Phase 0 (Foundation Slice):** Migrate `company`, `department`, and `employee` with minimal UI to establish the authentication token schema and database foreign key baseline.
2. **Phase 1 (The Golden Module):** Migrate **Payment Management (`payment`)** end-to-end:
   - Establish V3 backend controller, domain service, Prisma/Drizzle schema, and Zod validation.
   - Establish V3 frontend data grid, modal forms, status badges, action buttons, and TanStack Query hooks in `packages/ui`.
   - Validate end-to-end CRUD, state transitions, attachment uploads, and permission checks.
   - Use this implementation as the definitive reference blueprint for migrating all subsequent modules.
