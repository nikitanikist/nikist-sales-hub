
-- Deduplicate: keep the latest reaction per (campaign_group_id, reactor_phone)
DELETE FROM notification_campaign_reactions a
USING notification_campaign_reactions b
WHERE a.campaign_group_id = b.campaign_group_id
  AND a.reactor_phone = b.reactor_phone
  AND a.id < b.id;

-- Now add the unique constraint
ALTER TABLE notification_campaign_reactions 
  ADD CONSTRAINT unique_reactor_per_group 
  UNIQUE (campaign_group_id, reactor_phone);
