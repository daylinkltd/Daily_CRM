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
import { CopyFromWorkspacePanel } from '@/components/settings/copy-from-workspace-panel';
import { IdentifiersPanel } from '@/components/settings/identifiers-panel';
import { BillingPanel } from '@/components/settings/billing-panel';
import { ModulesPanel } from '@/components/settings/modules-panel';
import { HRSettingsPanel } from '@/components/settings/hr-settings-panel';
import { TemplateLibraryPanel } from '@/components/settings/template-library-panel';
import { AttendancePolicyPanel } from '@/components/settings/attendance-policy-panel';
import RetailSettingsPage from '@/app/(dashboard)/settings/retail/page';
import { CRMSettingsPanel } from '@/components/settings/crm-settings-panel';
import { AccountingSettingsPanel } from '@/components/settings/accounting-settings-panel';
import { ProjectsSettingsPanel } from '@/components/settings/projects-settings-panel';
import {
  resolveSection,
  type SettingsSection,
} from '@/components/settings/settings-sections';
import { PageHeader } from '@/components/ui/page-header';
import { SettingsSubtabs } from '@/components/settings/settings-subtabs';
import { LetterheadDesigner } from '@/components/documents/letterhead-designer';
import { TimesheetTemplatesManager } from '@/components/settings/timesheet-templates-manager';

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { defaultCurrency } = useAuth();
  const { mode } = useTheme();

  // The raw value is kept alongside the resolved section so a folded
  // section (?tab=security) can open its parent on the right sub-tab.
  const rawTab = searchParams.get('tab');
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
      profile: mode.charAt(0).toUpperCase() + mode.slice(1),
      crm: defaultCurrency,
    }),
    [mode, defaultCurrency],
  );

  const renderPanel = () => {
    switch (section) {
      case 'overview':
        return <SettingsOverview onSelect={go} />;
      case 'profile':
        return (
          <SettingsSubtabs
            initialTab={rawTab === 'security' || rawTab === 'appearance' ? rawTab : undefined}
            tabs={[
              { id: 'profile', label: 'Profile', render: () => <ProfileForm /> },
              { id: 'security', label: 'Security', render: () => <SecurityPanel /> },
              { id: 'appearance', label: 'Appearance', render: () => <AppearancePanel /> },
            ]}
          />
        );
      case 'crm':
        return (
          <SettingsSubtabs
            initialTab={
              rawTab === 'deals' || rawTab === 'fields' || rawTab === 'tags' ? rawTab : undefined
            }
            tabs={[
              { id: 'crm-general', label: 'General', render: () => <CRMSettingsPanel /> },
              { id: 'deals', label: 'Deals', render: () => <DealsSettings /> },
              { id: 'fields', label: 'Fields & tags', render: () => <FieldsAndTagsPanel /> },
            ]}
          />
        );
      case 'accounting':
        return <AccountingSettingsPanel />;
      case 'projects':
        return <ProjectsSettingsPanel />;
      case 'whatsapp':
        return (
          <SettingsSubtabs
            initialTab={
              rawTab === 'chatbot' || rawTab === 'whatsapp-templates' ? rawTab : undefined
            }
            tabs={[
              { id: 'whatsapp', label: 'Connection', render: () => <WhatsAppConfig /> },
              { id: 'chatbot', label: 'Chatbot', render: () => <ChatbotConfig /> },
              {
                id: 'whatsapp-templates',
                label: 'Meta approvals',
                render: () => <TemplateManager />,
              },
            ]}
          />
        );
      case 'templates':
        return <TemplateLibraryPanel />;
      case 'members':
        return (
          <SettingsSubtabs
            initialTab={rawTab === 'roles' || rawTab === 'permissions' ? 'roles' : undefined}
            tabs={[
              { id: 'members-list', label: 'Members', render: () => <MembersTab /> },
              { id: 'roles', label: 'Roles & permissions', render: () => <RolesPanel /> },
            ]}
          />
        );
      case 'modules':
        return <ModulesPanel />;
      case 'billing':
        return <BillingPanel />;
      case 'api':
        return <ApiKeysSettings />;
      case 'catalog':
        return <CatalogSettings />;
      case 'branding':
        return (
          <SettingsSubtabs
            initialTab={rawTab === 'letterhead' ? 'letterhead' : undefined}
            tabs={[
              {
                id: 'branding',
                label: 'Company details',
                render: () => (
                  <div className="space-y-6">
                    <BrandingSettings />
                    {/* Renders nothing unless there is another workspace
                        this person manages to copy from. */}
                    <CopyFromWorkspacePanel />
                    {/* Tenant/workspace/user/member IDs in one place —
                        the identifiers every API call and support ticket
                        needs, without opening devtools. */}
                    <IdentifiersPanel />
                  </div>
                ),
              },
              {
                id: 'letterhead',
                label: 'Letterhead',
                render: () => <LetterheadDesigner />,
              },
            ]}
          />
        );
      case 'hr':
        return (
          <SettingsSubtabs
            initialTab={
              rawTab === 'attendance' || rawTab === 'timesheet-templates' ? rawTab : undefined
            }
            tabs={[
              { id: 'hr', label: 'Shifts, leave & payroll', render: () => <HRSettingsPanel /> },
              {
                id: 'attendance',
                label: 'Attendance & locations',
                render: () => <AttendancePolicyPanel />,
              },
              {
                id: 'timesheet-templates',
                label: 'Timesheet templates',
                render: () => <TimesheetTemplatesManager canEdit />,
              },
            ]}
          />
        );
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
