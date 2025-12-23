-- Add 'skipped' to the reminder_status enum
ALTER TYPE public.reminder_status ADD VALUE IF NOT EXISTS 'skipped';