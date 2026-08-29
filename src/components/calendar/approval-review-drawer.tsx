"use client";

import React, { useState } from 'react';
import type { SocialPost, UserRole, SocialPlatform } from '@/types/calendar';
import { SocialPlatformPreview } from '@/components/social/platform-previews';
import { StatusBadge } from '@/components/social/status-badge';
import { PlatformIconStack } from '@/components/social/platform-badge';
import {
  X,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock,
  User,
  Calendar,
  ShieldAlert,
  Building,
  History,
  Send,
  UserCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { NativeSelect } from "@/components/ui/native-select";
import { RichTextArea } from "@/components/ui/rich-textarea";

interface ApprovalReviewDrawerProps {
  post: SocialPost | null;
  currentUserRole: UserRole;
  currentUserId: string;
  onClose: () => void;
  onApprove: (postId: string) => void;
  onRequestChanges: (postId: string, comment: string) => void;
  onReject: (postId: string, comment?: string) => void;
  onReassign?: (postId: string, newApproverId: string) => void;
}

export function ApprovalReviewDrawer({
  post,
  currentUserRole,
  currentUserId,
  onClose,
  onApprove,
  onRequestChanges,
  onReject,
  onReassign,
}: ApprovalReviewDrawerProps) {
  const [changesComment, setChangesComment] = useState('');
  const [isChangesModalOpen, setIsChangesModalOpen] = useState(false);
  const [selectedPreviewPlatform, setSelectedPreviewPlatform] = useState<SocialPlatform>('instagram');

  if (!post) return null;

  // RULE 1: Self-Approval Protection!
  const isSelfCreator = post.creatorId === currentUserId;
  const isApproverOrAdmin = currentUserRole === 'approver' || currentUserRole === 'admin';
  const canApprove = isApproverOrAdmin && !isSelfCreator;

  const handleApproveClick = () => {
    if (!canApprove) {
      if (isSelfCreator) {
        toast.error('Governance Rule: Creators cannot approve their own posts.');
      } else {
        toast.error('Only Approvers or Admins can approve content.');
      }
      return;
    }
    onApprove(post.id);
    onClose();
  };

  const handleChangesSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!changesComment.trim()) {
      toast.error('Please specify what changes are needed.');
      return;
    }
    onRequestChanges(post.id, changesComment.trim());
    setIsChangesModalOpen(false);
    setChangesComment('');
    onClose();
  };

  const handleRejectClick = () => {
    if (confirm('Are you sure you want to reject this post?')) {
      onReject(post.id);
      onClose();
    }
  };

  const sortedHistory = [...post.auditHistory].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative w-full max-w-6xl rounded-3xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between border-b border-border p-5 bg-muted/20">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-black text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <Clock className="h-3.5 w-3.5" /> Content Approval Review
            </span>
            <h2 className="text-base font-black text-foreground tracking-tight line-clamp-1">
              {post.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Two-Column Body */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT: Social Media Live Preview */}
          <div className="lg:col-span-6 flex flex-col">
            <SocialPlatformPreview
              post={post}
              selectedPlatform={post.channels.includes(selectedPreviewPlatform) ? selectedPreviewPlatform : post.channels[0] || 'instagram'}
              availablePlatforms={post.channels}
              onPlatformChange={(p) => setSelectedPreviewPlatform(p)}
              className="h-full min-h-[480px]"
            />
          </div>

          {/* RIGHT: Post Information, Metadata, Approver Reassignment, Audit Timeline */}
          <div className="lg:col-span-6 space-y-4 flex flex-col">
            {/* Self-approval Governance Alert */}
            {isSelfCreator && (
              <div className="flex items-start gap-3 rounded-2xl bg-amber-500/10 p-4 border border-amber-500/20 text-amber-600 dark:text-amber-400">
                <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-extrabold">Self-Approval Protection Active</p>
                  <p className="mt-0.5 text-foreground/80">
                    You created this post. A different assigned reviewer (e.g. Vivian) or Administrator must review and approve it.
                  </p>
                </div>
              </div>
            )}

            {/* Post Information Card */}
            <div className="rounded-2xl border border-border bg-background p-4 space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                Post Information
              </h3>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase block">Creator</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <User className="h-3.5 w-3.5 text-primary" />
                    <span className="font-bold text-foreground">{post.creatorName}</span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase block">Scheduled Date</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Calendar className="h-3.5 w-3.5 text-primary" />
                    <span className="font-bold text-foreground">
                      {post.date ? `${post.date} @ ${post.time || '12:00'}` : 'No date set'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Channels & Status */}
              <div className="flex items-center justify-between pt-2 border-t border-border/60">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Channels:</span>
                  <PlatformIconStack platforms={post.channels} size="sm" />
                </div>
                <StatusBadge status={post.status} size="sm" />
              </div>

              {/* Linked CRM details */}
              {(post.crmCompanyName || post.crmDealName || post.crmContactName) && (
                <div className="pt-2 border-t border-border/60 text-xs bg-muted/20 p-2.5 rounded-xl space-y-1">
                  <span className="text-[10px] font-black text-primary uppercase flex items-center gap-1">
                    <Building className="h-3 w-3" /> Linked CRM Context
                  </span>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                    {post.crmCompanyName && <span>Company: <strong className="text-foreground">{post.crmCompanyName}</strong></span>}
                    {post.crmDealName && <span>Deal: <strong className="text-foreground">{post.crmDealName}</strong></span>}
                    {post.crmContactName && <span>Contact: <strong className="text-foreground">{post.crmContactName}</strong></span>}
                  </div>
                </div>
              )}

              {/* Approver Selection / Reassignment */}
              <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase block">Assigned Reviewer</span>
                  <span className="font-bold text-foreground">{post.approverName || 'Vivian Torres'}</span>
                </div>
                {currentUserRole === 'admin' && onReassign && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">Reassign:</span>
                    <NativeSelect
                      value={post.approverId || 'admin'}
                      onChange={(e) => onReassign(post.id, e.target.value)}
                      className="h-7 rounded-lg border border-border bg-background px-2 text-xs font-bold text-primary"
                    >
                      <option value="admin">Administrator</option>
                      <option value="manager">Marketing Manager</option>
                      <option value="reviewer">Reviewer</option>
                    </NativeSelect>
                  </div>
                )}
              </div>
            </div>

            {/* Approval History & Activity Timeline */}
            <div className="rounded-2xl border border-border bg-background p-4 flex-1 flex flex-col space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <History className="h-3.5 w-3.5 text-primary" /> Approval History & Activity
              </h3>

              <div className="space-y-3 flex-1 overflow-y-auto max-h-48 pr-1">
                {sortedHistory.map((item) => (
                  <div key={item.id} className="flex items-start gap-2.5 text-xs">
                    <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-foreground capitalize">{item.action.replace('_', ' ')}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(item.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {item.userName} ({item.userRole})
                      </p>
                      {item.comment && (
                        <p className="mt-1 text-xs bg-muted/40 p-2 rounded-lg text-foreground/90 italic border border-border/40">
                          &ldquo;{item.comment}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions (Requirement 12 & 14) */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border p-5 bg-muted/20">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="w-full sm:w-auto h-10 rounded-xl text-xs font-bold"
          >
            Close
          </Button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {canApprove ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleRejectClick}
                  className="h-10 text-xs font-bold text-rose-500 border-rose-500/30 hover:bg-rose-500/10 rounded-xl gap-1.5"
                >
                  <XCircle className="h-4 w-4" /> Reject
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsChangesModalOpen(true)}
                  className="h-10 text-xs font-bold text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10 rounded-xl gap-1.5"
                >
                  <AlertCircle className="h-4 w-4" /> Request Changes
                </Button>

                <Button
                  type="button"
                  onClick={handleApproveClick}
                  className="h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md gap-1.5"
                >
                  <CheckCircle2 className="h-4 w-4" /> Approve Post
                </Button>
              </>
            ) : isSelfCreator ? (
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3.5 py-2 rounded-xl">
                <Clock className="h-4 w-4 shrink-0" />
                Waiting for another reviewer (Vivian or Admin)
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted border border-border px-3 py-2 rounded-xl">
                Sign in with Approver or Admin role to act on this post.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Request Changes Modal (Requirement 15) */}
      {isChangesModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-500" /> What needs to be changed?
              </h3>
              <button
                type="button"
                onClick={() => setIsChangesModalOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleChangesSubmit} className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Provide clear feedback for <strong className="text-foreground">{post.creatorName}</strong>. The post status will change to <em>Changes Requested</em>.
              </p>

              <RichTextArea
                rows={4}
                placeholder="e.g. Please change the headline and use the updated product image."
                value={changesComment}
                onChange={(e) => setChangesComment(e.target.value)}
                className="rounded-xl text-xs font-medium leading-relaxed"
                autoFocus
              />

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsChangesModalOpen(false)}
                  className="rounded-xl text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold gap-1.5"
                >
                  <Send className="h-3.5 w-3.5" /> Submit Change Request
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
