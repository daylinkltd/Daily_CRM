-- ============================================================
-- 103 — subscription lifecycle + coupons
-- ============================================================
--
-- THE MODEL. There is one product (Business). Every new workspace starts
-- a 14-day trial OF THAT PRODUCT with the seat count chosen at
-- onboarding — no card. Paying converts the trial into a paid period
-- (one month or twelve, prepaid). "Cancel anytime" means: no further
-- charge, access runs to the end of what was paid for. Nothing
-- auto-charges — payments here are one-off Razorpay orders — so
-- cancelling is a promise about OUR behaviour (we stop asking), not an
-- instruction to a card network.
--
-- STATUS IS WHAT HAPPENED; TIME DECIDES WHAT IT MEANS. No cron flips
-- 'trialing' to 'expired' at midnight. The stored columns record events
-- (trial started, payment landed, user cancelled) and the read path
-- (resolveSubscription in src/lib/limits.ts) derives today's state from
-- them. A status column that needs a scheduler to stay truthful is wrong
-- whenever the scheduler hiccups; arithmetic is never late.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- Subscription lifecycle columns
-- ------------------------------------------------------------
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS subscription_status text
    CHECK (subscription_status IN ('trialing', 'active', 'cancelled')),
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.workspaces.subscription_status IS
  'Last lifecycle EVENT, not current state: trialing | active | cancelled. ''expired'' is derived from time on read and never stored.';
COMMENT ON COLUMN public.workspaces.trial_ends_at IS
  'When the 14-day trial runs out. NULL on pre-103 rows: the app derives created_at + 14 days.';
COMMENT ON COLUMN public.workspaces.current_period_end IS
  'End of the prepaid period. NULL on pre-103 paid rows, which the app treats as active (never retro-expire paying customers).';

-- Backfill from what each workspace's plan already implies. free = the
-- old trial; anything else was paid for at some point.
UPDATE public.workspaces
   SET subscription_status = CASE WHEN plan = 'free' OR plan IS NULL THEN 'trialing' ELSE 'active' END,
       trial_ends_at = CASE WHEN plan = 'free' OR plan IS NULL THEN created_at + interval '14 days' ELSE NULL END
 WHERE subscription_status IS NULL;

-- ------------------------------------------------------------
-- Coupons
-- ------------------------------------------------------------
-- Percent-only, deliberately. A fixed-amount coupon interacts with GST
-- (discount reduces the taxable value), with annual-vs-monthly totals,
-- and with seat counts, and every one of those interactions is a place
-- for checkout and verify-payment to disagree by a paisa. A percentage
-- composes cleanly with all of them.
CREATE TABLE IF NOT EXISTS public.coupons (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  /** Stored uppercase; lookups uppercase their input. */
  code            text NOT NULL UNIQUE CHECK (code = upper(code) AND code ~ '^[A-Z0-9_-]{3,32}$'),
  description     text,
  percent_off     integer NOT NULL CHECK (percent_off BETWEEN 1 AND 100),
  /** NULL = any purchasable plan. */
  plan_id         text,
  /** NULL = unlimited. */
  max_redemptions integer CHECK (max_redemptions IS NULL OR max_redemptions > 0),
  redeemed_count  integer NOT NULL DEFAULT 0,
  valid_from      timestamptz NOT NULL DEFAULT now(),
  valid_until     timestamptz,
  active          boolean NOT NULL DEFAULT true,
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
  id            bigserial PRIMARY KEY,
  coupon_id     uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  workspace_id  uuid NOT NULL,
  user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  order_id      text NOT NULL,
  /** What the coupon actually saved, for the admin console. */
  discount_paise integer NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  /**
   * One redemption per order. Retried verifications must not double-count
   * against max_redemptions.
   */
  UNIQUE (coupon_id, order_id)
);

CREATE INDEX IF NOT EXISTS coupon_redemptions_coupon_idx
  ON public.coupon_redemptions (coupon_id, created_at DESC);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;

-- No tenant policies on either table. Coupons are validated and redeemed
-- through server routes using the service role — letting tenants SELECT
-- the coupon table would publish every discount code we have ever issued,
-- including partner- and rescue-deal codes that are priced for one
-- specific conversation.

-- Redemption counting that cannot double-count under retries: the unique
-- (coupon_id, order_id) makes the insert idempotent, and the counter only
-- moves when the insert actually inserted.
CREATE OR REPLACE FUNCTION public.redeem_coupon(
  p_code text,
  p_workspace_id uuid,
  p_user_id uuid,
  p_order_id text,
  p_discount_paise integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_coupon_id uuid;
  v_inserted boolean := false;
BEGIN
  SELECT id INTO v_coupon_id FROM public.coupons WHERE code = upper(p_code);
  IF v_coupon_id IS NULL THEN
    RETURN false;
  END IF;

  INSERT INTO public.coupon_redemptions
    (coupon_id, workspace_id, user_id, order_id, discount_paise)
  VALUES (v_coupon_id, p_workspace_id, p_user_id, p_order_id, p_discount_paise)
  ON CONFLICT (coupon_id, order_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF v_inserted THEN
    UPDATE public.coupons
       SET redeemed_count = redeemed_count + 1
     WHERE id = v_coupon_id;
  END IF;

  RETURN v_inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_coupon(text, uuid, uuid, text, integer) FROM PUBLIC;
-- Service role only — redemption happens inside verify-payment.

COMMIT;

-- ============================================================
-- Verify
-- ============================================================
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name='workspaces'
--    AND column_name IN ('subscription_status','trial_ends_at',
--                        'current_period_end','cancel_at_period_end');
--   -- four rows
--
-- SELECT subscription_status, count(*) FROM public.workspaces GROUP BY 1;
--   -- every row has a status after the backfill
--
-- SELECT to_regclass('public.coupons'), to_regclass('public.coupon_redemptions');
--
-- Idempotent redemption (rolled back):
--   BEGIN;
--     INSERT INTO public.coupons (code, percent_off) VALUES ('TEST10', 10);
--     SELECT public.redeem_coupon('TEST10', gen_random_uuid(), NULL, 'order_x', 100); -- true
--     SELECT public.redeem_coupon('TEST10', gen_random_uuid(), NULL, 'order_x', 100); -- false
--     SELECT redeemed_count FROM public.coupons WHERE code='TEST10';                  -- 1
--   ROLLBACK;
-- ============================================================
