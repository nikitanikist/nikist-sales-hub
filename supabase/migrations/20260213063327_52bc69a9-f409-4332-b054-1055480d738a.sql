CREATE OR REPLACE FUNCTION public.generate_call_phone_reminders()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  reminder_dt TIMESTAMPTZ;
  call_dt TIMESTAMPTZ;
  org_tz TEXT;
  date_str TEXT;
BEGIN
  -- Only process if closer_id is set
  IF NEW.closer_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get org timezone
  SELECT timezone INTO org_tz FROM organizations WHERE id = NEW.organization_id;
  IF org_tz IS NULL THEN
    org_tz := 'Asia/Kolkata';
  END IF;

  -- Format date properly
  date_str := to_char(NEW.scheduled_date, 'YYYY-MM-DD');

  -- Build the call datetime in org timezone then convert to UTC
  call_dt := (date_str || ' ' || NEW.scheduled_time::text)::timestamp AT TIME ZONE org_tz;

  -- Delete existing phone reminders for this appointment (regenerate)
  DELETE FROM call_phone_reminders WHERE appointment_id = NEW.id;

  -- Generate reminders based on the closer's configured types
  FOR r IN
    SELECT id, offset_type, offset_value, is_active
    FROM call_phone_reminder_types
    WHERE closer_id = NEW.closer_id
      AND organization_id = NEW.organization_id
      AND is_active = true
    ORDER BY display_order
  LOOP
    -- Calculate reminder_time based on offset_type
    CASE r.offset_type
      WHEN 'day_before' THEN
        reminder_dt := (to_char(NEW.scheduled_date - INTERVAL '1 day', 'YYYY-MM-DD') || ' ' || r.offset_value || ':00')::timestamp AT TIME ZONE org_tz;
      WHEN 'same_day' THEN
        reminder_dt := (date_str || ' ' || r.offset_value || ':00')::timestamp AT TIME ZONE org_tz;
      WHEN 'minutes_before' THEN
        reminder_dt := call_dt - (r.offset_value::int * INTERVAL '1 minute');
      ELSE
        CONTINUE;
    END CASE;

    INSERT INTO call_phone_reminders (appointment_id, reminder_type_id, reminder_time, status, organization_id)
    VALUES (
      NEW.id,
      r.id,
      reminder_dt,
      CASE WHEN reminder_dt < now() THEN 'skipped' ELSE 'pending' END,
      NEW.organization_id
    );
  END LOOP;

  RETURN NEW;
END;
$$;