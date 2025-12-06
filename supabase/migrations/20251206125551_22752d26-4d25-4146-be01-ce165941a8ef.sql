-- Add new reminder types to the enum
ALTER TYPE reminder_type ADD VALUE IF NOT EXISTS 'call_booked';
ALTER TYPE reminder_type ADD VALUE IF NOT EXISTS 'we_are_live';
ALTER TYPE reminder_type ADD VALUE IF NOT EXISTS 'three_hours';

-- Add Calendly/Zoom columns to call_appointments
ALTER TABLE public.call_appointments 
ADD COLUMN IF NOT EXISTS zoom_link TEXT,
ADD COLUMN IF NOT EXISTS calendly_event_uri TEXT,
ADD COLUMN IF NOT EXISTS calendly_invitee_uri TEXT;

-- Update the calculate_reminder_times function to handle all 8 reminder types
CREATE OR REPLACE FUNCTION public.calculate_reminder_times()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  appointment_datetime timestamp with time zone;
  reminder_configs jsonb;
BEGIN
  appointment_datetime := (NEW.scheduled_date || ' ' || NEW.scheduled_time)::timestamp with time zone;
  
  -- Updated reminder configs with all 8 types including call_booked and we_are_live
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
  
  INSERT INTO public.call_reminders (appointment_id, reminder_type, reminder_time, status)
  SELECT 
    NEW.id,
    (config->>'type')::reminder_type,
    CASE 
      WHEN (config->>'type') = 'call_booked' THEN now()
      ELSE appointment_datetime + (config->>'offset')::interval
    END,
    CASE 
      WHEN (config->>'type') = 'call_booked' THEN 'pending'::reminder_status
      ELSE 'pending'::reminder_status
    END
  FROM jsonb_array_elements(reminder_configs) AS config
  ON CONFLICT (appointment_id, reminder_type) 
  DO UPDATE SET reminder_time = EXCLUDED.reminder_time;
  
  RETURN NEW;
END;
$function$;