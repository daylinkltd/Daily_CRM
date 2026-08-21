"use client";

import React from 'react';
import Link from 'next/link';
import type { CalendarEvent, CRMActivity } from '@/types/calendar';
import { PLATFORM_ICONS } from '@/components/calendar/social-event-card';
import { Calendar as CalendarIcon, Clock, ArrowRight, Phone, CheckSquare, Briefcase, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface UpcomingActivitiesWidgetProps {
  events?: CalendarEvent[];
}

export function UpcomingActivitiesWidget({ events = [] }: UpcomingActivitiesWidgetProps) {
  // Sort events chronologically
  const upcomingList = React.useMemo(() => {
    if (!events || events.length === 0) return [];
    return [...events]
      .filter((e) => e.date)
      .sort((a, b) => {
        const dateA = a.date || '';
        const dateB = b.date || '';
        if (dateA !== dateB) return dateA.localeCompare(dateB);
        return (a.time || '00:00').localeCompare(b.time || '00:00');
      })
      .slice(0, 6);
  }, [events]);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm">
      <div className="flex items-center justify-between border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <CalendarIcon className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-extrabold text-base text-foreground tracking-tight">
              Upcoming Activities
            </h3>
            <p className="text-xs text-muted-foreground">Unified schedule for CRM and Social Media.</p>
          </div>
        </div>

        <Link href="/calendar">
          <Button variant="ghost" size="sm" className="h-8 text-xs font-bold text-primary">
            View All <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </Link>
      </div>

      <div className="space-y-2">
        {upcomingList.map((evt) => {
          if (evt.category === 'social') {
            const firstCh = evt.channels[0] || 'instagram';
            const iconInfo = PLATFORM_ICONS[firstCh];
            const IconComp = iconInfo ? iconInfo.icon : Share2;

            return (
              <div
                key={evt.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background p-3 hover:border-primary/40 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border text-xs', iconInfo?.color)}>
                    <IconComp className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-foreground truncate">{evt.title}</h4>
                    <p className="text-[10px] text-muted-foreground capitalize">
                      {evt.channels.join(', ')} • {evt.status.replace('_', ' ')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="rounded-full bg-pink-500/10 px-2 py-0.5 text-[9px] font-extrabold uppercase text-pink-500 border border-pink-500/20">
                    Social
                  </span>
                  <span className="text-xs font-mono font-bold text-muted-foreground">
                    {evt.time || '12:00'}
                  </span>
                </div>
              </div>
            );
          }

          if (evt.category === 'blog') {
            return (
              <div
                key={evt.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background p-3 hover:border-purple-500/40 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 text-purple-500 border border-purple-500/20">
                    <CalendarIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-foreground truncate">{evt.title}</h4>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {evt.authorName} · Blog
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-[9px] font-extrabold uppercase text-purple-500 border border-purple-500/20">
                    Blog
                  </span>
                  <span className="text-xs font-mono font-bold text-muted-foreground">
                    {evt.time || '09:00'}
                  </span>
                </div>
              </div>
            );
          }

          const crmAct = evt as CRMActivity;
          return (
            <div
              key={crmAct.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background p-3 hover:border-primary/40 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20">
                  <CalendarIcon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-foreground truncate">{crmAct.title}</h4>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {crmAct.contactName || crmAct.companyName || crmAct.type}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[9px] font-extrabold uppercase text-blue-500 border border-blue-500/20">
                  CRM
                </span>
                <span className="text-xs font-mono font-bold text-muted-foreground">
                  {crmAct.time || '10:00'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
