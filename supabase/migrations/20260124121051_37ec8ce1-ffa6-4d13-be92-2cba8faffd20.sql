-- Add pay_after_earning column to all three student tables

-- For Insider Crypto Club (Batches) - call_appointments table
ALTER TABLE public.call_appointments 
ADD COLUMN pay_after_earning BOOLEAN DEFAULT false;

-- For Futures Mentorship
ALTER TABLE public.futures_mentorship_students 
ADD COLUMN pay_after_earning BOOLEAN DEFAULT false;

-- For High Future
ALTER TABLE public.high_future_students 
ADD COLUMN pay_after_earning BOOLEAN DEFAULT false;