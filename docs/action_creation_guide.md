# Hướng Dẫn Cấu Hình & Tự Động Hóa Custom Action Trong CRC App

Tài liệu này đóng vai trò là một **Skill / Action Template** chuẩn hóa. Bạn có thể gửi trực tiếp nội dung phần **[Skill Prompt Template]** ở cuối tài liệu này kèm theo bảng thông tin Action cho bất kỳ AI Agent nào (hoặc chính tôi trong các phiên làm việc tiếp theo) để tự động hóa toàn bộ quy trình thiết lập.

---

## 1. Bản Đồ Ánh Xạ (Mapping Architecture)

Khi bạn cung cấp thông tin Action dưới dạng bảng:

| Cột Bảng | Ý nghĩa & Vị trí ánh xạ trong Source Code |
| :--- | :--- |
| **Table** | Tên bảng dữ liệu vật lý (VD: `request`, `invoice`, `payment`). Được lưu vào cột `table_name` của bảng `action_rules`. |
| **Action ID** | Định danh duy nhất (VD: `change_sr_owner`). Được lưu vào cột `action_id` trong `action_rules` và là key trong đối tượng `ACTION_LOGIC` ở Backend. |
| **Display name** | Tên hiển thị của nút bấm (VD: `Change SR Owner`). Được lưu vào cột `display_name` trong bảng `action_rules` và làm nhãn hiển thị ở Frontend. |
| **Description** | Mô tả chức năng. Được lưu vào cột `description` trong bảng `action_rules`. |
| **Feature** | Logic nghiệp vụ xử lý dữ liệu (VD: `Update column SR owner`). Được cài đặt trong hàm xử lý `UPDATE` tương ứng trong API endpoint `/api/actions/execute` ở `server/routes/actions.js`. |
| **Behavior** | Điều kiện logic để hiển thị nút bấm (VD: Trạng thái, Phân quyền động). Được ánh xạ thành hàm kiểm tra điều kiện `when(record, user)` trong `ACTION_LOGIC` tại `server/routes/actions.js`. |
| **Icon** | Mô tả icon (VD: Hình người kèm cây bút). Được AI thiết kế thành mã SVG inline siêu nhẹ, sắc nét và chèn trực tiếp vào thuộc tính `icon` của Action. |

---

## 2. Các Bước Thực Hiện Thực Tế (Quy Trình Hoạt Động)

Để thiết lập hoàn chỉnh một Action mới, AI Agent sẽ tự động thực hiện 4 bước sau:

### Bước 2.1: Seed Metadata Vào Database (`action_rules`)
AI sẽ chạy lệnh SQL hoặc tạo script Node.js tạm thời để thêm luật phân quyền tĩnh/động cho Action:
```sql
INSERT INTO action_rules (action_id, table_name, display_name, description, roles, exceptions) 
VALUES ('change_sr_owner', 'request', 'Change SR Owner', 'Update SR Owner of this request', '[POLICY LEAD]', '')
ON CONFLICT (action_id) DO UPDATE 
SET display_name = EXCLUDED.display_name, description = EXCLUDED.description, roles = EXCLUDED.roles;
```
*(Ghi chú: Ký hiệu `[POLICY LEAD]` đại diện cho phân quyền động, hệ thống sẽ tự so khớp email của user đăng nhập với cột `policy_lead` của dòng request hiện tại).*

### Bước 2.2: Định Nghĩa Logic Nghiệp Vụ Ở Backend (`server/routes/actions.js`)
Trong đối tượng `ACTION_LOGIC`, thêm định nghĩa chi tiết cho Action ID:
```javascript
'change_sr_owner': {
  label: 'Change SR Owner',
  color: 'var(--accent)',
  icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M14 19a6 6 0 0 0-12 0"></path><circle cx="8" cy="9" r="4" fill="currentColor"></circle><text x="8" y="10" font-size="3.5" font-family="Arial, sans-serif" font-weight="bold" fill="#ffffff" text-anchor="middle" style="stroke:none;">SR</text><path d="M18 2 L22 6 L12 16 L8 16 L8 12 Z"></path><path d="M11 11 L13 13"></path></svg>`,
  when: (r, u) => {
    // 1. SR Status = Submitted
    const isSubmitted = r.sr_status === 'Submitted';
    
    // 2. Approval status = Approved (Kiểm tra xem ít nhất 1 cấp phê duyệt đã duyệt)
    const isApproved = r.tier_1_status === 'Approved' || r.tier_2_status === 'Approved' || r.tier_3_status === 'Approved';

    // 3. User thuộc [Policy Lead] (Phân quyền động kiểm tra so khớp Email)
    const isPolicyLead = r.policy_lead && u && r.policy_lead.toLowerCase() === u.email.toLowerCase();

    // 4. Process status nằm trong nhóm "Processing, Not started yet"
    const isProcessStatusValid = ['Processing', 'Not start yet', 'Not started yet'].includes(r.process_status);

    return isSubmitted && isApproved && isPolicyLead && isProcessStatusValid;
  }
}
```

Và thêm nhánh xử lý hành động khi được gọi tại API endpoint `/execute`:
```javascript
if (action_id === 'change_sr_owner') {
  const { sr_owner } = req.body.data || {};
  if (!sr_owner) throw new Error("Vui lòng cung cấp SR Owner mới");
  await client.query(`UPDATE request SET sr_owner = $2 WHERE request_id = $1`, [record_id, sr_owner]);
}
```

### Bước 2.3: Xử Lý Render & Hiển Thị Động Ở Frontend (`public/app.js`)
Hệ thống Frontend tự động gọi API `/api/actions/:tableName/:recordId` để lấy danh sách các Action hợp lệ với dòng bản ghi hiện tại và user đăng nhập.
* Frontend render nút bấm kèm theo Icon SVG dạng inline một cách đẹp mắt:
  ```javascript
  const iconHTML = act.icon ? `<span class="action-icon" style="margin-right: 6px; display: inline-flex; align-items: center; justify-content: center; vertical-align: middle;">${act.icon}</span>` : '';
  return `<button class="btn" style="background:${act.color}; color:#fff; display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px;" onclick="executeAction('${act.action_id}', '${moduleKey}', '${pkVal}')">${iconHTML}<span>${act.label}</span></button>`;
  ```

* Thêm logic hộp thoại nhập liệu hoặc xác nhận trước khi gửi yêu cầu lên server:
  ```javascript
  if (actionId === 'change_sr_owner') {
    const newOwner = prompt("Vui lòng nhập Email của SR Owner mới:");
    if (!newOwner) return; // Hủy bỏ
    extraData.sr_owner = newOwner;
  }
  ```

---

## 3. [Skill Prompt Template] - Dành Cho Các Lần Trao Đổi Tiếp Theo

Khi bạn muốn thêm Action mới, hãy copy đoạn prompt dưới đây, điền thông tin vào bảng và gửi cho AI:

```text
Chào bạn, tôi muốn thêm một số Action mới vào ứng dụng CRC dựa trên thiết kế hệ thống hiện tại. Dưới đây là bảng đặc tả thông tin các Action:

[BẢNG THÔNG TIN ACTION]
Table: <Tên bảng vật lý, VD: request>
Action ID: <Mã action, VD: change_sr_owner>
Display name: <Tên nút bấm hiển thị, VD: Change SR Owner>
Description: <Mô tả chức năng, VD: Update SR Owner of this request>
Feature: <Hành động cập nhật DB, VD: Update column SR owner>
Behavior: <Điều kiện hiển thị logic, VD: SR Status = Submitted & Approval status = Approved & user thuộc [Policy lead] & process status thuộc [Processing, Not started yet]>
Icon: <Mô tả icon cần vẽ, VD: Vẽ icon hình người có chữ SR bên trong và cây bút kế bên>

Hãy thực hiện đầy đủ các bước sau:
1. Tạo script/SQL query chèn metadata vào bảng `action_rules` (Lưu ý chèn đầy đủ `display_name`, `description` và ánh xạ vai trò tĩnh hoặc động [ROLE] tương ứng).
2. Định nghĩa Action trong đối tượng `ACTION_LOGIC` ở `server/routes/actions.js` bao gồm hàm `when(r, u)` kiểm tra điều kiện nghiệp vụ chặt chẽ, màu sắc và vẽ mã SVG inline đẹp mắt, chuyên nghiệp theo mô tả.
3. Thêm code xử lý nghiệp vụ khi execute Action trong route `/execute` tại `server/routes/actions.js`.
4. Cập nhật `executeAction` trong `public/app.js` để thu thập dữ liệu bổ sung qua prompt (nếu có) hoặc hiển thị hộp thoại xác nhận trước khi thực hiện hành động.
```

---

> [!NOTE]
> Tôi đã cấu hình hoàn chỉnh Action mẫu **`change_sr_owner`** vào source code của dự án CRC App. Bạn có thể kiểm tra trực tiếp nút bấm trên giao diện chi tiết Request của Policy Lead khi đáp ứng đủ các điều kiện trạng thái yêu cầu!
