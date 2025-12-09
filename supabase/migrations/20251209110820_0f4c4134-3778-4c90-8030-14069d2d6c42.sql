-- Add mango_id column to leads table to store TagMango reference ID
ALTER TABLE public.leads ADD COLUMN mango_id text;