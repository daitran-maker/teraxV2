# 04 — UI & CSS ARCHITECTURE AUDIT

> **Scope:** Stylesheet Analysis, Design Tokens, Component Styles, Inconsistencies & V3 UI Package Mapping  
> **Source Directory:** `D:\CPI\teraxV2\public\style.css` (191KB, 7,255 lines)  
> **Target Migration Destination:** `D:\CPI\teraxV3\packages\ui`

---

## 1. Global CSS Architecture & Design Tokens

File [`public/style.css`](file:///d:/CPI/teraxV2/public/style.css) là một tệp CSS nguyên khối khổng lồ chứa toàn bộ phong cách của TeraX V2. 

### 1.1 Root CSS Custom Properties (Design Tokens)

Trích xuất trực tiếp từ [`public/style.css:3-35`](file:///d:/CPI/teraxV2/public/style.css#L3-L35):

```css
:root {
  /* Backgrounds */
  --bg-primary: #f0f2f5;
  --bg-secondary: rgba(255, 255, 255, 0.6);
  --bg-card: rgba(255, 255, 255, 0.75);
  --bg-hover: rgba(255, 255, 255, 0.9);
  
  /* Borders */
  --border: rgba(255, 255, 255, 0.8);
  --border-light: rgba(255, 255, 255, 0.5);

  /* Brand Accents */
  --accent: #1D4ED8;          /* Blue 700 - Brand Primary */
  --accent-hover: #1E40AF;    /* Blue 800 */
  --accent-green: #16a34a;    /* Green 600 - Success / Approved */
  --accent-red: #E30909;      /* Red 600 - Danger / Rejected / Errors */
  --accent-orange: #ea580c;   /* Orange 600 - Warnings / Drafts */
  --accent-purple: #7c3aed;   /* Purple 600 - Tier approvals */

  /* Text Colors */
  --text-primary: #171717;    /* Neutral 900 */
  --text-secondary: rgba(0, 0, 0, 0.7);
  --text-muted: rgba(0, 0, 0, 0.5);
  --text: #171717;
  --text-light: #ffffff;
  --text-light-muted: rgba(255, 255, 255, 0.6);

  /* Layout Dimensions */
  --sidebar-width: 260px;
  --header-h: 65px;

  /* Border Radii */
  --radius: 20px;
  --radius-sm: 10px;

  /* Shadows */
  --shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
  --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.04);

  /* Transitions */
  --transition: all 0.2s ease;
}
```

---

## 2. Typography & Fonts

- **Font Family Chính:** `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`.
- **Nạp Font:** Sử dụng `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap')` ở dòng 1 của `style.css`.
- **Trang Đăng Nhập (`login.html`):** Sử dụng font khác: `'Plus Jakarta Sans', 'Inter', sans-serif` ([`login.html:17`](file:///d:/CPI/teraxV2/public/login.html#L17)).
- **Icon Set:** Google Material Symbols Rounded (`font-size: 16px - 24px`).
- **Font Sizes Được Sử Dụng:**
  - Tiêu đề chính Topbar: `18px` (Font weight: `700`, line-height: `1.2`).
  - Tiêu đề section: `14px - 15px` (`font-weight: 600`).
  - Text bảng & Menu item: `13px` (`font-weight: 500`).
  - Subtitle, Hint, Tag, Badges: `11px - 12px` (`font-weight: 500`).
  - Version & Footer: `10px`.

---

## 3. Thành Phần Giao Diện (Component Styling Analysis)

### 3.1 Button Component (`.btn`)
- **Base Class:** `.btn`: `display: inline-flex`, `align-items: center`, `justify-content: center`, `border-radius: 8px`, `font-size: 13px`, `font-weight: 500`, `cursor: pointer`, `transition: all 0.2s ease`.
- **Variants:**
  - `.btn-primary`: Nền `var(--accent, #1D4ED8)`, chữ trắng, hover đổi màu sang `#1E40AF`.
  - `.btn-secondary`: Nền trắng hoặc xám nhạt `#f1f5f9`, border `#e2e8f0`, chữ `#334155`.
  - `.btn-danger`: Nền đỏ nhạt hoặc đỏ đậm `#ef4444`, chữ trắng.
  - `.btn-sm`: Chiều cao `28px - 32px`, font-size `12px`, padding `4px 10px`.
  - `.btn-icon`: Nút vuông chỉ chứa icon (`width: 32px`, `height: 32px`).

### 3.2 Form Controls & Input
- **Base Class:** `.form-input`, `.form-select`, `.form-textarea`:
  - `border: 1px solid #d1d5db`, `border-radius: 6px`, `padding: 8px 12px`, `font-size: 13px`.
  - Focus state: `outline: none`, `border-color: #2563eb`, `box-shadow: 0 0 0 3px rgba(37,99,235,0.1)`.
  - Trạng thái Disabled/Readonly: `background-color: #f8fafc`, `color: #64748b`, `cursor: not-allowed`.
- **Searchable Dropdown:**
  - Khung search dropdown tùy chỉnh có box shadow `0 10px 25px rgba(0,0,0,0.15)`, danh sách option có hỗ trợ phím mũi tên và scroll.
- **Select With Add:**
  - Ô chọn kèm nút `+ Thêm giá trị mới` cho phép người dùng gõ giá trị mới trực tiếp.

### 3.3 Data Table Component (`.data-table`, `.table-container`)
- **Cấu trúc:**
  - Bọc trong `.table-container` có `overflow-x: auto`, `position: relative`.
  - Table Header (`thead th`): Nền `#f8fafc`, chữ hoa nhạt `11px`, `font-weight: 600`, border-bottom `2px solid #e2e8f0`, `position: sticky; top: 0; z-index: 2`.
  - Table Rows (`tbody tr`): Chiều cao dòng chuẩn `44px - 48px`, hover đổi nền sang `#f1f5f9`.
  - Cột đầu tiên (Checkbox / ID) có `position: sticky; left: 0; z-index: 1; background: inherit` để cố định khi cuộn ngang.
  - Table Pagination (`.table-pagination`): Nằm dưới đáy bảng, hiển thị tổng số dòng, nút chuyển trang Trước/Sau, chọn số bản ghi/trang (`15`, `30`, `50`, `100`).

### 3.4 Modal & Slide-over Drawer (`.modal-overlay`, `.modal.slide-over`)
- **Modal Overlay:** `position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5); backdrop-filter: blur(4px); z-index: 1000`.
- **Slide-over Drawer (`.slide-over`):**
  - Chiều rộng `640px` (trên desktop), trượt từ cạnh phải (`transform: translateX(100%) -> translateX(0)`).
  - Header có tiêu đề và nút đóng `✕`.
  - Body cuộn độc lập (`overflow-y: auto`).
  - Footer chứa nút Hủy và Lưu được ghim cố định ở đáy.

### 3.5 Status Badges & Pills (`.badge`, `.status-pill`)
- Thiết kế bo tròn viền (`border-radius: 9999px`), padding `3px 8px`, `font-size: 11px`, `font-weight: 600`.
- Phân loại màu sắc theo trạng thái:
  - **Draft:** Nền xám `#F3F4F6`, chữ `#4B5563`.
  - **Pending / In Progress:** Nền vàng/cam `#FEF3C7`, chữ `#D97706`.
  - **Approved / Paid / Completed:** Nền xanh lá `#D1FAE5`, chữ `#059669`.
  - **Rejected / Cancelled / Void:** Nền đỏ `#FEE2E2`, chữ `#DC2626`.

### 3.6 Kanban Board (`.kanban-board`, `.kanban-column`)
- Áp dụng riêng cho module `#assigned_task`:
  - 3 cột: `Not started yet`, `Processing`, `Completed`.
  - Thẻ card `.kanban-card`: background trắng, border `#e2e8f0`, radius `8px`, bóng đổ nhẹ, hỗ trợ kéo thả HTML5 Drag and Drop API.

---

## 4. Phân Tích Responsive Breakpoints & Điểm Bất Cập

Qua kiểm tra toàn bộ file `style.css`, hệ thống có tới **10 media query breakpoints khác nhau** được viết rải rác:
- `@media (max-width: 1200px)`
- `@media (max-width: 1024px)`
- `@media (max-width: 900px)` (xuất hiện lặp lại 4 lần ở các đoạn khác nhau)
- `@media (max-width: 800px)`
- `@media (max-width: 768px)` (xuất hiện lặp lại 7 lần)
- `@media (min-width: 769px)`
- `@media (max-width: 600px)` (xuất hiện 2 lần)
- `@media (max-width: 576px)`
- `@media (max-width: 500px)`
- `@media (max-width: 480px)`
- `@media (max-width: 400px)`

### Hậu quả của việc thiếu chuẩn hóa Breakpoints:
1. **Tranh chấp CSS (Cascading conflicts):** Nhiều block `@media (max-width: 768px)` đè lẫn nhau do không được gom cụm.
2. **Giao diện giật trên Tablet ngang (900px - 1024px):** Một số bảng bị mất thanh cuộn ngang hoặc vỡ layout form.
3. **Mã CSS bị phình to:** Hàng ngàn dòng ghi đè thuộc tính thủ công.

---

## 5. Bảng Phân Loại CSS Hiện Tại (Classification)

```text
┌─────────────────┬───────────────────────────────────────────────────────────────┐
│ PHÂN LOẠI       │ DANH SÁCH THÀNH PHẦN                                          │
├─────────────────┼───────────────────────────────────────────────────────────────┤
│ REUSABLE        │ - Color palette tokens (Accent blue, status colors)           │
│ (Tái sử dụng)   │ - Button variants (.btn, .btn-primary, .btn-secondary)        │
│                 │ - Modal / Confirm dialog layouts                              │
│                 │ - Data Table base structure (sticky header, cell padding)     │
│                 │ - Status Badge / Pill styles                                  │
│                 │ - Toast notification popups                                   │
├─────────────────┼───────────────────────────────────────────────────────────────┤
│ DUPLICATED      │ - Breakpoint @media (max-width: 768px) lặp lại 7 lần          │
│ (Trùng lặp)     │ - Các class scrollbar custom được định nghĩa ở 5 selector     │
│                 │ - CSS cho User Switcher nằm cả trong style.css và index.html  │
│                 │ - Form input styles lặp lại giữa style.css và login.html      │
├─────────────────┼───────────────────────────────────────────────────────────────┤
│ LEGACY          │ - Gradient background SVG noise trên body (gây chậm GPU)      │
│ (Lạc hậu)       │ - Các style inline trong index.html                           │
│                 │ - CSS animation nhấp nháy dot status                          │
├─────────────────┼───────────────────────────────────────────────────────────────┤
│ PAGE-SPECIFIC   │ - Layout Kanban cho assigned_task                             │
│ (Đặc thù trang) │ - Stepper 4 bước của Setup Wizard                             │
│                 │ - Khung chat bình luận của Request Detail                     │
│                 │ - Slide-over drawer của Form Modal                            │
└─────────────────┴───────────────────────────────────────────────────────────────┘
```

---

## 6. Đề Xuất Ánh Xạ Sang `packages/ui` Trong V3

Khi di chuyển sang kiến trúc V3 tại `D:\CPI\teraxV3`, toàn bộ CSS tĩnh này sẽ được tái thiết kế thành thư viện thành phần React chuẩn hóa tại `packages/ui` (kết hợp Tailwind CSS v4 hoặc CSS Modules có design tokens):

| Thành phần V2 Hiện Tại | Component Đề Xuất Trong `packages/ui` (V3) | Công nghệ / Ghi chú |
|---|---|---|
| `:root` variables trong `style.css` | `tokens/colors.ts`, `tokens/spacing.ts`, `tokens/typography.ts` | Type-safe design tokens xuất ra Tailwind config hoặc CSS variables. |
| `.btn`, `.btn-primary`, `.btn-sm` | `<Button variant="primary \| secondary \| danger" size="sm \| md">` | Tích hợp loading spinner, icon slot, accessibility WAI-ARIA. |
| `.form-input`, `.form-select` | `<Input>`, `<Select>`, `<Textarea>`, `<FormField>` | Kết hợp React Hook Form + Zod resolver validation. |
| Searchable dropdown tùy biến | `<Combobox>` / `<SearchSelect>` | Hỗ trợ virtualized list cho danh mục hàng ngàn bản ghi. |
| `.data-table`, `.table-container` | `<DataTable>`, `<Table>`, `<Pagination>` | Dựa trên `@tanstack/react-table` (sorting, column filtering, virtual scroll). |
| `.modal-overlay`, `.modal.slide-over` | `<Dialog>`, `<Drawer>` | Dựa trên Radix UI Primitives hoặc Headless UI (hỗ trợ đóng bằng ESC, focus trap). |
| `.badge`, `.status-pill` | `<Badge variant="success \| warning \| danger \| neutral">` | Ánh xạ trực tiếp từ `status_catalog` enum của database. |
| `#toast-container` | `<ToastProvider>`, `<Toaster>` (hoặc Sonner) | Hỗ trợ stacked toast, dismiss swipe, action button. |
| `.sidebar` & Multi-tabs | `<AppShell>`, `<Sidebar>`, `<WorkspaceTabs>` | Layout wrapper hoàn chỉnh của ứng dụng web. |
| `.kanban-board` | `<KanbanBoard>`, `<KanbanColumn>`, `<KanbanCard>` | Dựa trên `@dnd-kit/core` hoặc Pragmatic Drag and Drop. |
| Setup Wizard Stepper | `<Stepper>`, `<Step>` | Điều hướng tiến trình nhiều bước tuần tự. |
