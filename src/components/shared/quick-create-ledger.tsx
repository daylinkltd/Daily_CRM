"use client";

// The create half of the CreatableSelect pattern for ledger accounts:
// mid-voucher, the account you need is the one that doesn't exist yet.
// Same insert the Ledgers page makes (is_system always false — the
// engine's role catalogue can't be minted from a picker).

import { useState } from "react";
import { toast } from "sonner";
import { BookOpen, Loader2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const ACCOUNT_TYPES = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"] as const;

export interface CreatedLedger {
  id: string;
  account_code: string;
  account_name: string;
}

export function QuickCreateLedger({
  open,
  onOpenChange,
  workspaceId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string | null | undefined;
  onCreated: (ledger: CreatedLedger) => void;
}) {
  const supabase = createClient();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("EXPENSE");
  const [group, setGroup] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!workspaceId) return;
    if (!code.trim() || !name.trim()) {
      toast.error("Code and name are required");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("commerce_chart_of_accounts")
        .insert({
          workspace_id: workspaceId,
          account_code: code.trim(),
          account_name: name.trim(),
          account_type: type,
          ledger_group: group.trim() || null,
          opening_balance: 0,
          is_system: false,
        })
        .select("id, account_code, account_name")
        .single();
      if (error) throw error;
      toast.success(`Ledger ${data.account_name} created`);
      setCode(""); setName(""); setGroup("");
      onOpenChange(false);
      onCreated(data as CreatedLedger);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create the ledger");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="size-4 text-primary" /> New ledger
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code * (e.g. 6020)" autoFocus />
            <Select value={type} onValueChange={(v) => v && setType(v)}>
              <SelectTrigger aria-label="Account type"><SelectValue /></SelectTrigger>
              <SelectContent searchable={false}>
                {ACCOUNT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name * (e.g. Office Rent)" />
          <Input value={group} onChange={(e) => setGroup(e.target.value)} placeholder="Group (optional)" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleCreate} disabled={saving}>
            {saving ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
            Create ledger
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
