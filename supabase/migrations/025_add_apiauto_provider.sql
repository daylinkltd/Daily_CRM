-- Migration 025: Allow 'apiauto' as a provider in whatsapp_config

-- 1. Drop the existing check constraint
ALTER TABLE public.whatsapp_config DROP CONSTRAINT IF EXISTS whatsapp_config_provider_check;

-- 2. Add the new check constraint that includes 'apiauto'
ALTER TABLE public.whatsapp_config ADD CONSTRAINT whatsapp_config_provider_check CHECK (provider IN ('meta', 'twilio', 'mock', 'apiauto'));
