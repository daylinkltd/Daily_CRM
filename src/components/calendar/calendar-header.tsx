"use client";

import React from 'react';
import type {
  CalendarFilters,
  SocialPlatform,
  PostStatus,
  CRMActivityStatus,
  PrimaryFilter,
  UserRole,
} from '@/types/calendar';
import { PLATFORM_ICONS, STATUS_CONFIG } from './social-event-card';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Filter,
  Layers,
  Users,
  Share2,
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  Sparkles,
  UserCheck,
  Building,
  Check,
  ChevronsUpDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface CalendarHeaderProps {
  currentDate: Date;
  viewMode: 'month' | 'week' | 'list';
  onViewModeChange: (mode: 'month' | 'week' | 'list') => void;
  onNavigate: (dir: 'prev' | 'next' | 'today') => void;
  filters: CalendarFilters;
  onFilterChange: (filters: CalendarFilters) => void;
  currentUserRole: UserRole;
  onRoleSwitch: (roleKey: 'alex' | 'vivian' | 'admin') => void;
  onNewSocialPost: () => void;
  onNewCRMActivity: () => void;
  onOpenNoDate: () => void;
  noDateCount: number;
}

const ALL_CHANNELS: SocialPlatform[] = [
  'instagram',
  'facebook',
  'linkedin',
  'x',
  'tiktok',
  'youtube',
  'threads',
  'pinterest',
];

const SOCIAL_STATUSES: { value: PostStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending_approval', label: 'Pending Approval' },
  { value: 'changes_requested', label: 'Changes Requested' },
  { value: 'approved', label: 'Approved' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'published', label: 'Published' },
  { value: 'rejected', label: 'Rejected' },
];

const CRM_STATUSES: { value: CRMActivityStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All CRM Statuses' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'completed', label: 'Completed' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'cancelled', label: 'Cancelled' },
];

export function CalendarHeader({
  currentDate,
  viewMode,
  onViewModeChange,
  onNavigate,
  filters,
  onFilterChange,
  currentUserRole,
  onRoleSwitch,
  onNewSocialPost,
  onNewCRMActivity,
  onOpenNoDate,
  noDateCount,
}: CalendarHeaderProps) {
  // Format dynamic month and year
  const monthYearString = currentDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const toggleChannel = (channel: SocialPlatform) => {
    const exists = filters.channels.includes(channel);
    let nextChannels: SocialPlatform[];
    if (exists) {
      nextChannels = filters.channels.filter((c) => c !== channel);
    } else {
      nextChannels = [...filters.channels, channel];
    }
    onFilterChange({ ...filters, channels: nextChannels });
  };

  return (
    <div className="space-y-4 border-b border-border bg-card/50 p-4 sm:p-6 backdrop-blur-md">
      {/* Title & Top Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Calendar</h1>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary border border-primary/20">
              Unified CRM + Social
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage your CRM activities and social content in one place.
          </p>
        </div>

        {/* Action Controls: Role Switcher, No-Date Drawer, + New */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Active Demo Role Switcher */}
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted/30 transition-colors shadow-sm">
              <UserCheck className="h-3.5 w-3.5 text-primary" />
              <span>Role:</span>
              <span className="font-bold text-primary uppercase text-[10px]">
                {currentUserRole}
              </span>
              <ChevronsUpDown className="h-3 w-3 text-muted-foreground ml-1" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 p-1 bg-card border border-border">
              <DropdownMenuLabel className="text-[10px] uppercase font-bold text-muted-foreground px-2 py-1">
                View Perspective
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-border" />
              {[
                { key: 'admin', role: 'admin', title: 'Administrator', desc: 'Full authority & publishing' },
                { key: 'vivian', role: 'approver', title: 'Marketing Approver', desc: 'Review & approve posts' },
                { key: 'alex', role: 'creator', title: 'Marketing Creator', desc: 'Draft & submit content' },
              ].map((item) => (
                <DropdownMenuItem
                  key={item.key}
                  onClick={() => onRoleSwitch(item.key as 'alex' | 'vivian' | 'admin')}
                  className={cn(
                    'flex items-center justify-between rounded-lg px-2.5 py-2 text-xs font-bold cursor-pointer',
                    item.role === currentUserRole ? 'bg-primary/10 text-primary' : 'text-foreground'
                  )}
                >
                  <div>
                    <p className="font-bold">{item.title}</p>
                    <p className="text-[10px] text-muted-foreground font-normal">{item.desc}</p>
                  </div>
                  {item.role === currentUserRole && <Check className="h-4 w-4 text-primary" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* No Date Items Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenNoDate}
            className="relative h-9 rounded-xl text-xs font-bold"
          >
            <Layers className="h-3.5 w-3.5 mr-1.5 text-amber-500" />
            <span>No Date</span>
            {noDateCount > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-500 text-white text-[10px] px-1.5 py-0.2 font-extrabold">
                {noDateCount}
              </span>
            )}
          </Button>

          {/* + New Button */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button className="h-9 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl shadow-md">
                  <Plus className="h-4 w-4 mr-1 stroke-[3]" />
                  <span>+ New</span>
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-48 p-1 bg-card border border-border">
              <DropdownMenuLabel className="text-[10px] uppercase font-bold text-muted-foreground px-2 py-1">
                Create New
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem
                onClick={onNewSocialPost}
                className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-bold cursor-pointer text-foreground hover:bg-muted"
              >
                <Share2 className="h-4 w-4 text-pink-500" />
                <span>Social Post</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onNewCRMActivity}
                className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-bold cursor-pointer text-foreground hover:bg-muted"
              >
                <CalendarIcon className="h-4 w-4 text-blue-500" />
                <span>CRM Activity</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Main Navigation Toolbar: Date Controls + View Toggle + Filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between pt-2">
        {/* Date Navigator */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-background border border-border rounded-xl p-1 shadow-sm">
            <button
              type="button"
              onClick={() => onNavigate('prev')}
              className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-muted text-foreground transition-colors"
              title="Previous Month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-3 text-sm font-extrabold text-foreground min-w-[140px] text-center select-none">
              {monthYearString}
            </span>
            <button
              type="button"
              onClick={() => onNavigate('next')}
              className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-muted text-foreground transition-colors"
              title="Next Month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate('today')}
            className="h-9 rounded-xl text-xs font-bold"
          >
            Today
          </Button>

          {/* View Mode Buttons */}
          <div className="flex items-center bg-background border border-border rounded-xl p-1 shadow-sm">
            {(['month', 'week', 'list'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onViewModeChange(mode)}
                className={cn(
                  'px-3 py-1 text-xs font-extrabold capitalize rounded-lg transition-all',
                  viewMode === mode
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Bar */}
          <div className="relative min-w-[180px] flex-1 sm:flex-initial">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search calendar..."
              value={filters.searchQuery}
              onChange={(e) => onFilterChange({ ...filters, searchQuery: e.target.value })}
              className="h-9 pl-8 pr-3 text-xs rounded-xl border-border bg-background"
            />
          </div>

          {/* Primary Filter Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold text-foreground hover:bg-muted/30 transition-colors shadow-sm"
                >
                  <Filter className="h-3.5 w-3.5 text-primary" />
                  <span>
                    {filters.primary === 'all'
                      ? 'All Activity'
                      : filters.primary === 'crm'
                      ? 'CRM Activities'
                      : 'Social Media'}
                  </span>
                  <ChevronsUpDown className="h-3 w-3 text-muted-foreground ml-1" />
                </button>
              }
            />
            <DropdownMenuContent align="end" className="w-44 p-1 bg-card border border-border">
              {[
                { key: 'all', label: 'All Activity' },
                { key: 'social', label: 'Social Media' },
                { key: 'crm', label: 'CRM Activities' },
                { key: 'blog', label: 'Blog Posts' },
              ].map((item) => (
                <DropdownMenuItem
                  key={item.key}
                  onClick={() =>
                    onFilterChange({ ...filters, primary: item.key as PrimaryFilter })
                  }
                  className={cn(
                    'flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-bold cursor-pointer',
                    filters.primary === item.key ? 'bg-primary/10 text-primary' : 'text-foreground'
                  )}
                >
                  <span>{item.label}</span>
                  {filters.primary === item.key && <Check className="h-3.5 w-3.5 text-primary" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Social Status Filter (when Social or All selected) */}
          {filters.primary !== 'crm' && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold text-foreground hover:bg-muted/30 transition-colors shadow-sm"
                  >
                    <span>
                      {SOCIAL_STATUSES.find((s) => s.value === filters.socialStatus)?.label ||
                        'Social Status'}
                    </span>
                    <ChevronsUpDown className="h-3 w-3 text-muted-foreground ml-1" />
                  </button>
                }
              />
              <DropdownMenuContent align="end" className="w-48 p-1 bg-card border border-border">
                {SOCIAL_STATUSES.map((st) => (
                  <DropdownMenuItem
                    key={st.value}
                    onClick={() => onFilterChange({ ...filters, socialStatus: st.value })}
                    className={cn(
                      'flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-bold cursor-pointer',
                      filters.socialStatus === st.value
                        ? 'bg-primary/10 text-primary'
                        : 'text-foreground'
                    )}
                  >
                    <span>{st.label}</span>
                    {filters.socialStatus === st.value && (
                      <Check className="h-3.5 w-3.5 text-primary" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* CRM Status Filter (when CRM or All selected) */}
          {filters.primary !== 'social' && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold text-foreground hover:bg-muted/30 transition-colors shadow-sm"
                  >
                    <span>
                      {CRM_STATUSES.find((s) => s.value === filters.crmStatus)?.label ||
                        'CRM Status'}
                    </span>
                    <ChevronsUpDown className="h-3 w-3 text-muted-foreground ml-1" />
                  </button>
                }
              />
              <DropdownMenuContent align="end" className="w-44 p-1 bg-card border border-border">
                {CRM_STATUSES.map((st) => (
                  <DropdownMenuItem
                    key={st.value}
                    onClick={() => onFilterChange({ ...filters, crmStatus: st.value })}
                    className={cn(
                      'flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-bold cursor-pointer',
                      filters.crmStatus === st.value
                        ? 'bg-primary/10 text-primary'
                        : 'text-foreground'
                    )}
                  >
                    <span>{st.label}</span>
                    {filters.crmStatus === st.value && (
                      <Check className="h-3.5 w-3.5 text-primary" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Social Channel Multi-Select Bar (visible when Social or All selected) */}
      {filters.primary !== 'crm' && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-border/40">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mr-1">
            Channels:
          </span>
          <button
            type="button"
            onClick={() => onFilterChange({ ...filters, channels: [] })}
            className={cn(
              'rounded-lg px-2.5 py-1 text-xs font-bold transition-all border',
              filters.channels.length === 0
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-border hover:text-foreground'
            )}
          >
            All Channels
          </button>

          {ALL_CHANNELS.map((ch) => {
            const isSelected = filters.channels.includes(ch);
            const info = PLATFORM_ICONS[ch];
            if (!info) return null;
            const IconComp = info.icon;

            return (
              <button
                key={ch}
                type="button"
                onClick={() => toggleChannel(ch)}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition-all border',
                  isSelected
                    ? 'bg-primary/15 text-primary border-primary/40 shadow-sm'
                    : 'bg-background text-muted-foreground border-border hover:border-border/80'
                )}
              >
                <IconComp className={cn('h-3.5 w-3.5', isSelected ? 'text-primary' : '')} />
                <span className="capitalize">{ch}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
