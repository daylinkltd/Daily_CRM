"use client";

import React from 'react';
import type { SocialPost, PostStatus, UserRole } from '@/types/calendar';
import { SocialComposerForm } from '@/components/social/social-composer-form';
import { X } from 'lucide-react';

interface SocialComposerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (postData: Partial<SocialPost>, action?: PostStatus | 'publish_now') => void;
  initialPost?: SocialPost | null;
  currentUserRole?: UserRole;
  currentUserId?: string;
}

export function SocialComposerModal({
  isOpen,
  onClose,
  onSave,
  initialPost,
  currentUserRole = 'creator',
  currentUserId = 'usr_alex',
}: SocialComposerModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative w-full max-w-6xl rounded-3xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border p-5 bg-muted/20">
          <div>
            <h2 className="text-lg font-black text-foreground tracking-tight">
              {initialPost ? 'Edit Social Post' : 'Create Social Post'}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Multi-channel social composer, live platform previews & approval workflow.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6">
          <SocialComposerForm
            initialPost={initialPost}
            currentUserRole={currentUserRole}
            currentUserId={currentUserId}
            onSave={(data, action) => {
              onSave(data, action);
              onClose();
            }}
            onCancel={onClose}
            isFullPage={false}
          />
        </div>
      </div>
    </div>
  );
}
