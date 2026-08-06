-- ============================================================
-- 106 — platform messaging: templates and the outbound log
-- ============================================================
--
-- The platform (Dailybuz itself) talking to its TENANTS over email,
-- WhatsApp and SMS — trial nudges, payment reminders, feature notes —
-- composed and sent from the SaaS console. This is a different animal
-- from the CRM's messaging, which is tenants talking to THEIR customers
-- with their own connected numbers; the two share Meta send code but
-- nothing else, and mixing their data would leak platform campaigns into
-- tenant inboxes.
--
-- Channel CREDENTIALS are not in these tables. SMTP, the platform
-- WhatsApp number and the SMS key live in environment variables like
-- every other secret, visible in the console's System page only as
-- configured/missing.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.platform_message_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  channel     text NOT NULL CHECK (channel IN ('email', 'whatsapp', 'sms')),
  /** Email only. */
  subject     text,
  /**
   * Body with {{variables}}. Provided at send time: {{name}},
   * {{workspace}}, {{plan}}, {{trial_ends}}, plus anything typed ad hoc.
   */
  body        text NOT NULL,
  /**
   * WhatsApp only: the Meta-approved template name this maps to. Meta
   * refuses free-form text outside the 24h window, so business-initiated
   * WhatsApp REQUIRES an approved template; the body above is what the
   * console shows as a preview of it.
   */
  meta_template_name text,
  meta_template_language text DEFAULT 'en',
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- One send = one recipient = one row. The unit an admin asks about later
-- is "did Rakesh get the payment reminder?", not "did campaign 7 run".
CREATE TABLE IF NOT EXISTS public.platform_outbound_messages (
  id            bigserial PRIMARY KEY,
  channel       text NOT NULL CHECK (channel IN ('email', 'whatsapp', 'sms')),
  recipient     text NOT NULL,
  workspace_id  uuid,
  workspace_name text,
  template_id   uuid REFERENCES public.platform_message_templates(id) ON DELETE SET NULL,
  subject       text,
  /** The RENDERED body actually sent, variables resolved. */
  body          text NOT NULL,
  status        text NOT NULL CHECK (status IN ('sent', 'failed')),
  /** Provider message id (Meta wamid, SMTP message-id, SMS id). */
  provider_id   text,
  error         text,
  sent_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_by_email text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS platform_outbound_created_idx
  ON public.platform_outbound_messages (created_at DESC);
CREATE INDEX IF NOT EXISTS platform_outbound_recipient_idx
  ON public.platform_outbound_messages (recipient);

-- Service-role only, both tables: RLS on, no tenant policies. The
-- outbound log is additionally append-only — a send that happened,
-- happened, and "we never messaged you" disputes are settled by a table
-- nobody can prune.
ALTER TABLE public.platform_message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_outbound_messages ENABLE ROW LEVEL SECURITY;
REVOKE UPDATE, DELETE ON public.platform_outbound_messages FROM PUBLIC;
REVOKE UPDATE, DELETE ON public.platform_outbound_messages FROM anon, authenticated;

COMMIT;

-- ============================================================
-- Verify
-- ============================================================
-- SELECT to_regclass('public.platform_message_templates'),
--        to_regclass('public.platform_outbound_messages');  -- both not null
--
-- SELECT policyname FROM pg_policies
--  WHERE tablename IN ('platform_message_templates','platform_outbound_messages');
--   -- expect zero rows (service-role only, by design)
-- ============================================================
