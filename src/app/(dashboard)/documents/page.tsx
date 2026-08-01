"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { toast } from "sonner";
import { DocumentVaultTable } from "@/components/documents/document-vault-table";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Plus,
  Palette,
  UserCheck,
  LayoutGrid,
  CheckCircle2,
  Clock,
  Sparkles
} from "lucide-react";

export default function DocumentsVaultPage() {
  const supabase = createClient();
  const { activeWorkspace } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<any[]>([]);

  // Metrics
  const [issuedCount, setIssuedCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  const fetchVaultData = useCallback(async () => {
    if (!activeWorkspace?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("official_documents")
        .select("*")
        .eq("workspace_id", activeWorkspace.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      const list = data || [];
      setDocuments(list);

      setIssuedCount(list.filter((d) => d.status === "Issued").length);
      setPendingCount(list.filter((d) => d.status === "Pending Approval").length);
    } catch (err: any) {
      toast.error(err.message || "Failed to load document vault.");
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace?.id, supabase]);

  useEffect(() => {
    fetchVaultData();
  }, [fetchVaultData]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto text-foreground">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card/80 p-5 rounded-3xl border border-border shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2.5">
            <FileText className="size-5 text-primary" />
            Official Documents Vault
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Issue, track, and manage company letterheads, HR offer letters, experience certificates &amp; contracts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/documents/branding">
            <Button variant="outline" size="sm" className="text-xs h-9 gap-1.5 border-border">
              <Palette className="size-3.5 text-emerald-500" /> Letterhead Branding
            </Button>
          </Link>
          <Link href="/documents/signatories">
            <Button variant="outline" size="sm" className="text-xs h-9 gap-1.5 border-border">
              <UserCheck className="size-3.5 text-purple-500" /> Signatories
            </Button>
          </Link>
          <Link href="/documents/templates">
            <Button variant="outline" size="sm" className="text-xs h-9 gap-1.5 border-border">
              <LayoutGrid className="size-3.5 text-primary" /> Template Studio
            </Button>
          </Link>
          <Link href="/documents/new">
            <Button size="sm" className="bg-primary text-primary-foreground text-xs h-9 font-semibold gap-1.5 shadow-xs">
              <Plus className="size-3.5" /> Issue New Document
            </Button>
          </Link>
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card p-4 rounded-2xl border border-border space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Total Official Documents</span>
            <FileText className="size-4 text-primary" />
          </div>
          <p className="text-2xl font-extrabold text-foreground">{documents.length}</p>
        </div>

        <div className="bg-card p-4 rounded-2xl border border-border space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Issued Documents</span>
            <CheckCircle2 className="size-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">{issuedCount}</p>
        </div>

        <div className="bg-card p-4 rounded-2xl border border-border space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Pending Approvals</span>
            <Clock className="size-4 text-amber-500" />
          </div>
          <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">{pendingCount}</p>
        </div>
      </div>

      {/* Vault Table */}
      <DocumentVaultTable documents={documents} loading={loading} />
    </div>
  );
}
