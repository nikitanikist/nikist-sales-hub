
ALTER TABLE scheduled_webinar_messages
  ADD COLUMN IF NOT EXISTS message_id text,
  ADD COLUMN IF NOT EXISTS delivered_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS read_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reaction_count integer NOT NULL DEFAULT 0;
