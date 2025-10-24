
-- Add file_name and file_type columns to messages table
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS file_name TEXT,
ADD COLUMN IF NOT EXISTS file_type TEXT;
