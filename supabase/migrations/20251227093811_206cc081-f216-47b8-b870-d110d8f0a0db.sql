-- Add previous_closer_id column to track who the call was previously assigned to
ALTER TABLE public.call_appointments 
ADD COLUMN previous_closer_id uuid REFERENCES public.profiles(id);