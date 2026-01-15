-- Add next_follow_up_date column to call_appointments
ALTER TABLE public.call_appointments 
ADD COLUMN IF NOT EXISTS next_follow_up_date DATE DEFAULT NULL;