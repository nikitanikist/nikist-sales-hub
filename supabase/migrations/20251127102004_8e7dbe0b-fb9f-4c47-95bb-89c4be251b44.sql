-- Add product_id column to lead_assignments table
ALTER TABLE public.lead_assignments 
ADD COLUMN product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;