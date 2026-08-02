/**
 * Generates the seed INSERT for the built-in template library
 * (migration 088). Run:
 *
 *   node scripts/generate-template-library.mjs > /tmp/library.sql
 *
 * Kept as a generator rather than hand-written SQL so the catalogue can
 * be reviewed as data, and so re-running produces a stable, diffable
 * file. IDs are derived deterministically from module+channel+slug, so a
 * template keeps its ID across regenerations and ON CONFLICT DO NOTHING
 * makes re-seeding a no-op.
 */

import { createHash } from "node:crypto";

/** Deterministic UUIDv5-shaped id from a stable key. */
function idFor(key) {
  const h = createHash("sha1").update(`daily-crm:template:${key}`).digest("hex");
  return [
    h.slice(0, 8),
    h.slice(8, 12),
    // Version nibble 5, variant bits 8-b: keeps it a well-formed UUID.
    "5" + h.slice(13, 16),
    ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16) + h.slice(17, 20),
    h.slice(20, 32),
  ].join("-");
}

const sql = (v) =>
  v === null || v === undefined ? "NULL" : `'${String(v).replace(/'/g, "''")}'`;

const arr = (items) =>
  items.length === 0
    ? "ARRAY[]::TEXT[]"
    : `ARRAY[${items.map((i) => sql(i)).join(", ")}]::TEXT[]`;

/**
 * Every template. `vars` are the {{tokens}} the body uses; they are
 * stored so the editor can offer them and validate before sending.
 */
const T = [];

/** @param t {{module:string,channel:string,category:string,name:string,description:string,subject?:string,body:string,vars:string[],tags?:string[]}} */
const add = (t) => T.push(t);

// ── CRM · WhatsApp ─────────────────────────────────────────────
const crmWa = [
  ["New enquiry acknowledgement", "Confirms an inbound enquiry within seconds so the lead does not go cold.",
   "Hi {{contact_name}}, thanks for getting in touch with {{company_name}}. We have received your enquiry about {{subject}} and a member of our team will respond within {{response_time}}.", ["contact_name","company_name","subject","response_time"]],
  ["First follow-up", "Gentle nudge two days after an unanswered enquiry.",
   "Hi {{contact_name}}, just following up on your enquiry about {{subject}}. Would you like to arrange a quick call this week?", ["contact_name","subject"]],
  ["Second follow-up", "Final nudge before marking a lead dormant.",
   "Hi {{contact_name}}, I have tried to reach you a couple of times about {{subject}}. If now is not the right time, just reply STOP and I will close this off.", ["contact_name","subject"]],
  ["Quotation sent", "Tells the customer a quote is waiting and where to find it.",
   "Hi {{contact_name}}, your quotation {{quote_number}} for {{amount}} is ready. It is valid until {{valid_until}}. Let me know if you would like anything adjusted.", ["contact_name","quote_number","amount","valid_until"]],
  ["Quotation reminder", "Chases a quote that is close to expiring.",
   "Hi {{contact_name}}, a quick reminder that quotation {{quote_number}} expires on {{valid_until}}. Shall I extend it?", ["contact_name","quote_number","valid_until"]],
  ["Meeting confirmation", "Confirms a booked meeting with the joining details.",
   "Hi {{contact_name}}, confirming our meeting on {{meeting_date}} at {{meeting_time}}. {{location_or_link}}. Looking forward to it.", ["contact_name","meeting_date","meeting_time","location_or_link"]],
  ["Meeting reminder", "Day-before reminder to cut no-shows.",
   "Hi {{contact_name}}, reminder about our meeting tomorrow at {{meeting_time}}. Reply RESCHEDULE if you need a different time.", ["contact_name","meeting_time"]],
  ["Deal won — thank you", "Marks a closed-won deal and sets up the handover.",
   "Hi {{contact_name}}, delighted to have you on board with {{company_name}}. {{account_manager}} will be in touch to get everything set up.", ["contact_name","company_name","account_manager"]],
  ["Deal lost — keep in touch", "Leaves the door open on a lost deal.",
   "Hi {{contact_name}}, thanks for considering {{company_name}}. If your requirements change, we would be glad to help.", ["contact_name","company_name"]],
  ["Feedback request", "Asks for a rating shortly after delivery.",
   "Hi {{contact_name}}, how did we do with {{subject}}? A quick rating from 1 to 5 would help us a lot.", ["contact_name","subject"]],
  ["Referral request", "Asks a happy customer for an introduction.",
   "Hi {{contact_name}}, glad {{subject}} went well. Do you know anyone else who might benefit from what we do?", ["contact_name","subject"]],
  ["Reactivation", "Wakes up a contact who has gone quiet for months.",
   "Hi {{contact_name}}, it has been a while since we worked together on {{subject}}. We have added a few things since — worth a catch-up?", ["contact_name","subject"]],
  ["Catalogue share", "Sends the product catalogue on request.",
   "Hi {{contact_name}}, here is our latest catalogue: {{catalogue_link}}. Tell me what catches your eye and I will send pricing.", ["contact_name","catalogue_link"]],
  ["Site visit scheduled", "Confirms an on-site visit.",
   "Hi {{contact_name}}, our team will visit {{site_address}} on {{visit_date}} at {{visit_time}}. Please let us know if anyone needs to be present.", ["contact_name","site_address","visit_date","visit_time"]],
  ["Out of office", "Auto-reply outside business hours.",
   "Thanks for messaging {{company_name}}. Our team is available {{business_hours}}. We will reply as soon as we are back.", ["company_name","business_hours"]],
];
crmWa.forEach(([name, description, body, vars]) =>
  add({ module: "crm", channel: "whatsapp", category: "Sales", name, description, body, vars, tags: ["sales"] }));

// ── CRM · Email ────────────────────────────────────────────────
const crmEmail = [
  ["Enquiry acknowledgement", "Formal email confirming an enquiry.", "We have received your enquiry",
   "Dear {{contact_name}},\n\nThank you for contacting {{company_name}}. We have received your enquiry regarding {{subject}} and will respond within {{response_time}}.\n\nKind regards,\n{{sender_name}}\n{{company_name}}", ["contact_name","company_name","subject","response_time","sender_name"]],
  ["Quotation covering email", "Sends a quotation with the terms summarised.", "Your quotation {{quote_number}} from {{company_name}}",
   "Dear {{contact_name}},\n\nPlease find attached quotation {{quote_number}} for {{amount}}, valid until {{valid_until}}.\n\nThe quote covers {{scope_summary}}. Payment terms are {{payment_terms}}.\n\nDo let me know if you would like to discuss any part of it.\n\nKind regards,\n{{sender_name}}", ["contact_name","quote_number","amount","valid_until","scope_summary","payment_terms","sender_name"]],
  ["Proposal follow-up", "Follows up on a proposal after a week.", "Following up on our proposal",
   "Dear {{contact_name}},\n\nI wanted to check whether you have had a chance to review the proposal we sent on {{sent_date}}.\n\nHappy to walk through it or adjust the scope.\n\nKind regards,\n{{sender_name}}", ["contact_name","sent_date","sender_name"]],
  ["Welcome / onboarding", "Introduces a new customer to their contacts and next steps.", "Welcome to {{company_name}}",
   "Dear {{contact_name}},\n\nWelcome to {{company_name}}. Your account manager is {{account_manager}}, reachable at {{account_manager_email}}.\n\nNext steps:\n1. {{step_one}}\n2. {{step_two}}\n3. {{step_three}}\n\nKind regards,\n{{sender_name}}", ["contact_name","company_name","account_manager","account_manager_email","step_one","step_two","step_three","sender_name"]],
  ["Meeting request", "Proposes times for a meeting.", "Meeting request — {{subject}}",
   "Dear {{contact_name}},\n\nWould any of the following suit you for a {{duration}} conversation about {{subject}}?\n\n- {{option_one}}\n- {{option_two}}\n- {{option_three}}\n\nKind regards,\n{{sender_name}}", ["contact_name","duration","subject","option_one","option_two","option_three","sender_name"]],
  ["Meeting notes", "Summarises what was agreed after a meeting.", "Notes from our meeting on {{meeting_date}}",
   "Dear {{contact_name}},\n\nThank you for your time on {{meeting_date}}. To summarise:\n\nDiscussed: {{discussion_summary}}\nAgreed: {{agreed_actions}}\nNext step: {{next_step}} by {{next_step_date}}\n\nKind regards,\n{{sender_name}}", ["contact_name","meeting_date","discussion_summary","agreed_actions","next_step","next_step_date","sender_name"]],
  ["Contract for signature", "Sends a contract and explains how to sign.", "Contract for signature — {{contract_reference}}",
   "Dear {{contact_name}},\n\nPlease find attached contract {{contract_reference}} for your signature.\n\nOnce signed, {{next_step}}. The contract is open for signature until {{expiry_date}}.\n\nKind regards,\n{{sender_name}}", ["contact_name","contract_reference","next_step","expiry_date","sender_name"]],
  ["Reactivation", "Re-engages a dormant account.", "It has been a while, {{contact_name}}",
   "Dear {{contact_name}},\n\nWe last worked together on {{last_engagement}}. Since then we have added {{whats_new}}.\n\nWould a short call be useful?\n\nKind regards,\n{{sender_name}}", ["contact_name","last_engagement","whats_new","sender_name"]],
  ["Thank you after purchase", "Thanks a customer and sets support expectations.", "Thank you from {{company_name}}",
   "Dear {{contact_name}},\n\nThank you for choosing {{company_name}}. For anything at all, contact {{support_email}} or {{support_phone}}.\n\nKind regards,\n{{sender_name}}", ["contact_name","company_name","support_email","support_phone","sender_name"]],
  ["Apology / service recovery", "Acknowledges a failure and states the remedy.", "Our apologies — {{issue_summary}}",
   "Dear {{contact_name}},\n\nI am sorry about {{issue_summary}}. This is not the standard we hold ourselves to.\n\nWhat happened: {{root_cause}}\nWhat we are doing: {{remedy}}\nBy when: {{remedy_date}}\n\nKind regards,\n{{sender_name}}", ["contact_name","issue_summary","root_cause","remedy","remedy_date","sender_name"]],
];
crmEmail.forEach(([name, description, subject, body, vars]) =>
  add({ module: "crm", channel: "email", category: "Sales", name, description, subject, body, vars, tags: ["sales"] }));

// ── Accounting · WhatsApp + Email ──────────────────────────────
const acctWa = [
  ["Invoice issued", "Notifies the customer a new invoice is available.",
   "Hi {{contact_name}}, invoice {{invoice_number}} for {{amount}} is now due on {{due_date}}. {{payment_link}}", ["contact_name","invoice_number","amount","due_date","payment_link"]],
  ["Payment reminder — before due", "Courtesy reminder a few days before the due date.",
   "Hi {{contact_name}}, a reminder that invoice {{invoice_number}} for {{amount}} falls due on {{due_date}}.", ["contact_name","invoice_number","amount","due_date"]],
  ["Payment reminder — overdue", "First chase after the due date passes.",
   "Hi {{contact_name}}, invoice {{invoice_number}} for {{amount}} was due on {{due_date}} and is now {{days_overdue}} days overdue. Could you let me know when we can expect payment?", ["contact_name","invoice_number","amount","due_date","days_overdue"]],
  ["Payment reminder — final notice", "Last reminder before escalation.",
   "Hi {{contact_name}}, invoice {{invoice_number}} for {{amount}} remains unpaid {{days_overdue}} days after the due date. Please arrange payment by {{final_date}} to avoid {{consequence}}.", ["contact_name","invoice_number","amount","days_overdue","final_date","consequence"]],
  ["Payment received", "Confirms receipt so the customer stops worrying.",
   "Hi {{contact_name}}, we have received your payment of {{amount}} against invoice {{invoice_number}}. Thank you.", ["contact_name","amount","invoice_number"]],
  ["Partial payment received", "Acknowledges part payment and states the balance.",
   "Hi {{contact_name}}, thank you for {{amount_paid}} against invoice {{invoice_number}}. The remaining balance is {{balance}}, due {{due_date}}.", ["contact_name","amount_paid","invoice_number","balance","due_date"]],
  ["Statement of account", "Sends a periodic account statement.",
   "Hi {{contact_name}}, your account statement to {{statement_date}} shows a balance of {{balance}}. {{statement_link}}", ["contact_name","statement_date","balance","statement_link"]],
  ["Refund processed", "Confirms a refund and when it will land.",
   "Hi {{contact_name}}, a refund of {{amount}} has been processed against {{reference}}. It should reach you within {{settlement_days}} working days.", ["contact_name","amount","reference","settlement_days"]],
];
acctWa.forEach(([name, description, body, vars]) =>
  add({ module: "accounting", channel: "whatsapp", category: "Receivables", name, description, body, vars, tags: ["finance"] }));

const acctEmail = [
  ["Invoice covering email", "Sends an invoice with the payment details.", "Invoice {{invoice_number}} from {{company_name}}",
   "Dear {{contact_name}},\n\nPlease find attached invoice {{invoice_number}} for {{amount}}, due on {{due_date}}.\n\nPayment details:\n{{payment_details}}\n\nKind regards,\n{{sender_name}}\n{{company_name}}", ["contact_name","invoice_number","amount","due_date","payment_details","sender_name","company_name"]],
  ["Overdue escalation", "Formal escalation on a badly overdue invoice.", "Overdue invoice {{invoice_number}} — {{days_overdue}} days",
   "Dear {{contact_name}},\n\nInvoice {{invoice_number}} for {{amount}} was due on {{due_date}} and remains unpaid after {{days_overdue}} days.\n\nPlease arrange payment by {{final_date}}. If there is a dispute, tell us by that date so we can resolve it.\n\nKind regards,\n{{sender_name}}", ["contact_name","invoice_number","amount","due_date","days_overdue","final_date","sender_name"]],
  ["Receipt", "Formal receipt after payment.", "Receipt for your payment — {{reference}}",
   "Dear {{contact_name}},\n\nWe confirm receipt of {{amount}} on {{payment_date}} against {{reference}}.\n\nKind regards,\n{{sender_name}}", ["contact_name","amount","payment_date","reference","sender_name"]],
  ["Monthly statement", "Sends the monthly statement of account.", "Statement of account — {{period}}",
   "Dear {{contact_name}},\n\nPlease find your statement for {{period}}.\n\nOpening balance: {{opening_balance}}\nInvoiced: {{invoiced}}\nReceived: {{received}}\nClosing balance: {{closing_balance}}\n\nKind regards,\n{{sender_name}}", ["contact_name","period","opening_balance","invoiced","received","closing_balance","sender_name"]],
  ["Payment plan proposal", "Offers instalments on a large overdue balance.", "Payment arrangement for {{reference}}",
   "Dear {{contact_name}},\n\nRegarding the outstanding {{balance}} on {{reference}}, we can offer {{instalments}} instalments of {{instalment_amount}}, beginning {{start_date}}.\n\nReply to confirm and we will document it.\n\nKind regards,\n{{sender_name}}", ["contact_name","balance","reference","instalments","instalment_amount","start_date","sender_name"]],
];
acctEmail.forEach(([name, description, subject, body, vars]) =>
  add({ module: "accounting", channel: "email", category: "Receivables", name, description, subject, body, vars, tags: ["finance"] }));

// ── HR · Documents ─────────────────────────────────────────────
const hrDocs = [
  ["Offer letter", "Formal offer with compensation and start date.",
   "<h2>Letter of Offer</h2>\n<p>Date: {{today}}</p>\n<p>Dear {{employee_name}},</p>\n<p>We are pleased to offer you the position of <strong>{{designation}}</strong> at {{company_name}}, reporting to {{reporting_manager}}.</p>\n<p>Your start date will be {{joining_date}} and your annual compensation will be {{salary}}. Your place of work will be {{work_location}}.</p>\n<p>This offer is subject to {{conditions}}. Please confirm acceptance by {{acceptance_deadline}}.</p>\n<p>Yours sincerely,<br/>{{signatory_name}}<br/>{{signatory_designation}}</p>",
   ["today","employee_name","designation","company_name","reporting_manager","joining_date","salary","work_location","conditions","acceptance_deadline","signatory_name","signatory_designation"]],
  ["Appointment letter", "Confirms appointment after the offer is accepted.",
   "<h2>Letter of Appointment</h2>\n<p>Date: {{today}}</p>\n<p>Dear {{employee_name}},</p>\n<p>Further to your acceptance, we confirm your appointment as <strong>{{designation}}</strong> with effect from {{joining_date}}.</p>\n<p>Your employee code is {{employee_code}}. Your probation period is {{probation_period}}, after which your appointment will be confirmed subject to satisfactory performance.</p>\n<p>Yours sincerely,<br/>{{signatory_name}}</p>",
   ["today","employee_name","designation","joining_date","employee_code","probation_period","signatory_name"]],
  ["Confirmation of employment", "Confirms an employee after probation.",
   "<h2>Confirmation of Employment</h2>\n<p>Date: {{today}}</p>\n<p>Dear {{employee_name}},</p>\n<p>We are pleased to confirm your employment as {{designation}} with effect from {{confirmation_date}}, following the successful completion of your probation.</p>\n<p>Yours sincerely,<br/>{{signatory_name}}</p>",
   ["today","employee_name","designation","confirmation_date","signatory_name"]],
  ["Experience certificate", "States dates and role for a departing employee.",
   "<h2>Experience Certificate</h2>\n<p>Date: {{today}}</p>\n<p>This is to certify that <strong>{{employee_name}}</strong> was employed with {{company_name}} as {{designation}} from {{joining_date}} to {{relieving_date}}.</p>\n<p>During this period their conduct and performance were {{conduct_remark}}.</p>\n<p>We wish them every success.</p>\n<p>{{signatory_name}}<br/>{{signatory_designation}}</p>",
   ["today","employee_name","company_name","designation","joining_date","relieving_date","conduct_remark","signatory_name","signatory_designation"]],
  ["Relieving letter", "Formally releases an employee on their last day.",
   "<h2>Relieving Letter</h2>\n<p>Date: {{today}}</p>\n<p>Dear {{employee_name}},</p>\n<p>This is to confirm that you have been relieved from your duties as {{designation}} at {{company_name}} at the close of business on {{relieving_date}}.</p>\n<p>All dues have been settled. We thank you for your contribution.</p>\n<p>{{signatory_name}}</p>",
   ["today","employee_name","designation","company_name","relieving_date","signatory_name"]],
  ["Salary certificate", "Confirms salary for a bank or landlord.",
   "<h2>Salary Certificate</h2>\n<p>Date: {{today}}</p>\n<p>This is to certify that <strong>{{employee_name}}</strong> ({{employee_code}}) is employed with {{company_name}} as {{designation}} since {{joining_date}}.</p>\n<p>Their current annual compensation is {{salary}}.</p>\n<p>This certificate is issued at the employee's request for {{purpose}}.</p>\n<p>{{signatory_name}}</p>",
   ["today","employee_name","employee_code","company_name","designation","joining_date","salary","purpose","signatory_name"]],
  ["Promotion letter", "Confirms a promotion and new terms.",
   "<h2>Letter of Promotion</h2>\n<p>Date: {{today}}</p>\n<p>Dear {{employee_name}},</p>\n<p>In recognition of your contribution, we are pleased to promote you to <strong>{{new_designation}}</strong> with effect from {{effective_date}}.</p>\n<p>Your revised compensation will be {{new_salary}} and you will report to {{reporting_manager}}.</p>\n<p>Congratulations.</p>\n<p>{{signatory_name}}</p>",
   ["today","employee_name","new_designation","effective_date","new_salary","reporting_manager","signatory_name"]],
  ["Increment letter", "Communicates a salary revision.",
   "<h2>Salary Revision</h2>\n<p>Date: {{today}}</p>\n<p>Dear {{employee_name}},</p>\n<p>Following the {{review_period}} review, your compensation has been revised from {{old_salary}} to {{new_salary}} with effect from {{effective_date}}.</p>\n<p>{{signatory_name}}</p>",
   ["today","employee_name","review_period","old_salary","new_salary","effective_date","signatory_name"]],
  ["Warning letter", "Formal written warning for a conduct issue.",
   "<h2>Written Warning</h2>\n<p>Date: {{today}}</p>\n<p>Dear {{employee_name}},</p>\n<p>This letter is a formal warning regarding {{issue_summary}}, observed on {{incident_date}}.</p>\n<p>Expected standard: {{expected_conduct}}</p>\n<p>Required improvement: {{required_action}} by {{improvement_deadline}}.</p>\n<p>Failure to improve may lead to further disciplinary action.</p>\n<p>{{signatory_name}}</p>",
   ["today","employee_name","issue_summary","incident_date","expected_conduct","required_action","improvement_deadline","signatory_name"]],
  ["Show cause notice", "Asks an employee to explain before any action.",
   "<h2>Show Cause Notice</h2>\n<p>Date: {{today}}</p>\n<p>Dear {{employee_name}},</p>\n<p>It has been reported that on {{incident_date}} you {{alleged_conduct}}.</p>\n<p>You are required to explain in writing why disciplinary action should not be taken, by {{response_deadline}}.</p>\n<p>{{signatory_name}}</p>",
   ["today","employee_name","incident_date","alleged_conduct","response_deadline","signatory_name"]],
  ["Internship certificate", "Certifies a completed internship.",
   "<h2>Internship Certificate</h2>\n<p>Date: {{today}}</p>\n<p>This is to certify that <strong>{{employee_name}}</strong> completed an internship with {{company_name}} in the {{department}} department from {{start_date}} to {{end_date}}.</p>\n<p>Project undertaken: {{project_summary}}</p>\n<p>{{signatory_name}}</p>",
   ["today","employee_name","company_name","department","start_date","end_date","project_summary","signatory_name"]],
  ["No objection certificate", "Standard NOC for travel or another engagement.",
   "<h2>No Objection Certificate</h2>\n<p>Date: {{today}}</p>\n<p>This is to certify that {{company_name}} has no objection to <strong>{{employee_name}}</strong> ({{designation}}) {{noc_purpose}}.</p>\n<p>They have been employed with us since {{joining_date}}.</p>\n<p>{{signatory_name}}</p>",
   ["today","company_name","employee_name","designation","noc_purpose","joining_date","signatory_name"]],
  ["Termination letter", "Ends employment, stating notice and final dues.",
   "<h2>Termination of Employment</h2>\n<p>Date: {{today}}</p>\n<p>Dear {{employee_name}},</p>\n<p>We write to inform you that your employment as {{designation}} will end on {{termination_date}}, for the following reason: {{reason}}.</p>\n<p>Your notice period is {{notice_period}}. Final dues of {{final_settlement}} will be settled by {{settlement_date}}.</p>\n<p>{{signatory_name}}</p>",
   ["today","employee_name","designation","termination_date","reason","notice_period","final_settlement","settlement_date","signatory_name"]],
  ["Acceptance of resignation", "Accepts a resignation and confirms the last day.",
   "<h2>Acceptance of Resignation</h2>\n<p>Date: {{today}}</p>\n<p>Dear {{employee_name}},</p>\n<p>We acknowledge your resignation dated {{resignation_date}}. Your last working day will be {{last_working_day}}.</p>\n<p>Please complete handover of {{handover_items}} before that date.</p>\n<p>{{signatory_name}}</p>",
   ["today","employee_name","resignation_date","last_working_day","handover_items","signatory_name"]],
  ["Transfer letter", "Moves an employee to another location or team.",
   "<h2>Transfer Order</h2>\n<p>Date: {{today}}</p>\n<p>Dear {{employee_name}},</p>\n<p>You are transferred from {{from_location}} to {{to_location}} with effect from {{effective_date}}. You will report to {{reporting_manager}}.</p>\n<p>{{signatory_name}}</p>",
   ["today","employee_name","from_location","to_location","effective_date","reporting_manager","signatory_name"]],
];
hrDocs.forEach(([name, description, body, vars]) =>
  add({ module: "hr", channel: "document", category: "Employment Letters", name, description, body, vars, tags: ["hr","letter"] }));

// ── HR · WhatsApp + Email (operational) ────────────────────────
const hrWa = [
  ["Interview invitation", "Invites a candidate and confirms logistics.",
   "Hi {{candidate_name}}, we would like to invite you for an interview for {{designation}} on {{interview_date}} at {{interview_time}}. {{location_or_link}}. Please confirm.", ["candidate_name","designation","interview_date","interview_time","location_or_link"]],
  ["Interview reminder", "Day-before reminder to a candidate.",
   "Hi {{candidate_name}}, reminder about your interview tomorrow at {{interview_time}}. {{location_or_link}}", ["candidate_name","interview_time","location_or_link"]],
  ["Leave approved", "Confirms an approved leave request.",
   "Hi {{employee_name}}, your {{leave_type}} leave from {{start_date}} to {{end_date}} has been approved.", ["employee_name","leave_type","start_date","end_date"]],
  ["Leave rejected", "Declines a leave request with a reason.",
   "Hi {{employee_name}}, your {{leave_type}} leave request for {{start_date}} to {{end_date}} could not be approved: {{reason}}. Please speak to {{reporting_manager}}.", ["employee_name","leave_type","start_date","end_date","reason","reporting_manager"]],
  ["Missing punch reminder", "Nudges an employee who forgot to clock out.",
   "Hi {{employee_name}}, we did not receive a punch out from you on {{date}}. Please submit a regularisation request.", ["employee_name","date"]],
  ["Payslip available", "Tells staff their payslip is ready.",
   "Hi {{employee_name}}, your payslip for {{period}} is now available. Net pay: {{net_pay}}.", ["employee_name","period","net_pay"]],
  ["Birthday wish", "Company birthday greeting.",
   "Happy birthday, {{employee_name}}! Wishing you a wonderful year ahead — from everyone at {{company_name}}.", ["employee_name","company_name"]],
  ["Work anniversary", "Marks an employee's years of service.",
   "Congratulations {{employee_name}} on {{years}} years with {{company_name}}. Thank you for everything you do.", ["employee_name","years","company_name"]],
  ["Shift roster published", "Notifies staff a new roster is out.",
   "Hi {{employee_name}}, the roster for {{period}} is published. Your first shift is {{first_shift}}.", ["employee_name","period","first_shift"]],
  ["Document expiry reminder", "Chases an expiring compliance document.",
   "Hi {{employee_name}}, your {{document_type}} expires on {{expiry_date}}. Please submit an updated copy.", ["employee_name","document_type","expiry_date"]],
];
hrWa.forEach(([name, description, body, vars]) =>
  add({ module: "hr", channel: "whatsapp", category: "People Ops", name, description, body, vars, tags: ["hr"] }));

const hrEmail = [
  ["Interview invitation", "Formal interview invitation with the panel and format.", "Interview invitation — {{designation}} at {{company_name}}",
   "Dear {{candidate_name}},\n\nThank you for applying for {{designation}}. We would like to invite you to an interview.\n\nDate: {{interview_date}}\nTime: {{interview_time}}\nFormat: {{format}}\nPanel: {{panel}}\n\nPlease confirm your availability.\n\nKind regards,\n{{sender_name}}", ["candidate_name","designation","company_name","interview_date","interview_time","format","panel","sender_name"]],
  ["Candidate rejection", "Declines a candidate respectfully.", "Update on your application — {{designation}}",
   "Dear {{candidate_name}},\n\nThank you for taking the time to interview for {{designation}}. On this occasion we have decided to progress other candidates.\n\nWe will keep your details on file and wish you every success.\n\nKind regards,\n{{sender_name}}", ["candidate_name","designation","sender_name"]],
  ["Onboarding — day one", "Tells a new joiner what to expect on day one.", "Your first day at {{company_name}}",
   "Dear {{employee_name}},\n\nWe are looking forward to welcoming you on {{joining_date}}.\n\nStart time: {{start_time}}\nWhere: {{work_location}}\nAsk for: {{buddy_name}}\nBring: {{documents_required}}\n\nKind regards,\n{{sender_name}}", ["employee_name","company_name","joining_date","start_time","work_location","buddy_name","documents_required","sender_name"]],
  ["Probation review", "Invites an employee to their probation review.", "Probation review — {{employee_name}}",
   "Dear {{employee_name}},\n\nYour probation review is scheduled for {{review_date}} with {{reviewer}}.\n\nPlease come prepared to discuss {{review_topics}}.\n\nKind regards,\n{{sender_name}}", ["employee_name","review_date","reviewer","review_topics","sender_name"]],
  ["Appraisal outcome", "Communicates an appraisal result.", "Your {{review_period}} appraisal",
   "Dear {{employee_name}},\n\nThank you for participating in the {{review_period}} appraisal.\n\nOverall rating: {{rating}}\nStrengths: {{strengths}}\nDevelopment areas: {{development_areas}}\nGoals for next period: {{goals}}\n\nKind regards,\n{{sender_name}}", ["employee_name","review_period","rating","strengths","development_areas","goals","sender_name"]],
  ["Policy update", "Announces a policy change to all staff.", "Policy update — {{policy_name}}",
   "Dear all,\n\n{{policy_name}} has been updated with effect from {{effective_date}}.\n\nWhat changed: {{summary_of_changes}}\nWhy: {{reason}}\nWhat you need to do: {{action_required}}\n\nKind regards,\n{{sender_name}}", ["policy_name","effective_date","summary_of_changes","reason","action_required","sender_name"]],
  ["Exit interview invitation", "Invites a leaver to an exit conversation.", "Exit conversation before you go",
   "Dear {{employee_name}},\n\nBefore your last day on {{last_working_day}}, we would value a short exit conversation with {{interviewer}}.\n\nWould {{proposed_time}} suit you?\n\nKind regards,\n{{sender_name}}", ["employee_name","last_working_day","interviewer","proposed_time","sender_name"]],
  ["Training invitation", "Invites staff to a training session.", "Training — {{training_name}}",
   "Dear {{employee_name}},\n\nYou have been enrolled in {{training_name}} on {{training_date}} at {{training_time}}, delivered by {{trainer}}.\n\nDuration: {{duration}}\nWhere: {{location_or_link}}\n\nKind regards,\n{{sender_name}}", ["employee_name","training_name","training_date","training_time","trainer","duration","location_or_link","sender_name"]],
];
hrEmail.forEach(([name, description, subject, body, vars]) =>
  add({ module: "hr", channel: "email", category: "People Ops", name, description, subject, body, vars, tags: ["hr"] }));

// ── Retail ─────────────────────────────────────────────────────
const retailWa = [
  ["Order confirmed", "Confirms an order and the expected date.",
   "Hi {{customer_name}}, your order {{order_number}} for {{amount}} is confirmed. Expected {{delivery_date}}.", ["customer_name","order_number","amount","delivery_date"]],
  ["Order packed", "Tells the customer their order is ready to move.",
   "Hi {{customer_name}}, order {{order_number}} has been packed and will be dispatched {{dispatch_date}}.", ["customer_name","order_number","dispatch_date"]],
  ["Out for delivery", "Same-day delivery notification.",
   "Hi {{customer_name}}, order {{order_number}} is out for delivery today. Our rider {{rider_name}} will call on {{rider_phone}}.", ["customer_name","order_number","rider_name","rider_phone"]],
  ["Delivered", "Confirms delivery and invites feedback.",
   "Hi {{customer_name}}, order {{order_number}} has been delivered. We hope you are happy with it — any issues, just reply here.", ["customer_name","order_number"]],
  ["Delivery delayed", "Warns of a delay before the customer notices.",
   "Hi {{customer_name}}, order {{order_number}} is delayed and now expected {{new_date}}. Apologies for the inconvenience — reason: {{reason}}.", ["customer_name","order_number","new_date","reason"]],
  ["Ready for pickup", "Tells the customer their click-and-collect order is ready.",
   "Hi {{customer_name}}, order {{order_number}} is ready for collection at {{store_name}} until {{hold_until}}.", ["customer_name","order_number","store_name","hold_until"]],
  ["Back in stock", "Alerts a customer that a watched item is available.",
   "Hi {{customer_name}}, {{product_name}} is back in stock at {{price}}. Shall I reserve one for you?", ["customer_name","product_name","price"]],
  ["Abandoned cart", "Recovers an incomplete purchase.",
   "Hi {{customer_name}}, you left {{product_name}} in your basket. It is still available at {{price}} — {{checkout_link}}", ["customer_name","product_name","price","checkout_link"]],
  ["Offer announcement", "Promotes a time-limited offer.",
   "Hi {{customer_name}}, {{offer_description}} at {{company_name}} until {{offer_end_date}}. {{offer_link}}", ["customer_name","offer_description","company_name","offer_end_date","offer_link"]],
  ["Loyalty points update", "Tells a customer their points balance.",
   "Hi {{customer_name}}, you now have {{points}} points — worth {{value}} off your next purchase.", ["customer_name","points","value"]],
  ["Return approved", "Confirms a return and the next step.",
   "Hi {{customer_name}}, your return for order {{order_number}} is approved. {{return_instructions}}", ["customer_name","order_number","return_instructions"]],
  ["Warranty reminder", "Reminds a customer their warranty is ending.",
   "Hi {{customer_name}}, the warranty on {{product_name}} expires on {{expiry_date}}. Extended cover is available — reply if interested.", ["customer_name","product_name","expiry_date"]],
];
retailWa.forEach(([name, description, body, vars]) =>
  add({ module: "retail", channel: "whatsapp", category: "Orders", name, description, body, vars, tags: ["retail"] }));

const retailEmail = [
  ["Order confirmation", "Emailed order confirmation with the line items.", "Order {{order_number}} confirmed",
   "Dear {{customer_name}},\n\nThank you for your order {{order_number}} placed on {{order_date}}.\n\nItems: {{items_summary}}\nTotal: {{amount}}\nDelivery to: {{delivery_address}}\nExpected: {{delivery_date}}\n\nKind regards,\n{{company_name}}", ["customer_name","order_number","order_date","items_summary","amount","delivery_address","delivery_date","company_name"]],
  ["Shipping confirmation", "Sends tracking details.", "Your order {{order_number}} has shipped",
   "Dear {{customer_name}},\n\nOrder {{order_number}} shipped on {{dispatch_date}} via {{carrier}}.\n\nTracking: {{tracking_number}}\nExpected delivery: {{delivery_date}}\n\nKind regards,\n{{company_name}}", ["customer_name","order_number","dispatch_date","carrier","tracking_number","delivery_date","company_name"]],
  ["Low stock alert (internal)", "Warns the team a line is running out.", "Low stock — {{product_name}}",
   "{{product_name}} ({{sku}}) has fallen to {{current_stock}} units, below the reorder level of {{reorder_level}}.\n\nSupplier: {{supplier_name}}\nSuggested order: {{suggested_quantity}}", ["product_name","sku","current_stock","reorder_level","supplier_name","suggested_quantity"]],
  ["Purchase order", "Sends a purchase order to a supplier.", "Purchase order {{po_number}}",
   "Dear {{supplier_name}},\n\nPlease supply the following against purchase order {{po_number}}:\n\n{{items_summary}}\n\nDelivery to: {{delivery_address}}\nRequired by: {{required_date}}\nTotal: {{amount}}\n\nKind regards,\n{{sender_name}}", ["supplier_name","po_number","items_summary","delivery_address","required_date","amount","sender_name"]],
];
retailEmail.forEach(([name, description, subject, body, vars]) =>
  add({ module: "retail", channel: "email", category: "Orders", name, description, subject, body, vars, tags: ["retail"] }));

// ── Projects ───────────────────────────────────────────────────
const projTemplates = [
  ["whatsapp","Project kickoff", "Announces the start of a project.",
   "Hi {{contact_name}}, we are kicking off {{project_name}} on {{start_date}}. Your project manager is {{project_manager}}.", ["contact_name","project_name","start_date","project_manager"]],
  ["whatsapp","Milestone reached", "Reports a completed milestone.",
   "Hi {{contact_name}}, milestone {{milestone_name}} on {{project_name}} is complete as of {{completion_date}}. Next up: {{next_milestone}}.", ["contact_name","milestone_name","project_name","completion_date","next_milestone"]],
  ["whatsapp","Approval needed", "Chases a decision that is blocking work.",
   "Hi {{contact_name}}, we need your sign-off on {{deliverable}} to keep {{project_name}} on schedule. Could you review by {{deadline}}?", ["contact_name","deliverable","project_name","deadline"]],
  ["email","Weekly status report", "Standard weekly project update.", "{{project_name}} — status for week ending {{week_ending}}",
   "Dear {{contact_name}},\n\nStatus: {{status}}\n\nCompleted this week:\n{{completed_items}}\n\nPlanned next week:\n{{planned_items}}\n\nRisks and blockers:\n{{risks}}\n\nBudget used: {{budget_used}} of {{budget_total}}\n\nKind regards,\n{{project_manager}}", ["contact_name","project_name","week_ending","status","completed_items","planned_items","risks","budget_used","budget_total","project_manager"]],
  ["email","Change request", "Proposes a scope change with cost and time impact.", "Change request {{change_number}} — {{project_name}}",
   "Dear {{contact_name}},\n\nWe have assessed the requested change: {{change_description}}\n\nImpact on cost: {{cost_impact}}\nImpact on schedule: {{schedule_impact}}\nRevised completion: {{revised_completion}}\n\nPlease confirm whether to proceed.\n\nKind regards,\n{{project_manager}}", ["contact_name","change_number","project_name","change_description","cost_impact","schedule_impact","revised_completion","project_manager"]],
  ["email","Project completion", "Closes a project and hands over.", "{{project_name}} — project closure",
   "Dear {{contact_name}},\n\n{{project_name}} completed on {{completion_date}}.\n\nDelivered: {{deliverables}}\nFinal cost: {{final_cost}}\nHandover documents: {{handover_docs}}\nSupport contact: {{support_contact}}\n\nThank you for working with us.\n\nKind regards,\n{{project_manager}}", ["contact_name","project_name","completion_date","deliverables","final_cost","handover_docs","support_contact","project_manager"]],
];
projTemplates.forEach(([channel, name, description, ...rest]) => {
  if (channel === "email") {
    const [subject, body, vars] = rest;
    add({ module: "projects", channel, category: "Delivery", name, description, subject, body, vars, tags: ["projects"] });
  } else {
    const [body, vars] = rest;
    add({ module: "projects", channel, category: "Delivery", name, description, body, vars, tags: ["projects"] });
  }
});

// ── SMS (short, no formatting) ─────────────────────────────────
const sms = [
  ["OTP verification", "One-time passcode for login or checkout.",
   "{{otp_code}} is your {{company_name}} verification code. Valid {{validity_minutes}} minutes. Do not share it.", ["otp_code","company_name","validity_minutes"]],
  ["Appointment reminder", "Short appointment reminder.",
   "Reminder: {{appointment_type}} at {{company_name}} on {{date}} at {{time}}. Reply C to confirm.", ["appointment_type","company_name","date","time"]],
  ["Payment due", "Terse payment reminder.",
   "{{company_name}}: invoice {{invoice_number}} for {{amount}} is due {{due_date}}. {{payment_link}}", ["company_name","invoice_number","amount","due_date","payment_link"]],
  ["Payment received", "Short payment confirmation.",
   "{{company_name}}: received {{amount}} against {{invoice_number}}. Thank you.", ["company_name","amount","invoice_number"]],
  ["Delivery today", "Delivery-day heads-up.",
   "{{company_name}}: order {{order_number}} arrives today. Rider {{rider_phone}}.", ["company_name","order_number","rider_phone"]],
  ["Shift reminder", "Reminds staff of tomorrow's shift.",
   "{{company_name}}: your shift on {{date}} starts {{start_time}} at {{location}}.", ["company_name","date","start_time","location"]],
  ["Offer alert", "Short promotional message.",
   "{{company_name}}: {{offer_description}} until {{offer_end_date}}. {{offer_link}}", ["company_name","offer_description","offer_end_date","offer_link"]],
  ["Service due", "Reminds a customer that a service is due.",
   "{{company_name}}: {{service_type}} for {{item}} is due {{due_date}}. Call {{phone}} to book.", ["company_name","service_type","item","due_date","phone"]],
];
sms.forEach(([name, description, body, vars]) =>
  add({ module: "general", channel: "sms", category: "Notifications", name, description, body, vars, tags: ["sms"] }));

// ── General / internal ─────────────────────────────────────────
const general = [
  ["email","Task assigned", "Notifies someone that work has been assigned to them.", "Task assigned — {{task_title}}",
   "Hi {{assignee_name}},\n\n{{assigner_name}} assigned you: {{task_title}}\n\nDue: {{due_date}}\nPriority: {{priority}}\nDetails: {{task_details}}", ["assignee_name","assigner_name","task_title","due_date","priority","task_details"]],
  ["email","Approval request", "Asks a manager to approve something.", "Approval needed — {{request_type}}",
   "Hi {{approver_name}},\n\n{{requester_name}} has requested approval for {{request_type}}.\n\nDetails: {{request_details}}\nAmount: {{amount}}\nNeeded by: {{deadline}}", ["approver_name","requester_name","request_type","request_details","amount","deadline"]],
  ["email","Meeting agenda", "Circulates an agenda before a meeting.", "Agenda — {{meeting_title}}, {{meeting_date}}",
   "Agenda for {{meeting_title}} on {{meeting_date}} at {{meeting_time}}.\n\n{{agenda_items}}\n\nAttendees: {{attendees}}\nPre-reading: {{pre_reading}}", ["meeting_title","meeting_date","meeting_time","agenda_items","attendees","pre_reading"]],
  ["whatsapp","Escalation", "Flags an urgent internal issue.",
   "Escalation on {{subject}}: {{issue_summary}}. Owner: {{owner}}. Needed by {{deadline}}.", ["subject","issue_summary","owner","deadline"]],
  ["email","Customer complaint acknowledgement", "Acknowledges a complaint and gives a timeline.", "We are looking into your complaint — {{reference}}",
   "Dear {{contact_name}},\n\nWe have logged your complaint (reference {{reference}}) about {{issue_summary}}.\n\n{{owner}} is investigating and will respond by {{response_deadline}}.\n\nKind regards,\n{{sender_name}}", ["contact_name","reference","issue_summary","owner","response_deadline","sender_name"]],
];
general.forEach(([channel, name, description, ...rest]) => {
  if (channel === "email") {
    const [subject, body, vars] = rest;
    add({ module: "general", channel, category: "Internal", name, description, subject, body, vars, tags: ["internal"] });
  } else {
    const [body, vars] = rest;
    add({ module: "general", channel, category: "Internal", name, description, body, vars, tags: ["internal"] });
  }
});

// ── Emit ───────────────────────────────────────────────────────
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const seen = new Set();
const rows = T.map((t) => {
  const key = `${t.module}:${t.channel}:${slug(t.name)}`;
  if (seen.has(key)) throw new Error(`Duplicate template key: ${key}`);
  seen.add(key);
  return `  (${sql(idFor(key))}::uuid, NULL, ${sql(t.module)}, ${sql(t.channel)}, ${sql(t.category)}, ${sql(t.name)}, ${sql(t.description)}, ${sql(t.subject ?? null)}, ${sql(t.body)}, ${arr(t.vars)}, ${arr(t.tags ?? [])}, true)`;
});

process.stdout.write(`-- ${rows.length} built-in templates. Generated by scripts/generate-template-library.mjs — do not edit by hand.
INSERT INTO public.templates
  (id, workspace_id, module, channel, category, name, description, subject, body, variables, tags, is_system)
VALUES
${rows.join(",\n")}
ON CONFLICT (id) DO NOTHING;
`);
