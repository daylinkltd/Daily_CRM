-- ============================================================
-- 088 — Unified template library across every module.
--
-- Templates existed only for WhatsApp (`message_templates`, which is
-- Meta-specific: it carries meta_template_id, quality_score, submission
-- and rejection state). There was nothing for email, SMS, HR letters,
-- retail or project comms, and no concept of a ready-made library.
--
-- This adds `templates`: one table, keyed by (module, channel), holding
-- both the built-in library and each workspace's own templates.
--
--   workspace_id IS NULL  -> built-in library row. Readable by every
--                            tenant, writable by none of them. A
--                            workspace "uses" one by copying it.
--   workspace_id = <ws>   -> that workspace's own template.
--
-- `message_templates` is deliberately left alone. It is the Meta
-- submission record and the WhatsApp send path depends on it; this
-- table is the authoring layer. A WhatsApp template authored here is
-- pushed to Meta through the existing submit route, and
-- `meta_template_id` links the two.
--
-- Idempotent; safe to re-run.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.templates (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,

    -- Which part of the product this belongs to; drives the module tabs.
    module  TEXT NOT NULL CHECK (module IN
            ('crm', 'accounting', 'hr', 'retail', 'projects', 'general')),
    -- How it is delivered. 'document' is a printable letter, 'internal'
    -- is an in-app notification.
    channel TEXT NOT NULL CHECK (channel IN
            ('whatsapp', 'email', 'sms', 'document', 'internal')),

    category    TEXT,
    name        TEXT NOT NULL,
    description TEXT,

    -- Email subject line. NULL for every other channel.
    subject   TEXT,
    body      TEXT NOT NULL,
    -- The {{tokens}} the body uses, so the editor can offer them and
    -- warn before sending with one unfilled.
    variables TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    tags      TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],

    -- Aggregator (Meta) state, only meaningful for channel = 'whatsapp'.
    requires_approval  BOOLEAN NOT NULL DEFAULT false,
    approval_status    TEXT CHECK (approval_status IS NULL OR approval_status IN
                       ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'PAUSED')),
    -- Links to the Meta submission record when one exists.
    message_template_id UUID REFERENCES public.message_templates(id) ON DELETE SET NULL,
    language           TEXT NOT NULL DEFAULT 'en',

    -- Where a workspace template was copied from, so the library can
    -- show "already added" and updates can be traced.
    source_template_id UUID REFERENCES public.templates(id) ON DELETE SET NULL,

    is_system   BOOLEAN NOT NULL DEFAULT false,
    is_favorite BOOLEAN NOT NULL DEFAULT false,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    usage_count INTEGER NOT NULL DEFAULT 0,

    created_by UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    -- A library row must be a system row and vice versa; this stops a
    -- tenant row accidentally becoming globally visible.
    CHECK ((workspace_id IS NULL) = is_system)
);

CREATE INDEX IF NOT EXISTS idx_templates_workspace
    ON public.templates (workspace_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_templates_module_channel
    ON public.templates (module, channel) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_templates_library
    ON public.templates (module, channel) WHERE workspace_id IS NULL AND deleted_at IS NULL;

-- One name per module+channel within a workspace. Library rows are
-- excluded: they are seeded and already unique by construction.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_templates_workspace_name
    ON public.templates (workspace_id, module, channel, lower(name))
    WHERE workspace_id IS NOT NULL AND deleted_at IS NULL;

ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

-- Everyone sees the library plus their own workspace's templates.
DROP POLICY IF EXISTS templates_select ON public.templates;
CREATE POLICY templates_select ON public.templates
    FOR SELECT USING (
        workspace_id IS NULL
        OR public.is_active_workspace_member(workspace_id, auth.uid())
    );

-- Writers manage their own workspace's templates. The library is not
-- writable from the client at all — no policy grants it, and the CHECK
-- above prevents inserting a row with a NULL workspace_id anyway.
DROP POLICY IF EXISTS templates_manage ON public.templates;
CREATE POLICY templates_manage ON public.templates
    FOR ALL USING (
        workspace_id IS NOT NULL
        AND public.is_active_workspace_writer(workspace_id, auth.uid())
    )
    WITH CHECK (
        workspace_id IS NOT NULL
        AND public.is_active_workspace_writer(workspace_id, auth.uid())
    );

DROP TRIGGER IF EXISTS set_updated_at ON public.templates;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.templates
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------
-- Copy a library template into the calling user's workspace.
-- SECURITY DEFINER because the caller cannot read-then-insert a library
-- row under RLS in one step; the write permission is still checked.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.adopt_library_template(
    p_workspace_id UUID,
    p_template_id  UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_src public.templates%ROWTYPE;
    v_new_id UUID;
    v_name TEXT;
    v_suffix INTEGER := 1;
BEGIN
    IF NOT public.is_active_workspace_writer(p_workspace_id, auth.uid()) THEN
        RAISE EXCEPTION 'Not authorised to add templates to this workspace.';
    END IF;

    SELECT * INTO v_src FROM public.templates
    WHERE id = p_template_id AND workspace_id IS NULL AND deleted_at IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Library template not found.';
    END IF;

    -- Adding the same library template twice is a normal thing to do
    -- (people tweak a second variant), so de-duplicate the name rather
    -- than failing on the unique index.
    v_name := v_src.name;
    WHILE EXISTS (
        SELECT 1 FROM public.templates
        WHERE workspace_id = p_workspace_id
          AND module = v_src.module AND channel = v_src.channel
          AND lower(name) = lower(v_name) AND deleted_at IS NULL
    ) LOOP
        v_suffix := v_suffix + 1;
        v_name := v_src.name || ' (' || v_suffix || ')';
    END LOOP;

    INSERT INTO public.templates (
        workspace_id, module, channel, category, name, description,
        subject, body, variables, tags, requires_approval, approval_status,
        language, source_template_id, is_system, created_by
    )
    SELECT
        p_workspace_id, v_src.module, v_src.channel, v_src.category, v_name,
        v_src.description, v_src.subject, v_src.body, v_src.variables, v_src.tags,
        (v_src.channel = 'whatsapp'),
        CASE WHEN v_src.channel = 'whatsapp' THEN 'DRAFT' ELSE NULL END,
        v_src.language, v_src.id, false,
        (SELECT id FROM public.workspace_members
         WHERE workspace_id = p_workspace_id AND user_id = auth.uid() LIMIT 1)
    RETURNING id INTO v_new_id;

    RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.adopt_library_template(UUID, UUID) TO authenticated;
-- 106 built-in templates. Generated by scripts/generate-template-library.mjs — do not edit by hand.
INSERT INTO public.templates
  (id, workspace_id, module, channel, category, name, description, subject, body, variables, tags, is_system)
VALUES
  ('d881f7d3-e559-50d2-a0e6-d43c52a86ef0'::uuid, NULL, 'crm', 'whatsapp', 'Sales', 'New enquiry acknowledgement', 'Confirms an inbound enquiry within seconds so the lead does not go cold.', NULL, 'Hi {{contact_name}}, thanks for getting in touch with {{company_name}}. We have received your enquiry about {{subject}} and a member of our team will respond within {{response_time}}.', ARRAY['contact_name', 'company_name', 'subject', 'response_time']::TEXT[], ARRAY['sales']::TEXT[], true),
  ('42d41859-ac1b-51a5-b832-cd9b10bf0b3d'::uuid, NULL, 'crm', 'whatsapp', 'Sales', 'First follow-up', 'Gentle nudge two days after an unanswered enquiry.', NULL, 'Hi {{contact_name}}, just following up on your enquiry about {{subject}}. Would you like to arrange a quick call this week?', ARRAY['contact_name', 'subject']::TEXT[], ARRAY['sales']::TEXT[], true),
  ('707031ab-85f4-5952-894f-2ccf9e7b6b77'::uuid, NULL, 'crm', 'whatsapp', 'Sales', 'Second follow-up', 'Final nudge before marking a lead dormant.', NULL, 'Hi {{contact_name}}, I have tried to reach you a couple of times about {{subject}}. If now is not the right time, just reply STOP and I will close this off.', ARRAY['contact_name', 'subject']::TEXT[], ARRAY['sales']::TEXT[], true),
  ('07387b02-7f75-590c-8d53-6a75eb12e8c8'::uuid, NULL, 'crm', 'whatsapp', 'Sales', 'Quotation sent', 'Tells the customer a quote is waiting and where to find it.', NULL, 'Hi {{contact_name}}, your quotation {{quote_number}} for {{amount}} is ready. It is valid until {{valid_until}}. Let me know if you would like anything adjusted.', ARRAY['contact_name', 'quote_number', 'amount', 'valid_until']::TEXT[], ARRAY['sales']::TEXT[], true),
  ('7acac721-acc2-5cfa-b62d-5f2872409a41'::uuid, NULL, 'crm', 'whatsapp', 'Sales', 'Quotation reminder', 'Chases a quote that is close to expiring.', NULL, 'Hi {{contact_name}}, a quick reminder that quotation {{quote_number}} expires on {{valid_until}}. Shall I extend it?', ARRAY['contact_name', 'quote_number', 'valid_until']::TEXT[], ARRAY['sales']::TEXT[], true),
  ('5f7d88b6-3357-5e55-aad2-ec92bdb0cb28'::uuid, NULL, 'crm', 'whatsapp', 'Sales', 'Meeting confirmation', 'Confirms a booked meeting with the joining details.', NULL, 'Hi {{contact_name}}, confirming our meeting on {{meeting_date}} at {{meeting_time}}. {{location_or_link}}. Looking forward to it.', ARRAY['contact_name', 'meeting_date', 'meeting_time', 'location_or_link']::TEXT[], ARRAY['sales']::TEXT[], true),
  ('17bb8c77-8a05-5f3b-8126-31531b4fb2ce'::uuid, NULL, 'crm', 'whatsapp', 'Sales', 'Meeting reminder', 'Day-before reminder to cut no-shows.', NULL, 'Hi {{contact_name}}, reminder about our meeting tomorrow at {{meeting_time}}. Reply RESCHEDULE if you need a different time.', ARRAY['contact_name', 'meeting_time']::TEXT[], ARRAY['sales']::TEXT[], true),
  ('15f3c20f-5f94-5187-9daa-a9d28db53b3a'::uuid, NULL, 'crm', 'whatsapp', 'Sales', 'Deal won — thank you', 'Marks a closed-won deal and sets up the handover.', NULL, 'Hi {{contact_name}}, delighted to have you on board with {{company_name}}. {{account_manager}} will be in touch to get everything set up.', ARRAY['contact_name', 'company_name', 'account_manager']::TEXT[], ARRAY['sales']::TEXT[], true),
  ('5a2d012c-8feb-52c5-8ba8-6bc04cdf3bff'::uuid, NULL, 'crm', 'whatsapp', 'Sales', 'Deal lost — keep in touch', 'Leaves the door open on a lost deal.', NULL, 'Hi {{contact_name}}, thanks for considering {{company_name}}. If your requirements change, we would be glad to help.', ARRAY['contact_name', 'company_name']::TEXT[], ARRAY['sales']::TEXT[], true),
  ('684ff844-e187-5143-88a8-e9294a6036e6'::uuid, NULL, 'crm', 'whatsapp', 'Sales', 'Feedback request', 'Asks for a rating shortly after delivery.', NULL, 'Hi {{contact_name}}, how did we do with {{subject}}? A quick rating from 1 to 5 would help us a lot.', ARRAY['contact_name', 'subject']::TEXT[], ARRAY['sales']::TEXT[], true),
  ('2b7e9516-dde7-5f46-8496-6e07f41d56be'::uuid, NULL, 'crm', 'whatsapp', 'Sales', 'Referral request', 'Asks a happy customer for an introduction.', NULL, 'Hi {{contact_name}}, glad {{subject}} went well. Do you know anyone else who might benefit from what we do?', ARRAY['contact_name', 'subject']::TEXT[], ARRAY['sales']::TEXT[], true),
  ('0b06c0d6-35b2-54af-832c-184815ecb757'::uuid, NULL, 'crm', 'whatsapp', 'Sales', 'Reactivation', 'Wakes up a contact who has gone quiet for months.', NULL, 'Hi {{contact_name}}, it has been a while since we worked together on {{subject}}. We have added a few things since — worth a catch-up?', ARRAY['contact_name', 'subject']::TEXT[], ARRAY['sales']::TEXT[], true),
  ('68934e71-d25e-58c8-8903-2b327fec5bb0'::uuid, NULL, 'crm', 'whatsapp', 'Sales', 'Catalogue share', 'Sends the product catalogue on request.', NULL, 'Hi {{contact_name}}, here is our latest catalogue: {{catalogue_link}}. Tell me what catches your eye and I will send pricing.', ARRAY['contact_name', 'catalogue_link']::TEXT[], ARRAY['sales']::TEXT[], true),
  ('5f0b4a2d-736f-57af-a882-8887b6e7a686'::uuid, NULL, 'crm', 'whatsapp', 'Sales', 'Site visit scheduled', 'Confirms an on-site visit.', NULL, 'Hi {{contact_name}}, our team will visit {{site_address}} on {{visit_date}} at {{visit_time}}. Please let us know if anyone needs to be present.', ARRAY['contact_name', 'site_address', 'visit_date', 'visit_time']::TEXT[], ARRAY['sales']::TEXT[], true),
  ('ccf28878-15b0-5817-afaf-f747266e5739'::uuid, NULL, 'crm', 'whatsapp', 'Sales', 'Out of office', 'Auto-reply outside business hours.', NULL, 'Thanks for messaging {{company_name}}. Our team is available {{business_hours}}. We will reply as soon as we are back.', ARRAY['company_name', 'business_hours']::TEXT[], ARRAY['sales']::TEXT[], true),
  ('4d6fc7a5-f1f3-5d9b-88de-5313c1181280'::uuid, NULL, 'crm', 'email', 'Sales', 'Enquiry acknowledgement', 'Formal email confirming an enquiry.', 'We have received your enquiry', 'Dear {{contact_name}},

Thank you for contacting {{company_name}}. We have received your enquiry regarding {{subject}} and will respond within {{response_time}}.

Kind regards,
{{sender_name}}
{{company_name}}', ARRAY['contact_name', 'company_name', 'subject', 'response_time', 'sender_name']::TEXT[], ARRAY['sales']::TEXT[], true),
  ('9967bdc5-eef1-58f5-95c8-ed9f0796ef4c'::uuid, NULL, 'crm', 'email', 'Sales', 'Quotation covering email', 'Sends a quotation with the terms summarised.', 'Your quotation {{quote_number}} from {{company_name}}', 'Dear {{contact_name}},

Please find attached quotation {{quote_number}} for {{amount}}, valid until {{valid_until}}.

The quote covers {{scope_summary}}. Payment terms are {{payment_terms}}.

Do let me know if you would like to discuss any part of it.

Kind regards,
{{sender_name}}', ARRAY['contact_name', 'quote_number', 'amount', 'valid_until', 'scope_summary', 'payment_terms', 'sender_name']::TEXT[], ARRAY['sales']::TEXT[], true),
  ('10570411-de81-51cd-b816-914263f59bd6'::uuid, NULL, 'crm', 'email', 'Sales', 'Proposal follow-up', 'Follows up on a proposal after a week.', 'Following up on our proposal', 'Dear {{contact_name}},

I wanted to check whether you have had a chance to review the proposal we sent on {{sent_date}}.

Happy to walk through it or adjust the scope.

Kind regards,
{{sender_name}}', ARRAY['contact_name', 'sent_date', 'sender_name']::TEXT[], ARRAY['sales']::TEXT[], true),
  ('bfb5ca98-896e-5e87-bf8f-467eab177540'::uuid, NULL, 'crm', 'email', 'Sales', 'Welcome / onboarding', 'Introduces a new customer to their contacts and next steps.', 'Welcome to {{company_name}}', 'Dear {{contact_name}},

Welcome to {{company_name}}. Your account manager is {{account_manager}}, reachable at {{account_manager_email}}.

Next steps:
1. {{step_one}}
2. {{step_two}}
3. {{step_three}}

Kind regards,
{{sender_name}}', ARRAY['contact_name', 'company_name', 'account_manager', 'account_manager_email', 'step_one', 'step_two', 'step_three', 'sender_name']::TEXT[], ARRAY['sales']::TEXT[], true),
  ('c16900c8-fd49-5092-b8bd-9d2d428a533e'::uuid, NULL, 'crm', 'email', 'Sales', 'Meeting request', 'Proposes times for a meeting.', 'Meeting request — {{subject}}', 'Dear {{contact_name}},

Would any of the following suit you for a {{duration}} conversation about {{subject}}?

- {{option_one}}
- {{option_two}}
- {{option_three}}

Kind regards,
{{sender_name}}', ARRAY['contact_name', 'duration', 'subject', 'option_one', 'option_two', 'option_three', 'sender_name']::TEXT[], ARRAY['sales']::TEXT[], true),
  ('dab6ebfe-fac3-5a49-b18c-3913a331cd9e'::uuid, NULL, 'crm', 'email', 'Sales', 'Meeting notes', 'Summarises what was agreed after a meeting.', 'Notes from our meeting on {{meeting_date}}', 'Dear {{contact_name}},

Thank you for your time on {{meeting_date}}. To summarise:

Discussed: {{discussion_summary}}
Agreed: {{agreed_actions}}
Next step: {{next_step}} by {{next_step_date}}

Kind regards,
{{sender_name}}', ARRAY['contact_name', 'meeting_date', 'discussion_summary', 'agreed_actions', 'next_step', 'next_step_date', 'sender_name']::TEXT[], ARRAY['sales']::TEXT[], true),
  ('e73a5320-2799-537e-ac53-c476246762c5'::uuid, NULL, 'crm', 'email', 'Sales', 'Contract for signature', 'Sends a contract and explains how to sign.', 'Contract for signature — {{contract_reference}}', 'Dear {{contact_name}},

Please find attached contract {{contract_reference}} for your signature.

Once signed, {{next_step}}. The contract is open for signature until {{expiry_date}}.

Kind regards,
{{sender_name}}', ARRAY['contact_name', 'contract_reference', 'next_step', 'expiry_date', 'sender_name']::TEXT[], ARRAY['sales']::TEXT[], true),
  ('84d33e6e-7102-5a04-9402-022da2dda4dc'::uuid, NULL, 'crm', 'email', 'Sales', 'Reactivation', 'Re-engages a dormant account.', 'It has been a while, {{contact_name}}', 'Dear {{contact_name}},

We last worked together on {{last_engagement}}. Since then we have added {{whats_new}}.

Would a short call be useful?

Kind regards,
{{sender_name}}', ARRAY['contact_name', 'last_engagement', 'whats_new', 'sender_name']::TEXT[], ARRAY['sales']::TEXT[], true),
  ('3adc52c7-119a-5b2b-b39d-cd688337a77c'::uuid, NULL, 'crm', 'email', 'Sales', 'Thank you after purchase', 'Thanks a customer and sets support expectations.', 'Thank you from {{company_name}}', 'Dear {{contact_name}},

Thank you for choosing {{company_name}}. For anything at all, contact {{support_email}} or {{support_phone}}.

Kind regards,
{{sender_name}}', ARRAY['contact_name', 'company_name', 'support_email', 'support_phone', 'sender_name']::TEXT[], ARRAY['sales']::TEXT[], true),
  ('a304d9ad-d963-5506-b7cc-b7c038e25394'::uuid, NULL, 'crm', 'email', 'Sales', 'Apology / service recovery', 'Acknowledges a failure and states the remedy.', 'Our apologies — {{issue_summary}}', 'Dear {{contact_name}},

I am sorry about {{issue_summary}}. This is not the standard we hold ourselves to.

What happened: {{root_cause}}
What we are doing: {{remedy}}
By when: {{remedy_date}}

Kind regards,
{{sender_name}}', ARRAY['contact_name', 'issue_summary', 'root_cause', 'remedy', 'remedy_date', 'sender_name']::TEXT[], ARRAY['sales']::TEXT[], true),
  ('7f312050-e11d-5a62-92b3-6de6e2fb6ffd'::uuid, NULL, 'accounting', 'whatsapp', 'Receivables', 'Invoice issued', 'Notifies the customer a new invoice is available.', NULL, 'Hi {{contact_name}}, invoice {{invoice_number}} for {{amount}} is now due on {{due_date}}. {{payment_link}}', ARRAY['contact_name', 'invoice_number', 'amount', 'due_date', 'payment_link']::TEXT[], ARRAY['finance']::TEXT[], true),
  ('19c4f69c-df9e-5e2f-9035-34365af7cab2'::uuid, NULL, 'accounting', 'whatsapp', 'Receivables', 'Payment reminder — before due', 'Courtesy reminder a few days before the due date.', NULL, 'Hi {{contact_name}}, a reminder that invoice {{invoice_number}} for {{amount}} falls due on {{due_date}}.', ARRAY['contact_name', 'invoice_number', 'amount', 'due_date']::TEXT[], ARRAY['finance']::TEXT[], true),
  ('b7541a23-1392-55ec-9fbf-edcf8cdf0ff3'::uuid, NULL, 'accounting', 'whatsapp', 'Receivables', 'Payment reminder — overdue', 'First chase after the due date passes.', NULL, 'Hi {{contact_name}}, invoice {{invoice_number}} for {{amount}} was due on {{due_date}} and is now {{days_overdue}} days overdue. Could you let me know when we can expect payment?', ARRAY['contact_name', 'invoice_number', 'amount', 'due_date', 'days_overdue']::TEXT[], ARRAY['finance']::TEXT[], true),
  ('81e58733-df77-5e1b-886b-8291cf012d72'::uuid, NULL, 'accounting', 'whatsapp', 'Receivables', 'Payment reminder — final notice', 'Last reminder before escalation.', NULL, 'Hi {{contact_name}}, invoice {{invoice_number}} for {{amount}} remains unpaid {{days_overdue}} days after the due date. Please arrange payment by {{final_date}} to avoid {{consequence}}.', ARRAY['contact_name', 'invoice_number', 'amount', 'days_overdue', 'final_date', 'consequence']::TEXT[], ARRAY['finance']::TEXT[], true),
  ('e43a6a58-ac47-5329-8c97-87474d085807'::uuid, NULL, 'accounting', 'whatsapp', 'Receivables', 'Payment received', 'Confirms receipt so the customer stops worrying.', NULL, 'Hi {{contact_name}}, we have received your payment of {{amount}} against invoice {{invoice_number}}. Thank you.', ARRAY['contact_name', 'amount', 'invoice_number']::TEXT[], ARRAY['finance']::TEXT[], true),
  ('5ae01665-0402-569a-99fd-6c2136a78878'::uuid, NULL, 'accounting', 'whatsapp', 'Receivables', 'Partial payment received', 'Acknowledges part payment and states the balance.', NULL, 'Hi {{contact_name}}, thank you for {{amount_paid}} against invoice {{invoice_number}}. The remaining balance is {{balance}}, due {{due_date}}.', ARRAY['contact_name', 'amount_paid', 'invoice_number', 'balance', 'due_date']::TEXT[], ARRAY['finance']::TEXT[], true),
  ('efe6aaf4-bba4-5ff9-9f12-43a1da41c013'::uuid, NULL, 'accounting', 'whatsapp', 'Receivables', 'Statement of account', 'Sends a periodic account statement.', NULL, 'Hi {{contact_name}}, your account statement to {{statement_date}} shows a balance of {{balance}}. {{statement_link}}', ARRAY['contact_name', 'statement_date', 'balance', 'statement_link']::TEXT[], ARRAY['finance']::TEXT[], true),
  ('be2cf146-4800-5814-85fc-e28ae7a0d546'::uuid, NULL, 'accounting', 'whatsapp', 'Receivables', 'Refund processed', 'Confirms a refund and when it will land.', NULL, 'Hi {{contact_name}}, a refund of {{amount}} has been processed against {{reference}}. It should reach you within {{settlement_days}} working days.', ARRAY['contact_name', 'amount', 'reference', 'settlement_days']::TEXT[], ARRAY['finance']::TEXT[], true),
  ('ddfeeb76-8144-5ceb-9304-b0190072286e'::uuid, NULL, 'accounting', 'email', 'Receivables', 'Invoice covering email', 'Sends an invoice with the payment details.', 'Invoice {{invoice_number}} from {{company_name}}', 'Dear {{contact_name}},

Please find attached invoice {{invoice_number}} for {{amount}}, due on {{due_date}}.

Payment details:
{{payment_details}}

Kind regards,
{{sender_name}}
{{company_name}}', ARRAY['contact_name', 'invoice_number', 'amount', 'due_date', 'payment_details', 'sender_name', 'company_name']::TEXT[], ARRAY['finance']::TEXT[], true),
  ('fb113750-2921-56b0-8a7c-e7fa55810560'::uuid, NULL, 'accounting', 'email', 'Receivables', 'Overdue escalation', 'Formal escalation on a badly overdue invoice.', 'Overdue invoice {{invoice_number}} — {{days_overdue}} days', 'Dear {{contact_name}},

Invoice {{invoice_number}} for {{amount}} was due on {{due_date}} and remains unpaid after {{days_overdue}} days.

Please arrange payment by {{final_date}}. If there is a dispute, tell us by that date so we can resolve it.

Kind regards,
{{sender_name}}', ARRAY['contact_name', 'invoice_number', 'amount', 'due_date', 'days_overdue', 'final_date', 'sender_name']::TEXT[], ARRAY['finance']::TEXT[], true),
  ('d8d73cd7-c3a5-5d92-af30-0250adbb9bed'::uuid, NULL, 'accounting', 'email', 'Receivables', 'Receipt', 'Formal receipt after payment.', 'Receipt for your payment — {{reference}}', 'Dear {{contact_name}},

We confirm receipt of {{amount}} on {{payment_date}} against {{reference}}.

Kind regards,
{{sender_name}}', ARRAY['contact_name', 'amount', 'payment_date', 'reference', 'sender_name']::TEXT[], ARRAY['finance']::TEXT[], true),
  ('1420ee8a-7a91-5ae6-8166-a836837ead4e'::uuid, NULL, 'accounting', 'email', 'Receivables', 'Monthly statement', 'Sends the monthly statement of account.', 'Statement of account — {{period}}', 'Dear {{contact_name}},

Please find your statement for {{period}}.

Opening balance: {{opening_balance}}
Invoiced: {{invoiced}}
Received: {{received}}
Closing balance: {{closing_balance}}

Kind regards,
{{sender_name}}', ARRAY['contact_name', 'period', 'opening_balance', 'invoiced', 'received', 'closing_balance', 'sender_name']::TEXT[], ARRAY['finance']::TEXT[], true),
  ('6db0f269-8bd1-5b5e-a90a-73f7e028d108'::uuid, NULL, 'accounting', 'email', 'Receivables', 'Payment plan proposal', 'Offers instalments on a large overdue balance.', 'Payment arrangement for {{reference}}', 'Dear {{contact_name}},

Regarding the outstanding {{balance}} on {{reference}}, we can offer {{instalments}} instalments of {{instalment_amount}}, beginning {{start_date}}.

Reply to confirm and we will document it.

Kind regards,
{{sender_name}}', ARRAY['contact_name', 'balance', 'reference', 'instalments', 'instalment_amount', 'start_date', 'sender_name']::TEXT[], ARRAY['finance']::TEXT[], true),
  ('20bb3b30-a0e5-5b07-b8fa-d9ec879b1f02'::uuid, NULL, 'hr', 'document', 'Employment Letters', 'Offer letter', 'Formal offer with compensation and start date.', NULL, '<h2>Letter of Offer</h2>
<p>Date: {{today}}</p>
<p>Dear {{employee_name}},</p>
<p>We are pleased to offer you the position of <strong>{{designation}}</strong> at {{company_name}}, reporting to {{reporting_manager}}.</p>
<p>Your start date will be {{joining_date}} and your annual compensation will be {{salary}}. Your place of work will be {{work_location}}.</p>
<p>This offer is subject to {{conditions}}. Please confirm acceptance by {{acceptance_deadline}}.</p>
<p>Yours sincerely,<br/>{{signatory_name}}<br/>{{signatory_designation}}</p>', ARRAY['today', 'employee_name', 'designation', 'company_name', 'reporting_manager', 'joining_date', 'salary', 'work_location', 'conditions', 'acceptance_deadline', 'signatory_name', 'signatory_designation']::TEXT[], ARRAY['hr', 'letter']::TEXT[], true),
  ('d8ae45ad-9abb-5db0-99cc-d56bcee0738d'::uuid, NULL, 'hr', 'document', 'Employment Letters', 'Appointment letter', 'Confirms appointment after the offer is accepted.', NULL, '<h2>Letter of Appointment</h2>
<p>Date: {{today}}</p>
<p>Dear {{employee_name}},</p>
<p>Further to your acceptance, we confirm your appointment as <strong>{{designation}}</strong> with effect from {{joining_date}}.</p>
<p>Your employee code is {{employee_code}}. Your probation period is {{probation_period}}, after which your appointment will be confirmed subject to satisfactory performance.</p>
<p>Yours sincerely,<br/>{{signatory_name}}</p>', ARRAY['today', 'employee_name', 'designation', 'joining_date', 'employee_code', 'probation_period', 'signatory_name']::TEXT[], ARRAY['hr', 'letter']::TEXT[], true),
  ('420ecf8f-0b2d-562c-a1d2-0cd3091a9caf'::uuid, NULL, 'hr', 'document', 'Employment Letters', 'Confirmation of employment', 'Confirms an employee after probation.', NULL, '<h2>Confirmation of Employment</h2>
<p>Date: {{today}}</p>
<p>Dear {{employee_name}},</p>
<p>We are pleased to confirm your employment as {{designation}} with effect from {{confirmation_date}}, following the successful completion of your probation.</p>
<p>Yours sincerely,<br/>{{signatory_name}}</p>', ARRAY['today', 'employee_name', 'designation', 'confirmation_date', 'signatory_name']::TEXT[], ARRAY['hr', 'letter']::TEXT[], true),
  ('19ee62d1-6eea-5704-b8a9-5b9ab97a1853'::uuid, NULL, 'hr', 'document', 'Employment Letters', 'Experience certificate', 'States dates and role for a departing employee.', NULL, '<h2>Experience Certificate</h2>
<p>Date: {{today}}</p>
<p>This is to certify that <strong>{{employee_name}}</strong> was employed with {{company_name}} as {{designation}} from {{joining_date}} to {{relieving_date}}.</p>
<p>During this period their conduct and performance were {{conduct_remark}}.</p>
<p>We wish them every success.</p>
<p>{{signatory_name}}<br/>{{signatory_designation}}</p>', ARRAY['today', 'employee_name', 'company_name', 'designation', 'joining_date', 'relieving_date', 'conduct_remark', 'signatory_name', 'signatory_designation']::TEXT[], ARRAY['hr', 'letter']::TEXT[], true),
  ('35ae165d-5d8b-536c-aebc-f47a3a4a370a'::uuid, NULL, 'hr', 'document', 'Employment Letters', 'Relieving letter', 'Formally releases an employee on their last day.', NULL, '<h2>Relieving Letter</h2>
<p>Date: {{today}}</p>
<p>Dear {{employee_name}},</p>
<p>This is to confirm that you have been relieved from your duties as {{designation}} at {{company_name}} at the close of business on {{relieving_date}}.</p>
<p>All dues have been settled. We thank you for your contribution.</p>
<p>{{signatory_name}}</p>', ARRAY['today', 'employee_name', 'designation', 'company_name', 'relieving_date', 'signatory_name']::TEXT[], ARRAY['hr', 'letter']::TEXT[], true),
  ('24d127e9-ba5f-5d89-b9ce-51a899aa47f2'::uuid, NULL, 'hr', 'document', 'Employment Letters', 'Salary certificate', 'Confirms salary for a bank or landlord.', NULL, '<h2>Salary Certificate</h2>
<p>Date: {{today}}</p>
<p>This is to certify that <strong>{{employee_name}}</strong> ({{employee_code}}) is employed with {{company_name}} as {{designation}} since {{joining_date}}.</p>
<p>Their current annual compensation is {{salary}}.</p>
<p>This certificate is issued at the employee''s request for {{purpose}}.</p>
<p>{{signatory_name}}</p>', ARRAY['today', 'employee_name', 'employee_code', 'company_name', 'designation', 'joining_date', 'salary', 'purpose', 'signatory_name']::TEXT[], ARRAY['hr', 'letter']::TEXT[], true),
  ('934de88c-9478-551c-bc93-e9d63e9e794c'::uuid, NULL, 'hr', 'document', 'Employment Letters', 'Promotion letter', 'Confirms a promotion and new terms.', NULL, '<h2>Letter of Promotion</h2>
<p>Date: {{today}}</p>
<p>Dear {{employee_name}},</p>
<p>In recognition of your contribution, we are pleased to promote you to <strong>{{new_designation}}</strong> with effect from {{effective_date}}.</p>
<p>Your revised compensation will be {{new_salary}} and you will report to {{reporting_manager}}.</p>
<p>Congratulations.</p>
<p>{{signatory_name}}</p>', ARRAY['today', 'employee_name', 'new_designation', 'effective_date', 'new_salary', 'reporting_manager', 'signatory_name']::TEXT[], ARRAY['hr', 'letter']::TEXT[], true),
  ('dc2c9084-02d0-5e32-a214-fa2dd06d77cc'::uuid, NULL, 'hr', 'document', 'Employment Letters', 'Increment letter', 'Communicates a salary revision.', NULL, '<h2>Salary Revision</h2>
<p>Date: {{today}}</p>
<p>Dear {{employee_name}},</p>
<p>Following the {{review_period}} review, your compensation has been revised from {{old_salary}} to {{new_salary}} with effect from {{effective_date}}.</p>
<p>{{signatory_name}}</p>', ARRAY['today', 'employee_name', 'review_period', 'old_salary', 'new_salary', 'effective_date', 'signatory_name']::TEXT[], ARRAY['hr', 'letter']::TEXT[], true),
  ('7345d56b-2d7e-53f0-9304-b9098c0b3659'::uuid, NULL, 'hr', 'document', 'Employment Letters', 'Warning letter', 'Formal written warning for a conduct issue.', NULL, '<h2>Written Warning</h2>
<p>Date: {{today}}</p>
<p>Dear {{employee_name}},</p>
<p>This letter is a formal warning regarding {{issue_summary}}, observed on {{incident_date}}.</p>
<p>Expected standard: {{expected_conduct}}</p>
<p>Required improvement: {{required_action}} by {{improvement_deadline}}.</p>
<p>Failure to improve may lead to further disciplinary action.</p>
<p>{{signatory_name}}</p>', ARRAY['today', 'employee_name', 'issue_summary', 'incident_date', 'expected_conduct', 'required_action', 'improvement_deadline', 'signatory_name']::TEXT[], ARRAY['hr', 'letter']::TEXT[], true),
  ('38bdae00-a042-53a8-a26a-a0a0c2199a5e'::uuid, NULL, 'hr', 'document', 'Employment Letters', 'Show cause notice', 'Asks an employee to explain before any action.', NULL, '<h2>Show Cause Notice</h2>
<p>Date: {{today}}</p>
<p>Dear {{employee_name}},</p>
<p>It has been reported that on {{incident_date}} you {{alleged_conduct}}.</p>
<p>You are required to explain in writing why disciplinary action should not be taken, by {{response_deadline}}.</p>
<p>{{signatory_name}}</p>', ARRAY['today', 'employee_name', 'incident_date', 'alleged_conduct', 'response_deadline', 'signatory_name']::TEXT[], ARRAY['hr', 'letter']::TEXT[], true),
  ('c4c82713-8558-5d98-a5c5-e153db8c678f'::uuid, NULL, 'hr', 'document', 'Employment Letters', 'Internship certificate', 'Certifies a completed internship.', NULL, '<h2>Internship Certificate</h2>
<p>Date: {{today}}</p>
<p>This is to certify that <strong>{{employee_name}}</strong> completed an internship with {{company_name}} in the {{department}} department from {{start_date}} to {{end_date}}.</p>
<p>Project undertaken: {{project_summary}}</p>
<p>{{signatory_name}}</p>', ARRAY['today', 'employee_name', 'company_name', 'department', 'start_date', 'end_date', 'project_summary', 'signatory_name']::TEXT[], ARRAY['hr', 'letter']::TEXT[], true),
  ('de78555a-6604-5047-b17b-edbf00bf8e61'::uuid, NULL, 'hr', 'document', 'Employment Letters', 'No objection certificate', 'Standard NOC for travel or another engagement.', NULL, '<h2>No Objection Certificate</h2>
<p>Date: {{today}}</p>
<p>This is to certify that {{company_name}} has no objection to <strong>{{employee_name}}</strong> ({{designation}}) {{noc_purpose}}.</p>
<p>They have been employed with us since {{joining_date}}.</p>
<p>{{signatory_name}}</p>', ARRAY['today', 'company_name', 'employee_name', 'designation', 'noc_purpose', 'joining_date', 'signatory_name']::TEXT[], ARRAY['hr', 'letter']::TEXT[], true),
  ('5686a398-235b-59ba-8096-1a8ec8f485ee'::uuid, NULL, 'hr', 'document', 'Employment Letters', 'Termination letter', 'Ends employment, stating notice and final dues.', NULL, '<h2>Termination of Employment</h2>
<p>Date: {{today}}</p>
<p>Dear {{employee_name}},</p>
<p>We write to inform you that your employment as {{designation}} will end on {{termination_date}}, for the following reason: {{reason}}.</p>
<p>Your notice period is {{notice_period}}. Final dues of {{final_settlement}} will be settled by {{settlement_date}}.</p>
<p>{{signatory_name}}</p>', ARRAY['today', 'employee_name', 'designation', 'termination_date', 'reason', 'notice_period', 'final_settlement', 'settlement_date', 'signatory_name']::TEXT[], ARRAY['hr', 'letter']::TEXT[], true),
  ('bcd209ab-ccfc-5f11-affa-b9b1adc27e57'::uuid, NULL, 'hr', 'document', 'Employment Letters', 'Acceptance of resignation', 'Accepts a resignation and confirms the last day.', NULL, '<h2>Acceptance of Resignation</h2>
<p>Date: {{today}}</p>
<p>Dear {{employee_name}},</p>
<p>We acknowledge your resignation dated {{resignation_date}}. Your last working day will be {{last_working_day}}.</p>
<p>Please complete handover of {{handover_items}} before that date.</p>
<p>{{signatory_name}}</p>', ARRAY['today', 'employee_name', 'resignation_date', 'last_working_day', 'handover_items', 'signatory_name']::TEXT[], ARRAY['hr', 'letter']::TEXT[], true),
  ('9d2b4327-20d3-5357-b609-c6baed561739'::uuid, NULL, 'hr', 'document', 'Employment Letters', 'Transfer letter', 'Moves an employee to another location or team.', NULL, '<h2>Transfer Order</h2>
<p>Date: {{today}}</p>
<p>Dear {{employee_name}},</p>
<p>You are transferred from {{from_location}} to {{to_location}} with effect from {{effective_date}}. You will report to {{reporting_manager}}.</p>
<p>{{signatory_name}}</p>', ARRAY['today', 'employee_name', 'from_location', 'to_location', 'effective_date', 'reporting_manager', 'signatory_name']::TEXT[], ARRAY['hr', 'letter']::TEXT[], true),
  ('aede29f8-b398-55b2-9434-5f790560a575'::uuid, NULL, 'hr', 'whatsapp', 'People Ops', 'Interview invitation', 'Invites a candidate and confirms logistics.', NULL, 'Hi {{candidate_name}}, we would like to invite you for an interview for {{designation}} on {{interview_date}} at {{interview_time}}. {{location_or_link}}. Please confirm.', ARRAY['candidate_name', 'designation', 'interview_date', 'interview_time', 'location_or_link']::TEXT[], ARRAY['hr']::TEXT[], true),
  ('c46d58df-5760-532d-a337-01eee5cf7529'::uuid, NULL, 'hr', 'whatsapp', 'People Ops', 'Interview reminder', 'Day-before reminder to a candidate.', NULL, 'Hi {{candidate_name}}, reminder about your interview tomorrow at {{interview_time}}. {{location_or_link}}', ARRAY['candidate_name', 'interview_time', 'location_or_link']::TEXT[], ARRAY['hr']::TEXT[], true),
  ('bca37b06-2f0a-5953-ab1e-79bdd8cd7103'::uuid, NULL, 'hr', 'whatsapp', 'People Ops', 'Leave approved', 'Confirms an approved leave request.', NULL, 'Hi {{employee_name}}, your {{leave_type}} leave from {{start_date}} to {{end_date}} has been approved.', ARRAY['employee_name', 'leave_type', 'start_date', 'end_date']::TEXT[], ARRAY['hr']::TEXT[], true),
  ('0e98487a-a3d6-5338-b8ca-e0fcf385d8e0'::uuid, NULL, 'hr', 'whatsapp', 'People Ops', 'Leave rejected', 'Declines a leave request with a reason.', NULL, 'Hi {{employee_name}}, your {{leave_type}} leave request for {{start_date}} to {{end_date}} could not be approved: {{reason}}. Please speak to {{reporting_manager}}.', ARRAY['employee_name', 'leave_type', 'start_date', 'end_date', 'reason', 'reporting_manager']::TEXT[], ARRAY['hr']::TEXT[], true),
  ('c0131fce-437e-5960-a47f-0db6309ab660'::uuid, NULL, 'hr', 'whatsapp', 'People Ops', 'Missing punch reminder', 'Nudges an employee who forgot to clock out.', NULL, 'Hi {{employee_name}}, we did not receive a punch out from you on {{date}}. Please submit a regularisation request.', ARRAY['employee_name', 'date']::TEXT[], ARRAY['hr']::TEXT[], true),
  ('8eedb8ff-134d-5851-b255-3faf309bba41'::uuid, NULL, 'hr', 'whatsapp', 'People Ops', 'Payslip available', 'Tells staff their payslip is ready.', NULL, 'Hi {{employee_name}}, your payslip for {{period}} is now available. Net pay: {{net_pay}}.', ARRAY['employee_name', 'period', 'net_pay']::TEXT[], ARRAY['hr']::TEXT[], true),
  ('ef661d12-e9cf-5b0f-aa2d-85246207d4b4'::uuid, NULL, 'hr', 'whatsapp', 'People Ops', 'Birthday wish', 'Company birthday greeting.', NULL, 'Happy birthday, {{employee_name}}! Wishing you a wonderful year ahead — from everyone at {{company_name}}.', ARRAY['employee_name', 'company_name']::TEXT[], ARRAY['hr']::TEXT[], true),
  ('48a71bf2-a739-5b1e-9ee6-ba389459b018'::uuid, NULL, 'hr', 'whatsapp', 'People Ops', 'Work anniversary', 'Marks an employee''s years of service.', NULL, 'Congratulations {{employee_name}} on {{years}} years with {{company_name}}. Thank you for everything you do.', ARRAY['employee_name', 'years', 'company_name']::TEXT[], ARRAY['hr']::TEXT[], true),
  ('36efe0ec-d114-54da-8b84-2785d23d8d24'::uuid, NULL, 'hr', 'whatsapp', 'People Ops', 'Shift roster published', 'Notifies staff a new roster is out.', NULL, 'Hi {{employee_name}}, the roster for {{period}} is published. Your first shift is {{first_shift}}.', ARRAY['employee_name', 'period', 'first_shift']::TEXT[], ARRAY['hr']::TEXT[], true),
  ('ac84555a-9feb-56ea-9842-400ddb128054'::uuid, NULL, 'hr', 'whatsapp', 'People Ops', 'Document expiry reminder', 'Chases an expiring compliance document.', NULL, 'Hi {{employee_name}}, your {{document_type}} expires on {{expiry_date}}. Please submit an updated copy.', ARRAY['employee_name', 'document_type', 'expiry_date']::TEXT[], ARRAY['hr']::TEXT[], true),
  ('72fa618b-1479-59a2-9e78-aa906216a2aa'::uuid, NULL, 'hr', 'email', 'People Ops', 'Interview invitation', 'Formal interview invitation with the panel and format.', 'Interview invitation — {{designation}} at {{company_name}}', 'Dear {{candidate_name}},

Thank you for applying for {{designation}}. We would like to invite you to an interview.

Date: {{interview_date}}
Time: {{interview_time}}
Format: {{format}}
Panel: {{panel}}

Please confirm your availability.

Kind regards,
{{sender_name}}', ARRAY['candidate_name', 'designation', 'company_name', 'interview_date', 'interview_time', 'format', 'panel', 'sender_name']::TEXT[], ARRAY['hr']::TEXT[], true),
  ('dde51014-3a11-502f-8382-680f06375143'::uuid, NULL, 'hr', 'email', 'People Ops', 'Candidate rejection', 'Declines a candidate respectfully.', 'Update on your application — {{designation}}', 'Dear {{candidate_name}},

Thank you for taking the time to interview for {{designation}}. On this occasion we have decided to progress other candidates.

We will keep your details on file and wish you every success.

Kind regards,
{{sender_name}}', ARRAY['candidate_name', 'designation', 'sender_name']::TEXT[], ARRAY['hr']::TEXT[], true),
  ('aaf4d340-723b-5c78-8432-c7eb607ff4ea'::uuid, NULL, 'hr', 'email', 'People Ops', 'Onboarding — day one', 'Tells a new joiner what to expect on day one.', 'Your first day at {{company_name}}', 'Dear {{employee_name}},

We are looking forward to welcoming you on {{joining_date}}.

Start time: {{start_time}}
Where: {{work_location}}
Ask for: {{buddy_name}}
Bring: {{documents_required}}

Kind regards,
{{sender_name}}', ARRAY['employee_name', 'company_name', 'joining_date', 'start_time', 'work_location', 'buddy_name', 'documents_required', 'sender_name']::TEXT[], ARRAY['hr']::TEXT[], true),
  ('88c77cb3-3b30-5fac-b373-b7a230b2fedd'::uuid, NULL, 'hr', 'email', 'People Ops', 'Probation review', 'Invites an employee to their probation review.', 'Probation review — {{employee_name}}', 'Dear {{employee_name}},

Your probation review is scheduled for {{review_date}} with {{reviewer}}.

Please come prepared to discuss {{review_topics}}.

Kind regards,
{{sender_name}}', ARRAY['employee_name', 'review_date', 'reviewer', 'review_topics', 'sender_name']::TEXT[], ARRAY['hr']::TEXT[], true),
  ('90917c40-2109-5908-8de1-00634d927dd6'::uuid, NULL, 'hr', 'email', 'People Ops', 'Appraisal outcome', 'Communicates an appraisal result.', 'Your {{review_period}} appraisal', 'Dear {{employee_name}},

Thank you for participating in the {{review_period}} appraisal.

Overall rating: {{rating}}
Strengths: {{strengths}}
Development areas: {{development_areas}}
Goals for next period: {{goals}}

Kind regards,
{{sender_name}}', ARRAY['employee_name', 'review_period', 'rating', 'strengths', 'development_areas', 'goals', 'sender_name']::TEXT[], ARRAY['hr']::TEXT[], true),
  ('07542bdf-297f-5323-a29e-560c37c2c634'::uuid, NULL, 'hr', 'email', 'People Ops', 'Policy update', 'Announces a policy change to all staff.', 'Policy update — {{policy_name}}', 'Dear all,

{{policy_name}} has been updated with effect from {{effective_date}}.

What changed: {{summary_of_changes}}
Why: {{reason}}
What you need to do: {{action_required}}

Kind regards,
{{sender_name}}', ARRAY['policy_name', 'effective_date', 'summary_of_changes', 'reason', 'action_required', 'sender_name']::TEXT[], ARRAY['hr']::TEXT[], true),
  ('a36ceab3-2e5c-53c7-bb09-32ab7e1e8ff6'::uuid, NULL, 'hr', 'email', 'People Ops', 'Exit interview invitation', 'Invites a leaver to an exit conversation.', 'Exit conversation before you go', 'Dear {{employee_name}},

Before your last day on {{last_working_day}}, we would value a short exit conversation with {{interviewer}}.

Would {{proposed_time}} suit you?

Kind regards,
{{sender_name}}', ARRAY['employee_name', 'last_working_day', 'interviewer', 'proposed_time', 'sender_name']::TEXT[], ARRAY['hr']::TEXT[], true),
  ('201faea6-3fed-5e5b-8d5b-45b60e846e1a'::uuid, NULL, 'hr', 'email', 'People Ops', 'Training invitation', 'Invites staff to a training session.', 'Training — {{training_name}}', 'Dear {{employee_name}},

You have been enrolled in {{training_name}} on {{training_date}} at {{training_time}}, delivered by {{trainer}}.

Duration: {{duration}}
Where: {{location_or_link}}

Kind regards,
{{sender_name}}', ARRAY['employee_name', 'training_name', 'training_date', 'training_time', 'trainer', 'duration', 'location_or_link', 'sender_name']::TEXT[], ARRAY['hr']::TEXT[], true),
  ('7570d8a0-b844-5e06-add8-07ad3887a008'::uuid, NULL, 'retail', 'whatsapp', 'Orders', 'Order confirmed', 'Confirms an order and the expected date.', NULL, 'Hi {{customer_name}}, your order {{order_number}} for {{amount}} is confirmed. Expected {{delivery_date}}.', ARRAY['customer_name', 'order_number', 'amount', 'delivery_date']::TEXT[], ARRAY['retail']::TEXT[], true),
  ('43eee721-e1ac-5d31-b02d-1527db0445b7'::uuid, NULL, 'retail', 'whatsapp', 'Orders', 'Order packed', 'Tells the customer their order is ready to move.', NULL, 'Hi {{customer_name}}, order {{order_number}} has been packed and will be dispatched {{dispatch_date}}.', ARRAY['customer_name', 'order_number', 'dispatch_date']::TEXT[], ARRAY['retail']::TEXT[], true),
  ('553db11b-a45e-58e3-af68-2c1780ca131f'::uuid, NULL, 'retail', 'whatsapp', 'Orders', 'Out for delivery', 'Same-day delivery notification.', NULL, 'Hi {{customer_name}}, order {{order_number}} is out for delivery today. Our rider {{rider_name}} will call on {{rider_phone}}.', ARRAY['customer_name', 'order_number', 'rider_name', 'rider_phone']::TEXT[], ARRAY['retail']::TEXT[], true),
  ('0eeac621-69ff-5819-b5e7-e55caccabf53'::uuid, NULL, 'retail', 'whatsapp', 'Orders', 'Delivered', 'Confirms delivery and invites feedback.', NULL, 'Hi {{customer_name}}, order {{order_number}} has been delivered. We hope you are happy with it — any issues, just reply here.', ARRAY['customer_name', 'order_number']::TEXT[], ARRAY['retail']::TEXT[], true),
  ('a8059465-fc43-5b52-a27d-09085261178c'::uuid, NULL, 'retail', 'whatsapp', 'Orders', 'Delivery delayed', 'Warns of a delay before the customer notices.', NULL, 'Hi {{customer_name}}, order {{order_number}} is delayed and now expected {{new_date}}. Apologies for the inconvenience — reason: {{reason}}.', ARRAY['customer_name', 'order_number', 'new_date', 'reason']::TEXT[], ARRAY['retail']::TEXT[], true),
  ('6628f3c0-b4c9-511e-8821-0e2a75d9d64a'::uuid, NULL, 'retail', 'whatsapp', 'Orders', 'Ready for pickup', 'Tells the customer their click-and-collect order is ready.', NULL, 'Hi {{customer_name}}, order {{order_number}} is ready for collection at {{store_name}} until {{hold_until}}.', ARRAY['customer_name', 'order_number', 'store_name', 'hold_until']::TEXT[], ARRAY['retail']::TEXT[], true),
  ('f9d5dc55-a9fc-5bfb-8f17-edd9c2731f48'::uuid, NULL, 'retail', 'whatsapp', 'Orders', 'Back in stock', 'Alerts a customer that a watched item is available.', NULL, 'Hi {{customer_name}}, {{product_name}} is back in stock at {{price}}. Shall I reserve one for you?', ARRAY['customer_name', 'product_name', 'price']::TEXT[], ARRAY['retail']::TEXT[], true),
  ('6dc9ae5b-9c0a-5f1b-ad76-d0d08e17de1e'::uuid, NULL, 'retail', 'whatsapp', 'Orders', 'Abandoned cart', 'Recovers an incomplete purchase.', NULL, 'Hi {{customer_name}}, you left {{product_name}} in your basket. It is still available at {{price}} — {{checkout_link}}', ARRAY['customer_name', 'product_name', 'price', 'checkout_link']::TEXT[], ARRAY['retail']::TEXT[], true),
  ('a96a2889-e7bb-5eed-8f4d-ca957403130f'::uuid, NULL, 'retail', 'whatsapp', 'Orders', 'Offer announcement', 'Promotes a time-limited offer.', NULL, 'Hi {{customer_name}}, {{offer_description}} at {{company_name}} until {{offer_end_date}}. {{offer_link}}', ARRAY['customer_name', 'offer_description', 'company_name', 'offer_end_date', 'offer_link']::TEXT[], ARRAY['retail']::TEXT[], true),
  ('d6ac1862-b81a-5634-a859-ae56d27422bc'::uuid, NULL, 'retail', 'whatsapp', 'Orders', 'Loyalty points update', 'Tells a customer their points balance.', NULL, 'Hi {{customer_name}}, you now have {{points}} points — worth {{value}} off your next purchase.', ARRAY['customer_name', 'points', 'value']::TEXT[], ARRAY['retail']::TEXT[], true),
  ('55330259-6d48-54ba-aab8-ebd78af33343'::uuid, NULL, 'retail', 'whatsapp', 'Orders', 'Return approved', 'Confirms a return and the next step.', NULL, 'Hi {{customer_name}}, your return for order {{order_number}} is approved. {{return_instructions}}', ARRAY['customer_name', 'order_number', 'return_instructions']::TEXT[], ARRAY['retail']::TEXT[], true),
  ('c5682a80-15d4-5727-874c-dedb9d0ca131'::uuid, NULL, 'retail', 'whatsapp', 'Orders', 'Warranty reminder', 'Reminds a customer their warranty is ending.', NULL, 'Hi {{customer_name}}, the warranty on {{product_name}} expires on {{expiry_date}}. Extended cover is available — reply if interested.', ARRAY['customer_name', 'product_name', 'expiry_date']::TEXT[], ARRAY['retail']::TEXT[], true),
  ('1e802eda-e48a-5c94-bfa6-dbe2ec677f39'::uuid, NULL, 'retail', 'email', 'Orders', 'Order confirmation', 'Emailed order confirmation with the line items.', 'Order {{order_number}} confirmed', 'Dear {{customer_name}},

Thank you for your order {{order_number}} placed on {{order_date}}.

Items: {{items_summary}}
Total: {{amount}}
Delivery to: {{delivery_address}}
Expected: {{delivery_date}}

Kind regards,
{{company_name}}', ARRAY['customer_name', 'order_number', 'order_date', 'items_summary', 'amount', 'delivery_address', 'delivery_date', 'company_name']::TEXT[], ARRAY['retail']::TEXT[], true),
  ('bc88a2c7-07ba-5dcd-b236-102d7a48eded'::uuid, NULL, 'retail', 'email', 'Orders', 'Shipping confirmation', 'Sends tracking details.', 'Your order {{order_number}} has shipped', 'Dear {{customer_name}},

Order {{order_number}} shipped on {{dispatch_date}} via {{carrier}}.

Tracking: {{tracking_number}}
Expected delivery: {{delivery_date}}

Kind regards,
{{company_name}}', ARRAY['customer_name', 'order_number', 'dispatch_date', 'carrier', 'tracking_number', 'delivery_date', 'company_name']::TEXT[], ARRAY['retail']::TEXT[], true),
  ('8a28b175-b6ae-53ff-a4f0-7051fd8feb6b'::uuid, NULL, 'retail', 'email', 'Orders', 'Low stock alert (internal)', 'Warns the team a line is running out.', 'Low stock — {{product_name}}', '{{product_name}} ({{sku}}) has fallen to {{current_stock}} units, below the reorder level of {{reorder_level}}.

Supplier: {{supplier_name}}
Suggested order: {{suggested_quantity}}', ARRAY['product_name', 'sku', 'current_stock', 'reorder_level', 'supplier_name', 'suggested_quantity']::TEXT[], ARRAY['retail']::TEXT[], true),
  ('a1c07efe-87f7-5773-8d50-75445cdb8785'::uuid, NULL, 'retail', 'email', 'Orders', 'Purchase order', 'Sends a purchase order to a supplier.', 'Purchase order {{po_number}}', 'Dear {{supplier_name}},

Please supply the following against purchase order {{po_number}}:

{{items_summary}}

Delivery to: {{delivery_address}}
Required by: {{required_date}}
Total: {{amount}}

Kind regards,
{{sender_name}}', ARRAY['supplier_name', 'po_number', 'items_summary', 'delivery_address', 'required_date', 'amount', 'sender_name']::TEXT[], ARRAY['retail']::TEXT[], true),
  ('ffb1a93e-c158-5cf9-a93e-45adb7540c69'::uuid, NULL, 'projects', 'whatsapp', 'Delivery', 'Project kickoff', 'Announces the start of a project.', NULL, 'Hi {{contact_name}}, we are kicking off {{project_name}} on {{start_date}}. Your project manager is {{project_manager}}.', ARRAY['contact_name', 'project_name', 'start_date', 'project_manager']::TEXT[], ARRAY['projects']::TEXT[], true),
  ('06284e81-8ae9-5fef-a917-52a7ca9d1fc6'::uuid, NULL, 'projects', 'whatsapp', 'Delivery', 'Milestone reached', 'Reports a completed milestone.', NULL, 'Hi {{contact_name}}, milestone {{milestone_name}} on {{project_name}} is complete as of {{completion_date}}. Next up: {{next_milestone}}.', ARRAY['contact_name', 'milestone_name', 'project_name', 'completion_date', 'next_milestone']::TEXT[], ARRAY['projects']::TEXT[], true),
  ('8f888834-332b-5cf7-8e12-d0824b835694'::uuid, NULL, 'projects', 'whatsapp', 'Delivery', 'Approval needed', 'Chases a decision that is blocking work.', NULL, 'Hi {{contact_name}}, we need your sign-off on {{deliverable}} to keep {{project_name}} on schedule. Could you review by {{deadline}}?', ARRAY['contact_name', 'deliverable', 'project_name', 'deadline']::TEXT[], ARRAY['projects']::TEXT[], true),
  ('f0aac941-7b83-5839-ad6f-4e60f9030189'::uuid, NULL, 'projects', 'email', 'Delivery', 'Weekly status report', 'Standard weekly project update.', '{{project_name}} — status for week ending {{week_ending}}', 'Dear {{contact_name}},

Status: {{status}}

Completed this week:
{{completed_items}}

Planned next week:
{{planned_items}}

Risks and blockers:
{{risks}}

Budget used: {{budget_used}} of {{budget_total}}

Kind regards,
{{project_manager}}', ARRAY['contact_name', 'project_name', 'week_ending', 'status', 'completed_items', 'planned_items', 'risks', 'budget_used', 'budget_total', 'project_manager']::TEXT[], ARRAY['projects']::TEXT[], true),
  ('de1b37a1-d364-510c-ad8b-4b75f023a54f'::uuid, NULL, 'projects', 'email', 'Delivery', 'Change request', 'Proposes a scope change with cost and time impact.', 'Change request {{change_number}} — {{project_name}}', 'Dear {{contact_name}},

We have assessed the requested change: {{change_description}}

Impact on cost: {{cost_impact}}
Impact on schedule: {{schedule_impact}}
Revised completion: {{revised_completion}}

Please confirm whether to proceed.

Kind regards,
{{project_manager}}', ARRAY['contact_name', 'change_number', 'project_name', 'change_description', 'cost_impact', 'schedule_impact', 'revised_completion', 'project_manager']::TEXT[], ARRAY['projects']::TEXT[], true),
  ('a268ba3a-3fa9-592a-b31a-cbf7d3c267ba'::uuid, NULL, 'projects', 'email', 'Delivery', 'Project completion', 'Closes a project and hands over.', '{{project_name}} — project closure', 'Dear {{contact_name}},

{{project_name}} completed on {{completion_date}}.

Delivered: {{deliverables}}
Final cost: {{final_cost}}
Handover documents: {{handover_docs}}
Support contact: {{support_contact}}

Thank you for working with us.

Kind regards,
{{project_manager}}', ARRAY['contact_name', 'project_name', 'completion_date', 'deliverables', 'final_cost', 'handover_docs', 'support_contact', 'project_manager']::TEXT[], ARRAY['projects']::TEXT[], true),
  ('45442b9d-a248-51b5-9a1d-1ba5dcb63e79'::uuid, NULL, 'general', 'sms', 'Notifications', 'OTP verification', 'One-time passcode for login or checkout.', NULL, '{{otp_code}} is your {{company_name}} verification code. Valid {{validity_minutes}} minutes. Do not share it.', ARRAY['otp_code', 'company_name', 'validity_minutes']::TEXT[], ARRAY['sms']::TEXT[], true),
  ('f2a082f8-052a-51ae-b758-1cd81392cbad'::uuid, NULL, 'general', 'sms', 'Notifications', 'Appointment reminder', 'Short appointment reminder.', NULL, 'Reminder: {{appointment_type}} at {{company_name}} on {{date}} at {{time}}. Reply C to confirm.', ARRAY['appointment_type', 'company_name', 'date', 'time']::TEXT[], ARRAY['sms']::TEXT[], true),
  ('00c393b7-a945-5fd7-9979-28ee8d13539b'::uuid, NULL, 'general', 'sms', 'Notifications', 'Payment due', 'Terse payment reminder.', NULL, '{{company_name}}: invoice {{invoice_number}} for {{amount}} is due {{due_date}}. {{payment_link}}', ARRAY['company_name', 'invoice_number', 'amount', 'due_date', 'payment_link']::TEXT[], ARRAY['sms']::TEXT[], true),
  ('2d07fa26-961f-5576-b8f9-2e69fc34094d'::uuid, NULL, 'general', 'sms', 'Notifications', 'Payment received', 'Short payment confirmation.', NULL, '{{company_name}}: received {{amount}} against {{invoice_number}}. Thank you.', ARRAY['company_name', 'amount', 'invoice_number']::TEXT[], ARRAY['sms']::TEXT[], true),
  ('33bb360d-3293-5cbe-b302-33dcd89a251a'::uuid, NULL, 'general', 'sms', 'Notifications', 'Delivery today', 'Delivery-day heads-up.', NULL, '{{company_name}}: order {{order_number}} arrives today. Rider {{rider_phone}}.', ARRAY['company_name', 'order_number', 'rider_phone']::TEXT[], ARRAY['sms']::TEXT[], true),
  ('e937a393-39db-512a-ac8b-124d55c1b692'::uuid, NULL, 'general', 'sms', 'Notifications', 'Shift reminder', 'Reminds staff of tomorrow''s shift.', NULL, '{{company_name}}: your shift on {{date}} starts {{start_time}} at {{location}}.', ARRAY['company_name', 'date', 'start_time', 'location']::TEXT[], ARRAY['sms']::TEXT[], true),
  ('b4c472e4-0882-5e0d-a4d8-64be93cfa6ee'::uuid, NULL, 'general', 'sms', 'Notifications', 'Offer alert', 'Short promotional message.', NULL, '{{company_name}}: {{offer_description}} until {{offer_end_date}}. {{offer_link}}', ARRAY['company_name', 'offer_description', 'offer_end_date', 'offer_link']::TEXT[], ARRAY['sms']::TEXT[], true),
  ('c79fea8d-599b-5a74-afa2-aabc7e606271'::uuid, NULL, 'general', 'sms', 'Notifications', 'Service due', 'Reminds a customer that a service is due.', NULL, '{{company_name}}: {{service_type}} for {{item}} is due {{due_date}}. Call {{phone}} to book.', ARRAY['company_name', 'service_type', 'item', 'due_date', 'phone']::TEXT[], ARRAY['sms']::TEXT[], true),
  ('b4e93f4a-da71-5fb2-b37a-c6945ac21cef'::uuid, NULL, 'general', 'email', 'Internal', 'Task assigned', 'Notifies someone that work has been assigned to them.', 'Task assigned — {{task_title}}', 'Hi {{assignee_name}},

{{assigner_name}} assigned you: {{task_title}}

Due: {{due_date}}
Priority: {{priority}}
Details: {{task_details}}', ARRAY['assignee_name', 'assigner_name', 'task_title', 'due_date', 'priority', 'task_details']::TEXT[], ARRAY['internal']::TEXT[], true),
  ('53a12867-45e9-5e3d-86eb-41c8a514ee8c'::uuid, NULL, 'general', 'email', 'Internal', 'Approval request', 'Asks a manager to approve something.', 'Approval needed — {{request_type}}', 'Hi {{approver_name}},

{{requester_name}} has requested approval for {{request_type}}.

Details: {{request_details}}
Amount: {{amount}}
Needed by: {{deadline}}', ARRAY['approver_name', 'requester_name', 'request_type', 'request_details', 'amount', 'deadline']::TEXT[], ARRAY['internal']::TEXT[], true),
  ('1153d3f9-af27-518c-96bd-513bf366275e'::uuid, NULL, 'general', 'email', 'Internal', 'Meeting agenda', 'Circulates an agenda before a meeting.', 'Agenda — {{meeting_title}}, {{meeting_date}}', 'Agenda for {{meeting_title}} on {{meeting_date}} at {{meeting_time}}.

{{agenda_items}}

Attendees: {{attendees}}
Pre-reading: {{pre_reading}}', ARRAY['meeting_title', 'meeting_date', 'meeting_time', 'agenda_items', 'attendees', 'pre_reading']::TEXT[], ARRAY['internal']::TEXT[], true),
  ('9ed6dc1c-2a27-5ea7-9e3c-be3a0a1ecb5e'::uuid, NULL, 'general', 'whatsapp', 'Internal', 'Escalation', 'Flags an urgent internal issue.', NULL, 'Escalation on {{subject}}: {{issue_summary}}. Owner: {{owner}}. Needed by {{deadline}}.', ARRAY['subject', 'issue_summary', 'owner', 'deadline']::TEXT[], ARRAY['internal']::TEXT[], true),
  ('49278671-08a0-5f3e-83c8-6d6e3c8e807d'::uuid, NULL, 'general', 'email', 'Internal', 'Customer complaint acknowledgement', 'Acknowledges a complaint and gives a timeline.', 'We are looking into your complaint — {{reference}}', 'Dear {{contact_name}},

We have logged your complaint (reference {{reference}}) about {{issue_summary}}.

{{owner}} is investigating and will respond by {{response_deadline}}.

Kind regards,
{{sender_name}}', ARRAY['contact_name', 'reference', 'issue_summary', 'owner', 'response_deadline', 'sender_name']::TEXT[], ARRAY['internal']::TEXT[], true)
ON CONFLICT (id) DO NOTHING;
