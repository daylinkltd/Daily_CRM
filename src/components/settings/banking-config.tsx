'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, Loader2, RefreshCw, Landmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useWorkspace } from '@/hooks/use-workspace';

interface PushRow {
  payroll_cycle_id: string;
  stage: 'processed' | 'paid';
  status: 'pending' | 'sent' | 'duplicate' | 'failed';
  voucher_no: string | null;
  last_error: string | null;
  attempts: number;
  created_at: string;
}

/**
 * Connects this workspace to the customer's core banking / accounting system so
 * payroll totals reach their statutory books. Only totals are sent — payslips
 * and individual salaries stay in Dailybiz.
 */
export function BankingConfig() {
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [retrying, setRetrying] = useState<string | null>(null);

  const [configured, setConfigured] = useState(false);
  const [status, setStatus] = useState<string>('inactive');
  const [tokenSet, setTokenSet] = useState(false);
  const [pushes, setPushes] = useState<PushRow[]>([]);

  const [baseUrl, setBaseUrl] = useState('');
  const [remoteWorkspaceId, setRemoteWorkspaceId] = useState('');
  const [token, setToken] = useState('');
  const [paymentRole, setPaymentRole] = useState<'BANK' | 'CASH'>('BANK');

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/integrations/banking?workspace_id=${workspaceId}`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Could not load banking settings');
        return;
      }
      setConfigured(Boolean(data.configured));
      setStatus(data.status || 'inactive');
      setTokenSet(Boolean(data.tokenSet));
      setPushes(data.pushes || []);
      if (data.configured) {
        setBaseUrl(data.baseUrl || '');
        setRemoteWorkspaceId(data.remoteWorkspaceId || workspaceId);
        setPaymentRole(data.paymentRole === 'CASH' ? 'CASH' : 'BANK');
      } else {
        // The banking system expects to see this workspace's id.
        setRemoteWorkspaceId(workspaceId);
      }
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (action: 'save' | 'test' | 'disconnect') => {
    if (!workspaceId) return;
    const busy = action === 'test' ? setTesting : setSaving;
    busy(true);
    try {
      const res = await fetch('/api/integrations/banking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          action,
          baseUrl,
          remoteWorkspaceId,
          token,
          paymentRole,
        }),
      });
      const data = await res.json();

      if (!res.ok || (action === 'test' && !data.success)) {
        toast.error(data.error || 'Request failed');
        return;
      }

      if (action === 'test') toast.success(data.detail || 'Connected');
      if (action === 'save') toast.success('Banking integration saved');
      if (action === 'disconnect') toast.success('Banking integration paused');

      setToken('');
      await load();
    } finally {
      busy(false);
    }
  };

  const retry = async (row: PushRow) => {
    if (!workspaceId) return;
    const key = `${row.payroll_cycle_id}:${row.stage}`;
    setRetrying(key);
    try {
      const res = await fetch('/api/integrations/banking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          action: 'retry',
          cycleId: row.payroll_cycle_id,
          stage: row.stage,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.outcome?.error || data.error || 'Retry failed');
      } else {
        toast.success('Sent to the banking system');
      }
      await load();
    } finally {
      setRetrying(null);
    }
  };

  const connected = configured && status === 'active';

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px] mt-4">
      <div className="space-y-6">
        <Alert className="bg-card border-border">
          <div className="flex items-center gap-2">
            {connected ? (
              <CheckCircle2 className="size-4 text-primary" />
            ) : (
              <XCircle className="size-4 text-red-500" />
            )}
            <AlertTitle className="text-foreground mb-0">
              {connected ? 'Connected' : configured ? 'Paused' : 'Not Connected'}
            </AlertTitle>
          </div>
          <AlertDescription className="text-muted-foreground mt-1">
            When a payroll cycle is processed or paid, the cycle totals are posted as a voucher in
            the banking system. Payslips and individual salaries never leave Dailybiz.
          </AlertDescription>
        </Alert>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Banking system</CardTitle>
            <CardDescription>
              Pair this workspace under <strong>Admin → Integrations</strong> in the banking system,
              then paste the token it shows you. The token is displayed only once there.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="banking-url">Banking system URL</Label>
              <Input
                id="banking-url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://books.yourbank.in"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="banking-workspace">Workspace ID (as registered there)</Label>
              <Input
                id="banking-workspace"
                value={remoteWorkspaceId}
                onChange={(e) => setRemoteWorkspaceId(e.target.value)}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Must match the workspace ID entered when pairing, or the banking system rejects the
                push.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="banking-token">
                Integration token{' '}
                {tokenSet && <span className="text-muted-foreground">(already set)</span>}
              </Label>
              <Input
                id="banking-token"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder={tokenSet ? 'Leave blank to keep the current token' : 'Paste the token'}
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="banking-payment">Salaries are paid from</Label>
              <select
                id="banking-payment"
                value={paymentRole}
                onChange={(e) => setPaymentRole(e.target.value === 'CASH' ? 'CASH' : 'BANK')}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="BANK">Bank</option>
                <option value="CASH">Cash</option>
              </select>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={() => submit('save')} disabled={saving || loading}>
                {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
                Save
              </Button>
              <Button variant="outline" onClick={() => submit('test')} disabled={testing || loading}>
                {testing && <Loader2 className="mr-2 size-4 animate-spin" />}
                Test connection
              </Button>
              {connected && (
                <Button variant="ghost" onClick={() => submit('disconnect')} disabled={saving}>
                  Pause
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Payroll postings</CardTitle>
            <CardDescription>
              Every push is recorded here. A failed push never blocks payroll — retry it once the
              banking system is reachable.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : pushes.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                Nothing pushed yet. Process a payroll cycle to send its first voucher.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                      <th className="py-2 pr-4">When</th>
                      <th className="py-2 pr-4">Stage</th>
                      <th className="py-2 pr-4">Result</th>
                      <th className="py-2 pr-4">Voucher</th>
                      <th className="py-2 pr-4">Tries</th>
                      <th className="py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pushes.map((row) => {
                      const key = `${row.payroll_cycle_id}:${row.stage}`;
                      const failed = row.status === 'failed' || row.status === 'pending';
                      return (
                        <tr key={key} className="border-b border-border/50">
                          <td className="py-2 pr-4 text-xs text-muted-foreground">
                            {new Date(row.created_at).toLocaleString('en-IN')}
                          </td>
                          <td className="py-2 pr-4 text-xs">
                            {row.stage === 'processed' ? 'Accrual' : 'Payout'}
                          </td>
                          <td className="py-2 pr-4 text-xs">
                            <span
                              className={
                                row.status === 'sent' || row.status === 'duplicate'
                                  ? 'text-primary font-medium'
                                  : 'text-red-500 font-medium'
                              }
                            >
                              {row.status}
                            </span>
                            {row.last_error && (
                              <span className="block text-red-500/80">{row.last_error}</span>
                            )}
                          </td>
                          <td className="py-2 pr-4 text-xs font-mono">{row.voucher_no || '—'}</td>
                          <td className="py-2 pr-4 text-xs">{row.attempts}</td>
                          <td className="py-2">
                            {failed && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => retry(row)}
                                disabled={retrying === key}
                              >
                                {retrying === key ? (
                                  <Loader2 className="size-3 animate-spin" />
                                ) : (
                                  <RefreshCw className="size-3" />
                                )}
                                <span className="ml-1">Retry</span>
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border h-fit">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Landmark className="size-4 text-primary" />
            How it posts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground">When a cycle is processed</p>
            <p className="mt-1">
              Debit Salary Expense with the <strong>gross</strong>, credit each statutory deduction
              (PF, professional tax, TDS) and any advance recovered, credit Salaries Payable with
              the net.
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground">When a cycle is paid</p>
            <p className="mt-1">
              Debit Salaries Payable, credit the bank or cash ledger you selected.
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground">Safe to retry</p>
            <p className="mt-1">
              Each cycle and stage posts at most once. Retrying a push that already landed is
              reported as a duplicate, not a second voucher.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
