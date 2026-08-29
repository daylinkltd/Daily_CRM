'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle } from 'lucide-react';
import { RichTextArea } from "@/components/ui/rich-textarea";

interface RequestChangesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (comment: string) => void;
  postTitle?: string;
}

export function RequestChangesDialog({ isOpen, onClose, onSubmit, postTitle }: RequestChangesDialogProps) {
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!comment.trim()) return;
    setSubmitting(true);
    try {
      onSubmit(comment.trim());
      setComment('');
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(v) => { if (!v) { setComment(''); onClose(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <AlertCircle className="h-4 w-4 text-orange-500" />
            Request Changes
          </DialogTitle>
        </DialogHeader>

        {postTitle && (
          <p className="text-xs text-muted-foreground -mt-1 mb-1">
            For: <span className="font-semibold text-foreground">{postTitle}</span>
          </p>
        )}

        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground">
            What needs to be changed?
          </label>
          <RichTextArea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="e.g. Please change the headline and use the updated product image."
            rows={4}
            className="text-sm resize-none"
            autoFocus
          />
          <p className="text-[10px] text-muted-foreground">
            Your feedback will be sent to the creator. They must edit and resubmit the post.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={() => { setComment(''); onClose(); }} disabled={submitting}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!comment.trim() || submitting}
            className="bg-orange-500 hover:bg-orange-600 text-white font-bold"
          >
            {submitting ? 'Sending...' : 'Send Feedback'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
