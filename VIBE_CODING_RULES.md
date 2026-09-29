# Quy Tắc Phát Triển & Phòng Ngừa Lỗi Vibe Coding (CRC App)

Tài liệu này định nghĩa các quy tắc nghiêm ngặt bắt buộc cho cả lập trình viên con người và các AI Agent khi tham gia nâng cấp, chỉnh sửa codebase. Mục tiêu tối thượng là **hạn chế tối đa lỗi phát sinh chéo (side-effects)** khi sửa đổi code.

---

## 1. Logic Code
*   **Validate Ở Cả Hai Đầu (Frontend & Backend):** 
    *   Không tin tưởng hoàn toàn vào frontend validation. Mọi endpoint API tiếp nhận dữ liệu ghi (`POST`, `PUT`, `PATCH`) bắt buộc phải sử dụng thư viện `zod` để validate cấu trúc và kiểu dữ liệu của payload trước khi truy vấn DB.
*   **Bảo Toàn State & Không Tải Lại Trang (No Flashing):** 
    *   Tránh sử dụng `location.reload()`. Khi thực hiện API thay đổi dữ liệu (ví dụ: tạo mới/chỉnh sửa), bắt buộc cập nhật thủ công bản ghi mới/thay đổi vào local cache frontend (`currentData` và `dashboardData`).
*   **Kiểm Soát Kiểu Dữ Liệu Chặt Chẽ:**
    *   Khuyến khích sử dụng các chú thích JSDoc (`/** @param {type} name */`) cho mọi hàm JavaScript để AI và IDE có thể cảnh báo lỗi kiểu dữ liệu ngay lập tức.
*   **Migration DB Tập Trung:**
    *   Tuyệt đối không sửa đổi cấu trúc DB thủ công bằng tay trên PGAdmin. Mọi thay đổi bảng phải được khai báo tập trung trong [server/db.js](file:///opt/app/dev/crc_app/server/db.js).

---

## 2. Logic Action (Hành động nghiệp vụ)
*   **Kiểm Tra Quyền Đầu API (Backend Enforcement):**
    *   Mọi action nghiệp vụ (phê duyệt, huỷ, phân bổ, chỉnh sửa) phải được xác thực quyền ở backend bằng hàm helper `checkPermission('action_rules', actionId, user, viewName)`.
*   **Bảo Toàn Máy Trạng Thái (State Machine):**
    *   Các trạng thái của Request (`Draft`, `Pending Approval`, `Approved`, `Rejected`, `Closed`, `Cancelled`) phải đi qua máy trạng thái tập trung. Cấm việc đổi trạng thái tùy tiện không qua các hàm phê duyệt được phân quyền.
*   **Giao Dịch Đảm Bảo (Database Transactions):**
    *   Các action làm thay đổi nhiều bảng liên đới bắt buộc phải thực thi trong một Database Transaction (`BEGIN` ... `COMMIT/ROLLBACK`) để tránh tình trạng rác dữ liệu khi một bước bị lỗi.

---

## 3. Logic Automation (Tự động hóa)
*   **Tính Idempotent (Chạy lại an toàn):**
    *   Mọi trigger, script đồng bộ (như sync tenant, cron job) khi chạy lại nhiều lần với cùng dữ liệu đầu vào **không được tạo ra dữ liệu trùng lặp** hoặc gây lỗi. Luôn sử dụng `ON CONFLICT DO NOTHING / UPDATE`.
*   **Database-First Audit Logs:**
    *   Không tạo thủ công trường `created_date`, `updated_date` bằng code JS. Các trường thay đổi và nhật ký chỉnh sửa phải được tự động ghi nhận bởi DB trigger (`trg_set_audit_fields` ghi vào bảng `audit_logs` hoặc cột `log` JSONB).
*   **Bẫy Lỗi Cô Lập (Error Isolation):**
    *   Các tác vụ tự động chạy nền (như gửi push notifications, gửi mail) nếu bị lỗi không được phép gây sập ứng dụng Node.js chính. Bắt buộc dùng `try/catch` và ghi log chi tiết lỗi ra `app.log`.

---

## 4. Logic Hiển Thị (Display)
*   **Cấu Hình Hóa Giao Diện (Config-Driven UI):**
    *   Hạn chế viết HTML cứng. Toàn bộ cấu trúc bảng, form, trường dữ liệu hiển thị phải tuân thủ khai báo thông qua đối tượng cấu hình `MODULES` trong [public/config.js](file:///opt/app/dev/crc_app/public/config.js).
*   **Ngăn Ngừa XSS (DOM Escaping):**
    *   Mọi chuỗi động khi chèn vào DOM (thông qua `.innerHTML` hoặc tương tự) bắt buộc phải được bọc bằng hàm `escapeHTML(str)`.
*   **Ẩn/Hiện Động Theo Quyền:**
    *   Việc ẩn/hiện cột hay action trên UI phải gọi qua hàm kiểm tra phân quyền tập trung (`window.isColumnAllowed`, `window.isActionAllowed`). Cấm code cứng kiểm tra role cụ thể trực tiếp trên file giao diện.

---

## 5. Tuân Thủ 3 Bảng Quy Tắc (Action, Menu, Column)
*   **Bảng Phân Quyền Menu (`exception_rules`):**
    *   Mọi trang/view mới được thêm vào cấu hình frontend bắt buộc phải được chèn tên tương ứng vào bảng `exception_rules` của DB để quản lý quyền truy cập.
*   **Bảng Phân Quyền Action (`action_rules`):**
    *   Tất cả các hành động thao tác (Add, Edit, Delete, Allocate, v.v.) phải đăng ký bằng một `action_id` duy nhất trong bảng `action_rules`. UI và API tương ứng bắt buộc phải validate theo `action_id` này.
*   **Bảng Phân Quyền Cột (`column_permissions`):**
    *   Các cột dữ liệu nhạy cảm phải được quản lý quyền truy cập thông qua bảng `column_permissions`. Frontend sử dụng `window.isColumnAllowed(moduleKey, colKey)` để ẩn/hiện cột thích hợp.
*   **Đồng Bộ Database-First:**
    *   Khi viết code thêm cột, thêm view hoặc action mới, lập trình viên phải cập nhật seed database trong [server/db.js](file:///opt/app/dev/crc_app/server/db.js) để các rule này luôn được chèn tự động khi deploy hệ thống mới.
