'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useWorkspace } from '@/hooks/use-workspace';
import { ShieldAlert, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { IconAction } from "@/components/ui/icon-action";

export function ComplianceBanner() {
  const supabase = createClient();
  const router = useRouter();
  const { activeWorkspace, activeMember } = useWorkspace();

  const [pendingPolicies, setPendingPolicies] = useState<any[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    async function checkPendingPolicies() {
      if (!activeWorkspace?.id || !activeMember?.id) return;

      // 1. Fetch published mandatory policies
      const { data: policies } = await supabase
        .from('hr_policies')
        .select(`
          id,
          title,
          category,
          versions:hr_policy_versions!inner(*),
          targets:hr_policy_targets(*)
        `)
        .eq('workspace_id', activeWorkspace.id)
        .eq('status', 'PUBLISHED')
        .eq('versions.mandatory', true);

      if (!policies || policies.length === 0) return;

      // 2. Fetch member's active acknowledgements
      const { data: acks } = await supabase
        .from('hr_policy_acknowledgements')
        .select('version_id')
        .eq('workspace_member_id', activeMember.id)
        .eq('status', 'ACTIVE');

      const signedVersionIds = new Set(acks?.map(a => a.version_id) || []);

      // Filter policies that have a published version un-acknowledged by this member
      const unacknowledged = policies.filter(p => {
        const pubVer = Array.isArray(p.versions) ? p.versions.find((v: any) => v.published_at) : p.versions;
        return pubVer && !signedVersionIds.has(pubVer.id);
      });

      setPendingPolicies(unacknowledged);
    }

    checkPendingPolicies();
  }, [activeWorkspace?.id, activeMember?.id, supabase]);

  if (dismissed || pendingPolicies.length === 0) return null;

  const firstPending = pendingPolicies[0];

  return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-amber-900 dark:text-amber-200 flex items-center justify-between shadow-xs mb-6">
      <div className="flex items-center gap-3">
        <div className="size-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
          <ShieldAlert className="size-4" />
        </div>
        <div>
          <p className="text-sm font-semibold">
            Action Required: {pendingPolicies.length} mandatory HR {pendingPolicies.length === 1 ? 'policy requires' : 'policies require'} your review & legal sign-off.
          </p>
          <p className="text-xs opacity-80">
            {firstPending.title} ({firstPending.category.replace(/_/g, ' ')})
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <IconAction label="Review & Sign" icon={<ChevronRight className="size-3.5 ml-1" />} onClick={() => router.push(`/policies/${firstPending.id}/read`)}
          className="bg-amber-600 hover:bg-amber-700 text-foreground border-none text-xs" />
        <button
          onClick={() => setDismissed(true)}
          className="p-1 hover:bg-amber-500/20 rounded-none text-amber-700 dark:text-amber-300"
          title="Dismiss notification"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
