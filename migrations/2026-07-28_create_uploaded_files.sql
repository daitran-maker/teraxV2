-- Migration: 2026-07-28_create_uploaded_files.sql
-- Tạo bảng uploaded_files để tập trung toàn bộ metadata file upload
-- Áp dụng cho tất cả DB chưa có bảng này (crc_demo1_db .. crc_demo15_db, crcdevdb)

CREATE TABLE IF NOT EXISTS "uploaded_files" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "table_name"  VARCHAR(100) NOT NULL,
  "record_id"   VARCHAR(100) NOT NULL,
  "column_name" VARCHAR(100) NOT NULL,
  "file_name"   VARCHAR(255) NOT NULL,
  "mime_type"   VARCHAR(100) NOT NULL,
  "file_path"   VARCHAR(512) NOT NULL,
  "uploaded_by" VARCHAR(100) NOT NULL,
  "uploaded_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index để query nhanh theo table + record (dùng khi render file list)
CREATE INDEX IF NOT EXISTS idx_uploaded_files_record
  ON uploaded_files(table_name, record_id);

-- Index để query theo người upload (dùng cho audit/backup)
CREATE INDEX IF NOT EXISTS idx_uploaded_files_uploader
  ON uploaded_files(uploaded_by, uploaded_at DESC);
