"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { assertAffected } from "@/lib/supabase/affected-rows";
import { useWorkspace } from "@/hooks/use-workspace";
import { createClient } from "@/lib/supabase/client";
import { SettingsPanelHead } from "@/components/settings/settings-panel-head";
import { A4DocumentPreview } from "./a4-document-preview";
import {
  Building2,
  Palette,
  Save,
  Loader2,
  FileText,
  Sparkles,
  Layers,
  Sliders,
  Upload,
  Trash2,
  ImageIcon
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IconAction } from "@/components/ui/icon-action";
import { NativeSelect } from "@/components/ui/native-select";

export function LetterheadDesigner() {
  const supabase = createClient();
  const { activeWorkspace, refreshWorkspaces } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Letterhead State
  const [companyName, setCompanyName] = useState("");
  const [tagline, setTagline] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [watermarkUrl, setWatermarkUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#0284c7");
  const [secondaryColor, setSecondaryColor] = useState("#64748b");
  const [brandTheme, setBrandTheme] = useState<"minimal" | "corporate" | "government" | "education" | "medical">("corporate");
  const [paperSize, setPaperSize] = useState<"A4" | "Letter">("A4");
  const [pageMargin, setPageMargin] = useState<"compact" | "normal" | "wide">("normal");
  const [fontFamily, setFontFamily] = useState("Inter");
  const [showWatermark, setShowWatermark] = useState(false);
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.05);

  // Contact & Address Specifications
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [taxId, setTaxId] = useState("");

  // Layout & Alignment Controls
  const [logoPosition, setLogoPosition] = useState<"left" | "center" | "right">("left");
  const [logoHeight, setLogoHeight] = useState<number>(64);
  const [companyNameSize, setCompanyNameSize] = useState<number>(20);
  const [headerLayoutStyle, setHeaderLayoutStyle] = useState<"standard" | "centered" | "split">("standard");

  useEffect(() => {
    if (!activeWorkspace?.id) return;
    const fetchConfig = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("company_letterhead_configs")
        .select("*")
        .eq("workspace_id", activeWorkspace.id)
        .maybeSingle();

      if (data) {
        setCompanyName(data.company_name || activeWorkspace.name || "");
        setTagline(data.tagline || "");
        setLogoUrl(data.logo_url || "");
        setWatermarkUrl(data.watermark_logo_url || "");
        setPrimaryColor(data.primary_color || "#0284c7");
        setSecondaryColor(data.secondary_color || "#64748b");
        setBrandTheme(data.brand_theme || "corporate");
        setPaperSize(data.paper_size || "A4");
        setPageMargin(data.page_margin || "normal");
        setFontFamily(data.font_family || "Inter");
        setShowWatermark(data.show_watermark ?? false);
        setWatermarkOpacity(data.watermark_opacity ?? 0.05);
        // Restored here too. These six were never read back, so even once
        // the save was fixed a reload would have shown defaults and looked
        // like the config had not persisted.
        setTaxId(data.tax_id || "");
        setLogoPosition(data.logo_position || "left");
        setLogoHeight(data.logo_height ?? 64);
        setCompanyNameSize(data.company_name_size ?? 20);
        setHeaderLayoutStyle(data.header_layout_style || "standard");
        // The letterhead row is authoritative for the address; the
        // workspace copy below is a mirror for the sidebar and checklist.
        if (data.company_address) setCompanyAddress(data.company_address);
      } else {
        setCompanyName(activeWorkspace.name || "");
      }

      // Fetch Workspace details for address/phone/email/tax
      const { data: ws } = await supabase
        .from("workspaces")
        .select("company_address, company_phone, company_email")
        .eq("id", activeWorkspace.id)
        .maybeSingle();

      if (ws) {
        // Only when the letterhead row did not already supply one.
        setCompanyAddress((prev) => prev || ws.company_address || "");
        setCompanyPhone(ws.company_phone || "");
        setCompanyEmail(ws.company_email || "");
      }

      setLoading(false);
    };

    fetchConfig();
  }, [activeWorkspace?.id, activeWorkspace?.name, supabase]);

  const [uploadingLogo, setUploadingLogo] = useState(false);

  const handleLogoUpload = async (file: File) => {
    if (!activeWorkspace?.id) return;
    setUploadingLogo(true);
    try {
      toast.loading("Uploading logo image...");
      const fileExt = file.name.split(".").pop();
      // `chat-media` has NO storage policy in any migration, so a direct
      // browser upload to it always failed with "new row violates
      // row-level security policy". Other code reaches that bucket through
      // /api/storage/upload, which uses the service role and bypasses RLS
      // — this component uploaded straight from the client.
      //
      // Uses the workspace-logos prefix instead, which migration 095
      // already secures to owners and admins of that workspace. The policy
      // only inspects the first two path segments, so a deeper
      // `/letterhead/` folder still matches.
      const filePath = `workspace-logos/${activeWorkspace.id}/letterhead/logo_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      setLogoUrl(publicUrlData.publicUrl);
      toast.dismiss();
      toast.success("Logo image uploaded successfully!");
    } catch (err: any) {
      toast.dismiss();
      toast.error(err.message || "Failed to upload logo.");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSave = async () => {
    if (!activeWorkspace?.id) return;
    setSaving(true);

    try {
      const payload = {
        workspace_id: activeWorkspace.id,
        company_name: companyName,
        tagline,
        logo_url: logoUrl,
        watermark_logo_url: watermarkUrl || logoUrl,
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        brand_theme: brandTheme,
        paper_size: paperSize,
        page_margin: pageMargin,
        font_family: fontFamily,
        show_watermark: showWatermark,
        watermark_opacity: watermarkOpacity,
        // These six are edited in this panel and were collected into state
        // but NEVER included in the payload — so the tax number, address,
        // logo placement, logo height, company-name size and header layout
        // silently never persisted, while the toast said "saved". Migration
        // 085 added the columns for exactly these fields; the write was
        // never wired up to them.
        tax_id: taxId.trim() || null,
        company_address: companyAddress.trim() || null,
        logo_position: logoPosition,
        logo_height: logoHeight,
        company_name_size: companyNameSize,
        header_layout_style: headerLayoutStyle,
        updated_at: new Date().toISOString(),
      };

      // .select() so an upsert that RLS turned into a zero-row update is
      // caught rather than reported as a success.
      const result = await supabase
        .from("company_letterhead_configs")
        .upsert(payload, { onConflict: "workspace_id" })
        .select("id");

      assertAffected(result, "your letterhead", "save");

      // Contact details are mirrored onto the workspace because the sidebar
      // and the setup checklist read them from there. This was
      // fire-and-forget: no error check and no row check, so a failure here
      // was invisible behind the success toast.
      const wsResult = await supabase
        .from("workspaces")
        .update({
          company_address: companyAddress.trim() || null,
          company_phone: companyPhone.trim() || null,
          company_email: companyEmail.trim() || null,
        })
        .eq("id", activeWorkspace.id)
        .select("id");

      assertAffected(wsResult, "your company contact details", "save");

      toast.success("Letterhead saved.");
      // The sidebar logo and the checklist read the workspace from a cached
      // context, so without this the save appears to have done nothing.
      await refreshWorkspaces?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to save letterhead config.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground text-xs">
        <Loader2 className="size-5 animate-spin mr-2" />
        Loading Letterhead Designer...
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-foreground">
      {/* Left Configuration Panel */}
      <div className="lg:col-span-6 space-y-6">
        <SettingsPanelHead
          title="Letterhead & Brand Designer"
          description="Customize your official company letterhead themes, logo positioning, margins, and watermarks."
          action={
            <IconAction label="Save Letterhead" icon={saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} onClick={handleSave}
              disabled={saving}
              className="bg-primary text-primary-foreground font-semibold gap-1.5 shadow-xs" />
          }
        />

        {/* Brand Theme Selector */}
        <Card className="bg-card border-border shadow-xs rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Palette className="size-4 text-primary" /> Brand Preset Themes
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Select an official letterhead layout theme suitable for your industry.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            {[
              { id: "corporate", label: "Corporate Accent", desc: "Top accent bar" },
              { id: "minimal", label: "Minimal Modern", desc: "Clean & subtle" },
              { id: "government", label: "Government / Legal", desc: "Formal border" },
              { id: "education", label: "Academic / University", desc: "Classic header" },
              { id: "medical", label: "Medical / Clinic", desc: "Clinical layout" },
            ].map((theme) => (
              <button
                key={theme.id}
                type="button"
                onClick={() => setBrandTheme(theme.id as any)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  brandTheme === theme.id
                    ? "border-primary bg-primary/10 font-bold"
                    : "border-border hover:bg-muted/50 text-muted-foreground"
                }`}
              >
                <div className="font-semibold text-foreground">{theme.label}</div>
                <div className="text-[10px] text-muted-foreground">{theme.desc}</div>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Header Layout & Alignment Controls */}
        <Card className="bg-card border-border shadow-xs rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Sliders className="size-4 text-purple-500" /> Header Layout &amp; Alignment
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Adjust logo sizing, placement, header layout, and title font sizes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            {/* Layout Style */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Header Layout Style</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setHeaderLayoutStyle("standard")}
                  className={`p-2.5 rounded-xl border text-left font-medium transition-all ${
                    headerLayoutStyle === "standard"
                      ? "border-primary bg-primary/10 text-primary font-bold"
                      : "border-border text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  Standard Side-by-Side
                </button>
                <button
                  type="button"
                  onClick={() => setHeaderLayoutStyle("centered")}
                  className={`p-2.5 rounded-xl border text-left font-medium transition-all ${
                    headerLayoutStyle === "centered"
                      ? "border-primary bg-primary/10 text-primary font-bold"
                      : "border-border text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  Centered Crest Header
                </button>
              </div>
            </div>

            {/* Logo Alignment */}
            {headerLayoutStyle === "standard" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Logo Alignment</Label>
                <div className="flex items-center gap-2">
                  {[
                    { id: "left", label: "Left Aligned" },
                    { id: "center", label: "Center Aligned" },
                    { id: "right", label: "Right Aligned" },
                  ].map((pos) => (
                    <button
                      key={pos.id}
                      type="button"
                      onClick={() => setLogoPosition(pos.id as any)}
                      className={`flex-1 py-1.5 px-3 rounded-lg border text-center font-medium transition-all ${
                        logoPosition === pos.id
                          ? "border-primary bg-primary text-primary-foreground font-bold"
                          : "border-border text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {pos.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Logo Height Slider */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Logo Height ({logoHeight}px)</Label>
                <div className="flex items-center gap-1 text-[10px]">
                  {[40, 64, 88, 110].map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setLogoHeight(size)}
                      className={`px-2 py-0.5 rounded border ${
                        logoHeight === size ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"
                      }`}
                    >
                      {size}px
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="range"
                min="32"
                max="120"
                value={logoHeight}
                onChange={(e) => setLogoHeight(Number(e.target.value))}
                className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
              />
            </div>

            {/* Company Name Font Size Slider */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Company Name Size ({companyNameSize}px)</Label>
                <div className="flex items-center gap-1 text-[10px]">
                  {[16, 20, 24, 28].map((fs) => (
                    <button
                      key={fs}
                      type="button"
                      onClick={() => setCompanyNameSize(fs)}
                      className={`px-2 py-0.5 rounded border ${
                        companyNameSize === fs ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"
                      }`}
                    >
                      {fs}px
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="range"
                min="14"
                max="36"
                value={companyNameSize}
                onChange={(e) => setCompanyNameSize(Number(e.target.value))}
                className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
              />
            </div>
          </CardContent>
        </Card>

        {/* Company Header Identity */}
        <Card className="bg-card border-border shadow-xs rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Building2 className="size-4 text-emerald-500" /> Header & Logo Branding
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Company Legal Name</Label>
                <Input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="bg-background text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Tax ID / GSTIN / CIN</Label>
                <Input
                  type="text"
                  placeholder="e.g. 29AAAAA0000A1Z5"
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  className="bg-background text-xs font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Tagline / Slogan</Label>
              <Input
                type="text"
                placeholder="e.g. Empowering Enterprise Workflows"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                className="bg-background text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Registered Company Address</Label>
              <Input
                type="text"
                placeholder="e.g. Suite 400, Innovation Tower, Tech Park, Bangalore"
                value={companyAddress}
                onChange={(e) => setCompanyAddress(e.target.value)}
                className="bg-background text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Contact Email</Label>
                <Input
                  type="email"
                  placeholder="contact@company.com"
                  value={companyEmail}
                  onChange={(e) => setCompanyEmail(e.target.value)}
                  className="bg-background text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Contact Phone</Label>
                <Input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={companyPhone}
                  onChange={(e) => setCompanyPhone(e.target.value)}
                  className="bg-background text-xs"
                />
              </div>
            </div>

            {/* Premium Drag & Drop Upload Box */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Company Logo Image</Label>
              {logoUrl ? (
                <div className="p-4 bg-card border border-border rounded-2xl flex items-center justify-between gap-4 shadow-xs">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-muted/60 rounded-xl border border-border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={logoUrl} alt="Company Logo" className="h-12 max-w-[140px] object-contain" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">Company Logo Uploaded</p>
                      <p className="text-[10px] text-muted-foreground font-mono truncate max-w-[220px]">{logoUrl}</p>
                    </div>
                  </div>
                  <IconAction label="Remove Logo" icon={<Trash2 className="size-3.5 " />} type="button"
                    variant="ghost"
                    onClick={() => setLogoUrl("")}
                    className="h-8 px-2.5 text-xs text-rose-500 hover:bg-rose-500/10 font-semibold" />
                </div>
              ) : (
                <label className="relative border-2 border-dashed border-primary/30 hover:border-primary/60 bg-primary/5 hover:bg-primary/10 transition-all rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer group">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleLogoUpload(file);
                    }}
                    className="sr-only"
                    disabled={uploadingLogo}
                  />
                  <div className="h-10 w-10 rounded-2xl bg-primary/15 flex items-center justify-center text-primary group-hover:scale-110 transition-transform mb-2">
                    {uploadingLogo ? <Loader2 className="size-5 animate-spin" /> : <Upload className="size-5" />}
                  </div>
                  <p className="text-xs font-bold text-foreground">
                    {uploadingLogo ? "Uploading Company Logo..." : "Click or Drag & Drop Logo Image"}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Supports PNG, JPG, WebP or SVG format (Max 5 MB)
                  </p>
                </label>
              )}
            </div>

            <div className="space-y-1.5 pt-1 border-t border-border/60">
              <Label className="text-xs font-semibold">Primary Theme Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-8 w-10 rounded border border-border cursor-pointer bg-background"
                />
                <Input
                  type="text"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="bg-background text-xs font-mono"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Paper & Page Layout */}
        <Card className="bg-card border-border shadow-xs rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Sliders className="size-4 text-purple-500" /> Paper Size & Margins
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Paper Standard</Label>
                <NativeSelect
                  value={paperSize}
                  onChange={(e) => setPaperSize(e.target.value as any)}
                  className="w-full bg-background border border-border text-foreground text-xs rounded-lg px-3 py-2"
                >
                  <option value="A4">A4 (210mm x 297mm - Global)</option>
                  <option value="Letter">US Letter (8.5in x 11in - US/CA)</option>
                </NativeSelect>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Page Margin</Label>
                <NativeSelect
                  value={pageMargin}
                  onChange={(e) => setPageMargin(e.target.value as any)}
                  className="w-full bg-background border border-border text-foreground text-xs rounded-lg px-3 py-2"
                >
                  <option value="compact">Compact Margins</option>
                  <option value="normal">Standard Margins</option>
                  <option value="wide">Wide Margins</option>
                </NativeSelect>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border/60">
              <div className="space-y-0.5">
                <Label className="text-xs font-semibold">Center Background Watermark</Label>
                <p className="text-[11px] text-muted-foreground">Show faint company logo in the center of printed letters.</p>
              </div>
              <Switch
                checked={showWatermark}
                onCheckedChange={setShowWatermark}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right Live A4 Canvas Preview */}
      <div className="lg:col-span-6 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Live Canvas Preview</span>
          <span className="text-[11px] text-primary font-medium">{paperSize} Format</span>
        </div>

        <div className="bg-muted/40 p-4 rounded-2xl border border-border overflow-auto max-h-[700px]">
          <A4DocumentPreview
            letterhead={{
              company_name: companyName || "Your Company Name",
              tagline: tagline || "Empowering Enterprise Operations",
              logo_url: logoUrl || null,
              watermark_logo_url: watermarkUrl || logoUrl || null,
              primary_color: primaryColor,
              brand_theme: brandTheme,
              paper_size: paperSize,
              page_margin: pageMargin,
              show_watermark: showWatermark,
              watermark_opacity: watermarkOpacity,
              logo_position: logoPosition,
              logo_height: logoHeight,
              company_name_size: companyNameSize,
              header_layout_style: headerLayoutStyle,
              tax_id: taxId,
              company_address: companyAddress,
            }}
            bodyHtml={`
              <h3>Official Company Memorandum</h3>
              <p>This is a live preview of your workspace's official letterhead styling. Any content generated through the Document Studio will render on this canvas.</p>
              <ul>
                <li>Integrated with HR Employment Offer Letters & Experience Certificates</li>
                <li>Linked with CRM Commercial Proposals & Official Agreements</li>
                <li>Supports Vector PDF Export & Native Browser Printing</li>
              </ul>
              <p>Configure your primary accent colors, logo URLs, and signatories to issue authenticated company documents.</p>
            `}
            documentNumber="DOC-2026-00001"
            signatory={{
              name: "Swaraj Jakanoor",
              designation: "Chief Executive Officer",
            }}
          />
        </div>
      </div>
    </div>
  );
}
