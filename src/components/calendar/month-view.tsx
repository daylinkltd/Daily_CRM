"use client";

import React, { useState } from 'react';
import type { CalendarEvent, SocialPost, CRMActivity, BlogPost } from '@/types/calendar';
import { SocialEventCard } from './social-event-card';
import { CRMEventCard } from './crm-event-card';
import { BlogEventCard } from './blog-event-card';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface MonthViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onSelectEvent: (event: CalendarEvent) => void;
  onMoveEventDate: (eventId: string, newDate: string) => void;
  onReviewPost?: (post: SocialPost) => void;
  onViewHistory?: (post: SocialPost) => void;
  onViewAnalytics?: (post: SocialPost) => void;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function MonthView({
  currentDate,
  events,
  onSelectEvent,
  onMoveEventDate,
  onReviewPost,
  onViewHistory,
  onViewAnalytics,
}: MonthViewProps) {
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // First day of month (0-6)
  const firstDayIndex = new Date(year, month, 1).getDay();
  // Total days in current month
  const totalDays = new Date(year, month + 1, 0).getDate();
  // Total days in previous month
  const prevMonthTotalDays = new Date(year, month, 0).getDate();

  // Generate 35 or 42 grid cells
  const gridCells: { dateString: string; dayNumber: number; isCurrentMonth: boolean }[] = [];

  // Previous month trailing days
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const dayNum = prevMonthTotalDays - i;
    const prevDate = new Date(year, month - 1, dayNum);
    const dateString = prevDate.toISOString().split('T')[0];
    gridCells.push({ dateString, dayNumber: dayNum, isCurrentMonth: false });
  }

  // Current month days
  for (let day = 1; day <= totalDays; day++) {
    const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    gridCells.push({ dateString, dayNumber: day, isCurrentMonth: true });
  }

  // Next month leading days to complete week row
  const remainingCells = (7 - (gridCells.length % 7)) % 7;
  for (let i = 1; i <= remainingCells; i++) {
    const nextDate = new Date(year, month + 1, i);
    const dateString = nextDate.toISOString().split('T')[0];
    gridCells.push({ dateString, dayNumber: i, isCurrentMonth: false });
  }

  const todayStr = new Date().toISOString().split('T')[0];

  // Group events by date string
  const eventsByDate = React.useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    events.forEach((evt) => {
      if (evt.date) {
        if (!map[evt.date]) map[evt.date] = [];
        map[evt.date].push(evt);
      }
    });
    return map;
  }, [events]);

  const handleDragOver = (e: React.DragEvent, dateStr: string) => {
    e.preventDefault();
    setDragOverDate(dateStr);
  };

  const handleDragLeave = () => {
    setDragOverDate(null);
  };

  const handleDrop = (e: React.DragEvent, targetDate: string) => {
    e.preventDefault();
    setDragOverDate(null);
    const eventId = e.dataTransfer.getData('text/plain');
    if (!eventId) return;

    onMoveEventDate(eventId, targetDate);

    // Friendly date format for toast message (Requirement 28: "Post rescheduled to August 28.")
    const formatted = new Date(targetDate + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
    });
    toast.success(`Post rescheduled to ${formatted}.`);
  };

  return (
    <div className="flex flex-col h-full bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
      {/* 7-Column Header */}
      <div className="grid grid-cols-7 border-b border-border bg-muted/30 text-center font-extrabold text-xs text-muted-foreground uppercase tracking-wider py-3">
        {WEEKDAYS.map((day) => (
          <div key={day} className="truncate px-1">
            <span className="hidden sm:inline">{day}</span>
            <span className="sm:hidden">{day.slice(0, 3)}</span>
          </div>
        ))}
      </div>

      {/* 7-Column Days Grid */}
      <div className="grid grid-cols-7 auto-rows-fr flex-1 divide-x divide-y divide-border/60 bg-background min-h-[600px]">
        {gridCells.map((cell, idx) => {
          const dayEvents = eventsByDate[cell.dateString] || [];
          const isToday = cell.dateString === todayStr;
          const isOver = dragOverDate === cell.dateString;

          return (
            <div
              key={`${cell.dateString}-${idx}`}
              onDragOver={(e) => handleDragOver(e, cell.dateString)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, cell.dateString)}
              className={cn(
                'group min-h-[120px] p-2 flex flex-col transition-colors relative overflow-y-auto max-h-[220px]',
                cell.isCurrentMonth ? 'bg-card/40' : 'bg-muted/15 text-muted-foreground/50',
                isToday ? 'bg-primary/5' : '',
                isOver ? 'bg-primary/15 border-2 border-dashed border-primary ring-2 ring-primary/20' : ''
              )}
            >
              {/* Day Number Header */}
              <div className="flex items-center justify-between mb-1 shrink-0">
                <span
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full text-xs font-extrabold',
                    isToday
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : cell.isCurrentMonth
                      ? 'text-foreground'
                      : 'text-muted-foreground/60'
                  )}
                >
                  {cell.dayNumber}
                </span>

                {dayEvents.length > 0 && (
                  <span className="text-[10px] font-bold text-muted-foreground/70">
                    {dayEvents.length} {dayEvents.length === 1 ? 'item' : 'items'}
                  </span>
                )}
              </div>

              {/* Day Events Stack (Social + CRM + Blog together) */}
              <div className="space-y-1.5 flex-1 overflow-y-auto pr-0.5">
                {dayEvents.map((evt) => {
                  if (evt.category === 'social') {
                    return (
                      <SocialEventCard
                        key={evt.id}
                        post={evt}
                        compact
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
