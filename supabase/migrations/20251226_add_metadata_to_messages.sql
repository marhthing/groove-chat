
-- Add metadata column to messages table to store chart specifications and other data
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS metadata jsonb;
