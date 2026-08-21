"use client";

import React from 'react';
import type { SocialPost } from '@/types/calendar';
import { X, BarChart2, Heart, MessageSquare, Share2, Eye, TrendingUp, MousePointer } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PostAnalyticsModalProps {
  post: SocialPost | null;
  onClose: () => void;
}

export function PostAnalyticsModal({ post, onClose }: PostAnalyticsModalProps) {
  if (!post || !post.analytics) return null;

  const { likes, comments, shares, reach, engagementRate, clicks } = post.analytics;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md p-4">
      <div className="relative w-full max-w-lg rounded-3xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-6 bg-muted/20">
          <div className="flex items-center gap-2">
            <BarChart2 className="h-5 w-5 text-primary" />
            <div>
              <h3 className="text-base font-extrabold text-foreground tracking-tight">
                Post Analytics & Performance
              </h3>
              <p className="text-xs text-muted-foreground truncate max-w-xs">{post.title}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Metrics Grid */}
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-border bg-background p-4 flex flex-col items-center justify-center text-center">
              <Eye className="h-5 w-5 text-blue-500 mb-1" />
              <span className="text-lg font-black text-foreground">{reach.toLocaleString()}</span>
              <span className="text-[10px] text-muted-foreground font-extrabold uppercase mt-0.5">Total Reach</span>
            </div>

            <div className="rounded-2xl border border-border bg-background p-4 flex flex-col items-center justify-center text-center">
              <TrendingUp className="h-5 w-5 text-emerald-500 mb-1" />
              <span className="text-lg font-black text-emerald-500">{engagementRate}%</span>
              <span className="text-[10px] text-muted-foreground font-extrabold uppercase mt-0.5">Engagement Rate</span>
            </div>

            <div className="rounded-2xl border border-border bg-background p-4 flex flex-col items-center justify-center text-center">
              <Heart className="h-5 w-5 text-pink-500 mb-1" />
              <span className="text-lg font-black text-foreground">{likes.toLocaleString()}</span>
              <span className="text-[10px] text-muted-foreground font-extrabold uppercase mt-0.5">Likes</span>
            </div>

            <div className="rounded-2xl border border-border bg-background p-4 flex flex-col items-center justify-center text-center">
              <MessageSquare className="h-5 w-5 text-purple-500 mb-1" />
              <span className="text-lg font-black text-foreground">{comments.toLocaleString()}</span>
              <span className="text-[10px] text-muted-foreground font-extrabold uppercase mt-0.5">Comments</span>
            </div>

            <div className="rounded-2xl border border-border bg-background p-4 flex flex-col items-center justify-center text-center">
              <Share2 className="h-5 w-5 text-indigo-500 mb-1" />
              <span className="text-lg font-black text-foreground">{shares.toLocaleString()}</span>
              <span className="text-[10px] text-muted-foreground font-extrabold uppercase mt-0.5">Shares</span>
            </div>

            <div className="rounded-2xl border border-border bg-background p-4 flex flex-col items-center justify-center text-center">
              <MousePointer className="h-5 w-5 text-cyan-500 mb-1" />
              <span className="text-lg font-black text-foreground">{clicks.toLocaleString()}</span>
              <span className="text-[10px] text-muted-foreground font-extrabold uppercase mt-0.5">Link Clicks</span>
            </div>
          </div>

          <div className="rounded-2xl bg-primary/5 p-4 border border-primary/20 text-xs text-muted-foreground flex items-center gap-3">
            <BarChart2 className="h-5 w-5 text-primary shrink-0" />
            <p>
              This post metrics interface is ready for live Buffer / Platform analytics connection.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end p-4 border-t border-border bg-muted/20">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="rounded-xl text-xs font-bold"
          >
            Close Analytics
          </Button>
        </div>
      </div>
    </div>
  );
}
