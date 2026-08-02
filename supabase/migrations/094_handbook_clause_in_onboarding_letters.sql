-- ============================================================
-- 094 — Reference the employee handbook in the onboarding letters.
--
-- The handbook is generated, versioned and digitally acknowledged, but
-- nothing in the paperwork a new hire actually signs pointed at it. So an
-- offer letter said nothing about the policies the person is agreeing to
-- work under.
--
-- Decision: a CLAUSE in the offer and appointment letters, not a second
-- attached document. That is how employment paperwork normally works —
-- one signature covers one document, and the handbook stays separately
-- acknowledged with its own SHA-256 content hash (migration 050), which
-- is stronger evidence than a mention in a letter. Attaching it would
-- also duplicate content that is already versioned elsewhere and could
-- then drift.
--
-- Only the two LIBRARY templates are updated (workspace_id IS NULL). A
-- workspace that has adopted and edited its own copy is deliberately left
-- alone — overwriting someone's edited letter would be worse than the
-- omission.
--
-- Idempotent: the clause is only appended when it is not already there.
-- ============================================================

UPDATE public.templates
SET body = body || '
<p>Your employment is subject to the policies set out in the {{company_name}} Employee Handbook, which forms part of these terms. You will be asked to read and acknowledge it on or before your start date.</p>',
    variables = (
        SELECT ARRAY(SELECT DISTINCT unnest(variables || ARRAY['company_name']::TEXT[]))
    ),
    updated_at = NOW()
WHERE workspace_id IS NULL
  AND module = 'hr'
  AND channel = 'document'
  AND name IN ('Offer letter', 'Appointment letter')
  AND body NOT LIKE '%Employee Handbook%';

-- Confirmation of employment is the third document a new joiner signs, so
-- it gets the same reference to the handbook version in force.
UPDATE public.templates
SET body = body || '
<p>The {{company_name}} Employee Handbook continues to apply to your employment. Any subsequent revision will be published to you for acknowledgement.</p>',
    variables = (
        SELECT ARRAY(SELECT DISTINCT unnest(variables || ARRAY['company_name']::TEXT[]))
    ),
    updated_at = NOW()
WHERE workspace_id IS NULL
  AND module = 'hr'
  AND channel = 'document'
  AND name = 'Confirmation of employment'
  AND body NOT LIKE '%Employee Handbook%';
