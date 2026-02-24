
-- 1. notification_campaign_groups.group_id → SET NULL
ALTER TABLE public.notification_campaign_groups
  DROP CONSTRAINT notification_campaign_groups_group_id_fkey;
ALTER TABLE public.notification_campaign_groups
  ADD CONSTRAINT notification_campaign_groups_group_id_fkey
  FOREIGN KEY (group_id) REFERENCES public.whatsapp_groups(id) ON DELETE SET NULL;

-- 2. webinars.whatsapp_group_id → SET NULL
ALTER TABLE public.webinars
  DROP CONSTRAINT webinars_whatsapp_group_id_fkey;
ALTER TABLE public.webinars
  ADD CONSTRAINT webinars_whatsapp_group_id_fkey
  FOREIGN KEY (whatsapp_group_id) REFERENCES public.whatsapp_groups(id) ON DELETE SET NULL;

-- 3. webinars.community_group_id → SET NULL
ALTER TABLE public.webinars
  DROP CONSTRAINT webinars_community_group_id_fkey;
ALTER TABLE public.webinars
  ADD CONSTRAINT webinars_community_group_id_fkey
  FOREIGN KEY (community_group_id) REFERENCES public.whatsapp_groups(id) ON DELETE SET NULL;

-- 4. webinar_whatsapp_groups.group_id → CASCADE
ALTER TABLE public.webinar_whatsapp_groups
  DROP CONSTRAINT webinar_whatsapp_groups_group_id_fkey;
ALTER TABLE public.webinar_whatsapp_groups
  ADD CONSTRAINT webinar_whatsapp_groups_group_id_fkey
  FOREIGN KEY (group_id) REFERENCES public.whatsapp_groups(id) ON DELETE CASCADE;

-- 5. scheduled_webinar_messages.group_id → CASCADE
ALTER TABLE public.scheduled_webinar_messages
  DROP CONSTRAINT scheduled_webinar_messages_group_id_fkey;
ALTER TABLE public.scheduled_webinar_messages
  ADD CONSTRAINT scheduled_webinar_messages_group_id_fkey
  FOREIGN KEY (group_id) REFERENCES public.whatsapp_groups(id) ON DELETE CASCADE;
