
-- Add delivered_count to campaign groups
ALTER TABLE public.notification_campaign_groups
ADD COLUMN delivered_count integer NOT NULL DEFAULT 0;

-- Add receipt_type to campaign reads
ALTER TABLE public.notification_campaign_reads
ADD COLUMN receipt_type text NOT NULL DEFAULT 'read'
CHECK (receipt_type IN ('read', 'delivered'));

-- Drop old unique constraint and add new one including receipt_type
ALTER TABLE public.notification_campaign_reads
DROP CONSTRAINT IF EXISTS notification_campaign_reads_campaign_group_id_reader_phone_key;

ALTER TABLE public.notification_campaign_reads
ADD CONSTRAINT notification_campaign_reads_group_phone_type_key
UNIQUE (campaign_group_id, reader_phone, receipt_type);
