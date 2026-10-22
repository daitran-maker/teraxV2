-- ============================================================================
-- Migration: Add Status Catalog for Opportunity, Service Delivery, Task Request
-- Date: 2026-10-19
-- ============================================================================

BEGIN;

-- 1. Ensure status_catalog has status_value column
ALTER TABLE public.status_catalog ADD COLUMN IF NOT EXISTS status_value INTEGER;
UPDATE public.status_catalog SET status_value = id WHERE status_value IS NULL;

-- 2. Clean up old/placeholder catalog entries for oppotunity, service_delivery_contract, service_task_request
DELETE FROM public.status_catalog WHERE id IN (52, 53, 54, 140, 141, 142, 143, 150, 151, 152, 153, 154, 155);
DELETE FROM public.status_catalog WHERE table_name IN ('oppotunity', 'opportunity', 'service_delivery_contract', 'service_task_request');

-- 3. Insert new status catalog entries
INSERT INTO public.status_catalog (id, status_value, table_name, column_name, status_key, display_name_en, display_name_vi, color_code)
VALUES
  -- ── OPPORTUNITY (OPPO): STATUS (1..10) ──
  (201, 1, 'oppotunity', 'status', 'cancel', 'Cancel', 'Đã hủy', '#EF4444'),
  (202, 2, 'oppotunity', 'status', 'closed', 'Closed', 'Đã đóng', '#64748B'),
  (203, 3, 'oppotunity', 'status', 'commit', 'Commit', 'Cam kết', '#3B82F6'),
  (204, 4, 'oppotunity', 'status', 'internal', 'Internal', 'Nội bộ', '#8B5CF6'),
  (205, 5, 'oppotunity', 'status', 'lost', 'Lost', 'Thất bại', '#DC2626'),
  (206, 6, 'oppotunity', 'status', 'open', 'Open', 'Đang mở', '#0EA5E9'),
  (207, 7, 'oppotunity', 'status', 'pending', 'Pending', 'Chờ xử lý', '#F59E0B'),
  (208, 8, 'oppotunity', 'status', 'won', 'Won', 'Thành công', '#10B981'),
  (209, 9, 'oppotunity', 'status', 'upside', 'Upside', 'Tiềm năng cao', '#06B6D4'),
  (210, 10, 'oppotunity', 'status', 'at_risk', 'At risk', 'Rủi ro', '#F97316'),

  -- ── OPPORTUNITY (OPPO): TYPE (1..2) ──
  (211, 1, 'oppotunity', 'type', 'netnew', 'Netnew', 'Hợp đồng mới', '#10B981'),
  (212, 2, 'oppotunity', 'type', 'renewal', 'Renewal', 'Tái ký / Gia hạn', '#3B82F6'),

  -- ── SERVICE DELIVERY CONTRACT: ID__SLA_COMPLETED_TIME (1..4) ──
  (221, 1, 'service_delivery_contract', 'id__sla_completed_time', '30_days_from_start_date', '30 days from start date', '30 ngày từ ngày bắt đầu', '#3B82F6'),
  (222, 2, 'service_delivery_contract', 'id__sla_completed_time', 'equal_to_end_date', 'Equal to End Date', 'Bằng ngày kết thúc', '#10B981'),
  (223, 3, 'service_delivery_contract', 'id__sla_completed_time', '21_days_from_start_date', '21 days from start date', '21 ngày từ ngày bắt đầu', '#F59E0B'),
  (224, 4, 'service_delivery_contract', 'id__sla_completed_time', '14_days_from_start_date', '14 days from start date', '14 ngày từ ngày bắt đầu', '#8B5CF6'),

  -- ── SERVICE DELIVERY CONTRACT: ID__SLA_RESPONSE_TIME (1..4) ──
  (225, 1, 'service_delivery_contract', 'id__sla_response_time', '30_days_from_start_date', '30 days from start date', '30 ngày từ ngày bắt đầu', '#3B82F6'),
  (226, 2, 'service_delivery_contract', 'id__sla_response_time', 'equal_to_end_date', 'Equal to End Date', 'Bằng ngày kết thúc', '#10B981'),
  (227, 3, 'service_delivery_contract', 'id__sla_response_time', '21_days_from_start_date', '21 days from start date', '21 ngày từ ngày bắt đầu', '#F59E0B'),
  (228, 4, 'service_delivery_contract', 'id__sla_response_time', '14_days_from_start_date', '14 days from start date', '14 ngày từ ngày bắt đầu', '#8B5CF6'),

  -- ── SERVICE DELIVERY CONTRACT: SERVICE (1..22) ──
  (231, 1, 'service_delivery_contract', 'service', 'ps', 'Oracle premier support for system (PS)', 'Oracle premier support for system (PS)', '#3B82F6'),
  (232, 2, 'service_delivery_contract', 'service', 'lsu', 'Oracle license support and update (LSU)', 'Oracle license support and update (LSU)', '#10B981'),
  (233, 3, 'service_delivery_contract', 'service', 'ms', 'Managed service (MS)', 'Managed service (MS)', '#F59E0B'),
  (234, 4, 'service_delivery_contract', 'service', 'ip', 'Implementation (IP)', 'Implementation (IP)', '#6366F1'),
  (235, 5, 'service_delivery_contract', 'service', 'hc', 'Health check (HC)', 'Health check (HC)', '#06B6D4'),
  (236, 6, 'service_delivery_contract', 'service', 'mts', 'MPS Technical Support (MTS)', 'MPS Technical Support (MTS)', '#EC4899'),
  (237, 7, 'service_delivery_contract', 'service', 'ipts', 'Implementation Technical Support (IPTS)', 'Implementation Technical Support (IPTS)', '#8B5CF6'),
  (238, 8, 'service_delivery_contract', 'service', 'ls', 'Leasing (LS)', 'Leasing (LS)', '#14B8A6'),
  (239, 9, 'service_delivery_contract', 'service', 'tn', 'Training (TN)', 'Training (TN)', '#EAB308'),
  (240, 10, 'service_delivery_contract', 'service', 'rto', 'Report | Training | Other (RTO)', 'Report | Training | Other (RTO)', '#64748B'),
  (241, 11, 'service_delivery_contract', 'service', 'tsa', 'Technical Support for Application (TSA)', 'Technical Support for Application (TSA)', '#2563EB'),
  (242, 12, 'service_delivery_contract', 'service', 'ipa', 'Implementation - Application and AI (IPA)', 'Implementation - Application and AI (IPA)', '#7C3AED'),
  (243, 13, 'service_delivery_contract', 'service', 'yc1', 'Yêu cầu 1: Kiểm tra định kỳ (YC1)', 'Yêu cầu 1: Kiểm tra định kỳ (YC1)', '#059669'),
  (244, 14, 'service_delivery_contract', 'service', 'yc2', 'Yêu cầu 2: Cập nhật các bản vá, bản sửa lỗi CSDL (YC2)', 'Yêu cầu 2: Cập nhật các bản vá, bản sửa lỗi CSDL (YC2)', '#D97706'),
  (245, 15, 'service_delivery_contract', 'service', 'yc3', 'Yêu cầu 3: Nâng cấp phiên bản CSDL (YC3)', 'Yêu cầu 3: Nâng cấp phiên bản CSDL (YC3)', '#4F46E5'),
  (246, 16, 'service_delivery_contract', 'service', 'yc4', 'Yêu cầu 4: Tối ưu CSDL (YC4)', 'Yêu cầu 4: Tối ưu CSDL (YC4)', '#0891B2'),
  (247, 17, 'service_delivery_contract', 'service', 'yc5', 'Yêu cầu 5: Phục hồi dữ liệu (YC5)', 'Yêu cầu 5: Phục hồi dữ liệu (YC5)', '#DB2777'),
  (248, 18, 'service_delivery_contract', 'service', 'yc6', 'Yêu cầu 6: Di chuyển CSDL (YC6)', 'Yêu cầu 6: Di chuyển CSDL (YC6)', '#9333EA'),
  (249, 19, 'service_delivery_contract', 'service', 'yc7', 'Yêu cầu 7: Rà soát toàn bộ cấu hình bảo mật CSDL (YC7)', 'Yêu cầu 7: Rà soát toàn bộ cấu hình bảo mật CSDL (YC7)', '#0D9488'),
  (250, 20, 'service_delivery_contract', 'service', 'yc8', 'Yêu cầu 8: Xây dựng, chuẩn hóa các tài liệu, quy trình (YC8)', 'Yêu cầu 8: Xây dựng, chuẩn hóa các tài liệu, quy trình (YC8)', '#CA8A04'),
  (251, 21, 'service_delivery_contract', 'service', 'yc9', 'Yêu cầu 9: Thực hiện khắc phục các vấn đề nghiêm trọng, phức tạp của CSDL (YC9)', 'Yêu cầu 9: Thực hiện khắc phục các vấn đề nghiêm trọng, phức tạp của CSDL (YC9)', '#E11D48'),
  (252, 22, 'service_delivery_contract', 'service', 'yc10', 'Yêu cầu 10: Tổng hợp báo cáo định kỳ (YC10)', 'Yêu cầu 10: Tổng hợp báo cáo định kỳ (YC10)', '#475569'),

  -- ── SERVICE DELIVERY CONTRACT: STATUS (1,2,3,4,5,6,7,22) ──
  (261, 1, 'service_delivery_contract', 'status', 'not_started_yet', 'Not started yet', 'Chưa bắt đầu', '#64748B'),
  (262, 2, 'service_delivery_contract', 'status', 'on_going', 'On going', 'Đang thực hiện', '#3B82F6'),
  (263, 3, 'service_delivery_contract', 'status', 'going_to_expire', 'Going to expire', 'Sắp hết hạn', '#F59E0B'),
  (264, 4, 'service_delivery_contract', 'status', 'completed', 'Completed', 'Đã hoàn thành', '#10B981'),
  (265, 5, 'service_delivery_contract', 'status', 'expired', 'Expired', 'Đã hết hạn', '#DC2626'),
  (266, 6, 'service_delivery_contract', 'status', 'no_task_created', 'No task created', 'Chưa tạo task', '#94A3B8'),
  (267, 7, 'service_delivery_contract', 'status', 'canceled', 'Canceled', 'Đã hủy', '#EF4444'),
  (268, 22, 'service_delivery_contract', 'status', 'on_hold', 'On hold', 'Tạm dừng', '#8B5CF6'),
  (269, 10, 'service_delivery_contract', 'status', 'draft', 'Draft', 'Bản nháp', '#64748B'),
  (270, 11, 'service_delivery_contract', 'status', 'waiting_for_approval', 'Waiting for approval', 'Chờ phê duyệt', '#F59E0B'),

  -- ── SERVICE TASK REQUEST: DELIVERY_ONSITE (1..2) ──
  (271, 1, 'service_task_request', 'delivery_onsite', 'onsite', 'Onsite', 'Tại chỗ (Onsite)', '#3B82F6'),
  (272, 2, 'service_task_request', 'delivery_onsite', 'remote', 'Remote', 'Từ xa (Remote)', '#10B981'),

  -- ── SERVICE TASK REQUEST: SERVICE (1..7) ──
  (273, 1, 'service_task_request', 'service', 'oracle_premier_support_for_system', 'Oracle premier support for system', 'Oracle premier support for system', '#3B82F6'),
  (274, 2, 'service_task_request', 'service', 'implementation', 'Implementation', 'Triển khai (Implementation)', '#6366F1'),
  (275, 3, 'service_task_request', 'service', 'health_check', 'Health check', 'Đánh giá hệ thống (Health check)', '#06B6D4'),
  (276, 4, 'service_task_request', 'service', 'mps_technical_support', 'MPS Technical Support', 'Hỗ trợ kỹ thuật MPS', '#EC4899'),
  (277, 5, 'service_task_request', 'service', 'implementation_technical_support', 'Implementation Technical Support', 'Hỗ trợ kỹ thuật triển khai', '#8B5CF6'),
  (278, 6, 'service_task_request', 'service', 'technical_support_for_application', 'Technical Support for Application', 'Hỗ trợ kỹ thuật ứng dụng', '#2563EB'),
  (279, 7, 'service_task_request', 'service', 'other', 'Other', 'Khác', '#64748B'),

  -- ── SERVICE TASK REQUEST: STATUS (1..9) ──
  (281, 1, 'service_task_request', 'status', 'not_started_yet', 'Not started yet', 'Chưa bắt đầu', '#64748B'),
  (282, 2, 'service_task_request', 'status', 'processing', 'Processing', 'Đang xử lý', '#3B82F6'),
  (283, 3, 'service_task_request', 'status', 'customer_review', 'Customer review', 'Khách hàng đánh giá', '#F59E0B'),
  (284, 4, 'service_task_request', 'status', 'completed', 'Completed', 'Đã hoàn thành', '#10B981'),
  (285, 5, 'service_task_request', 'status', 'closed', 'Closed', 'Đã đóng', '#475569'),
  (286, 6, 'service_task_request', 'status', 'pending', 'Pending', 'Chờ xử lý', '#EC4899'),
  (287, 7, 'service_task_request', 'status', 'spare_in_custom', 'Spare in custom', 'Linh kiện hải quan', '#8B5CF6'),
  (288, 8, 'service_task_request', 'status', 'monitoring', 'Monitoring', 'Đang theo dõi', '#06B6D4'),
  (289, 9, 'service_task_request', 'status', 'canceled', 'Canceled', 'Đã hủy', '#EF4444')
ON CONFLICT (id) DO UPDATE SET
  status_value = EXCLUDED.status_value,
  table_name = EXCLUDED.table_name,
  column_name = EXCLUDED.column_name,
  status_key = EXCLUDED.status_key,
  display_name_en = EXCLUDED.display_name_en,
  display_name_vi = EXCLUDED.display_name_vi,
  color_code = EXCLUDED.color_code;

-- Reset sequence for status_catalog
SELECT setval('public.status_catalog_id_seq', (SELECT COALESCE(MAX(id), 1) FROM public.status_catalog));

-- 4. Set proper defaults on tables
ALTER TABLE public.oppotunity ALTER COLUMN status SET DEFAULT 6;
ALTER TABLE public.service_delivery_contract ALTER COLUMN status SET DEFAULT 10;
ALTER TABLE public.service_task_request ALTER COLUMN status SET DEFAULT 1;

-- 5. Convert service_task_request.delivery_onsite to integer if needed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = current_schema() AND table_name = 'service_task_request' AND column_name = 'delivery_onsite' AND data_type = 'boolean'
  ) THEN
    ALTER TABLE public.service_task_request ALTER COLUMN delivery_onsite DROP DEFAULT;
    ALTER TABLE public.service_task_request ALTER COLUMN delivery_onsite TYPE INTEGER USING (CASE WHEN delivery_onsite THEN 1 ELSE 2 END);
    ALTER TABLE public.service_task_request ALTER COLUMN delivery_onsite SET DEFAULT 1;
  END IF;
END $$;

-- 6. Migrate existing rows with old status IDs to new status IDs
UPDATE public.oppotunity SET status = 6 WHERE status = 52;
UPDATE public.oppotunity SET status = 8 WHERE status = 53;
UPDATE public.oppotunity SET status = 5 WHERE status = 54;

UPDATE public.service_delivery_contract SET status = 2 WHERE status = 140;
UPDATE public.service_delivery_contract SET status = 1 WHERE status = 141;
UPDATE public.service_delivery_contract SET status = 5 WHERE status = 142;
UPDATE public.service_delivery_contract SET status = 7 WHERE status = 143;

UPDATE public.service_task_request SET status = 1 WHERE status = 150;
UPDATE public.service_task_request SET status = 2 WHERE status = 151;
UPDATE public.service_task_request SET status = 6 WHERE status = 152;
UPDATE public.service_task_request SET status = 4 WHERE status = 153;
UPDATE public.service_task_request SET status = 5 WHERE status = 154;
UPDATE public.service_task_request SET status = 9 WHERE status = 155;

COMMIT;
