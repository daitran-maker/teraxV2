# TeraX CRC App - Standard View & Faceted Search Design System (Skill View)
> **Trigger Command:** `/skill_view` (Khi lập trình viên yêu cầu tạo view mới, Agent phải đọc file này và áp dụng 100% các nguyên tắc thiết kế dưới đây).

Tài liệu này định nghĩa hệ thống kiến trúc chuẩn hóa cho việc xây dựng các View dữ liệu trong hệ thống CRC App, bao gồm: **Bộ lọc Phân diện (Faceted Search), Thẻ chỉ số (Metric Cards), Phân trang phía Server (Server-Side Pagination) và Trình bày Layout chuẩn Premium**.

---

## 1. Triết lý Thiết kế & Cơ chế Phân Trang
Đối với các bảng dữ liệu lớn (như *Request, Payment, Expense, Employee*), hệ thống bắt buộc phải áp dụng cơ chế **Server-Side Pagination & Server-Side Filtering** để đảm bảo hiệu năng tối ưu:
1. **Truy vấn DB Toàn cục:** Server chịu trách nhiệm thực thi các phép tính toán nâng cao (SUM, COUNT, GROUP BY) trên toàn bộ cơ sở dữ liệu dựa theo điều kiện lọc để trả về tổng số lượng records thật, dữ liệu các thẻ Card, và số lượng khớp cho từng ô lọc (Faceted Counts).
2. **Giới hạn số dòng hiển thị:** Chỉ tải đúng **50 dòng dữ liệu** cho trang hiện tại lên giao diện Client để đảm bảo tốc độ render tức thời.
3. **Hiển thị Phân trang:** Thanh phân trang (Pagination Controls) phải luôn luôn hiển thị và cho phép người dùng bấm chuyển trang (Next/Prev) mượt mà kể cả khi đang bật bộ lọc. Cấm ẩn thanh phân trang khi có bộ lọc hoạt động đối với các module thuộc server-filtered.

---

## 2. Quy tắc Đồng bộ Bộ Lọc Phân Diện (Faceted Search)
Để đảm bảo các con số hiển thị trên giao diện đồng nhất 100% khi người dùng tương tác, mọi view mới đều phải áp dụng các quy tắc logic sau:

### A. Reset Số lượng Về 0 Trước Khi Cập Nhật
Khi người dùng chọn một bộ lọc (ví dụ: Chọn Năm `2025` có 600 records), Server sẽ trả về số lượng khớp của riêng các nhóm có dữ liệu. Để tránh tình trạng các năm khác vẫn giữ nguyên số cũ gây lệch số:
* **Quy tắc:** Phải thiết lập toàn bộ các lựa chọn đếm trong cùng danh mục lọc về `0` trước, sau đó mới ánh xạ kết quả `faceted_summary` từ Server trả về lên giao diện.
```javascript
// Ví dụ logic reset chuẩn trong frontend (buildDropdownFiltersHTML):
const companyCounts = {};
if (selectCache['my_company']) {
  selectCache['my_company'].forEach(c => { 
    companyCounts[c.company_shortname] = 0; // Đặt tất cả về 0 trước
  });
}
if (currentFacetedSummary && currentFacetedSummary.company_shortname) {
  // Sau đó mới đắp số liệu lọc thực tế từ Server vào
  for (const [k, v] of Object.entries(currentFacetedSummary.company_shortname)) {
    companyCounts[k] = v;
  }
}
```

### B. Bỏ qua Lọc trùng Client-Side cho Server-Side Modules
* **Quy tắc:** Trong hàm lọc giao diện (`applyAllFilters`), tuyệt đối **không được áp dụng lại bộ lọc dropdown cục bộ ở Client** cho các module thuộc nhóm `serverFilteredModules` (gồm: `employee`, `employee_active`, `payment`, `expense`, `request`). 
* **Lý do:** Dữ liệu trả về từ Server đã được SQL lọc chính xác theo điều kiện từ Database. Nếu Client chạy kiểm tra lại sẽ rất dễ bị lệch do sai lệch định dạng cache hoặc thiếu thông tin ID, dẫn đến lỗi trắng trang (0 row) không mong muốn.
```javascript
// Bỏ qua lọc dropdown cục bộ ở Client cho Server Modules:
let matchesDropdown = true;
if (!serverFilteredModules.includes(moduleKey) && Object.keys(dropdownFilters).length > 0) {
    // Chỉ thực hiện kiểm tra filter cục bộ đối với Client-Side Modules (My Request, My Approval...)
}
```

---

## 3. Thiết kế Thẻ Chỉ Số (Metric Cards) & Layout chuẩn
Một View chuẩn của CRC App phải đạt độ thẩm mỹ Premium với cấu trúc giao diện chặt chẽ:

### A. Layout Grid & Alignment
* View phải được bố trí theo mô hình **Sidebar lọc bên trái** (collapsible) và **Bảng dữ liệu bên phải** để tối ưu hóa không gian làm việc.
* Các Thẻ Chỉ Số (Metric Cards) phải nằm ở phía trên cùng của bảng dữ liệu, được hiển thị dưới dạng **Grid Layout** tự động co giãn đều.
* Màu sắc của Metric Cards phải sử dụng các tông màu chuyên nghiệp (Neutral/Harmonious), tránh sử dụng các màu quá sặc sỡ hoặc tương phản mạnh gây nhức mắt. Các số liệu trên Card phải tự động đồng bộ theo tổng số lượng của các bộ lọc đang kích hoạt.

### B. Ngăn Chặn Mất Chữ (Tooltip Native khi Hover)
* Các bộ lọc ở Sidebar có text quá dài (ví dụ: *Policy / Type, Department Name*) khi bị giới hạn chiều rộng của khung div sẽ bị mất chữ.
* **Quy tắc:** Bắt buộc phải thêm thuộc tính `title` chứa giá trị đầy đủ đã được escape HTML vào cả thẻ chứa `<label>` và thẻ hiển thị chữ `<span>` để hiển thị tooltip native của trình duyệt ngay lập tức khi rê chuột vào:
```javascript
return `
  <label class="dv-filter-option" title="${escapeHTML(val)}">
    <input type="checkbox" ... />
    <span class="dv-filter-checkbox"></span>
    <span class="dv-filter-text" title="${escapeHTML(val)}">${escapeHTML(val)}</span>
    <span class="dv-filter-count">${formatNumber(count)}</span>
  </label>
`;
```

---

## 4. Danh sách các Module Lọc Server (Server-Side Modules)
Bất cứ khi nào khai báo hoặc tạo mới một View dữ liệu lớn, hãy thêm nó vào danh sách `serverFilteredModules` ở cả đầu Frontend và Backend:
* **Mảng khai báo frontend:** `const serverFilteredModules = ['employee', 'employee_active', 'payment', 'expense', 'request', 'TÊN_VIEW_MỚI'];`
* **Backend:** Lắng nghe tham số lọc tương ứng trong query, thực hiện tạo câu lệnh `WHERE ... IN (...)` động và trả về cấu trúc dữ liệu chuẩn:
```json
{
  "data": [ ... 50 dòng dữ liệu ... ],
  "meta": {
    "total": 600,
    "page": 1,
    "limit": 50,
    "totalPages": 12,
    "summary": { "Active": 400, "Inactive": 200 },
    "faceted_summary": {
      "status": { "Active": 400, "Inactive": 200 },
      "company_shortname": { "CRTC": 350, "TeraX": 250 }
    }
  }
}
```

---
*Khi áp dụng tài liệu này với mã lệnh `/skill_view`, Agent cam kết triển khai cấu trúc code chuẩn chỉ, logic không lỗi và deploy trực tiếp thông qua hệ thống SSH/SFTP tự động.*
