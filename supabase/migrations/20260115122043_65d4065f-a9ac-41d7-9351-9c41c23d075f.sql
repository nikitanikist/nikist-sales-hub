-- Add payment detail columns to futures_emi_payments table
ALTER TABLE futures_emi_payments 
ADD COLUMN no_cost_emi numeric DEFAULT 0,
ADD COLUMN gst_fees numeric DEFAULT 0,
ADD COLUMN platform_fees numeric DEFAULT 0,
ADD COLUMN payment_platform text DEFAULT 'UPI (IDFC)',
ADD COLUMN remarks text;

-- Add payment detail columns to futures_mentorship_students table (for initial payment)
ALTER TABLE futures_mentorship_students 
ADD COLUMN no_cost_emi numeric DEFAULT 0,
ADD COLUMN gst_fees numeric DEFAULT 0,
ADD COLUMN platform_fees numeric DEFAULT 0,
ADD COLUMN payment_platform text,
ADD COLUMN payment_remarks text;