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
  Briefcase,
  Smile,
  Minimize2,
  Maximize2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { SocialPlatform, PlatformContentOverride } from '@/types/calendar';
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

    const topic = topicPrompt.trim() || currentCaption || 'our new collection';

    if (action === 'generate') {
      const result = `Discover ${topic}! ✨ Crafted with care and designed to deliver exceptional quality. Explore our collection and experience the difference today.`;
      setGeneratedOutput(result);
    } else if (action === 'rewrite') {
      const result = `Elevate your experience with ${topic}. Thoughtfully curated for those who value authenticity, craftsmanship, and lasting delight.`;
      setGeneratedOutput(result);
    } else if (action === 'professional') {
      const result = `Excellence in every detail. Introducing ${topic} — designed to meet the highest standards of quality and performance. Learn more about our approach.`;
      setGeneratedOutput(result);
    } else if (action === 'engaging') {
      const result = `Ready to upgrade your routine with ${topic}? ✨ Tag someone who needs this, or drop a comment below with your favorite feature! 👇`;
      setGeneratedOutput(result);
    } else if (action === 'shorten') {
      const result = `Experience ${topic}. ✨ Crafted with care, loved by all. Shop now! 🚀`;
      setGeneratedOutput(result);
    } else if (action === 'expand') {
      const result = `When it comes to ${topic}, quality and attention to detail make all the difference. From handpicked materials to mindful craftsmanship, every piece is designed to bring warmth, satisfaction, and lasting value into your world. Ready to explore? Tap the link to discover more.`;
      setGeneratedOutput(result);
    } else if (action === 'hashtags') {
      const cleanTags = topic
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter((w) => w.length > 2)
        .map((w) => `#${w.charAt(0).toUpperCase() + w.slice(1)}`)
        .slice(0, 6);
      const result = [...cleanTags, '#QualityFirst', '#BrandSpotlight', '#MustHave'].join(' ');
      setGeneratedOutput(result);
    } else if (action === 'ideas') {
      const result = `💡 1. "Behind the Scenes: The craftsmanship and care behind ${topic}"\n💡 2. "Customer Spotlight: How ${topic} transformed their daily routine"\n💡 3. "5 Reasons why people love ${topic}"\n💡 4. "Unboxing & Styling Guide for ${topic}"`;
      setGeneratedOutput(result);
    } else if (action === 'variations') {
      const variations: Record<string, string> = {
        linkedin: `Quality and purposeful design define ${topic}. Learn more about our commitment to excellence and customer satisfaction.`,
        x: `Discover ${topic} ✨ Exceptional quality crafted with care. Explore today 🚀`,
        instagram: `Elevate your everyday with ${topic}! ✨ Link in bio to shop the collection! 👆`,
        youtube: `Complete Spotlight: Discover what makes ${topic} special and how to get the most value.`,
        facebook: `Looking for ${topic}? Experience premium craftsmanship and exceptional quality today.`,
        tiktok: `POV: You just discovered ${topic} and your life just got 10x better 🔥 #fyp #trending`,
        threads: `Have you tried ${topic} yet? What is your favorite feature? Let's discuss! 💬`,
        pinterest: `Inspiration guide for ${topic}. Save this pin for your wishlist! 📌`,
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
