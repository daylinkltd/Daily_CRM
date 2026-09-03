import type { SocialPost, UserRole } from '@/types/calendar';

export interface GovernanceUser {
  id: string;
  name?: string;
  email?: string;
  role: UserRole | string;
  approvalAuthority?: boolean;
  assignedChannels?: string[];
  hasAdminOverride?: boolean;
}

export interface GovernancePermissionCheck {
  allowed: boolean;
  reason?: string;
}

/**
 * Centralized governance authorization rules for DailyBuz Marketing
 */
export class ApprovalGovernance {
  /**
   * 1. Can user APPROVE content?
   * Precedence Rule:
   * 1. ADMIN + APPROVAL AUTHORITY -> ALLOWED (can approve ANY content, including self-created posts)
   * 2. If user lacks approval authority -> DENIED
   * 3. Non-admin creator attempting self-approval -> DENIED
   * 4. Channel assignment check for non-admin
   * 5. Assigned approver check if designated
   */
  static canApprove(
    post: Partial<SocialPost> | null,
    user: GovernanceUser | null
  ): GovernancePermissionCheck {
    if (!post || !user) {
      return { allowed: false, reason: 'Missing post or user authentication.' };
    }

    // 1. Must be in pending approval status
    if (post.status !== 'pending_approval') {
      return {
        allowed: false,
        reason: `Cannot approve content in "${post.status}" status. Only pending approval posts can be approved.`,
      };
    }

    const isAdminOrOwner = user.role === 'admin' || user.role === 'owner';
    const hasApprovalAuth = user.approvalAuthority !== false;

    // 2. ADMIN WITH APPROVAL AUTHORITY:
    // Admin with approval authority can approve ANY marketing content (other users or self-created)
    if (isAdminOrOwner && hasApprovalAuth) {
      return { allowed: true };
    }

    // 3. Admin explicitly lacking approval authority cannot approve
    if (isAdminOrOwner && !hasApprovalAuth) {
      return {
        allowed: false,
        reason: 'User is an administrator but does not have approval authority enabled.',
      };
    }

    // 4. Non-admin must have explicit approver role or approval authority
    const isApproverRole = user.role === 'approver' || user.approvalAuthority === true;
    if (!isApproverRole) {
      return {
        allowed: false,
        reason: 'Only authorized Approvers or Workspace Admins have approval permissions.',
      };
    }

    // 5. Creator rule for non-admin: Creator cannot approve own post
    if (post.creatorId && post.creatorId === user.id) {
      return {
        allowed: false,
        reason: 'Creators cannot approve their own content.',
      };
    }

    // 6. Channel scope check for non-admin
    if (user.assignedChannels && !user.assignedChannels.includes('all')) {
      const postChannels = post.channels || [];
      const hasChannelAccess = postChannels.every((ch) => user.assignedChannels?.includes(ch));
      if (!hasChannelAccess) {
        return {
          allowed: false,
          reason: 'Approver is not authorized for all target channels on this post.',
        };
      }
    }

    // 7. If designated to a specific approver
    if (post.assignedApproverId && post.assignedApproverId !== user.id) {
      if (!user.hasAdminOverride && !isAdminOrOwner) {
        return {
          allowed: false,
          reason: `This post is assigned to ${post.assignedApproverName || 'another approver'}. Awaiting assigned approver review.`,
        };
      }
    }

    return { allowed: true };
  }

  /**
   * 2. Can user REQUEST CHANGES?
   */
  static canRequestChanges(
    post: Partial<SocialPost> | null,
    user: GovernanceUser | null
  ): GovernancePermissionCheck {
    if (!post || !user) {
      return { allowed: false, reason: 'Missing post or user.' };
    }

    if (post.status !== 'pending_approval') {
      return { allowed: false, reason: 'Changes can only be requested on pending approval posts.' };
    }

    const isAdminOrOwner = user.role === 'admin' || user.role === 'owner';
    const hasApprovalAuth = user.approvalAuthority !== false;

    // Admin with approval authority can request changes on any post
    if (isAdminOrOwner && hasApprovalAuth) {
      return { allowed: true };
    }

    if (post.creatorId && post.creatorId === user.id) {
      return { allowed: false, reason: 'Creators cannot request changes from themselves.' };
    }

    const isApprover = user.role === 'approver' || user.approvalAuthority === true;
    if (!isApprover) {
      return { allowed: false, reason: 'Only Approvers or Admins can request changes.' };
    }

    return { allowed: true };
  }

  /**
   * 3. Can user REJECT content?
   */
  static canReject(
    post: Partial<SocialPost> | null,
    user: GovernanceUser | null
  ): GovernancePermissionCheck {
    if (!post || !user) {
      return { allowed: false, reason: 'Missing post or user.' };
    }

    if (post.status !== 'pending_approval') {
      return { allowed: false, reason: 'Only pending approval posts can be rejected.' };
    }

    const isAdminOrOwner = user.role === 'admin' || user.role === 'owner';
    const hasApprovalAuth = user.approvalAuthority !== false;

    if (isAdminOrOwner && hasApprovalAuth) {
      return { allowed: true };
    }

    if (post.creatorId && post.creatorId === user.id) {
      return { allowed: false, reason: 'Creators cannot reject their own content.' };
    }

    const isApprover = user.role === 'approver' || user.approvalAuthority === true;
    if (!isApprover) {
      return { allowed: false, reason: 'Only Approvers or Admins can reject content.' };
    }

    return { allowed: true };
  }

  /**
   * 4. Can user EDIT content?
   */
  static canEdit(
    post: Partial<SocialPost> | null,
    user: GovernanceUser | null
  ): GovernancePermissionCheck {
    if (!post || !user) {
      return { allowed: false, reason: 'Missing post or user.' };
    }

    if (post.status === 'published' || post.status === 'rejected') {
      return { allowed: false, reason: 'Published or rejected posts cannot be edited.' };
    }

    const isCreator = post.creatorId === user.id;
    const isApproverOrAdmin = user.role === 'approver' || user.role === 'admin' || user.role === 'owner';

    if (isCreator) {
      if (post.status === 'draft' || post.status === 'changes_requested' || isApproverOrAdmin) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'Content submitted for review cannot be modified until reviewed.' };
    }

    if (isApproverOrAdmin) {
      return { allowed: true };
    }

    return { allowed: false, reason: 'Insufficient permissions to edit.' };
  }

  /**
   * 5. Can user SCHEDULE or PUBLISH?
   */
  static canScheduleOrPublish(
    post: Partial<SocialPost> | null,
    user: GovernanceUser | null
  ): GovernancePermissionCheck {
    if (!post || !user) {
      return { allowed: false, reason: 'Missing post or user.' };
    }

    if (post.status !== 'approved' && post.status !== 'scheduled') {
      return {
        allowed: false,
        reason: `Content must be APPROVED before scheduling or publishing (Current status: ${post.status}).`,
      };
    }

    return { allowed: true };
  }
}
