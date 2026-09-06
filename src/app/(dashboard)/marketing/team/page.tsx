'use client';

import React, { useState, useEffect } from 'react';
import { useCalendarStore } from '@/lib/calendar/store';
import { useAuth } from '@/hooks/use-auth';
import { useWorkspace } from '@/hooks/use-workspace';
import { createClient } from '@/lib/supabase/client';
import { PageHeader } from '@/components/ui/page-header';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Users2,
  Plus,
  Shield,
  CheckCircle2,
  Mail,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { NativeSelect } from "@/components/ui/native-select";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Marketing Manager' | 'Creator' | 'Designer' | 'Reviewer' | 'Analyst';
  avatar: string;
  assignedPlatforms: string[];
  canApprove: boolean;
  postsCreated: number;
  postsApproved: number;
}

export default function MarketingTeamPage() {
  const store = useCalendarStore();
  const { user, profile } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const supabase = createClient();

  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<TeamMember['role']>('Creator');

  useEffect(() => {
    async function loadRealTeam() {
      setLoading(true);
      const currentUserName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
      const currentUserEmail = user?.email || profile?.email || '';

      const currentMember: TeamMember = {
        id: user?.id || 'usr_current',
        name: currentUserName,
        email: currentUserEmail,
        role: 'Admin',
        avatar: profile?.avatar_url || '',
        assignedPlatforms: ['All Channels'],
        canApprove: true,
        postsCreated: store.socialPosts.filter(p => p.creatorId === user?.id).length,
        postsApproved: store.socialPosts.filter(p => p.approverId === user?.id && (p.status === 'approved' || p.status === 'scheduled' || p.status === 'published')).length,
      };

      if (!activeWorkspace?.id) {
        setTeam([currentMember]);
        setLoading(false);
        return;
      }

      try {
        const { data: members, error } = await supabase
          .from('workspace_members')
          .select('id, user_id, role, profiles(id, full_name, email, avatar_url)')
          .eq('workspace_id', activeWorkspace.id);

        if (error || !members || members.length === 0) {
          setTeam([currentMember]);
        } else {
          const loaded: TeamMember[] = members.map((m: any) => {
            const prof = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
            const name = prof?.full_name || prof?.email?.split('@')[0] || 'Team Member';
            const email = prof?.email || '';
            const isAdmin = m.role === 'owner' || m.role === 'admin';
            const memberUserId = m.user_id || m.id;
            return {
              id: m.id || m.user_id,
              name,
              email,
              role: isAdmin ? 'Admin' : 'Creator',
              avatar: prof?.avatar_url || '',
              assignedPlatforms: ['All Channels'],
              canApprove: isAdmin,
              postsCreated: store.socialPosts.filter(p => p.creatorId === memberUserId).length,
              postsApproved: store.socialPosts.filter(p => p.approverId === memberUserId && (p.status === 'approved' || p.status === 'scheduled' || p.status === 'published')).length,
            };
          });

          // Ensure current user is present
          if (!loaded.some(l => l.email === currentUserEmail)) {
            loaded.unshift(currentMember);
          }
          setTeam(loaded);
        }
      } catch (err) {
        setTeam([currentMember]);
      } finally {
        setLoading(false);
      }
    }

    loadRealTeam();
  }, [activeWorkspace?.id, user, profile, store.socialPosts, store.approvedPosts]);

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !inviteName.trim()) {
      toast.error('Please enter name and email.');
      return;
    }

    const newMember: TeamMember = {
      id: `usr_${Date.now()}`,
      name: inviteName,
      email: inviteEmail,
      role: inviteRole,
      avatar: '',
      assignedPlatforms: ['All Channels'],
      canApprove: inviteRole === 'Admin' || inviteRole === 'Marketing Manager' || inviteRole === 'Reviewer',
      postsCreated: 0,
      postsApproved: 0,
    };

    setTeam(prev => [...prev, newMember]);
    setInviteEmail('');
    setInviteName('');
    setIsInviteOpen(false);
    toast.success(`Invitation sent to ${newMember.email}`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marketing Team"
        description="Manage roles, platform assignments, approval permissions, and content quotas for your authenticated workspace members."
        actions={
          <Button
            size="sm"
            onClick={() => setIsInviteOpen(true)}
            className="h-9 px-3.5 text-xs font-bold rounded-xl gap-1.5 bg-primary text-primary-foreground shadow-md"
          >
            <Plus className="h-4 w-4 stroke-[3]" /> Invite Member
          </Button>
        }
      />

      {/* Invite Modal */}
      {isInviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-black text-foreground">Invite Marketing Member</h3>
            <form onSubmit={handleInvite} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">Full Name</label>
                <Input
                  placeholder="e.g. Jordan Miller"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="h-10 rounded-xl text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">Email Address</label>
                <Input
                  type="email"
                  placeholder="jordan@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="h-10 rounded-xl text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">Marketing Role</label>
                <NativeSelect
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as TeamMember['role'])}
                  className="w-full h-10 rounded-xl border border-border bg-background px-3 text-xs font-bold text-foreground"
                >
                  <option value="Admin">Admin (Full Control)</option>
                  <option value="Marketing Manager">Marketing Manager (Approval & Schedule)</option>
                  <option value="Creator">Creator (Drafts & Submit)</option>
                  <option value="Designer">Designer (Media & Assets)</option>
                  <option value="Reviewer">Reviewer (Approve & Request Changes)</option>
                  <option value="Analyst">Analyst (View & Metrics)</option>
                </NativeSelect>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <Button type="button" variant="outline" onClick={() => setIsInviteOpen(false)} className="rounded-xl text-xs font-bold">
                  Cancel
                </Button>
                <Button type="submit" className="rounded-xl text-xs font-bold bg-primary text-primary-foreground">
                  Send Invitation
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Team Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {team.map((member) => (
          <div
            key={member.id}
            className="rounded-3xl border border-border bg-card p-5 space-y-4 shadow-sm flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12 border-2 border-border shadow-xs">
                    {member.avatar && <AvatarImage src={member.avatar} />}
                    <AvatarFallback>{member.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h4 className="text-xs font-black text-foreground">{member.name}</h4>
                    <p className="text-[11px] text-muted-foreground">{member.email}</p>
                  </div>
                </div>
                <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  {member.role}
                </span>
              </div>

              <div className="space-y-1.5 text-xs pt-1">
                <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                  <span>Approval Authority:</span>
                  <span className={member.canApprove ? 'text-emerald-500 font-bold' : 'text-muted-foreground'}>
                    {member.canApprove ? 'Enabled' : 'Draft / Submit only'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                  <span>Assigned Channels:</span>
                  <span className="font-bold text-foreground truncate max-w-[140px]">{member.assignedPlatforms.join(', ')}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-border/40 text-center text-xs">
              <div className="p-2 rounded-xl bg-muted/30">
                <span className="text-[10px] text-muted-foreground uppercase block">Created</span>
                <strong className="text-foreground">{member.postsCreated} posts</strong>
              </div>
              <div className="p-2 rounded-xl bg-muted/30">
                <span className="text-[10px] text-muted-foreground uppercase block">Approved</span>
                <strong className="text-foreground">{member.postsApproved} posts</strong>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
