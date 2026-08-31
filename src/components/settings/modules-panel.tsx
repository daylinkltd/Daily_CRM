'use client';

// ============================================================
// Settings → Modules
//
// The same picker shown at signup, opened on what was chosen then. This
// is the page the onboarding copy promises ("you can change this later
// in Settings → Modules"), so it has to exist and it has to be the same
// control — a different one here would make the promise a half-truth.
//
// Owner/admin only, matching `set_workspace_modules`, which re-checks.
// ============================================================

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import { useWorkspace } from '@/hooks/use-workspace';
import { useAuth } from '@/hooks/use-auth';
import { MODULE_KEYS, type ModuleKey } from '@/lib/auth/modules';
import {
  ModulePicker,
  initialSelection,
  type ModuleSelection,
} from '@/components/workspace/module-picker';
import { SettingsPanelHead } from './settings-panel-head';

export function ModulesPanel() {
  const { activeWorkspace, refreshWorkspaces } = useWorkspace();
  const { accountRole } = useAuth();
  const supabase = createClient();

  const canEdit = accountRole === 'owner' || accountRole === 'admin';

  const [selection, setSelection] = useState<ModuleSelection>(() =>
    initialSelection(
      activeWorkspace?.business_type,
      activeWorkspace?.team_size,
      activeWorkspace?.enabled_modules,
    ),
  );
  const [saving, setSaving] = useState(false);

  // Re-seed when the workspace changes underneath us, otherwise
  // switching workspace would show the previous one's selection.
  useEffect(() => {
    setSelection(
      initialSelection(
        activeWorkspace?.business_type,
        activeWorkspace?.team_size,
        activeWorkspace?.enabled_modules,
      ),
    );
  }, [
    activeWorkspace?.id,
    activeWorkspace?.business_type,
    activeWorkspace?.team_size,
    activeWorkspace?.enabled_modules,
  ]);

  const save = async () => {
    if (!activeWorkspace?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase.rpc('set_workspace_modules', {
        p_workspace: activeWorkspace.id,
        // An empty selection is stored as "not chosen" and reads back as
        // every module — the database does that too. Sending it as-is
        // keeps one rule in one place.
        p_modules: selection.modules,
        p_business_type: selection.businessType,
        p_team_size: selection.teamSize,
      });
      if (error) {
        toast.error(error.message.replace(/^[a-z_]+: /, ''));
        return;
      }
      toast.success('Modules updated');
      // The sidebar is driven by this, so it must re-read rather than
      // wait for the next navigation.
      await refreshWorkspaces();
    } finally {
      setSaving(false);
    }
  };

  const enabledCount = selection.modules.length || MODULE_KEYS.length;

  return (
    <div className="flex flex-col gap-6">
      <SettingsPanelHead
        title="Modules"
        description="Which parts of the product this business uses. Anything switched off is hidden from the sidebar for everyone — nothing is deleted."
      />

      <div className="rounded-xl border border-border bg-background/40 p-4">
        <p className="text-sm font-bold text-foreground">
          {enabledCount} of {MODULE_KEYS.length} modules in use
        </p>
        <p className="text-xs text-muted-foreground">
          {selection.modules.length === 0
            ? 'Nothing selected, so every module is showing.'
            : 'Switching a module off hides it from everyone, including you.'}
        </p>
      </div>

      <ModulePicker
        value={selection}
        onChange={setSelection}
        compact
        disabled={!canEdit || saving}
      />

      {canEdit ? (
        <div>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Save className="size-3.5" />
            )}
            {saving ? 'Saving…' : 'Save modules'}
          </button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Only an owner or admin can change which modules this business uses.
        </p>
      )}
    </div>
  );
}

/** Narrow a stored list to real module keys, in canonical order. */
export function normaliseModules(stored: readonly string[] | null | undefined): ModuleKey[] {
  if (!stored || stored.length === 0) return [...MODULE_KEYS];
  return MODULE_KEYS.filter((k) => stored.includes(k));
}
