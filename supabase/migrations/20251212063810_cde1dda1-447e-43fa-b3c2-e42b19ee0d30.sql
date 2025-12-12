-- Step 1: Update the trigger function for future appointments to use IST
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
  -- Interpret scheduled_date + scheduled_time as IST (not UTC)
  appointment_datetime := (NEW.scheduled_date || ' ' || NEW.scheduled_time)::timestamp 
                          AT TIME ZONE 'Asia/Kolkata';
  
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
    'pending'::reminder_status
  FROM jsonb_array_elements(reminder_configs) AS config
  ON CONFLICT (appointment_id, reminder_type) 
  DO UPDATE SET reminder_time = EXCLUDED.reminder_time;
  
  RETURN NEW;
END;
$function$;

-- Step 2: Recalculate existing pending reminders with correct IST times
UPDATE call_reminders cr
SET reminder_time = CASE
  WHEN cr.reminder_type = 'call_booked' THEN cr.reminder_time
  WHEN cr.reminder_type = 'two_days' THEN 
    ((ca.scheduled_date || ' ' || ca.scheduled_time)::timestamp AT TIME ZONE 'Asia/Kolkata') - interval '2 days'
  WHEN cr.reminder_type = 'one_day' THEN 
    ((ca.scheduled_date || ' ' || ca.scheduled_time)::timestamp AT TIME ZONE 'Asia/Kolkata') - interval '1 day'
  WHEN cr.reminder_type = 'three_hours' THEN 
    ((ca.scheduled_date || ' ' || ca.scheduled_time)::timestamp AT TIME ZONE 'Asia/Kolkata') - interval '3 hours'
  WHEN cr.reminder_type = 'one_hour' THEN 
    ((ca.scheduled_date || ' ' || ca.scheduled_time)::timestamp AT TIME ZONE 'Asia/Kolkata') - interval '1 hour'
  WHEN cr.reminder_type = 'thirty_minutes' THEN 
    ((ca.scheduled_date || ' ' || ca.scheduled_time)::timestamp AT TIME ZONE 'Asia/Kolkata') - interval '30 minutes'
  WHEN cr.reminder_type = 'ten_minutes' THEN 
    ((ca.scheduled_date || ' ' || ca.scheduled_time)::timestamp AT TIME ZONE 'Asia/Kolkata') - interval '10 minutes'
  WHEN cr.reminder_type = 'we_are_live' THEN 
    ((ca.scheduled_date || ' ' || ca.scheduled_time)::timestamp AT TIME ZONE 'Asia/Kolkata')
END
FROM call_appointments ca
WHERE cr.appointment_id = ca.id
  AND cr.status = 'pending';

-- Step 3: Mark any past reminders as 'sent' (to prevent sending old messages)
UPDATE call_reminders 
SET status = 'sent' 
WHERE status = 'pending' 
  AND reminder_time < NOW();