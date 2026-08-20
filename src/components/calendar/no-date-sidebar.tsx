"use client";

import React from 'react';
import type { CalendarEvent, SocialPost } from '@/types/calendar';
import { SocialEventCard } from './social-event-card';
import { CRMEventCard } from './crm-event-card';
import { X, Layers, AlertCircle, FileEdit, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NoDateSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  noDateEvents: CalendarEvent[];
  onSelectEvent: (event: CalendarEvent) => void;
  onReviewPost?: (post: SocialPost) => void;
}

export function NoDateSidebar({
  isOpen,
  onClose,
  noDateEvents,
  onSelectEvent,
  onReviewPost,
}: NoDateSidebarProps) {
  if (!isOpen) return null;

  const drafts = noDateEvents.filter((e) => e.category === 'social' && e.status === 'draft');
  const pending = noDateEvents.filter((e) => e.category === 'social' && e.status === 'pending_approval');
  const crmUndated = noDateEvents.filter((e) => e.category === 'crm');

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-background/80 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-card border-l border-border h-full flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-6 bg-muted/20">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-amber-500" />
              <h3 className="text-lg font-extrabold text-foreground tracking-tight">No Date Content</h3>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Unscheduled drafts, pending approval posts, and tasks. Drag items onto the calendar to assign dates.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Summary Badges */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-border bg-background p-3 text-center">
              <span className="text-xs font-black text-foreground block">{drafts.length}</span>
              <span className="text-[10px] text-muted-foreground font-extrabold uppercase">Drafts</span>
            </div>
            <div className="rounded-xl border border-border bg-background p-3 text-center">
              <span className="text-xs font-black text-amber-600 dark:text-amber-400 block">{pending.length}</span>
              <span className="text-[10px] text-muted-foreground font-extrabold uppercase">Pending</span>
            </div>
            <div className="rounded-xl border border-border bg-background p-3 text-center">
              <span className="text-xs font-black text-blue-500 block">{crmUndated.length}</span>
              <span className="text-[10px] text-muted-foreground font-extrabold uppercase">CRM Tasks</span>
            </div>
          </div>

          {/* Social Drafts Section */}
          {drafts.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                <FileEdit className="h-4 w-4 text-slate-500" />
                <span>Draft Social Posts ({drafts.length})</span>
              </div>
              <div className="space-y-2">
                {drafts.map((evt) => (
                  <SocialEventCard
                    key={evt.id}
                    post={evt as SocialPost}
                    compact
                    onClick={() => onSelectEvent(evt)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Pending Approval Section */}
          {pending.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                <Clock className="h-4 w-4" />
                <span>Pending Approval ({pending.length})</span>
              </div>
              <div className="space-y-2">
                {pending.map((evt) => (
                  <SocialEventCard
                    key={evt.id}
                    post={evt as SocialPost}
                    compact
                    onClick={() => onSelectEvent(evt)}
                    onReview={() => onReviewPost && onReviewPost(evt as SocialPost)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* CRM Undated Tasks */}
          {crmUndated.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-blue-500">
                <Layers className="h-4 w-4" />
                <span>CRM Tasks Without Date ({crmUndated.length})</span>
              </div>
              <div className="space-y-2">
                {crmUndated.map((evt) => (
                  <CRMEventCard
                    key={evt.id}
                    activity={evt}
                    compact
                    onClick={() => onSelectEvent(evt)}
                  />
                ))}
              </div>
            </div>
          )}

          {noDateEvents.length === 0 && (
            <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
              <Layers className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-xs font-bold">No undated items</p>
              <p className="text-[11px] mt-0.5">All social posts and CRM tasks currently have assigned dates.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
