# 13 — API CONTRACT AUDIT

**Target Repository:** `D:\CPI\teraxV2`  
**Purpose:** Precise contract schemas, response payloads, frontend key dependencies, and contract stability tags to enable independent Frontend & Backend development in TeraX V3.

---

## 1. Classification Tags Legend

- `MUST_PRESERVE`: Keys and formats strictly required by existing UI components; breaking them breaks views.
- `STABLE`: Clean, canonical JSON structure that should be retained as-is in V3.
- `INCONSISTENT`: Field names vary between endpoints (e.g. `employee_id` vs `id`, `name` vs `full_name`).
- `LEGACY`: Redundant fields or deprecated structures that should be refactored or eliminated in V3.
- `CAN_CHANGE`: Internal implementation details that V3 can optimize without impacting core business behavior.

---

## 2. Core API Contract Specifications

### 2.1 Authentication: `POST /api/auth/login`
- **Controller:** [modules/auth/server/auth.controller.js](file:///d:/CPI/teraxV2/modules/auth/server/auth.controller.js)
- **Status:** `MUST_PRESERVE`

#### Actual Response Payload
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "employee_id": 14,
    "username": "tran.van.a",
    "full_name": "Trần Văn A",
    "email": "a.tran@terax.vn",
    "role": "Manager",
    "department_id": 3,
    "department_name": "Kỹ thuật Công nghệ",
    "avatar_url": "/uploads/avatars/avatar-14.png"
  }
}
```

#### Frontend Dependencies & Field Analysis
| Key | Stability Tag | Frontend Usage / Consumer |
|---|---|---|
| `token` | `MUST_PRESERVE` | Stored in `localStorage.setItem('token')`; attached to HTTP `Authorization: Bearer <token>`. |
| `user.employee_id` | `MUST_PRESERVE` | Evaluates action ownership (`[request.sr_owner]`, `current_user.id`). |
| `user.role` | `MUST_PRESERVE` | Evaluates Super Admin bypass and base RBAC guards in `permission.js`. |
| `user.department_id` | `MUST_PRESERVE` | Pre-populates department filter dropdowns and request creation modals. |
| `user.full_name` | `STABLE` | Rendered in topbar user profile pill. |
| `user.avatar_url` | `CAN_CHANGE` | Fallbacks to initials avatar if null. |

---

### 2.2 Permissions Matrix: `GET /api/permissions/user`
- **Controller:** [modules/permissions/server/permission.controller.js](file:///d:/CPI/teraxV2/modules/permissions/server/permission.controller.js)
- **Status:** `INCONSISTENT` (Complex 4D nested object consumed by `public/js/utils/permission.js`).

#### Actual Response Payload
```json
{
  "is_super_admin": false,
  "role": "Manager",
  "department_id": 3,
  "menu_permissions": {
    "request": true,
    "payment": true,
    "invoice": false,
    "employee": false,
    "asset": true
  },
  "action_rules": {
    "request": ["view", "create", "edit", "approve", "reject"],
    "payment": ["view", "create"],
    "asset": ["view", "transfer"]
  },
  "column_permissions": {
    "request": {
      "budget_code": { "read": true, "edit": false },
      "total_amount": { "read": true, "edit": true },
      "approval_flow": { "read": true, "edit": false }
    }
  }
}
```

#### Frontend Dependencies & Field Analysis
| Key | Stability Tag | Frontend Usage / Consumer |
|---|---|---|
| `is_super_admin` | `MUST_PRESERVE` | If `true`, bypasses all `canAccessTab()` and button visibility checks. |
| `menu_permissions` | `STABLE` | Controls `display: none` or removal of sidebar navigation items in `layout.js`. |
| `action_rules` | `MUST_PRESERVE` | Consumed by `grid.js` to render action dropdown items (Approve, Reject, Delete). |
| `column_permissions` | `INCONSISTENT` | Consumed by `modal.js` form builder to set fields to hidden or read-only. |

---

### 2.3 Universal Dynamic Paginated List: `GET /api/base/:module`
- **Controller:** [modules/base/server/base.controller.js](file:///d:/CPI/teraxV2/modules/base/server/base.controller.js)
- **Status:** `MUST_PRESERVE` (Consumed by universal grid component `grid.js`).

#### Query Parameters
- `page`: Integer (1-based)
- `limit`: Integer (default 20, 50, 100)
- `search`: String (global text search)
- `sort`: String (e.g. `id:desc`, `created_at:asc`)
- Filter columns: Arbitrary key-value pairs (e.g. `sr_status=2`, `department_id=3`)

#### Actual Response Payload
```json
{
  "success": true,
  "data": [
    {
      "id": 1052,
      "request_code": "REQ-2026-0042",
      "title": "Mua sắm máy trạm đồ họa Dell Precision",
      "department_id": 3,
      "department_name": "Kỹ thuật Công nghệ",
      "total_amount": 75000000,
      "currency": "VND",
      "sr_status": 2,
      "sr_status_label": "Chờ phê duyệt",
      "process_status": 7,
      "process_status_label": "Chưa xử lý",
      "created_by": 14,
      "created_by_name": "Trần Văn A",
      "created_at": "2026-09-15T09:12:00.000Z",
      "updated_at": "2026-09-15T09:12:00.000Z"
    }
  ],
  "pagination": {
    "total": 148,
    "page": 1,
    "limit": 20,
    "totalPages": 8
  }
}
```

#### Frontend Dependencies & Field Analysis
| Key | Stability Tag | Frontend Usage / Consumer |
|---|---|---|
| `data` | `MUST_PRESERVE` | Table row data array rendered in `grid.js`. |
| `pagination.total` | `MUST_PRESERVE` | Generates pagination counter and page numbers (`Hiển thị 1 - 20 trên 148`). |
| `pagination.totalPages`| `STABLE` | Disables "Next" button when `page === totalPages`. |
| `id` | `INCONSISTENT` | Most modules use `id`, but `employee` uses `employee_id`, `payment` uses `payment_id`, `invoice` uses `invoice_id`. Grid requires special adapter logic. |

---

### 2.4 Request Detail with Line Items & Approvers: `GET /api/requests/:id`
- **Controller:** [modules/request/server/request.controller.js](file:///d:/CPI/teraxV2/modules/request/server/request.controller.js)
- **Status:** `MUST_PRESERVE`

#### Actual Response Payload
```json
{
  "success": true,
  "data": {
    "id": 1052,
    "request_code": "REQ-2026-0042",
    "title": "Mua sắm máy trạm đồ họa Dell Precision",
    "description": "Nâng cấp máy trạm đồ họa cho phòng CAD/BIM",
    "sr_status": 2,
    "process_status": 7,
    "total_amount": 75000000,
    "currency": "VND",
    "department_id": 3,
    "department_name": "Kỹ thuật Công nghệ",
    "created_by": 14,
    "creator_name": "Trần Văn A",
    "items": [
      {
        "id": 412,
        "item_name": "Dell Precision 5820 Tower",
        "unit": "Bộ",
        "quantity": 1,
        "unit_price": 75000000,
        "total_price": 75000000,
        "remarks": "Cấu hình Xeon W-2245, 64GB RAM, RTX A4000"
      }
    ],
    "approval_flow": {
      "total_levels": 2,
      "current_level": 1,
      "steps": [
        {
          "level": 1,
          "role_name": "Trưởng phòng Kỹ thuật",
          "approver_id": 14,
          "approver_name": "Trần Văn A",
          "status": "PENDING"
        },
        {
          "level": 2,
          "role_name": "Giám đốc Tài chính",
          "approver_id": 2,
          "approver_name": "Lê Thị B",
          "status": "WAITING"
        }
      ]
    },
    "attachments": [
      {
        "id": 98,
        "file_name": "Bao_gia_Dell_Precision.pdf",
        "file_size": 2451000,
        "file_path": "/uploads/requests/2026/09/Bao_gia_Dell_Precision.pdf"
      }
    ]
  }
}
```

---

### 2.5 Summary Metrics: `GET /api/my-views/summary`
- **Controller:** [modules/myViews/server/myViews.controller.js](file:///d:/CPI/teraxV2/modules/myViews/server/myViews.controller.js)
- **Status:** `STABLE`

#### Actual Response Payload
```json
{
  "success": true,
  "data": {
    "my_pending_requests": 3,
    "my_approval_queue": 5,
    "my_assigned_tasks": 8,
    "my_active_assets": 2,
    "unread_notifications": 4
  }
}
```

---

## 3. Recommended Contract Standardizations for TeraX V3

1. **Standardize Primary Keys:**
   - Unify all entity identifiers to `id: string` (UUIDv7 or CUID2) across all modules, eliminating legacy aliases (`employee_id`, `payment_id`, `invoice_id`, `contract_id`).
2. **Unified Envelope Schema:**
   - Standardize all API responses to:
     ```typescript
     interface ApiResponse<T> {
       success: boolean;
       data?: T;
       error?: {
         code: string;
         message: string;
         details?: Record<string, string[]>;
       };
       meta?: {
         page?: number;
         limit?: number;
         total?: number;
         timestamp: string;
       };
     }
     ```
3. **Enum vs Integer Status Identifiers:**
   - Replace opaque magic integer status codes (`sr_status: 2`, `process_status: 7`, `payment_status: 31`) with semantic strings (`"PENDING_APPROVAL"`, `"NOT_STARTED"`, `"READY_FOR_PAYMENT"`).
