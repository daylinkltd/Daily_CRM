-- ============================================================
-- 128 — Printing presets: the shop's own vocabulary as data.
--
-- Sizes, paper types, GSM weights, print types, colour modes,
-- finishing options and units were free-text on the job form. Free
-- text means "Art Card", "art card" and "ArtCard" are three different
-- papers by the time anyone reports on them. Each kind becomes a
-- workspace-owned preset list: seeded with the trade's standard values
-- here, managed in Printing → Settings, and offered as searchable
-- dropdowns with an inline "+ Add" on the job form (the CreatableSelect
-- pattern) so a missing value is a two-second detour, not a support
-- ticket.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.printing_presets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN (
        'SIZE', 'PAPER_TYPE', 'GSM', 'PRINT_TYPE', 'COLOR_MODE', 'FINISHING', 'UNIT'
    )),
    label TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id, kind, label)
);

CREATE INDEX IF NOT EXISTS idx_printing_presets_workspace
    ON public.printing_presets (workspace_id, kind, active, sort_order);

ALTER TABLE public.printing_presets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Active workspace members can manage printing_presets" ON public.printing_presets;
CREATE POLICY "Active workspace members can manage printing_presets" ON public.printing_presets
    FOR ALL USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- ------------------------------------------------------------
-- Seeding. One function holds the catalogue so the backfill below and
-- the new-workspace trigger can never drift apart.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seed_printing_presets_for(p_workspace_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    INSERT INTO public.printing_presets (workspace_id, kind, label, sort_order)
    SELECT p_workspace_id, v.kind, v.label, v.sort_order
    FROM (VALUES
        -- Sizes: the card, the ISO series, and the common sheet sizes.
        ('SIZE', '3.5 x 2 inch (Visiting Card)', 1),
        ('SIZE', 'A6 (105 x 148 mm)',            2),
        ('SIZE', 'A5 (148 x 210 mm)',            3),
        ('SIZE', 'A4 (210 x 297 mm)',            4),
        ('SIZE', 'A3 (297 x 420 mm)',            5),
        ('SIZE', 'A2 (420 x 594 mm)',            6),
        ('SIZE', 'A1 (594 x 841 mm)',            7),
        ('SIZE', 'A0 (841 x 1189 mm)',           8),
        ('SIZE', '12 x 18 inch',                 9),
        ('SIZE', '13 x 19 inch',                10),
        ('SIZE', '18 x 23 inch',                11),
        ('SIZE', 'Custom (see instructions)',   12),

        ('PAPER_TYPE', 'Art Card',       1),
        ('PAPER_TYPE', 'Art Paper',      2),
        ('PAPER_TYPE', 'Maplitho',       3),
        ('PAPER_TYPE', 'Bond Paper',     4),
        ('PAPER_TYPE', 'Ivory',          5),
        ('PAPER_TYPE', 'NT Board',       6),
        ('PAPER_TYPE', 'Kraft',          7),
        ('PAPER_TYPE', 'Sticker Paper',  8),
        ('PAPER_TYPE', 'Sticker Vinyl',  9),
        ('PAPER_TYPE', 'Flex',          10),
        ('PAPER_TYPE', 'Star Flex',     11),
        ('PAPER_TYPE', 'Vinyl',         12),
        ('PAPER_TYPE', 'Canvas',        13),

        ('GSM', '70',  1), ('GSM', '80',  2), ('GSM', '90',  3),
        ('GSM', '100', 4), ('GSM', '115', 5), ('GSM', '130', 6),
        ('GSM', '170', 7), ('GSM', '210', 8), ('GSM', '250', 9),
        ('GSM', '300', 10), ('GSM', '350', 11),

        ('PRINT_TYPE', '1/0 (single side, one colour)',  1),
        ('PRINT_TYPE', '1/1 (both sides, one colour)',   2),
        ('PRINT_TYPE', '4/0 (single side, full colour)', 3),
        ('PRINT_TYPE', '4/4 (both sides, full colour)',  4),

        ('COLOR_MODE', 'Colour',      1),
        ('COLOR_MODE', 'B/W',         2),
        ('COLOR_MODE', 'Spot Colour', 3),

        ('FINISHING', 'Matte Lamination',  1),
        ('FINISHING', 'Gloss Lamination',  2),
        ('FINISHING', 'Velvet Lamination', 3),
        ('FINISHING', 'Spot UV',           4),
        ('FINISHING', 'Foiling',           5),
        ('FINISHING', 'Die Cutting',       6),
        ('FINISHING', 'Creasing',          7),
        ('FINISHING', 'Perfect Binding',   8),
        ('FINISHING', 'Spiral Binding',    9),
        ('FINISHING', 'Saddle Stitch',    10),
        ('FINISHING', 'Hard Binding',     11),

        ('UNIT', 'Nos',    1), ('UNIT', 'Sq.ft', 2), ('UNIT', 'Sq.m', 3),
        ('UNIT', 'Set',    4), ('UNIT', 'Book',  5), ('UNIT', 'Bundle', 6),
        ('UNIT', 'Job',    7), ('UNIT', 'Ream',  8)
    ) AS v(kind, label, sort_order)
    ON CONFLICT (workspace_id, kind, label) DO NOTHING;
$$;

-- Backfill every existing workspace.
SELECT public.seed_printing_presets_for(w.id) FROM public.workspaces w;

-- And every future one.
CREATE OR REPLACE FUNCTION public.seed_printing_presets_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    PERFORM public.seed_printing_presets_for(NEW.id);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_printing_presets ON public.workspaces;
CREATE TRIGGER trg_seed_printing_presets
    AFTER INSERT ON public.workspaces
    FOR EACH ROW EXECUTE FUNCTION public.seed_printing_presets_trigger();

-- ============================================================
-- Verify (run after pasting):
--
-- SELECT to_regclass('public.printing_presets');                -- not null
-- SELECT kind, count(*) FROM public.printing_presets
--   WHERE workspace_id = (SELECT id FROM public.workspaces LIMIT 1)
--   GROUP BY kind ORDER BY kind;
--   -- COLOR_MODE 3, FINISHING 11, GSM 11, PAPER_TYPE 13,
--   -- PRINT_TYPE 4, SIZE 12, UNIT 8
-- SELECT tgname FROM pg_trigger
--   WHERE tgname = 'trg_seed_printing_presets';                 -- exists
-- ============================================================
