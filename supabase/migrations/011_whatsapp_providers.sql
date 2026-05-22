-- Migration 011: Add Multiple WhatsApp Providers support to whatsapp_config
-- Add provider column with CHECK constraint
ALTER TABLE public.whatsapp_config 
ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'meta' CHECK (provider IN ('meta', 'twilio', 'mock'));

-- Drop the old unique constraint on user_id if it exists
ALTER TABLE public.whatsapp_config 
DROP CONSTRAINT IF EXISTS whatsapp_config_user_id_key;

-- Add new unique constraint on workspace_id if it doesn't already exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'whatsapp_config_workspace_id_key'
    ) THEN
        ALTER TABLE public.whatsapp_config 
        ADD CONSTRAINT whatsapp_config_workspace_id_key UNIQUE (workspace_id);
    END IF;
END $$;
