# Kế Hoạch Triển Khai Action - RQC 0206

Dựa vào file `RQC_0206_action.xlsx` kết hợp với các tiêu chuẩn trong `action_creation_guide.md` (các nút bấm có icon 24px bên trên, text 7px bên dưới, sử dụng hộp thoại Prompt morph tự động thành Select nếu có ref), dưới đây là Kế Hoạch Triển Khai Action.

Vui lòng xem qua và comment trực tiếp vào file này tại các phần có đánh dấu **[CẦN LÀM RÕ]**.

---

## PHẦN 1: CÁC ACTION TRÊN BẢNG `REQUEST`

| Display Name | Điều kiện kích hoạt (Behavior) | Xử lý Backend (Feature & Cột thay đổi) | Ghi chú & Modal (UI) |
| :--- | :--- | :--- | :--- |
| **Withdraw** | **[CẦN LÀM RÕ]** Chưa có điều kiện áp dụng. *(Đề xuất: `SR Status = 'Submitted'` và `Approval Status = 'Pending'`)* | Reset các cột về trạng thái mới tạo ban đầu. Xóa dữ liệu link. | Không cần nhập liệu thêm. |
| **Update Elements** | **[CẦN LÀM RÕ]** File ghi: `SR Status = Draft` VÀ `Approval = Approved`. *(Ghi chú: Draft thì chưa thể Approved, nên đổi `SR Status` thành `Submitted`?)* <br>User = `[POLICY LEAD]` hoặc `[SR OWNER]`. Process in `Processing`, `Completed`. | Cho phép cập nhật cột `Elements`. | Hiển thị hộp thoại (Prompt) tự động hiển thị Drop-down để user chọn `Element`. |
| **Re-Update Process Status** | `SR Status = Submitted`, `Approval = Approved`, User = `[POLICY LEAD]`, `Process Status = Completed`. | Update cột `Process status`. | Hộp thoại chọn Drop-down trạng thái Process. |
| **Request Cancel** | `SR Status = Submitted`, `Approval = Approved`, User in `[SR OWNER, POLICY LEAD]`, `Process Status = Processing`. | `Process Status` = Canceled, `Process End Date` = Now(), `SR Status` = Closed, `SR Close Date` = Now(). | Xác nhận Yes/No. |
| **Request Closed** | `SR Status = Submitted`, `Approval = Approved`, User in `[SR CREATER, REQUESTER]`, `Process Status = Completed`. | Cập nhật `Rating`, `Rating comment`, `SR Status` = Closed, `SR Close Date` = Now(). | Hiển thị hộp thoại Prompt yêu cầu nhập: <br>- **Rating**: Drop-down (1-5) <br>- **Comment**: Text input |
| **Request Complete** | `SR Status = Submitted`, `Approval = Approved`, User in `[SR OWNER, POLICY LEAD]`, `Process Status = Processing`. | `Process Status` = Completed, `Process End Date` = Now(). | Xác nhận Yes/No. |
| **Request Start** | `SR Status = Submitted`, `Approval = Approved`, User in `[SR OWNER, POLICY LEAD]`, `Process Status = Not started yet`. | `Process Status` = Processing, `Process End Date` = Now(). | Xác nhận Yes/No. |
| **Submit** | `SR Status = Draft`, User in `[REQUESTER, SR CREATER]`. | `SR Status` = Submitted, `Tier 1 Status` = Pending approval, `SR Created Date` = Now(). | Không cần nhập liệu. |
| **View main request** | Mọi trạng thái có link. | Trỏ link/chuyển tab tới Main Request tương ứng. (Là hành vi UI navigation). | Không gọi API cập nhật dữ liệu. |
| **CRUD Mặc định** | (Thêm, Xóa, Sửa Request) | Hệ thống đã có sẵn, sẽ set Permission để **Edit/Delete** chỉ hiện khi `SR Status = Draft` hoặc `Tier 1 Status <> Approved`. | |

---

## PHẦN 2: CÁC ACTION TRÊN BẢNG `PAYMENT` (VÀ LIÊN KẾT TẠO REQUEST)

Với các hành động chia thành **"Bước 1" & "Bước 2"**, hệ thống sẽ **Gộp thành 1 API Action duy nhất** để đảm bảo tính toàn vẹn (Transaction) – chỉ cần ấn 1 nút, tự xử lý Update Payment và Insert Request.

| Display Name | Điều kiện kích hoạt (Behavior) | Xử lý Backend (Gộp Bước 1 & 2) | Ghi chú & Modal (UI) |
| :--- | :--- | :--- | :--- |
| **Payment Request** | User thuộc list (Requester, Creater, Policy Lead, SR Owner) của Request gốc. <br> `Payment Status` in `[Draft, Not due yet]`. <br> `Payment Type = Outgoing`. | 1. Update Payment Status = `Submitted for payment`. Sinh ID `PAYMENT REQUEST`.<br>2. Insert Request mới (Type: `02a2cf1e`, Desc: ghép từ info payment, Status: `Submitted`). | Sinh tự động, Không cần nhập liệu. |
| **Request Collection** | Giống trên nhưng `Payment Status = Pending payment`, `Type = Incoming`. | 1. Update Payment Status = `Collection working`. Sinh ID `PAYMENT REQUEST`.<br>2. Insert Request mới (Type: `02a2cf1e`, Desc: tương tự trên, Status: `Submitted`). | Sinh tự động, Không cần nhập liệu. |
| **Request Payment Status** | User thuộc list trên. `Payment Status` in `[Draft, Not due yet, Pending payment, Collection working]`. `Type = Incoming`. | 1. Update Payment Status = `Pending confirmation`. Sinh ID `PAYMENT REQUEST`.<br>2. Insert Request mới (Type: `37eace9f`, Desc: tương tự trên, Status: `Submitted`). | Sinh tự động, Không cần nhập liệu. |
| **Paid** | User là `[POLICY LEAD]` hoặc `[SR OWNER]` của `Process ID = 02a2cf1e`. `Payment Status <> Paid`. | Update `Payment Status` = Paid. Cập nhật `Transaction ID`. | **Hiển thị Modal:** Yêu cầu chọn `Transaction ID` (từ MTR Transaction). |
| **Ready for Payment** | Không có điều kiện ràng buộc. | Update `Payment Status` = Ready for payment. | Xác nhận Yes/No. |
| **Update Transaction** | `Payment status = Paid`. | Cập nhật `Transaction ID`. | **Hiển thị Modal:** Chọn `Transaction ID` (tương tự như Paid). |

---

## CÁC ĐIỂM CẦN REVIEW & COMMENT (ACTION):

1. **[CẦN LÀM RÕ] - Nút "Update Elements" bảng Request:** 
   - Điều kiện đang ghi là: `SR Status = Draft` VÀ `Approval Status = Approved`. 
   - *Comment của Dev:* Hai trạng thái này thường mâu thuẫn (Draft thì chưa Approved). Bạn có muốn đổi thành `SR Status = Submitted` không? Vui lòng sửa lại điều kiện này.
2. **[CẦN LÀM RÕ] - Nút "Withdraw" bảng Request:**
   - Điều kiện hiển thị nút này là gì?
   - *Comment của Dev:* Có phải chỉ cho Withdraw khi `SR Status = Submitted` và `Approval Status = Pending` không?

---

## PHẦN 3: CÁC AUTOMATION BACKGROUND JOBS (SCHEDULED & TRIGGERED)

Dựa trên file `RQC_0206_automation.xlsx`, dưới đây là kế hoạch triển khai các luồng chạy tự động ngầm (Automation) đối với các sự kiện định kỳ hoặc khi có biến động dữ liệu:

| Loại Automation | Bảng Mục Tiêu | Nội dung | Điều kiện kích hoạt (Filter / Trigger) | Hành động thực thi (Update) |
| :--- | :--- | :--- | :--- | :--- |
| **Scheduled Job (Daily)** | **Payment** | Cập nhật `Payment Status` thành **"Pending payment"** | Cần đạt 2 điều kiện:<br>1. Ngày hạn chót: `DUE DATE <= TODAY()`<br>2. Thỏa mãn loại Payment:<br>&nbsp;&nbsp;&nbsp;- Nếu `Outgoing`: Status hiện tại là "Ready for payment"<br>&nbsp;&nbsp;&nbsp;- Nếu `Incoming`: Status hiện tại khác "Paid" | Update `PAYMENT STATUS` = "Pending payment" |
| **Scheduled Job (Daily)** | **Payment** | Cập nhật `Payment Status` thành **"Not due yet"** | Cần đạt 2 điều kiện:<br>1. Chưa tới hạn: `DUE DATE > TODAY()`<br>2. Trạng thái thanh toán hiện tại khác "Paid": `PAYMENT STATUS <> "Paid"` | Update `PAYMENT STATUS` = "Not due yet" |
| **Data Change Trigger** | **Payment** | Khi một **[Payment request]** được duyệt (Approved), tự động cập nhật Trạng thái Thanh toán thành "Ready for payment" | **Bảng Gốc:** Bảng `Request`<br>**Trigger:** `APPROVAL STATUS` chuyển sang "Approved" VÀ `REQUEST TYPE` = "02a2cf1e" (Payment Request)<br>**Target Filter:** Lấy các dòng `Payment` có ID nằm tại field `PAYMENT REQUEST` trong bảng Request hiện tại. | Update `PAYMENT STATUS` = "Ready for payment" |
| **Data Change Trigger** | **Invoice** | Khi một **[Invoice request]** được duyệt (Approved), tự động cập nhật Trạng thái Hóa đơn thành "Ready to issue" | **Bảng Gốc:** Bảng `Request`<br>**Trigger:** `APPROVAL STATUS` chuyển sang "Approved" VÀ `REQUEST TYPE` = "02a2cf1d" (Invoice Request)<br>**Target Filter:** Lấy các dòng `Invoice` có ID nằm tại field `INVOICE REQUEST` trong bảng Request hiện tại. | Update `INVOICE STATUS` = "Ready to issue" |

---

## QUYẾT ĐỊNH TRIỂN KHAI CHO AUTOMATION (ĐÃ CHỐT):

3. **Cấu hình Daily Schedule:** Đã thống nhất thiết lập 1 bộ đếm thời gian (CRON Job) chạy ngầm tự động vào lúc **00:00 mỗi ngày** để rà soát toàn bộ bảng `Payment` và tự động cập nhật Status theo các điều kiện về `DUE DATE`.
4. **Quan hệ Data Change Trigger:** Đã thống nhất triển khai theo hướng **API nội bộ / Backend Hook**. Cụ thể, khi có API cập nhật bảng `Request` chuyển trạng thái sang `Approved`, backend sẽ xử lý nhanh và an toàn việc cập nhật liên đới qua bảng `Payment` / `Invoice` mà không làm giảm hiệu năng (non-blocking hoặc chạy transaction tối ưu).

---

## PHẦN 4: HỆ THỐNG NOTIFICATION (PUSH & EMAIL)

Dựa trên file `RQC_0206_notification.xlsx`, dưới đây là kế hoạch triển khai tính năng bắn thông báo (Notification) khi có các sự kiện thay đổi dữ liệu quan trọng. *(Ghi chú: Đã tạm bỏ qua việc xử lý dòng rule có nhiệm vụ sinh file tự động theo yêu cầu của bạn, phần đó sẽ làm sau).*

| Bảng Mục Tiêu | Điều kiện kích hoạt (Event) | Người Nhận (TO) | Tiêu Đề (Title) & Nội Dung (Body) |
| :--- | :--- | :--- | :--- |
| **PAYMENT** | Trạng thái Payment đổi thành **"Paid"** | Những người liên quan đến Payment và Request gốc: `REQUESTER`, `SR CREATER`, `SR OWNER`, `POLICY LEAD` | **Title:** CP.TeraX.AI notification \| Payment <br>**Body:** Hiển thị chi tiết Payment Status, Loại, Số tiền, Người nhận, Mô tả... |
| **REQUEST** | Có sự thay đổi ở **TIER 1 STATUS** (Khác Draft) | `[TIER 1 APPROVAL]` | **Title:** CP.TeraX.AI notification \| Request <br>**Body:** [TIER 1 STATUS] : [Tên Process] \| [Mô tả] \| [Người tạo] \| [Ngày tạo] |
| **REQUEST** | Có sự thay đổi ở **TIER 2 STATUS** (Khác Draft) | `[TIER 2 APPROVAL]` | (Tương tự như Tier 1) |
| **REQUEST** | Có sự thay đổi ở **TIER 3 STATUS** (Khác Draft) | `[TIER 3 APPROVAL]` | (Tương tự như Tier 1) |
| **REQUEST** | Có sự thay đổi ở **APPROVAL STATUS** (Khác Draft) | `REQUESTER`, `SR CREATER`, `SR OWNER`, `POLICY LEAD` | **Title:** CP.TeraX.AI notification \| Request <br>**Body:** [APPROVAL STATUS] : [Tên Process] \| [Mô tả] \| [Người tạo] \| [Ngày tạo] |
| **REQUEST** | **[Payment Request]** chuyển `PROCESS STATUS` sang **"Processing"** | `SR CREATER`, `REQUESTER`, `POLICY LEAD`, `SR OWNER` | **Title:** CP.TeraX.AI notification \| Request <br>**Body:** Dear Money Account Owner. Please make money transaction for... |
| **COMMENT** | Có Comment mới hoặc cập nhật Comment | `COMMENT BY`, `TO`, `SR CREATER`, `REQUESTER` | **Title:** CP.TeraX.AI notification \| Request <br>**Body:** Hiển thị nội dung comment, người tạo, thời gian. |

---

## QUYẾT ĐỊNH TRIỂN KHAI CHO NOTIFICATION (ĐÃ CHỐT):

1. **Phương thức gửi (Web Push Notification):** 
   - 100% sử dụng Notification đẩy qua Web App.
   - Khi vào App, hệ thống sẽ popup yêu cầu cấp quyền hiển thị thông báo (`Notification.requestPermission()`).
   - Sẽ thiết kế 1 khu vực Notification Center (ví dụ icon quả chuông) ngay trên giao diện gọn gàng.
   - Danh sách thông báo có nút đánh dấu chưa đọc / đã đọc.
   - Sắp xếp: Ưu tiên Chưa đọc lên trước, sau đó mới sort theo thời gian mới nhất.
   - Khi click vào 1 thông báo, hệ thống sẽ đánh dấu đã đọc và chuyển hướng (redirect) tới đúng Request/Payment liên quan.
2. **Xử lý danh sách người nhận (Unique & Spam):** 
   - Có thể gửi nhiều lần (không giới hạn số lần trigger).
   - Tuy nhiên, trước khi bắn ra, Backend sẽ filter list email người nhận để đảm bảo **Unique** (duy nhất). Nếu 1 người kiêm nhiều vai trò (vừa là Requester vừa là Policy Lead), họ sẽ chỉ nhận 1 Notification duy nhất cho sự kiện đó thay vì bị nhận đúp.
