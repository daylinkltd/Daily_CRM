'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { NativeSelect } from '@/components/ui/native-select';
import {
  UploadCloud,
  Image as ImageIcon,
  Sparkles,
  Trash2,
  Copy,
  Check,
  Plus,
  RefreshCw,
  Layers,
  FileText,
  Building2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { BrandAsset, BrandAssetCategory } from '@/lib/marketing/brand-asset-selector';

interface ReferenceAssetUploaderProps {
  workspaceId: string;
  references: BrandAsset[];
  onChange: (assets: BrandAsset[]) => void;
  className?: string;
}

export function ReferenceAssetUploader({
  workspaceId,
  references,
  onChange,
  className,
}: ReferenceAssetUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [libraryAssets, setLibraryAssets] = useState<BrandAsset[]>([]);
  const [showLibraryPicker, setShowLibraryPicker] = useState(false);
  const [loadingLibrary, setLoadingLibrary] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const replacingAssetIdRef = useRef<string | null>(null);

  // Fetch workspace library assets for quick selection
  const fetchLibrary = async () => {
    if (!workspaceId) return;
    setLoadingLibrary(true);
    try {
      const res = await fetch(`/api/marketing/brand-assets?workspace_id=${workspaceId}`);
      const json = await res.json();
      if (json.success) {
        setLibraryAssets(json.assets || []);
      }
    } catch (err) {
      console.warn('[ReferenceAssetUploader] Library fetch error:', err);
    } finally {
      setLoadingLibrary(false);
    }
  };

  useEffect(() => {
    if (workspaceId) {
      fetchLibrary();
    }
  }, [workspaceId]);

  // Upload single or multiple files
  const handleFilesUpload = async (files: FileList | File[]) => {
    if (!workspaceId) {
      toast.error('Workspace context missing. Please select a workspace.');
      return;
    }

    const fileList = Array.from(files);
    if (fileList.length === 0) return;

    setUploading(true);
    const uploadedAssets: BrandAsset[] = [];

    for (const file of fileList) {
      // Validate type & size
      const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
      if (!validTypes.includes(file.type)) {
        toast.error(`Invalid format for ${file.name}. Allowed: PNG, JPG, WEBP, SVG`);
        continue;
      }
      if (file.size > 20 * 1024 * 1024) {
        toast.error(`File ${file.name} exceeds 20MB limit.`);
        continue;
      }

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('workspace_id', workspaceId);
        formData.append('name', file.name.replace(/\.[^/.]+$/, ''));

        // Smart initial category guess
        const nameLower = file.name.toLowerCase();
        let initialCat: BrandAssetCategory = 'PRODUCTS';
        if (nameLower.includes('logo') || nameLower.includes('icon') || nameLower.includes('brand')) {
          initialCat = 'LOGOS';
        } else if (nameLower.includes('ui') || nameLower.includes('app') || nameLower.includes('screen') || nameLower.includes('dashboard')) {
          initialCat = 'UI_DIGITAL';
        } else if (nameLower.includes('founder') || nameLower.includes('team') || nameLower.includes('person') || nameLower.includes('headshot')) {
          initialCat = 'PEOPLE';
        }
        formData.append('category', initialCat);

        const res = await fetch('/api/marketing/brand-assets', {
          method: 'POST',
          body: formData,
        });

        const json = await res.json();
        if (res.ok && json.success && json.asset) {
          uploadedAssets.push(json.asset);
        } else {
          toast.error(json.error || `Failed to upload ${file.name}`);
        }
      } catch (err: any) {
        toast.error(err.message || `Upload failed for ${file.name}`);
      }
    }

    if (uploadedAssets.length > 0) {
      const merged = [...references, ...uploadedAssets];
      onChange(merged);
      toast.success(`Uploaded ${uploadedAssets.length} reference asset${uploadedAssets.length > 1 ? 's' : ''}!`);
      fetchLibrary();
    }
    setUploading(false);
  };

  // Drag & Drop events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesUpload(e.dataTransfer.files);
    }
  };

  // Clipboard Paste Support (Ctrl+V / Cmd+V)
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items || items.length === 0) return;

    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (file) {
          const renamedFile = new File(
            [file],
            `Pasted Reference ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}.png`,
            { type: file.type || 'image/png' }
          );
          imageFiles.push(renamedFile);
        }
      }
    }

    if (imageFiles.length > 0) {
      e.preventDefault();
      handleFilesUpload(imageFiles);
      toast.info(`Pasting ${imageFiles.length} image${imageFiles.length > 1 ? 's' : ''} from clipboard...`);
    }
  };

  // Global window paste listener for screenshot pasting
  useEffect(() => {
    const onWindowPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items || items.length === 0) return;

      const imageFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile();
          if (file) {
            const renamedFile = new File(
              [file],
              `Pasted Reference ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}.png`,
              { type: file.type || 'image/png' }
            );
            imageFiles.push(renamedFile);
          }
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault();
        handleFilesUpload(imageFiles);
        toast.info(`Pasting ${imageFiles.length} image${imageFiles.length > 1 ? 's' : ''} from clipboard...`);
      }
    };

    window.addEventListener('paste', onWindowPaste);
    return () => window.removeEventListener('paste', onWindowPaste);
  }, [workspaceId, references]);

  // Remove reference
  const handleRemove = (id: string) => {
    const next = references.filter((r) => r.id !== id);
    onChange(next);
  };

  // Update reference description or category locally
  const handleUpdateAsset = (id: string, updates: Partial<BrandAsset>) => {
    const next = references.map((r) => (r.id === id ? { ...r, ...updates } : r));
    onChange(next);

    // Also persist metadata update to backend
    if (workspaceId) {
      fetch('/api/marketing/brand-assets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          workspace_id: workspaceId,
          ...updates,
        }),
      }).catch((err) => console.warn('[ReferenceAssetUploader] Patch sync error:', err));
    }
  };

  // Replace Asset handler
  const handleTriggerReplace = (id: string) => {
    replacingAssetIdRef.current = id;
    replaceInputRef.current?.click();
  };

  const handleReplaceFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetId = replacingAssetIdRef.current;
    if (!file || !targetId || !workspaceId) return;

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('workspace_id', workspaceId);
      formData.append('name', file.name.replace(/\.[^/.]+$/, ''));

      const res = await fetch('/api/marketing/brand-assets', {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();
      if (res.ok && json.success && json.asset) {
        const next = references.map((r) => (r.id === targetId ? json.asset : r));
        onChange(next);
        toast.success('Asset replaced successfully!');
        fetchLibrary();
      }
    } catch (err: any) {
      toast.error('Replace failed');
    }
  };

  const copyUrl = (url: string, id: string) => {
    const fullUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedId(id);
    toast.success('Public Reference URL copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleLibraryAsset = (asset: BrandAsset) => {
    const exists = references.some((r) => r.id === asset.id);
    if (exists) {
      onChange(references.filter((r) => r.id !== asset.id));
    } else {
      onChange([...references, asset]);
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <ImageIcon className="h-3.5 w-3.5 text-primary" /> Add Reference Image
          </label>
          <p className="text-[10px] text-muted-foreground">
            Upload your logo, product, UI screenshot, brand visual, or other reference.
          </p>
        </div>

        {libraryAssets.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowLibraryPicker(!showLibraryPicker)}
            className="h-7 text-[10px] font-bold rounded-xl gap-1"
          >
            <Building2 className="h-3 w-3" />
            Library ({libraryAssets.length})
            {showLibraryPicker ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
        )}
      </div>

      {/* Quick Library Picker Dropdown */}
      {showLibraryPicker && (
        <div className="p-3 rounded-2xl border border-border bg-muted/30 space-y-2 animate-in fade-in duration-200">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Select from Brand Library
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto">
            {libraryAssets.map((asset) => {
              const isSelected = references.some((r) => r.id === asset.id);
              return (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => toggleLibraryAsset(asset)}
                  className={cn(
                    'flex items-center gap-2 p-1.5 rounded-xl border text-left text-xs transition-all overflow-hidden',
                    isSelected
                      ? 'border-primary bg-primary/10 text-primary font-bold'
                      : 'border-border bg-background text-foreground hover:bg-muted'
                  )}
                >
                  <img
                    src={asset.public_url}
                    alt={asset.name}
                    className="h-6 w-6 object-contain rounded bg-muted/40 shrink-0"
                  />
                  <span className="truncate text-[11px] flex-1">{asset.name}</span>
                  {isSelected && <Check className="h-3 w-3 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Prominent Drag & Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onPaste={handlePaste}
        onClick={() => fileInputRef.current?.click()}
        tabIndex={0}
        role="button"
        aria-label="Upload reference asset"
        className={cn(
          'relative rounded-2xl border-2 border-dashed p-5 transition-all cursor-pointer text-center flex flex-col items-center justify-center space-y-2 focus:outline-hidden focus:ring-2 focus:ring-primary/40',
          isDragging
            ? 'border-primary bg-primary/10 scale-[1.01]'
            : 'border-border hover:border-primary/60 bg-muted/20 hover:bg-muted/40'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
          onChange={(e) => {
            if (e.target.files) handleFilesUpload(e.target.files);
          }}
          className="hidden"
        />

        <input
          ref={replaceInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
          onChange={handleReplaceFile}
          className="hidden"
        />

        <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
          {uploading ? (
            <RefreshCw className="h-5 w-5 animate-spin" />
          ) : (
            <UploadCloud className="h-5 w-5" />
          )}
        </div>

        <div className="space-y-0.5">
          <p className="text-xs font-bold text-foreground">
            {uploading ? 'Uploading reference files...' : 'Drag & drop, browse, or paste image (Ctrl+V)'}
          </p>
          <p className="text-[10px] text-muted-foreground font-medium">
            Logo • Product • UI • Brand Visual
          </p>
        </div>

        <div className="text-[9px] text-muted-foreground/70 font-mono">
          PNG, JPG, WEBP, SVG • Max 20MB per file
        </div>
      </div>

      {/* Active References List */}
      {references.length > 0 && (
        <div className="space-y-2.5 pt-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
            <span>Attached References ({references.length})</span>
            <span className="text-[9px] lowercase text-sky-500 font-medium">Included in creative prompt</span>
          </div>

          <div className="space-y-2">
            {references.map((asset) => (
              <div
                key={asset.id}
                className="p-3 rounded-2xl border border-border bg-card shadow-2xs space-y-2.5"
              >
                {/* Top Row: Thumbnail + Info + Actions */}
                <div className="flex items-start gap-3">
                  <div className="h-12 w-12 rounded-xl bg-muted/40 border border-border overflow-hidden shrink-0 flex items-center justify-center relative group">
                    <img
                      src={asset.public_url}
                      alt={asset.name}
                      className="h-full w-full object-contain"
                    />
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <h5 className="text-xs font-bold text-foreground truncate" title={asset.name}>
                        {asset.name}
                      </h5>
                      <Badge variant="secondary" className="text-[9px] font-bold px-1.5 py-0">
                        {asset.category}
                      </Badge>
                    </div>

                    {/* Category Selector */}
                    <div className="flex items-center gap-2">
                      <NativeSelect
                        value={asset.category}
                        onChange={(e) =>
                          handleUpdateAsset(asset.id, { category: e.target.value as BrandAssetCategory })
                        }
                        className="h-6 text-[10px] font-bold rounded-lg border-border bg-background px-1.5 py-0"
                      >
                        <option value="LOGOS">Logo</option>
                        <option value="PRODUCTS">Product</option>
                        <option value="UI_DIGITAL">UI / Screen</option>
                        <option value="PEOPLE">People / Founder</option>
                        <option value="OTHER">Brand Reference</option>
                      </NativeSelect>

                      <button
                        type="button"
                        onClick={() => handleTriggerReplace(asset.id)}
                        className="text-[10px] text-muted-foreground hover:text-primary font-medium underline"
                      >
                        Replace
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemove(asset.id)}
                    className="text-muted-foreground hover:text-destructive p-1 transition-colors"
                    title="Remove reference"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Description Input for AI understanding */}
                <div className="space-y-1">
                  <Input
                    placeholder='Describe asset for AI (e.g. "Official company logo. Keep unchanged.")'
                    value={asset.description || ''}
                    onChange={(e) => handleUpdateAsset(asset.id, { description: e.target.value })}
                    className="h-7 text-[11px] rounded-lg bg-background border-border"
                  />
                </div>

                {/* Public Reference URL Display */}
                <div className="flex items-center justify-between bg-muted/40 p-1.5 rounded-lg border border-border/60 text-[10px]">
                  <div className="flex items-center gap-1 min-w-0 flex-1 text-muted-foreground font-mono truncate">
                    <span className="font-semibold text-foreground shrink-0">Public URL:</span>
                    <span className="truncate">{asset.public_url}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => copyUrl(asset.public_url, asset.id)}
                    className="text-primary hover:text-primary/80 font-bold flex items-center gap-1 shrink-0 ml-2"
                  >
                    {copiedId === asset.id ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-500" />
                        <span className="text-emerald-500">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Copy URL</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
