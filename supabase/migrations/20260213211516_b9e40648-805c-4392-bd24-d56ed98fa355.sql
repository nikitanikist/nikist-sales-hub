ALTER TABLE whatsapp_groups
  ADD COLUMN is_community boolean NOT NULL DEFAULT false,
  ADD COLUMN is_community_announce boolean NOT NULL DEFAULT false;