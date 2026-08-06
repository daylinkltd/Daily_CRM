-- ============================================================
-- 107 — messaging credentials in Settings, and the seed library
-- ============================================================
--
-- CREDENTIALS MOVE FROM COOLIFY TO THE CONSOLE. platform_settings holds
-- them as key/value rows; SECRET values are AES-256-GCM encrypted by the
-- application before insert (same scheme as tenant WhatsApp tokens), so
-- a database read alone never yields a usable credential. RLS on, no
-- policies: only the service role touches this table, and the API that
-- fronts it returns configured/missing — never values.
--
-- SEED TEMPLATES. Every message a SaaS actually sends across its
-- customer lifecycle, pre-written with the platform's {{variables}}.
-- Idempotent via UNIQUE(channel, name) + ON CONFLICT DO NOTHING, so
-- re-running the migration or editing a seeded template never duplicates
-- or overwrites. WhatsApp seeds carry meta_template_name values that
-- STILL NEED APPROVAL in Meta Business Manager — the migration cannot do
-- that part, and the console says so.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- Settings store
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key         text PRIMARY KEY,
  /** Plaintext for ordinary values; AES-256-GCM ciphertext when is_secret. */
  value       text NOT NULL,
  is_secret   boolean NOT NULL DEFAULT false,
  updated_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
-- No policies: service-role only.

-- ------------------------------------------------------------
-- Template identity + seeds
-- ------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS platform_templates_channel_name_uniq
  ON public.platform_message_templates (channel, name);

INSERT INTO public.platform_message_templates
  (name, channel, subject, body, meta_template_name, meta_template_language)
VALUES
-- ═══ EMAIL — the lifecycle, in order ═══
('Welcome — trial started', 'email',
 'Welcome to Dailybuz, {{name}} — your 14-day trial is live',
 E'Hi {{name}},\n\nYour workspace "{{workspace}}" is ready, with every module unlocked for 14 days — CRM, HR, accounting, retail, projects and the WhatsApp inbox.\n\nThree good first steps:\n1. Connect your WhatsApp Business number (Settings → Integrations)\n2. Import your contacts and products (CSV works)\n3. Invite your team — you chose your seat count, add people to fill it\n\nYour trial ends on {{trial_ends}}. No card is needed until you decide to stay, and your data is yours either way.\n\nReply to this email and a person answers.\n\n— Team Dailybuz',
 NULL, 'en'),

('Trial ending in 3 days', 'email',
 '{{workspace}}: your Dailybuz trial ends {{trial_ends}}',
 E'Hi {{name}},\n\nYour trial of Dailybuz for "{{workspace}}" ends on {{trial_ends}}.\n\nIf it has earned its place, subscribing takes two minutes: Settings → Billing, pick your seats, pay by UPI, card or netbanking. Everything you have set up carries over exactly as it is.\n\nIf it has not, no action is needed — nothing will be charged, and your data stays safe in case you return.\n\nQuestions about pricing or a coupon? Just reply.\n\n— Team Dailybuz',
 NULL, 'en'),

('Trial expired — pay to continue', 'email',
 'Your Dailybuz workspace "{{workspace}}" is paused',
 E'Hi {{name}},\n\nYour 14-day trial ended on {{trial_ends}} and "{{workspace}}" is now paused — everything is exactly where you left it, waiting.\n\nTo pick up where you stopped: sign in → Settings → Billing → subscribe for your team. Access returns the moment payment lands.\n\nIf Dailybuz was not the right fit, we would genuinely like to know why — reply with one line and we read it.\n\n— Team Dailybuz',
 NULL, 'en'),

('Payment received', 'email',
 'Payment received — {{workspace}} is active',
 E'Hi {{name}},\n\nWe have received your payment for "{{workspace}}" ({{plan}} plan). Your subscription is active and a GST invoice is available from Settings → Billing.\n\nPayments are processed by Daylink Tech Labs Private Limited — your card or bank statement will show "Daylink".\n\nThank you for building on Dailybuz.\n\n— Team Dailybuz',
 NULL, 'en'),

('Renewal reminder', 'email',
 '{{workspace}}: your Dailybuz period ends soon',
 E'Hi {{name}},\n\nThe paid period for "{{workspace}}" is coming to an end. Nothing auto-charges at Dailybuz — renewing is always your deliberate act.\n\nRenew in two minutes from Settings → Billing. If you do nothing, access continues to the end of the period you paid for and then pauses; your data stays intact.\n\n— Team Dailybuz',
 NULL, 'en'),

('Subscription cancelled — confirmation', 'email',
 'Your Dailybuz subscription is cancelled, as requested',
 E'Hi {{name}},\n\nConfirming your cancellation for "{{workspace}}". No further payment will be requested. Access continues until the end of the period already paid for, and you can resume anytime before then from Settings → Billing.\n\nIf something drove you away that we could fix, one reply telling us what would mean a lot.\n\n— Team Dailybuz',
 NULL, 'en'),

('All seats in use', 'email',
 '{{workspace}} has filled all its seats',
 E'Hi {{name}},\n\nEvery seat in "{{workspace}}" is now in use — which usually means the team is growing. Congratulations.\n\nAdding seats takes a minute from Settings → Billing; the new seats are active immediately and billed at your existing per-seat rate.\n\n— Team Dailybuz',
 NULL, 'en'),

('New feature announcement', 'email',
 'New in Dailybuz: {{feature}}',
 E'Hi {{name}},\n\n{{feature}} is now live in your workspace "{{workspace}}" — included in your plan, nothing to enable, nothing extra to pay.\n\n{{details}}\n\nAs always, the full list of what is in development is public on our compare page.\n\n— Team Dailybuz',
 NULL, 'en'),

('Scheduled maintenance notice', 'email',
 'Dailybuz maintenance window: {{window}}',
 E'Hi {{name}},\n\nDailybuz will be briefly unavailable during {{window}} for planned maintenance. Typical downtime is minutes, not hours; nothing is required from you and no data is affected.\n\nWe schedule these outside Indian business hours whenever possible.\n\n— Team Dailybuz',
 NULL, 'en'),

-- ═══ WHATSAPP — meta_template_name must be created & APPROVED in Meta
-- Business Manager with matching bodies before these can send ═══
('Trial ending (WhatsApp)', 'whatsapp', NULL,
 'Hi {{name}}, your Dailybuz trial for {{workspace}} ends on {{trial_ends}}. Subscribe from Settings → Billing to keep everything exactly as you built it. Reply here if you have questions.',
 'db_trial_ending', 'en'),

('Payment due (WhatsApp)', 'whatsapp', NULL,
 'Hi {{name}}, the Dailybuz subscription for {{workspace}} is awaiting payment. Renew in two minutes from Settings → Billing — UPI, card or netbanking. Your data is safe and waiting.',
 'db_payment_due', 'en'),

('Payment received (WhatsApp)', 'whatsapp', NULL,
 'Hi {{name}}, payment received — {{workspace}} is active on the {{plan}} plan. Your GST invoice is in Settings → Billing. Thank you for building on Dailybuz.',
 'db_payment_received', 'en'),

('Announcement (WhatsApp)', 'whatsapp', NULL,
 'Hi {{name}}, an update from Dailybuz for {{workspace}}: {{details}}',
 'db_announcement', 'en'),

-- ═══ SMS — DLT: sender id and content must match registered templates ═══
('Trial ending (SMS)', 'sms', NULL,
 'Dailybuz: your trial for {{workspace}} ends {{trial_ends}}. Subscribe in-app (Settings > Billing) to continue. - Daylink Tech Labs',
 NULL, 'en'),

('Payment due (SMS)', 'sms', NULL,
 'Dailybuz: subscription for {{workspace}} awaits payment. Renew in-app (Settings > Billing). Data safe. - Daylink Tech Labs',
 NULL, 'en'),

('Payment received (SMS)', 'sms', NULL,
 'Dailybuz: payment received, {{workspace}} is active on {{plan}}. Invoice in Settings > Billing. Thank you. - Daylink Tech Labs',
 NULL, 'en')

ON CONFLICT (channel, name) DO NOTHING;

COMMIT;

-- ============================================================
-- Verify
-- ============================================================
-- SELECT to_regclass('public.platform_settings');            -- not null
-- SELECT channel, count(*) FROM public.platform_message_templates GROUP BY 1;
--   -- expect at least: email 9, whatsapp 4, sms 3
-- SELECT indexname FROM pg_indexes
--  WHERE tablename='platform_message_templates'
--    AND indexname='platform_templates_channel_name_uniq';
--
-- Re-run the INSERT block: every row reports "0 rows" (idempotent).
-- ============================================================
