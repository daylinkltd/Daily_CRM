"use client";

import React, { useState } from 'react';
import {
  Sparkles,
  Wand2,
  RefreshCw,
  Copy,
  Check,
  Hash,
  Lightbulb,
  Layers,
  ArrowRight,
  Zap,
  AlignLeft,
  Briefcase,
  Smile,
  Minimize2,
  Maximize2,
  SlidersHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { SocialPlatform, PlatformContentOverride } from '@/types/calendar';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface AIAssistantProps {
  currentCaption?: string;
  onApplyCaption: (newCaption: string) => void;
  onApplyHashtags?: (hashtags: string) => void;
  onApplyOverrides?: (overrides: Record<string, PlatformContentOverride>) => void;
  selectedPlatforms?: SocialPlatform[];
}

type AIAction =
  | 'generate'
  | 'rewrite'
  | 'professional'
  | 'engaging'
  | 'shorten'
  | 'expand'
  | 'hashtags'
  | 'ideas'
  | 'variations';

export function AIContentAssistant({
  currentCaption = '',
  onApplyCaption,
  onApplyHashtags,
  onApplyOverrides,
  selectedPlatforms = ['instagram', 'linkedin', 'x'],
}: AIAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [topicPrompt, setTopicPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedOutput, setGeneratedOutput] = useState<string>('');
  const [activeAction, setActiveAction] = useState<AIAction>('generate');
  const [generatedVariations, setGeneratedVariations] = useState<Record<string, string>>({});

  const handleRunAI = async (action: AIAction) => {
    setActiveAction(action);
    setLoading(true);
    setGeneratedOutput('');
    setGeneratedVariations({});

    // Simulate smart generative AI response
    await new Promise((r) => setTimeout(r, 650));

    const topic = topicPrompt.trim() || 'Daily CRM omnichannel business growth';

    if (action === 'generate') {
      const result = `Supercharge your team's workflow with modern omnichannel CRM! 🚀 Unify customer conversations, streamline pipelines, and boost deal velocity in one intuitive workspace. Start your 14-day free trial today.`;
      setGeneratedOutput(result);
    } else if (action === 'rewrite') {
      const result = `Reimagining the way high-growth businesses manage customer pipelines. Experience seamless collaboration and automated messaging with Daily CRM.`;
      setGeneratedOutput(result);
    } else if (action === 'professional') {
      const result = `Enterprise operational efficiency demands synchronized customer touchpoints. Daily CRM unifies communication pipelines, financial ledgers, and team workload analytics into a single authoritative workspace.`;
      setGeneratedOutput(result);
    } else if (action === 'engaging') {
      const result = `Still juggling 5 different tabs for WhatsApp, emails, and client deals? 🤯 Stop the chaos! Discover how Daily CRM keeps your whole business in sync effortlessly. 👇 Drop a comment with your biggest workflow headache!`;
      setGeneratedOutput(result);
    } else if (action === 'shorten') {
      const result = `Unify WhatsApp, sales pipelines, and customer journeys with Daily CRM. ⚡ Try it free today!`;
      setGeneratedOutput(result);
    } else if (action === 'expand') {
      const result = `Managing customer relationships shouldn't feel like fighting disconnected systems. Daily CRM bridges the gap between sales conversations, quotation generation, and automated pipeline updates. When your marketing and sales teams operate in one shared workspace, conversion rates rise and response times drop. Ready to scale?`;
      setGeneratedOutput(result);
    } else if (action === 'hashtags') {
      const result = `#DailyCRM #OmnichannelMarketing #SalesPipeline #B2BGrowth #SaaS #ProductivityTools #WhatsAppBusiness #BusinessAutomation`;
      setGeneratedOutput(result);
    } else if (action === 'ideas') {
      const result = `💡 1. "Behind the Scenes: How our team scaled 10x customer conversations"\n💡 2. "5 Spreadsheet Mistakes costing your sales team 10 hours a week"\n💡 3. "Customer Spotlight: How Acme Logistics cut dispatch times by 42%"\n💡 4. "Sneak Peek: Automating invoice follow-ups via WhatsApp API"`;
      setGeneratedOutput(result);
    } else if (action === 'variations') {
      const variations: Record<string, string> = {
        linkedin: `Scaling customer relationships requires unified communications. Daily CRM brings WhatsApp, sales pipelines, and finance ledgers into one executive dashboard. Let's discuss your team's workflow.`,
        x: `Stop tab-switching! Daily CRM brings WhatsApp, pipelines & automations into one real-time workspace. 💬⚡ #DailyCRM`,
        instagram: `Your complete business workspace in one app! ✨ Keep your team aligned and customers delighted. Link in bio for 14-day free trial! 🚀 #Growth #CRM`,
        youtube: `Daily CRM Walkthrough: How to automate pipelines, manage leads across WhatsApp, and sync team tasks in under 10 minutes.`,
        facebook: `Transform how your business connects with customers! Daily CRM connects WhatsApp, pipelines, and billing in one easy dashboard.`,
        tiktok: `POV: You just replaced 5 messy apps with 1 clean CRM workspace. 🔥 #tech #productivity #entrepreneur`,
        threads: `Unpopular opinion: You don't need 10 different SaaS tools to run a high-performing sales team. You just need one unified CRM. Thoughts? 💬`,
        pinterest: `Top productivity workflows for high-growth businesses. Save this pin for your workspace toolkit! 📌`,
      };
      setGeneratedVariations(variations);
      setGeneratedOutput(`Generated ${selectedPlatforms.length} tailored platform variations.`);
    }

    setLoading(false);
    toast.success('AI suggestions generated!');
  };

  const handleApply = () => {
    if (activeAction === 'hashtags') {
      if (onApplyHashtags) onApplyHashtags(generatedOutput);
      else onApplyCaption(`${currentCaption}\n\n${generatedOutput}`);
    } else if (activeAction === 'variations') {
      if (onApplyOverrides) {
        const overrides: Record<string, PlatformContentOverride> = {};
        Object.entries(generatedVariations).forEach(([platform, cap]) => {
          overrides[platform] = { platform: platform as SocialPlatform, caption: cap };
        });
        onApplyOverrides(overrides);
      }
    } else {
      onApplyCaption(generatedOutput);
    }
    toast.success('Applied to composer!');
  };

  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-3 transition-all">
      {/* Header Toggle */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 text-xs font-black text-primary hover:opacity-80 transition-opacity"
        >
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <span>AI Content Assistant</span>
          <span className="text-[10px] text-muted-foreground font-normal">
            ({isOpen ? 'Collapse' : 'Expand tools'})
          </span>
        </button>

        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-extrabold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20 rounded-full px-2 py-0.5">
            GPT-4o Engine
          </span>
        </div>
      </div>

      {isOpen && (
        <div className="space-y-3 pt-2 animate-in fade-in duration-200">
          {/* Topic / Prompt input */}
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="What is this post about? (e.g. Q3 product release, WhatsApp API features...)"
              value={topicPrompt}
              onChange={(e) => setTopicPrompt(e.target.value)}
              className="h-9 text-xs rounded-xl bg-background border-border"
            />
            <Button
              type="button"
              size="sm"
              onClick={() => handleRunAI('generate')}
              disabled={loading}
              className="h-9 px-3 text-xs font-bold rounded-xl gap-1.5 shrink-0 bg-primary text-primary-foreground shadow-xs"
            >
              {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
              Generate
            </Button>
          </div>

          {/* Quick Action Chips */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => handleRunAI('rewrite')}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg border border-border bg-background hover:border-primary/40 text-foreground transition-all"
            >
              <RefreshCw className="h-3 w-3 text-primary" /> Rewrite
            </button>
            <button
              type="button"
              onClick={() => handleRunAI('professional')}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg border border-border bg-background hover:border-primary/40 text-foreground transition-all"
            >
              <Briefcase className="h-3 w-3 text-sky-500" /> Make Professional
            </button>
            <button
              type="button"
              onClick={() => handleRunAI('engaging')}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg border border-border bg-background hover:border-primary/40 text-foreground transition-all"
            >
              <Smile className="h-3 w-3 text-amber-500" /> Make Engaging
            </button>
            <button
              type="button"
              onClick={() => handleRunAI('shorten')}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg border border-border bg-background hover:border-primary/40 text-foreground transition-all"
            >
              <Minimize2 className="h-3 w-3 text-emerald-500" /> Shorten
            </button>
            <button
              type="button"
              onClick={() => handleRunAI('expand')}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg border border-border bg-background hover:border-primary/40 text-foreground transition-all"
            >
              <Maximize2 className="h-3 w-3 text-purple-500" /> Expand
            </button>
            <button
              type="button"
              onClick={() => handleRunAI('hashtags')}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg border border-border bg-background hover:border-primary/40 text-foreground transition-all"
            >
              <Hash className="h-3 w-3 text-pink-500" /> Generate Hashtags
            </button>
            <button
              type="button"
              onClick={() => handleRunAI('variations')}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg border border-border bg-background hover:border-primary/40 text-foreground transition-all"
            >
              <Layers className="h-3 w-3 text-indigo-500" /> Platform Variations
            </button>
            <button
              type="button"
              onClick={() => handleRunAI('ideas')}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg border border-border bg-background hover:border-primary/40 text-foreground transition-all"
            >
              <Lightbulb className="h-3 w-3 text-amber-400" /> Content Ideas
            </button>
          </div>

          {/* Generated Result Output */}
          {generatedOutput && (
            <div className="rounded-xl border border-border bg-card p-3 space-y-2.5 shadow-sm">
              <div className="flex items-center justify-between text-xs">
                <span className="font-extrabold uppercase tracking-wider text-muted-foreground text-[10px]">
                  AI Result ({activeAction})
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(generatedOutput);
                      toast.info('Copied to clipboard');
                    }}
                    className="text-[10px] font-bold text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    <Copy className="h-3 w-3" /> Copy
                  </button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleApply}
                    className="h-7 px-2.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                  >
                    <Check className="h-3 w-3" /> Apply to Post
                  </Button>
                </div>
              </div>

              {activeAction === 'variations' ? (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {Object.entries(generatedVariations)
                    .filter(([p]) => selectedPlatforms.includes(p as SocialPlatform))
                    .map(([p, text]) => (
                      <div key={p} className="p-2 rounded-lg bg-muted/40 border border-border/40 text-xs">
                        <span className="font-extrabold capitalize text-primary text-[10px] block mb-0.5">
                          {p}:
                        </span>
                        <p className="text-foreground leading-relaxed text-[11px]">{text}</p>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-xs text-foreground leading-relaxed whitespace-pre-line bg-muted/20 p-2.5 rounded-lg border border-border/40 font-medium">
                  {generatedOutput}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
