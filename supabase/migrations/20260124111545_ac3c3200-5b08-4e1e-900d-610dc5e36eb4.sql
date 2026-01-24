-- Add closer_id and next_follow_up_date columns to futures_mentorship_students
ALTER TABLE public.futures_mentorship_students 
  ADD COLUMN IF NOT EXISTS closer_id uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS next_follow_up_date date;

-- Add closer_id and next_follow_up_date columns to high_future_students
ALTER TABLE public.high_future_students 
  ADD COLUMN IF NOT EXISTS closer_id uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS next_follow_up_date date;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_futures_mentorship_students_closer_id ON public.futures_mentorship_students(closer_id);
CREATE INDEX IF NOT EXISTS idx_futures_mentorship_students_follow_up ON public.futures_mentorship_students(next_follow_up_date);
CREATE INDEX IF NOT EXISTS idx_high_future_students_closer_id ON public.high_future_students(closer_id);
CREATE INDEX IF NOT EXISTS idx_high_future_students_follow_up ON public.high_future_students(next_follow_up_date);