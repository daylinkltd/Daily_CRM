export interface Plan {
  id: string;
  name: string;
  priceMonthly: number; // excluding GST
  priceYearly: number;  // excluding GST, annual = 2 months free
  maxUsers: number;
  maxWorkspaces: number;
  monthlyMessageAllowance: number;
  features: string[];
  isRecommended: boolean;
  ctaType: 'trial' | 'subscribe' | 'contact';
  razorpayPlanIdMonthly?: string;
  razorpayPlanIdYearly?: string;
}

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free Trial',
    priceMonthly: 0,
    priceYearly: 0,
    maxUsers: 2,
    maxWorkspaces: 1,
    monthlyMessageAllowance: 500, // 500 total messages during trial
    features: [
      '2 users limit',
      '1 workspace limit',
      '500 messages total quota',
      'All channels (WhatsApp, Instagram, Messenger, Email)',
      'Shared inbox',
      'Contacts, pipelines, and forms',
      'Quotations generator',
      'Up to 3 active automations'
    ],
    isRecommended: false,
    ctaType: 'trial'
  },
  {
    id: 'starter',
    name: 'Starter',
    priceMonthly: 799,
    priceYearly: 7990,
    maxUsers: 5,
    maxWorkspaces: 1,
    monthlyMessageAllowance: 2000,
    features: [
      '5 users limit',
      '1 workspace limit',
      '2,000 messages/month',
      'All channels (WhatsApp, Instagram, Messenger, Email)',
      'Unlimited automations',
      'Forms and quotations',
      'Basic broadcasts',
      'Community support'
    ],
    isRecommended: false,
    ctaType: 'subscribe',
    razorpayPlanIdMonthly: 'plan_starter_monthly_placeholder',
    razorpayPlanIdYearly: 'plan_starter_yearly_placeholder'
  },
  {
    id: 'growth',
    name: 'Growth',
    priceMonthly: 1999,
    priceYearly: 19990,
    maxUsers: 15,
    maxWorkspaces: 2,
    monthlyMessageAllowance: 5000,
    features: [
      '15 users limit',
      '2 workspaces limit',
      '5,000 messages/month',
      'Everything in Starter',
      'Analytics and reports',
      'Advanced broadcasts',
      'Priority support',
      'Higher media storage'
    ],
    isRecommended: true,
    ctaType: 'subscribe',
    razorpayPlanIdMonthly: 'plan_growth_monthly_placeholder',
    razorpayPlanIdYearly: 'plan_growth_yearly_placeholder'
  },
  {
    id: 'business',
    name: 'Business',
    priceMonthly: 4999,
    priceYearly: 49990,
    maxUsers: 40,
    maxWorkspaces: 5,
    monthlyMessageAllowance: 15000,
    features: [
      '40 users limit',
      '5 workspaces limit',
      '15,000 messages/month',
      'Everything in Growth',
      'Advanced automations',
      'Role-based access control (RBAC)',
      'Dedicated onboarding call'
    ],
    isRecommended: false,
    ctaType: 'subscribe',
    razorpayPlanIdMonthly: 'plan_business_monthly_placeholder',
    razorpayPlanIdYearly: 'plan_business_yearly_placeholder'
  },
  {
    id: 'custom',
    name: 'Custom',
    priceMonthly: -1, // Contact Sales
    priceYearly: -1,  // Contact Sales
    maxUsers: 999999, // unlimited
    maxWorkspaces: 999999, // unlimited
    monthlyMessageAllowance: 999999, // custom
    features: [
      'Unlimited users',
      'Unlimited workspaces',
      'Custom message quota',
      'Everything in Business',
      'Custom domain deployment',
      'SLA agreement',
      'Dedicated support'
    ],
    isRecommended: false,
    ctaType: 'contact'
  }
];
