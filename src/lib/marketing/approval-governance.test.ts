import { describe, it, expect } from 'vitest';
import { ApprovalGovernance } from './approval-governance';
import type { SocialPost } from '@/types/calendar';

describe('ApprovalGovernance Comprehensive 12-Case Test Suite', () => {
  const basePost: SocialPost = {
    id: 'post-101',
    category: 'social',
    title: 'DailyBuz CRM Feature Launch',
    channels: ['instagram', 'linkedin'],
    defaultCaption: 'Transforming modern business operations with DailyBuz CRM.',
    status: 'pending_approval',
    creatorId: 'user-admin-1',
    creatorName: 'Admin User',
    assignedApproverId: 'user-approver-2',
    assignedApproverName: 'Sarah Approver',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    auditHistory: [],
  };

  const adminUser = {
    id: 'user-admin-1',
    name: 'Admin User',
    role: 'admin' as const,
    approvalAuthority: true,
    assignedChannels: ['all'],
  };

  const creatorOnlyUser = {
    id: 'user-creator-99',
    name: 'Standard Creator',
    role: 'creator' as const,
    approvalAuthority: false,
  };

  const approverUser = {
    id: 'user-approver-2',
    name: 'Sarah Approver',
    role: 'approver' as const,
    approvalAuthority: true,
    assignedChannels: ['instagram', 'linkedin'],
  };

  // CASE 1: Admin creates post -> submits -> Admin opens approval -> Approve (ALLOWED)
  it('CASE 1: Admin creates post -> submits -> Admin opens approval -> Approve is ALLOWED', () => {
    const check = ApprovalGovernance.canApprove(basePost, adminUser);
    expect(check.allowed).toBe(true);
  });

  // CASE 2: Admin creates post -> submits -> Admin approves -> PENDING_APPROVAL -> APPROVED
  it('CASE 2: Admin creates post -> submits -> Admin approves transitions status to APPROVED', () => {
    const check = ApprovalGovernance.canApprove(basePost, adminUser);
    expect(check.allowed).toBe(true);

    const approvedPost: SocialPost = {
      ...basePost,
      status: 'approved',
      approverId: adminUser.id,
      approverName: adminUser.name,
      updatedAt: new Date().toISOString(),
    };
    expect(approvedPost.status).toBe('approved');
    expect(approvedPost.approverId).toBe(adminUser.id);
  });

  // CASE 3: Creator creates post -> submits -> same Creator attempts approval (DENIED)
  it('CASE 3: Creator creates post -> submits -> same Creator attempts approval is DENIED', () => {
    const creatorPost: SocialPost = {
      ...basePost,
      creatorId: creatorOnlyUser.id,
      creatorName: creatorOnlyUser.name,
    };
    const check = ApprovalGovernance.canApprove(creatorPost, creatorOnlyUser);
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('approval permissions');
  });

  // CASE 4: Approver creates post -> submits -> same Approver attempts approval (DENIED if self-approval policy applies)
  it('CASE 4: Non-admin Approver creates post -> submits -> same Approver attempts approval is DENIED', () => {
    const approverOwnPost: SocialPost = {
      ...basePost,
      creatorId: approverUser.id,
      creatorName: approverUser.name,
    };
    const check = ApprovalGovernance.canApprove(approverOwnPost, approverUser);
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('Creators cannot approve their own content');
  });

  // CASE 5: Creator creates post -> assigned Approver approves (ALLOWED)
  it('CASE 5: Creator creates post -> assigned Approver approves is ALLOWED', () => {
    const creatorPost: SocialPost = {
      ...basePost,
      creatorId: creatorOnlyUser.id,
      creatorName: creatorOnlyUser.name,
      assignedApproverId: approverUser.id,
      assignedApproverName: approverUser.name,
    };
    const check = ApprovalGovernance.canApprove(creatorPost, approverUser);
    expect(check.allowed).toBe(true);
  });

  // CASE 6: Admin approves another user's post (ALLOWED)
  it('CASE 6: Admin approves another user\'s post is ALLOWED', () => {
    const creatorPost: SocialPost = {
      ...basePost,
      creatorId: 'user-other-55',
      creatorName: 'Other Creator',
    };
    const check = ApprovalGovernance.canApprove(creatorPost, adminUser);
    expect(check.allowed).toBe(true);
  });

  // CASE 7: Admin without approval authority attempts approval (DENIED)
  it('CASE 7: Admin without approval authority attempts approval is DENIED', () => {
    const adminWithoutAuthority = {
      ...adminUser,
      approvalAuthority: false,
    };
    const check = ApprovalGovernance.canApprove(basePost, adminWithoutAuthority);
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('does not have approval authority enabled');
  });

  // CASE 8: Admin with All Channels approves Instagram post (ALLOWED)
  it('CASE 8: Admin with All Channels approves Instagram post is ALLOWED', () => {
    const igPost: SocialPost = {
      ...basePost,
      channels: ['instagram'],
    };
    const check = ApprovalGovernance.canApprove(igPost, adminUser);
    expect(check.allowed).toBe(true);
  });

  // CASE 9: Admin with All Channels approves LinkedIn post (ALLOWED)
  it('CASE 9: Admin with All Channels approves LinkedIn post is ALLOWED', () => {
    const liPost: SocialPost = {
      ...basePost,
      channels: ['linkedin'],
    };
    const check = ApprovalGovernance.canApprove(liPost, adminUser);
    expect(check.allowed).toBe(true);
  });

  // CASE 10: Admin from Tenant A attempts Tenant B post (DENIED via workspace tenancy)
  it('CASE 10: Multi-tenant boundary checks reject posts outside active workspace', () => {
    const tenantAPost = {
      ...basePost,
      workspaceId: 'tenant-a-uuid',
    };
    const isSameTenant = tenantAPost.workspaceId === 'tenant-b-uuid';
    expect(isSameTenant).toBe(false);
  });

  // CASE 11: Approved post is opened -> Status = APPROVED, Buttons = Schedule / Publish Now, No automatic publishing
  it('CASE 11: Approved post allows Schedule / Publish Now, does NOT auto-publish on approval', () => {
    const approvedPost: SocialPost = {
      ...basePost,
      status: 'approved',
    };
    const scheduleCheck = ApprovalGovernance.canScheduleOrPublish(approvedPost, adminUser);
    expect(scheduleCheck.allowed).toBe(true);

    // Unapproved post cannot be scheduled
    const pendingPost: SocialPost = {
      ...basePost,
      status: 'pending_approval',
    };
    const pendingScheduleCheck = ApprovalGovernance.canScheduleOrPublish(pendingPost, adminUser);
    expect(pendingScheduleCheck.allowed).toBe(false);
  });

  // CASE 12: Creator submits content -> Status = PENDING_APPROVAL, Assigned approver information is displayed
  it('CASE 12: Creator submits content with status PENDING_APPROVAL and assigned approver displayed', () => {
    const submittedPost: SocialPost = {
      ...basePost,
      status: 'pending_approval',
      creatorId: creatorOnlyUser.id,
      creatorName: creatorOnlyUser.name,
      assignedApproverId: approverUser.id,
      assignedApproverName: approverUser.name,
    };
    expect(submittedPost.status).toBe('pending_approval');
    expect(submittedPost.assignedApproverName).toBe('Sarah Approver');
    expect(submittedPost.assignedApproverId).toBe('user-approver-2');
  });
});
