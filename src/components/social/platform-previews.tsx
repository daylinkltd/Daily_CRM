"use client";

import React, { useState } from 'react';
import type { SocialPlatform, SocialPost, PlatformContentOverride } from '@/types/calendar';
import { SOCIAL_PLATFORM_ICONS } from '@/components/calendar/social-icons';
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  MoreHorizontal,
  Send,
  Repeat2,
  ThumbsUp,
  MessageSquare,
  Globe,
  Music2,
  Play,
  Volume2,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

export interface PostPreviewProps {
  post: Partial<SocialPost>;
  selectedPlatform: SocialPlatform;
  availablePlatforms?: SocialPlatform[];
  onPlatformChange?: (platform: SocialPlatform) => void;
  className?: string;
}

export function InstagramPreview({
  post,
  override,
}: {
  post: Partial<SocialPost>;
  override?: PlatformContentOverride;
}) {
  const [liked, setLiked] = useState(false);
  const caption = override?.caption || post.defaultCaption || 'Write your caption...';
  const media = override?.mediaUrl || post.mediaUrl;
  const firstComment = override?.firstComment || post.firstComment;
  const hashtags = override?.hashtags || post.hashtags || [];

  return (
    <div className="mx-auto w-full max-w-[380px] rounded-3xl border border-border bg-card shadow-xl overflow-hidden font-sans">
      {/* Instagram Header */}
      <div className="flex items-center justify-between p-3.5 border-b border-border/40">
        <div className="flex items-center gap-2.5">
          <div className="relative p-0.5 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600">
            <Avatar className="h-8 w-8 border-2 border-background">
              <AvatarImage src={post.creatorAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'} />
              <AvatarFallback>DC</AvatarFallback>
            </Avatar>
          </div>
          <div>
            <div className="flex items-center gap-1">
              <span className="text-xs font-black text-foreground">dailycrm_official</span>
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            </div>
            <span className="text-[10px] text-muted-foreground">Original audio</span>
          </div>
        </div>
        <button type="button" className="text-muted-foreground hover:text-foreground">
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>

      {/* Post Image */}
      <div className="relative aspect-square w-full bg-muted/60 flex items-center justify-center overflow-hidden">
        {media ? (
          <img src={media} alt={post.title || 'Instagram post'} className="h-full w-full object-cover" />
        ) : (
          <div className="flex flex-col items-center justify-center text-muted-foreground p-6 text-center">
            <Sparkles className="h-8 w-8 mb-2 opacity-40 text-primary" />
            <span className="text-xs font-semibold">Media will preview here</span>
          </div>
        )}
      </div>

      {/* Action Bar */}
      <div className="p-3.5 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setLiked(!liked)}
              className={cn('transition-transform active:scale-125', liked ? 'text-rose-500 fill-rose-500' : 'text-foreground hover:text-rose-500')}
            >
              <Heart className={cn('h-5 w-5', liked && 'fill-current')} />
            </button>
            <button type="button" className="text-foreground hover:text-primary">
              <MessageCircle className="h-5 w-5" />
            </button>
            <button type="button" className="text-foreground hover:text-primary">
              <Send className="h-5 w-5" />
            </button>
          </div>
          <button type="button" className="text-foreground hover:text-primary">
            <Bookmark className="h-5 w-5" />
          </button>
        </div>

        <p className="text-xs font-black text-foreground">{liked ? '1,429 likes' : '1,428 likes'}</p>

        {/* Caption */}
        <div className="text-xs text-foreground leading-relaxed">
          <span className="font-black mr-1.5">dailycrm_official</span>
          <span className="whitespace-pre-line text-foreground/90">{caption}</span>
          {hashtags.length > 0 && (
            <span className="block mt-1 text-primary font-semibold">
              {hashtags.join(' ')}
            </span>
          )}
        </div>

        {/* First comment if present */}
        {firstComment && (
          <div className="text-xs text-foreground/80 pt-1 border-t border-border/40 flex items-start gap-1">
            <span className="font-black mr-1 text-[11px]">dailycrm_official</span>
            <span className="text-[11px] text-muted-foreground">{firstComment}</span>
          </div>
        )}

        <div className="flex items-center justify-between text-[10px] text-muted-foreground uppercase pt-1">
          <span>{post.date || 'Just now'}</span>
          <span>View all 42 comments</span>
        </div>
      </div>
    </div>
  );
}

export function LinkedInPreview({
  post,
  override,
}: {
  post: Partial<SocialPost>;
  override?: PlatformContentOverride;
}) {
  const caption = override?.caption || post.defaultCaption || 'Write your professional LinkedIn post...';
  const media = override?.mediaUrl || post.mediaUrl;
  const link = override?.link || post.link;
  const hashtags = override?.hashtags || post.hashtags || [];

  return (
    <div className="mx-auto w-full max-w-[420px] rounded-2xl border border-border bg-card shadow-xl overflow-hidden font-sans">
      {/* LinkedIn Header */}
      <div className="p-4 border-b border-border/40">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-black text-base shrink-0">
              D
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-foreground">Daily CRM</span>
                <span className="text-[10px] text-muted-foreground">• 1st</span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-tight">
                Unified Inbox, Pipelines & Automation Software
              </p>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                <span>{post.date || '2h'}</span>
                <span>•</span>
                <Globe className="h-3 w-3" />
              </div>
            </div>
          </div>
          <button type="button" className="text-muted-foreground hover:text-foreground">
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>

        {/* Caption */}
        <div className="mt-3 text-xs text-foreground/90 leading-relaxed whitespace-pre-line">
          {caption}
          {hashtags.length > 0 && (
            <p className="mt-1.5 text-primary font-semibold">
              {hashtags.join(' ')}
            </p>
          )}
        </div>
      </div>

      {/* Media or Link card */}
      {media && (
        <div className="relative w-full max-h-64 bg-muted overflow-hidden">
          <img src={media} alt="LinkedIn media" className="w-full h-full object-cover" />
        </div>
      )}

      {link && !media && (
        <div className="p-3 bg-muted/30 border-y border-border flex items-center justify-between text-xs">
          <div className="truncate">
            <span className="font-bold text-foreground block truncate">{post.title || 'Daily CRM'}</span>
            <span className="text-[10px] text-muted-foreground truncate block">{link}</span>
          </div>
          <ExternalLink className="h-4 w-4 text-primary shrink-0 ml-2" />
        </div>
      )}

      {/* Reactions Bar */}
      <div className="px-4 py-2 flex items-center justify-between border-b border-border/40 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="flex -space-x-1">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white text-[8px]">👍</span>
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white text-[8px]">👏</span>
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-white text-[8px]">❤️</span>
          </div>
          <span className="font-semibold ml-1">348</span>
        </div>
        <span>24 comments • 18 reposts</span>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-4 divide-x divide-border/40 p-1.5 text-center text-xs font-bold text-muted-foreground">
        <button type="button" className="flex items-center justify-center gap-1 py-2 hover:bg-muted/50 rounded-lg hover:text-foreground">
          <ThumbsUp className="h-3.5 w-3.5" /> Like
        </button>
        <button type="button" className="flex items-center justify-center gap-1 py-2 hover:bg-muted/50 rounded-lg hover:text-foreground">
          <MessageSquare className="h-3.5 w-3.5" /> Comment
        </button>
        <button type="button" className="flex items-center justify-center gap-1 py-2 hover:bg-muted/50 rounded-lg hover:text-foreground">
          <Repeat2 className="h-3.5 w-3.5" /> Repost
        </button>
        <button type="button" className="flex items-center justify-center gap-1 py-2 hover:bg-muted/50 rounded-lg hover:text-foreground">
          <Send className="h-3.5 w-3.5" /> Send
        </button>
      </div>
    </div>
  );
}

export function XPreview({
  post,
  override,
}: {
  post: Partial<SocialPost>;
  override?: PlatformContentOverride;
}) {
  const caption = override?.caption || post.defaultCaption || 'What is happening?!';
  const media = override?.mediaUrl || post.mediaUrl;
  const hashtags = override?.hashtags || post.hashtags || [];

  return (
    <div className="mx-auto w-full max-w-[400px] rounded-2xl border border-border bg-card shadow-xl p-4 font-sans space-y-3">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Avatar className="h-10 w-10 border border-border shrink-0">
          <AvatarImage src={post.creatorAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'} />
          <AvatarFallback>DC</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 truncate">
              <span className="text-xs font-black text-foreground">Daily CRM</span>
              <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-sky-500 text-white text-[8px] font-bold">✓</span>
              <span className="text-xs text-muted-foreground">@DailyCRMApp</span>
              <span className="text-xs text-muted-foreground">· 2h</span>
            </div>
            <button type="button" className="text-muted-foreground hover:text-foreground">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>

          {/* Tweet Text */}
          <div className="text-xs text-foreground leading-relaxed mt-1 whitespace-pre-line">
            {caption}
            {hashtags.length > 0 && (
              <span className="block mt-1 text-sky-500 font-medium">
                {hashtags.join(' ')}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Media */}
      {media && (
        <div className="rounded-xl overflow-hidden border border-border max-h-56 bg-muted">
          <img src={media} alt="X media" className="w-full h-full object-cover" />
        </div>
      )}

      {/* Metrics Bar */}
      <div className="flex items-center justify-between text-muted-foreground text-xs pt-2 border-t border-border/40">
        <button type="button" className="flex items-center gap-1 hover:text-sky-500">
          <MessageCircle className="h-4 w-4" /> <span>38</span>
        </button>
        <button type="button" className="flex items-center gap-1 hover:text-emerald-500">
          <Repeat2 className="h-4 w-4" /> <span>114</span>
        </button>
        <button type="button" className="flex items-center gap-1 hover:text-rose-500">
          <Heart className="h-4 w-4" /> <span>492</span>
        </button>
        <button type="button" className="flex items-center gap-1 hover:text-sky-500">
          <Bookmark className="h-4 w-4" />
        </button>
        <button type="button" className="flex items-center gap-1 hover:text-sky-500">
          <Share2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function FacebookPreview({
  post,
  override,
}: {
  post: Partial<SocialPost>;
  override?: PlatformContentOverride;
}) {
  const caption = override?.caption || post.defaultCaption || 'Write a Facebook post...';
  const media = override?.mediaUrl || post.mediaUrl;

  return (
    <div className="mx-auto w-full max-w-[400px] rounded-2xl border border-border bg-card shadow-xl overflow-hidden font-sans">
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Avatar className="h-9 w-9 border border-border">
              <AvatarImage src={post.creatorAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'} />
              <AvatarFallback>FB</AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-1">
                <span className="text-xs font-black text-foreground">Daily CRM</span>
                <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-blue-600 text-white text-[8px]">✓</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <span>{post.date || '3 hrs ago'}</span>
                <span>•</span>
                <Globe className="h-3 w-3" />
              </div>
            </div>
          </div>
          <button type="button" className="text-muted-foreground">
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>

        <p className="text-xs text-foreground leading-relaxed whitespace-pre-line">{caption}</p>
      </div>

      {media && (
        <div className="w-full max-h-64 bg-muted overflow-hidden">
          <img src={media} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      <div className="p-3 border-t border-border/40 flex items-center justify-between text-xs font-bold text-muted-foreground">
        <button type="button" className="flex items-center gap-1.5 hover:text-blue-600">
          <ThumbsUp className="h-4 w-4" /> Like
        </button>
        <button type="button" className="flex items-center gap-1.5 hover:text-blue-600">
          <MessageCircle className="h-4 w-4" /> Comment
        </button>
        <button type="button" className="flex items-center gap-1.5 hover:text-blue-600">
          <Share2 className="h-4 w-4" /> Share
        </button>
      </div>
    </div>
  );
}

export function TikTokPreview({
  post,
  override,
}: {
  post: Partial<SocialPost>;
  override?: PlatformContentOverride;
}) {
  const caption = override?.caption || post.defaultCaption || 'TikTok video caption #DailyCRM';
  const media = override?.mediaUrl || post.mediaUrl;

  return (
    <div className="mx-auto w-full max-w-[320px] aspect-[9/16] max-h-[540px] rounded-3xl border border-border bg-black text-white shadow-2xl relative overflow-hidden flex flex-col justify-between p-4 font-sans">
      {/* Background Media */}
      {media ? (
        <img src={media} alt="" className="absolute inset-0 w-full h-full object-cover opacity-85" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-purple-950 to-black flex items-center justify-center">
          <Play className="h-12 w-12 text-white/40" />
        </div>
      )}

      {/* Top Header */}
      <div className="relative z-10 flex items-center justify-between text-xs font-bold pt-1">
        <span>Following</span>
        <span className="border-b-2 border-white pb-0.5">For You</span>
        <Volume2 className="h-4 w-4" />
      </div>

      {/* Side Actions & Bottom Info */}
      <div className="relative z-10 flex items-end justify-between gap-3">
        {/* User and Caption */}
        <div className="space-y-2 max-w-[70%]">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black">@dailycrm</span>
            <span className="bg-rose-500 text-[9px] px-1.5 py-0.2 rounded font-bold">Follow</span>
          </div>
          <p className="text-[11px] leading-tight text-white/90 line-clamp-3">{caption}</p>
          <div className="flex items-center gap-1 text-[10px] text-white/80">
            <Music2 className="h-3 w-3" />
            <span className="truncate">Daily CRM Original Sound - Growth Beats</span>
          </div>
        </div>

        {/* Right Action Stack */}
        <div className="flex flex-col items-center gap-3.5 pb-1">
          <div className="flex flex-col items-center">
            <div className="h-9 w-9 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center">
              <Heart className="h-5 w-5 text-rose-500 fill-rose-500" />
            </div>
            <span className="text-[10px] font-bold mt-0.5">24.5k</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="h-9 w-9 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center">
              <MessageCircle className="h-5 w-5 text-white" />
            </div>
            <span className="text-[10px] font-bold mt-0.5">842</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="h-9 w-9 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center">
              <Bookmark className="h-5 w-5 text-amber-400 fill-amber-400" />
            </div>
            <span className="text-[10px] font-bold mt-0.5">1.9k</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="h-9 w-9 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center">
              <Share2 className="h-5 w-5 text-white" />
            </div>
            <span className="text-[10px] font-bold mt-0.5">3.1k</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function YouTubePreview({
  post,
  override,
}: {
  post: Partial<SocialPost>;
  override?: PlatformContentOverride;
}) {
  const title = post.title || 'Daily CRM - Omnichannel CRM & Workflow Tutorial';
  const caption = override?.caption || post.defaultCaption || 'Learn how to automate marketing and sales in 2026.';
  const media = override?.mediaUrl || post.mediaUrl;

  return (
    <div className="mx-auto w-full max-w-[420px] rounded-2xl border border-border bg-card shadow-xl overflow-hidden font-sans">
      {/* Video Thumbnail */}
      <div className="relative aspect-video w-full bg-slate-900 flex items-center justify-center">
        {media ? (
          <img src={media} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="text-white/40 flex flex-col items-center">
            <Play className="h-10 w-10 mb-1" />
            <span className="text-xs">Video Thumbnail</span>
          </div>
        )}
        <span className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/80 text-white text-[10px] font-mono rounded">
          04:25
        </span>
      </div>

      <div className="p-3.5 space-y-2.5">
        <div className="flex items-start gap-3">
          <Avatar className="h-9 w-9 border border-border shrink-0">
            <AvatarImage src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150" />
            <AvatarFallback>YT</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-black text-foreground leading-snug line-clamp-2">{title}</h4>
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-1">
              <span className="font-bold text-foreground">Daily CRM Tech</span>
              <span>•</span>
              <span>18K views</span>
              <span>•</span>
              <span>1 day ago</span>
            </div>
          </div>
        </div>

        <div className="bg-muted/40 rounded-xl p-2.5 text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
          {caption}
        </div>
      </div>
    </div>
  );
}

export function ThreadsPreview({
  post,
  override,
}: {
  post: Partial<SocialPost>;
  override?: PlatformContentOverride;
}) {
  const caption = override?.caption || post.defaultCaption || 'Thoughts on omnichannel customer relationship workflows?';
  const media = override?.mediaUrl || post.mediaUrl;

  return (
    <div className="mx-auto w-full max-w-[400px] rounded-2xl border border-border bg-card shadow-xl p-4 font-sans space-y-3">
      <div className="flex items-start gap-3">
        <Avatar className="h-9 w-9 border border-border shrink-0">
          <AvatarImage src={post.creatorAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'} />
          <AvatarFallback>TH</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <span className="text-xs font-black text-foreground">dailycrm_official</span>
              <span className="text-[10px] text-muted-foreground">3h</span>
            </div>
            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
          </div>

          <p className="text-xs text-foreground leading-relaxed mt-1 whitespace-pre-line">{caption}</p>

          {media && (
            <div className="mt-2.5 rounded-xl overflow-hidden border border-border max-h-56 bg-muted">
              <img src={media} alt="" className="w-full h-full object-cover" />
            </div>
          )}

          <div className="flex items-center gap-4 text-foreground/80 pt-3 text-xs">
            <Heart className="h-4 w-4 hover:text-rose-500 cursor-pointer" />
            <MessageCircle className="h-4 w-4 hover:text-primary cursor-pointer" />
            <Repeat2 className="h-4 w-4 hover:text-emerald-500 cursor-pointer" />
            <Send className="h-4 w-4 hover:text-primary cursor-pointer" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function PinterestPreview({
  post,
  override,
}: {
  post: Partial<SocialPost>;
  override?: PlatformContentOverride;
}) {
  const caption = override?.caption || post.defaultCaption || 'Inspiration for modern CRM workflows and workspace productivity.';
  const media = override?.mediaUrl || post.mediaUrl;
  const link = override?.link || post.link || 'dailybuz.com';

  return (
    <div className="mx-auto w-full max-w-[340px] rounded-3xl border border-border bg-card shadow-xl overflow-hidden font-sans group">
      <div className="relative aspect-[2/3] w-full bg-muted/60 overflow-hidden">
        {media ? (
          <img src={media} alt={post.title || 'Pinterest Pin'} className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center text-muted-foreground">
            <Sparkles className="h-8 w-8 mb-2 opacity-40 text-rose-500" />
            <span className="text-xs font-semibold">Vertical Pin preview</span>
          </div>
        )}

        <div className="absolute top-3 right-3">
          <button type="button" className="px-3.5 py-1.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-md">
            Save
          </button>
        </div>

        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between bg-black/60 backdrop-blur-md rounded-full px-3 py-1.5 text-white text-[11px]">
          <span className="font-bold truncate flex items-center gap-1">
            <ExternalLink className="h-3 w-3" /> {link.replace(/^https?:\/\//, '')}
          </span>
          <div className="flex items-center gap-2">
            <Share2 className="h-3.5 w-3.5" />
            <MoreHorizontal className="h-3.5 w-3.5" />
          </div>
        </div>
      </div>

      <div className="p-3.5 space-y-1.5">
        <h4 className="font-bold text-xs text-foreground line-clamp-1">{post.title || 'Marketing Strategy & Workflows'}</h4>
        <p className="text-[11px] text-muted-foreground line-clamp-2">{caption}</p>
        <div className="flex items-center gap-2 pt-1">
          <Avatar className="h-5 w-5">
            <AvatarImage src={post.creatorAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'} />
            <AvatarFallback>DC</AvatarFallback>
          </Avatar>
          <span className="text-[11px] font-bold text-foreground truncate">Daily CRM Ideas</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Dynamic Platform Preview Container with Tab Switcher
 */
export function SocialPlatformPreview({
  post,
  selectedPlatform,
  availablePlatforms = ['instagram', 'linkedin', 'x'],
  onPlatformChange,
  className,
}: PostPreviewProps) {
  const [internalPlatform, setInternalPlatform] = useState<SocialPlatform>(selectedPlatform);

  const currentPlatform = onPlatformChange ? selectedPlatform : internalPlatform;
  const handlePlatformSelect = (p: SocialPlatform) => {
    if (onPlatformChange) {
      onPlatformChange(p);
    } else {
      setInternalPlatform(p);
    }
  };

  const override = post.platformOverrides?.[currentPlatform];

  return (
    <div className={cn('flex flex-col h-full rounded-2xl border border-border bg-muted/10 p-4 space-y-4', className)}>
      {/* Platform Switcher Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-xs font-black uppercase tracking-wider text-foreground">
            Live Preview
          </span>
        </div>

        {/* Platform tabs */}
        <div className="flex items-center gap-1 bg-background border border-border rounded-xl p-1 shadow-sm overflow-x-auto max-w-[260px]">
          {availablePlatforms.map((p) => {
            const meta = SOCIAL_PLATFORM_ICONS[p];
            if (!meta) return null;
            const Icon = meta.icon;
            const isSelected = currentPlatform === p;

            return (
              <button
                key={p}
                type="button"
                onClick={() => handlePlatformSelect(p)}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all capitalize shrink-0',
                  isSelected ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
                title={`Preview as ${p}`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline capitalize">{p}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Render matching live preview */}
      <div className="flex-1 flex items-center justify-center overflow-y-auto py-2">
        {currentPlatform === 'instagram' && <InstagramPreview post={post} override={override} />}
        {currentPlatform === 'linkedin' && <LinkedInPreview post={post} override={override} />}
        {currentPlatform === 'x' && <XPreview post={post} override={override} />}
        {currentPlatform === 'facebook' && <FacebookPreview post={post} override={override} />}
        {currentPlatform === 'tiktok' && <TikTokPreview post={post} override={override} />}
        {currentPlatform === 'youtube' && <YouTubePreview post={post} override={override} />}
        {currentPlatform === 'threads' && <ThreadsPreview post={post} override={override} />}
        {currentPlatform === 'pinterest' && <PinterestPreview post={post} override={override} />}
      </div>
    </div>
  );
}
