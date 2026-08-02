-- ============================================================
-- 087 — Record which device a punch came from.
--
-- Attendance previously stored only a coordinate, with no provenance:
-- no record of the device, the browser, the timezone it claimed, or the
-- network it came from. That makes a disputed punch unarguable either
-- way.
--
-- WHAT IS DELIBERATELY ABSENT: there is no mac_address column. Browsers
-- do not expose a MAC address to JavaScript — it was removed as a
-- fingerprinting vector and no permission unlocks it. Only a native app
-- or an MDM agent can read one. A column that could never be populated
-- would just look like a bug later.
--
-- The IP is written server-side from the request headers
-- (POST /api/attendance/device-context); the client cannot set it, and
-- the client-reported device JSON is self-reported and spoofable, so it
-- is corroborating detail rather than proof.
--
-- Idempotent; safe to re-run.
-- ============================================================

ALTER TABLE public.attendance
    ADD COLUMN IF NOT EXISTS punch_in_device_json  JSONB,
    ADD COLUMN IF NOT EXISTS punch_out_device_json JSONB,
    ADD COLUMN IF NOT EXISTS punch_in_ip           TEXT,
    ADD COLUMN IF NOT EXISTS punch_out_ip          TEXT;

COMMENT ON COLUMN public.attendance.punch_in_device_json IS
    'Self-reported browser/device details at punch in (user agent, OS, screen, timezone). Spoofable; corroborating detail only.';
COMMENT ON COLUMN public.attendance.punch_in_ip IS
    'Public IP resolved server-side from x-forwarded-for. Not client-settable.';

-- Flagging an attendance row for HR review, used by the geofence status
-- from 086 and now by device/timezone mismatches too.
ALTER TABLE public.attendance
    ADD COLUMN IF NOT EXISTS review_flags TEXT[];

CREATE INDEX IF NOT EXISTS idx_attendance_review_flags
    ON public.attendance USING GIN (review_flags)
    WHERE review_flags IS NOT NULL;
