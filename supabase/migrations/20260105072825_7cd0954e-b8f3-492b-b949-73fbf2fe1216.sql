-- Add class access tracking columns to emi_payments table
ALTER TABLE public.emi_payments 
ADD COLUMN previous_classes_access integer,
ADD COLUMN new_classes_access integer;