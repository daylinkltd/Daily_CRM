-- ============================================================
-- 117 — let an issued document be unlocked back to Draft
--
-- Migration 085 froze Approved / Issued / Cancelled documents: no
-- content edits, and the only permitted status move was to Cancelled.
-- That is the right default — an issued letter with a number on it is a
-- record, not a working copy — but it left no way back from an honest
-- mistake. Cancelling and re-issuing burns a document number and leaves
-- a cancelled row in the vault that looks like something went wrong
-- with the employee rather than with the typing.
--
-- This adds ONE transition: Approved / Issued → Draft, and nothing
-- else. The letter has to be unlocked first; only then do the existing
-- content rules let it be edited, exactly as for any other draft. So
-- the frozen-while-issued guarantee is intact — what changes is that an
-- author can deliberately step back, and the step is visible: `version`
-- increments on every unlock, so the row carries a count of how many
-- times it has been reopened.
--
-- Cancelled stays terminal. A cancelled document has been withdrawn,
-- possibly communicated as such, and reviving it silently is not a
-- recovery — it is a different document.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.freeze_issued_official_documents()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_unlocking BOOLEAN;
BEGIN
    -- The deliberate step back. Recognised BEFORE the content checks so
    -- an unlock is not mistaken for an edit of a frozen row.
    v_unlocking := OLD.status IN ('Approved', 'Issued')
                   AND NEW.status = 'Draft';

    IF v_unlocking THEN
        -- An unlock changes the status and nothing else. Anything else
        -- in the same statement is an edit of a still-frozen document.
        IF NEW.body_html                IS DISTINCT FROM OLD.body_html
            OR NEW.body_json                IS DISTINCT FROM OLD.body_json
            OR NEW.document_number          IS DISTINCT FROM OLD.document_number
            OR NEW.title                    IS DISTINCT FROM OLD.title
            OR NEW.recipient_name           IS DISTINCT FROM OLD.recipient_name
            OR NEW.template_snapshot_json   IS DISTINCT FROM OLD.template_snapshot_json
            OR NEW.letterhead_snapshot_json IS DISTINCT FROM OLD.letterhead_snapshot_json
            OR NEW.signatory_snapshot_json  IS DISTINCT FROM OLD.signatory_snapshot_json
        THEN
            RAISE EXCEPTION
                'Unlock document % on its own, then edit it as a draft.',
                OLD.document_number;
        END IF;

        -- Leaves a trace: a letter on version 3 has been reopened twice.
        NEW.version := COALESCE(OLD.version, 1) + 1;
        RETURN NEW;
    END IF;

    IF OLD.status IN ('Approved', 'Issued', 'Cancelled') THEN
        IF NEW.body_html                IS DISTINCT FROM OLD.body_html
            OR NEW.body_json                IS DISTINCT FROM OLD.body_json
            OR NEW.document_number          IS DISTINCT FROM OLD.document_number
            OR NEW.title                    IS DISTINCT FROM OLD.title
            OR NEW.recipient_name           IS DISTINCT FROM OLD.recipient_name
            OR NEW.template_snapshot_json   IS DISTINCT FROM OLD.template_snapshot_json
            OR NEW.letterhead_snapshot_json IS DISTINCT FROM OLD.letterhead_snapshot_json
            OR NEW.signatory_snapshot_json  IS DISTINCT FROM OLD.signatory_snapshot_json
            OR NEW.signatory_id             IS DISTINCT FROM OLD.signatory_id
            OR NEW.issued_by                IS DISTINCT FROM OLD.issued_by
            OR NEW.issued_date              IS DISTINCT FROM OLD.issued_date
        THEN
            RAISE EXCEPTION
                'Official document % is % and cannot be modified; unlock it to Draft first, or cancel it and issue a new one.',
                OLD.document_number, OLD.status;
        END IF;

        IF NEW.status IS DISTINCT FROM OLD.status
           AND NOT (OLD.status IN ('Approved', 'Issued') AND NEW.status = 'Cancelled')
        THEN
            RAISE EXCEPTION
                'Official document % cannot move from % to %.',
                OLD.document_number, OLD.status, NEW.status;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

COMMIT;

-- ============================================================
-- Verify
-- ============================================================
-- Pick any issued letter and step it back, then forward again:
--
--   UPDATE public.official_documents SET status = 'Draft'
--    WHERE document_number = '<a number>' AND status = 'Issued';
--   -- expect: UPDATE 1, and `version` one higher than before
--
--   UPDATE public.official_documents SET title = 'x'
--    WHERE document_number = '<a number>' AND status = 'Issued';
--   -- expect: ERROR — still frozen while issued
--
--   UPDATE public.official_documents SET status = 'Draft'
--    WHERE status = 'Cancelled';
--   -- expect: ERROR — cancelled stays terminal
-- ============================================================
