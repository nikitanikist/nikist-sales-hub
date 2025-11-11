-- Add ad_spend column to workshops table
ALTER TABLE public.workshops 
ADD COLUMN ad_spend numeric DEFAULT 0;