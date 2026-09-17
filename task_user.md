# Task List

## Group 1: config.js Changes
- [x] 1.1 Xóa Internal khỏi contract type options
- [x] 1.2 Xóa finance_splits khỏi invoice.children (config.js)
- [x] 1.3 Fix Submit Date → Submitted Date, Close Date → Closed Date
- [x] 1.4 My Company child_count: bỏ prefix label (app.js fix)
- [x] 1.5 Payment columns: di chuyển value/currency sau payment_type, xóa vat column
- [x] 1.6 Đổi tên My Process Owner → My Task (index.html + hide assigned_task)
- [x] 1.7 Project field trong contract → dropdown Opportunity
- [x] 1.8 Payment term → required (frontend + API)

## Group 2: app.js Changes  
- [x] 2.1 Anti-duplicate save guard (submitAdd + submitEdit)
- [x] 2.2 Xóa Section 4 Finance Information trong Request Detail
- [x] 2.3 Ẩn assigned_task khỏi navigation (display:none)
- [x] 2.4 Payment: validate payment_period là integer, payment_term required
- [x] 2.5 Payment PAY TO: hiển thị company label thay vì shortname
- [x] 2.6 Payment from Contract: lock counter_party field
- [x] 2.7 Contract No bắt buộc khi có Signed Date (frontend + API POST + API PUT)
- [x] 2.8 Xóa dòng total "Outgoing: X VND" khỏi payment list footer
- [x] 2.9 Freeze/sticky header fix
- [x] 2.11 Xóa allocation finance references (openAllocateProgramModal, split_payment, etc.)
- [x] 2.12 History & Logs format cải thiện (badges, hover effects, smooth expand, field labels translated)
- [x] 2.13 Account refresh sau khi tạo mới
- [x] 2.14 My Company child_count display (chỉ số, không có prefix)

## Group 3: server Changes
- [x] 3.1 Xóa allocation action_rules seeds (db.js: DELETE split_payment, allocate_*)
- [x] 3.2 Xóa finance_splits column creation → DROP thay ADD
- [x] 3.3 Xóa finance_splits logic từ actions.js và dynamic_crud.js
- [x] 3.4 API-level contract/payment validation (dynamic_crud.js POST + PUT)

## Group 4: DB Migration Script  
- [x] 4.1 Tạo migration script: update contract type=71 → NULL (scratch file)
- [x] 4.2 Tạo migration script: drop finance_splits columns (integrated vào db.js)

## Group 5: Báo cáo Finance Element Columns
- [x] 5.1 Kiểm tra bảng finance schema (init.sql)
- [x] 5.2 Báo cáo cột có/chưa có → xem kết quả dưới

### Finance Chart of Accounts (bảng `finance`) - Columns hiện có:
| Column | Có |
|--------|-----|
| fcid (PK) | ✅ |
| finance_account_number | ✅ |
| finance_account_name | ✅ |
| finance_type | ✅ |
| english_name | ✅ |
| description | ✅ |
| example | ✅ |
| status | ✅ |
| department | ✅ |
| finance_account_standard | ✅ |
| operation_type | ✅ |

> ⚠️ Bảng `finance` CHƯA có module config (columns/fields/detailFields) trong config.js - cần bổ sung nếu muốn quản lý Chart of Accounts trong app

## ✅ HOÀN THÀNH TOÀN BỘ YÊU CẦU MỚI:
1. Xóa hẳn `assigned_task`:
   - Xóa thẻ link menu khỏi `index.html` (không chỉ là display:none).
   - Xóa `assigned_task` khỏi `request.children` trong `config.js`.
   - Xóa `assigned_task` khỏi bộ lọc child tabs và quyền trong `app.js`.
2. Fix triệt để Freeze Table Header & Columns:
   - Header: Tất cả các cột `<th>` được gán `position: sticky; top: 0; z-index: 11; background: #F8FAFC;` đảm bảo khi cuộn dọc dòng tiêu đề luôn đứng cố định.
   - Column: Cố định cột ID / Description (`my_task`, `my_process_owner`, `my_request`, `my_approval`, `my_team`, `request`, `payment`, `contract`, `invoice`, `employee`, `finance`, v.v.) cùng checkbox và menu với `z-index: 15` (header) / `10` (body) khi cuộn ngang.
3. Dropdown có < 3 tùy chọn:
   - Tự động chuyển đổi các trường chọn (select) có 1 hoặc 2 options thành dạng Segmented Control (nút bấm pill như `Payment type`) giúp thao tác 1 chạm trực quan.
4. Xóa vĩnh viễn 3 action liên quan Allocation:
   - Đã xóa sạch 3 action `split_payment`, `allocate_invoice`, `allocate_contract` trực tiếp trong database PostgreSQL.
   - Đảm bảo trong `server/db.js` có lệnh tự động xóa khi khởi động server, không lưu trong seed/init để khi clone app mới không bao giờ bị sinh lại.
5. Sửa lỗi Task list trong view Task / Dashboard:
   - Bổ sung cả thông báo "Đã ghim" (`is_pinned`) vào danh sách Task Pending, tự động đồng bộ khi bấm nút Ghim 📌.
   - Khi bấm hoàn thành task, tự động gỡ cả cờ và ghim (`is_flagged = false, is_pinned = false`) ở cả frontend và backend API.
   - Đã bump asset version lên `?v=1025` trong `index.html`.
