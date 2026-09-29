# TeraX CRC App - Dashboard 2 Design System (Skill View Dashboard 2)
> **Trigger Command:** `/skill_view_dashboard2` (Khi lập trình viên yêu cầu thiết kế hoặc cập nhật giao diện Dashboard kiểu mới dành cho view `my_request`, Agent phải đọc file này và áp dụng 100% các nguyên tắc thiết kế dưới đây).

Tài liệu này định nghĩa hệ thống thiết kế chuẩn hóa (Design System Specs) cho việc xây dựng và phát triển giao diện Dashboard kiểu mới (**Dashboard 2** dành cho `my_request`), bao gồm các thông số chi tiết về Kích thước (Grid/Dimensions), Thẻ chỉ số (KPI Cards), Bộ lọc (Sidebar Filters), Bảng dữ liệu (Table View) và Bảng màu sắc (Color Palette).

---

## 1. Grid & Layout Dimensions (Bố cục chung)
* **Sidebar Width (Chiều rộng sidebar lọc bên trái):** `260px`
* **Header Height (Chiều cao header tìm kiếm & hành động):** `72px`
* **Vertical Gap (Khoảng cách giữa các phần):** `16px` (ví dụ: khoảng cách từ KPI Cards xuống thanh Tìm kiếm).
* **Bố cục chính:**
  - Sidebar cố định bên trái (`260px`), `border-right: 1px solid #E5E7EB`.
  - KPI Cards nằm ở phía trên cùng (`background: #F8FAFC`, `border-bottom: 1px solid #E5E7EB`).
  - Phần Table View chính (Main Table Area) co giãn bên phải của layout dưới, không có margin hay padding thừa làm lệch lề bảng.

---

## 2. KPI Cards (Thẻ đếm số lượng phía trên)
Thẻ chỉ số trạng thái phải tuân thủ nghiêm ngặt các thông số kích thước và căn lề để tránh bị quá to hoặc thô:
* **Thông số Card Container:**
  - **Height (Chiều cao):** `120px` (Bắt buộc, không dùng 72px hay tự động co giãn).
  - **Padding (Lề trong):** `16px`
  - **Gap between cards (Khoảng cách các card):** `16px`
  - **Border Radius (Độ bo góc):** `12px`
  - **Border (Đường viền):** `1px solid #E5E7EB`
  - **Background (Màu nền):** `#FFFFFF`
  - **Shadow (Đổ bóng nhẹ):** `0 1px 2px rgba(16, 24, 40, 0.04)`
  - **Layout:** Flex row (`display: flex; align-items: center; gap: 16px;`)
  - **Bottom Accent Border (Đường viền nhấn bên dưới):** Viền dưới dày `4px` có màu tương ứng với màu trạng thái của thẻ.
* **Bố cục thành phần trong Card:**
  - **Left (Bên trái) - Icon Wrapper:**
    - **Shape (Hình dáng):** Hình tròn hoàn hảo (`border-radius: 50%` hoặc `9999px`, không dùng hình vuông bo góc).
    - **Dimensions:** Rộng `40px`, Cao `40px`.
    - **Background:** Màu trạng thái nhạt (Light status color, ví dụ: `#FFF1E8` cho Submitted).
    - **Icon:** Căn giữa, cỡ icon `20px` hoặc `24px`, màu icon là màu trạng thái đậm (ví dụ: `#FF6A00` cho Submitted).
  - **Right (Bên phải) - Info Text:**
    - Container xếp dọc (`display: flex; flex-direction: column; gap: 4px;`).
    - **Number/Count (Số lượng):** Font size `24px`, Font weight `700` (Bold), Line height `32px`, Màu `#111827`.
    - **Label (Nhãn trạng thái):** Font size `13px`, Font weight `500` (Medium), Line height `20px`, Màu `#6B7280`.
    - **Text Case (Kiểu chữ):** Viết thường chuẩn Title Case (ví dụ: "Submitted", "In Approval", "Completed", "Rejected", "Draft"), tuyệt đối **không dùng chữ IN HOA** (UPPERCASE) vì sẽ làm card trông thô và chiếm nhiều diện tích.

---

## 3. Search & Actions Row (Thanh tìm kiếm và Nút bấm)
* **Search Input Height (Chiều cao ô tìm kiếm):** `48px`
* **Input Padding (Đệm trong ô nhập):** `12px 16px` (có 44px left padding cho icon search).
* **Add Button Height (Chiều cao nút thêm mới):** `40px`
* **Add Button Style:** Nền màu cam thương hiệu `#FF6A00`, chữ trắng, bo góc `8px`, hiển thị text dạng `+ Add` thay vì `+ Add Request`.
* **Border Radius (Bo góc các ô nhập/nút):** `8px`
* **Gap (Khoảng cách giữa ô tìm kiếm và các nút):** `12px`

---

## 4. Filters Sidebar (Cột lọc phân diện bên trái bảng)
* **Width (Chiều rộng cột lọc):** `260px`
* **Section Title (Tiêu đề nhóm lọc):** Font size `11px` (hoặc `12px`), Font weight `600`, Viết hoa toàn bộ (`text-transform: uppercase`), Letter-spacing `0.5px`, Màu `#374151`.
* **Badge Count (Số đếm bộ lọc):** Bo tròn hoàn hảo (`border-radius: 9999px`), màu nền xám nhạt `#F3F4F6` (khi chọn đổi sang cam nhạt `#FFF1E8`), cỡ chữ `11px` weight `500`.
* **Checkbox / Options:**
  - Ẩn các ô checkbox mặc định (`display: none`), thay thế bằng nhãn text tương tác đổi màu khi active để tối giản diện tích.
  - Khi active: Chữ chuyển sang màu cam `#FF6A00` và font weight `600`.
  - **Gap (Khoảng cách checkbox + nhãn):** `8px`

---

## 5. Advanced Filter Panel (Bộ lọc nâng cao)
* **Status (Trạng thái):** **ĐÃ LOẠI BỎ** (Đã được loại bỏ trong thiết kế của view `my_request`, không hiển thị panel này bên dưới KPI cards nữa).

---

## 6. Table / List View (Bảng danh sách dữ liệu)
* **Columns (Các cột):**
  - **Không hiển thị cột "Request ID"** (Cột mã yêu cầu kèm checkbox đã được loại bỏ). Cột đầu tiên hiển thị trực tiếp là cột **Description** (Mô tả).
* **Kích thước & Kiểu dáng bảng:**
  - **Header Height (Chiều cao dòng tiêu đề):** `48px`
  - **Header Font:** Font size `13px`, Font weight `600`, Line height `20px`, Màu `#6B7280`.
  - **Row Height (Chiều cao mỗi dòng dữ liệu):** `56px` (Bo tròn, đệm dọc chuẩn list view).
  - **Row Font:** Font size `13px`, Font weight `400`, Line height `20px`, Màu `#111827`.
  - **Cell Padding (Khoảng đệm ô):** `12px 16px`
  - **Row Border (Đường kẻ ngang giữa các dòng):** Màu xám siêu nhạt `#F1F5F9` hoặc `#E5E7EB`.
  - **Table Border Radius (Bo góc bảng):** `8px`

---

## 7. Pagination (Phần phân trang bên dưới bảng)
* **Height (Chiều cao thanh phân trang):** `48px`
* **Active Page Button (Nút trang hiện tại):** Có đường viền màu cam `#FF6A00` bao quanh.
* **Border Radius (Bo góc nút phân trang):** `6px`
* **Gap between items (Khoảng cách giữa các nút):** `8px`

---

## 8. Bảng màu sắc chuẩn (Color Palette)
* **Primary / Orange (Màu cam chủ đạo):** `#FF6A00`
* **Orange - Light (Cam nhạt nền):** `#FFF1E6` hoặc `#FFF1E8`
* **Success / Green (Hoàn thành):** `#22C55E`
* **Success - Light (Xanh nhạt nền):** `#ECFDF5`
* **Danger / Red (Từ chối):** `#EF4444`
* **Danger - Light (Đỏ nhạt nền):** `#FEF2F2`
* **Warning / Amber (Chờ duyệt):** `#F59E0B`
* **Warning - Light (Vàng nhạt nền):** `#FFFBEB`
* **Draft / Gray (Bản nháp):** `#6B7280`
* **Draft - Light (Xám nhạt nền):** `#F3F4F6`
* **Text - Primary (Chữ chính):** `#111827`
* **Text - Secondary (Chữ phụ):** `#6B7280`
* **Border / Line (Viền):** `#E5E7EB`
* **Background (Nền trang):** `#F8FAFC`
* **Card / Surface (Nền card/bảng):** `#FFFFFF`

---
*Mã lệnh kích hoạt: `/skill_view_dashboard2`. Lập trình viên bắt buộc phải kiểm tra và đối chiếu các thuộc tính CSS inline/stylesheet trong code để luôn đảm bảo tính đồng bộ với tài liệu này khi cập nhật hoặc phát triển dashboard `my_request`.*
