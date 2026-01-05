-- Add previous_cash_received column to track cash history before each EMI
ALTER TABLE emi_payments 
ADD COLUMN previous_cash_received numeric DEFAULT NULL;