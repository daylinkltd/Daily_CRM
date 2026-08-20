"use client";

import React from 'react';
import type { CalendarEvent, SocialPost } from '@/types/calendar';
import { SocialEventCard } from './social-event-card';
import { CRMEventCard } from './crm-event-card';
import { BlogEventCard } from './blog-event-card';
import { cn } from '@/lib/utils';

interface WeekViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onSelectEvent: (event: CalendarEvent) => void;
  onReviewPost?: (post: SocialPost) => void;
}

const HOURS = [
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
  '19:00',
  '20:00',
];

export function WeekView({ currentDate, events, onSelectEvent, onReviewPost }: WeekViewProps) {
  // Compute start of week (Sunday)
  const startOfWeek = new Date(currentDate);
  startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());

  const weekDays = Array.from({ length: 7 }).map((_, i) => {
    const day = new Date(startOfWeek);
    day.setDate(startOfWeek.getDate() + i);
    const dateStr = day.toISOString().split('T')[0];
    const dayName = day.toLocaleDateString('en-US', { weekday: 'short' });
    const dayNum = day.getDate();
    return { dateStr, dayName, dayNum };
  });

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="flex flex-col h-full bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
      {/* Week Days Header */}
      <div className="grid grid-cols-[80px_repeat(7,1fr)] border-b border-border bg-muted/30 text-center font-bold text-xs py-3">
        <div className="text-muted-foreground uppercase text-[10px] self-center">Time</div>
        {weekDays.map((d) => {
          const isToday = d.dateStr === todayStr;
          return (
            <div key={d.dateStr} className="flex flex-col items-center justify-center">
              <span className="text-[10px] text-muted-foreground uppercase">{d.dayName}</span>
              <span
                className={cn(
                  'h-6 w-6 rounded-full flex items-center justify-center font-extrabold text-xs mt-0.5',
                  isToday ? 'bg-primary text-primary-foreground' : 'text-foreground'
                )}
              >
                {d.dayNum}
              </span>
            </div>
          );
        })}
      </div>

      {/* Hourly Grid */}
      <div className="flex-1 overflow-y-auto max-h-[700px] divide-y divide-border/60">
        {HOURS.map((hour) => {
          const hourInt = parseInt(hour.split(':')[0], 10);

          return (
            <div key={hour} className="grid grid-cols-[80px_repeat(7,1fr)] min-h-[90px] divide-x divide-border/40">
              {/* Time Label */}
              <div className="p-2 text-center text-[10px] font-mono font-medium text-muted-foreground bg-muted/10 self-start">
                {hour}
              </div>

              {/* 7 Days Columns */}
              {weekDays.map((d) => {
                // Find events matching date & hour
                const matchingEvents = events.filter((evt) => {
                  if (evt.date !== d.dateStr) return false;
                  if (!evt.time) return hourInt === 12; // default to noon if time unassigned
                  const evtHour = parseInt(evt.time.split(':')[0], 10);
                  return evtHour === hourInt;
                });

                return (
                  <div key={d.dateStr} className="p-1 space-y-1 bg-background/50 hover:bg-muted/10 transition-colors min-h-[90px]">
                    {matchingEvents.map((evt) => {
                      if (evt.category === 'social') {
                        return (
                          <SocialEventCard
                            key={evt.id}
                            post={evt}
                            compact
                            onClick={() => onSelectEvent(evt)}
                            onReview={() => onReviewPost && onReviewPost(evt)}
                          />
                        );
                      }
                      if (evt.category === 'blog') {
                        return (
                          <BlogEventCard
                            key={evt.id}
                            post={evt}
                            compact
                            onClick={() => onSelectEvent(evt)}
                          />
                        );
                      }
                      return (
                        <CRMEventCard
                          key={evt.id}
                          activity={evt}
                          compact
                          onClick={() => onSelectEvent(evt)}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
