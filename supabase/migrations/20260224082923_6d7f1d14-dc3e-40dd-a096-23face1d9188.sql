-- Step 1: Drop the old XOR constraint
ALTER TABLE public.dynamic_links
  DROP CONSTRAINT dynamic_links_destination_check;

-- Step 2: Backfill the one row that has NULL destination_url
UPDATE public.dynamic_links
SET destination_url = (
  SELECT invite_link FROM whatsapp_groups WHERE whatsapp_groups.id = dynamic_links.whatsapp_group_id
)
WHERE destination_url IS NULL AND whatsapp_group_id IS NOT NULL;

-- Step 3: Add simplified constraint
ALTER TABLE public.dynamic_links
  ADD CONSTRAINT dynamic_links_destination_check
  CHECK (destination_url IS NOT NULL);