
-- Table: call_phone_reminder_types (configurable reminder definitions per closer)
CREATE TABLE public.call_phone_reminder_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  closer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  offset_type TEXT NOT NULL CHECK (offset_type IN ('day_before', 'same_day', 'minutes_before')),
  offset_value TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table: call_phone_reminders (per-appointment reminder instances)
CREATE TABLE public.call_phone_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id UUID NOT NULL REFERENCES public.call_appointments(id) ON DELETE CASCADE,
  reminder_type_id UUID NOT NULL REFERENCES public.call_phone_reminder_types(id) ON DELETE CASCADE,
  reminder_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'skipped')),
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES public.profiles(id),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_call_phone_reminder_types_closer ON public.call_phone_reminder_types(closer_id, organization_id);
CREATE INDEX idx_call_phone_reminders_appointment ON public.call_phone_reminders(appointment_id);
CREATE INDEX idx_call_phone_reminders_type ON public.call_phone_reminders(reminder_type_id);

-- Enable RLS
ALTER TABLE public.call_phone_reminder_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_phone_reminders ENABLE ROW LEVEL SECURITY;

-- RLS for call_phone_reminder_types
CREATE POLICY "Admins/managers can manage call phone reminder types"
ON public.call_phone_reminder_types
FOR ALL
USING (
  (organization_id = ANY(get_user_organization_ids()) AND (has_org_role(auth.uid(), 'admin') OR has_org_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Sales reps can view their own closer reminder types"
ON public.call_phone_reminder_types
FOR SELECT
USING (
  organization_id = ANY(get_user_organization_ids()) AND closer_id = auth.uid()
);

-- RLS for call_phone_reminders
CREATE POLICY "Admins/managers can manage call phone reminders"
ON public.call_phone_reminders
FOR ALL
USING (
  (organization_id = ANY(get_user_organization_ids()) AND (has_org_role(auth.uid(), 'admin') OR has_org_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Sales reps can view call phone reminders in their org"
ON public.call_phone_reminders
FOR SELECT
USING (
  organization_id = ANY(get_user_organization_ids())
);

CREATE POLICY "Sales reps can update call phone reminders in their org"
ON public.call_phone_reminders
FOR UPDATE
USING (
  organization_id = ANY(get_user_organization_ids()) AND has_org_role(auth.uid(), 'sales_rep')
);

-- Trigger function to generate call_phone_reminders when appointment is created/updated
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

  -- Build the call datetime in org timezone then convert to UTC
  call_dt := (NEW.scheduled_date::text || ' ' || NEW.scheduled_time::text)::timestamp AT TIME ZONE org_tz;

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
        -- offset_value is time like '18:00', means day before at that time
        reminder_dt := ((NEW.scheduled_date - INTERVAL '1 day')::text || ' ' || r.offset_value || ':00')::timestamp AT TIME ZONE org_tz;
      WHEN 'same_day' THEN
        -- offset_value is time like '10:00', means same day at that time
        reminder_dt := (NEW.scheduled_date::text || ' ' || r.offset_value || ':00')::timestamp AT TIME ZONE org_tz;
      WHEN 'minutes_before' THEN
        -- offset_value is number of minutes before
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

-- Trigger on call_appointments
CREATE TRIGGER trg_generate_call_phone_reminders
AFTER INSERT OR UPDATE OF scheduled_date, scheduled_time, closer_id
ON public.call_appointments
FOR EACH ROW
EXECUTE FUNCTION public.generate_call_phone_reminders();

-- Updated_at trigger for call_phone_reminder_types
CREATE TRIGGER update_call_phone_reminder_types_updated_at
BEFORE UPDATE ON public.call_phone_reminder_types
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
