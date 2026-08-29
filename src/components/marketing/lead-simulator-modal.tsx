'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useCalendarStore } from '@/lib/calendar/store';
import { SOCIAL_PLATFORM_ICONS } from '@/components/calendar/social-icons';
import type { SocialPlatform, LeadTemperature, LeadIntent } from '@/types/calendar';
import {
  Bot,
  Zap,
  Flame,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  User,
  Building2,
  Mail,
  Phone,
  Sparkles,
  Layers,
  Filter,
  Tag,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { NativeSelect } from "@/components/ui/native-select";
import { RichTextArea } from "@/components/ui/rich-textarea";

interface LeadSimulatorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PRESET_SCENARIOS = [
  {
    title: '🔥 High Intent: Pricing Question (Rahul Sharma)',
    platform: 'instagram' as SocialPlatform,
    authorName: 'Rahul Sharma',
    authorEmail: 'rahul.sharma@growthventures.io',
    authorPhone: '+919876543210',
    message: 'How much does Daily CRM cost for a 10-person retail team? Need WhatsApp billing.',
    campaignName: 'Small Business Growth',
    contentTitle: 'Stop Losing Customers',
    expected: 'Classified as HOT Lead (Pricing Intent) → Updates/Creates CRM Contact with journey tags',
  },
  {
    title: '🔥 High Intent: Live Demo Request (Sarah Jenkins)',
    platform: 'linkedin' as SocialPlatform,
    authorName: 'Sarah Jenkins',
    authorEmail: 'sarah.j@abccorp.com',
    authorPhone: '+14155552671',
    message: 'Can our sales team get a personalized demo for pipeline workflows this Friday?',
    campaignName: 'Q3 Enterprise Growth Sprint',
    contentTitle: 'Unifying WhatsApp and Sales Pipelines',
    expected: 'Classified as HOT Lead (Demo Request) → Updates CRM Contact & assigns to Sales',
  },
  {
    title: '💬 Non-Lead: Generic Praise / Social Engagement',
    platform: 'instagram' as SocialPlatform,
    authorName: 'Alex Casual',
    message: 'Awesome design! Love this! 🔥👏',
    campaignName: 'Small Business Growth',
    contentTitle: 'Stop Losing Customers',
    expected: 'Classified as Engagement Only → Recorded in Social Analytics, Filtered from CRM Contacts',
  },
  {
    title: '⚡ Multi-Touch Conversion: Website Form Submission',
    platform: 'website' as const,
    authorName: 'Rahul Sharma',
    authorEmail: 'rahul.sharma@growthventures.io',
    authorPhone: '+919876543210',
    message: 'Form submitted on /pricing page (UTM: utm_source=instagram&utm_campaign=small-business-growth)',
    campaignName: 'Small Business Growth',
    contentTitle: 'Stop Losing Customers',
    expected: 'Duplicate matched by email → Appends 5th touchpoint to existing Rahul Sharma timeline',
  },
];

export function LeadSimulatorModal({ open, onOpenChange }: LeadSimulatorModalProps) {
  const store = useCalendarStore();
  const [platform, setPlatform] = useState<string>('instagram');
  const [authorName, setAuthorName] = useState('Rahul Sharma');
  const [authorEmail, setAuthorEmail] = useState('rahul.sharma@growthventures.io');
  const [authorPhone, setAuthorPhone] = useState('+919876543210');
  const [campaignName, setCampaignName] = useState('Small Business Growth');
  const [messageText, setMessageText] = useState('How much does this cost for a 10-person retail team?');
  const [simResult, setSimResult] = useState<{
    isLead: boolean;
    intent?: LeadIntent;
    temperature?: LeadTemperature;
    scoreDelta?: number;
    reason?: string;
    contact?: any;
  } | null>(null);

  const handleRunSimulation = () => {
    const result = store.classifyAndProcessEngagement({
      platform,
      authorName,
      authorEmail: authorEmail.trim() || undefined,
      authorPhone: authorPhone.trim() || undefined,
      campaignName,
      message: messageText,
    });

    setSimResult(result);
  };

  const handleApplyPreset = (preset: typeof PRESET_SCENARIOS[0]) => {
    setPlatform(preset.platform);
    setAuthorName(preset.authorName);
    setAuthorEmail(preset.authorEmail || '');
    setAuthorPhone(preset.authorPhone || '');
    setMessageText(preset.message);
    setCampaignName(preset.campaignName);
    setSimResult(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl p-6">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Bot className="h-4 w-4" />
            </div>
            <DialogTitle className="text-lg font-black text-foreground">
              Intelligent Lead Attribution & AI Intent Classifier
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Test how inbound marketing interactions (comments, DMs, clicks, and form submissions) are evaluated by the AI
            engine to filter engagement vs. auto-create qualified CRM contacts with structured attribution.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Presets Row */}
          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
              Test Pre-Configured Scenarios:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PRESET_SCENARIOS.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleApplyPreset(p)}
                  className="text-left p-3 rounded-2xl border border-border bg-card hover:border-primary/50 hover:bg-primary/5 transition-all text-foreground group"
                >
                  <p className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                    {p.title}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{p.expected}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Input Form Grid */}
          <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-extrabold uppercase text-muted-foreground block mb-1">
                  Inbound Channel / Platform
                </label>
                <NativeSelect
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  className="w-full h-9 px-3 text-xs rounded-xl bg-background border border-border font-medium text-foreground"
                >
                  <option value="instagram">Instagram</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="facebook">Facebook</option>
                  <option value="x">X (Twitter)</option>
                  <option value="website">Website (Form / Landing Page)</option>
                  <option value="whatsapp">WhatsApp Direct</option>
                  <option value="google">Google Organic</option>
                </NativeSelect>
              </div>

              <div>
                <label className="text-[10px] font-extrabold uppercase text-muted-foreground block mb-1">
                  Campaign Association
                </label>
                <Input
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="e.g. Small Business Growth"
                  className="h-9 text-xs rounded-xl bg-background border-border"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-extrabold uppercase text-muted-foreground block mb-1">
                  Sender Name
                </label>
                <Input
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  className="h-9 text-xs rounded-xl bg-background border-border"
                />
              </div>

              <div>
                <label className="text-[10px] font-extrabold uppercase text-muted-foreground block mb-1">
                  Email (Optional for ID matching)
                </label>
                <Input
                  value={authorEmail}
                  onChange={(e) => setAuthorEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="h-9 text-xs rounded-xl bg-background border-border"
                />
              </div>

              <div>
                <label className="text-[10px] font-extrabold uppercase text-muted-foreground block mb-1">
                  Phone (Optional for deduplication)
                </label>
                <Input
                  value={authorPhone}
                  onChange={(e) => setAuthorPhone(e.target.value)}
                  placeholder="+91..."
                  className="h-9 text-xs rounded-xl bg-background border-border"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-extrabold uppercase text-muted-foreground block mb-1">
                Audience Message / Comment / Submission Text
              </label>
              <RichTextArea
                rows={2}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Enter what the person commented or inquired about..."
                className="text-xs rounded-xl bg-background border-border"
              />
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                onClick={handleRunSimulation}
                className="h-9 px-4 text-xs font-bold rounded-xl gap-2 bg-primary text-primary-foreground shadow-sm"
              >
                <Sparkles className="h-4 w-4" /> Run AI Lead Classifier & Attribution
              </Button>
            </div>
          </div>

          {/* Simulation Output Card */}
          {simResult && (
            <div
              className={cn(
                'rounded-2xl border p-4 space-y-3 animate-in fade-in duration-200',
                simResult.isLead
                  ? 'border-emerald-500/30 bg-emerald-500/5'
                  : 'border-slate-500/30 bg-slate-500/5'
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {simResult.isLead ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-slate-500" />
                  )}
                  <h4 className="text-sm font-black text-foreground">
                    {simResult.isLead
                      ? 'AI Result: Qualified CRM Lead Detected & Attributed!'
                      : 'AI Result: General Social Engagement Filtered'}
                  </h4>
                </div>

                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[10px] font-black uppercase tracking-wider',
                      simResult.temperature === 'hot'
                        ? 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                        : simResult.temperature === 'warm'
                        ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                        : 'bg-slate-500/10 text-slate-600 border-slate-500/20'
                    )}
                  >
                    Temperature: {simResult.temperature?.toUpperCase()}
                  </Badge>
                  {simResult.intent && (
                    <Badge variant="outline" className="text-[10px] font-bold capitalize bg-primary/10 text-primary border-primary/20">
                      Intent: {simResult.intent.replace('_', ' ')}
                    </Badge>
                  )}
                </div>
              </div>

              {simResult.isLead && simResult.contact && (
                <div className="space-y-3 pt-1 text-xs">
                  {/* Attribution Breakdown */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="p-2.5 rounded-xl bg-background border border-border">
                      <span className="text-[9px] text-muted-foreground uppercase font-bold block">Lead Source</span>
                      <strong className="text-foreground capitalize">{simResult.contact.marketing_attribution?.source}</strong>
                    </div>
                    <div className="p-2.5 rounded-xl bg-background border border-border">
                      <span className="text-[9px] text-muted-foreground uppercase font-bold block">Campaign</span>
                      <strong className="text-primary truncate block">{simResult.contact.marketing_attribution?.campaign}</strong>
                    </div>
                    <div className="p-2.5 rounded-xl bg-background border border-border">
                      <span className="text-[9px] text-muted-foreground uppercase font-bold block">First / Last Touch</span>
                      <span className="text-[11px] text-foreground font-medium truncate block">
                        {simResult.contact.marketing_attribution?.firstTouch} → {simResult.contact.marketing_attribution?.lastTouch}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-background border border-border">
                      <span className="text-[9px] text-muted-foreground uppercase font-bold block">Lead Score</span>
                      <strong className="text-emerald-500 text-sm">
                        {simResult.contact.marketing_attribution?.leadScore} / 100
                      </strong>
                    </div>
                  </div>

                  {/* Auto generated tags */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-extrabold text-muted-foreground uppercase">
                      Auto-Applied Attribution Tags:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {simResult.contact.tags?.map((t: string) => (
                        <span
                          key={t}
                          className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-background border border-border text-foreground font-mono"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Journey Touchpoints count */}
                  <div className="text-[11px] text-muted-foreground flex items-center justify-between border-t border-border/80 pt-2">
                    <span>
                      Customer Journey: <strong>{simResult.contact.marketing_attribution?.touchpoints?.length || 1} touchpoints recorded</strong> (Duplicate prevention preserved history)
                    </span>
                    <a
                      href="/contacts"
                      className="text-primary font-bold hover:underline flex items-center gap-1"
                    >
                      View in CRM Contacts <ArrowRight className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              )}

              {!simResult.isLead && (
                <p className="text-xs text-muted-foreground">
                  The AI detected this interaction as generic social engagement without commercial purchase intent. It has been routed to <strong>Social Analytics metrics</strong> without cluttering your CRM contact pipeline.
                </p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
