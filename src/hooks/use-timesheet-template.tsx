"use client";

// The timesheet template assigned to the current member, so the daily
// log screen asks for exactly what punching out asks for. Without this
// the two surfaces drift: punch-out honours the template while the
// manual log offers a fixed task/hours/notes shape.

import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { parseAttendancePolicy } from "@/lib/attendance/policy";

export function useTimesheetTemplate() {
  const supabase = createClient();
  const { activeWorkspace, activeMember } = useWorkspace();
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [requiredOnPunchOut, setRequiredOnPunchOut] = useState(false);

  useEffect(() => {
    if (!activeWorkspace?.id || !activeMember?.id) return;
    let cancelled = false;

    void (async () => {
      const { data, error } = await supabase.rpc("resolve_attendance_policy", {
        p_workspace_id: activeWorkspace.id,
        p_workspace_member_id: activeMember.id,
        p_date: new Date().toISOString().split("T")[0],
      });
      if (cancelled || error) return;
      const policy = parseAttendancePolicy(data);
      setTemplateId(policy.timesheet_template_id);
      setRequiredOnPunchOut(policy.require_timesheet_on_punch_out);
    })();

    return () => { cancelled = true; };
  }, [supabase, activeWorkspace?.id, activeMember?.id]);

  return { templateId, requiredOnPunchOut };
}
