"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { assertAffected } from "@/lib/supabase/affected-rows";
import {
  Upload,
  Trash2,
  Loader2,
  Building2,
  Globe,
  Mail,
  Phone,
  MapPin,
  ImageIcon,
  Sparkles,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/hooks/use-workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SettingsPanelHead } from "./settings-panel-head";
import { IconAction } from "@/components/ui/icon-action";

const MAX_LOGO_BYTES = 3 * 1024 * 1024; // 3 MB
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);

interface BrandingData {
  logo_url: string | null;
  company_name: string | null;
  company_tagline: string | null;
  company_email: string | null;
  company_phone: string | null;
  company_website: string | null;
  company_address: string | null;
}

export function BrandingSettings() {
  const supabase = createClient();
  const { accountId, canEditSettings } = useAuth();
  const { activeWorkspace, refreshWorkspaces } = useWorkspace();
  const workspaceId = activeWorkspace?.id || accountId;

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [data, setData] = useState<BrandingData>({
    logo_url: null,
    company_name: null,
    company_tagline: null,
    company_email: null,
    company_phone: null,
    company_website: null,
    company_address: null,
  });

  // Pending logo state (before save)
  const [pendingLogo, setPendingLogo] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);

  const currentLogoUrl = previewUrl ?? (!removeLogo ? data.logo_url : null);

  // Fetch branding from workspaces table
  const fetchBranding = async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const { data: ws, error } = await supabase
        .from("workspaces")
        .select(
          "logo_url, company_name, company_tagline, company_email, company_phone, company_website, company_address"
        )
        .eq("id", workspaceId)
        .single();

      if (error) throw error;
      if (ws) setData(ws as BrandingData);
    } catch (err: any) {
      console.error("Failed to load branding:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (workspaceId) fetchBranding();
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!ALLOWED_MIME.has(file.type)) {
      toast.error("Unsupported format. Use PNG, JPG, WebP, or SVG.");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast.error("Logo is too large. Maximum 3 MB.");
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPendingLogo(file);
    setPreviewUrl(URL.createObjectURL(file));
    setRemoveLogo(false);
  };

  const onRemoveLogo = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPendingLogo(null);
    setPreviewUrl(null);
    setRemoveLogo(true);
  };

  const handleSave = async () => {
    if (!workspaceId) return;
    setSaving(true);

    try {
      let nextLogoUrl: string | null = data.logo_url;

      // Upload logo if new file staged
      if (pendingLogo) {
        setUploadingLogo(true);
        const ext = pendingLogo.name.split(".").pop()?.toLowerCase() || "png";
        const path = `${workspaceId}/company-logo-${Date.now()}.${ext}`;

        const { error: uploadErr } = await supabase.storage
          .from("avatars") // reuse avatars bucket — it's already public
          .upload(path, pendingLogo, {
            cacheControl: "86400",
            upsert: true,
            contentType: pendingLogo.type,
          });

        if (uploadErr) throw new Error(`Logo upload failed: ${uploadErr.message}`);

        const { data: { publicUrl } } = supabase.storage
          .from("avatars")
          .getPublicUrl(path);
        nextLogoUrl = publicUrl;
        setUploadingLogo(false);
      } else if (removeLogo) {
        nextLogoUrl = null;
      }

      // .select() so a zero-row update is caught. Without it an RLS
      // denial returns { error: null }, the toast said "saved!" and
      // nothing had been written — which is what "doesn't save up" looks
      // like from the outside.
      const result = await supabase
        .from("workspaces")
        .update({
          logo_url: nextLogoUrl,
          company_name: data.company_name?.trim() || null,
          company_tagline: data.company_tagline?.trim() || null,
          company_email: data.company_email?.trim() || null,
          company_phone: data.company_phone?.trim() || null,
          company_website: data.company_website?.trim() || null,
          company_address: data.company_address?.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", workspaceId)
        .select("id");

      assertAffected(result, "your company branding", "save");

      setData((prev) => ({ ...prev, logo_url: nextLogoUrl }));
      setPendingLogo(null);
      setPreviewUrl(null);
      setRemoveLogo(false);
      toast.success("Company branding saved.");
      // The sidebar logo and the letterhead both read the workspace from
      // context, which is cached — without this the save appears to have
      // done nothing until a manual reload.
      await refreshWorkspaces?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to save branding");
    } finally {
      setSaving(false);
      setUploadingLogo(false);
    }
  };

  const field = (
    key: keyof Omit<BrandingData, "logo_url">,
    value: string
  ) => setData((prev) => ({ ...prev, [key]: value }));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <section className="space-y-6 max-w-3xl animate-in fade-in-50 duration-200">
      <SettingsPanelHead
        title="Company Branding"
        description="Upload your company logo and fill in contact details. These appear on all generated quotations and proposals."
      />

      {/* Logo Card */}
      <Card className="border-border bg-card">
        <CardHeader className="border-b border-border/40 pb-4">
          <CardTitle className="flex items-center gap-2 text-foreground">
            <ImageIcon className="size-4 text-primary" />
            Company Logo
          </CardTitle>
          <CardDescription>
            Appears in the header of every quotation PDF. PNG, JPG, WebP or SVG — max 3 MB.
            Recommended dimensions: 300×100 px or similar wide format.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-5">
          <div className="flex flex-col sm:flex-row items-start gap-6">
            {/* Logo Preview */}
            <div className="flex-shrink-0 w-48 h-20 rounded-lg border border-border bg-muted/40 flex items-center justify-center overflow-hidden">
              {currentLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={currentLogoUrl}
                  alt="Company logo"
                  className="max-w-full max-h-full object-contain p-2"
                />
              ) : (
                <div className="flex flex-col items-center gap-1 text-muted-foreground">
                  <Sparkles className="size-6 opacity-40" />
                  <span className="text-[10px] text-center px-2">No logo uploaded</span>
                </div>
              )}
            </div>

            {/* Upload Actions */}
            <div className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={onPickFile}
                disabled={!canEditSettings || saving}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!canEditSettings || saving}
                  className="border-border bg-transparent"
                >
                  <Upload className="size-3.5 mr-1.5" />
                  {currentLogoUrl ? "Change Logo" : "Upload Logo"}
                </Button>
                {currentLogoUrl && (
                  <IconAction label="Remove" icon={<Trash2 className="size-3.5 " />} type="button"
                    variant="ghost"
                    onClick={onRemoveLogo}
                    disabled={!canEditSettings || saving}
                    className="text-muted-foreground hover:text-red-400" />
                )}
              </div>
              {pendingLogo && (
                <p className="text-xs text-primary">
                  ✓ {pendingLogo.name} staged — click &quot;Save Branding&quot; to apply.
                </p>
              )}
              {!canEditSettings && (
                <p className="text-xs text-muted-foreground">
                  Admin or owner role required to change branding.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Company Info Card */}
      <Card className="border-border bg-card">
        <CardHeader className="border-b border-border/40 pb-4">
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Building2 className="size-4 text-primary" />
            Company Details
          </CardTitle>
          <CardDescription>
            These details appear in the quotation header alongside your logo.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-5 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Company Name */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Building2 className="size-3" /> Company Name
              </Label>
              <Input
                value={data.company_name ?? ""}
                onChange={(e) => field("company_name", e.target.value)}
                placeholder="e.g. Daylink Tech Labs"
                disabled={!canEditSettings || saving}
                className="bg-muted border-border text-foreground h-9"
              />
            </div>

            {/* Tagline */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="size-3" /> Tagline / Subtitle
              </Label>
              <Input
                value={data.company_tagline ?? ""}
                onChange={(e) => field("company_tagline", e.target.value)}
                placeholder="e.g. Custom Software & Systems"
                disabled={!canEditSettings || saving}
                className="bg-muted border-border text-foreground h-9"
              />
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Mail className="size-3" /> Business Email
              </Label>
              <Input
                type="email"
                value={data.company_email ?? ""}
                onChange={(e) => field("company_email", e.target.value)}
                placeholder="contact@yourcompany.com"
                disabled={!canEditSettings || saving}
                className="bg-muted border-border text-foreground h-9"
              />
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Phone className="size-3" /> Business Phone
              </Label>
              <Input
                value={data.company_phone ?? ""}
                onChange={(e) => field("company_phone", e.target.value)}
                placeholder="+91 98765 43210"
                disabled={!canEditSettings || saving}
                className="bg-muted border-border text-foreground h-9"
              />
            </div>

            {/* Website */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Globe className="size-3" /> Website
              </Label>
              <Input
                value={data.company_website ?? ""}
                onChange={(e) => field("company_website", e.target.value)}
                placeholder="https://yourcompany.com"
                disabled={!canEditSettings || saving}
                className="bg-muted border-border text-foreground h-9"
              />
            </div>

            {/* Address */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <MapPin className="size-3" /> Address
              </Label>
              <Input
                value={data.company_address ?? ""}
                onChange={(e) => field("company_address", e.target.value)}
                placeholder="123 Main St, City, Country"
                disabled={!canEditSettings || saving}
                className="bg-muted border-border text-foreground h-9"
              />
            </div>
          </div>

          {canEditSettings && (
            <div className="pt-2 flex justify-end">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-primary text-primary-foreground hover:bg-primary/95"
              >
                {saving ? (
                  <>
                    <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                    {uploadingLogo ? "Uploading logo..." : "Saving..."}
                  </>
                ) : (
                  "Save Branding"
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Live Preview */}
      <Card className="border-border bg-card">
        <CardHeader className="border-b border-border/40 pb-4">
          <CardTitle className="text-sm text-foreground flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            Quotation Header Preview
          </CardTitle>
          <CardDescription>
            How your branding will look on generated proposals.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-5">
          <div className="rounded-lg border border-border bg-white dark:bg-zinc-950 p-8 flex flex-col items-center justify-center text-center pb-6 border-b-4 border-b-primary shadow-sm">
            {currentLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentLogoUrl}
                alt="Logo preview"
                className="h-20 sm:h-28 max-w-[280px] object-contain mb-2"
              />
            ) : (
                <h1 className="text-xl sm:text-lg font-serif font-semibold text-foreground uppercase tracking-wide mb-1">
                  {data.company_name?.toUpperCase() || "YOUR COMPANY"}
                </h1>
            )}

            {data.company_tagline && (
              <p className="text-base text-primary font-medium mb-2">
                {data.company_tagline}
              </p>
            )}

            <div className="text-xs text-muted-foreground space-y-1">
              {data.company_address && <p>{data.company_address}</p>}
              <p className="flex items-center justify-center gap-2">
                {data.company_phone && <span>{data.company_phone}</span>}
                {data.company_phone && data.company_email && <span>|</span>}
                {data.company_email && <span>{data.company_email}</span>}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
