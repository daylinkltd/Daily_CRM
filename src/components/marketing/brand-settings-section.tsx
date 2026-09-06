'use client';

import React, { useState, useEffect } from 'react';
import { useWorkspace } from '@/hooks/use-workspace';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { NativeSelect } from '@/components/ui/native-select';
import {
  Building2,
  Image as ImageIcon,
  UploadCloud,
  Trash2,
  Copy,
  Check,
  Plus,
  Layers,
  Sparkles,
  RefreshCw,
  ExternalLink,
  Tag,
  FileText,
  User,
  Monitor,
  Package,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { BrandAsset, BrandAssetCategory } from '@/lib/marketing/brand-asset-selector';

const CATEGORY_TABS: Array<{ id: string; label: string; icon: any }> = [
  { id: 'ALL', label: 'All Assets', icon: Layers },
  { id: 'LOGOS', label: 'Logos', icon: Sparkles },
  { id: 'PRODUCTS', label: 'Products', icon: Package },
  { id: 'UI_DIGITAL', label: 'UI / Digital', icon: Monitor },
  { id: 'PEOPLE', label: 'People', icon: User },
  { id: 'OTHER', label: 'Other / Backgrounds', icon: ImageIcon },
];

export function BrandSettingsSection() {
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id || '';

  // 1. Brand Profile State
  const [profileLoading, setProfileLoading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profile, setProfile] = useState({
    company_name: activeWorkspace?.name || '',
    website: '',
    business_description: '',
    industry: '',
    target_audience: '',
    brand_voice: '',
    brand_personality: '',
    primary_color: '#E2B170',
    secondary_color: '#8B5A2B',
    brand_guidelines: '',
  });

  // 2. Brand Assets State
  const [assets, setAssets] = useState<BrandAsset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  // Upload Form State
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState('');
  const [uploadCategory, setUploadCategory] = useState<BrandAssetCategory>('PRODUCTS');
  const [uploadSubCategory, setUploadSubCategory] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');

  // Fetch Brand Profile
  const fetchProfile = async () => {
    if (!workspaceId) return;
    setProfileLoading(true);
    try {
      const res = await fetch(`/api/marketing/brand-profile?workspace_id=${workspaceId}`);
      const json = await res.json();
      if (json.success && json.profile) {
        setProfile({
          company_name: json.profile.company_name || activeWorkspace?.name || '',
          website: json.profile.website || '',
          business_description: json.profile.business_description || '',
          industry: json.profile.industry || '',
          target_audience: json.profile.target_audience || '',
          brand_voice: json.profile.brand_voice || '',
          brand_personality: json.profile.brand_personality || '',
          primary_color: json.profile.primary_color || '#E2B170',
          secondary_color: json.profile.secondary_color || '#8B5A2B',
          brand_guidelines: json.profile.brand_guidelines || '',
        });
      }
    } catch (err) {
      console.warn('[BrandSettings] Fetch profile failed:', err);
    } finally {
      setProfileLoading(false);
    }
  };

  // Fetch Assets
  const fetchAssets = async () => {
    if (!workspaceId) return;
    setAssetsLoading(true);
    try {
      const res = await fetch(`/api/marketing/brand-assets?workspace_id=${workspaceId}`);
      const json = await res.json();
      if (json.success) {
        setAssets(json.assets || []);
      }
    } catch (err) {
      console.warn('[BrandSettings] Fetch assets failed:', err);
    } finally {
      setAssetsLoading(false);
    }
  };

  useEffect(() => {
    if (workspaceId) {
      fetchProfile();
      fetchAssets();
    }
  }, [workspaceId]);

  // Save Brand Profile
  const handleSaveProfile = async () => {
    if (!workspaceId) {
      toast.error('Workspace context missing');
      return;
    }
    if (!profile.company_name.trim()) {
      toast.error('Company Name is required');
      return;
    }

    setSavingProfile(true);
    try {
      const res = await fetch('/api/marketing/brand-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          ...profile,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save brand profile');

      toast.success('Brand profile saved successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Error saving brand profile');
    } finally {
      setSavingProfile(false);
    }
  };

  // Upload Asset
  const handleUploadAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !workspaceId) {
      toast.error('Please select a file to upload');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('workspace_id', workspaceId);
      formData.append('name', uploadName.trim() || uploadFile.name);
      formData.append('category', uploadCategory);
      formData.append('sub_category', uploadSubCategory.trim());
      formData.append('description', uploadDescription.trim());

      const res = await fetch('/api/marketing/brand-assets', {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Upload failed');

      toast.success('Brand asset uploaded successfully!');
      setIsUploadModalOpen(false);
      setUploadFile(null);
      setUploadName('');
      setUploadSubCategory('');
      setUploadDescription('');
      fetchAssets();
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // Delete Asset
  const handleDeleteAsset = async (assetId: string) => {
    if (!confirm('Are you sure you want to delete this brand asset?')) return;
    try {
      const res = await fetch(`/api/marketing/brand-assets?id=${assetId}&workspace_id=${workspaceId}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Delete failed');

      toast.success('Asset deleted');
      setAssets((prev) => prev.filter((a) => a.id !== assetId));
    } catch (err: any) {
      toast.error(err.message || 'Delete failed');
    }
  };

  const copyToClipboard = (url: string) => {
    const fullUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedUrl(url);
    toast.success('Public URL copied to clipboard');
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const filteredAssets = selectedCategory === 'ALL'
    ? assets
    : assets.filter((a) => a.category === selectedCategory);

  return (
    <div className="space-y-8 max-w-4xl">
      {/* 1. BRAND PROFILE SECTION */}
      <div className="rounded-3xl border border-border bg-card p-6 space-y-6 shadow-xs">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="space-y-1">
            <h3 className="text-sm font-black text-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" /> Brand Profile & Identity
            </h3>
            <p className="text-xs text-muted-foreground">
              Define your company identity so the AI produces personalized, accurate content for your business.
            </p>
          </div>
          <Button
            onClick={handleSaveProfile}
            disabled={savingProfile}
            className="rounded-xl text-xs font-bold bg-primary text-primary-foreground shadow-xs"
          >
            {savingProfile ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
            Save Brand Profile
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground">Company / Brand Name *</label>
            <Input
              value={profile.company_name}
              onChange={(e) => setProfile({ ...profile, company_name: e.target.value })}
              placeholder="e.g. Lumina Fragrance / NovaTech Solutions"
              className="h-9 rounded-xl text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground">Website URL</label>
            <Input
              value={profile.website}
              onChange={(e) => setProfile({ ...profile, website: e.target.value })}
              placeholder="https://example.com"
              className="h-9 rounded-xl text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground">Industry / Sector</label>
            <Input
              value={profile.industry}
              onChange={(e) => setProfile({ ...profile, industry: e.target.value })}
              placeholder="e.g. Home Fragrance, E-Commerce, Healthcare, SaaS"
              className="h-9 rounded-xl text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground">Target Audience</label>
            <Input
              value={profile.target_audience}
              onChange={(e) => setProfile({ ...profile, target_audience: e.target.value })}
              placeholder="e.g. Women 25–45, CTOs, Home decor enthusiasts"
              className="h-9 rounded-xl text-xs"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-bold text-foreground">Business & Product Description</label>
            <Textarea
              rows={2}
              value={profile.business_description}
              onChange={(e) => setProfile({ ...profile, business_description: e.target.value })}
              placeholder="Describe what your business makes, sells, or offers..."
              className="rounded-xl text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground">Brand Voice</label>
            <Input
              value={profile.brand_voice}
              onChange={(e) => setProfile({ ...profile, brand_voice: e.target.value })}
              placeholder="e.g. Premium, warm, elegant, authoritative"
              className="h-9 rounded-xl text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground">Brand Personality</label>
            <Input
              value={profile.brand_personality}
              onChange={(e) => setProfile({ ...profile, brand_personality: e.target.value })}
              placeholder="e.g. Artisanal, approachable, innovative"
              className="h-9 rounded-xl text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground">Primary Brand Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={profile.primary_color}
                onChange={(e) => setProfile({ ...profile, primary_color: e.target.value })}
                className="h-8 w-8 rounded-lg border border-border cursor-pointer p-0.5"
              />
              <Input
                value={profile.primary_color}
                onChange={(e) => setProfile({ ...profile, primary_color: e.target.value })}
                placeholder="#E2B170"
                className="h-9 rounded-xl text-xs font-mono"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground">Secondary Brand Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={profile.secondary_color}
                onChange={(e) => setProfile({ ...profile, secondary_color: e.target.value })}
                className="h-8 w-8 rounded-lg border border-border cursor-pointer p-0.5"
              />
              <Input
                value={profile.secondary_color}
                onChange={(e) => setProfile({ ...profile, secondary_color: e.target.value })}
                placeholder="#8B5A2B"
                className="h-9 rounded-xl text-xs font-mono"
              />
            </div>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-bold text-foreground">Additional Brand Guidelines</label>
            <Textarea
              rows={2}
              value={profile.brand_guidelines}
              onChange={(e) => setProfile({ ...profile, brand_guidelines: e.target.value })}
              placeholder="Specific phrases to use or avoid, styling rules, typography notes..."
              className="rounded-xl text-xs"
            />
          </div>
        </div>
      </div>

      {/* 2. BRAND ASSET LIBRARY SECTION */}
      <div className="rounded-3xl border border-border bg-card p-6 space-y-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
          <div className="space-y-1">
            <h3 className="text-sm font-black text-foreground flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-primary" /> Brand Asset Library
            </h3>
            <p className="text-xs text-muted-foreground">
              Upload logos, product photos, UI screenshots, and team portraits. The AI will intelligently reference their public URLs in generation prompts.
            </p>
          </div>
          <Button
            onClick={() => setIsUploadModalOpen(true)}
            className="rounded-xl text-xs font-bold bg-primary text-primary-foreground shadow-xs shrink-0 flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" /> Upload Brand Asset
          </Button>
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {CATEGORY_TABS.map((tab) => {
            const Icon = tab.icon;
            const count = tab.id === 'ALL'
              ? assets.length
              : assets.filter((a) => a.category === tab.id).length;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedCategory(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all shrink-0',
                  selectedCategory === tab.id
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'border-border bg-background text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-muted font-mono">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Asset Cards Grid */}
        {assetsLoading ? (
          <div className="py-12 flex flex-col items-center justify-center text-muted-foreground">
            <RefreshCw className="h-6 w-6 animate-spin mb-2 text-primary" />
            <span className="text-xs font-medium">Loading brand assets...</span>
          </div>
        ) : filteredAssets.length === 0 ? (
          <div className="py-12 border-2 border-dashed border-border rounded-2xl flex flex-col items-center justify-center text-center p-6 space-y-3 bg-muted/20">
            <ImageIcon className="h-10 w-10 text-muted-foreground/60" />
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-foreground">No assets in this category</h4>
              <p className="text-[11px] text-muted-foreground max-w-sm">
                Upload your primary logo, product photos, or UI screenshots to enrich AI creative prompt generation.
              </p>
            </div>
            <Button
              onClick={() => setIsUploadModalOpen(true)}
              variant="outline"
              className="rounded-xl text-xs font-bold h-8"
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Upload Asset
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {filteredAssets.map((asset) => (
              <div
                key={asset.id}
                className="group relative rounded-2xl border border-border bg-background overflow-hidden flex flex-col shadow-2xs hover:border-primary/50 transition-all"
              >
                {/* Media Preview */}
                <div className="h-36 w-full bg-muted/40 relative flex items-center justify-center overflow-hidden">
                  <img
                    src={asset.public_url}
                    alt={asset.name}
                    className="h-full w-full object-contain p-2 group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <Badge
                    variant="secondary"
                    className="absolute top-2 left-2 text-[10px] font-bold bg-background/90 backdrop-blur-xs border-border"
                  >
                    {asset.category}
                  </Badge>
                </div>

                {/* Info */}
                <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
                  <div className="space-y-1">
                    <h5 className="text-xs font-bold text-foreground truncate" title={asset.name}>
                      {asset.name}
                    </h5>
                    {asset.sub_category && (
                      <p className="text-[10px] text-primary font-medium">{asset.sub_category}</p>
                    )}
                    {asset.description && (
                      <p className="text-[11px] text-muted-foreground line-clamp-2" title={asset.description}>
                        {asset.description}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="pt-2 border-t border-border/60 flex items-center justify-between text-muted-foreground">
                    <button
                      type="button"
                      onClick={() => copyToClipboard(asset.public_url)}
                      className="text-[11px] font-medium flex items-center gap-1 hover:text-primary transition-colors"
                      title="Copy Public URL"
                    >
                      {copiedUrl === asset.public_url ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-500" />
                          <span className="text-emerald-500 font-bold">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span>Copy URL</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteAsset(asset.id)}
                      className="text-[11px] hover:text-destructive transition-colors p-1"
                      title="Delete Asset"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* UPLOAD MODAL */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl p-6 max-w-md w-full space-y-4 shadow-xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-black text-foreground flex items-center gap-2">
                <UploadCloud className="h-4 w-4 text-primary" /> Upload Brand Asset
              </h3>
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(false)}
                className="text-xs font-bold text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUploadAsset} className="space-y-4">
              {/* File input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Select File *</label>
                <Input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setUploadFile(f);
                      if (!uploadName) {
                        setUploadName(f.name.replace(/\.[^/.]+$/, ''));
                      }
                    }
                  }}
                  className="rounded-xl text-xs"
                  required
                />
              </div>

              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Asset Name *</label>
                <Input
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                  placeholder="e.g. Vanilla Candle Hero Shot / Primary White Logo"
                  className="h-9 rounded-xl text-xs"
                  required
                />
              </div>

              {/* Category & SubCategory */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">Category *</label>
                  <NativeSelect
                    value={uploadCategory}
                    onChange={(e) => setUploadCategory(e.target.value as BrandAssetCategory)}
                    className="w-full h-9 rounded-xl border border-border bg-background px-3 text-xs font-bold text-foreground"
                  >
                    <option value="LOGOS">LOGOS</option>
                    <option value="PRODUCTS">PRODUCTS</option>
                    <option value="UI_DIGITAL">UI / DIGITAL</option>
                    <option value="PEOPLE">PEOPLE</option>
                    <option value="OTHER">OTHER</option>
                  </NativeSelect>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">Sub-Category</label>
                  <Input
                    value={uploadSubCategory}
                    onChange={(e) => setUploadSubCategory(e.target.value)}
                    placeholder="e.g. Primary Logo, App UI"
                    className="h-9 rounded-xl text-xs"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">
                  Description <span className="text-muted-foreground font-normal">(Crucial for AI Selection)</span>
                </label>
                <Textarea
                  rows={2}
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  placeholder="e.g. Main handmade vanilla scented candle with luxury label in studio lighting..."
                  className="rounded-xl text-xs"
                />
              </div>

              {/* Submit */}
              <div className="pt-3 border-t border-border flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="rounded-xl text-xs font-bold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={uploading || !uploadFile}
                  className="rounded-xl text-xs font-bold bg-primary text-primary-foreground"
                >
                  {uploading ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                  Upload to Library
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
