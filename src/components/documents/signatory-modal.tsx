"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useWorkspace } from "@/hooks/use-workspace";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Upload, UserCheck, ShieldCheck, Trash2 } from "lucide-react";
import { IconAction } from "@/components/ui/icon-action";
import { NativeSelect } from "@/components/ui/native-select";

interface SignatoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  initialData?: any;
}

export function SignatoryModal({ open, onOpenChange, onSaved, initialData }: SignatoryModalProps) {
  const supabase = createClient();
  const { activeWorkspace } = useWorkspace();
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState(initialData?.name || "");
  const [designation, setDesignation] = useState(initialData?.designation || "");
  const [department, setDepartment] = useState(initialData?.department || "HR");
  const [email, setEmail] = useState(initialData?.email || "");
  const [signatureUrl, setSignatureUrl] = useState(initialData?.signature_url || "");
  const [stampUrl, setStampUrl] = useState(initialData?.stamp_url || "");
  const [isDefault, setIsDefault] = useState(initialData?.is_default || false);

  const handleFileUpload = async (file: File, type: "signature" | "stamp") => {
    if (!activeWorkspace?.id) return;
    try {
      toast.loading(`Uploading ${type}...`);
      const fileExt = file.name.split(".").pop();
      const filePath = `${activeWorkspace.id}/signatories/${type}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("employee-documents")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("employee-documents")
        .getPublicUrl(filePath);

      const url = publicUrlData.publicUrl;
      if (type === "signature") setSignatureUrl(url);
      else setStampUrl(url);

      toast.dismiss();
      toast.success(`${type === "signature" ? "Signature" : "Seal Stamp"} uploaded successfully!`);
    } catch (err: any) {
      toast.dismiss();
      toast.error(err.message || "Failed to upload image.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace?.id || !name.trim() || !designation.trim()) {
      toast.error("Please fill in signatory name and designation.");
      return;
    }

    setLoading(true);
    try {
      if (initialData?.id) {
        const { error } = await supabase
          .from("company_signatories")
          .update({
            name,
            designation,
            department,
            email,
            signature_url: signatureUrl,
            stamp_url: stampUrl,
            is_default: isDefault,
          })
          .eq("id", initialData.id);
        if (error) throw error;
        toast.success("Signatory updated successfully!");
      } else {
        const { error } = await supabase.from("company_signatories").insert({
          workspace_id: activeWorkspace.id,
          name,
          designation,
          department,
          email,
          signature_url: signatureUrl,
          stamp_url: stampUrl,
          is_default: isDefault,
        });
        if (error) throw error;
        toast.success("New signatory added successfully!");
      }

      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save signatory.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border text-foreground rounded-2xl shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <UserCheck className="size-5 text-primary" />
            {initialData ? "Edit Signatory" : "Add Corporate Signatory"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Configure authorized signer details, digital signature image, and official seal stamp.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Signatory Full Name *</Label>
            <Input
              type="text"
              placeholder="e.g. Swaraj Jakanoor"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-background text-xs"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Designation *</Label>
              <Input
                type="text"
                placeholder="e.g. Chief Executive Officer"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                className="bg-background text-xs"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Department</Label>
              <NativeSelect
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full bg-background border border-border text-foreground text-xs rounded-lg px-3 py-2"
              >
                <option value="Executive">Executive</option>
                <option value="HR">HR & Operations</option>
                <option value="Finance">Finance</option>
                <option value="Legal">Legal</option>
                <option value="Sales">Sales</option>
              </NativeSelect>
            </div>
          </div>

          {/* Signature Upload */}
          <div className="space-y-1.5 pt-1">
            <Label className="text-xs font-semibold">Digital Signature Image (PNG)</Label>
            {signatureUrl ? (
              <div className="p-3 bg-muted/40 rounded-xl border border-border flex items-center justify-between gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={signatureUrl} alt="Signature Preview" className="h-10 object-contain" />
                <IconAction label="Remove" icon={<Trash2 className="size-3.5 " />} type="button"
                  variant="ghost"
                  onClick={() => setSignatureUrl("")}
                  className="h-7 px-2 text-xs text-rose-500 hover:bg-rose-500/10" />
              </div>
            ) : (
              <label className="relative border-2 border-dashed border-primary/30 hover:border-primary/60 bg-primary/5 hover:bg-primary/10 transition-all rounded-xl p-3 flex flex-col items-center justify-center text-center cursor-pointer group">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file, "signature");
                  }}
                  className="sr-only"
                />
                <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                  <Upload className="size-4 group-hover:scale-110 transition-transform" />
                  <span>Upload Signature Image</span>
                </div>
              </label>
            )}
          </div>

          {/* Stamp Upload */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Official Seal / Stamp Image (PNG)</Label>
            {stampUrl ? (
              <div className="p-3 bg-muted/40 rounded-xl border border-border flex items-center justify-between gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={stampUrl} alt="Stamp Preview" className="h-10 object-contain" />
                <IconAction label="Remove" icon={<Trash2 className="size-3.5 " />} type="button"
                  variant="ghost"
                  onClick={() => setStampUrl("")}
                  className="h-7 px-2 text-xs text-rose-500 hover:bg-rose-500/10" />
              </div>
            ) : (
              <label className="relative border-2 border-dashed border-purple-500/30 hover:border-purple-500/60 bg-purple-500/5 hover:bg-purple-500/10 transition-all rounded-xl p-3 flex flex-col items-center justify-center text-center cursor-pointer group">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file, "stamp");
                  }}
                  className="sr-only"
                />
                <div className="flex items-center gap-2 text-xs font-semibold text-purple-600 dark:text-purple-400">
                  <Upload className="size-4 group-hover:scale-110 transition-transform" />
                  <span>Upload Seal Stamp Image</span>
                </div>
              </label>
            )}
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="isDefault"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="rounded border-border"
            />
            <Label htmlFor="isDefault" className="text-xs cursor-pointer font-medium">
              Set as Default Signatory for Workspace Documents
            </Label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="text-xs h-9">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="bg-primary text-primary-foreground text-xs h-9 font-semibold">
              {loading ? <Loader2 className="size-4 animate-spin mr-1.5" /> : null}
              Save Signatory
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
