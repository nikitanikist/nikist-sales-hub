-- Add previous_assigned_to column to leads table
ALTER TABLE public.leads ADD COLUMN previous_assigned_to uuid REFERENCES profiles(id);