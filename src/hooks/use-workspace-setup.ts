"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { evaluateSetup, type SetupStatus, type SetupFacts } from "@/lib/workspace/setup-checklist";

/**
 * Gathers what the setup checklist needs to know.
 *
 * Deliberately cheap: head-only counts, no row payloads, and it only runs
 * for people who can actually act on the result. Showing a member a
 * checklist they cannot complete is worse than showing nothing.
 */
export function useWorkspaceSetup(): {
  status: SetupStatus | null;
  loading: boolean;
  refresh: () => void;
  canAct: boolean;
} {
  const supabase = createClient();
  const { activeWorkspace, moduleAccess, can, activeRole } = useWorkspace();
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [loading, setLoading] = useState(true);

  // Only owners and admins can change branding, signatories or structures.
  const canAct =
    activeRole === "owner" || activeRole === "admin" || can("settings_workspace");

  const load = useCallback(async () => {
    if (!activeWorkspace?.id || !canAct) {
      setStatus(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const ws = activeWorkspace as {
        id: string;
        name?: string | null;
        logo_url?: string | null;
        company_name?: string | null;
        company_address?: string | null;
      };

      const count = async (table: string, extra?: (q: unknown) => unknown) => {
        let q = supabase
          .from(table)
          .select("*", { count: "exact", head: true })
          .eq("workspace_id", activeWorkspace.id);
        if (extra) q = extra(q) as typeof q;
        const { count: n, error } = await q;
        // A failed count must not read as zero, or the banner nags about
        // something that is actually configured.
        return error ? null : n ?? 0;
      };

      const [sig, dept, loc, struct, letterhead, whatsapp] = await Promise.all([
        count("company_signatories", (q) => (q as { is: Function }).is("deleted_at", null)),
        count("departments"),
        count("work_locations", (q) => (q as { is: Function }).is("deleted_at", null)),
        count("hr_salary_structures", (q) => (q as { is: Function }).is("deleted_at", null)),
        supabase
          .from("company_letterhead_configs")
          .select("company_name, tax_id")
          .eq("workspace_id", activeWorkspace.id)
          .maybeSingle(),
        supabase
          .from("whatsapp_config")
          .select("id")
          .eq("workspace_id", activeWorkspace.id)
          .maybeSingle(),
      ]);

      const lh = letterhead.data as { company_name?: string | null; tax_id?: string | null } | null;

      const facts: SetupFacts = {
        companyName: Boolean((ws.company_name || lh?.company_name || "").trim()),
        logo: Boolean(ws.logo_url),
        // A letterhead row with a company name on it is the minimum that
        // makes a document look like it came from a company.
        letterheadConfigured: Boolean(lh && (lh.company_name || "").trim()),
        taxId: Boolean((lh?.tax_id || "").trim()),
        companyAddress: Boolean((ws.company_address || "").trim()),
        signatoryCount: sig ?? 1,
        departmentCount: dept ?? 1,
        workLocationCount: loc ?? 1,
        salaryStructureCount: struct ?? 1,
        whatsappConnected: Boolean(whatsapp.data),
        modules: {
          hr: Boolean(moduleAccess?.hr),
          crm: Boolean(moduleAccess?.crm),
          accounting: Boolean(moduleAccess?.accounting),
        },
      };

      setStatus(evaluateSetup(facts));
    } catch {
      // Never block the app on the checklist.
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace, canAct, moduleAccess, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  return { status, loading, refresh: load, canAct };
}
