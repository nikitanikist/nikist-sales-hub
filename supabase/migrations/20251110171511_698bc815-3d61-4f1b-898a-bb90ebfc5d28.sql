-- Add country field to leads table
ALTER TABLE public.leads
ADD COLUMN country text;

-- Add a comment to clarify the table now represents customers
COMMENT ON TABLE public.leads IS 'Customer records including contact info, workshops, and assignments';