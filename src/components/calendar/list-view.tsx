"use client";

import React from 'react';
import type { CalendarEvent, SocialPost } from '@/types/calendar';
import { SocialEventCard } from './social-event-card';
import { CRMEventCard } from './crm-event-card';
import { BlogEventCard } from './blog-event-card';
import { Calendar as CalendarIcon } from 'lucide-react';

interface ListViewProps {
  events: CalendarEvent[];
  onSelectEvent: (event: CalendarEvent) => void;
  onReviewPost?: (post: SocialPost) => void;
  onViewHistory?: (post: SocialPost) => void;
  onViewAnalytics?: (post: SocialPost) => void;
}

export function ListView({
  events,
  onSelectEvent,
  onReviewPost,
  onViewHistory,
  onViewAnalytics,
}: ListViewProps) {
  // Sort events chronologically by date & time
  const sortedEvents = React.useMemo(() => {
    return [...events].sort((a, b) => {
      const dateA = a.date || '9999-12-31';
      const dateB = b.date || '9999-12-31';
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      const timeA = a.time || '00:00';
      const timeB = b.time || '00:00';
      return timeA.localeCompare(timeB);
    });
  }, [events]);

  // Group by date string
  const grouped = React.useMemo(() => {
    const groups: { dateStr: string; label: string; items: CalendarEvent[] }[] = [];
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    sortedEvents.forEach((evt) => {
      const dateKey = evt.date || 'no_date';
      let existing = groups.find((g) => g.dateStr === dateKey);

      if (!existing) {
        let label = 'Unscheduled / No Date';
        if (evt.date) {
          if (evt.date === todayStr) {
            label = 'TODAY';
          } else if (evt.date === tomorrowStr) {
            label = 'TOMORROW';
          } else {
            const dateObj = new Date(evt.date + 'T00:00:00');
            label = dateObj.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });
          }
        }
        existing = { dateStr: dateKey, label, items: [] };
        groups.push(existing);
      }

      existing.items.push(evt);
    });

    return groups;
  }, [sortedEvents]);

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-card rounded-2xl border border-border">
        <CalendarIcon className="h-10 w-10 text-muted-foreground/50 mb-3" />
        <h3 className="font-extrabold text-foreground text-base">No matching events found</h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">
          Try clearing search keywords or switching filters in the top toolbar to see more content and activities.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {grouped.map((group) => (
        <div key={group.dateStr} className="space-y-3">
          {/* Group Heading */}
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <span className="flex h-6 px-2.5 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-black uppercase tracking-wider">
              {group.label}
            </span>
            <span className="text-xs font-bold text-muted-foreground">
              ({group.items.length} {group.items.length === 1 ? 'activity' : 'activities'})
            </span>
          </div>

          {/* Cards List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {group.items.map((evt) => {
              if (evt.category === 'social') {
                return (
                  <SocialEventCard
                    key={evt.id}
                    post={evt}
                    onClick={() => onSelectEvent(evt)}
                    onReview={() => onReviewPost && onReviewPost(evt)}
                    onViewHistory={() => onViewHistory && onViewHistory(evt)}
                    onViewAnalytics={() => onViewAnalytics && onViewAnalytics(evt)}
                  />
                );
              }
              if (evt.category === 'blog') {
                return (
                  <BlogEventCard
                    key={evt.id}
                    post={evt}
                    onClick={() => onSelectEvent(evt)}
                  />
                );
              }
              return (
                <CRMEventCard
                  key={evt.id}
                  activity={evt}
                  onClick={() => onSelectEvent(evt)}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
