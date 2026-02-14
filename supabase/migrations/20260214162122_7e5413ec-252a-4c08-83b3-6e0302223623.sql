-- Add unique constraint for idempotent Calendly webhook processing
-- Prevents duplicate appointments from race conditions
ALTER TABLE public.call_appointments
  ADD CONSTRAINT unique_calendly_event_uri
  UNIQUE (calendly_event_uri);