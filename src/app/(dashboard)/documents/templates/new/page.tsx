"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VARIABLE_DICTIONARY } from "@/lib/documents/variable-engine";
import {
  FileText,
  Save,
  Loader2,
  Code,
  Plus,
  ArrowLeft,
  Sparkles
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NewTemplatePage() {
  const router = useRouter();
  const supabase = createClient();
  const { activeWorkspace } = useWorkspace();
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("HR");
  const [bodyHtml, setBodyHtml] = useState(`
<h2>Employment Offer Letter</h2>
<p>Date: {{today}}</p>
<p>To,</p>
<p><strong>{{employee.name}}</strong><br/>
Email: {{employee.email}}</p>

<p>Dear <strong>{{employee.name}}</strong>,</p>
<p>We are pleased to offer you the position of <strong>{{employee.designation}}</strong> at <strong>{{company.name}}</strong> starting on <strong>{{employee.joining_date}}</strong>.</p>
<p>Your annual remuneration (CTC) will be <strong>{{employee.salary}}</strong> as discussed during the evaluation process.</p>

<p>Sincerely,</p>
<p><strong>{{company.name}}</strong></p>
  `.trim());

  const insertVariableToken = (tokenKey: string) => {
    const tokenTag = `{{${tokenKey}}}`;
    setBodyHtml((prev) => prev + ` ${tokenTag} `);
    toast.success(`Inserted ${tokenTag}`);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace?.id || !name.trim()) {
      toast.error("Please enter a template name.");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("document_templates").insert({
        workspace_id: activeWorkspace.id,
        name,
        description,
        body_html: bodyHtml,
        variables: VARIABLE_DICTIONARY.map((v) => ({ key: v.key, label: v.label, type: v.type })),
        status: "Active",
      });

      if (error) throw error;
      toast.success("Template saved successfully!");
      router.push("/documents/templates");
    } catch (err: any) {
      toast.error(err.message || "Failed to create template.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto text-foreground">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="text-xs gap-1">
          <ArrowLeft className="size-3.5" /> Back to Templates
        </Button>

        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-primary text-primary-foreground text-xs h-9 font-semibold gap-1.5 shadow-xs"
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Save Template
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Template Editor */}
        <div className="lg:col-span-8 space-y-4">
          <Card className="bg-card border-border shadow-xs rounded-2xl p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Template Name *</Label>
                <Input
                  type="text"
                  placeholder="e.g. Standard Job Offer Letter 2026"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-background text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Category</Label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-background border border-border text-foreground text-xs rounded-lg px-3 py-2"
                >
                  <option value="HR">HR &amp; Employment</option>
                  <option value="Legal">Legal &amp; Compliance</option>
                  <option value="Finance">Finance &amp; Billing</option>
                  <option value="Sales">Sales &amp; Commercials</option>
                  <option value="Admin">General Admin</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Description</Label>
              <Input
                type="text"
                placeholder="Brief description of when to use this template..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-background text-xs"
              />
            </div>

            {/* HTML Editor */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Template Body HTML Content</Label>
              <textarea
                rows={16}
                value={bodyHtml}
                onChange={(e) => setBodyHtml(e.target.value)}
                className="w-full bg-background border border-border text-foreground font-mono text-xs rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </Card>
        </div>

        {/* Right Sidebar: Dynamic Variable Autocomplete Tags */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="bg-card border-border shadow-xs rounded-2xl p-4 space-y-3">
            <CardHeader className="p-0">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Code className="size-4 text-primary" /> Handlebar Variables
              </CardTitle>
            </CardHeader>
            <p className="text-[11px] text-muted-foreground">
              Click any token below to insert it directly into your template content.
            </p>

            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {["employee", "company", "client", "document", "system"].map((mod) => (
                <div key={mod} className="space-y-1.5">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                    {mod} Variables
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {VARIABLE_DICTIONARY.filter((v) => v.module === mod).map((v) => (
                      <button
                        key={v.key}
                        type="button"
                        onClick={() => insertVariableToken(v.key)}
                        className="px-2 py-1 bg-muted/60 hover:bg-primary/10 hover:text-primary rounded-md text-[11px] font-mono border border-border transition-colors flex items-center gap-1"
                        title={v.label}
                      >
                        <Plus className="size-3 text-muted-foreground" />
                        {`{{${v.key}}}`}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
