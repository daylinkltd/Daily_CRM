-- ============================================================
-- 134 — WhatsApp Bridge provider: 'bridge' joins the provider list.
--
-- The Dailybuz WhatsApp Bridge (whatsapp-bridge/ in the repo) connects
-- a tenant's number over the WhatsApp Web multi-device protocol — QR
-- pairing, no Meta account, no per-conversation charges. For a bridge
-- connection the whatsapp_config row stores:
--   provider        = 'bridge'
--   phone_number_id = the bridge instance id (the workspace id)
--   access_token    = placeholder (the bridge trusts one server-side
--                     key from env, never per-tenant credentials)
--
-- Session keys live in the bridge's OWN Postgres, not this database.
-- ============================================================

ALTER TABLE public.whatsapp_config DROP CONSTRAINT IF EXISTS whatsapp_config_provider_check;
ALTER TABLE public.whatsapp_config ADD CONSTRAINT whatsapp_config_provider_check
    CHECK (provider IN ('meta', 'twilio', 'mock', 'apiauto', 'bridge'));

-- ============================================================
-- Verify (run after pasting):
--
-- SELECT pg_get_constraintdef(oid) FROM pg_constraint
--   WHERE conname = 'whatsapp_config_provider_check';
--   -- expect: CHECK (provider IN ('meta','twilio','mock','apiauto','bridge'))
-- ============================================================
