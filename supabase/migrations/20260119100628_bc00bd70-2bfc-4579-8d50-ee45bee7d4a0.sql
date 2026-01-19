-- Add payment detail columns to call_appointments table
ALTER TABLE public.call_appointments 
ADD COLUMN IF NOT EXISTS no_cost_emi numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS gst_fees numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS platform_fees numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_platform text,
ADD COLUMN IF NOT EXISTS payment_remarks text,
ADD COLUMN IF NOT EXISTS conversion_date date;

-- Add payment detail columns to emi_payments table
ALTER TABLE public.emi_payments 
ADD COLUMN IF NOT EXISTS no_cost_emi numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS gst_fees numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS platform_fees numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_platform text,
ADD COLUMN IF NOT EXISTS remarks text;