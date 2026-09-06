"use client";

import React, { useState } from 'react';
import type { SocialPost, UserRole, SocialPlatform } from '@/types/calendar';
import { SocialPlatformPreview } from '@/components/social/platform-previews';
import { StatusBadge } from '@/components/social/status-badge';
import { PlatformIconStack } from '@/components/social/platform-badge';
import { ApprovalGovernance } from '@/lib/marketing/approval-governance';
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
  Edit3,
  Save,
  RefreshCw,
  Hash,
  Sparkles,
  Image as ImageIcon,
  Trash2,
  Share2,
  Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ApprovalReviewDrawerProps {
  post: SocialPost | null;
  currentUserRole: UserRole;
  currentUserId: string;
  currentUserName?: string;
  onClose: () => void;
  onApprove: (postId: string) => void;
  onRequestChanges: (postId: string, comment: string) => void;
  onReject: (postId: string, comment?: string) => void;
  onScheduleOrPublish?: (postId: string, mode: 'schedule' | 'publish_now', date?: string, time?: string) => void;
  onReassign?: (postId: string, newApproverId: string) => void;
  onUpdatePost?: (updated: SocialPost) => void;
}

export function ApprovalReviewDrawer({
  post,
  currentUserRole,
  currentUserId,
  currentUserName,
  onClose,
  onApprove,
  onRequestChanges,
  onReject,
  onScheduleOrPublish,
  onUpdatePost,
}: ApprovalReviewDrawerProps) {
  const [selectedPreviewPlatform, setSelectedPreviewPlatform] = useState<SocialPlatform>('instagram');

  // Edit Mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(post?.title || '');
  const [editCaption, setEditCaption] = useState(post?.defaultCaption || '');
  const [editCta, setEditCta] = useState(post?.link || '');
  const [editHashtags, setEditHashtags] = useState(post?.hashtags?.join(', ') || '');
  const [editDate, setEditDate] = useState(post?.date || '');
  const [editTime, setEditTime] = useState(post?.time || '10:30');
  const [editMediaUrl, setEditMediaUrl] = useState(post?.mediaUrl || '');

  // Schedule modal state
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState(post?.date || new Date().toISOString().split('T')[0]);
  const [scheduleTime, setScheduleTime] = useState(post?.time || '10:30');

  // Changes & Reject Modal states
  const [isChangesModalOpen, setIsChangesModalOpen] = useState(false);
  const [changesComment, setChangesComment] = useState('');
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  if (!post) return null;

  // Centralized Governance Checks
  const userContext = {
    id: currentUserId,
    name: currentUserName,
    role: currentUserRole,
  };

  const approveCheck = ApprovalGovernance.canApprove(post, userContext);
  const changesCheck = ApprovalGovernance.canRequestChanges(post, userContext);
  const rejectCheck = ApprovalGovernance.canReject(post, userContext);
  const editCheck = ApprovalGovernance.canEdit(post, userContext);
  const scheduleCheck = ApprovalGovernance.canScheduleOrPublish(post, userContext);

  const isCreator = post.creatorId === currentUserId;

  const handleSaveChanges = () => {
    if (!onUpdatePost) return;
    const updated: SocialPost = {
      ...post,
      title: editTitle.trim(),
      defaultCaption: editCaption.trim(),
      link: editCta.trim() || undefined,
      hashtags: editHashtags.split(',').map((h) => h.trim()).filter(Boolean),
      date: editDate || undefined,
      time: editTime || undefined,
      mediaUrl: editMediaUrl || undefined,
      updatedAt: new Date().toISOString(),
      auditHistory: [
        ...(post.auditHistory || []),
        {
          id: `audit_${Date.now()}`,
          action: 'edited',
          userId: currentUserId,
          userName: currentUserName || 'User',
          userRole: currentUserRole,
          timestamp: new Date().toISOString(),
          comment: 'Modified post content fields during review.',
        },
      ],
    };
    onUpdatePost(updated);
    setIsEditing(false);
    toast.success('Post changes saved successfully!');
  };

  const handleApproveClick = () => {
    if (!approveCheck.allowed) {
      toast.error(approveCheck.reason || 'You are not authorized to approve this post.');
      return;
    }
    onApprove(post.id);
    toast.success('Post approved! It is now ready to be scheduled or published.');
  };

  const handleChangesSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!changesComment.trim()) {
      toast.error('A feedback comment is mandatory when requesting changes.');
      return;
    }
    onRequestChanges(post.id, changesComment.trim());
    setIsChangesModalOpen(false);
    setChangesComment('');
    onClose();
  };

  const handleRejectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectReason.trim()) {
      toast.error('A rejection reason is mandatory.');
      return;
    }
    onReject(post.id, rejectReason.trim());
    setIsRejectModalOpen(false);
    setRejectReason('');
    onClose();
  };

  const handleScheduleConfirm = (mode: 'schedule' | 'publish_now') => {
    if (onScheduleOrPublish) {
      onScheduleOrPublish(post.id, mode, scheduleDate, scheduleTime);
    }
    setIsScheduleModalOpen(false);
    onClose();
  };

  const sortedHistory = [...(post.auditHistory || [])].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative w-full max-w-6xl rounded-3xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Bar */}
        <div className="p-4 px-6 border-b border-border flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-3">
            <StatusBadge status={post.status} size="md" />
            <PlatformIconStack platforms={post.channels} size="sm" />
            <span className="text-xs font-bold text-muted-foreground">ID: {post.id}</span>
          </div>

          <div className="flex items-center gap-2">
            {editCheck.allowed && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(!isEditing)}
                className="h-8 text-xs font-semibold rounded-xl gap-1.5"
              >
                <Edit3 className="h-3.5 w-3.5" />
                {isEditing ? 'Cancel Edit' : 'Edit Post Fields'}
              </Button>
            )}
            {isEditing && (
              <Button
                size="sm"
                onClick={handleSaveChanges}
                className="h-8 text-xs font-bold rounded-xl gap-1.5 bg-primary text-primary-foreground shadow-xs"
              >
                <Save className="h-3.5 w-3.5" />
                Save Changes
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column (7 cols): Content Details & Edit Form */}
          <div className="lg:col-span-7 space-y-5">
            {/* Top Meta Info Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-2xl bg-muted/30 border border-border text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Creator</span>
                <span className="font-bold text-foreground truncate block">{post.creatorName || 'Anonymous'}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Assigned Approver</span>
                <span className="font-bold text-foreground truncate block">
                  {post.assignedApproverName || 'Workspace Approver'}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Created Date</span>
                <span className="font-medium text-foreground">
                  {new Date(post.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Target Platforms</span>
                <span className="font-bold text-primary capitalize">
                  {post.channels.join(', ')}
                </span>
              </div>
            </div>

            {/* Creator Governance Restriction Banner (Only shown if user is NOT authorized to approve) */}
            {isCreator && post.status === 'pending_approval' && !approveCheck.allowed && (
              <div className="p-3.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-start gap-2.5">
                <Lock className="h-4 w-4 mt-0.5 shrink-0" />
                <div className="text-xs">
                  <span className="font-bold block">Creator Governance Active</span>
                  <p className="text-muted-foreground mt-0.5">
                    You authored this post. An authorized workspace approver or administrator must review and approve it before scheduling.
                  </p>
                </div>
              </div>
            )}

            {/* Admin Self-Approval Authority Banner */}
            {isCreator && post.status === 'pending_approval' && approveCheck.allowed && (
              <div className="p-3.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                <div className="text-xs">
                  <span className="font-bold block">Admin Approval Authority Active</span>
                  <p className="text-muted-foreground mt-0.5">
                    You have Admin approval authority enabled. You may review, edit, request changes, or approve this post directly.
                  </p>
                </div>
              </div>
            )}

            {/* Post Title */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Post Title / Topic</label>
              {isEditing ? (
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="rounded-xl text-sm font-semibold"
                />
              ) : (
                <h2 className="text-base font-bold text-foreground">{post.title}</h2>
              )}
            </div>

            {/* Post Caption */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Caption & Body</label>
                {isEditing && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      try {
                        toast.loading('Regenerating caption with AI...');
                        const res = await fetch('/api/marketing/generate', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            topic: editTitle || post.title,
                            regenTarget: 'caption_only',
                            existingTitle: editTitle || post.title,
                          }),
                        });
                        const data = await res.json();
                        if (data.social?.caption) {
                          setEditCaption(data.social.caption);
                          toast.dismiss();
                          toast.success('✨ Caption refreshed!');
                        }
                      } catch {
                        toast.dismiss();
                        toast.error('Failed to regenerate caption.');
                      }
                    }}
                    className="h-6 text-[10px] font-bold text-primary gap-1"
                  >
                    <Sparkles className="h-3 w-3" /> Regenerate Caption
                  </Button>
                )}
              </div>

              {isEditing ? (
                <Textarea
                  rows={6}
                  value={editCaption}
                  onChange={(e) => setEditCaption(e.target.value)}
                  className="rounded-xl text-xs font-mono leading-relaxed"
                />
              ) : (
                <div className="p-4 rounded-2xl border border-border bg-background whitespace-pre-line text-xs leading-relaxed font-sans text-foreground/90">
                  {post.defaultCaption}
                </div>
              )}
            </div>

            {/* CTA Link */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Call to Action (CTA)</label>
              {isEditing ? (
                <Input
                  value={editCta}
                  onChange={(e) => setEditCta(e.target.value)}
                  placeholder="e.g. https://dailybuz.com/pricing"
                  className="rounded-xl text-xs"
                />
              ) : (
                <p className="text-xs text-foreground font-medium bg-muted/20 p-2.5 rounded-xl border border-border">
                  {post.link || 'No external URL attached'}
                </p>
              )}
            </div>

            {/* Hashtags */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Hashtags</label>
                {isEditing && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      try {
                        toast.loading('Regenerating hashtags...');
                        const res = await fetch('/api/marketing/generate', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            topic: editTitle || post.title,
                            regenTarget: 'hashtags_only',
                            existingCaption: editCaption,
                          }),
                        });
                        const data = await res.json();
                        if (data.social?.hashtags) {
                          setEditHashtags(data.social.hashtags.join(', '));
                          toast.dismiss();
                          toast.success('✨ Hashtags updated!');
                        }
                      } catch {
                        toast.dismiss();
                        toast.error('Failed to regenerate hashtags.');
                      }
                    }}
                    className="h-6 text-[10px] font-bold text-primary gap-1"
                  >
                    <Hash className="h-3 w-3" /> Regenerate Hashtags
                  </Button>
                )}
              </div>

              {isEditing ? (
                <Input
                  value={editHashtags}
                  onChange={(e) => setEditHashtags(e.target.value)}
                  placeholder="#CRM, #SalesAutomation"
                  className="rounded-xl text-xs font-mono"
                />
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {(post.hashtags || []).map((h, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[11px] font-bold">
                      {h}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Single Source of Truth: Attached Creative */}
            <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <ImageIcon className="h-3.5 w-3.5 text-primary" /> Attached Creative Asset
                </span>
                {editMediaUrl ? (
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    ✓ Creative attached ({post.mediaSource || 'IMAGE'})
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full">
                    No visual attached
                  </span>
                )}
              </div>

              {editMediaUrl ? (
                <div className="relative rounded-xl border border-border bg-muted/20 overflow-hidden group max-h-48 flex items-center justify-center">
                  <img src={editMediaUrl} alt="" className="h-44 w-full object-contain bg-background" />
                  {isEditing && (
                    <div className="absolute bottom-2 right-2 flex gap-1.5 bg-background/90 backdrop-blur-md p-1 rounded-xl border border-border">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const newUrl = prompt('Enter new Image URL:', editMediaUrl);
                          if (newUrl !== null) setEditMediaUrl(newUrl);
                        }}
                        className="h-7 px-2 text-[11px] font-bold text-foreground"
                      >
                        <RefreshCw className="h-3 w-3 mr-1" /> Replace
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditMediaUrl('')}
                        className="h-7 px-2 text-[11px] font-bold text-rose-600 hover:bg-rose-500/10"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 rounded-xl border border-dashed border-border flex items-center justify-between text-xs text-muted-foreground">
                  <span>No media attached to this post</span>
                  {isEditing && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        try {
                          toast.loading('Synthesizing AI creative...');
                          const res = await fetch('/api/marketing/generate-image', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              topic: editTitle || post.title,
                              platform: post.channels[0] || 'linkedin',
                            }),
                          });
                          const data = await res.json();
                          if (data.media?.url) {
                            setEditMediaUrl(data.media.url);
                            toast.dismiss();
                            toast.success('✨ AI Creative attached!');
                          }
                        } catch {
                          toast.dismiss();
                          toast.error('Generation failed.');
                        }
                      }}
                      className="h-7 px-2.5 text-xs font-bold gap-1 text-primary border-primary/30"
                    >
                      <Sparkles className="h-3 w-3" /> Generate with AI
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Feedback / Rejection Notice if applicable */}
            {post.rejection_reason && (
              <div className="p-3.5 rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 space-y-1">
                <span className="text-xs font-bold flex items-center gap-1.5">
                  <XCircle className="h-4 w-4" /> Reviewer Feedback / Reason:
                </span>
                <p className="text-xs pl-5 font-medium">{post.rejection_reason}</p>
              </div>
            )}

            {/* Audit History Timeline */}
            <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <History className="h-3.5 w-3.5" /> Chronological Audit Trail
              </span>
              <div className="space-y-2 max-h-44 overflow-y-auto">
                {sortedHistory.length > 0 ? (
                  sortedHistory.map((item) => (
                    <div key={item.id} className="p-2.5 rounded-xl bg-muted/40 text-[11px] space-y-1 border border-border/40">
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span className="font-bold text-foreground">
                          {item.userName} ({item.action})
                        </span>
                        <span>{new Date(item.timestamp).toLocaleString()}</span>
                      </div>
                      {item.comment && <p className="text-muted-foreground font-medium pl-1">{item.comment}</p>}
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">No audit entries recorded.</p>
                )}
              </div>
            </div>
          </div>

          {/* Right Column (5 cols): Preview & Action Governance */}
          <div className="lg:col-span-5 space-y-5">
            <div className="rounded-3xl border border-border bg-card p-4 shadow-sm space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                Target Platform Preview
              </span>
              <div className="border border-border rounded-2xl overflow-hidden bg-background">
                <SocialPlatformPreview
                  post={{
                    ...post,
                    title: editTitle || post.title,
                    defaultCaption: editCaption || post.defaultCaption,
                    hashtags: editHashtags.split(',').map((h) => h.trim()).filter(Boolean),
                    mediaUrl: editMediaUrl || undefined,
                  }}
                  selectedPlatform={selectedPreviewPlatform}
                  onPlatformChange={setSelectedPreviewPlatform}
                />
              </div>

              {/* Action Buttons Area */}
              <div className="pt-3 border-t border-border space-y-2">
                {/* 1. Pending Approval State Actions */}
                {post.status === 'pending_approval' && (
                  <>
                    {approveCheck.allowed ? (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsChangesModalOpen(true)}
                            className="h-9 text-xs font-bold rounded-xl border-amber-500/30 text-amber-600 hover:bg-amber-500/10"
                          >
                            Request Changes
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsRejectModalOpen(true)}
                            className="h-9 text-xs font-bold rounded-xl border-rose-500/30 text-rose-600 hover:bg-rose-500/10"
                          >
                            Reject Post
                          </Button>
                        </div>
                        <Button
                          type="button"
                          onClick={handleApproveClick}
                          className="w-full h-10 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md gap-1.5"
                        >
                          <CheckCircle2 className="h-4 w-4" /> Approve
                        </Button>
                      </>
                    ) : (
                      <div className="p-3 rounded-xl border border-border bg-muted/30 text-center space-y-1">
                        <span className="text-xs font-bold text-muted-foreground block">
                          {isCreator ? 'Awaiting Approver Review' : 'Awaiting Assigned Approver'}
                        </span>
                        <p className="text-[11px] text-muted-foreground">
                          {approveCheck.reason || 'Only authorized approvers can approve this content.'}
                        </p>
                      </div>
                    )}
                  </>
                )}

                {/* 2. Approved State: Ready to Schedule / Publish */}
                {post.status === 'approved' && (
                  <div className="space-y-2">
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block">
                        ✓ Content Approved
                      </span>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        This content has been approved and is ready to schedule or dispatch.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsScheduleModalOpen(true)}
                        className="h-10 text-xs font-bold rounded-xl gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
                      >
                        <Calendar className="h-3.5 w-3.5" /> Schedule
                      </Button>
                      <Button
                        type="button"
                        onClick={() => handleScheduleConfirm('publish_now')}
                        className="h-10 text-xs font-bold rounded-xl gap-1.5 bg-primary text-primary-foreground shadow-xs"
                      >
                        <Share2 className="h-3.5 w-3.5" /> Publish Now
                      </Button>
                    </div>
                  </div>
                )}

                {/* 3. Changes Requested State: Creator can resubmit */}
                {post.status === 'changes_requested' && isCreator && (
                  <Button
                    type="button"
                    onClick={() => {
                      if (onUpdatePost) {
                        onUpdatePost({
                          ...post,
                          status: 'pending_approval',
                          updatedAt: new Date().toISOString(),
                          auditHistory: [
                            ...(post.auditHistory || []),
                            {
                              id: `audit_${Date.now()}`,
                              action: 'resubmitted',
                              userId: currentUserId,
                              userName: currentUserName || 'Creator',
                              userRole: currentUserRole,
                              timestamp: new Date().toISOString(),
                              comment: 'Creator addressed feedback and resubmitted for approval.',
                            },
                          ],
                        });
                        toast.success('Post resubmitted for Approval!');
                        onClose();
                      }
                    }}
                    className="w-full h-10 text-xs font-bold rounded-xl bg-primary text-primary-foreground shadow-md gap-1.5"
                  >
                    <Send className="h-4 w-4" /> Resubmit for Approval
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Request Changes Modal */}
      {isChangesModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">Request Content Revisions</h3>
              <Button size="icon" variant="ghost" onClick={() => setIsChangesModalOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <form onSubmit={handleChangesSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">
                  Revision Feedback (Required)
                </label>
                <Textarea
                  rows={4}
                  required
                  value={changesComment}
                  onChange={(e) => setChangesComment(e.target.value)}
                  placeholder="e.g. Please replace the image with a brand graphic and adjust the CTA to point to the demo page."
                  className="rounded-xl text-xs"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setIsChangesModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl">
                  Send Back to Creator
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">Reject Content</h3>
              <Button size="icon" variant="ghost" onClick={() => setIsRejectModalOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <form onSubmit={handleRejectSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">
                  Rejection Reason (Required)
                </label>
                <Textarea
                  rows={4}
                  required
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g. This campaign has concluded and content is no longer relevant."
                  className="rounded-xl text-xs"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setIsRejectModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl">
                  Confirm Rejection
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">Schedule Content Publishing</h3>
              <Button size="icon" variant="ghost" onClick={() => setIsScheduleModalOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-muted-foreground block mb-1">Date</label>
                <Input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div>
                <label className="font-bold text-muted-foreground block mb-1">Time</label>
                <Input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="rounded-xl"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsScheduleModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => handleScheduleConfirm('schedule')}
                className="bg-primary text-primary-foreground text-xs font-bold rounded-xl"
              >
                Confirm Schedule
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
