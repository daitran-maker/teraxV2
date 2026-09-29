-- Migration: Add pin, flag, follow-tracking columns to notification table
-- Date: 2026-07-27

-- Step 1: Add is_pinned and is_flagged columns to notification table
ALTER TABLE public.notification
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS flagged_note TEXT;

-- Step 2: Create request_watches table for "Follow / Unfollow Request" feature
-- When a user is tagged in a comment, they are auto-subscribed.
-- They can then choose to unfollow to stop receiving future notifications for that request.
CREATE TABLE IF NOT EXISTS public.request_watches (
    id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    user_email CHARACTER VARYING(255) NOT NULL,
    request_id CHARACTER VARYING(255) NOT NULL,
    is_watching BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_email, request_id)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_request_watches_user_email ON public.request_watches(user_email);
CREATE INDEX IF NOT EXISTS idx_request_watches_request_id ON public.request_watches(request_id);
CREATE INDEX IF NOT EXISTS idx_notification_user_pinned ON public.notification(user_email, is_pinned);
CREATE INDEX IF NOT EXISTS idx_notification_user_flagged ON public.notification(user_email, is_flagged);
