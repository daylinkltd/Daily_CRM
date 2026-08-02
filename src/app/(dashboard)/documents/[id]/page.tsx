"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { A4DocumentPreview } from "@/components/documents/a4-document-preview";
import {
  FileText,
  Printer,
  Download,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Share2,
  UserCheck
} from "lucide-react";
import { IconAction } from "@/components/ui/icon-action";

export default function DocumentDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const supabase = createClient();
  const { activeWorkspace } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [documentItem, setDocumentItem] = useState<any | null>(null);

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

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto text-foreground print:p-0 print:max-w-none">
      {/* Top Action Bar - Hidden during print */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden bg-card/80 p-4 rounded-2xl border border-border">
        <div className="flex items-center gap-3">
          <IconAction label="Back" icon={<ArrowLeft className="size-3.5" />} variant="ghost" onClick={() => router.push("/documents")} className="text-xs gap-1" />
          <div>
            <h1 className="text-base font-bold text-foreground flex items-center gap-2">
              {documentItem.title}
              <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px]">
                {documentItem.status}
              </Badge>
            </h1>
            <p className="text-xs text-muted-foreground font-mono">
              Ref: {documentItem.document_number} • Issued to {documentItem.recipient_name}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <IconAction label="Print / Save as PDF" icon={<Printer className="size-3.5 text-primary" />} variant="outline"
            onClick={handlePrint}
            className="text-xs h-9 gap-1.5 border-border" />
        </div>
      </div>

      {/* Render A4 Canvas */}
      <div className="bg-muted/30 p-6 rounded-2xl border border-border overflow-auto print:p-0 print:border-none print:bg-white">
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
    </div>
  );
}
