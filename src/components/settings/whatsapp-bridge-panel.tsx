'use client';

// ============================================================
// WhatsApp Bridge pairing panel — the "scan like WhatsApp Web" tab of
// Settings → WhatsApp.
//
// Flow: Connect → the bridge starts an instance and returns a QR (PNG
// data URL, rotating ~20s) → this panel polls status every 3s → the
// moment the phone scans, status flips to connected and the QR gives
// way to the linked number. Unlink reverses it.
//
// The honesty box is part of the feature, not decoration: this is the
// UNOFFICIAL WhatsApp Web protocol — free, instant, and against
// WhatsApp's ToS, with a real (behaviour-driven) ban risk. The tenant
// must know that before pairing their number, so the risks are stated
// where the Connect button lives.
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { toast } from 'sonner';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  QrCode,
  Smartphone,
  Unlink,
} from 'lucide-react';

import { useWorkspace } from '@/hooks/use-workspace';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type BridgeState = {
  status?: 'disconnected' | 'pairing' | 'connected';
  phone?: string;
  push_name?: string;
  qr_data_url?: string;
  error?: string;
};

export function WhatsAppBridgePanel() {
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;

  const [state, setState] = useState<BridgeState>({});
  const [busy, setBusy] = useState(false);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const res = await fetch(`/api/whatsapp/bridge?workspace_id=${workspaceId}`, { cache: 'no-store' });
      const json = (await res.json()) as BridgeState;
      if (!res.ok) {
        setUnavailable(json.error || 'The bridge service is unreachable.');
        return;
      }
      setUnavailable(null);
      setState(json);
    } catch {
      setUnavailable('The bridge service is unreachable.');
    }
  }, [workspaceId]);

  // Poll fast while pairing (the QR rotates), slow otherwise.
  useEffect(() => {
    void refresh();
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(
      () => void refresh(),
      state.status === 'pairing' ? 3000 : 15000,
    );
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [refresh, state.status]);

  async function act(action: 'pair' | 'logout') {
    if (!workspaceId) return;
    setBusy(true);
    try {
      const res = await fetch('/api/whatsapp/bridge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId, action }),
      });
      const json = (await res.json()) as BridgeState;
      if (!res.ok) {
        toast.error(json.error || `Failed to ${action}`);
        return;
      }
      if (action === 'pair') {
        setState(json);
        toast.success('Scan the QR from WhatsApp → Linked Devices');
      } else {
        setState({ status: 'disconnected' });
        toast.success('WhatsApp unlinked');
      }
    } catch {
      toast.error('Could not reach the server');
    } finally {
      setBusy(false);
    }
  }

  const connected = state.status === 'connected';
  const pairing = state.status === 'pairing';

  return (
    <Card className="bg-card text-card-foreground border-border shadow-sm">
      <CardHeader>
        <CardTitle className="text-foreground text-base flex items-center gap-2">
          <QrCode className="h-4 w-4 text-primary" />
          WhatsApp Web Connection
        </CardTitle>
        <CardDescription className="text-muted-foreground text-xs">
          Link your existing WhatsApp number by scanning a QR — no Meta account, no
          per-message charges, no template approvals.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* The honesty box. */}
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3.5 py-3 text-xs leading-relaxed text-amber-800 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
          <span>
            This uses the <strong>unofficial</strong> WhatsApp Web protocol. It is against
            WhatsApp&apos;s Terms of Service, and numbers that send like spam machines get{' '}
            <strong>banned — sometimes permanently</strong>. Sends are automatically paced, but
            use this for conversations, not bulk blasts (the official Meta API tab is for
            those), and consider pairing a dedicated number rather than your main line.
          </span>
        </div>

        {unavailable ? (
          <p className="text-sm text-muted-foreground">
            {unavailable} Ask your administrator to deploy the WhatsApp Bridge
            (see <code className="text-xs">whatsapp-bridge/README.md</code>).
          </p>
        ) : connected ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="size-5 text-emerald-500" />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Connected{state.phone ? ` — +${state.phone}` : ''}
                </p>
                <p className="text-xs text-muted-foreground">
                  {state.push_name || 'WhatsApp'} · messages flow through this number now
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => act('logout')}
              className="border-red-500/40 text-red-500 hover:bg-red-500/10"
            >
              <Unlink className="mr-1.5 size-3.5" /> Unlink
            </Button>
          </div>
        ) : pairing && state.qr_data_url ? (
          <div className="flex flex-col items-center gap-3 py-2">
            {/* Data-URL QR from the bridge; rotates ~20s, poll refreshes it. */}
            <Image
              src={state.qr_data_url}
              alt="WhatsApp pairing QR code"
              width={256}
              height={256}
              unoptimized
              className="rounded-lg border border-border bg-white p-2"
            />
            <p className="max-w-sm text-center text-xs text-muted-foreground">
              On your phone: <strong>WhatsApp → Settings → Linked Devices → Link a
              device</strong>, then scan. The code refreshes automatically until you do.
            </p>
            <Button variant="outline" size="sm" disabled={busy} onClick={() => act('pair')}>
              <Loader2 className={busy ? 'mr-1.5 size-3.5 animate-spin' : 'mr-1.5 size-3.5'} />
              New code
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-4">
            <Smartphone className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Not connected.</p>
            <Button disabled={busy || !workspaceId} onClick={() => act('pair')}>
              {busy ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <QrCode className="mr-1.5 size-4" />}
              Connect via QR
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
