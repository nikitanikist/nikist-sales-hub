-- Add last_rebooked_at column to call_appointments
ALTER TABLE public.call_appointments 
ADD COLUMN IF NOT EXISTS last_rebooked_at TIMESTAMPTZ DEFAULT NULL;

-- Update calculate_reminder_times trigger to skip past reminders at rebook time
CREATE OR REPLACE FUNCTION public.calculate_reminder_times()
RETURNS TRIGGER AS $$
DECLARE
  appointment_datetime timestamp with time zone;
  reminder_configs jsonb;
  comparison_time timestamp with time zone;
BEGIN
  -- Interpret scheduled_date + scheduled_time as IST (not UTC)
  appointment_datetime := (NEW.scheduled_date || ' ' || NEW.scheduled_time)::timestamp 
                          AT TIME ZONE 'Asia/Kolkata';
  
  -- For rebooking, use last_rebooked_at to determine which reminders to skip; otherwise use now()
  comparison_time := COALESCE(NEW.last_rebooked_at, now());
  
  reminder_configs := jsonb_build_array(
    jsonb_build_object('type', 'call_booked', 'offset', '0 seconds'),
    jsonb_build_object('type', 'two_days', 'offset', '-2 days'),
    jsonb_build_object('type', 'one_day', 'offset', '-1 day'),
    jsonb_build_object('type', 'three_hours', 'offset', '-3 hours'),
    jsonb_build_object('type', 'one_hour', 'offset', '-1 hour'),
    jsonb_build_object('type', 'thirty_minutes', 'offset', '-30 minutes'),
    jsonb_build_object('type', 'ten_minutes', 'offset', '-10 minutes'),
    jsonb_build_object('type', 'we_are_live', 'offset', '0 seconds')
  );
  
  INSERT INTO public.call_reminders (appointment_id, reminder_type, reminder_time, status, sent_at)
  SELECT 
    NEW.id,
    (config->>'type')::reminder_type,
    CASE 
      WHEN (config->>'type') = 'call_booked' THEN comparison_time
      ELSE appointment_datetime + (config->>'offset')::interval
    END,
    -- Mark as 'skipped' if reminder time is before the comparison time (already passed)
    CASE
      WHEN (config->>'type') = 'call_booked' THEN 'pending'::reminder_status
      WHEN (appointment_datetime + (config->>'offset')::interval) < comparison_time THEN 'skipped'::reminder_status
      ELSE 'pending'::reminder_status
    END,
    NULL
  FROM jsonb_array_elements(reminder_configs) AS config
  ON CONFLICT (appointment_id, reminder_type) 
  DO UPDATE SET 
    reminder_time = EXCLUDED.reminder_time,
    status = CASE 
      -- Don't reset call_booked status - it's handled separately in rebook function
      WHEN call_reminders.reminder_type = 'call_booked' THEN call_reminders.status
      ELSE EXCLUDED.status
    END,
    sent_at = CASE 
      WHEN call_reminders.reminder_type = 'call_booked' THEN call_reminders.sent_at
      ELSE NULL
    END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;