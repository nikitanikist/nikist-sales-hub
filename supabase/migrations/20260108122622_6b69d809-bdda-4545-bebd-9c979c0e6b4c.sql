-- Create webhook_ingest_events table for logging incoming webhooks
CREATE TABLE public.webhook_ingest_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'tagmango',
  email text,
  workshop_name text,
  mango_id text,
  amount numeric,
  result text NOT NULL DEFAULT 'pending',
  error_message text,
  lead_id uuid,
  created_workshop_id uuid,
  created_product_id uuid,
  is_duplicate boolean DEFAULT false,
  processing_time_ms integer
);

-- Enable RLS
ALTER TABLE public.webhook_ingest_events ENABLE ROW LEVEL SECURITY;

-- Admins and managers can view webhook events
CREATE POLICY "Admins and managers can view webhook events"
ON public.webhook_ingest_events
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Anyone can insert webhook events (for the edge function)
CREATE POLICY "Anyone can insert webhook events"
ON public.webhook_ingest_events
FOR INSERT
WITH CHECK (true);

-- Add index for quick lookups
CREATE INDEX idx_webhook_events_created_at ON public.webhook_ingest_events(created_at DESC);
CREATE INDEX idx_webhook_events_email ON public.webhook_ingest_events(email);

-- Enable realtime for leads table
ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;