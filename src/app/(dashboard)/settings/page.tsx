'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { MessageSquare, Tag, User, Mail, Smartphone, Briefcase } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { TemplateManager } from '@/components/settings/template-manager';
import { TagManager } from '@/components/settings/tag-manager';
import { ProfileForm } from '@/components/settings/profile-form';
import { PasswordForm } from '@/components/settings/password-form';
import { SessionsCard } from '@/components/settings/sessions-card';
import { WorkspaceSettings } from '@/components/settings/workspace-settings';

const TAB_VALUES = ['profile', 'workspace', 'templates', 'tags'] as const;
type TabValue = (typeof TAB_VALUES)[number];

function isTabValue(v: string | null): v is TabValue {
  return !!v && (TAB_VALUES as readonly string[]).includes(v);
}

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const queryTab = searchParams.get('tab');
  const tab: TabValue = isTabValue(queryTab) ? queryTab : 'profile';

  const onChange = (next: TabValue) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', next);
    router.replace(`/settings?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-sm text-slate-400 mt-1">
          Manage your profile, workspace & team members, message templates, and tags.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => onChange(v as TabValue)}>
        <TabsList className="bg-slate-900 border border-slate-700">
          <TabsTrigger value="profile" className="data-active:bg-slate-800 data-active:text-[#00aef0] text-slate-400">
            <User className="size-4 mr-2" /> Profile
          </TabsTrigger>
          <TabsTrigger value="workspace" className="data-active:bg-slate-800 data-active:text-[#00aef0] text-slate-400">
            <Briefcase className="size-4 mr-2" /> Workspace & Team
          </TabsTrigger>
          <TabsTrigger value="templates" className="data-active:bg-slate-800 data-active:text-[#00aef0] text-slate-400">
            <MessageSquare className="size-4 mr-2" /> Templates
          </TabsTrigger>
          <TabsTrigger value="tags" className="data-active:bg-slate-800 data-active:text-[#00aef0] text-slate-400">
            <Tag className="size-4 mr-2" /> Tags
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'profile' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <ProfileForm />
          <PasswordForm />
          <SessionsCard />
        </div>
      )}

      {tab === 'workspace' && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <WorkspaceSettings />
        </div>
      )}

      {tab === 'templates' && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <Tabs defaultValue="whatsapp">
            <TabsList className="bg-slate-900 border border-slate-800 mb-2">
              <TabsTrigger value="whatsapp" className="data-active:bg-slate-800 data-active:text-[#00aef0] text-slate-400">WhatsApp Templates</TabsTrigger>
              <TabsTrigger value="email" className="data-active:bg-slate-800 data-active:text-[#00aef0] text-slate-400">Email Templates</TabsTrigger>
              <TabsTrigger value="sms" className="data-active:bg-slate-800 data-active:text-[#00aef0] text-slate-400">SMS Templates</TabsTrigger>
            </TabsList>
            
            <TabsContent value="whatsapp" className="mt-0">
              <TemplateManager />
            </TabsContent>
            
            <TabsContent value="email" className="mt-4">
              <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-12 text-center">
                <Mail className="mx-auto h-12 w-12 text-slate-600 mb-4" />
                <h3 className="text-xl font-medium text-white mb-2">Email Builder</h3>
                <p className="text-slate-400">Visual drag-and-drop builder for email templates is arriving in the next update.</p>
              </div>
            </TabsContent>
            
            <TabsContent value="sms" className="mt-4">
              <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-12 text-center">
                <Smartphone className="mx-auto h-12 w-12 text-slate-600 mb-4" />
                <h3 className="text-xl font-medium text-white mb-2">SMS Sequences</h3>
                <p className="text-slate-400">Character-limited SMS templates and drip sequences are arriving in the next update.</p>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}

      {tab === 'tags' && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <TagManager />
        </div>
      )}
    </div>
  );
}
