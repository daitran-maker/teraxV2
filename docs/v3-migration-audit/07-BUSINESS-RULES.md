# 07 — BUSINESS RULE AUDIT & HARDCODED LOGIC CATALOG

> **Scope:** Comprehensive Audit of Hardcoded Business Rules across Frontend, Backend, SQL, Triggers & Cron  
> **Source Directory:** `D:\CPI\teraxV2`  
> **Target Migration Destination:** `D:\CPI\teraxV3`

---

## 1. Hardcoded Rules Catalog

Dưới đây là danh mục toàn bộ các quy tắc nghiệp vụ đang bị "hardcode" (viết cứng) trong mã nguồn, cơ sở dữ liệu và trigger:

---

### Rule BR-01: Auto-Approve Tier 0 Requests
- **Location:** [`server/routes/actions.js:1406-1414`](file:///d:/CPI/teraxV2/server/routes/actions.js#L1406-L1414) và [`server/models/requestModel.js:62`](file:///d:/CPI/teraxV2/server/models/requestModel.js#L62)
- **Condition:** `if (flow.total_levels === 0 || policy.approval_level.toLowerCase().includes('tier 0'))`
- **Behavior:** Khi người dùng nhấn Submit (`ACT-REQUEST-09`), yêu cầu lập tức chuyển thẳng sang trạng thái `Approved (3)` mà không tạo bước chờ duyệt `Pending Approval (2)`, đồng thời thiết lập `flow.steps = []`.
- **Affected module:** Request, Workflow.
- **Risk if changed:** Nếu logic này thay đổi hoặc bị thiếu trong V3, các yêu cầu thông báo đơn giản (Tier 0) sẽ bị kẹt ở trạng thái chờ duyệt vĩnh viễn vì không có ai được gán làm người duyệt.

---

### Rule BR-02: Payment Request (RPM) Auto-Completion upon Approval
- **Location:** [`server/routes/actions.js:1614-1624`](file:///d:/CPI/teraxV2/server/routes/actions.js#L1614-L1624)
- **Condition:** `if (isPaymentReq && Number(finalSrStatusId) === 3)` (với `isPaymentReq` khi `request_type === '5'` hoặc `'RPM'` hoặc `'PAYMENT'`)
- **Behavior:** Khi Yêu cầu thanh toán đạt bước phê duyệt cuối cùng, hệ thống tự động gán `process_status = 9` (Completed), `process_start_date = CURRENT_TIMESTAMP`, `process_end_date = CURRENT_TIMESTAMP` mà không bắt nhân viên vận hành phải bấm nút Bắt đầu (Start) và Hoàn thành (Complete) thủ công.
- **Affected module:** Request, Payment.
- **Risk if changed:** Các phiếu thanh toán sẽ bị treo ở trạng thái `Processing` hoặc `Not started yet`, làm gián đoạn báo cáo tiến độ và trải nghiệm người dùng.

---

### Rule BR-03: Cross-Table Sync: Request Approval to Payment Status
- **Location:** [`server/routes/actions.js:1626-1650`](file:///d:/CPI/teraxV2/server/routes/actions.js#L1626-L1650) và [`server/helpers/automationHelper.js:5-16`](file:///d:/CPI/teraxV2/server/helpers/automationHelper.js#L5-L16)
- **Condition:** Request loại Payment (`request_type === '5'` hoặc `'RPM'`) được duyệt thành công (`finalSrStatusId === 3`).
- **Behavior:** Tự động chạy truy vấn SQL:
  ```sql
  UPDATE "payment" 
  SET payment_status = 31 -- Ready for payment
  WHERE payment_request = $1 OR (request = $1 AND payment_status IN (30, 121))
  ```
  Sau đó phát broadcast sự kiện realtime SSE `db_change` cho bảng `payment`.
- **Affected module:** Request, Payment, Finance.
- **Risk if changed:** Phiếu chi không tự động mở trạng thái `Ready for payment`, kế toán thanh toán sẽ không biết để thực hiện chuyển tiền.

---

### Rule BR-04: Cross-Table Sync: Request Approval to Invoice Status
- **Location:** [`server/routes/actions.js:1651-1673`](file:///d:/CPI/teraxV2/server/routes/actions.js#L1651-L1673)
- **Condition:** Request loại Hóa đơn (`request_type === '12'` hoặc `'INV'`) được phê duyệt.
- **Behavior:** Tự động chạy SQL:
  ```sql
  UPDATE "invoice" SET invoice_status = 35 -- Ready to issue
  WHERE request = $1 OR invoice_request = $1
  ```
- **Affected module:** Request, Invoice.
- **Risk if changed:** Hóa đơn VAT bị kẹt ở trạng thái nháp, không thể phát hành cho khách hàng.

---

### Rule BR-05: Payment Request Rejection & Cancellation Reversion
- **Location:** [`server/routes/actions.js:1724-1747`](file:///d:/CPI/teraxV2/server/routes/actions.js#L1724-L1747) và [`1759-1782`](file:///d:/CPI/teraxV2/server/routes/actions.js#L1759-L1782)
- **Condition:** Một Request loại Payment (`request_type === '5'` hoặc `'RPM'`) bị Từ chối (`reject_request`) hoặc Hủy (`ACT-REQUEST-05`).
- **Behavior:** Hệ thống tự động phục hồi bản ghi Payment liên kết:
  ```sql
  UPDATE "payment" 
  SET payment_status = 30, -- Draft
      payment_request = NULL 
  WHERE payment_request = $1
  ```
  Giải phóng liên kết để người dùng có thể chỉnh sửa lại số tiền và tạo yêu cầu duyệt chi mới.
- **Affected module:** Request, Payment.
- **Risk if changed:** Phiếu thanh toán bị khóa vĩnh viễn ở trạng thái 121 (Submitted for payment), gây thất thoát dữ liệu và người dùng không thể tạo lại phiếu chi.

---

### Rule BR-06: Automatic Task Spawning on Request Start
- **Location:** [`server/routes/actions.js:1847-1950`](file:///d:/CPI/teraxV2/server/routes/actions.js#L1847-L1950)
- **Condition:** Khi action Start (`ACT-REQUEST-08`) được thực thi trên Request có thành phần `elements` chứa `'ASSIGN_TASK'`.
- **Behavior:** Duyệt danh sách nhân viên trong `assign_to`, sinh mã ID tuần tự (`generateSequentialId('assigned_task')`), chèn các bản ghi vào bảng `assigned_task` với trạng thái `62` (Not started yet), sau đó tự động gửi Web Push và In-app notification tới từng nhân viên được giao việc.
- **Affected module:** Request, Assigned Task, Notification.
- **Risk if changed:** Nhân sự phụ trách không nhận được công việc được giao khi yêu cầu bắt đầu triển khai.

---

### Rule BR-07: Outgoing Payment Request Generation Flow
- **Location:** [`server/routes/actions.js:1951-2185`](file:///d:/CPI/teraxV2/server/routes/actions.js#L1951-L2185)
- **Condition:** Người dùng nhấn action `payment_req_outgoing` trên phiếu chi Outgoing.
- **Behavior:**
  - Tự động sinh mã Request mới: `5-<DDMMYY>-<Initials>-<Seq>`.
  - Cập nhật `payment.payment_status = 121` (Submitted for payment), gán `payment.payment_request = newPaymentReqId`.
  - Tự động gộp chuỗi mô tả từ số tiền, loại tiền, đối tác, mã phiếu:
    `desc = "${desc} | ${amount} ${currency} | ${partyName} | Outgoing (${payment_id})"`.
  - Gọi `RequestModel.resolveApprovals()` để tự động gán quy trình duyệt từ policy `5`.
  - Chèn bản ghi mới vào bảng `request` và phát SSE.
- **Affected module:** Payment, Request.
- **Risk if changed:** Gãy luồng trình ký chi tiền nội bộ của doanh nghiệp.

---

### Rule BR-08: Automatic Invoice Creation upon Selling Contract Payment
- **Location:** [`server/routes/actions.js:2252-2325`](file:///d:/CPI/teraxV2/server/routes/actions.js#L2252-L2325)
- **Condition:** Action `payment_paid` được thực thi trên một khoản thanh toán thuộc hợp đồng loại Bán (`contract.type === 69` hoặc `'Selling'`).
- **Behavior:**
  - Kiểm tra xem đã có hóa đơn nào cho `payment_id` này chưa.
  - Nếu chưa có: Tự động sinh `invoice_id` mới qua `generateSequentialId('invoice')`, tự động tính `total_value = valBeforeVat + vatVal`, nhân tỷ giá quy đổi sang base currency VND (`valVnd`, `vatVnd`, `totalValVnd`), sau đó chèn vào bảng `invoice` với trạng thái `Paid` (Đã thanh toán) và `source = 'Contract'`.
- **Affected module:** Payment, Contract, Invoice.
- **Risk if changed:** Hợp đồng bán sau khi khách trả tiền sẽ không tự động xuất hóa đơn, gây sai lệch sổ sách kế toán thuế.

---

### Rule BR-09: Bank Transaction (MTR) Permission & Date Override
- **Location:** [`server/routes/actions.js:2191-2240`](file:///d:/CPI/teraxV2/server/routes/actions.js#L2191-L2240)
- **Condition:** Action `payment_paid`, `payment_change_mtr`, `payment_update_transaction` được gọi.
- **Behavior:**
  - Kiểm tra xem người dùng hiện tại có nằm trong danh sách email của `account.finance_control` hoặc `account.transaction_managed_by` của tài khoản ngân hàng tương ứng không (trừ Super Admin).
  - Tự động truy vấn ngày giao dịch thực tế `transaction_date` từ bảng `mtr` và **ghi đè** vào cột `payment_date` của phiếu chi (ưu tiên ngày sao kê ngân hàng hơn ngày do người dùng chọn trên form).
- **Affected module:** Payment, Account, MTR.
- **Risk if changed:** Người không có thẩm quyền có thể tự do gán sao kê tài khoản ngân hàng; ngày thanh toán bị sai lệch so với sổ phụ ngân hàng.

---

### Rule BR-10: Low Rating Justification Enforcement
- **Location:** [`server/routes/actions.js:1341-1345`](file:///d:/CPI/teraxV2/server/routes/actions.js#L1341-L1345) và [`2336-2338`](file:///d:/CPI/teraxV2/server/routes/actions.js#L2336-L2338)
- **Condition:** `if (r.point <= 3 && !r.comment.trim())`
- **Behavior:** Bắt buộc người dùng phải nhập nội dung bình luận giải trình lý do đánh giá thấp khi chấm điểm $\le 3$ sao trên Request hoặc Ticket. Nếu bỏ trống, backend lập tức từ chối và ném lỗi 400.
- **Affected module:** Request, Support.
- **Risk if changed:** Người dùng có thể đánh giá 1 sao vô căn cứ mà không ghi nhận được nguyên nhân khiếu nại.

---

### Rule BR-11: Midnight Due Date Cron for Outgoing Payments
- **Location:** [`server/cron.js:16-25`](file:///d:/CPI/teraxV2/server/cron.js#L16-L25)
- **Condition:** Hàng ngày vào lúc 00:00 (`0 0 * * *`).
- **Behavior:** Chạy câu lệnh SQL:
  ```sql
  UPDATE "payment"
  SET payment_status = 31, -- Ready for payment
      updated_by = 'system_cron'
  WHERE payment_type = 61      -- Outgoing
    AND payment_status = 30    -- Draft
    AND due_date <= CURRENT_DATE
  ```
- **Affected module:** Payment, Cron.
- **Risk if changed:** Các khoản chi đến hạn trả nợ sẽ không tự động chuyển sang trạng thái chờ chi, dẫn đến chậm thanh toán cho nhà cung cấp.

---

### Rule BR-12: Database-Level Request Submit Enforcement Trigger
- **Location:** [`migrations/2026-08-01_request_submit_status_trigger.sql:1-63`](file:///d:/CPI/teraxV2/migrations/2026-08-01_request_submit_status_trigger.sql#L1-L63)
- **Condition:** Trigger `trg_request_submit_status` chạy `BEFORE INSERT OR UPDATE OF sr_status ON public.request`.
- **Behavior:**
  - Nếu `NEW.sr_status = 2` (Pending Approval): Nếu `sr_submitted_date IS NULL` $\rightarrow$ tự động gán `CURRENT_TIMESTAMP`, đồng thời quét JSONB `approval_flow->'steps'`, ép bước duyệt 1 từ trạng thái 7/1 sang trạng thái `2` (Pending).
  - Nếu `NEW.sr_status = 1` (Draft): Tự động ép `process_status = 7` (Not started yet), reset toàn bộ các bước trong JSONB về 7 và xóa `action_by`, `action_date`.
- **Affected module:** Request, Database Trigger.
- **Risk if changed:** Tính nhất quán giữa cột trạng thái chính `sr_status` và mảng JSONB `approval_flow` sẽ bị phá vỡ.

---

### Rule BR-13: Contract Request Propagation Trigger
- **Location:** [`init.sql:163-172`](file:///d:/CPI/teraxV2/init.sql#L163-L172)
- **Condition:** Trigger `trg_propagate_contract_request` chạy `BEFORE UPDATE ON public.contract` khi `OLD.request IS DISTINCT FROM NEW.request`.
- **Behavior:** Tự động đồng bộ:
  ```sql
  UPDATE public.payment SET request = NEW.request WHERE contract_id = NEW.contract_id;
  UPDATE public.invoice SET request = NEW.request WHERE contract_id = NEW.contract_id;
  ```
- **Affected module:** Contract, Payment, Invoice.
- **Risk if changed:** Khi đổi hợp đồng sang một dự án/yêu cầu mới, các phiếu chi và hóa đơn con sẽ bị mồ côi hoặc trỏ về yêu cầu cũ.

---

### Rule BR-14: Contract Source Synchronization Trigger
- **Location:** [`init.sql:186-200`](file:///d:/CPI/teraxV2/init.sql#L186-L200)
- **Condition:** Trigger `trg_sync_payment_request` và `trg_sync_invoice_request` chạy `BEFORE INSERT OR UPDATE ON payment / invoice`.
- **Behavior:**
  ```sql
  IF NEW.contract_id IS NOT NULL THEN
      SELECT request INTO NEW.request FROM public.contract WHERE contract_id = NEW.contract_id;
      NEW.source := 'Contract';
  ELSE
      IF NEW.source IS NULL THEN NEW.source := 'Request'; END IF;
  END IF;
  ```
- **Affected module:** Payment, Invoice, Contract.
- **Risk if changed:** Nguồn phát sinh chứng từ (`source`) bị sai lệch, gây lỗi lọc báo cáo tài chính.

---

### Rule BR-15: Cascade Soft Delete Trigger
- **Location:** [`init.sql:71-125`](file:///d:/CPI/teraxV2/init.sql#L71-L125)
- **Condition:** Trigger `trg_cascade_soft_delete` chạy `AFTER UPDATE` khi `OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL`.
- **Behavior:** Tự động truy vấn catalog khóa ngoại PostgreSQL và cascade gán `deleted_at = CURRENT_TIMESTAMP` cho toàn bộ các bản ghi con ở các bảng khác trỏ về bản ghi này.
- **Affected module:** Toàn bộ 47 bảng trong hệ thống.
- **Risk if changed:** Khi xóa một Request hoặc Contract cha, các bản ghi con (Payment, Invoice, Task, Comment) sẽ bị sót lại thành dữ liệu rác hiển thị trên các màn hình khác.
