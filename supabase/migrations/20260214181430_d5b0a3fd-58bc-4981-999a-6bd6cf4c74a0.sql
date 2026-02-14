
-- Dead Letter Queue for permanently failed messages
CREATE TABLE public.dead_letter_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  source_table text NOT NULL,
  source_id uuid NOT NULL,
  payload jsonb NOT NULL,
  retry_payload jsonb,
  error_message text,
  retry_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending_review',
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.profiles(id),
  notes text
);

-- Enable RLS
ALTER TABLE public.dead_letter_queue ENABLE ROW LEVEL SECURITY;

-- RLS policies: org-scoped for admins, super_admin full access
CREATE POLICY "Super admins can manage all DLQ entries"
  ON public.dead_letter_queue FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Org admins can view their DLQ entries"
  ON public.dead_letter_queue FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT unnest(public.get_user_organization_ids())
    )
    AND public.has_org_role(auth.uid(), 'admin')
  );

CREATE POLICY "Org admins can update their DLQ entries"
  ON public.dead_letter_queue FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT unnest(public.get_user_organization_ids())
    )
    AND public.has_org_role(auth.uid(), 'admin')
  );

-- Performance index for the review UI
CREATE INDEX idx_dlq_org_status_created
  ON public.dead_letter_queue (organization_id, status, created_at DESC);

-- Index for source lookups (deduplication)
CREATE INDEX idx_dlq_source
  ON public.dead_letter_queue (source_table, source_id);
