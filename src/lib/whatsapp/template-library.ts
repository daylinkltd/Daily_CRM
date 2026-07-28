/**
 * Prebuilt WhatsApp template library — Meta-compliant starting points
 * for the messages every business sends (order confirmations, payment
 * reminders, re-engagement, …).
 *
 * Static by design: no DB table, no per-workspace rows. "Use this
 * template" in the templates UI copies one of these into the existing
 * create-and-submit-to-Meta flow, where the user can tweak the copy
 * before submitting for approval. Names are snake_case (Meta's
 * `[a-z0-9_]` rule), variables are contiguous `{{1}}…{{n}}`, and every
 * variable ships a sample value because Meta review requires one.
 *
 * Categories use the app's capitalized 'Utility' / 'Marketing' values
 * (message_templates.category CHECK) — the Meta payload builder
 * uppercases them on submit.
 */

import type { TemplateButton } from '@/types';

export interface LibraryTemplate {
  /** Stable slug for React keys — same as `name`. */
  id: string;
  /** Meta template name: lowercase letters, digits, underscores. */
  name: string;
  /** Human title shown on the library card. */
  label: string;
  /** One-line "when to use this" description for the card. */
  description: string;
  category: 'Utility' | 'Marketing';
  /** Exact Meta language code. */
  language: string;
  /** Optional TEXT header (≤60 chars, at most one {{1}} variable). */
  header?: string;
  /** Sample for the header variable when the header contains {{1}}. */
  header_sample?: string;
  /** Body copy with contiguous {{1}}-style variables (≤1024 chars). */
  body: string;
  /** One sample per body variable, in order — required by Meta review. */
  body_samples: string[];
  /** Optional footer (≤60 chars). */
  footer?: string;
  /** Optional buttons (quick replies first, per Meta ordering rules). */
  buttons?: TemplateButton[];
}

export const TEMPLATE_LIBRARY: LibraryTemplate[] = [
  {
    id: 'welcome_message',
    name: 'welcome_message',
    label: 'Welcome message',
    description: 'Greet a new customer right after they sign up or opt in.',
    category: 'Utility',
    language: 'en_US',
    header: 'Welcome to {{1}}!',
    header_sample: 'Acme Traders',
    body:
      'Hi {{1}}, thanks for joining {{2}}! Your account is all set. ' +
      'Save this number to reach us any time — we reply fastest right here on WhatsApp.',
    body_samples: ['Priya', 'Acme Traders'],
    footer: 'Reply STOP to unsubscribe',
    buttons: [
      { type: 'QUICK_REPLY', text: 'Get started' },
      { type: 'QUICK_REPLY', text: 'Talk to support' },
    ],
  },
  {
    id: 'order_confirmation',
    name: 'order_confirmation',
    label: 'Order confirmation',
    description: 'Confirm a new order with its number and amount.',
    category: 'Utility',
    language: 'en_US',
    header: 'Order confirmed',
    body:
      'Hi {{1}}, your order {{2}} has been confirmed. ' +
      'Total: {{3}}. We will message you again as soon as it ships. ' +
      'Thanks for shopping with us!',
    body_samples: ['Priya', '#10245', 'INR 2,499'],
    footer: 'Questions? Just reply to this message.',
    buttons: [
      { type: 'QUICK_REPLY', text: 'View order details' },
      { type: 'QUICK_REPLY', text: 'Change my order' },
    ],
  },
  {
    id: 'shipping_update',
    name: 'shipping_update',
    label: 'Shipping update',
    description: 'Tell the customer their order is on the way, with tracking.',
    category: 'Utility',
    language: 'en_US',
    header: 'Your order has shipped',
    body:
      'Good news {{1}} — order {{2}} is on its way! ' +
      'Carrier: {{3}}. Tracking number: {{4}}. ' +
      'Expected delivery: {{5}}.',
    body_samples: ['Priya', '#10245', 'BlueDart', 'BD123456789IN', 'Fri, 2 Aug'],
    footer: 'Delivery times are estimates.',
    buttons: [{ type: 'QUICK_REPLY', text: 'Track my order' }],
  },
  {
    id: 'payment_reminder',
    name: 'payment_reminder',
    label: 'Payment reminder',
    description: 'Nudge a customer about an unpaid invoice before it is overdue.',
    category: 'Utility',
    language: 'en_US',
    header: 'Payment reminder',
    body:
      'Hi {{1}}, this is a friendly reminder that invoice {{2}} for {{3}} ' +
      'is due on {{4}}. If you have already paid, please ignore this message.',
    body_samples: ['Priya', 'INV-2031', 'INR 12,500', '5 Aug 2026'],
    footer: 'Thank you for your business.',
    buttons: [
      { type: 'QUICK_REPLY', text: 'I have paid' },
      { type: 'QUICK_REPLY', text: 'Need more time' },
    ],
  },
  {
    id: 'appointment_reminder',
    name: 'appointment_reminder',
    label: 'Appointment reminder',
    description: 'Remind a customer of an upcoming appointment.',
    category: 'Utility',
    language: 'en_US',
    header: 'Appointment reminder',
    body:
      'Hi {{1}}, a quick reminder about your appointment with {{2}} ' +
      'on {{3}} at {{4}}. Reply below to confirm or reschedule.',
    body_samples: ['Priya', 'Dr. Mehta', 'Mon, 4 Aug', '3:30 PM'],
    footer: 'Please arrive 10 minutes early.',
    buttons: [
      { type: 'QUICK_REPLY', text: 'Confirm' },
      { type: 'QUICK_REPLY', text: 'Reschedule' },
      { type: 'QUICK_REPLY', text: 'Cancel' },
    ],
  },
  {
    id: 'appointment_confirmation',
    name: 'appointment_confirmation',
    label: 'Appointment confirmation',
    description: 'Confirm a booking the moment it is made.',
    category: 'Utility',
    language: 'en_US',
    header: 'Booking confirmed',
    body:
      'Hi {{1}}, your appointment is confirmed for {{2}} at {{3}} with {{4}}. ' +
      'We look forward to seeing you!',
    body_samples: ['Priya', 'Mon, 4 Aug', '3:30 PM', 'Dr. Mehta'],
    footer: 'Need to make changes? Just reply here.',
    buttons: [{ type: 'QUICK_REPLY', text: 'Add to calendar' }],
  },
  {
    id: 'feedback_request',
    name: 'feedback_request',
    label: 'Feedback request',
    description: 'Ask for a quick rating after a purchase or visit.',
    category: 'Marketing',
    language: 'en_US',
    header: 'How did we do?',
    body:
      'Hi {{1}}, thanks for choosing {{2}}! We would love your feedback on ' +
      'your recent experience — it takes less than a minute and helps us improve.',
    body_samples: ['Priya', 'Acme Traders'],
    footer: 'Reply STOP to unsubscribe',
    buttons: [
      { type: 'QUICK_REPLY', text: 'Great' },
      { type: 'QUICK_REPLY', text: 'Okay' },
      { type: 'QUICK_REPLY', text: 'Could be better' },
    ],
  },
  {
    id: 'abandoned_cart',
    name: 'abandoned_cart',
    label: 'Abandoned cart',
    description: 'Recover a checkout the customer left behind.',
    category: 'Marketing',
    language: 'en_US',
    header: 'You left something behind',
    body:
      'Hi {{1}}, your cart at {{2}} is still waiting — including {{3}}. ' +
      'Complete your order now before it sells out. ' +
      'Use code {{4}} for a little something extra at checkout.',
    body_samples: ['Priya', 'Acme Traders', 'the Classic Tote Bag', 'COMEBACK10'],
    footer: 'Reply STOP to unsubscribe',
    buttons: [
      { type: 'QUICK_REPLY', text: 'Complete my order' },
      { type: 'QUICK_REPLY', text: 'Not interested' },
    ],
  },
  {
    id: 'we_miss_you',
    name: 'we_miss_you',
    label: 'We miss you (re-engagement)',
    description: 'Win back customers who have gone quiet.',
    category: 'Marketing',
    language: 'en_US',
    header: 'We miss you, {{1}}!',
    header_sample: 'Priya',
    body:
      'It has been a while since your last visit to {{1}}. ' +
      'We have added new arrivals we think you will love — and as a welcome-back ' +
      'treat, enjoy {{2}} off your next order with code {{3}}.',
    body_samples: ['Acme Traders', '15%', 'WELCOME15'],
    footer: 'Reply STOP to unsubscribe',
    buttons: [
      { type: 'QUICK_REPLY', text: 'Show me what is new' },
      { type: 'QUICK_REPLY', text: 'Unsubscribe' },
    ],
  },
  {
    id: 'invoice_sent',
    name: 'invoice_sent',
    label: 'Invoice sent',
    description: 'Notify a customer that a new invoice has been issued.',
    category: 'Utility',
    language: 'en_US',
    header: 'New invoice from {{1}}',
    header_sample: 'Acme Traders',
    body:
      'Hi {{1}}, invoice {{2}} for {{3}} has been generated and sent to you. ' +
      'Payment is due by {{4}}. Reply here if anything looks incorrect.',
    body_samples: ['Priya', 'INV-2031', 'INR 12,500', '5 Aug 2026'],
    footer: 'Thank you for your business.',
    buttons: [{ type: 'QUICK_REPLY', text: 'View invoice' }],
  },
  {
    id: 'support_followup',
    name: 'support_followup',
    label: 'Support follow-up',
    description: 'Check back in after a support conversation was resolved.',
    category: 'Utility',
    language: 'en_US',
    header: 'Following up on your request',
    body:
      'Hi {{1}}, we recently resolved your support request {{2}}. ' +
      'Is everything working as expected? Reply below and we will jump ' +
      'back in if you need anything else.',
    body_samples: ['Priya', '#5641'],
    footer: 'We are here to help.',
    buttons: [
      { type: 'QUICK_REPLY', text: 'All good' },
      { type: 'QUICK_REPLY', text: 'Still need help' },
    ],
  },

  // ── Templates tied to Daily CRM features ─────────────────────────
  // Quotations module
  {
    id: 'quotation_sent',
    name: 'quotation_sent',
    label: 'Quotation sent',
    description: 'Share a new quotation from the Quotations module with its total.',
    category: 'Utility',
    language: 'en_US',
    header: 'Your quotation is ready',
    body:
      'Hi {{1}}, your quotation {{2}} from {{3}} is ready. ' +
      'Total: {{4}}, valid until {{5}}. Reply here if you would like ' +
      'any changes — we can revise it right away.',
    body_samples: ['Priya', '#QT-1042', 'Acme Traders', 'INR 45,000', '15 Aug 2026'],
    footer: 'Prices include all applicable taxes.',
    buttons: [
      { type: 'QUICK_REPLY', text: 'Approve quotation' },
      { type: 'QUICK_REPLY', text: 'Request changes' },
    ],
  },
  {
    id: 'quotation_follow_up',
    name: 'quotation_follow_up',
    label: 'Quotation follow-up',
    description: 'Follow up on a quotation the customer has not responded to.',
    category: 'Marketing',
    language: 'en_US',
    header: 'Still thinking it over?',
    body:
      'Hi {{1}}, just checking in on quotation {{2}} we sent on {{3}}. ' +
      'It stays valid until {{4}}. Happy to walk you through it or ' +
      'adjust anything that does not fit your needs.',
    body_samples: ['Priya', '#QT-1042', '28 Jul', '15 Aug 2026'],
    footer: 'Reply STOP to unsubscribe',
    buttons: [
      { type: 'QUICK_REPLY', text: 'Let’s proceed' },
      { type: 'QUICK_REPLY', text: 'I have questions' },
    ],
  },
  // Pipelines / deals module
  {
    id: 'deal_won_welcome',
    name: 'deal_won_welcome',
    label: 'Deal won — onboarding',
    description: 'Thank a customer after a deal closes and set next steps.',
    category: 'Utility',
    language: 'en_US',
    header: 'Welcome aboard!',
    body:
      'Hi {{1}}, thank you for choosing {{2}}! Your onboarding begins on ' +
      '{{3}} and {{4}} will be your point of contact. We are excited to ' +
      'get started.',
    body_samples: ['Priya', 'Acme Traders', 'Mon, 4 Aug', 'Rahul'],
    footer: 'Save this number for anything you need.',
    buttons: [{ type: 'QUICK_REPLY', text: 'View next steps' }],
  },
  // Forms module
  {
    id: 'form_received',
    name: 'form_received',
    label: 'Form received',
    description: 'Confirm a form submission (lead capture, inquiry, application).',
    category: 'Utility',
    language: 'en_US',
    header: 'We received your details',
    body:
      'Hi {{1}}, thanks for filling in the {{2}} form. Our team will ' +
      'review your submission and get back to you within {{3}}. ' +
      'You can reply here with anything you would like to add.',
    body_samples: ['Priya', 'Project Inquiry', '24 hours'],
    footer: 'Daily CRM by Daylink',
  },
  // Broadcasts / catalog
  {
    id: 'new_catalog_item',
    name: 'new_catalog_item',
    label: 'New product / service launch',
    description: 'Announce a new catalog item or service to opted-in customers.',
    category: 'Marketing',
    language: 'en_US',
    header: 'Something new for you',
    body:
      'Hi {{1}}! We just launched {{2}} — {{3}}. As one of our valued ' +
      'customers you get first access. Reply here and we will share the ' +
      'full details.',
    body_samples: ['Priya', 'Premium Care Plan', 'priority support with same-day response'],
    footer: 'Reply STOP to unsubscribe',
    buttons: [
      { type: 'QUICK_REPLY', text: 'Tell me more' },
      { type: 'QUICK_REPLY', text: 'Not interested' },
    ],
  },
  // Appointments / meetings booked via pipeline or forms
  {
    id: 'meeting_link',
    name: 'meeting_link',
    label: 'Meeting scheduled',
    description: 'Send a scheduled meeting confirmation with date, time and agenda.',
    category: 'Utility',
    language: 'en_US',
    header: 'Meeting confirmed',
    body:
      'Hi {{1}}, your meeting with {{2}} is confirmed for {{3}} at {{4}}. ' +
      'Agenda: {{5}}. Reply here if you need to reschedule.',
    body_samples: ['Priya', 'Rahul from Acme', 'Tue, 5 Aug', '3:00 PM IST', 'Requirements walkthrough'],
    footer: 'We look forward to speaking with you.',
    buttons: [
      { type: 'QUICK_REPLY', text: 'Confirm' },
      { type: 'QUICK_REPLY', text: 'Reschedule' },
    ],
  },
  // Billing / subscription renewals for service businesses
  {
    id: 'renewal_reminder',
    name: 'renewal_reminder',
    label: 'Renewal reminder',
    description: 'Remind a customer their plan or service expires soon.',
    category: 'Utility',
    language: 'en_US',
    header: 'Renewal coming up',
    body:
      'Hi {{1}}, your {{2}} with {{3}} expires on {{4}}. ' +
      'Renew before then to avoid any interruption. Reply here and we ' +
      'will take care of it in minutes.',
    body_samples: ['Priya', 'Annual Maintenance Plan', 'Acme Traders', '10 Aug 2026'],
    footer: 'Thank you for staying with us.',
    buttons: [
      { type: 'QUICK_REPLY', text: 'Renew now' },
      { type: 'QUICK_REPLY', text: 'Talk to us first' },
    ],
  },
];

/**
 * Replace {{n}} placeholders with their sample values for the library
 * card preview — "Hi {{1}}" renders as "Hi Priya". Falls back to the
 * raw placeholder when no sample exists so nothing disappears.
 */
export function fillTemplateVariables(
  text: string,
  samples: string[],
): string {
  return text.replace(/\{\{(\d+)\}\}/g, (raw, n) => {
    const idx = Number(n) - 1;
    return samples[idx]?.trim() ? samples[idx] : raw;
  });
}
