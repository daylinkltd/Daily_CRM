'use client';

import { useMemo, useState, useEffect, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { SettingsRail } from '@/components/settings/settings-rail';
import { SettingsOverview } from '@/components/settings/settings-overview';
import { ProfileForm } from '@/components/settings/profile-form';
import { SecurityPanel } from '@/components/settings/security-panel';
import { AppearancePanel } from '@/components/settings/appearance-panel';
import { WhatsAppConfig } from '@/components/settings/whatsapp-config';
import { ChatbotConfig } from '@/components/settings/chatbot-config';
import { TemplateManager } from '@/components/settings/template-manager';
import { FieldsAndTagsPanel } from '@/components/settings/fields-and-tags-panel';
import { DealsSettings } from '@/components/settings/deals-settings';
import { MembersTab } from '@/components/settings/members-tab';
import { RolesPanel } from '@/components/settings/roles-panel';
import { ApiKeysSettings } from '@/components/settings/api-keys-settings';
import { CatalogSettings } from '@/components/settings/catalog-settings';
import { BrandingSettings } from '@/components/settings/branding-settings';
import { BillingPanel } from '@/components/settings/billing-panel';
import { HRSettingsPanel } from '@/components/settings/hr-settings-panel';
import RetailSettingsPage from '@/app/(dashboard)/settings/retail/page';
import {
  resolveSection,
  type SettingsSection,
} from '@/components/settings/settings-sections';
import { PageHeader } from '@/components/ui/page-header';

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { defaultCurrency } = useAuth();
  const { mode } = useTheme();

  const [section, setSection] = useState<SettingsSection>(() =>
    resolveSection(searchParams.get('tab'))
  );

  useEffect(() => {
    const nextSection = resolveSection(searchParams.get('tab'));
    setSection(nextSection);
  }, [searchParams]);

  const go = (next: SettingsSection) => {
    setSection(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', next);
    router.replace(`/settings?${params.toString()}`, { scroll: false });
  };

  // Cheap, fetch-free rail hints. The Overview landing carries the
  // full live status/counts; the rail just surfaces the two that are
  // already in context.
  const hints: Partial<Record<SettingsSection, ReactNode>> = useMemo(
    () => ({
      appearance: mode.charAt(0).toUpperCase() + mode.slice(1),
      deals: defaultCurrency,
    }),
    [mode, defaultCurrency],
  );

  const renderPanel = () => {
    switch (section) {
      case 'overview':
        return <SettingsOverview onSelect={go} />;
      case 'profile':
        return <ProfileForm />;
      case 'security':
        return <SecurityPanel />;
      case 'appearance':
        return <AppearancePanel />;
      case 'whatsapp':
        return <WhatsAppConfig />;
      case 'chatbot':
        return <ChatbotConfig />;
      case 'templates':
        return <TemplateManager />;
      case 'fields':
        return <FieldsAndTagsPanel />;
      case 'deals':
        return <DealsSettings />;
      case 'members':
        return <MembersTab />;
      case 'roles':
        return <RolesPanel />;
      case 'billing':
        return <BillingPanel />;
      case 'api':
        return <ApiKeysSettings />;
      case 'catalog':
        return <CatalogSettings />;
      case 'branding':
        return <BrandingSettings />;
      case 'hr':
        return <HRSettingsPanel />;
      case 'retail':
        return <RetailSettingsPage />;
      default:
        return <SettingsOverview onSelect={go} />;
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Settings"
        description="Everything in one place — your account and your workspace. Pick a section to manage it."
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[236px_minmax(0,1fr)] lg:items-start">
        <SettingsRail active={section} onSelect={go} hints={hints} />
        <div className="min-w-0">{renderPanel()}</div>
      </div>
    </div>
  );
}
