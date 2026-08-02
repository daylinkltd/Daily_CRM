"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SignatoryModal } from "@/components/documents/signatory-modal";
import {
  UserCheck,
  Plus,
  Trash2,
  Edit3,
  ShieldCheck,
  Building,
  Loader2
} from "lucide-react";

export default function SignatoriesPage() {
  const supabase = createClient();
  const { activeWorkspace } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [signatories, setSignatories] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSignatory, setSelectedSignatory] = useState<any | null>(null);

  const fetchSignatories = useCallback(async () => {
    if (!activeWorkspace?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("company_signatories")
        .select("*")
        .eq("workspace_id", activeWorkspace.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSignatories(data || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load signatories.");
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace?.id, supabase]);

  useEffect(() => {
    fetchSignatories();
  }, [fetchSignatories]);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to remove this signatory?")) return;
    try {
      const { error } = await supabase
        .from("company_signatories")
        .delete()
        .eq("id", id)
        .eq("workspace_id", activeWorkspace!.id);
      if (error) throw error;
      toast.success("Signatory removed.");
      fetchSignatories();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete signatory.");
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto text-foreground">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card/80 p-5 rounded-3xl border border-border shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2.5">
            <UserCheck className="size-5 text-purple-500" />
            Corporate Signatories &amp; Stamps Vault
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage authorized signatories (CEO, HR, Finance, Legal) with signatures and seal stamps.
          </p>
        </div>

        <Button
          onClick={() => {
            setSelectedSignatory(null);
            setModalOpen(true);
          }}
          size="sm"
          className="bg-primary text-primary-foreground text-xs h-9 font-semibold gap-1.5 shadow-xs"
        >
          <Plus className="size-3.5" /> Add New Signatory
        </Button>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center p-12 text-muted-foreground text-xs">
          <Loader2 className="size-5 animate-spin mr-2" />
          Loading Signatories...
        </div>
      ) : signatories.length === 0 ? (
        <div className="text-center p-12 bg-card rounded-2xl border border-border space-y-3">
          <UserCheck className="size-10 text-muted-foreground mx-auto" />
          <h3 className="text-sm font-bold">No Authorized Signatories Configured</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Add company signatories (e.g. HR Manager, CEO) to attach digital signatures and stamps to generated letters.
          </p>
          <Button
            onClick={() => setModalOpen(true)}
            size="sm"
            className="bg-primary text-primary-foreground text-xs h-8"
          >
            <Plus className="size-3.5 mr-1" /> Add Signatory
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {signatories.map((sig) => (
            <div key={sig.id} className="bg-card border border-border p-5 rounded-2xl shadow-xs space-y-4 relative">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                    {sig.name}
                    {sig.is_default && (
                      <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px]">
                        Default
                      </Badge>
                    )}
                  </h3>
                  <p className="text-xs text-muted-foreground">{sig.designation} ({sig.department || 'HR'})</p>
                </div>
              </div>

              {/* Previews */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/60 text-[11px]">
                <div className="bg-muted/40 p-2 rounded-xl text-center">
                  <span className="text-muted-foreground block text-[10px]">Signature</span>
                  {sig.signature_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={sig.signature_url} alt="Signature" className="h-8 mx-auto object-contain mt-1" />
                  ) : (
                    <span className="text-slate-400 italic">No image</span>
                  )}
                </div>

                <div className="bg-muted/40 p-2 rounded-xl text-center">
                  <span className="text-muted-foreground block text-[10px]">Seal Stamp</span>
                  {sig.stamp_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={sig.stamp_url} alt="Stamp" className="h-8 mx-auto object-contain mt-1" />
                  ) : (
                    <span className="text-slate-400 italic">No image</span>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-1 pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedSignatory(sig);
                    setModalOpen(true);
                  }}
                  className="h-7 px-2 text-xs"
                >
                  <Edit3 className="size-3.5 mr-1" /> Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(sig.id)}
                  className="h-7 px-2 text-xs text-rose-500 hover:bg-rose-500/10"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <SignatoryModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSaved={fetchSignatories}
        initialData={selectedSignatory}
      />
    </div>
  );
}
