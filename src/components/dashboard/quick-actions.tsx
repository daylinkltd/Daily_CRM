"use client"

import Link from 'next/link'
import { UserPlus, Briefcase, Radio, Zap } from 'lucide-react'
import type { ComponentType } from 'react'
import { Card } from '@/components/ui/card'

// Quick-action shortcuts. Each navigates to the page that owns the
// relevant "create" flow. We deliberately don't try to auto-open any
// modal on the target page — that'd require touching those pages,
// which is out of scope here.
interface Action {
  label: string
  description?: string
  href: string
  icon: ComponentType<{ className?: string }>
  tint: string
}

const ACTIONS: Action[] = [
  { label: 'New Contact', description: 'Save customer record', href: '/contacts', icon: UserPlus, tint: 'text-primary' },
  { label: 'New Deal', description: 'Create pipeline deal', href: '/pipelines', icon: Briefcase, tint: 'text-blue-400' },
  { label: 'New Broadcast', description: 'Reach audience at scale', href: '/broadcasts/new', icon: Radio, tint: 'text-amber-400' },
  { label: 'New Automation', description: 'Trigger workflow on event', href: '/automations/new', icon: Zap, tint: 'text-primary' },
]

export function QuickActions() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {ACTIONS.map((action) => {
        const Icon = action.icon
        return (
          <Link key={action.href} href={action.href}>
            <Card className="flex items-center gap-3.5 p-4 transition-all hover:border-border bg-card border-border">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-muted ${action.tint}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-foreground truncate">{action.label}</div>
                <div className="text-xs text-muted-foreground truncate">{action.description}</div>
              </div>
            </Card>
          </Link>
        )
      })}
    </div>
  )
}
