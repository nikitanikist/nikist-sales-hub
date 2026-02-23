ALTER TABLE whatsapp_sessions 
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS last_error_at timestamptz;

ALTER TABLE scheduled_whatsapp_messages 
  ADD COLUMN IF NOT EXISTS vps_error text;