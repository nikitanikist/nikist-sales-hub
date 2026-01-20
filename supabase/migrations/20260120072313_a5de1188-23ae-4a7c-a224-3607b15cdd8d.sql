
-- Add mango_id column to workshops table for grouping related workshops
ALTER TABLE public.workshops ADD COLUMN IF NOT EXISTS mango_id text;
