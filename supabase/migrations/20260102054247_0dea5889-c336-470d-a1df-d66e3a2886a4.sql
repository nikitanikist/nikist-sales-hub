-- Create batches table
CREATE TABLE public.batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on batches
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;

-- RLS policies for batches
CREATE POLICY "Anyone authenticated can view batches"
ON public.batches FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can create batches"
ON public.batches FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update batches"
ON public.batches FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete batches"
ON public.batches FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at on batches
CREATE TRIGGER update_batches_updated_at
BEFORE UPDATE ON public.batches
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add 'converted' to call_status enum
ALTER TYPE public.call_status ADD VALUE IF NOT EXISTS 'converted';

-- Add new columns to call_appointments
ALTER TABLE public.call_appointments 
ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES public.batches(id),
ADD COLUMN IF NOT EXISTS classes_access INTEGER,
ADD COLUMN IF NOT EXISTS access_given BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS access_given_at TIMESTAMP WITH TIME ZONE;

-- Insert initial batches
INSERT INTO public.batches (name, start_date, is_active, created_by)
SELECT 'Batch 1 - Jan 3', '2026-01-03'::date, true, id FROM public.profiles WHERE email = 'dddipanshu456@gmail.com' LIMIT 1;

INSERT INTO public.batches (name, start_date, is_active, created_by)
SELECT 'Batch 2 - Jan 18', '2026-01-18'::date, true, id FROM public.profiles WHERE email = 'dddipanshu456@gmail.com' LIMIT 1;