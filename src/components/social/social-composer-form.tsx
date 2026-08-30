"use client";

import React, { useState, useEffect } from 'react';
import type { SocialPost, SocialPlatform, PlatformContentOverride, PostStatus, UserRole } from '@/types/calendar';
import { SOCIAL_PLATFORM_ICONS } from '@/components/calendar/social-icons';
import { SocialPlatformPreview } from '@/components/social/platform-previews';
import {
  Sparkles,
  Send,
  Calendar,
  Layers,
  Upload,
  Image as ImageIcon,
  Video,
  X,
  Plus,
  Trash2,
  RefreshCw,
  Link2,
  Hash,
  MessageSquare,
  Eye,
  FileText,
  Building,
  UserCheck,
  Handshake,
  Check,
  Rocket,
  CheckCircle2,
  FolderPlus,
  SlidersHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useWorkspace } from '@/hooks/use-workspace';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { NativeSelect } from "@/components/ui/native-select";

interface SocialComposerFormProps {
  initialPost?: SocialPost | null;
  currentUserRole?: UserRole;
  currentUserId?: string;
  onSave: (data: Partial<SocialPost>, action: PostStatus | 'publish_now') => void;
  onCancel?: () => void;
  isFullPage?: boolean;
}

const ALL_CHANNELS: SocialPlatform[] = [
  'instagram',
  'facebook',
  'linkedin',
  'x',
  'tiktok',
  'youtube',
  'threads',
];

const PRESET_MEDIA = [
  { label: 'Team Collaboration', url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&auto=format&fit=crop&q=80' },
  { label: 'Analytics Dashboard', url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=80' },
  { label: 'Modern Workspace', url: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=800&auto=format&fit=crop&q=80' },
  { label: 'Engineering Sprint', url: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=800&auto=format&fit=crop&q=80' },
  { label: 'Executive Meeting', url: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=800&auto=format&fit=crop&q=80' },
];

const MOCK_CRM_COMPANIES = ['ABC Corporation', 'Acme Logistics', 'Nexus Tech Solutions', 'Global Media Group', 'Vance Capital'];
const MOCK_CRM_DEALS = ['Enterprise SaaS Renewal', 'Fleet Expansion CRM', 'Custom Integration Deal', 'Annual Multi-Seat Contract', 'Workspace Rollout'];
const MOCK_CRM_CONTACTS = ['Sarah Jenkins', 'John Smith', 'Michael Chang', 'Elena Rostova', 'David Vance'];
const MOCK_CRM_PROJECTS = ['Q3 Marketing Launch', 'WhatsApp API Onboarding', 'Enterprise Procurement', 'SOC2 Compliance Setup'];

export function SocialComposerForm({
  initialPost,
  currentUserRole = 'creator',
  currentUserId = 'usr_alex',
  onSave,
  onCancel,
  isFullPage = false,
}: SocialComposerFormProps) {
  const { activeWorkspace } = useWorkspace();
  const [bufferConnected, setBufferConnected] = useState(false);
  const [bufferChannels, setBufferChannels] = useState<any[]>([]);

  useEffect(() => {
    async function checkBuffer() {
      if (!activeWorkspace?.id) return;
      try {
        const res = await fetch(`/api/integrations/buffer/status?workspace_id=${activeWorkspace.id}`);
        if (res.ok) {
          const json = await res.json();
          setBufferConnected(json.isConnected);
          setBufferChannels(json.channels || []);
        }
      } catch (e) {}
    }
    checkBuffer();
  }, [activeWorkspace?.id]);

  // Form State
  const [title, setTitle] = useState('');
  const [selectedChannels, setSelectedChannels] = useState<SocialPlatform[]>(['instagram', 'linkedin']);
  const [defaultCaption, setDefaultCaption] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [hashtagsStr, setHashtagsStr] = useState('');
  const [link, setLink] = useState('');
  const [altText, setAltText] = useState('');
  const [firstComment, setFirstComment] = useState('');
  const [tagsCampaign, setTagsCampaign] = useState('Q3 Growth 2026');
  const [date, setDate] = useState('2026-08-25');
  const [time, setTime] = useState('12:00');
  const [approverId, setApproverId] = useState('usr_vivian');

  // CRM Linkages
  const [crmCompanyName, setCrmCompanyName] = useState('');
  const [crmDealName, setCrmDealName] = useState('');
  const [crmContactName, setCrmContactName] = useState('');
  const [crmProjectName, setCrmProjectName] = useState('');
  const [isCRMExpanded, setIsCRMExpanded] = useState(false);

  // Platform Overrides Tab State ('default' | SocialPlatform)
  const [activeTab, setActiveTab] = useState<string>('default');
  const [platformOverrides, setPlatformOverrides] = useState<Record<string, PlatformContentOverride>>({});

  // Preview Platform
  const [previewPlatform, setPreviewPlatform] = useState<SocialPlatform>('instagram');
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    if (initialPost) {
      setTitle(initialPost.title || '');
      setSelectedChannels(initialPost.channels && initialPost.channels.length > 0 ? initialPost.channels : ['instagram']);
      setDefaultCaption(initialPost.defaultCaption || '');
      setMediaUrl(initialPost.mediaUrl || '');
      setMediaType(initialPost.mediaType || 'image');
      setHashtagsStr(initialPost.hashtags ? initialPost.hashtags.join(' ') : '');
      setLink(initialPost.link || '');
      setAltText(initialPost.altText || '');
      setFirstComment(initialPost.firstComment || '');
      setTagsCampaign(initialPost.tagsCampaign || '');
      setDate(initialPost.date || '2026-08-25');
      setTime(initialPost.time || '12:00');
      setApproverId(initialPost.approverId || 'usr_vivian');
      setPlatformOverrides(initialPost.platformOverrides || {});
      setCrmCompanyName(initialPost.crmCompanyName || '');
      setCrmDealName(initialPost.crmDealName || '');
      setCrmContactName(initialPost.crmContactName || '');
      setCrmProjectName(initialPost.crmProjectName || '');
      if (initialPost.channels && initialPost.channels.length > 0) {
        setPreviewPlatform(initialPost.channels[0]);
      }
    } else {
      setTitle('');
      setSelectedChannels(['instagram', 'linkedin', 'x']);
      setDefaultCaption('Transform your customer workflows this quarter! 🚀 Discover how Daily CRM unifies WhatsApp, sales pipelines, and automated customer journeys into one dashboard.');
      setMediaUrl(PRESET_MEDIA[0].url);
      setMediaType('image');
      setHashtagsStr('#DailyCRM #Growth #Marketing #Omnichannel');
      setLink('https://dailybuz.com');
      setAltText('Daily CRM modern workspace interface');
      setFirstComment('Link in bio to claim your 14-day free workspace trial! ✨');
      setTagsCampaign('Q3 Growth 2026');
      setDate('2026-08-25');
      setTime('12:00');
      setApproverId('usr_vivian');
      setPlatformOverrides({
        linkedin: {
          platform: 'linkedin',
          caption: 'Managing customer conversations across WhatsApp, Email, and Social Media shouldn\'t be chaotic. Daily CRM keeps your whole team aligned with one unified inbox and automated pipeline stages.',
        },
        x: {
          platform: 'x',
          caption: 'Stop tab-switching! Daily CRM unifies WhatsApp, Email, and sales pipelines in real-time. 💬⚡',
        },
      });
      setCrmCompanyName('ABC Corporation');
      setCrmDealName('Enterprise SaaS Renewal');
      setCrmContactName('Sarah Jenkins');
      setCrmProjectName('Q3 Marketing Launch');
    }
  }, [initialPost]);

  const toggleChannel = (ch: SocialPlatform) => {
    if (selectedChannels.includes(ch)) {
      if (selectedChannels.length === 1) {
        toast.error('At least one platform channel must be selected.');
        return;
      }
      const next = selectedChannels.filter((c) => c !== ch);
      setSelectedChannels(next);
      if (previewPlatform === ch && next.length > 0) {
        setPreviewPlatform(next[0]);
      }
      if (activeTab === ch) {
        setActiveTab('default');
      }
    } else {
      const next = [...selectedChannels, ch];
      setSelectedChannels(next);
      setPreviewPlatform(ch);
    }
  };

  const handleOverrideChange = (ch: SocialPlatform, field: keyof PlatformContentOverride, val: string) => {
    setPlatformOverrides((prev) => {
      const existing = prev[ch] || { platform: ch };
      return {
        ...prev,
        [ch]: { ...existing, [field]: val },
      };
    });
  };

  const parseHashtags = (raw: string): string[] => {
    return raw
      .split(/[\s,]+/)
      .filter((tag) => tag.length > 0)
      .map((t) => (t.startsWith('#') ? t : `#${t}`));
  };

  // Mock File Drag & Drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    // Simulate setting chosen file
    const randomPreset = PRESET_MEDIA[Math.floor(Math.random() * PRESET_MEDIA.length)];
    setMediaUrl(randomPreset.url);
    toast.success('Media file uploaded successfully!');
  };

  const handleAction = (targetAction: PostStatus | 'publish_now') => {
    if (!title.trim()) {
      toast.error('Please enter a post title.');
      return;
    }
    if (!defaultCaption.trim()) {
      toast.error('Please enter a main caption.');
      return;
    }

    const payload: Partial<SocialPost> = {
      title,
      channels: selectedChannels,
      defaultCaption,
      mediaUrl: mediaUrl.trim() || undefined,
      mediaType,
      hashtags: parseHashtags(hashtagsStr),
      link: link.trim() || undefined,
      altText: altText.trim() || undefined,
      firstComment: firstComment.trim() || undefined,
      tagsCampaign: tagsCampaign.trim() || undefined,
      date: date || undefined,
      time: time || '12:00',
      approverId,
      approverName: approverId === 'admin' ? 'Administrator' : 'Marketing Reviewer',
      crmCompanyName: crmCompanyName.trim() || undefined,
      crmDealName: crmDealName.trim() || undefined,
      crmContactName: crmContactName.trim() || undefined,
      crmProjectName: crmProjectName.trim() || undefined,
      platformOverrides,
    };

    onSave(payload, targetAction);
  };

  // Current preview object
  const currentPostForPreview: Partial<SocialPost> = {
    title,
    channels: selectedChannels,
    defaultCaption,
    mediaUrl,
    mediaType,
    hashtags: parseHashtags(hashtagsStr),
    link,
    firstComment,
    altText,
    date,
    time,
    creatorName: initialPost?.creatorName || 'Current User',
    creatorAvatar: initialPost?.creatorAvatar,
    platformOverrides,
  };

  // Governance: check if publish now is allowed
  const isPostApproved = initialPost?.status === 'approved';
  const isAdmin = currentUserRole === 'admin';
  const canPublishNow = isPostApproved || isAdmin;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* LEFT COLUMN: Composer Form */}
      <div className="lg:col-span-7 space-y-5">
        {/* Title & Channels Selection */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm">
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Post Title <span className="text-red-500">*</span></span>
              <span className="text-[10px] font-medium text-muted-foreground">Internal campaign identifier</span>
            </label>
            <Input
              type="text"
              placeholder="e.g. Q3 Growth Campaign Launch — Omnichannel Features"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-10 rounded-xl font-bold text-sm"
            />
          </div>

          {/* Multi-Platform Channel Selector */}
          <div className="space-y-2 pt-1">
            <label className="text-xs font-black uppercase tracking-wider text-muted-foreground block">
              Target Channels ({selectedChannels.length} selected)
            </label>
            <div className="flex flex-wrap gap-2">
              {ALL_CHANNELS.map((ch) => {
                const isSelected = selectedChannels.includes(ch);
                const meta = SOCIAL_PLATFORM_ICONS[ch];
                const IconComp = meta.icon;

                return (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => toggleChannel(ch)}
                    className={cn(
                      'flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-all border shadow-sm',
                      isSelected
                        ? `${meta.color} ring-2 ring-primary/20 shadow-md`
                        : 'bg-background text-muted-foreground border-border hover:border-foreground/30'
                    )}
                  >
                    <IconComp className="h-4 w-4" />
                    <span className="capitalize">{ch}</span>
                    {isSelected && <Check className="h-3.5 w-3.5 ml-1" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Multi-Platform Caption & Content Customization */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <h3 className="text-xs font-black uppercase tracking-wider text-foreground">
                Platform-Specific Content
              </h3>
            </div>

            {/* Platform override tabs */}
            <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border overflow-x-auto max-w-[340px]">
              <button
                type="button"
                onClick={() => { setActiveTab('default'); setPreviewPlatform(selectedChannels[0] || 'instagram'); }}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0',
                  activeTab === 'default'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Default
              </button>
              {selectedChannels.map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => { setActiveTab(ch); setPreviewPlatform(ch); }}
                  className={cn(
                    'flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold transition-all capitalize shrink-0',
                    activeTab === ch
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <span>{ch}</span>
                  {platformOverrides[ch]?.caption && (
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Active Tab Form */}
          {activeTab === 'default' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-foreground">
                  Default Main Caption <span className="text-red-500">*</span>
                </label>
                <span className="text-[10px] text-muted-foreground">
                  {defaultCaption.length} characters
                </span>
              </div>
              <Textarea
                rows={4}
                placeholder="Write your main social post caption..."
                value={defaultCaption}
                onChange={(e) => setDefaultCaption(e.target.value)}
                className="rounded-xl text-xs font-medium leading-relaxed resize-y"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-primary/10 border border-primary/20 rounded-xl px-3 py-2 text-xs text-primary font-bold">
                <span>Customizing specifically for <span className="capitalize font-black">{activeTab}</span></span>
                <button
                  type="button"
                  onClick={() => {
                    setPlatformOverrides((prev) => {
                      const next = { ...prev };
                      delete next[activeTab];
                      return next;
                    });
                    toast.info(`Reset override for ${activeTab}`);
                  }}
                  className="text-[10px] font-bold text-red-500 hover:underline"
                >
                  Reset to Default
                </button>
              </div>

              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-foreground capitalize">
                  {activeTab} Custom Caption
                </label>
                <span className="text-[10px] text-muted-foreground">
                  {(platformOverrides[activeTab]?.caption ?? defaultCaption).length} characters
                </span>
              </div>
              <Textarea
                rows={4}
                placeholder={`Write tailored caption for ${activeTab} (e.g. punchy short copy for X, professional tone for LinkedIn)...`}
                value={platformOverrides[activeTab]?.caption ?? defaultCaption}
                onChange={(e) => handleOverrideChange(activeTab as SocialPlatform, 'caption', e.target.value)}
                className="rounded-xl text-xs font-medium leading-relaxed resize-y"
              />
            </div>
          )}

          {/* Hashtags & First Comment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground flex items-center gap-1">
                <Hash className="h-3.5 w-3.5 text-primary" /> Hashtags
              </label>
              <Input
                type="text"
                placeholder="#DailyCRM #Sales #Growth"
                value={hashtagsStr}
                onChange={(e) => setHashtagsStr(e.target.value)}
                className="h-9 rounded-xl text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground flex items-center gap-1">
                <MessageSquare className="h-3.5 w-3.5 text-primary" /> First Comment (IG/LinkedIn)
              </label>
              <Input
                type="text"
                placeholder="e.g. Link in bio for workspace free trial!"
                value={firstComment}
                onChange={(e) => setFirstComment(e.target.value)}
                className="h-9 rounded-xl text-xs"
              />
            </div>
          </div>
        </div>

        {/* Media Upload Area (Mock UI with Drag and Drop, Presets, Preview, Replace, Remove) */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-primary" />
              <h3 className="text-xs font-black uppercase tracking-wider text-foreground">
                Media Asset
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMediaType('image')}
                className={cn(
                  'px-2.5 py-1 text-xs font-bold rounded-lg transition-all border',
                  mediaType === 'image' ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground'
                )}
              >
                Image
              </button>
              <button
                type="button"
                onClick={() => setMediaType('video')}
                className={cn(
                  'px-2.5 py-1 text-xs font-bold rounded-lg transition-all border',
                  mediaType === 'video' ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground'
                )}
              >
                Video
              </button>
            </div>
          </div>

          {/* Media URL Input or Drag & Drop Zone */}
          {mediaUrl ? (
            <div className="relative rounded-2xl overflow-hidden border border-border bg-muted/30 group">
              <img src={mediaUrl} alt="Selected media" className="w-full h-48 object-cover" />
              <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-xs">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const random = PRESET_MEDIA[Math.floor(Math.random() * PRESET_MEDIA.length)].url;
                    setMediaUrl(random);
                    toast.info('Replaced with alternate media preset');
                  }}
                  className="rounded-xl text-xs font-bold gap-1 bg-background"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Replace
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() => setMediaUrl('')}
                  className="rounded-xl text-xs font-bold gap-1"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Remove
                </Button>
              </div>
            </div>
          ) : (
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              className={cn(
                'flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed transition-colors text-center cursor-pointer',
                isDragOver ? 'border-primary bg-primary/10' : 'border-border bg-muted/10 hover:border-primary/40'
              )}
              onClick={() => {
                setMediaUrl(PRESET_MEDIA[0].url);
                toast.success('Attached image preset');
              }}
            >
              <Upload className="h-8 w-8 text-primary mb-2 opacity-60" />
              <p className="text-xs font-bold text-foreground">Drag and drop images / video here, or click to browse</p>
              <p className="text-[10px] text-muted-foreground mt-1">Supports PNG, JPG, MP4 up to 50MB (Local Mock State)</p>
            </div>
          )}

          {/* Quick presets */}
          <div className="space-y-1.5 pt-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">Sample Media Library:</span>
            <div className="flex flex-wrap gap-2">
              {PRESET_MEDIA.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => { setMediaUrl(preset.url); toast.info(`Selected: ${preset.label}`); }}
                  className={cn(
                    'text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all truncate',
                    mediaUrl === preset.url
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-border text-muted-foreground hover:text-foreground'
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Link and Alt Text */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground flex items-center gap-1">
                <Link2 className="h-3.5 w-3.5 text-primary" /> Destination URL
              </label>
              <Input
                type="text"
                placeholder="https://dailybuz.com/landing-page"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                className="h-9 rounded-xl text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground flex items-center gap-1">
                <Eye className="h-3.5 w-3.5 text-primary" /> Alt Text (Accessibility)
              </label>
              <Input
                type="text"
                placeholder="Describe the image content..."
                value={altText}
                onChange={(e) => setAltText(e.target.value)}
                className="h-9 rounded-xl text-xs"
              />
            </div>
          </div>
        </div>

        {/* Governance & CRM Integration Accordion */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm">
          {/* Approver & Schedule Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <UserCheck className="h-3.5 w-3.5 text-primary" /> Assigned Approver
              </label>
              <NativeSelect
                value={approverId}
                onChange={(e) => setApproverId(e.target.value)}
                className="w-full h-9 rounded-xl border border-border bg-background px-3 text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="admin">Administrator (Full Approval)</option>
                <option value="manager">Marketing Manager</option>
                <option value="reviewer">Content Reviewer</option>
              </NativeSelect>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-primary" /> Schedule Date
              </label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-9 rounded-xl text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                Time (UTC)
              </label>
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="h-9 rounded-xl text-xs font-mono"
              />
            </div>
          </div>

          {/* CRM Integration Section */}
          <div className="border-t border-border pt-4">
            <button
              type="button"
              onClick={() => setIsCRMExpanded(!isCRMExpanded)}
              className="flex items-center justify-between w-full text-xs font-black text-foreground hover:text-primary transition-colors"
            >
              <span className="flex items-center gap-2">
                <Building className="h-4 w-4 text-primary" />
                <span>Link with Daily CRM Entities (Company, Deal, Contact, Campaign)</span>
              </span>
              <span className="text-[10px] text-primary">{isCRMExpanded ? 'Collapse' : 'Expand'}</span>
            </button>

            {isCRMExpanded && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Company</label>
                  <NativeSelect
                    value={crmCompanyName}
                    onChange={(e) => setCrmCompanyName(e.target.value)}
                    className="w-full h-8 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground"
                  >
                    <option value="">None / Unassigned</option>
                    {MOCK_CRM_COMPANIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </NativeSelect>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Active Deal</label>
                  <NativeSelect
                    value={crmDealName}
                    onChange={(e) => setCrmDealName(e.target.value)}
                    className="w-full h-8 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground"
                  >
                    <option value="">None / Unassigned</option>
                    {MOCK_CRM_DEALS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </NativeSelect>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Contact Person</label>
                  <NativeSelect
                    value={crmContactName}
                    onChange={(e) => setCrmContactName(e.target.value)}
                    className="w-full h-8 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground"
                  >
                    <option value="">None / Unassigned</option>
                    {MOCK_CRM_CONTACTS.map((ct) => <option key={ct} value={ct}>{ct}</option>)}
                  </NativeSelect>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Campaign / Project</label>
                  <NativeSelect
                    value={crmProjectName}
                    onChange={(e) => setCrmProjectName(e.target.value)}
                    className="w-full h-8 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground"
                  >
                    <option value="">None / Unassigned</option>
                    {MOCK_CRM_PROJECTS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </NativeSelect>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons Bar (Requirement 9: Save Draft, Preview, Submit for Approval, Schedule, Publish Now) */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleAction('draft')}
              className="h-10 rounded-xl text-xs font-bold gap-1.5"
            >
              <Layers className="h-4 w-4" /> Save Draft
            </Button>
            {onCancel && (
              <Button
                type="button"
                variant="ghost"
                onClick={onCancel}
                className="h-10 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground"
              >
                Cancel
              </Button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={() => handleAction('pending_approval')}
              className="h-10 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-md gap-1.5"
            >
              <Send className="h-4 w-4" /> Submit for Approval
            </Button>

            <Button
              type="button"
              onClick={() => handleAction('scheduled')}
              className="h-10 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl shadow-md gap-1.5"
            >
              <Calendar className="h-4 w-4" /> Schedule Post
            </Button>

            {canPublishNow && (
              <Button
                type="button"
                onClick={() => handleAction('publish_now')}
                className="h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md gap-1.5"
              >
                <Rocket className="h-4 w-4" /> Publish Now
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Live Interactive Platform Preview */}
      <div className="lg:col-span-5 sticky top-6">
        <SocialPlatformPreview
          post={currentPostForPreview}
          selectedPlatform={previewPlatform}
          availablePlatforms={selectedChannels}
          onPlatformChange={(p) => setPreviewPlatform(p)}
          className="min-h-[580px]"
        />
      </div>
    </div>
  );
}
