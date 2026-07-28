-- ============================================================
-- 054_whatsapp_app_secret.sql
--
-- Per-workspace Meta App Secret (stored encrypted, like
-- access_token). Used by the webhook route to verify the
-- x-hub-signature-256 HMAC on inbound events. Without a correct
-- secret every inbound message is rejected with a 401 — the exact
-- "outbound works, inbound silent" failure mode.
--
-- webhook-signature.ts already reads this column when present; the
-- config API validates the secret against Meta before saving.
-- ============================================================

ALTER TABLE public.whatsapp_config
  ADD COLUMN IF NOT EXISTS app_secret TEXT;
