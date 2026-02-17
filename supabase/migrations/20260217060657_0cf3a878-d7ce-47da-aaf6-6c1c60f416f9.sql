ALTER TYPE public.call_status ADD VALUE IF NOT EXISTS 'no_show';
NOTIFY pgrst, 'reload schema';