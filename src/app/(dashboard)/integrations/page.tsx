'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { MessageSquare, ArrowLeft, Mail, Smartphone, FileSpreadsheet, FormInput } from 'lucide-react';
import { WhatsAppConfig } from '@/components/settings/whatsapp-config';
import { InstagramConfig } from '@/components/settings/instagram-config';
import { MessengerConfig } from '@/components/settings/messenger-config';
import { EmailConfig } from '@/components/settings/email-config';
import { SmsConfig } from '@/components/settings/sms-config';
import { SheetsConfig } from '@/components/settings/sheets-config';
import { FormsConfig } from '@/components/settings/forms-config';
import { Button } from '@/components/ui/button';

export default function IntegrationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const tab = searchParams.get('tab');

  const onChange = (next: string | null) => {
    if (next) {
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', next);
      router.replace(`/integrations?${params.toString()}`, { scroll: false });
    } else {
      router.replace(`/integrations`, { scroll: false });
    }
  };

  const isConfigView = ['whatsapp', 'instagram', 'messenger', 'email', 'sms', 'google', 'zoho', 'sheets', 'forms'].includes(tab ?? '');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Integrations</h1>
        <p className="text-sm text-slate-400 mt-1">
          Connect your Daily CRM workspace to external communication platforms and data sources.
        </p>
      </div>

      {!isConfigView ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {[
            { id: 'whatsapp', name: 'WhatsApp Business', desc: 'Connect WhatsApp API', icon: MessageSquare },
            { id: 'instagram', name: 'Instagram DMs', desc: 'Connect IG Graph API', icon: MessageSquare },
            { id: 'messenger', name: 'Messenger', desc: 'Connect Facebook Pages', icon: MessageSquare },
            { id: 'email', name: 'Email (SMTP/OAuth)', desc: 'Connect Google, Outlook, Zoho, SES', icon: Mail },
            { id: 'sms', name: 'SMS Gateway', desc: 'Connect Twilio', icon: Smartphone },
            { id: 'sheets', name: 'Google Sheets', desc: '2-way Sync with Sheets', icon: FileSpreadsheet },
            { id: 'forms', name: 'Lead Forms', desc: 'Google Forms, FB Forms, Webhooks', icon: FormInput },
          ].map(integration => (
            <div key={integration.id} onClick={() => onChange(integration.id)} className="cursor-pointer group flex flex-col items-center p-6 rounded-2xl bg-slate-900 border border-slate-800 text-center hover:border-[#00aef0]/50 hover:bg-slate-800/50 transition-all">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#00aef0]/10 mb-4 group-hover:scale-110 transition-transform">
                <integration.icon className="h-6 w-6 text-[#00aef0]" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-1">{integration.name}</h3>
              <p className="text-slate-400 text-sm mb-4">{integration.desc}</p>
              <Button variant="outline" className="w-full border-slate-700 text-slate-300 group-hover:bg-[#00aef0] group-hover:text-white group-hover:border-[#00aef0]">
                Configure
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
          <Button variant="ghost" onClick={() => onChange(null)} className="text-slate-400 hover:text-white mb-2">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Integrations
          </Button>
          
          {tab === 'whatsapp' && <WhatsAppConfig />}
          {tab === 'instagram' && <InstagramConfig />}
          {tab === 'messenger' && <MessengerConfig />}
          {tab === 'email' && <EmailConfig />}
          {tab === 'sms' && <SmsConfig />}
          {tab === 'sheets' && <SheetsConfig />}
          {tab === 'forms' && <FormsConfig />}
          
          {/* Placeholders for remaining requested integrations */}
          {['google', 'zoho'].includes(tab || '') && (
            <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-8 text-center">
              <FileSpreadsheet className="mx-auto h-8 w-8 text-[#00aef0] mb-3" />
              <h3 className="text-lg font-medium text-white mb-1">Coming Soon</h3>
              <p className="text-slate-400 text-sm">OAuth flow and configuration parameters are currently being implemented.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
