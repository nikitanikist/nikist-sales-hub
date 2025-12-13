-- Add mango_id column to products table for TagMango matching
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS mango_id TEXT;

-- Create index for fast lookups by mango_id
CREATE INDEX IF NOT EXISTS idx_products_mango_id ON public.products(mango_id);

-- Delete lead_assignments that reference workshop entries that are actually products
DELETE FROM public.lead_assignments 
WHERE workshop_id IN (
  SELECT id FROM public.workshops 
  WHERE title IN (
    'Sunday Classe Recordings',
    'Friday Crypto Community Class',
    'Insider crypto club Partial Access',
    'Future Mentorship Batch 8',
    '1 year mentorship',
    'one to one Call Bonus'
  )
);

-- Delete duplicate "one to one Call Bonus" product (keep older one by created_at)
DELETE FROM public.products 
WHERE product_name ILIKE '%one to one call bonus%' 
AND id != (
  SELECT id FROM public.products 
  WHERE product_name ILIKE '%one to one call bonus%' 
  ORDER BY created_at ASC 
  LIMIT 1
);

-- Delete workshop entries that are actually products
DELETE FROM public.workshops 
WHERE title IN (
  'Sunday Classe Recordings',
  'Friday Crypto Community Class',
  'Insider crypto club Partial Access',
  'Future Mentorship Batch 8',
  '1 year mentorship',
  'one to one Call Bonus'
);