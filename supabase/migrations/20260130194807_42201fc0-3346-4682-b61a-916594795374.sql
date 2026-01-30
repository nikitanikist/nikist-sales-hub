-- Create storage bucket for template media
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'template-media',
  'template-media',
  true,
  16777216, -- 16MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'application/pdf']
);

-- RLS Policy: Allow authenticated users to upload
CREATE POLICY "Allow authenticated uploads to template-media" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'template-media');

-- RLS Policy: Allow public read access (needed for WhatsApp to fetch media)
CREATE POLICY "Allow public read on template-media" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'template-media');

-- RLS Policy: Allow authenticated users to update their uploads
CREATE POLICY "Allow authenticated updates to template-media" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'template-media');

-- RLS Policy: Allow authenticated users to delete from template-media
CREATE POLICY "Allow authenticated deletes from template-media" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'template-media');