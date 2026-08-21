"use client";

import React from 'react';
import type { SocialPost } from '@/types/calendar';
import { X, History, User, Clock, CheckCircle2, AlertCircle, Sparkles, FileEdit } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SocialHistoryModalProps {
  post: SocialPost | null;
  onClose: () => void;
}

export function SocialHistoryModal({ post, onClose }: SocialHistoryModalProps) {
  if (!post) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md p-4">
      <div className="relative w-full max-w-lg rounded-3xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-6 bg-muted/20">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            <div>
              <h3 className="text-base font-extrabold text-foreground tracking-tight">
                Social Post History Timeline
              </h3>
              <p className="text-xs text-muted-foreground truncate max-w-xs">{post.title}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Audit Timeline */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
            {post.auditHistory.map((item, index) => (
              <div key={item.id} className="relative flex flex-col gap-1">
                {/* Node indicator */}
                <div className="absolute -left-6 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold shadow-sm">
                  ✓
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-foreground">
                    {item.action.replace('_', ' ')}
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {new Date(item.timestamp).toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <User className="h-3 w-3 text-primary" />
                  <span className="font-bold text-foreground">{item.userName}</span>
                  <span>({item.userRole})</span>
                </div>

                {item.comment && (
                  <div className="mt-1 rounded-xl bg-muted/30 p-2.5 border border-border text-xs text-foreground font-medium italic">
                    "{item.comment}"
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end p-4 border-t border-border bg-muted/20">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="rounded-xl text-xs font-bold"
          >
            Close History
          </Button>
        </div>
      </div>
    </div>
  );
}
