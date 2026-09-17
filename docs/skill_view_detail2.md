# CRC App – Detail View 2 Design System (Skill View Detail 2)
> **Trigger Command:** `/skill_view_detail2`  
> Khi cần tạo mới hoặc chỉnh sửa một **Detail View kiểu mới (Detail View 2)** cho bất kỳ module nào (như *my_request, payment, expense, employee, policy...*), Agent phải đọc file này và áp dụng 100% các nguyên tắc thiết kế dưới đây.  
> **Nguyên tắc bất biến:** Chỉ điều chỉnh giao diện (layout, spacing, typography, màu sắc). Giữ nguyên toàn bộ **giá trị dữ liệu** (value), **logic nghiệp vụ** (action, permission) và **API call** đang có.

---

## 1. Tổng quan cấu trúc (Layout Architecture)

Detail View 2 là giao diện 2 cột cố định nằm trong khung có `background: #F8FAFC`:

```
┌─────────────────────────────────────────────────────────────────────┐
│ detail-layout  (display: flex; gap: 24px; padding: 24px)            │
│                                                                      │
│  ┌──────────────────────────┐   ┌──────────────────────────────────┐│
│  │  detail-left (45%)       │   │  detail-right (flex: 1)          ││
│  │  – Back + Action Row     │   │  – Tab Header (sticky)           ││
│  │  – Title + Status Grid   │   │  – Tab Content (scrollable)      ││
│  │  – Section Cards         │   │    ∟ Child Data Table            ││
│  │    (scroll independently)│   │    ∟ Comment Stream + Form       ││
│  └──────────────────────────┘   └──────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

**Class wrapper bắt buộc:** `class="view active [module-key]-detail"` (ví dụ: `my-request-detail`, `payment-detail`, `expense-detail`).  
**Font:** `font-family: 'Inter', sans-serif` trên toàn bộ view.

---

## 2. Bảng Màu & Token Thiết Kế (Design Tokens)

| Token | Giá trị | Dùng cho |
|---|---|---|
| `--border` | `#E5E7EB` | Toàn bộ đường viền card, divider |
| `--accent` | `#F97316` | Active tab, Add button, Send button |
| `--accent-hover` | `#EA580C` | Hover state của accent |
| `--bg-main` | `#F8FAFC` | Nền tổng thể của detail-layout |
| `--bg-card` | `#FFFFFF` | Nền tất cả card, panel |
| `--bg-section` | `#F8FAFC` | Nền bên trong status grid |
| `--text-primary` | `#111827` | Giá trị field chính |
| `--text-label` | `#6B7280` | Nhãn field (field label) |
| `--text-muted` | `#94A3B8` | Placeholder, trạng thái trống |
| `--text-back` | `#64748B` | Nút Back |
| `--shadow-sm` | `0 1px 3px rgba(0,0,0,0.04)` | Card panel |
| `--shadow-xs` | `0 1px 3px rgba(0,0,0,0.02)` | Section card |

---

## 3. Left Panel – Cột Thông Tin Chi Tiết

### 3A. Container chính
```css
flex: 0 0 45%;
max-width: 45%;
background: #FFFFFF;
border: 1px solid #E5E7EB;
border-radius: 8px;
padding: 24px;
display: flex;
flex-direction: column;
gap: 0;                          /* Kiểm soát khoảng cách qua margin-bottom */
box-shadow: 0 1px 3px rgba(0,0,0,0.04);
height: fit-content;
overflow: visible;
```

### 3B. Back & Action Row (Header)
```css
display: flex;
justify-content: space-between;
align-items: center;
border-bottom: 1px solid #E5E7EB;
padding-bottom: 12px;
margin-bottom: 24px;             /* 8-pt grid */
```
- **Nút Back:** `color: #64748B`, `font-size: 13px`, `font-weight: 600`, icon `arrow_back` 16px. Hover → `#1E293B`. Text: `Back to [Module Title]` (ví dụ: `Back to Requests`, `Back to Payments`).
  - *Ví dụ code:* `onclick="goBack('[module-key]')"`
- **Nút Update:** `background: #FFFFFF`, `border: 1px solid #E5E7EB`, `color: #334155`, `font-size: 12px`, `padding: 6px 12px`, icon `edit` 16px.
  - *Ví dụ code:* `onclick="openEditModal('[module-key]', '${pkVal}')"`
- **Nút Delete:** `background: #FEF2F2`, `border: 1px solid #FCA5A5`, `color: #DC2626`, icon `delete` 16px.
  - *Ví dụ code:* `onclick="confirmDelete('[module-key]', '${pkVal}', ...)"`
- Custom Action buttons (`#detail-actions-container`) nằm cùng hàng, render qua `renderDetailActions()`.

### 3C. Title & Status Grid
```css
/* Wrapper */
margin-bottom: 24px;

/* Title h2 */
font-size: 20px;
font-weight: 600;
color: #111827;
margin: 0 0 16px 0;

/* Status Grid Container */
display: flex;
justify-content: space-between;
align-items: stretch;
gap: 8px;
border: 1px solid #E5E7EB;
border-radius: 8px;
padding: 12px 16px;
background: #F8FAFC;
```

**Status Grid (áp dụng cho các module có quy trình):**  
Gồm tối đa 3 cột trạng thái chính nằm ngang phân chia đồng đều trong 1 khung chung (ví dụ: `SR Status | Approval | Process` cho Request; hoặc `Payment Status | Transfer Status` cho Payment).  
Mỗi cột gồm:
- Cấu trúc: `flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: space-between; gap: 4px; align-items: center; text-align: center;`
- Label: `font-size: 9px; font-weight: 600; text-transform: uppercase; color: #6B7280; letter-spacing: 0.5px`
- Divider dọc giữa các cột: `width: 1px; background: #E5E7EB; margin: 0 8px`
- Badge: Lấy style từ `getBadgeStyles(value)`, `padding: 4px 8px`, `font-size: 11px`, `font-weight: 600`, căn giữa hoàn toàn.

---

### 3D. Section Cards

Mỗi nhóm field được hiển thị trong một Section Card riêng biệt:

```
[SECTION TITLE] ← tiêu đề riêng, đứng ngoài card
┌───────────────────────────────────────┐
│  section-card                         │
│  Field Grid (2 cột mặc định)          │
│  Label                 Label          │
│  Value                 Value          │
└───────────────────────────────────────┘
```

**Section Title:**
```css
font-size: 14px;
font-weight: 600;
color: #374151;
margin: 0 0 12px 0;            /* KHÔNG có margin-top – khoảng cách do margin-bottom của card trước tạo ra */
text-transform: uppercase;
letter-spacing: 0.3px;
```
Format: `{số thứ tự}. {TÊN SECTION VIẾT HOA}` – ví dụ: `1. REQUEST INFORMATION`, `2. SYSTEM AUDIT`

**Section Card:**
```css
border: 1px solid #E5E7EB;
border-radius: 8px;
padding: 16px;
background: #FFFFFF;
margin-bottom: 24px;           /* Khoảng cách giữa các section = 24px */
box-shadow: 0 1px 3px rgba(0,0,0,0.02);
```

**Grid bên trong Section Card:**
```css
display: grid;
grid-template-columns: repeat(N, 1fr);  /* N tuỳ loại section */
gap: 16px 20px;
```

| Loại Section | Grid Columns |
|---|---|
| Mặc định | 2 |
| Section chứa thông tin duyệt (approval) | 3 |
| Section chứa thông tin xử lý (process/transfer) | 2 |
| Section chứa trường mô tả dài (detail/description) | 1 |

---

### 3E. Field Row (Từng ô dữ liệu)

```css
/* field-row wrapper */
display: flex;
flex-direction: column;
gap: 4px;
min-height: unset;             /* KHÔNG dùng min-height cố định – để field tự co khít */
box-sizing: border-box;
padding: 0;
```

**Field Label (tên cột):**
```css
font-size: 13px;
font-weight: 500;
color: #6B7280;
line-height: 1.3;
```
> **QUY TẮC VIẾT HOA (PROPER CASE):** Nhãn field phải được viết hoa chữ cái đầu của **MỖI TỪ** (Title Case / Proper Case).  
> Ví dụ: `request_title` → `Request Title`, `payment_status` → `Payment Status`, `company_shortname` → `Company Shortname`.  
> **Code chuẩn:**
> ```javascript
> let displayLabel = colLabel.replace(/_/g, ' ')
>   .replace(/\b\w/g, c => c.toUpperCase());
> ```

**Field Value:**
```css
font-size: 14px;
font-weight: 400;
color: #111827;
word-break: break-word;
line-height: 1.4;
```

Các trường hợp đặc biệt cho Value:
- **Trống:** `<span style="color: #94A3B8; font-style: italic;">—</span>`
- **Status field** (key chứa `status`): render badge qua `getBadgeStyles(val)`
- **File/Image:** render `<img>` preview hoặc link download (với icon `download` 16px)
- **Số tiền** (key chứa `amount`, `price`, `cost`, `total`, `value`...): `formatNumber(val)`
- **Ngày giờ** (key chứa `_date` hoặc dạng ISO): `formatDateTime(val)`
- **Lookup field** (`fieldCfg.optionsFrom`): thêm icon `chevron_right` màu `#2563EB` mở detail liên kết

---

## 4. Right Panel – Cột Tab & Bảng Con

### 4A. Container
```css
flex: 1;
display: flex;
flex-direction: column;
min-width: 0;
height: calc(100vh - 80px);
position: sticky;
top: 0;
```

### 4B. Card wrapper (`detail-right-card`)
```css
background: #FFFFFF;
border: 1px solid #E5E7EB;
border-radius: 8px;
padding: 24px;
box-shadow: 0 1px 3px rgba(0,0,0,0.04);
flex: 1;
min-height: 0;
```

### 4C. Tab Header
```css
display: flex;
gap: 0;
margin-bottom: 16px;
border-bottom: 2px solid #E5E7EB;
overflow-x: auto;
scrollbar-width: none;
align-items: stretch;
```

**Tab Button (`.detail-tab`):**
```css
/* Base */
background: transparent;
color: #6B7280;
font-size: 14px;
font-weight: 500;
height: 48px;
padding: 0 12px;
border: none;
border-bottom: 2px solid transparent;
margin-bottom: -2px;
cursor: pointer;
white-space: nowrap;

/* Active */
color: #F97316;
border-bottom: 2px solid #F97316;

/* Hover (inactive) */
color: #111827;
border-bottom: 2px solid #E5E7EB;
```

**Tab Count Badge** – số màu cam thương hiệu, KHÔNG có nền:
```html
<span id="tab-count-{childKey}" style="font-size:11px; font-weight:700; color:#F97316;"></span>
```

### 4D. Tab Content Area
```css
position: relative;
overflow: hidden;
flex: 1;
display: flex;
flex-direction: column;
min-height: 0;
```

**Sub-header (label + Add button):**
```css
padding: 0 0 12px 0;
display: flex;
justify-content: space-between;
align-items: center;
```
- **Child Record Count & Sum Value (`span#child-sum-${childKey}`):**
  - Text style: `font-size: 13px; color: #94A3B8; font-weight: 400;`
  - Record count badge: `<span style="font-weight:600; color:#64748B;">(${count})</span>`
  - Financial total (for tables with financial value like `expense`, `payment`, `invoice`, `mtr`): `&nbsp;·&nbsp; Total: <span style="color:#111827; font-weight:700;">${formatNumber(total)}</span>`
- Add button: `background: #F97316`, `color: #fff`, `font-size: 12px`, `padding: 6px 14px`, `border-radius: 6px`. Hover → `#EA580C`.
  - *Ví dụ code:* `onclick="openAddModal('${childKey}', ...)"`

**Child Table Container:**
```css
border: 1px solid #E5E7EB;
border-radius: 8px;
background: #FFFFFF;
box-shadow: 0 1px 3px rgba(0,0,0,0.02);
```
**QUAN TRỌNG:** Khối `.table-responsive` bên trong phải **trong suốt hoàn toàn**:
```css
margin: 0;
border: none;
border-radius: 0;
background: transparent;
box-shadow: none;
```
→ Tránh tạo viền lồng nhau (double border) gây thêm khoảng trắng thừa.

**Quy tắc Cuộn Ngang (Horizontal Scrolling) cho Bảng Con:**
Để đảm bảo bảng con có thể cuộn ngang mượt mà khi chứa nhiều cột thông tin và không bị bóp nghẹt chiều rộng:
- Wrapper bọc ngoài bảng (`.table-responsive` hoặc `div#child-table-container-[childKey]`) bắt buộc phải được cấu hình `overflow-x: auto; width: 100%;`.
- Thẻ `<table>` bên trong phải có thuộc tính `min-width: max-content;` (hoặc tối thiểu `800px`) để bắt buộc bảng hiển thị đúng chiều rộng dữ liệu thực tế và kích hoạt thanh cuộn ngang thay vì co cụm lại.
- Tất cả các cột tiêu đề `<th>` và ô dữ liệu `<td>` bắt buộc phải có style `white-space: nowrap;` để tránh văn bản bị xuống dòng tự động làm vỡ bố cục dòng.

**Table Header:**
```css
background: #F8FAFC;
color: #6B7280;
font-size: 11px;
font-weight: 600;
text-transform: uppercase;
letter-spacing: 0.5px;
border-bottom: 1px solid #E5E7EB;
padding: 12px 14px;
```

**Table Row:**
```css
cursor: pointer;
border-bottom: 1px solid #F1F5F9;
transition: background 0.15s;
/* Hover: background: #F8FAFC */
```

---

## 5. Comment / Log Tab

### 5A. Comment/Log Stream
```css
flex: 1;
overflow-y: auto;
display: flex;
flex-direction: column;
```

Mỗi comment card:
```css
background: #FFFFFF;
border: 1px solid #E5E7EB;
border-radius: 8px;
padding: 12px;
box-shadow: 0 1px 2px rgba(0,0,0,0.04);
margin-bottom: 8px;
```

### 5B. Inline Comment Form (`.inline-comment-box`)
```css
position: sticky;
bottom: 0;
z-index: 20;
padding: 16px;
background: #FFFFFF;
border: 1px solid #E5E7EB;
border-radius: 8px;
box-shadow: 0 1px 3px rgba(0,0,0,0.02);
margin-top: 12px;
display: flex;
flex-direction: column;
gap: 12px;
```

**Tag Search Input (`.tag-search-input`):**
```css
width: 100%;
height: 40px;                  /* Chuẩn CRC: 40px cho tất cả input */
border-radius: 8px;
padding: 8px 12px;
font-size: 13px;
border: 1px solid #E5E7EB;
box-sizing: border-box;
```

**Textarea:**
```css
width: 100%;
min-height: 96px;
padding: 12px;
font-size: 13px;
border-radius: 8px;
border: 1px solid #E5E7EB;
resize: none;
line-height: 1.5;
box-sizing: border-box;
/* Focus: border-color: #F97316 */
```

**Action Row buttons** (`Attach File`, `Attached Link`):
```css
height: 40px;
padding: 8px 16px;
border: 1px solid #E5E7EB;
border-radius: 8px;
background: #FFFFFF;
color: #475569;
font-size: 13px;
/* Hover: border-color #F97316, color #F97316 */
```

**Send Button:**
```css
height: 40px;
padding: 8px 20px;
border: none;
border-radius: 8px;
background: #F97316;
color: #FFFFFF;
font-size: 14px;
font-weight: 600;
/* Hover: background #EA580C */
```

---

## 6. Hệ thống Spacing – 8-Point Grid

| Khoảng cách | Giá trị | Vị trí áp dụng |
|---|---|---|
| `margin-bottom` panel header | 24px | Back & Action Row → Title |
| `margin-bottom` title block | 24px | Title + Status Grid → Section đầu tiên |
| `margin-bottom` section card | 24px | Khoảng giữa các Section Card |
| `margin` section title | `0 0 12px 0` | Tiêu đề Section → Section Card |
| `gap` detail-layout | 24px | Khoảng giữa left panel và right panel |
| `padding` detail-layout | 24px | Padding ngoài cùng |
| `padding` left/right panel | 24px | Padding bên trong card |
| `padding` section card | 16px | Padding bên trong section card |
| `gap` field grid | `16px 20px` | Khoảng giữa các field (row × column) |
| `gap` field-row | 4px | Label → Value trong 1 ô |
| `margin-bottom` tab header | 16px | Tabs → Tab content |
| `padding` sub-header | `0 0 12px 0` | Tên bảng con + Add button |
| `padding` comment card | 12px | Nội dung comment |

---

## 7. Quy tắc Nhất quán (Rules)

1. **Proper Case cho Field Labels:** Mỗi từ viết hoa chữ đầu. Code: `.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())`.
2. **Không dùng `min-height` cố định** cho field-row. Dùng `min-height: unset` để field tự co theo nội dung.
3. **Không tạo double border:** `.table-responsive` bên trong child container phải `border: none; background: transparent`.
4. **Gap = 0 trên `.detail-left`** – kiểm soát spacing qua `margin-bottom` từng block, không dùng `gap` chung.
5. **Giữ nguyên tất cả value, logic, API:** Chỉ thay đổi CSS/HTML wrapper, không chạm vào logic render value, getBadgeStyles(), formatNumber(), formatDateTime(), action buttons.
6. **Section title phải VIẾT HOA HOÀN TOÀN** (`text-transform: uppercase`), format số thứ tự + tên.
7. **Status grid nằm ngang trong 1 khung chung:** Tối đa 3 cột status, phân cách bởi divider dọc 1px, nền `#F8FAFC`.
8. **Accent color duy nhất:** `#F97316` – chỉ dùng cho active tab border, Add/Send buttons, tab count badge.
9. **Tab border-bottom:** Active = `2px solid #F97316`; Hover = `2px solid #E5E7EB`; Default = `2px solid transparent`. Tất cả có `margin-bottom: -2px` để căn đúng với border-bottom của tab container.
10. **Mobile Responsive:** Khi màn hình có chiều rộng nhỏ (`max-width: 900px`), `detail-right-card` chuyển sang `background: transparent; border: none; box-shadow: none`.
11. **Cuộn Ngang Bảng Con (Horizontal Scrolling):** Đảm bảo wrapper bọc ngoài bảng con (`.table-responsive` hoặc `#child-table-container-[childKey]`) có `overflow-x: auto` và `width: 100%`, đồng thời `<table>` bên trong phải có `min-width: max-content` và các ô `th`/`td` phải có `white-space: nowrap` để kích hoạt thanh cuộn ngang thay vì co cụm.
12. **Không lặp lại thông tin (No Redundant Fields):** Nếu một thông tin đã được hiển thị nổi bật ở phần Header hoặc Status Grid (ví dụ: `sr_status`, `process_status`, `payment_status`, v.v.), thì **bắt buộc** phải loại bỏ/không hiển thị trường đó trong các Section Card/Field Grid bên dưới để tránh lặp lại thông tin gây rối mắt và mất thẩm mỹ.

---

## 8. Checklist Kiểm Tra Trước Khi Deploy

- [ ] Field labels hiển thị dạng Proper Case (mỗi từ hoa chữ đầu)
- [ ] Section titles viết HOA TOÀN BỘ, đánh số thứ tự
- [ ] Khoảng cách giữa các Section Card = 24px
- [ ] Section title margin-bottom = 12px (không có margin-top)
- [ ] Không có double border trong child tables
- [ ] Tab active dùng `#F97316` border-bottom 2px
- [ ] Tab count badge màu `#F97316`, không có nền
- [ ] All input heights = 40px
- [ ] Send button height = 40px, background = `#F97316`
- [ ] Giá trị dữ liệu (value, status, badge) giữ nguyên
- [ ] Custom actions giữ nguyên, render trong `#detail-actions-container`
- [ ] Bảng con được cấu hình cuộn ngang (overflow-x: auto, min-width: max-content, white-space: nowrap)
- [ ] Không lặp lại các trường thông tin đã có trong Header/Status Grid ở danh sách field bên dưới.

---
*Tài liệu này định nghĩa chuẩn thiết kế Detail View 2 (giao diện cột trái thông tin / cột phải tabs chi tiết) áp dụng cho `buildDetailViewHTML` trong `public/app.js` và CSS tương ứng trong `public/style.css`.*
