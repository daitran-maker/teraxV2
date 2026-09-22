-- Migration: Add id_request column to account table
-- Date: 2026-08-12
-- Description: Add id_request varchar(50) to track request references on account records

ALTER TABLE account
  ADD COLUMN IF NOT EXISTS id_request VARCHAR(50);
