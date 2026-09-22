-- ============================================================================
-- CREATE TABLE AND SEED DATA FOR public.status_catalog
-- Matches values in server/helpers/statuses.js
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.status_catalog (
  id INTEGER PRIMARY KEY,
  table_name VARCHAR(100) NOT NULL,
  column_name VARCHAR(100) NOT NULL,
  status_key VARCHAR(100) NOT NULL,
  display_name_vi VARCHAR(100) NOT NULL,
  display_name_en VARCHAR(100) NOT NULL,
  color_code VARCHAR(50),
  log JSONB DEFAULT '[]'::jsonb,
  deleted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.status_catalog ADD COLUMN IF NOT EXISTS display_name_vi VARCHAR(100);
ALTER TABLE public.status_catalog ADD COLUMN IF NOT EXISTS display_name_en VARCHAR(100);
ALTER TABLE public.status_catalog ADD COLUMN IF NOT EXISTS log JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.status_catalog ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

CREATE SEQUENCE IF NOT EXISTS public.status_catalog_id_seq
  AS integer
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

ALTER SEQUENCE public.status_catalog_id_seq OWNED BY public.status_catalog.id;
ALTER TABLE ONLY public.status_catalog ALTER COLUMN id SET DEFAULT nextval('public.status_catalog_id_seq'::regclass);

-- Grant permissions if roles exist
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'teraxadmin') THEN
    GRANT ALL ON TABLE public.status_catalog TO teraxadmin;
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'helpdesk_admin') THEN
    GRANT ALL ON TABLE public.status_catalog TO helpdesk_admin;
  END IF;
END $$;

-- Insert status catalog items
INSERT INTO public.status_catalog (id, table_name, column_name, status_key, display_name_vi, display_name_en, color_code) VALUES
  (1, 'request', 'sr_status', 'draft', 'Bản nháp', 'Draft', '#64748b'),
  (2, 'request', 'sr_status', 'pending_approval', 'Chờ duyệt', 'Pending Approval', '#3b82f6'),
  (3, 'request', 'sr_status', 'approved', 'Đã duyệt', 'Approved', '#10b981'),
  (4, 'request', 'sr_status', 'rejected', 'Từ chối', 'Rejected', '#ef4444'),
  (5, 'request', 'sr_status', 'closed', 'Đã đóng', 'Closed', '#64748b'),
  (6, 'request', 'sr_status', 'cancelled', 'Đã hủy', 'Cancelled', '#ef4444'),
  (7, 'request', 'process_status', 'not_started', 'Chưa bắt đầu', 'Not started yet', '#64748b'),
  (8, 'request', 'process_status', 'processing', 'Đang xử lý', 'Processing', '#3b82f6'),
  (9, 'request', 'process_status', 'completed', 'Đã hoàn thành', 'Completed', '#10b981'),
  (10, 'ticket', 'sr_status', 'draft', 'Bản nháp', 'Draft', '#64748b'),
  (11, 'ticket', 'sr_status', 'pending', 'Chờ xử lý', 'Pending', '#3b82f6'),
  (12, 'ticket', 'sr_status', 'in_progress', 'Đang xử lý', 'In Progress', '#3b82f6'),
  (13, 'ticket', 'sr_status', 'completed', 'Đã hoàn thành', 'Completed', '#10b981'),
  (14, 'ticket', 'process_status', 'not_started', 'Chưa bắt đầu', 'Not started yet', '#64748b'),
  (15, 'ticket', 'process_status', 'processing', 'Đang xử lý', 'Processing', '#3b82f6'),
  (16, 'ticket', 'process_status', 'completed', 'Đã hoàn thành', 'Completed', '#10b981'),
  (17, 'employee', 'status', 'active', 'Hoạt động', 'Active', '#10b981'),
  (18, 'employee', 'status', 'inactive', 'Không hoạt động', 'Inactive', '#ef4444'),
  (19, 'account', 'account_status', 'active', 'Hoạt động', 'Active', '#10b981'),
  (20, 'account', 'account_status', 'inactive', 'Không hoạt động', 'Inactive', '#ef4444'),
  (21, 'asset', 'status', 'draft', 'Bản nháp', 'Draft', '#64748b'),
  (22, 'asset', 'status', 'pending', 'Chờ duyệt', 'Pending', '#3b82f6'),
  (23, 'asset', 'status', 'in_progress', 'Đang xử lý', 'In Progress', '#3b82f6'),
  (24, 'asset', 'status', 'approved', 'Đã duyệt', 'Approved', '#10b981'),
  (25, 'asset', 'status', 'completed', 'Đã hoàn thành', 'Completed', '#10b981'),
  (26, 'service', 'status', 'draft', 'Bản nháp', 'Draft', '#64748b'),
  (27, 'service', 'status', 'pending', 'Chờ duyệt', 'Pending', '#3b82f6'),
  (28, 'service', 'status', 'in_progress', 'Đang xử lý', 'In Progress', '#3b82f6'),
  (29, 'service', 'status', 'completed', 'Đã hoàn thành', 'Completed', '#10b981'),
  (30, 'payment', 'payment_status', 'draft', 'Bản nháp', 'Draft', '#64748b'),
  (31, 'payment', 'payment_status', 'ready_for_payment', 'Sẵn sàng thanh toán', 'Ready for payment', '#3b82f6'),
  (32, 'payment', 'payment_status', 'paid', 'Đã thanh toán', 'Paid', '#10b981'),
  (33, 'payment', 'payment_status', 'deleted', 'Đã xóa', 'Deleted', '#ef4444'),
  (34, 'invoice', 'invoice_status', 'draft', 'Bản nháp', 'Draft', '#64748b'),
  (35, 'invoice', 'invoice_status', 'ready_to_issue', 'Sẵn sàng xuất', 'Ready to issue', '#3b82f6'),
  (36, 'invoice', 'invoice_status', 'issued', 'Đã xuất', 'Issued', '#3b82f6'),
  (37, 'invoice', 'invoice_status', 'paid', 'Đã thanh toán', 'Paid', '#10b981'),
  (38, 'invoice', 'invoice_status', 'void', 'Bị hủy', 'Void', '#ef4444'),
  (39, 'invoice', 'invoice_status', 'deleted', 'Đã xóa', 'Deleted', '#ef4444'),
  (40, 'cms_tenant_info', 'billing_status', 'active', 'Hoạt động', 'Active', '#10b981'),
  (41, 'cms_tenant_info', 'billing_status', 'grace', 'Gia hạn thêm', 'Grace', '#ffa500'),
  (42, 'cms_tenant_info', 'billing_status', 'expired', 'Hết hạn', 'Expired', '#ef4444'),
  (43, 'cms_tenant_info', 'billing_status', 'canceled', 'Đã hủy', 'Canceled', '#ef4444'),
  (44, 'cms_tenant_info', 'billing_status', 'inactive', 'Ngừng hoạt động', 'Inactive', '#64748b'),
  (45, 'cms_tenant_info', 'subscription_status', 'active', 'Hoạt động', 'Active', '#10b981'),
  (46, 'cms_tenant_info', 'subscription_status', 'grace', 'Gia hạn thêm', 'Grace', '#ffa500'),
  (47, 'cms_tenant_info', 'subscription_status', 'expired', 'Hết hạn', 'Expired', '#ef4444'),
  (48, 'cms_tenant_info', 'subscription_status', 'canceled', 'Đã hủy', 'Canceled', '#ef4444'),
  (49, 'cms_tenant_info', 'subscription_status', 'inactive', 'Ngừng hoạt động', 'Inactive', '#64748b'),
  (50, 'my_location', 'status', 'active', 'Hoạt động', 'Active', '#10b981'),
  (51, 'my_location', 'status', 'inactive', 'Không hoạt động', 'Inactive', '#ef4444'),
  (52, 'oppotunity', 'status', 'open', 'Mở', 'Open', '#3b82f6'),
  (53, 'oppotunity', 'status', 'closed_won', 'Thành công', 'Closed Won', '#10b981'),
  (54, 'oppotunity', 'status', 'closed_lost', 'Thất bại', 'Closed Lost', '#ef4444'),
  (55, 'mtr', 'status', 'draft', 'Bản nháp', 'Draft', '#64748b'),
  (56, 'mtr', 'status', 'approved', 'Đã duyệt', 'Approved', '#10b981'),
  (57, 'finance', 'status', 'active', 'Hoạt động', 'Active', '#10b981'),
  (58, 'finance', 'status', 'inactive', 'Không hoạt động', 'Inactive', '#ef4444'),
  (60, 'payment', 'payment_type', 'incoming', 'Khoản thu', 'Incoming', '#10b981'),
  (61, 'payment', 'payment_type', 'outgoing', 'Khoản chi', 'Outgoing', '#f59e0b'),
  (62, 'assigned_task', 'status', 'not_started', 'Chưa bắt đầu', 'Not started yet', '#64748b'),
  (63, 'assigned_task', 'status', 'processing', 'Đang xử lý', 'Processing', '#3b82f6'),
  (64, 'assigned_task', 'status', 'completed', 'Hoàn thành', 'Completed', '#10b981'),
  (65, 'task_subtask', 'status', 'pending', 'Chờ xử lý', 'Pending', '#f59e0b'),
  (66, 'task_subtask', 'status', 'completed', 'Hoàn thành', 'Completed', '#10b981'),
  (67, 'my_company', 'status', 'active', 'Hoạt động', 'Active', '#10b981'),
  (68, 'my_company', 'status', 'inactive', 'Ngưng hoạt động', 'Inactive', '#ef4444'),
  (69, 'contract', 'type', 'selling', 'Bán ra', 'Selling', '#10B981'),
  (70, 'contract', 'type', 'buying', 'Mua vào', 'Buying', '#EF4444'),
  (71, 'contract', 'type', 'internal', 'Nội bộ', 'Internal', '#6366F1'),
  (72, 'expense', 'id__expense_type', 'expense', 'Chi phí', 'Expense', '#3b82f6'),
  (73, 'expense', 'id__expense_type', 'non_expense', 'Không phải chi phí', 'Non-Expense', '#64748b'),
  (74, 'expense', 'id__expense_cost', 'operation_cost', 'Chi phí vận hành', 'Operation Cost', '#10b981'),
  (75, 'expense', 'id__expense_cost', 'sales_cost', 'Chi phí bán hàng', 'Sales Cost', '#f59e0b'),
  (76, 'expense', 'id__expense_cost', 'fixed_cost', 'Chi phí cố định', 'Fixed cost', '#6366f1'),
  (77, 'expense', 'id__expense_cost', 'variable_cost', 'Chi phí biến đổi', 'Variable cost', '#ec4899'),
  (78, 'expense', 'id__expense_cost', 'operation_expense', 'Chi phí vận hành', 'Operation expense', '#06b6d4'),
  (79, 'expense', 'id__expense_cost', 'sale_expense', 'Chi phí bán hàng', 'Sale expense', '#8b5cf6'),
  (80, 'expense', 'id__expense_cost', 'others', 'Khác', 'Others', '#94a3b8'),
  (81, 'service', 'service_type', 'subcription', 'Thuê bao', 'Subcription', '#3b82f6'),
  (82, 'service', 'service_type', '1_time_service', 'Dịch vụ 1 lần', '1 Time service', '#10b981'),
  (83, 'service', 'service_type', 'rental_loan', 'Thuê | Mượn', 'Rental | Loan', '#f59e0b'),
  (84, 'service', 'service_type', 'borrow', 'Mượn', 'Borrow', '#8b5cf6'),
  (85, 'service', 'service_type', 'annual_renew', 'Gia hạn hàng năm', 'Annual Renew', '#06b6d4'),
  (117, 'request', 'process_status', 'canceled', 'Đã hủy', 'Canceled', '#ef4444'),
  (118, 'ticket', 'sr_status', 'cancelled', 'Đã hủy', 'Cancelled', '#ef4444'),
  (119, 'ticket', 'process_status', 'cancelled', 'Đã hủy', 'Cancelled', '#ef4444'),
  (120, 'ticket', 'process_status', 'draft', 'Bản nháp', 'Draft', '#64748b')
ON CONFLICT (id) DO UPDATE SET
  table_name = EXCLUDED.table_name,
  column_name = EXCLUDED.column_name,
  status_key = EXCLUDED.status_key,
  display_name_vi = EXCLUDED.display_name_vi,
  display_name_en = EXCLUDED.display_name_en,
  color_code = EXCLUDED.color_code;

SELECT setval('public.status_catalog_id_seq', (SELECT COALESCE(MAX(id), 1) FROM public.status_catalog));
