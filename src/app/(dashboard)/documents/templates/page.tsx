"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  LayoutGrid,
  Plus,
  FileText,
  Loader2,
  Folder,
  Code,
  CheckCircle2,
  Tag
} from "lucide-react";

export default function DocumentTemplatesPage() {
  const supabase = createClient();
  const { activeWorkspace } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("ALL");

  const fetchTemplates = useCallback(async () => {
    if (!activeWorkspace?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("document_templates")
        .select("*")
        .eq("workspace_id", activeWorkspace.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load document templates.");
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace?.id, supabase]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto text-foreground">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card/80 p-5 rounded-3xl border border-border shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2.5">
            <LayoutGrid className="size-5 text-primary" />
            Template Studio
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage reusable document templates for HR Offer Letters, Relieving Certificates, NDAs &amp; Commercial Proposals.
          </p>
        </div>

        <Link href="/documents/templates/new">
          <Button size="sm" className="bg-primary text-primary-foreground text-xs h-9 font-semibold gap-1.5 shadow-xs">
            <Plus className="size-3.5" /> Create New Template
          </Button>
        </Link>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center p-12 text-muted-foreground text-xs">
          <Loader2 className="size-5 animate-spin mr-2" />
          Loading Templates...
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center p-12 bg-card rounded-2xl border border-border space-y-3">
          <FileText className="size-10 text-muted-foreground mx-auto" />
          <h3 className="text-sm font-bold">No Custom Templates Created Yet</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Create reusable document templates with handlebar variable tags like <code>{"{{employee.name}}"}</code> to automate official document generation.
          </p>
          <Link href="/documents/templates/new">
            <Button size="sm" className="bg-primary text-primary-foreground text-xs h-8">
              <Plus className="size-3.5 mr-1" /> Create Template
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((tpl) => (
            <div key={tpl.id} className="bg-card border border-border p-5 rounded-2xl shadow-xs space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] mb-1.5">
                    {tpl.category || 'HR'}
                  </Badge>
                  <h3 className="font-bold text-sm text-foreground">{tpl.name}</h3>
                </div>
                <span className="text-[11px] font-mono text-muted-foreground">v{tpl.current_version || 1}</span>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">{tpl.description || "No description provided."}</p>

              <div className="flex items-center justify-between pt-3 border-t border-border/60 text-xs">
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Code className="size-3 text-primary" /> {Array.isArray(tpl.variables) ? tpl.variables.length : 0} Variables
                </span>
                <Link href={`/documents/new?templateId=${tpl.id}`}>
                  <Button size="sm" variant="ghost" className="h-7 text-xs text-primary hover:bg-primary/10">
                    Use Template →
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
