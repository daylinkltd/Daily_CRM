export type SocialTeamRole = 'creator' | 'approver' | 'admin';

export interface SocialTeamMember {
  id: string;
  name: string;
  email: string;
  roleTitle: string;
  role: SocialTeamRole;
  avatarUrl: string;
  postsCreated: number;
  pendingApprovals: number;
  publishedPosts: number;
  assignedPlatforms: string[];
}

export const MOCK_TEAM_MEMBERS: SocialTeamMember[] = [
  {
    id: 'usr_alex',
    name: 'Alex Johnson',
    email: 'alex@dailybuz.com',
    roleTitle: 'Marketing Creator',
    role: 'creator',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    postsCreated: 18,
    pendingApprovals: 0,
    publishedPosts: 12,
    assignedPlatforms: ['instagram', 'linkedin', 'x', 'tiktok'],
  },
  {
    id: 'usr_vivian',
    name: 'Vivian Torres',
    email: 'vivian@dailybuz.com',
    roleTitle: 'Marketing Approver',
    role: 'approver',
    avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
    postsCreated: 4,
    pendingApprovals: 3,
    publishedPosts: 8,
    assignedPlatforms: ['linkedin', 'facebook', 'threads'],
  },
  {
    id: 'usr_admin',
    name: 'Sarah Admin',
    email: 'admin@dailybuz.com',
    roleTitle: 'Administrator',
    role: 'admin',
    avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
    postsCreated: 6,
    pendingApprovals: 0,
    publishedPosts: 8,
    assignedPlatforms: ['instagram', 'facebook', 'linkedin', 'x', 'tiktok', 'youtube', 'threads'],
  },
];

export const ROLE_LABELS: Record<SocialTeamRole, string> = {
  creator: 'Creator',
  approver: 'Approver',
  admin: 'Admin',
};

export const ROLE_COLORS: Record<SocialTeamRole, string> = {
  creator: 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/20',
  approver: 'bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/20',
  admin: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20',
};

export const ROLE_PERMISSIONS: Record<SocialTeamRole, string[]> = {
  creator: ['Create posts', 'Edit own posts', 'Save drafts', 'Submit for approval', 'View feedback', 'Resubmit'],
  approver: ['Review posts', 'Approve posts', 'Request changes', 'Reject posts'],
  admin: ['All creator permissions', 'All approver permissions', 'Manage team', 'Override workflow', 'Assign approvers'],
};
