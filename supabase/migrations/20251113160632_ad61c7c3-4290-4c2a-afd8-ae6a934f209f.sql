-- Create enums for call appointments and reminders
CREATE TYPE call_status AS ENUM ('scheduled', 'rescheduled', 'completed', 'cancelled', 'no_show');
CREATE TYPE reminder_type AS ENUM ('two_days', 'one_day', 'three_hours', 'one_hour', 'thirty_minutes', 'ten_minutes');
CREATE TYPE reminder_status AS ENUM ('pending', 'sent', 'failed');

-- Create call_appointments table
CREATE TABLE public.call_appointments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  closer_id uuid NOT NULL REFERENCES public.profiles(id),
  
  scheduled_date date NOT NULL,
  scheduled_time time NOT NULL,
  
  status call_status NOT NULL DEFAULT 'scheduled',
  
  offer_amount numeric DEFAULT 0,
  cash_received numeric DEFAULT 0,
  due_amount numeric DEFAULT 0,
  
  closer_remarks text,
  additional_comments text,
  
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id)
);

CREATE INDEX idx_appointments_date ON public.call_appointments(scheduled_date);
CREATE INDEX idx_appointments_closer ON public.call_appointments(closer_id);
CREATE INDEX idx_appointments_status ON public.call_appointments(status);

-- Create call_reminders table
CREATE TABLE public.call_reminders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id uuid NOT NULL REFERENCES public.call_appointments(id) ON DELETE CASCADE,
  
  reminder_type reminder_type NOT NULL,
  reminder_time timestamp with time zone NOT NULL,
  status reminder_status DEFAULT 'pending',
  
  sent_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  
  UNIQUE(appointment_id, reminder_type)
);

CREATE INDEX idx_reminders_appointment ON public.call_reminders(appointment_id);
CREATE INDEX idx_reminders_time_status ON public.call_reminders(reminder_time, status);

-- Enable RLS
ALTER TABLE public.call_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_reminders ENABLE ROW LEVEL SECURITY;

-- RLS Policies for call_appointments
CREATE POLICY "Users can view all appointments"
  ON public.call_appointments FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Sales reps and admins can create appointments"
  ON public.call_appointments FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sales_rep'::app_role));

CREATE POLICY "Sales reps and admins can update appointments"
  ON public.call_appointments FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sales_rep'::app_role));

CREATE POLICY "Only admins can delete appointments"
  ON public.call_appointments FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for call_reminders
CREATE POLICY "Users can view all reminders"
  ON public.call_reminders FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Sales reps and admins can manage reminders"
  ON public.call_reminders FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sales_rep'::app_role));

-- Create trigger function for auto-calculating reminders
CREATE OR REPLACE FUNCTION public.calculate_reminder_times()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  appointment_datetime timestamp with time zone;
  reminder_configs jsonb;
BEGIN
  appointment_datetime := (NEW.scheduled_date || ' ' || NEW.scheduled_time)::timestamp with time zone;
  
  reminder_configs := jsonb_build_array(
    jsonb_build_object('type', 'two_days', 'offset', '-2 days'),
    jsonb_build_object('type', 'one_day', 'offset', '-1 day'),
    jsonb_build_object('type', 'three_hours', 'offset', '-3 hours'),
    jsonb_build_object('type', 'one_hour', 'offset', '-1 hour'),
    jsonb_build_object('type', 'thirty_minutes', 'offset', '-30 minutes'),
    jsonb_build_object('type', 'ten_minutes', 'offset', '-10 minutes')
  );
  
  INSERT INTO public.call_reminders (appointment_id, reminder_type, reminder_time)
  SELECT 
    NEW.id,
    (config->>'type')::reminder_type,
    appointment_datetime + (config->>'offset')::interval
  FROM jsonb_array_elements(reminder_configs) AS config
  ON CONFLICT (appointment_id, reminder_type) 
  DO UPDATE SET reminder_time = EXCLUDED.reminder_time;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER create_appointment_reminders
  AFTER INSERT OR UPDATE OF scheduled_date, scheduled_time
  ON public.call_appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_reminder_times();

-- Create trigger for updated_at
CREATE TRIGGER update_call_appointments_updated_at
  BEFORE UPDATE ON public.call_appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create RPC function for closer call counts
CREATE OR REPLACE FUNCTION public.get_closer_call_counts(target_date date)
RETURNS TABLE (
  id uuid,
  full_name text,
  call_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.full_name,
    COUNT(ca.id) as call_count
  FROM public.profiles p
  INNER JOIN public.user_roles ur ON ur.user_id = p.id
  LEFT JOIN public.call_appointments ca ON ca.closer_id = p.id 
    AND ca.scheduled_date = target_date
  WHERE ur.role IN ('sales_rep', 'admin')
  GROUP BY p.id, p.full_name
  ORDER BY p.full_name;
END;
$$;