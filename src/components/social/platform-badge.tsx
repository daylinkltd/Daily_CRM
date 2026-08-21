import React from 'react';
import { cn } from '@/lib/utils';
import type { SocialPlatform } from '@/types/calendar';
import { SOCIAL_PLATFORM_ICONS } from '@/components/calendar/social-icons';

interface PlatformBadgeProps {
  platform: SocialPlatform;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function PlatformBadge({ platform, showLabel = false, size = 'md', className }: PlatformBadgeProps) {
  const meta = SOCIAL_PLATFORM_ICONS[platform];
  if (!meta) return null;
  const Icon = meta.icon;

  const iconSizes = { sm: 'h-3 w-3', md: 'h-3.5 w-3.5', lg: 'h-4 w-4' };
  const containerSizes = { sm: 'h-5 w-5', md: 'h-6 w-6', lg: 'h-7 w-7' };
  const textSizes = { sm: 'text-[9px]', md: 'text-[10px]', lg: 'text-xs' };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-semibold',
        showLabel ? 'px-2 py-0.5 border' : '',
        meta.color,
        className
      )}
    >
      <span
        className={cn(
          'flex items-center justify-center rounded-full',
          showLabel ? '' : containerSizes[size],
          showLabel ? '' : meta.color
        )}
      >
        <Icon className={iconSizes[size]} />
      </span>
      {showLabel && <span className={textSizes[size]}>{meta.label}</span>}
    </span>
  );
}

interface PlatformIconStackProps {
  platforms: SocialPlatform[];
  max?: number;
  size?: 'sm' | 'md' | 'lg';
}

export function PlatformIconStack({ platforms, max = 4, size = 'sm' }: PlatformIconStackProps) {
  const visible = platforms.slice(0, max);
  const overflow = platforms.length - max;
  const iconSizes = { sm: 'h-3 w-3', md: 'h-3.5 w-3.5', lg: 'h-4 w-4' };
  const containerSizes = { sm: 'h-5 w-5', md: 'h-6 w-6', lg: 'h-7 w-7' };

  return (
    <div className="flex items-center gap-1">
      {visible.map((p) => {
        const meta = SOCIAL_PLATFORM_ICONS[p];
        if (!meta) return null;
        const Icon = meta.icon;
        return (
          <span
            key={p}
            className={cn(
              'flex items-center justify-center rounded-full border border-background',
              containerSizes[size],
              meta.color
            )}
            title={meta.label}
          >
            <Icon className={iconSizes[size]} />
          </span>
        );
      })}
      {overflow > 0 && (
        <span className={cn('flex items-center justify-center rounded-full bg-muted text-muted-foreground border border-background text-[9px] font-bold', containerSizes[size])}>
          +{overflow}
        </span>
      )}
    </div>
  );
}
