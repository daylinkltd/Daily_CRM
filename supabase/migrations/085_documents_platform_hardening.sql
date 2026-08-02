-- ============================================================
-- 085 — Hardening for the official documents platform (084).
--
-- 084 shipped unreviewed and is already applied in production. This
-- migration fixes what the audit of it found:
--
--   1. document_types had FOR ALL USING (workspace_id IS NULL OR member),
--      so ANY authenticated user could create/edit/delete the GLOBAL
--      document types every tenant sees. Split into read vs write.
--   2. Every write policy allowed any active member, including 'viewer'
--      (migration 066 introduced is_active_workspace_writer for exactly
--      this). A read-only viewer could issue a salary letter on company
--      letterhead under the CEO's signature and seal.
--   3. "Immutable snapshots" had nothing enforcing immutability: any
--      member could PATCH body_html or the signatory snapshot of an
--      already-issued document straight from the browser.
--   4. document_number was generated client-side by a formatter with no
--      counter, so every document was <PREFIX>-<YEAR>-00001, with no
--      unique constraint behind it.
--   5. The letterhead designer edits six fields (logo placement/height,
--      company name size, header layout, tax ID, address) that no column
--      existed for — saved, silently dropped, gone on reload.
--   6. document_audit_logs had a SELECT policy but no INSERT policy, so
--      the audit trail could never be written at all.
--
-- Idempotent: safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Letterhead columns the designer UI already edits.
-- ------------------------------------------------------------
ALTER TABLE public.company_letterhead_configs
    ADD COLUMN IF NOT EXISTS logo_position       TEXT    DEFAULT 'left',
    ADD COLUMN IF NOT EXISTS logo_height         NUMERIC DEFAULT 56,
    ADD COLUMN IF NOT EXISTS company_name_size   NUMERIC DEFAULT 20,
    ADD COLUMN IF NOT EXISTS header_layout_style TEXT    DEFAULT 'standard',
    ADD COLUMN IF NOT EXISTS tax_id              TEXT,
    ADD COLUMN IF NOT EXISTS company_address     TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'company_letterhead_configs_logo_position_check'
  ) THEN
    ALTER TABLE public.company_letterhead_configs
      ADD CONSTRAINT company_letterhead_configs_logo_position_check
      CHECK (logo_position IN ('left', 'center', 'right'));
  END IF;
END $$;

-- ------------------------------------------------------------
-- 2. document_types: global rows readable by all, writable by none.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Active members can manage document types" ON public.document_types;
DROP POLICY IF EXISTS "Active members can view document types" ON public.document_types;
CREATE POLICY "Active members can view document types" ON public.document_types
    FOR SELECT USING (workspace_id IS NULL OR public.is_active_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Writers can manage own document types" ON public.document_types;
CREATE POLICY "Writers can manage own document types" ON public.document_types
    FOR ALL USING (workspace_id IS NOT NULL AND public.is_active_workspace_writer(workspace_id, auth.uid()))
    WITH CHECK (workspace_id IS NOT NULL AND public.is_active_workspace_writer(workspace_id, auth.uid()));

-- ------------------------------------------------------------
-- 3. Viewers must not write. Reads stay open to all active members.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Active members can insert custom document categories" ON public.document_categories;
DROP POLICY IF EXISTS "Writers can insert custom document categories" ON public.document_categories;
CREATE POLICY "Writers can insert custom document categories" ON public.document_categories
    FOR INSERT WITH CHECK (workspace_id IS NOT NULL AND public.is_active_workspace_writer(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Active members can update custom document categories" ON public.document_categories;
DROP POLICY IF EXISTS "Writers can update custom document categories" ON public.document_categories;
CREATE POLICY "Writers can update custom document categories" ON public.document_categories
    FOR UPDATE USING (workspace_id IS NOT NULL AND public.is_active_workspace_writer(workspace_id, auth.uid()))
    WITH CHECK (workspace_id IS NOT NULL AND public.is_active_workspace_writer(workspace_id, auth.uid()));

-- The letterhead every official document is issued on.
DROP POLICY IF EXISTS "Active members can manage letterhead config" ON public.company_letterhead_configs;
DROP POLICY IF EXISTS "Writers can manage letterhead config" ON public.company_letterhead_configs;
CREATE POLICY "Writers can manage letterhead config" ON public.company_letterhead_configs
    FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()))
    WITH CHECK (public.is_active_workspace_writer(workspace_id, auth.uid()));

-- Signature and seal images: a forgery primitive if a viewer can add one.
DROP POLICY IF EXISTS "Active members can manage signatories" ON public.company_signatories;
DROP POLICY IF EXISTS "Writers can manage signatories" ON public.company_signatories;
CREATE POLICY "Writers can manage signatories" ON public.company_signatories
    FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()))
    WITH CHECK (public.is_active_workspace_writer(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Active members can manage document templates" ON public.document_templates;
DROP POLICY IF EXISTS "Writers can manage document templates" ON public.document_templates;
CREATE POLICY "Writers can manage document templates" ON public.document_templates
    FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()))
    WITH CHECK (public.is_active_workspace_writer(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Active members can manage official documents" ON public.official_documents;
DROP POLICY IF EXISTS "Writers can manage official documents" ON public.official_documents;
CREATE POLICY "Writers can manage official documents" ON public.official_documents
    FOR ALL USING (public.is_active_workspace_writer(workspace_id, auth.uid()))
    WITH CHECK (public.is_active_workspace_writer(workspace_id, auth.uid()));

-- ------------------------------------------------------------
-- 4. Audit log: append-only. Deliberately no UPDATE/DELETE policy.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Active members can append audit logs" ON public.document_audit_logs;
CREATE POLICY "Active members can append audit logs" ON public.document_audit_logs
    FOR INSERT WITH CHECK (
        public.is_active_workspace_member(workspace_id, auth.uid())
        AND actor_id = auth.uid()
    );

-- ------------------------------------------------------------
-- 5. Atomic per-workspace document numbering.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.document_number_sequences (
    workspace_id UUID    NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    prefix       TEXT    NOT NULL,
    year         INTEGER NOT NULL,
    last_value   INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (workspace_id, prefix, year)
);

-- RLS on with no policies: the counter is reachable only through the
-- SECURITY DEFINER function below, which does its own membership check.
ALTER TABLE public.document_number_sequences ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.next_document_number(
    p_workspace_id UUID,
    p_prefix       TEXT DEFAULT 'DOC'
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_prefix TEXT;
    v_year   INTEGER;
    v_next   INTEGER;
BEGIN
    IF NOT public.is_active_workspace_writer(p_workspace_id, auth.uid()) THEN
        RAISE EXCEPTION 'Not authorised to issue documents for this workspace.';
    END IF;

    v_prefix := UPPER(REGEXP_REPLACE(COALESCE(NULLIF(p_prefix, ''), 'DOC'), '[^a-zA-Z0-9-]', '', 'g'));
    IF v_prefix = '' THEN
        v_prefix := 'DOC';
    END IF;
    v_year := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;

    INSERT INTO public.document_number_sequences AS s (workspace_id, prefix, year, last_value)
    VALUES (p_workspace_id, v_prefix, v_year, 1)
    ON CONFLICT (workspace_id, prefix, year)
    DO UPDATE SET last_value = s.last_value + 1
    RETURNING last_value INTO v_next;

    RETURN v_prefix || '-' || v_year::TEXT || '-' || LPAD(v_next::TEXT, 5, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_document_number(UUID, TEXT) TO authenticated;

-- Backstop for the numbering. Created only if existing data allows it:
-- 084 shipped duplicate-prone numbers, so on a workspace that already has
-- collisions this index would fail and abort the whole migration.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.official_documents
    WHERE deleted_at IS NULL
    GROUP BY workspace_id, document_number
    HAVING COUNT(*) > 1
  ) THEN
    RAISE WARNING 'Duplicate official_documents.document_number values exist; unique index not created. De-duplicate, then re-run this migration.';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_official_documents_number_per_workspace
        ON public.official_documents (workspace_id, document_number)
        WHERE deleted_at IS NULL;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 6. Make "immutable snapshots" actually immutable.
--    Once a document leaves Draft its content is frozen; the only
--    permitted transition is to Cancelled.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.freeze_issued_official_documents()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
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
                'Official document % is % and cannot be modified; cancel it and issue a new one.',
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

DROP TRIGGER IF EXISTS freeze_issued_official_documents ON public.official_documents;
CREATE TRIGGER freeze_issued_official_documents
    BEFORE UPDATE ON public.official_documents
    FOR EACH ROW EXECUTE FUNCTION public.freeze_issued_official_documents();

CREATE OR REPLACE FUNCTION public.block_issued_official_document_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.status IN ('Approved', 'Issued', 'Cancelled') THEN
        RAISE EXCEPTION
            'Official document % is % and cannot be deleted; archive it instead.',
            OLD.document_number, OLD.status;
    END IF;
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS block_issued_official_document_delete ON public.official_documents;
CREATE TRIGGER block_issued_official_document_delete
    BEFORE DELETE ON public.official_documents
    FOR EACH ROW EXECUTE FUNCTION public.block_issued_official_document_delete();
