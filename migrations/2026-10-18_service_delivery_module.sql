-- Migration: Service Delivery Contract & Service Task Request Module Extension
-- Created: 2026-10-18

DO $$
BEGIN
  -- 1. Bổ sung id__oppotunity vào bảng request nếu chưa có
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = current_schema() AND table_name = 'request' AND column_name = 'id__oppotunity'
  ) THEN
    ALTER TABLE "request" ADD COLUMN id__oppotunity VARCHAR(255);
    CREATE INDEX IF NOT EXISTS idx_request_id__oppotunity ON "request"(id__oppotunity);
  END IF;

  -- 2. Bổ sung project vào payment, invoice, service, asset nếu chưa có
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = current_schema() AND table_name = 'payment' AND column_name = 'project'
  ) THEN
    ALTER TABLE "payment" ADD COLUMN project VARCHAR(255);
    CREATE INDEX IF NOT EXISTS idx_payment_project ON "payment"(project);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = current_schema() AND table_name = 'invoice' AND column_name = 'project'
  ) THEN
    ALTER TABLE "invoice" ADD COLUMN project VARCHAR(255);
    CREATE INDEX IF NOT EXISTS idx_invoice_project ON "invoice"(project);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = current_schema() AND table_name = 'service' AND column_name = 'project'
  ) THEN
    ALTER TABLE "service" ADD COLUMN project VARCHAR(255);
    CREATE INDEX IF NOT EXISTS idx_service_project ON "service"(project);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = current_schema() AND table_name = 'asset' AND column_name = 'project'
  ) THEN
    ALTER TABLE "asset" ADD COLUMN project VARCHAR(255);
    CREATE INDEX IF NOT EXISTS idx_asset_project ON "asset"(project);
  END IF;

  -- 3. Tạo bảng service_delivery_contract
  CREATE TABLE IF NOT EXISTS public.service_delivery_contract (
    id VARCHAR(50) PRIMARY KEY,
    id__service_request VARCHAR(255),
    project VARCHAR(255),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    service_scope TEXT NOT NULL,
    coordinator__employee VARCHAR(255) NOT NULL,
    sd_old_id VARCHAR(100),
    id__sla_completed_time VARCHAR(100),
    id__sla_response_time VARCHAR(100),
    service VARCHAR(255),
    status INTEGER DEFAULT 140,
    fy VARCHAR(20),
    note TEXT,
    created_by VARCHAR(255),
    created_date TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(255),
    updated_date TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    log JSONB DEFAULT '[]'::jsonb,
    logs JSONB DEFAULT '[]'::jsonb,
    deleted_at TIMESTAMP WITHOUT TIME ZONE
  );

  CREATE INDEX IF NOT EXISTS idx_sd_contract_project ON public.service_delivery_contract(project);
  CREATE INDEX IF NOT EXISTS idx_sd_contract_request ON public.service_delivery_contract(id__service_request);
  CREATE INDEX IF NOT EXISTS idx_sd_contract_coordinator ON public.service_delivery_contract(coordinator__employee);
  CREATE INDEX IF NOT EXISTS idx_sd_contract_fy ON public.service_delivery_contract(fy);

  -- 4. Tạo bảng service_task_request
  CREATE TABLE IF NOT EXISTS public.service_task_request (
    id VARCHAR(50) PRIMARY KEY,
    task_id_view VARCHAR(100),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    service_delivery VARCHAR(50) NOT NULL,
    request_source VARCHAR(50),
    tier1_engineer__employee VARCHAR(255),
    service_coordinator__employee VARCHAR(255),
    method VARCHAR(50),
    type VARCHAR(50),
    delivery_onsite BOOLEAN DEFAULT FALSE,
    severity_level VARCHAR(20) DEFAULT 'Medium',
    started_date TIMESTAMP WITHOUT TIME ZONE,
    end_date TIMESTAMP WITHOUT TIME ZONE,
    service VARCHAR(255),
    report TEXT,
    report_template VARCHAR(100),
    report_status_app VARCHAR(50),
    report_status VARCHAR(50) DEFAULT 'Not Required',
    report_content TEXT,
    status INTEGER DEFAULT 150,
    id__support_ticket VARCHAR(50),
    id__contact VARCHAR(50),
    id__engineer_request VARCHAR(255),
    id__sc_request VARCHAR(255),
    id__hc_review_request VARCHAR(255),
    fy VARCHAR(20),
    created_by VARCHAR(255),
    created_date TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(255),
    updated_date TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    log JSONB DEFAULT '[]'::jsonb,
    logs JSONB DEFAULT '[]'::jsonb,
    deleted_at TIMESTAMP WITHOUT TIME ZONE
  );

  CREATE INDEX IF NOT EXISTS idx_str_service_delivery ON public.service_task_request(service_delivery);
  CREATE INDEX IF NOT EXISTS idx_str_engineer ON public.service_task_request(tier1_engineer__employee);
  CREATE INDEX IF NOT EXISTS idx_str_coordinator ON public.service_task_request(service_coordinator__employee);
  CREATE INDEX IF NOT EXISTS idx_str_fy ON public.service_task_request(fy);

  -- 5. Seed Status Catalog cho service_delivery_contract (Dải ID: 140 - 149)
  INSERT INTO public.status_catalog (id, table_name, column_name, status_key, display_name_en, display_name_vi, color_code)
  VALUES 
    (140, 'service_delivery_contract', 'status', 'active', 'Active', 'Đang hiệu lực', '#10B981'),
    (141, 'service_delivery_contract', 'status', 'pending', 'Pending', 'Chờ xử lý', '#3B82F6'),
    (142, 'service_delivery_contract', 'status', 'expired', 'Expired', 'Hết hạn', '#EF4444'),
    (143, 'service_delivery_contract', 'status', 'terminated', 'Terminated', 'Chấm dứt', '#64748B')
  ON CONFLICT (id) DO UPDATE SET 
    display_name_en = EXCLUDED.display_name_en,
    display_name_vi = EXCLUDED.display_name_vi,
    color_code = EXCLUDED.color_code;

  -- 6. Seed Status Catalog cho service_task_request (Dải ID: 150 - 159)
  INSERT INTO public.status_catalog (id, table_name, column_name, status_key, display_name_en, display_name_vi, color_code)
  VALUES 
    (150, 'service_task_request', 'status', 'new', 'New', 'Mới', '#3B82F6'),
    (151, 'service_task_request', 'status', 'in_progress', 'In Progress', 'Đang xử lý', '#F59E0B'),
    (152, 'service_task_request', 'status', 'pending_customer', 'Pending Customer', 'Chờ khách hàng', '#8B5CF6'),
    (153, 'service_task_request', 'status', 'resolved', 'Resolved', 'Đã xử lý xong', '#10B981'),
    (154, 'service_task_request', 'status', 'closed', 'Closed', 'Đã đóng', '#64748B'),
    (155, 'service_task_request', 'status', 'cancelled', 'Cancelled', 'Đã hủy', '#EF4444')
  ON CONFLICT (id) DO UPDATE SET 
    display_name_en = EXCLUDED.display_name_en,
    display_name_vi = EXCLUDED.display_name_vi,
    color_code = EXCLUDED.color_code;

  -- 7. Gắn Audit Log Trigger nếu trigger function trg_set_audit_fields tồn tại
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'trg_set_audit_fields') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_service_delivery_contract_audit') THEN
      CREATE TRIGGER trg_service_delivery_contract_audit
      AFTER INSERT OR UPDATE OR DELETE ON public.service_delivery_contract
      FOR EACH ROW EXECUTE FUNCTION trg_set_audit_fields();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_service_task_request_audit') THEN
      CREATE TRIGGER trg_service_task_request_audit
      AFTER INSERT OR UPDATE OR DELETE ON public.service_task_request
      FOR EACH ROW EXECUTE FUNCTION trg_set_audit_fields();
    END IF;
  END IF;

  -- 8. Đồng bộ liên thông dữ liệu hiện có giữa request và oppotunity
  UPDATE "request" r
  SET id__oppotunity = o.project_id
  FROM "oppotunity" o
  WHERE (o.id__request = r.request_id OR o.id__request = r.request_id::text)
    AND (r.id__oppotunity IS NULL OR r.id__oppotunity = '');

END $$;
