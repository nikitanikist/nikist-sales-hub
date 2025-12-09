-- Update call_status enum with new values
-- First, drop the default constraint
ALTER TABLE call_appointments ALTER COLUMN status DROP DEFAULT;

-- Create the new enum type
CREATE TYPE call_status_new AS ENUM (
  'scheduled',
  'converted_beginner',
  'converted_intermediate', 
  'converted_advance',
  'booking_amount',
  'not_converted',
  'not_decided',
  'so_so',
  'reschedule',
  'pending',
  'refunded'
);

-- Update the column to use new enum (map old values to new)
ALTER TABLE call_appointments 
  ALTER COLUMN status TYPE call_status_new 
  USING (
    CASE status::text
      WHEN 'scheduled' THEN 'scheduled'
      WHEN 'rescheduled' THEN 'reschedule'
      WHEN 'completed' THEN 'converted_beginner'
      WHEN 'cancelled' THEN 'not_converted'
      WHEN 'no_show' THEN 'not_converted'
      ELSE 'scheduled'
    END
  )::call_status_new;

-- Drop old enum and rename new one
DROP TYPE call_status;
ALTER TYPE call_status_new RENAME TO call_status;

-- Restore the default
ALTER TABLE call_appointments ALTER COLUMN status SET DEFAULT 'scheduled'::call_status;