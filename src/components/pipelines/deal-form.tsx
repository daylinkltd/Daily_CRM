"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type {
  Contact,
  Conversation,
  Deal,
  DealStatus,
  PipelineStage,
  Profile,
} from "@/types";
import { useWorkspace } from "@/hooks/use-workspace";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Check,
  X,
  Trash2,
  MessageSquare,
  DollarSign,
  Loader2,
  File,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

interface DealFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal?: Deal | null;
  pipelineId: string;
  stages: PipelineStage[];
  defaultStageId?: string;
  onSaved: () => void;
}
import { useRef } from "react";

export function DealForm({
  open,
  onOpenChange,
  deal,
  pipelineId,
  stages,
  defaultStageId,
  onSaved,
}: DealFormProps) {
  const supabase = createClient();
  const { activeWorkspace } = useWorkspace();

  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [contactId, setContactId] = useState("");
  const [stageId, setStageId] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [expectedCloseDate, setExpectedCloseDate] = useState("");
  const [notes, setNotes] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [lostReasonId, setLostReasonId] = useState("");

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [reasons, setReasons] = useState<any[]>([]);
  const [isAddingSource, setIsAddingSource] = useState(false);
  const [newSourceName, setNewSourceName] = useState("");
  const [showLostReasonPrompt, setShowLostReasonPrompt] = useState(false);

  const [linkedConversation, setLinkedConversation] =
    useState<Conversation | null>(null);

  const [saving, setSaving] = useState(false);
  const [statusAction, setStatusAction] = useState<DealStatus | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [files, setFiles] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset the form fields every time the sheet opens or its input
  // props change. This is a legitimate prop-driven sync; the rule is
  // over-cautious here, hence the block-level disable.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return;
    setConfirmDelete(false);
    if (deal) {
      setTitle(deal.title);
      setValue(String(deal.value ?? ""));
      setCurrency(deal.currency || "USD");
      // contact_id is nullable when the contact has been deleted
      // (migration 004: ON DELETE SET NULL). "" means "no selection".
      setContactId(deal.contact_id ?? "");
      setStageId(deal.stage_id);
      setAssignedTo(deal.assigned_to ?? "");
      setExpectedCloseDate(deal.expected_close_date ?? "");
      setNotes(deal.notes ?? "");
      setSourceId(deal.source_id ?? "");
      setLostReasonId(deal.lost_reason_id ?? "");
    } else {
      setTitle("");
      setValue("");
      setCurrency("USD");
      setContactId("");
      setStageId(defaultStageId || stages[0]?.id || "");
      setAssignedTo("");
      setExpectedCloseDate("");
      setNotes("");
      setSourceId("");
      setLostReasonId("");
    }
  }, [open, deal, defaultStageId, stages]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Load supporting data once the sheet is open
  useEffect(() => {
    if (!open || !activeWorkspace?.id) return;
    let cancelled = false;
    (async () => {
      const [c, p, s, r] = await Promise.all([
        supabase
          .from("contacts")
          .select("*")
          .eq("workspace_id", activeWorkspace.id)
          .order("name"),
        supabase.from("profiles").select("*").order("full_name"),
        supabase.from("deal_sources").select("*").order("name"),
        supabase.from("deal_lost_reasons").select("*").order("name"),
      ]);
      if (cancelled) return;
      setContacts((c.data ?? []) as Contact[]);
      setProfiles((p.data ?? []) as Profile[]);
      setSources(s.data ?? []);
      setReasons(r.data ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, activeWorkspace?.id, supabase]);

  // Fetch linked conversation for the selected contact (newest open one).
  // Clearing on no-selection is sync with prop state; the populated
  // case runs setLinkedConversation inside the async fetch callback.
  useEffect(() => {
    if (!open || !contactId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLinkedConversation(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("conversations")
        .select("*")
        .eq("contact_id", contactId)
        .order("last_message_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      setLinkedConversation((data as Conversation | null) ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, contactId, supabase]);

  // Fetch deal files
  useEffect(() => {
    if (!open) return;
    if (!deal) {
      setFiles([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("media_files")
        .select("*")
        .eq("deal_id", deal.id)
        .order("created_at", { ascending: false });
      if (!cancelled) setFiles(data || []);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, deal, supabase]);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !activeWorkspace) return;

    if (!deal && !title.trim()) {
      toast.error("Please enter a Title first to upload documents.");
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("workspace_id", activeWorkspace.id);
    if (deal) formData.append("deal_id", deal.id);
    
    // Automatically creates/puts in a folder named after the deal title
    formData.append("auto_folder", deal ? deal.title : title.trim()); 

    try {
      const res = await fetch('/api/media/upload', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error("Failed to upload file");
      const result = await res.json();
      toast.success(deal ? "File uploaded to deal" : "File uploaded");
      
      if (deal) {
        // Refresh files
        const { data } = await supabase
          .from("media_files")
          .select("*")
          .eq("deal_id", deal.id)
          .order("created_at", { ascending: false });
        setFiles(data || []);
      } else {
        // Keep in state to attach when deal is saved
        if (result.file) {
          setFiles(prev => [result.file, ...prev]);
        }
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleSave() {
    if (!title.trim() || !contactId || !stageId) {
      toast.error("Title, contact, and stage are required");
      return;
    }
    setSaving(true);

    const payload = {
      title: title.trim(),
      value: parseFloat(value) || 0,
      currency,
      contact_id: contactId,
      pipeline_id: pipelineId,
      stage_id: stageId,
      assigned_to: assignedTo || null,
      notes: notes.trim() || null,
      expected_close_date: expectedCloseDate || null,
      source_id: sourceId || null,
      lost_reason_id: lostReasonId || null,
    };

    if (deal) {
      const { error } = await supabase
        .from("deals")
        .update(payload)
        .eq("id", deal.id);
      if (error) {
        toast.error("Failed to save deal");
        setSaving(false);
        return;
      }
    } else {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        toast.error("Not signed in");
        setSaving(false);
        return;
      }
      if (!activeWorkspace?.id) {
        toast.error("No active workspace selected");
        setSaving(false);
        return;
      }
      const { error, data: newDeal } = await supabase
        .from("deals")
        .insert({
          ...payload,
          user_id: user.id,
          workspace_id: activeWorkspace.id,
          status: "open",
        })
        .select()
        .single();
        
      if (error) {
        toast.error("Failed to create deal");
        setSaving(false);
        return;
      }

      // Attach any files uploaded before the deal was created
      if (files.length > 0 && newDeal?.id) {
        const fileIds = files.map(f => f.id);
        await supabase.from("media_files").update({ deal_id: newDeal.id }).in("id", fileIds);
      }
    }

    setSaving(false);
    toast.success(deal ? "Deal updated" : "Deal created");
    onOpenChange(false);
    onSaved();
  }

  async function handleStatusChange(status: DealStatus, reasonId?: string) {
    if (!deal) return;
    setStatusAction(status);
    const updates: any = { status };
    if (status === "lost") updates.lost_reason_id = reasonId || null;
    if (status === "open") updates.lost_reason_id = null;
    
    const { error } = await supabase
      .from("deals")
      .update(updates)
      .eq("id", deal.id);
    setStatusAction(null);
    if (error) {
      toast.error("Failed to update deal status");
      return;
    }
    toast.success(
      status === "won" ? "Marked as won" : status === "lost" ? "Marked as lost" : "Deal reopened",
    );
    setShowLostReasonPrompt(false);
    onOpenChange(false);
    onSaved();
  }

  async function handleDelete() {
    if (!deal) return;
    setDeleting(true);
    const { error } = await supabase.from("deals").delete().eq("id", deal.id);
    setDeleting(false);
    if (error) {
      toast.error("Failed to delete deal");
      return;
    }
    toast.success("Deal deleted");
    setConfirmDelete(false);
    onOpenChange(false);
    onSaved();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="bg-slate-900 border-slate-700 text-slate-200 sm:max-w-lg w-full p-0"
      >
        <div className="flex h-full flex-col">
          <SheetHeader className="border-b border-slate-700/50 p-4">
            <SheetTitle className="text-white">
              {deal ? "Edit Deal" : "New Deal"}
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="grid gap-2">
              <Label className="text-slate-300">Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Deal title"
                className="border-slate-700 bg-slate-800 text-white"
              />
            </div>

            <div className="grid gap-2">
              <Label className="text-slate-300">Contact</Label>
              <select
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 text-sm text-white outline-none focus:border-[#00aef0] focus:ring-1 focus:ring-[#00aef0]"
              >
                <option value="">Select a contact</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || c.phone}
                  </option>
                ))}
              </select>

              {linkedConversation && (
                <Link
                  href="/inbox"
                  className="mt-1 inline-flex items-center gap-1.5 self-start rounded-md bg-[#00aef0]/10 px-2 py-1 text-xs text-[#00aef0] hover:bg-[#00aef0]/20"
                >
                  <MessageSquare className="h-3 w-3" />
                  Link to Conversation
                </Link>
              )}
            </div>

            <div className="grid grid-cols-[1fr_110px] gap-3">
              <div className="grid gap-2">
                <Label className="text-slate-300">Value</Label>
                <div className="relative">
                  <DollarSign className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                  <Input
                    type="number"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="0"
                    className="border-slate-700 bg-slate-800 pl-7 text-white"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label className="text-slate-300">Currency</Label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 text-sm text-white outline-none focus:border-[#00aef0]"
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="INR">INR</option>
                  <option value="AUD">AUD</option>
                  <option value="CAD">CAD</option>
                  <option value="SGD">SGD</option>
                  <option value="AED">AED</option>
                  <option value="JPY">JPY</option>
                  <option value="CHF">CHF</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label className="text-slate-300">Expected Close Date</Label>
                <Input
                  type="date"
                  value={expectedCloseDate}
                  onChange={(e) => setExpectedCloseDate(e.target.value)}
                  className="border-slate-700 bg-slate-800 text-white [color-scheme:dark]"
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-slate-300">Source</Label>
                {isAddingSource ? (
                  <div className="flex gap-2">
                    <Input
                      value={newSourceName}
                      onChange={(e) => setNewSourceName(e.target.value)}
                      placeholder="Name"
                      className="border-slate-700 bg-slate-800 text-white flex-1 h-9"
                    />
                    <Button
                      type="button"
                      disabled={!newSourceName.trim()}
                      onClick={async () => {
                        if (!newSourceName.trim()) return;
                        const { data, error } = await supabase.from('deal_sources').insert({ name: newSourceName.trim() }).select().single();
                        if (data) {
                           setSources([...sources, data].sort((a,b) => a.name.localeCompare(b.name)));
                           setSourceId(data.id);
                           setIsAddingSource(false);
                           setNewSourceName("");
                        } else {
                           toast.error(error?.message || "Failed to create source");
                        }
                      }}
                      className="h-9 px-3 bg-[#00aef0] text-white hover:bg-[#009bd6]"
                    >
                      Add
                    </Button>
                    <Button variant="ghost" onClick={() => setIsAddingSource(false)} className="h-9 px-3 text-slate-400 hover:text-white"><X className="h-4 w-4" /></Button>
                  </div>
                ) : (
                  <select
                    value={sourceId}
                    onChange={(e) => {
                      if (e.target.value === "ADD_NEW") setIsAddingSource(true);
                      else setSourceId(e.target.value);
                    }}
                    className="h-9 w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 text-sm text-white outline-none focus:border-[#00aef0] focus:ring-1 focus:ring-[#00aef0]"
                  >
                    <option value="">Select source</option>
                    {sources.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                    <option value="ADD_NEW">+ Add New Source</option>
                  </select>
                )}
              </div>
            </div>

            <div className="grid gap-2">
              <Label className="text-slate-300">Stage</Label>
              <select
                value={stageId}
                onChange={(e) => setStageId(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 text-sm text-white outline-none focus:border-[#00aef0]"
              >
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label className="text-slate-300">Assigned To</Label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 text-sm text-white outline-none focus:border-[#00aef0]"
              >
                <option value="">Unassigned</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name || p.email}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label className="text-slate-300">Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes..."
                className="min-h-[100px] border-slate-700 bg-slate-800 text-white"
              />
            </div>

            <div className="grid gap-2 pt-4 border-t border-slate-700/50 mt-4">
              <div className="flex items-center justify-between">
                <Label className="text-slate-300">Documents</Label>
                <Button 
                  type="button"
                  variant="outline" 
                  size="sm"
                  className="h-7 text-xs border-slate-700 bg-slate-800 text-slate-300"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Upload className="w-3 h-3 mr-1" />
                  {uploading ? "Uploading..." : "Upload"}
                </Button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  onChange={handleFileUpload}
                />
              </div>
              
              {files.length > 0 ? (
                <div className="space-y-2 mt-2">
                  {files.map(f => (
                    <a 
                      key={f.id}
                      href={f.local_path} 
                      target="_blank" 
                      rel="noreferrer"
                      className="flex items-center gap-2 p-2 rounded-lg bg-slate-900/50 border border-slate-700 hover:border-slate-600 transition-colors text-sm text-slate-300 hover:text-white"
                    >
                      <File className="w-4 h-4 text-[#00aef0]" />
                      <span className="truncate">{f.name}</span>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 mt-1">No documents attached.</p>
              )}
            </div>

            {deal && (
              <div className="space-y-2 rounded-lg border border-slate-700 bg-slate-900/50 p-3">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                  Status
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={() => handleStatusChange("won")}
                    disabled={!!statusAction || deal.status === "won"}
                    className="flex-1 bg-[#00aef0] text-white hover:bg-[#00aef0] disabled:opacity-50"
                  >
                    {statusAction === "won" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Check className="mr-1 h-4 w-4" />
                        Mark as Won
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setShowLostReasonPrompt(true)}
                    disabled={!!statusAction || deal.status === "lost"}
                    className="flex-1 bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {statusAction === "lost" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <X className="mr-1 h-4 w-4" />
                        Mark as Lost
                      </>
                    )}
                  </Button>
                </div>
                {showLostReasonPrompt && (
                  <div className="mt-2 space-y-2 border border-red-500/30 bg-red-500/10 p-3 rounded-lg">
                    <Label className="text-red-300 text-xs">Reason for loss (Optional)</Label>
                    <select
                      value={lostReasonId}
                      onChange={(e) => setLostReasonId(e.target.value)}
                      className="h-9 w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 text-sm text-white outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                    >
                      <option value="">Select a reason</option>
                      {reasons.map((r) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        onClick={() => handleStatusChange("lost", lostReasonId)}
                        disabled={!!statusAction}
                        className="flex-1 h-8 bg-red-600 text-white hover:bg-red-700 text-xs"
                      >
                        Confirm Lost
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setShowLostReasonPrompt(false)}
                        className="flex-1 h-8 text-slate-400 hover:text-white text-xs"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
                {deal.status && deal.status !== "open" && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => handleStatusChange("open")}
                    disabled={!!statusAction}
                    className="w-full text-slate-400 hover:text-white"
                  >
                    Reopen deal
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-slate-700/50 bg-slate-900/80 p-4">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1 border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || !title.trim() || !contactId || !stageId}
                className="flex-1 bg-[#00aef0] text-white hover:bg-[#00aef0]"
              >
                {saving ? "Saving..." : deal ? "Save Changes" : "Create Deal"}
              </Button>
            </div>

            {deal &&
              (confirmDelete ? (
                <div className="mt-3 flex items-center justify-between gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs">
                  <span className="text-red-300">Delete this deal?</span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      disabled={deleting}
                      className="rounded px-2 py-1 text-slate-300 hover:bg-slate-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleting}
                      className="rounded bg-red-600 px-2 py-1 font-medium text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {deleting ? "Deleting..." : "Confirm"}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="mt-3 flex w-full items-center justify-center gap-1 text-xs text-red-400 hover:text-red-300"
                >
                  <Trash2 className="h-3 w-3" />
                  Delete Deal
                </button>
              ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
