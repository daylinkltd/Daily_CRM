"use client";

// The create half of the CreatableSelect pattern for customers: a
// minimal contact form (the CRM's full editor stays where it is) so a
// job, invoice or deal can mint the person it's for without leaving the
// screen. Inserts into the same `contacts` table the CRM reads.

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, UserPlus } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

export interface CreatedContact {
  id: string;
  name: string;
  company: string | null;
}

export function QuickCreateContact({
  open,
  onOpenChange,
  workspaceId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string | null | undefined;
  /** Receives the new contact; the caller selects it and refreshes. */
  onCreated: (contact: CreatedContact) => void;
}) {
  const supabase = createClient();
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!workspaceId || !user) return;
    if (!name.trim()) {
      toast.error("A name is required");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("contacts")
        .insert({
          user_id: user.id,
          workspace_id: workspaceId,
          name: name.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
          company: company.trim() || null,
        })
        .select("id, name, company")
        .single();
      if (error) throw error;
      toast.success(`${data.name} added to contacts`);
      setName(""); setPhone(""); setEmail(""); setCompany("");
      onOpenChange(false);
      onCreated(data as CreatedContact);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create the contact");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="size-4 text-primary" /> New customer
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name *" autoFocus />
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" />
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
          <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company" />
          <p className="text-xs text-muted-foreground">
            Lands in CRM → Contacts like any other contact — enrich them there later.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleCreate} disabled={saving}>
            {saving ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
            Create contact
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
