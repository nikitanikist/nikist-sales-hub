-- Add 'discontinued' to the call_status enum
ALTER TYPE public.call_status ADD VALUE IF NOT EXISTS 'discontinued';