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
