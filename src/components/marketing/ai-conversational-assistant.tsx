'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  Wand2,
  Bot,
  User,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  Sliders,
  Layers,
  FileText,
  Share2,
  Target,
  Clock,
  ThumbsUp,
  HelpCircle,
  Zap,
  Check,
  ChevronRight,
  ShieldCheck,
  ChevronDown,
  Building2,
  TrendingUp,
  Tag,
  Flame,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useCalendarStore } from '@/lib/calendar/store';
import { useWorkspace } from '@/hooks/use-workspace';
import { SOCIAL_PLATFORM_ICONS } from '@/components/calendar/social-icons';
import type { SocialPlatform } from '@/types/calendar';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Message {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  timestamp: string;
  options?: Array<{ label: string; value: string; desc?: string; icon?: any }>;
  isRecommendation?: boolean;
  generatedCampaign?: {
    name: string;
    objective: string;
    targetAudience: string;
    platforms: SocialPlatform[];
    cta: string;
    postsCount: number;
    blogIncluded: boolean;
    autoTags: string[];
    utmLink: string;
    posts: Array<{
      title: string;
      caption: string;
      channels: SocialPlatform[];
      date: string;
      time: string;
      platformNote?: string;
    }>;
    blog?: {
      title: string;
      summary: string;
      content: string;
    };
  };
}

const QUICK_START_OPTIONS = [
  {
    label: 'Create a Social Post',
    desc: 'Create a post for Instagram, LinkedIn, Facebook, etc.',
    value: 'create_post',
    icon: Share2,
    color: 'text-sky-500 bg-sky-500/10 border-sky-500/20',
  },
  {
    label: 'Create a Blog',
    desc: 'Write an SEO-friendly article for thought leadership.',
    value: 'create_blog',
    icon: FileText,
    color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20',
  },
  {
    label: 'Create a Campaign',
    desc: 'Plan a complete multi-channel marketing campaign.',
    value: 'create_campaign',
    icon: Target,
    color: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
  },
  {
    label: 'Generate Leads',
    desc: 'Find the best way to attract high-intent potential customers.',
    value: 'generate_leads',
    icon: Flame,
    color: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
  },
  {
    label: 'Promote a Product',
    desc: 'Create content to spotlight a Daily CRM product or feature.',
    value: 'promote_product',
    icon: Zap,
    color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
  },
  {
    label: 'Something Else',
    desc: 'Tell me what you need.',
    value: 'custom',
    icon: HelpCircle,
    color: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
  },
];

const AUDIENCES = [
  'Small businesses',
  'Startups',
  'Retail',
  'Restaurants',
  'Agencies',
  'Sales teams',
  'Existing customers',
  'Custom audience',
];

const GOALS = [
  'Generate leads',
  'Increase awareness',
  'Drive website traffic',
  'Promote a feature',
  'Get enquiries',
  'Increase engagement',
  'Product launch',
];

const PLATFORMS_OPTIONS: Array<{ label: string; value: string; platforms: SocialPlatform[] }> = [
  { label: 'Instagram + LinkedIn (Recommended for B2B Growth)', value: 'ig_li', platforms: ['instagram', 'linkedin'] },
  { label: 'All Suitable Channels (Instagram, LinkedIn, X, Facebook)', value: 'all', platforms: ['instagram', 'linkedin', 'x', 'facebook'] },
  { label: 'Instagram & Facebook (Visual / Consumer / Retail)', value: 'ig_fb', platforms: ['instagram', 'facebook'] },
  { label: 'LinkedIn & X (B2B SaaS / Thought Leadership)', value: 'li_x', platforms: ['linkedin', 'x'] },
];

export function AIConversationalAssistant() {
  const store = useCalendarStore();
  const { activeWorkspace } = useWorkspace();
  const [bufferConnected, setBufferConnected] = useState(false);
  const [bufferChannels, setBufferChannels] = useState<any[]>([]);

  useEffect(() => {
    async function loadBufferStatus() {
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
    loadBufferStatus();
  }, [activeWorkspace?.id]);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'msg_welcome',
      sender: 'ai',
      text: 'Hi! What would you like to accomplish today?',
      timestamp: 'Just now',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [conversationState, setConversationState] = useState<{
    taskType?: string;
    product?: string;
    audience?: string;
    platforms?: SocialPlatform[];
    goal?: string;
    cta?: string;
    step: number;
  }>({
    step: 0,
    product: 'Daily CRM',
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const addMessage = (msg: Message) => {
    setMessages((prev) => [...prev, msg]);
  };

  const handleQuickOption = async (optionValue: string, label: string) => {
    // User message
    const userMsg: Message = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      text: label,
      timestamp: 'Just now',
    };
    addMessage(userMsg);
    setIsTyping(true);

    await new Promise((r) => setTimeout(r, 600));

    if (optionValue === 'create_post' || optionValue === 'promote_product' || optionValue === 'create_campaign' || optionValue === 'generate_leads') {
      setConversationState((prev) => ({
        ...prev,
        taskType: optionValue,
        step: 1,
      }));

      addMessage({
        id: `ai_${Date.now()}`,
        sender: 'ai',
        text: 'Sure! I understand you want to promote Daily CRM. Which audience should we target?',
        timestamp: 'Just now',
        options: AUDIENCES.map((aud): { label: string; value: string; desc?: string } => ({
          label: aud,
          value: aud,
        })).concat([
          {
            label: "💡 I don't know, you decide",
            value: 'ai_decide_audience',
            desc: 'Let AI analyze past performance',
          },
        ]),
      });
    } else if (optionValue === 'create_blog') {
      setConversationState((prev) => ({ ...prev, taskType: 'create_blog', step: 1 }));
      addMessage({
        id: `ai_${Date.now()}`,
        sender: 'ai',
        text: 'Great. What topic or key industry trend should this SEO blog focus on?',
        timestamp: 'Just now',
        options: [
          { label: '5 Ways to Stop Losing Inbound Customers with Auto-Followups', value: 'followup_blog' },
          { label: 'Omnichannel CRM vs Traditional Spreadsheets in 2026', value: 'spreadsheets_blog' },
          { label: 'How WhatsApp & POS Integration Skyrockets Retail Margins', value: 'pos_blog' },
          { label: '💡 AI Recommendation: Best Converting Topic for Q3', value: 'ai_decide_blog' },
        ],
      });
    } else {
      addMessage({
        id: `ai_${Date.now()}`,
        sender: 'ai',
        text: 'Tell me your goals or campaign ideas in your own words, and I will structure the perfect marketing plan for you.',
        timestamp: 'Just now',
      });
    }

    setIsTyping(false);
  };

  const handleAudienceSelection = async (audienceVal: string) => {
    const userMsg: Message = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      text: audienceVal === 'ai_decide_audience' ? "I don't know, you decide." : audienceVal,
      timestamp: 'Just now',
    };
    addMessage(userMsg);
    setIsTyping(true);

    await new Promise((r) => setTimeout(r, 700));

    if (audienceVal === 'ai_decide_audience') {
      // AI Recommendation
      setConversationState((prev) => ({
        ...prev,
        audience: 'Small Business Owners',
        platforms: ['instagram', 'linkedin'],
        goal: 'Generate leads',
        cta: 'Book a Demo',
        step: 3,
      }));

      addMessage({
        id: `ai_${Date.now()}`,
        sender: 'ai',
        text: 'Based on your previous campaigns, I recommend targeting Small Business Owners and focusing on automated customer follow-ups. LinkedIn and Instagram have generated the strongest engagement (2.4× more qualified leads) for similar content.',
        timestamp: 'Just now',
        isRecommendation: true,
        options: [
          {
            label: '✨ Use Recommendation (Generate 3 Posts + 1 Blog Campaign)',
            value: 'confirm_recommendation',
            desc: 'Small Business Owners · Instagram + LinkedIn · Goal: Generate Leads',
          },
          {
            label: '✏️ Customize Details',
            value: 'custom_platforms',
            desc: 'Pick platforms and custom goals manually',
          },
        ],
      });
    } else {
      const selectedAud = audienceVal;
      setConversationState((prev) => ({ ...prev, audience: selectedAud, step: 2 }));

      addMessage({
        id: `ai_${Date.now()}`,
        sender: 'ai',
        text: `Got it. Which platform would you like to use to reach ${selectedAud}?`,
        timestamp: 'Just now',
        options: PLATFORMS_OPTIONS.map((p) => ({
          label: p.label,
          value: p.value,
        })),
      });
    }

    setIsTyping(false);
  };

  const handlePlatformSelection = async (platformOptionVal: string) => {
    const option = PLATFORMS_OPTIONS.find((p) => p.value === platformOptionVal);
    const platforms: SocialPlatform[] = option ? option.platforms : ['instagram', 'linkedin'];

    addMessage({
      id: `usr_${Date.now()}`,
      sender: 'user',
      text: option?.label || 'Instagram + LinkedIn',
      timestamp: 'Just now',
    });
    setIsTyping(true);

    await new Promise((r) => setTimeout(r, 600));

    setConversationState((prev) => ({ ...prev, platforms, step: 3 }));

    addMessage({
      id: `ai_${Date.now()}`,
      sender: 'ai',
      text: 'What is the primary goal of this marketing activity?',
      timestamp: 'Just now',
      options: GOALS.map((g) => ({
        label: g,
        value: g,
      })),
    });

    setIsTyping(false);
  };

  const handleGoalSelection = async (goalVal: string) => {
    addMessage({
      id: `usr_${Date.now()}`,
      sender: 'user',
      text: goalVal,
      timestamp: 'Just now',
    });
    setIsTyping(true);

    await new Promise((r) => setTimeout(r, 900));

    const audience = conversationState.audience || 'Small Business Owners';
    const platforms = conversationState.platforms || ['instagram', 'linkedin'];

    // Generate Full Structured Campaign
    const campaignData = {
      name: `${audience} Growth & Lead Acquisition`,
      objective: goalVal,
      targetAudience: audience,
      platforms,
      cta: 'Book a Demo',
      postsCount: 3,
      blogIncluded: true,
      autoTags: [
        `audience:${audience.toLowerCase().replace(/\s+/g, '-')}`,
        `campaign:${audience.toLowerCase().replace(/\s+/g, '-')}-growth`,
        `intent:pricing`,
        `intent:demo`,
        `lead:hot`,
      ],
      utmLink: `https://dailybuz.com?utm_source=${platforms[0]}&utm_medium=social&utm_campaign=${audience.toLowerCase().replace(/\s+/g, '-')}-growth`,
      posts: [
        {
          title: 'Stop Losing Customers: 5 Automated Follow-Up Systems',
          caption: `Did you know 68% of small business leads are lost because follow-ups take longer than 2 hours? 🤯 With Daily CRM, automate WhatsApp & email replies in under 60 seconds. Keep high-intent buyers engaged effortlessly.\n\n👇 Book a free 15-minute live demo today! #DailyCRM #SmallBusinessGrowth #SalesAutomation`,
          channels: platforms,
          date: '2026-08-25',
          time: '10:00',
          platformNote: 'Tailored for Instagram Carousel & LinkedIn Thought Leadership',
        },
        {
          title: 'From Chaos to Close: Omnichannel CRM Workspace Walkthrough',
          caption: `Still managing deals in Excel spreadsheets while answering WhatsApp chats on personal phones? Daily CRM brings your WhatsApp inbox, customer deals, quotations, and task tracking into one seamless screen.\n\n⚡ Click link in bio to start your 14-day free trial.`,
          channels: platforms,
          date: '2026-08-27',
          time: '14:30',
          platformNote: 'Optimized with demo CTA & interactive problem statement',
        },
        {
          title: 'Case Study: How Local Retailers Boosted Inbound Conversions by 3.2x',
          caption: `See how modern businesses transformed their customer lifecycle with auto-tagging, fast invoicing, and immediate WhatsApp notifications.\n\nReady to scale? Comment "DEMO" below or click our link! 🚀`,
          channels: platforms,
          date: '2026-08-29',
          time: '11:00',
          platformNote: 'High engagement hook designed to trigger Lead Intent classifier',
        },
      ],
      blog: {
        title: 'The Small Business Guide to High-Velocity CRM & Lead Nurturing',
        summary: 'How modern businesses bridge the gap between initial social engagement and closed sales deals.',
        content: `Scaling a high-touch business requires synchronized customer touchpoints. When a customer reaches out on Instagram or LinkedIn with pricing questions, speed is everything. Daily CRM provides intelligent attribution, lead scoring, and instant WhatsApp follow-up triggers...`,
      },
    };

    addMessage({
      id: `ai_${Date.now()}`,
      sender: 'ai',
      text: "I've structured a complete lead-generation campaign based on your requirements. Here's what I created:",
      timestamp: 'Just now',
      generatedCampaign: campaignData,
    });

    setIsTyping(false);
  };

  const handleCustomInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text) return;

    setInputText('');
    const userMsg: Message = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      text,
      timestamp: 'Just now',
    };
    addMessage(userMsg);
    setIsTyping(true);

    setTimeout(() => {
      // Smart parsing of conversational text
      const lower = text.toLowerCase();
      if (lower.includes('post') || lower.includes('promote') || lower.includes('small business') || lower.includes('crm')) {
        setConversationState({
          step: 2,
          audience: lower.includes('retail') ? 'Retail' : lower.includes('startup') ? 'Startups' : 'Small Business Owners',
          platforms: ['instagram', 'linkedin'],
          product: 'Daily CRM',
        });

        addMessage({
          id: `ai_${Date.now()}`,
          sender: 'ai',
          text: `Understood! I will create a high-converting campaign promoting Daily CRM to ${
            lower.includes('retail') ? 'Retail Businesses' : 'Small Business Owners'
          }. What should be the primary CTA/Goal?`,
          timestamp: 'Just now',
          options: GOALS.map((g) => ({ label: g, value: g })),
        });
      } else {
        addMessage({
          id: `ai_${Date.now()}`,
          sender: 'ai',
          text: `I can help with that. Which audience and channels would you like to focus on for this?`,
          timestamp: 'Just now',
          options: AUDIENCES.slice(0, 4).map((a) => ({ label: a, value: a })),
        });
      }
      setIsTyping(false);
    }, 700);
  };

  const handleApproveBatch = (generated: NonNullable<Message['generatedCampaign']>) => {
    store.createAICampaignBatch({
      name: generated.name,
      objective: generated.objective,
      targetAudience: generated.targetAudience,
      cta: generated.cta,
      platforms: generated.platforms,
      posts: generated.posts.map((p) => ({
        title: p.title,
        caption: p.caption,
        channels: p.channels,
        date: p.date,
        time: p.time,
      })),
      blog: generated.blog,
    });

    addMessage({
      id: `ai_approved_${Date.now()}`,
      sender: 'ai',
      text: `✅ Done! Campaign "${generated.name}" (3 Social Posts + 1 SEO Blog) has been submitted for Admin Review under "Pending Approval" (Default approval required = ON). Once approved, scheduled publishing and intelligent lead attribution will activate automatically!`,
      timestamp: 'Just now',
    });
  };

  return (
    <div className="rounded-3xl border border-border bg-gradient-to-b from-card via-card to-background shadow-md overflow-hidden transition-all">
      {/* Header Bar */}
      <div className="border-b border-border/80 bg-muted/30 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary to-purple-600 text-primary-foreground shadow-sm">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black text-foreground tracking-tight">AI Marketing Assistant</h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-extrabold text-emerald-600 border border-emerald-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Online & Context Aware
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Intelligent conversation · Context-aware campaign generation · Auto CRM lead attribution
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="outline" className="text-[11px] font-bold bg-background text-muted-foreground border-border">
            <Building2 className="h-3 w-3 mr-1 text-primary" /> Daily CRM Context Loaded
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              'text-[11px] font-bold border-border',
              bufferConnected
                ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
                : 'text-muted-foreground bg-background'
            )}
          >
            <Share2 className="h-3 w-3 mr-1 text-primary" />
            Buffer: {bufferConnected ? `${bufferChannels.length} Channels Connected` : 'Not Connected'}
          </Badge>
          <Badge variant="outline" className="text-[11px] font-bold bg-background text-muted-foreground border-border">
            <ShieldCheck className="h-3 w-3 mr-1 text-emerald-500" /> Admin Approval = ON
          </Badge>
        </div>
      </div>

      {/* Chat Messages Log */}
      <div className="p-6 space-y-6 max-h-[560px] overflow-y-auto">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn('flex gap-3 text-xs leading-relaxed', msg.sender === 'user' ? 'justify-end' : 'justify-start')}
          >
            {msg.sender === 'ai' && (
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0 mt-0.5 shadow-xs">
                <Bot className="h-4 w-4" />
              </div>
            )}

            <div
              className={cn(
                'rounded-2xl p-4 max-w-[92%] sm:max-w-[80%] space-y-3 shadow-xs',
                msg.sender === 'user'
                  ? 'bg-primary text-primary-foreground font-medium ml-auto'
                  : 'bg-card border border-border text-foreground'
              )}
            >
              <div className="text-xs font-semibold whitespace-pre-wrap">{msg.text}</div>

              {/* Quick action pill options */}
              {msg.options && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {msg.options.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        if (conversationState.step === 0) {
                          handleQuickOption(opt.value, opt.label);
                        } else if (conversationState.step === 1) {
                          handleAudienceSelection(opt.value);
                        } else if (conversationState.step === 2) {
                          handlePlatformSelection(opt.value);
                        } else if (conversationState.step === 3) {
                          handleGoalSelection(opt.value);
                        } else if (opt.value === 'confirm_recommendation') {
                          handleGoalSelection('Generate leads');
                        } else {
                          handleAudienceSelection('Small Business Owners');
                        }
                      }}
                      className="flex items-start gap-2.5 text-left p-3 rounded-xl border border-border bg-background hover:border-primary hover:bg-primary/5 transition-all text-foreground group"
                    >
                      <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-muted group-hover:bg-primary group-hover:text-primary-foreground shrink-0 transition-colors">
                        <ArrowRight className="h-3 w-3" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                          {opt.label}
                        </p>
                        {opt.desc && <p className="text-[10px] text-muted-foreground mt-0.5">{opt.desc}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Render Structured Campaign Output Card */}
              {msg.generatedCampaign && (
                <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-4 text-foreground mt-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-primary/20 pb-3">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-primary">
                        Structured AI Output
                      </span>
                      <h3 className="text-base font-black text-foreground">{msg.generatedCampaign.name}</h3>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20 px-2 py-0.5 rounded-full">
                        Pending Admin Approval
                      </span>
                    </div>
                  </div>

                  {/* Summary grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2 rounded-xl bg-background border border-border">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold block">Objective</span>
                      <span className="font-bold text-foreground">{msg.generatedCampaign.objective}</span>
                    </div>
                    <div className="p-2 rounded-xl bg-background border border-border">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold block">Audience</span>
                      <span className="font-bold text-foreground">{msg.generatedCampaign.targetAudience}</span>
                    </div>
                    <div className="p-2 rounded-xl bg-background border border-border">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold block">Platforms</span>
                      <span className="font-bold text-primary capitalize">
                        {msg.generatedCampaign.platforms.join(' + ')}
                      </span>
                    </div>
                    <div className="p-2 rounded-xl bg-background border border-border">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold block">Content Assets</span>
                      <span className="font-bold text-foreground">3 Posts + 1 Blog</span>
                    </div>
                  </div>

                  {/* Auto generated tags preview */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <Tag className="h-3 w-3" /> Auto-Generated Attribution Tags:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {msg.generatedCampaign.autoTags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 text-[10px] font-extrabold rounded-md bg-background border border-border text-foreground font-mono"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Expandable Posts preview */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Generated Social Posts & Overrides:
                    </span>
                    <div className="space-y-2">
                      {msg.generatedCampaign.posts.map((post, idx) => (
                        <div key={idx} className="rounded-xl border border-border bg-background p-3 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                              <span className="h-4 w-4 rounded-full bg-primary/10 text-primary text-[10px] flex items-center justify-center font-black">
                                {idx + 1}
                              </span>
                              {post.title}
                            </h4>
                            <span className="text-[10px] text-muted-foreground font-medium">
                              {post.date} @ {post.time}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">{post.caption}</p>
                          <div className="text-[10px] text-primary font-bold">{post.platformNote}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-primary/20">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toast.info('Regenerating creative variations...')}
                      className="h-8 text-xs font-bold rounded-xl gap-1"
                    >
                      <RefreshCw className="h-3 w-3" /> Regenerate
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleApproveBatch(msg.generatedCampaign!)}
                      className="h-8 px-4 text-xs font-bold rounded-xl gap-1.5 bg-primary text-primary-foreground shadow-sm"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Submit for Admin Approval
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {msg.sender === 'user' && (
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shrink-0 mt-0.5 shadow-xs">
                <User className="h-4 w-4" />
              </div>
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex gap-3 text-xs">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
              <Bot className="h-4 w-4" />
            </div>
            <div className="rounded-2xl p-4 bg-card border border-border flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
              <span className="text-xs text-muted-foreground font-medium ml-1">AI Assistant is thinking...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Launch Cards (if in initial greeting step) */}
      {conversationState.step === 0 && (
        <div className="px-6 pb-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {QUICK_START_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleQuickOption(opt.value, opt.label)}
                  className="rounded-2xl border border-border bg-card p-3 flex flex-col items-center text-center gap-2 hover:border-primary/50 hover:bg-primary/5 transition-all group"
                >
                  <div className={cn('flex h-8 w-8 items-center justify-center rounded-xl border', opt.color)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                      {opt.label}
                    </h4>
                    <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{opt.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Conversational Input Bar */}
      <form onSubmit={handleCustomInputSubmit} className="p-4 bg-muted/40 border-t border-border flex gap-2">
        <Input
          type="text"
          placeholder="Tell me what you want to achieve... (e.g. 'Create a post promoting Daily CRM to small business owners')"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          className="h-10 text-xs rounded-xl bg-background border-border"
        />
        <Button
          type="submit"
          disabled={!inputText.trim() || isTyping}
          className="h-10 px-4 text-xs font-bold rounded-xl gap-1.5 bg-primary text-primary-foreground shrink-0 shadow-sm"
        >
          <Send className="h-3.5 w-3.5" />
          <span>Send</span>
        </Button>
      </form>
    </div>
  );
}
