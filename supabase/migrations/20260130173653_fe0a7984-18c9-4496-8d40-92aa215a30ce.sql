-- Add timezone column to organizations table
ALTER TABLE organizations 
ADD COLUMN timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata';

-- Add comment for documentation
COMMENT ON COLUMN organizations.timezone IS 'IANA timezone identifier (e.g., Asia/Kolkata, Asia/Dubai, America/New_York)';