ALTER TABLE public.voice_campaigns 
ADD COLUMN aisensy_integration_id uuid REFERENCES public.organization_integrations(id);