'use client';

// ============================================================
// InviteMemberDialog
//
// Two-step modal:
//   1. Form  — role + expiry + optional label → POST creates the invite.
//   2. Result — the share URL, returned ONCE. Copy-to-clipboard, plus a
//              "Send via WhatsApp" deep link that pre-fills wa.me with
//              a friendly message containing the URL.
//
// The plaintext token is server-stored only as a SHA-256 hash, so once
// the result step is dismissed the link is gone forever — the dialog
// shouts this in copy.
// ============================================================

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Copy, Loader2, MessageCircle, Sparkles, AlertTriangle, Link2, KeyRound, Mail } from 'lucide-react';
import { useWorkspace } from '@/hooks/use-workspace';

import { Button, buttonVariants } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import { IconAction } from "@/components/ui/icon-action";

type InviteRole = 'admin' | 'agent' | 'viewer';

interface InviteMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful create so the parent re-fetches the
   *  pending-invitations list. */
  onCreated: () => void;
}

const EXPIRY_OPTIONS: { value: string; label: string }[] = [
  { value: '1', label: '1 day' },
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
];

const ROLE_DESCRIPTIONS: Record<InviteRole, string> = {
  admin:
    'Can invite teammates, manage settings, send messages, and edit data.',
  agent:
    'Can use the inbox, contacts, broadcasts, automations, and flows. No settings or member access.',
  viewer: 'Read-only access across every page. Cannot send or edit anything.',
};

// Server caps label at 80 chars (see src/app/api/account/invitations/route.ts).
// Mirror it on the client so we short-circuit before the round-trip
// rather than letting the user submit and bounce off a 400.
const MAX_LABEL_LEN = 80;

interface CreatedInvite {
  url: string;
  role: InviteRole;
  expiresInDays: number;
  /** Snapshotted at creation time so a later account rename can't
   *  retroactively change the wa.me message text on the result step. */
  accountName: string;
}

export function InviteMemberDialog({
  open,
  onOpenChange,
  onCreated,
}: InviteMemberDialogProps) {
  const { account, profile } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const [role, setRole] = useState<InviteRole>('agent');
  const [expiry, setExpiry] = useState<string>('7');
  const [label, setLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CreatedInvite | null>(null);

  // Two ways to add someone: send them a one-time invite link, or
  // create the account outright with a password you set. The direct
  // path uses admin.createUser with email_confirm, so Supabase sends
  // no email at all and the person can sign in immediately.
  const [mode, setMode] = useState<'invite' | 'direct'>('invite');
  // Emailing the link from the workspace's own Outlook mailbox, so the
  // admin doesn't have to copy-paste it and Supabase mail isn't used.
  const [emailTo, setEmailTo] = useState('');
  const [emailing, setEmailing] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [maxMembers, setMaxMembers] = useState<number | null>(null);

  useEffect(() => {
    if (!open || !activeWorkspace?.id) return;
    fetch(`/api/workspace/usage?workspace_id=${activeWorkspace.id}`)
      .then((res) => res.json())
      .then((data) => {
        setMemberCount(data.memberCount);
        setMaxMembers(data.maxUsers);
      })
      .catch((err) => console.error("Error loading usage:", err));
  }, [open, activeWorkspace?.id]);

  const isLimitReached = maxMembers !== null && memberCount !== null && memberCount >= maxMembers;

  function reset() {
    setRole('agent');
    setExpiry('7');
    setLabel('');
    setResult(null);
    setSubmitting(false);
    setMode('invite');
    setEmailTo('');
    setEmailing(false);
    setFullName('');
    setEmail('');
    setPassword('');
  }

  /** Map the invite role names onto the workspace_members enum. */
  function workspaceRoleFor(r: InviteRole): 'admin' | 'member' | 'viewer' {
    if (r === 'admin') return 'admin';
    if (r === 'viewer') return 'viewer';
    return 'member';
  }

  async function handleEmailInvite() {
    if (!activeWorkspace?.id || !result) return;
    if (!emailTo.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTo.trim())) {
      toast.error('Enter a valid email address');
      return;
    }
    setEmailing(true);
    try {
      const res = await fetch('/api/account/invitations/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: activeWorkspace.id,
          to: emailTo.trim(),
          url: result.url,
          role: result.role,
          inviter_name: profile?.full_name || undefined,
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        toast.error(payload.error || 'Could not email the invite');
        return;
      }
      toast.success(payload.message || 'Invitation emailed');
      setEmailTo('');
    } catch {
      toast.error('Could not email the invite');
    } finally {
      setEmailing(false);
    }
  }

  async function handleCreateDirect() {
    if (!activeWorkspace?.id) return;
    if (!fullName.trim()) {
      toast.error('Full name is required');
      return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error('Enter a valid email address');
      return;
    }
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/workspace/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: activeWorkspace.id,
          full_name: fullName.trim(),
          email: email.trim(),
          password,
          workspace_role: workspaceRoleFor(role),
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        toast.error(payload.error || 'Failed to create the account');
        return;
      }
      toast.success(`${fullName.trim()} can now sign in with that email and password`);
      onCreated?.();
      onOpenChange(false);
    } catch {
      toast.error('Failed to create the account');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreate() {
    // Mirror the server's max-length check so we don't ship an
    // obviously-too-long label across the wire just to bounce off
    // a 400. The Input also has a `maxLength={MAX_LABEL_LEN}` cap
    // but a paste can land an over-limit string into state before
    // the limit kicks in on the next keystroke — this is the safety
    // net for that path.
    const trimmedLabel = label.trim();
    if (trimmedLabel.length > MAX_LABEL_LEN) {
      toast.error(`Label must be ${MAX_LABEL_LEN} characters or fewer`);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/account/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          expiresInDays: Number(expiry),
          label: trimmedLabel || undefined,
        }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        toast.error(payload.error || 'Failed to create invitation');
        return;
      }

      const data = (await res.json()) as {
        url: string;
        expiresInDays: number;
      };

      setResult({
        url: data.url,
        role,
        expiresInDays: data.expiresInDays,
        // Snapshot the account name into the result so the wa.me
        // share message has team context. Falls back to a generic
        // string if `account` hasn't loaded yet (shouldn't happen
        // — the dialog requires admin+ which requires a loaded
        // profile — but stay safe).
        accountName: account?.name ?? 'our Daily CRM workspace',
      });
      onCreated();
    } catch (err) {
      console.error('[InviteMemberDialog] create error:', err);
      toast.error('Could not reach the server. Try again?');
    } finally {
      setSubmitting(false);
    }
  }

  async function copyToClipboard() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.url);
      toast.success('Invite link copied');
    } catch {
      // Most likely "not in a secure context" — happens on http://
      // local IPs. Surface the link in the toast so the admin can
      // hand-copy it.
      toast.error('Clipboard blocked — copy the link manually');
    }
  }

  function whatsappShareUrl(url: string): string {
    // Include the account name so the recipient knows which team
    // they're being invited to before clicking through. This matters
    // for users in multi-team contexts where "our Daily CRM workspace"
    // wouldn't be enough to disambiguate.
    const accountName = result?.accountName ?? 'our Daily CRM workspace';
    const message = `Join ${accountName} on Daily CRM using this link (valid for ${result?.expiresInDays} days): ${url}`;
    return `https://wa.me/?text=${encodeURIComponent(message)}`;
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Reset state when the dialog closes — both for cancel and
        // for dismissal after a successful create. The plaintext URL
        // is intentionally NOT preserved across opens.
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="bg-popover border-border sm:max-w-md">
        {result ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-popover-foreground">
                <Sparkles className="size-4 text-primary" />
                Invite created
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Share this link with your new teammate. They&apos;ll be able
                to sign up (or sign in) and join the account as{' '}
                <span className="font-medium text-muted-foreground">{result.role}</span>
                . The link is valid for{' '}
                <span className="font-medium text-muted-foreground">
                  {result.expiresInDays} day{result.expiresInDays === 1 ? '' : 's'}
                </span>
                .
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <Label className="text-muted-foreground">Invite link</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={result.url}
                  className="bg-muted border-border text-foreground font-mono text-xs"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <IconAction label="Copy" icon={<Copy className="size-4" />} type="button"
                  onClick={copyToClipboard}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0" />
              </div>

              {/* Deliver from the workspace's own mailbox (Outlook) rather
                  than making the admin copy-paste, and without touching
                  Supabase's email. */}
              <div className="space-y-2 rounded-md border border-border bg-muted/40 px-3 py-2.5">
                <Label className="text-muted-foreground text-xs">
                  Or email it from your own mailbox
                </Label>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="teammate@company.com"
                    value={emailTo}
                    onChange={(e) => setEmailTo(e.target.value)}
                    className="bg-muted border-border text-foreground text-xs"
                  />
                  <IconAction label="Send" icon={emailing ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />} type="button"
                    variant="outline"
                    onClick={handleEmailInvite}
                    disabled={emailing}
                    className="shrink-0 border-border" />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Requires Outlook connected in Integrations. Sends from your company
                  address — not Supabase.
                </p>
              </div>

              {/* Higher-contrast amber than the original 10% / amber-200.
                  Reviewed against slate-900 to meet WCAG AAA for body
                  text (target ratio 7:1). Border bumped to /50, bg to
                  /15, foreground promoted to amber-100 for the strong
                  intro, amber-200 for the body. */}
              <div className="rounded-md border border-amber-500/50 bg-amber-500/15 px-3 py-2 text-xs text-amber-200">
                <strong className="font-semibold text-amber-100">
                  Save this link now.
                </strong>{' '}
                We never store the plaintext — once you close this dialog
                the URL is gone. To re-share, revoke this invite and create
                a new one.
              </div>

              {/* Anchor styled with `buttonVariants` rather than wrapping
                  in <Button asChild>. The Daily CRM Button is the Base UI
                  ButtonPrimitive — it has no Radix-style asChild slot.
                  Direct anchor preserves right-click "Open in new tab"
                  behaviour too. */}
              <a
                href={whatsappShareUrl(result.url)}
                target="_blank"
                rel="noreferrer noopener"
                className={buttonVariants({
                  variant: 'outline',
                  className:
                    'w-full border-border text-muted-foreground hover:bg-muted',
                })}
              >
                <MessageCircle className="size-4" />
                Send via WhatsApp
              </a>
            </div>

            <DialogFooter className="bg-popover border-border">
              <Button
                onClick={() => onOpenChange(false)}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                Done
              </Button>
            </DialogFooter>
          </>
        ) : isLimitReached ? (
          <div className="py-6 text-center space-y-4">
            <AlertTriangle className="mx-auto h-8 w-8 text-amber-500" />
            <DialogTitle className="text-lg font-semibold text-foreground">
              Teammate limit reached
            </DialogTitle>
            <p className="text-sm text-foreground">
              You have reached the maximum of <strong>{maxMembers}</strong> team members allowed by your current plan.
            </p>
            <p className="text-xs text-muted-foreground">
              Upgrade your plan to unlock more member seats.
            </p>
            <DialogFooter className="mt-4 justify-center sm:justify-center flex-row gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  window.location.href = "/settings?tab=billing";
                }}
                className="bg-primary hover:bg-primary-hover text-primary-foreground font-medium"
              >
                Upgrade Plan
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-popover-foreground">Add a teammate</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {mode === 'invite'
                  ? 'Generate a one-time invite link. Share it via WhatsApp, Slack, or any channel you like — no email service required.'
                  : 'Create the account yourself and hand over the password. No confirmation email is sent — they can sign in straight away.'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Mode switch */}
              <div className="grid grid-cols-2 gap-2">
                <IconAction label="Send invite link" icon={<Link2 className="size-4" />} type="button"
                  variant={mode === 'invite' ? 'default' : 'outline'}
                  onClick={() => setMode('invite')}
                  className="justify-center" />
                <IconAction label="Set a password" icon={<KeyRound className="size-4" />} type="button"
                  variant={mode === 'direct' ? 'default' : 'outline'}
                  onClick={() => setMode('direct')}
                  className="justify-center" />
              </div>

              {mode === 'direct' && (
                <>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Full name</Label>
                    <Input
                      placeholder="e.g. Sara Khan"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Email</Label>
                    <Input
                      type="email"
                      autoComplete="off"
                      placeholder="sara@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Temporary password</Label>
                    <Input
                      type="text"
                      autoComplete="off"
                      placeholder="At least 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="bg-muted border-border text-foreground placeholder:text-muted-foreground font-mono"
                    />
                    <p className="text-xs text-muted-foreground">
                      Share this with them over a secure channel and ask them to change
                      it after their first sign-in. Only the workspace owner can create
                      accounts this way.
                    </p>
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label className="text-muted-foreground">Role</Label>
                <Select
                  value={role}
                  onValueChange={(v) => v && setRole(v as InviteRole)}
                >
                  <SelectTrigger className="w-full bg-muted border-border text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="agent">Agent</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {ROLE_DESCRIPTIONS[role]}
                </p>
              </div>

              {mode === 'invite' && (
              <div className="space-y-2">
                <Label className="text-muted-foreground">Link valid for</Label>
                <Select
                  value={expiry}
                  onValueChange={(v) => v && setExpiry(v)}
                >
                  <SelectTrigger className="w-full bg-muted border-border text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPIRY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              )}

              {mode === 'invite' && (
              <div className="space-y-2">
                <Label className="text-muted-foreground">
                  Label{' '}
                  <span className="text-xs text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  placeholder="e.g. Sara — support team"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  maxLength={MAX_LABEL_LEN}
                  className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                />
                <p className="text-xs text-muted-foreground">
                  Helps you remember who you sent the link to in the pending
                  list below.
                </p>
              </div>
              )}
            </div>

            <DialogFooter className="bg-popover border-border">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="border-border text-muted-foreground hover:bg-muted"
              >
                Cancel
              </Button>
              <Button
                onClick={mode === 'invite' ? handleCreate : handleCreateDirect}
                disabled={submitting}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Creating...
                  </>
                ) : mode === 'invite' ? (
                  'Generate link'
                ) : (
                  'Create account'
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
