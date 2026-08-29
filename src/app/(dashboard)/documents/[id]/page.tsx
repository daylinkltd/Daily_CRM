"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { A4DocumentPreview } from "@/components/documents/a4-document-preview";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FileText,
  Printer,
  ArrowLeft,
  Loader2,
  Pencil,
  Trash2,
  Send,
  LockOpen,
  AlertTriangle,
} from "lucide-react";
import { IconAction } from "@/components/ui/icon-action";

/**
 * Statuses that are still the author's to change. The database agrees:
 * `freeze_issued_official_documents` (migration 085) only locks a row
 * once it reaches Approved / Issued / Cancelled, and
 * `block_issued_official_document_delete` mirrors that for deletes.
 * So a Draft has always been editable — the screen simply never
 * offered it, which read as "drafts are stuck".
 */
const EDITABLE_STATUSES = ["Draft", "Pending Approval"];

/**
 * Statuses that can be stepped back to Draft. Cancelled is absent on
 * purpose: a withdrawn letter has usually been communicated as
 * withdrawn, so reviving it quietly would be a different document, not
 * a recovery.
 */
const UNLOCKABLE_STATUSES = ["Issued", "Approved"];

export default function DocumentDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const supabase = createClient();
  const { activeWorkspace, can } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [documentItem, setDocumentItem] = useState<any | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const printRef = useRef<HTMLDivElement>(null);

  const fetchDocument = useCallback(async () => {
    if (!id || !activeWorkspace?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("official_documents")
        .select("*")
        .eq("id", id)
        // Scoped to the active workspace so a link to a document in another
        // workspace the user also belongs to cannot render under the wrong one.
        .eq("workspace_id", activeWorkspace.id)
        .single();

      if (error) throw error;
      setDocumentItem(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load document.");
    } finally {
      setLoading(false);
    }
  }, [id, activeWorkspace?.id, supabase]);

  useEffect(() => {
    fetchDocument();
  }, [fetchDocument]);

  const handlePrint = () => {
    window.print();
  };

  const openEditor = () => {
    setEditTitle(documentItem.title ?? "");
    setEditBody(documentItem.body_html ?? "");
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!editTitle.trim()) {
      toast.error("Give the letter a title.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("official_documents")
        .update({
          title: editTitle.trim(),
          body_html: editBody,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("workspace_id", activeWorkspace!.id);
      if (error) throw error;

      toast.success("Draft updated.");
      setEditOpen(false);
      await fetchDocument();
    } catch (err: any) {
      // The freeze trigger raises a plain-English message; show it
      // rather than a generic failure.
      toast.error(err.message || "Could not save the draft.");
    } finally {
      setSaving(false);
    }
  };

  const handleIssue = async () => {
    setBusy(true);
    try {
      const { error } = await supabase
        .from("official_documents")
        .update({ status: "Issued", issued_date: new Date().toISOString().split("T")[0] })
        .eq("id", id)
        .eq("workspace_id", activeWorkspace!.id);
      if (error) throw error;
      toast.success("Letter issued — it is now locked against edits.");
      await fetchDocument();
    } catch (err: any) {
      toast.error(err.message || "Could not issue the letter.");
    } finally {
      setBusy(false);
    }
  };

  /**
   * Step an issued letter back to Draft so it can be corrected.
   *
   * Cancelling and re-issuing would burn a document number and leave a
   * Cancelled row that reads as "something went wrong with this
   * person". Migration 117 permits exactly this one transition and
   * bumps `version`, so the step back is recorded rather than silent.
   */
  const handleUnlock = async () => {
    setBusy(true);
    try {
      const { error } = await supabase
        .from("official_documents")
        .update({ status: "Draft" })
        .eq("id", id)
        .eq("workspace_id", activeWorkspace!.id);
      if (error) throw error;
      toast.success("Unlocked — the letter is a draft again and can be edited.");
      await fetchDocument();
    } catch (err: any) {
      toast.error(err.message || "Could not unlock the letter.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      // Soft delete: every list in the documents platform filters on
      // `deleted_at IS NULL`, and keeping the row preserves the
      // document number so a later letter cannot silently reuse it.
      const { error } = await supabase
        .from("official_documents")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id)
        .eq("workspace_id", activeWorkspace!.id);
      if (error) throw error;
      toast.success("Draft deleted.");
      router.push("/documents");
    } catch (err: any) {
      toast.error(err.message || "Could not delete the draft.");
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground text-xs">
        <Loader2 className="size-5 animate-spin mr-2" />
        Loading Official Document...
      </div>
    );
  }

  if (!documentItem) {
    return (
      <div className="p-12 text-center text-muted-foreground text-xs space-y-3">
        <FileText className="size-10 mx-auto" />
        <p>Document not found or access denied.</p>
        <Button size="sm" onClick={() => router.push("/documents")}>
          Back to Vault
        </Button>
      </div>
    );
  }

  const letterheadSnapshot = documentItem.letterhead_snapshot_json;
  const signatorySnapshot = documentItem.signatory_snapshot_json;
  const isEditable = EDITABLE_STATUSES.includes(documentItem.status);
  // `people_manage` is the HR-write capability these letters belong to.
  const canWrite = can("people_manage");

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto text-foreground">
      {/* Top Action Bar — excluded from print by the global rules, which
          keep only `.print-area` on the page. */}
      <div
        data-print-hide
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card/80 p-4 rounded-2xl border border-border"
      >
        <div className="flex items-center gap-3">
          <IconAction label="Back" icon={<ArrowLeft className="size-3.5" />} variant="ghost" onClick={() => router.push("/documents")} className="text-xs gap-1" />
          <div>
            <h1 className="text-base font-bold text-foreground flex items-center gap-2">
              {documentItem.title}
              <Badge
                className={
                  isEditable
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[10px]"
                    : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px]"
                }
              >
                {documentItem.status}
              </Badge>
            </h1>
            <p className="text-xs text-muted-foreground font-mono">
              Ref: {documentItem.document_number} • Issued to {documentItem.recipient_name}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isEditable && canWrite && (
            <>
              <IconAction label="Edit draft" icon={<Pencil className="size-3.5" />} variant="outline"
                onClick={openEditor}
                className="text-xs h-9 gap-1.5 border-border" />
              <IconAction label="Issue" icon={busy ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />} variant="outline"
                onClick={handleIssue}
                disabled={busy}
                className="text-xs h-9 gap-1.5 border-border" />
              <IconAction label="Delete" icon={<Trash2 className="size-3.5" />} variant="outline"
                onClick={() => setConfirmDelete(true)}
                disabled={busy}
                className="text-xs h-9 gap-1.5 border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20" />
            </>
          )}
          {!isEditable && canWrite && UNLOCKABLE_STATUSES.includes(documentItem.status) && (
            <IconAction label="Unlock to draft" icon={busy ? <Loader2 className="size-3.5 animate-spin" /> : <LockOpen className="size-3.5" />} variant="outline"
              onClick={handleUnlock}
              disabled={busy}
              className="text-xs h-9 gap-1.5 border-border" />
          )}
          <IconAction label="Print / Save as PDF" icon={<Printer className="size-3.5 text-primary" />} variant="outline"
            onClick={handlePrint}
            className="text-xs h-9 gap-1.5 border-border" />
        </div>
      </div>

      {!isEditable && (
        <p data-print-hide className="text-xs text-muted-foreground">
          This letter is {documentItem.status.toLowerCase()} and is locked against changes.
          {UNLOCKABLE_STATUSES.includes(documentItem.status)
            ? " Unlock it to make corrections — it keeps its number, and the reopen is recorded."
            : " Issue a replacement to supersede it."}
        </p>
      )}

      {/* The A4 sheet. `print-area` is the marker the global print rules
          isolate — everything outside it is dropped from the printout. */}
      <div className="print-area bg-muted/30 p-6 rounded-2xl border border-border overflow-auto">
        <A4DocumentPreview
          ref={printRef}
          letterhead={letterheadSnapshot}
          bodyHtml={documentItem.body_html}
          documentNumber={documentItem.document_number}
          date={documentItem.issued_date}
          recipientName={documentItem.recipient_name}
          signatory={signatorySnapshot}
        />
      </div>

      {/* ---- Edit draft ---- */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit draft</DialogTitle>
            <DialogDescription>
              Drafts can be reworded freely. Once issued the wording is frozen, so this is the
              moment to get it right.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Title</Label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Letter body</Label>
              <RichTextEditor value={editBody} onChange={setEditBody} autosave={false} minHeight="320px" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
              Save draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Delete confirmation ---- */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-red-500" />
              Delete this draft?
            </DialogTitle>
            <DialogDescription>
              {documentItem.document_number} will be removed from the vault. Its number is
              retired rather than reused, so a future letter cannot claim it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>Keep it</Button>
            <Button
              onClick={handleDelete}
              disabled={busy}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {busy ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
              Delete draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
