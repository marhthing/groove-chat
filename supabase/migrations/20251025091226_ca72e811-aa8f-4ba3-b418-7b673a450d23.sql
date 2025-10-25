-- Add missing columns to conversations table if they don't exist
DO $$ 
BEGIN
  -- Add model_type column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'conversations' 
    AND column_name = 'model_type'
  ) THEN
    ALTER TABLE public.conversations ADD COLUMN model_type TEXT DEFAULT 'chat';
  END IF;

  -- Add shareable_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'conversations' 
    AND column_name = 'shareable_id'
  ) THEN
    ALTER TABLE public.conversations ADD COLUMN shareable_id TEXT;
  END IF;
END $$;

-- Add missing columns to messages table if they don't exist
DO $$ 
BEGIN
  -- Add image_url column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'messages' 
    AND column_name = 'image_url'
  ) THEN
    ALTER TABLE public.messages ADD COLUMN image_url TEXT;
  END IF;

  -- Add file_name column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'messages' 
    AND column_name = 'file_name'
  ) THEN
    ALTER TABLE public.messages ADD COLUMN file_name TEXT;
  END IF;

  -- Add file_type column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'messages' 
    AND column_name = 'file_type'
  ) THEN
    ALTER TABLE public.messages ADD COLUMN file_type TEXT;
  END IF;
END $$;