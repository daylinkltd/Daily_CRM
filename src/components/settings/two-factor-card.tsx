'use client';

// ============================================================
// Settings → Security → Two-step sign-in
//
// Turning it ON is deliberately two steps: we email a code and only
// flip the switch once it has been answered. A one-click toggle would
// happily lock someone out of their own account over a mailbox they
// cannot actually open — the one failure this feature must not cause.
//
// Turning it OFF is one click and says plainly what is lost, rather
// than hiding a security downgrade behind a confirmation nobody reads.
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ShieldCheck, ShieldOff, Loader2, Mail } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

type Stage = 'idle' | 'awaiting-code';

export function TwoFactorCard() {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/2fa', { cache: 'no-store' });
      if (!res.ok) return;
      const payload = await res.json();
      setEnabled(Boolean(payload.enabled));
      setEmail(payload.email ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function startEnable() {
    setBusy(true);
    try {
      const res = await fetch('/api/auth/2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(payload.error || 'Could not send the code'); return; }
      setStage('awaiting-code');
      toast.success(`Code sent to ${payload.to ?? 'your email'}`);
    } catch {
      toast.error('Could not reach the server');
    } finally {
      setBusy(false);
    }
  }

  async function confirmEnable() {
    setBusy(true);
    try {
      const res = await fetch('/api/auth/2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(payload.error || 'That code did not work'); return; }
      setEnabled(true);
      setStage('idle');
      setCode('');
      toast.success('Two-step sign-in is on.');
    } catch {
      toast.error('Could not reach the server');
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const res = await fetch('/api/auth/2fa', { method: 'DELETE' });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(payload.error || 'Could not turn it off'); return; }
      setEnabled(false);
      toast.success('Two-step sign-in is off.');
    } catch {
      toast.error('Could not reach the server');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-10">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={`mt-0.5 rounded-lg p-2 ${
                enabled
                  ? 'bg-emerald-500/10 text-emerald-500'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {enabled ? <ShieldCheck className="size-4" /> : <ShieldOff className="size-4" />}
            </div>
            <div className="min-w-0">
              <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
                Two-step sign-in
                <Badge
                  variant="outline"
                  className={`text-[10px] ${
                    enabled ? 'border-emerald-500/40 text-emerald-500' : ''
                  }`}
                >
                  {enabled ? 'On' : 'Off'}
                </Badge>
              </h3>
              <p className="mt-1 max-w-prose text-xs text-muted-foreground">
                {enabled
                  ? 'Signing in on a new device asks for a code emailed to you. Someone with your password still cannot get in.'
                  : 'Ask for a code emailed to you whenever you sign in on a new device — so a stolen password is not enough on its own.'}
              </p>
              {email && (
                <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Mail className="size-3" /> Codes go to {email}
                </p>
              )}
            </div>
          </div>

          {stage === 'idle' && (
            enabled ? (
              <Button
                variant="outline"
                onClick={disable}
                disabled={busy}
                className="border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20"
              >
                {busy ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
                Turn off
              </Button>
            ) : (
              <Button onClick={startEnable} disabled={busy}>
                {busy ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
                Turn on
              </Button>
            )
          )}
        </div>

        {stage === 'awaiting-code' && (
          <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-xs text-muted-foreground">
              We emailed a six-digit code to <span className="font-medium text-foreground">{email}</span>.
              Enter it to switch two-step sign-in on — this proves you can
              actually receive the codes before we start requiring them.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="tfa-code" className="text-xs font-semibold">Code</Label>
                <Input
                  id="tfa-code"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-36 text-center font-mono tracking-[0.4em]"
                />
              </div>
              <Button onClick={confirmEnable} disabled={busy || code.length !== 6}>
                {busy ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
                Confirm
              </Button>
              <Button
                variant="ghost"
                onClick={() => { setStage('idle'); setCode(''); }}
                disabled={busy}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
