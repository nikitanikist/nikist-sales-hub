-- Add columns to track previous schedule when a call is rescheduled
ALTER TABLE public.call_appointments 
ADD COLUMN IF NOT EXISTS previous_scheduled_date date DEFAULT NULL,
ADD COLUMN IF NOT EXISTS previous_scheduled_time time without time zone DEFAULT NULL,
ADD COLUMN IF NOT EXISTS rescheduled_at timestamp with time zone DEFAULT NULL;