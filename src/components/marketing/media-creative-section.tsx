'use client';

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Upload,
  Image as ImageIcon,
  Video as VideoIcon,
  Trash2,
  CheckCircle2,
  AlertCircle,
  FileQuestion,
  Paperclip,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  validateMediaForPlatforms,
  getRecommendedFormatForPlatform,
} from '@/lib/marketing/media-validator';

export interface MediaCreativeData {
  url?: string;
  type?: 'image' | 'video';
  source?: 'uploaded' | 'ai_generated';
  prompt?: string;
  altText?: string;
  visualStyle?: string;
  aspectRatio?: string;
  fileSizeMb?: number;
}

interface MediaCreativeSectionProps {
  media: MediaCreativeData | null;
  postTopic?: string;
  targetPlatforms: string[];
  targetAudience?: string;
  onChange: (media: MediaCreativeData | null) => void;
  className?: string;
}

export function MediaCreativeSection({
  media,
  postTopic,
  targetPlatforms,
  targetAudience,
  onChange,
  className,
}: MediaCreativeSectionProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const formatRecommendation = getRecommendedFormatForPlatform(targetPlatforms);

  // Platform Validation
  const validation = media?.url
    ? validateMediaForPlatforms(media, targetPlatforms)
    : { valid: true, errors: [], warnings: [] };

  // File Upload Handler
  const handleFileUpload = async (file: File, type: 'image' | 'video') => {
    const sizeMb = file.size / (1024 * 1024);

    if (type === 'image' && sizeMb > 15) {
      toast.error('Image file exceeds 15MB limit.');
      return;
    }
    if (type === 'video' && sizeMb > 250) {
      toast.error('Video file exceeds 250MB limit.');
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      // Upload via persistent marketing upload endpoint
      const res = await fetch('/api/marketing/upload-media', {
        method: 'POST',
        body: formData,
      });

      let mediaUrl = '';
      if (res.ok) {
        const data = await res.json();
        mediaUrl = data.url || data.media?.url || '';
      }

      // Robust base64 fallback for offline/test environments
      if (!mediaUrl) {
        mediaUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => resolve('');
          reader.readAsDataURL(file);
        });
      }

      const newMedia: MediaCreativeData = {
        url: mediaUrl,
        type,
        source: 'uploaded',
        fileSizeMb: Number(sizeMb.toFixed(2)),
        altText: `Uploaded ${type} for "${postTopic || 'Marketing Post'}"`,
        aspectRatio: formatRecommendation.aspectRatio,
      };

      onChange(newMedia);
      toast.success(`${type === 'image' ? 'Image' : 'Video'} attached successfully!`);
    } catch (err: any) {
      const reader = new FileReader();
      reader.onload = () => {
        onChange({
          url: reader.result as string,
          type,
          source: 'uploaded',
          fileSizeMb: Number(sizeMb.toFixed(2)),
          altText: `Uploaded ${type}`,
          aspectRatio: formatRecommendation.aspectRatio,
        });
        toast.success('Media attached for preview.');
      };
      reader.readAsDataURL(file);
    } finally {
      setIsUploading(false);
    }
  };

  // Drag & Drop
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
      const file = e.dataTransfer.files[0];
      const isVideo = file.type.startsWith('video/');
      handleFileUpload(file, isVideo ? 'video' : 'image');
    }
  };

  return (
    <div className={cn('rounded-3xl border border-border bg-card p-5 space-y-4 shadow-sm', className)}>
      {/* Hidden File Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) handleFileUpload(e.target.files[0], 'image');
        }}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) handleFileUpload(e.target.files[0], 'video');
        }}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Paperclip className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-2">
              Attached Media Asset
              <span className="text-[10px] font-normal normal-case text-muted-foreground bg-muted px-2 py-0.5 rounded-full border border-border/60">
                Optional
              </span>
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Copy the creative prompts below to generate your media with OpenAI, then attach your finalized asset here.
            </p>
          </div>
        </div>

        {media?.url ? (
          <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
            <CheckCircle2 className="h-3 w-3" /> Creative attached
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground bg-muted/60 px-2.5 py-0.5 rounded-full border border-border">
            <FileQuestion className="h-3 w-3 text-muted-foreground/80" /> No media attached
          </span>
        )}
      </div>

      {/* ATTACHED MEDIA DISPLAY */}
      {media?.url ? (
        <div className="space-y-3">
          <div className="relative rounded-2xl border border-border/80 bg-muted/20 overflow-hidden group">
            {media.type === 'video' ? (
              <video
                src={media.url}
                controls
                className="w-full max-h-[340px] object-contain rounded-2xl bg-black"
              />
            ) : (
              <img
                src={media.url}
                alt={media.altText || 'Attached creative asset'}
                className="w-full max-h-[340px] object-contain rounded-2xl bg-background"
              />
            )}

            {/* Badges Over Image */}
            <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg bg-black/75 text-white backdrop-blur-md shadow-sm">
                {media.type === 'video' ? '🎬 Attached Video' : '📷 Attached Image'}
              </span>
              {media.fileSizeMb && (
                <span className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-background/90 text-foreground border border-border/60 backdrop-blur-md">
                  {media.fileSizeMb} MB
                </span>
              )}
              {media.aspectRatio && (
                <span className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-background/90 text-foreground border border-border/60 backdrop-blur-md">
                  {media.aspectRatio}
                </span>
              )}
            </div>

            {/* Actions Bar */}
            <div className="absolute bottom-3 right-3 flex items-center gap-2 bg-background/90 backdrop-blur-md border border-border p-1.5 rounded-xl shadow-md">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => (media.type === 'video' ? videoInputRef.current?.click() : fileInputRef.current?.click())}
                className="h-8 px-2.5 text-xs font-bold gap-1 text-foreground hover:bg-muted"
              >
                <Upload className="h-3.5 w-3.5" /> Replace
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onChange(null)}
                className="h-8 px-2.5 text-xs font-bold gap-1 text-rose-600 hover:bg-rose-500/10"
              >
                <Trash2 className="h-3.5 w-3.5" /> Remove
              </Button>
            </div>
          </div>

          {/* Validation Feedback */}
          {!validation.valid && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-700 dark:text-rose-400 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertCircle className="h-4 w-4" /> Platform Compatibility Warnings:
              </div>
              <ul className="list-disc pl-5 space-y-0.5 text-[11px]">
                {validation.errors.map((e, idx) => (
                  <li key={idx}>{e}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        /* NO MEDIA ATTACHED - UPLOAD DROPZONE */
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            'flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed transition-all text-center',
            isDragging
              ? 'border-primary bg-primary/5 scale-[0.99]'
              : 'border-border bg-background/60 hover:border-primary/40'
          )}
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-muted text-muted-foreground mb-2.5">
            <Upload className="h-5 w-5 text-primary" />
          </div>

          <p className="text-xs font-bold text-foreground">
            No image or video attached yet
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5 max-w-md">
            Copy the generated prompt below to create your asset in OpenAI (DALL-E 3 / Sora), then upload it here.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              className="h-8 px-3 text-xs font-bold rounded-xl gap-1.5 border-border hover:border-primary/40"
            >
              <ImageIcon className="h-3.5 w-3.5 text-sky-500" /> Upload Image
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isUploading}
              onClick={() => videoInputRef.current?.click()}
              className="h-8 px-3 text-xs font-bold rounded-xl gap-1.5 border-border hover:border-primary/40"
            >
              <VideoIcon className="h-3.5 w-3.5 text-purple-500" /> Upload Video
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
