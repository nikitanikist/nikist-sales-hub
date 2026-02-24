
-- Fix the contradictory FK constraint (ON DELETE SET NULL vs NOT NULL column)
ALTER TABLE notification_campaign_groups
  DROP CONSTRAINT IF EXISTS notification_campaign_groups_group_id_fkey;

ALTER TABLE notification_campaign_groups
  ADD CONSTRAINT notification_campaign_groups_group_id_fkey
  FOREIGN KEY (group_id) REFERENCES whatsapp_groups(id) ON DELETE CASCADE;
