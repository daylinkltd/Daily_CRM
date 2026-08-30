-- ============================================================
-- 123 — the GST ledger becomes filing-grade, and document numbers
--       start behaving like GST document numbers
--
-- Two unrelated-looking problems, both of which make a filed return
-- wrong, and both of which fail silently today.
--
-- ------------------------------------------------------------
-- PART A — the ledger cannot describe a return
-- ------------------------------------------------------------
-- GSTR-1 is not a list of invoices. It is organised entirely by
-- DOCUMENT TYPE and SUPPLY TYPE: B2B invoices go in one table, large
-- inter-state B2C in another, small B2C only as state-and-rate
-- aggregates, credit notes in their own table keyed to the invoice they
-- amend. `commerce_gst_ledgers` records none of that, so a return could
-- not be built from it even with perfect data.
--
-- It also carries three defaults that do not fail loudly, they file
-- WRONG:
--
--   source_state_code      DEFAULT '27'    -- Maharashtra
--   destination_state_code DEFAULT '27'
--   hsn_sac_code           DEFAULT '7113'  -- articles of jewellery
--
-- '27' decides CGST+SGST versus IGST. A Karnataka shop selling in
-- Karnataka would be booked correctly by luck and a Karnataka shop
-- selling to Maharashtra booked wrongly, with no error either way. The
-- application layer stopped relying on these defaults earlier; this
-- removes them from the column so a row cannot acquire one by being
-- inserted from anywhere else.
--
-- '7113' is worse, because it is a real HSN code for someone else's
-- business. An unset HSN must read as unset.
--
-- ------------------------------------------------------------
-- PART B — generate_next_document_number ignores its own rules
-- ------------------------------------------------------------
-- Rule 46 requires an invoice serial number that is consecutive and
-- unique within a financial year. The current function:
--
--   * selects the series by (workspace_id, document_type) while the
--     table is UNIQUE on (workspace_id, document_type, prefix,
--     financial_year) — so once a second year or a second prefix
--     exists, it picks an arbitrary row and numbers drift between them;
--   * declares a `reset_rule` column and never reads it, so YEARLY
--     never resets and the number climbs across financial years;
--   * when no series exists, returns 'INVOICE-A1B2C3' from a random
--     UUID — not consecutive, not a series, and permanent once it is on
--     a document a customer has seen.
--
-- Fixed by making the reset period explicit. `period_key` is the period
-- a number belongs to ('2026-2027', '2026-08', '2026-08-31', or 'ALL'),
-- derived from reset_rule, and the series is looked up and created by
-- it. A new period has no row, so it starts at 1 — which is what the
-- reset always meant.
--
-- Financial year is April-March, as GST uses.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- A1. The columns a return actually needs.
-- ------------------------------------------------------------
ALTER TABLE public.commerce_gst_ledgers
  -- Which GST document this is. A bill of supply carries no tax but is
  -- still reported; a credit note reverses a specific earlier invoice.
  ADD COLUMN IF NOT EXISTS document_type text NOT NULL DEFAULT 'TAX_INVOICE'
    CHECK (document_type IN ('TAX_INVOICE', 'BILL_OF_SUPPLY', 'CREDIT_NOTE', 'DEBIT_NOTE')),

  -- Which GSTR-1 table the row belongs in. B2CS is aggregated by state
  -- and rate rather than listed, which is why small shops are easy.
  ADD COLUMN IF NOT EXISTS supply_type text NOT NULL DEFAULT 'B2CS'
    CHECK (supply_type IN ('B2B', 'B2CL', 'B2CS', 'EXPORT', 'SEZ', 'EXEMPT', 'NIL_RATED', 'NON_GST')),

  -- Place of supply. Usually the buyer's state but NOT always — services
  -- have their own rules — so it is recorded rather than derived at
  -- filing time.
  ADD COLUMN IF NOT EXISTS place_of_supply text,

  -- Compensation cess. Separate from GST and never part of total_gst.
  ADD COLUMN IF NOT EXISTS cess_amount numeric NOT NULL DEFAULT 0,

  -- Reverse charge: the recipient pays the tax, not the supplier.
  ADD COLUMN IF NOT EXISTS is_reverse_charge boolean NOT NULL DEFAULT false,

  -- A credit or debit note must name the document it amends.
  ADD COLUMN IF NOT EXISTS original_invoice_number text,
  ADD COLUMN IF NOT EXISTS original_invoice_date date,

  -- Where this row came from, so a gap in coverage is visible as data
  -- rather than as a missing return line nobody noticed.
  ADD COLUMN IF NOT EXISTS source_document text
    CHECK (source_document IS NULL OR source_document IN ('POS', 'INVOICE', 'PURCHASE', 'MANUAL', 'IMPORT'));

COMMENT ON COLUMN public.commerce_gst_ledgers.supply_type IS
  'Which GSTR-1 table this belongs in. B2B needs the buyer GSTIN; B2CL is inter-state B2C above the invoice-value threshold; B2CS is aggregated by state and rate.';
COMMENT ON COLUMN public.commerce_gst_ledgers.cess_amount IS
  'Compensation cess. Deliberately excluded from total_gst — it is reported in its own column of every return.';

-- ------------------------------------------------------------
-- A2. Remove the defaults that file wrong.
--
-- Existing rows are left alone: back-filling a guess would be the same
-- mistake, made once more and harder to find. Rows carrying a defaulted
-- value are reported by the verify query at the bottom.
-- ------------------------------------------------------------
ALTER TABLE public.commerce_gst_ledgers
  ALTER COLUMN source_state_code DROP DEFAULT,
  ALTER COLUMN destination_state_code DROP DEFAULT,
  ALTER COLUMN hsn_sac_code DROP DEFAULT;

-- The state columns are NOT NULL and now have no default, so a caller
-- that omits them fails loudly at insert instead of silently becoming
-- Maharashtra. That is the intended behaviour.

-- ------------------------------------------------------------
-- A3. One active ledger row per document.
--
-- Posting is retried (a double-clicked Send, a failed response on a
-- committed write). Without this, a retry doubles the GST liability in
-- the return and the duplicate is invisible until a reconciliation
-- catches it months later.
--
-- Partial, so reversing to CANCELLED and re-issuing stays possible.
-- Duplicates that already exist are collapsed to the earliest row.
-- ------------------------------------------------------------
DELETE FROM public.commerce_gst_ledgers a
 USING public.commerce_gst_ledgers b
 WHERE a.status = 'ACTIVE'
   AND b.status = 'ACTIVE'
   AND a.workspace_id = b.workspace_id
   AND a.ledger_type = b.ledger_type
   AND a.invoice_number = b.invoice_number
   AND (a.created_at, a.id) > (b.created_at, b.id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gst_ledger_one_active_per_document
  ON public.commerce_gst_ledgers (workspace_id, ledger_type, invoice_number)
  WHERE status = 'ACTIVE';

-- Filing reads a period at a time, grouped by how the return is built.
CREATE INDEX IF NOT EXISTS idx_gst_ledger_return_build
  ON public.commerce_gst_ledgers (workspace_id, invoice_date, supply_type, document_type)
  WHERE status = 'ACTIVE';

-- ------------------------------------------------------------
-- B1. period_key — the reset period a number belongs to.
-- ------------------------------------------------------------
ALTER TABLE public.platform_number_series
  ADD COLUMN IF NOT EXISTS period_key text;

-- Existing series keep their numbering: their period is the financial
-- year they already recorded, so the next number continues from where
-- the counter stands rather than restarting at 1 and colliding.
UPDATE public.platform_number_series
   SET period_key = COALESCE(financial_year, 'ALL')
 WHERE period_key IS NULL;

ALTER TABLE public.platform_number_series
  ALTER COLUMN period_key SET NOT NULL;

-- Two rows for the same document type in the same period would each
-- hand out numbers, producing a series with duplicates in it.
CREATE UNIQUE INDEX IF NOT EXISTS idx_number_series_period
  ON public.platform_number_series (workspace_id, document_type, period_key);

-- ------------------------------------------------------------
-- B2. The period key for a reset rule, as of today.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.document_series_period_key(p_reset_rule text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE upper(COALESCE(p_reset_rule, 'YEARLY'))
    WHEN 'NEVER'   THEN 'ALL'
    WHEN 'MONTHLY' THEN to_char(CURRENT_DATE, 'YYYY-MM')
    WHEN 'DAILY'   THEN to_char(CURRENT_DATE, 'YYYY-MM-DD')
    -- GST financial year: April to March.
    ELSE CASE
           WHEN EXTRACT(MONTH FROM CURRENT_DATE) >= 4
             THEN to_char(CURRENT_DATE, 'YYYY') || '-' ||
                  to_char(CURRENT_DATE + INTERVAL '1 year', 'YYYY')
           ELSE to_char(CURRENT_DATE - INTERVAL '1 year', 'YYYY') || '-' ||
                to_char(CURRENT_DATE, 'YYYY')
         END
  END;
$$;

-- ------------------------------------------------------------
-- B3. The numbering function, doing what its columns promised.
--
-- Creates the series when it does not exist, so the first document of a
-- new financial year is number 1 of that year rather than a random
-- string. The INSERT ... ON CONFLICT makes two simultaneous first
-- documents resolve to the same series instead of one of them failing.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_next_document_number(
    p_workspace_id UUID,
    p_document_type TEXT
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_series   RECORD;
    v_template RECORD;
    v_period   TEXT;
    v_number   INT;
BEGIN
    -- Any existing row for this document type carries the operator's
    -- chosen prefix, suffix and reset rule; the newest one wins as the
    -- template for a fresh period.
    SELECT prefix, suffix, reset_rule
      INTO v_template
      FROM public.platform_number_series
     WHERE workspace_id = p_workspace_id
       AND document_type = p_document_type
     ORDER BY created_at DESC
     LIMIT 1;

    v_period := public.document_series_period_key(COALESCE(v_template.reset_rule, 'YEARLY'));

    -- Claim the row for this period, creating it if this is the first
    -- document of the period.
    INSERT INTO public.platform_number_series
        (workspace_id, document_type, prefix, suffix, running_number, reset_rule, period_key, financial_year)
    VALUES (
        p_workspace_id,
        p_document_type,
        COALESCE(v_template.prefix, upper(left(p_document_type, 3)) || '/'),
        COALESCE(v_template.suffix, ''),
        1,
        COALESCE(v_template.reset_rule, 'YEARLY'),
        v_period,
        v_period
    )
    ON CONFLICT (workspace_id, document_type, period_key) DO NOTHING;

    SELECT * INTO v_series
      FROM public.platform_number_series
     WHERE workspace_id = p_workspace_id
       AND document_type = p_document_type
       AND period_key = v_period
     FOR UPDATE;

    v_number := v_series.running_number;

    UPDATE public.platform_number_series
       SET running_number = running_number + 1
     WHERE id = v_series.id;

    RETURN COALESCE(v_series.prefix, '')
        || LPAD(v_number::text, 6, '0')
        || COALESCE(v_series.suffix, '');
END;
$$;

REVOKE ALL ON FUNCTION public.generate_next_document_number(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_next_document_number(UUID, TEXT) TO authenticated;

-- ------------------------------------------------------------
-- C. Customers need a GSTIN, or nothing can ever be B2B.
--
-- `contacts` carries a name, phone, email and company and no tax
-- identity at all. Without a GSTIN on the buyer, every invoice a
-- workspace raises is classified B2CS — a sale to an unregistered
-- person — no matter who it was actually to.
--
-- The cost of that lands on the CUSTOMER'S customer: B2B rows are what
-- a buyer claims input credit against, and a sale never reported as B2B
-- is credit they simply never receive. It is also invisible from our
-- side, because a B2CS return is perfectly valid and files without
-- complaint.
--
-- state_code is stored separately rather than always sliced from the
-- GSTIN, because place of supply is not always the buyer's registered
-- state.
-- ------------------------------------------------------------
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS gstin text,
  ADD COLUMN IF NOT EXISTS state_code text;

COMMENT ON COLUMN public.contacts.gstin IS
  'Buyer GSTIN. Its presence is what makes a sale B2B in GSTR-1, and what lets this buyer claim input credit.';

-- A GSTIN is 15 characters: 2 state + 10 PAN + 1 entity + 1 'Z' + 1
-- checksum. Enforcing the shape stops a phone number or a typo being
-- filed as someone's tax identity; the checksum itself is verified in
-- the application, where the failure can be explained.
ALTER TABLE public.contacts
  DROP CONSTRAINT IF EXISTS contacts_gstin_shape;
ALTER TABLE public.contacts
  ADD CONSTRAINT contacts_gstin_shape
  CHECK (gstin IS NULL OR gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$');

COMMIT;

-- ============================================================
-- Verify
-- ============================================================
-- 1. The new ledger columns exist:
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name = 'commerce_gst_ledgers'
--    AND column_name IN ('document_type','supply_type','place_of_supply',
--                        'cess_amount','is_reverse_charge','source_document');
--   -- expect: 6 rows
--
-- 2. The wrong defaults are gone (all three must be NULL):
-- SELECT column_name, column_default FROM information_schema.columns
--  WHERE table_name = 'commerce_gst_ledgers'
--    AND column_name IN ('source_state_code','destination_state_code','hsn_sac_code');
--
-- 3. How much existing data still carries a defaulted value. These rows
--    are the Phase 0 clean-up list, not an error:
-- SELECT count(*) FILTER (WHERE hsn_sac_code = '7113')        AS jewellery_hsn,
--        count(*) FILTER (WHERE source_state_code = '27')     AS maharashtra_source,
--        count(*) FILTER (WHERE gstin IS NULL AND is_b2b)     AS b2b_without_gstin
--   FROM public.commerce_gst_ledgers WHERE status = 'ACTIVE';
--
-- 4. Numbering resets per financial year and is consecutive. Run twice —
--    the number must increase by exactly 1, and start at 000001 for a
--    document type this workspace has never issued:
-- SELECT public.generate_next_document_number(
--          (SELECT id FROM public.workspaces LIMIT 1), 'VERIFY_SCRATCH');
--
-- 5. Today's financial-year key (expect 2026-2027 for any date from
--    1 Apr 2026 to 31 Mar 2027):
-- SELECT public.document_series_period_key('YEARLY');
--
-- 6. Clean up the scratch series from step 4:
-- DELETE FROM public.platform_number_series WHERE document_type = 'VERIFY_SCRATCH';
-- ============================================================
