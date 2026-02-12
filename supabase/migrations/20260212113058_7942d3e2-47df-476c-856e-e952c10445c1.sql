
ALTER TABLE public.call_appointments DROP CONSTRAINT call_appointments_batch_id_fkey;

ALTER TABLE public.call_appointments ADD CONSTRAINT call_appointments_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.cohort_batches(id);
