'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Calendar,
  Check,
  Copy,
  KeyRound,
  Loader2,
  Lock,
  Plus,
  ShieldAlert,
  Trash2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RequireRole } from '@/components/auth/require-role';
import { useAuth } from '@/hooks/use-auth';
import { SettingsPanelHead } from './settings-panel-head';
import { API_SCOPES, SCOPE_DESCRIPTIONS, type ApiScope } from '@/lib/api-keys/scopes';

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export function ApiKeysSettings() {
  const { canEditSettings, profileLoading } = useAuth();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);

  // Creation form states
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [expiresInDays, setExpiresInDays] = useState<string>('30');
  const [customDays, setCustomDays] = useState<string>('90');
  const [selectedScopes, setSelectedScopes] = useState<ApiScope[]>([]);
  const [creating, setCreating] = useState(false);

  // Reveal key dialog states
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [revealedPrefix, setRevealedPrefix] = useState<string | null>(null);
  const [revealedName, setRevealedName] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Revoke confirmation states
  const [revokingKey, setRevokingKey] = useState<ApiKey | null>(null);
  const [revoking, setRevoking] = useState(false);

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch('/api/account/api-keys', { cache: 'no-store' });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        toast.error(payload.error || 'Failed to load API keys');
        return;
      }
      const data = await res.json();
      setKeys(data.keys || []);
    } catch (err) {
      console.error('[ApiKeysSettings] fetch error:', err);
      toast.error('Could not reach the server');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchKeys();
  }, [fetchKeys]);

  const handleToggleScope = (scope: ApiScope) => {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  };

  const handleSelectAllScopes = () => {
    if (selectedScopes.length === API_SCOPES.length) {
      setSelectedScopes([]);
    } else {
      setSelectedScopes([...API_SCOPES]);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Key name is required');
      return;
    }

    setCreating(true);
    try {
      let days: number | null = null;
      if (expiresInDays !== 'never') {
        days = expiresInDays === 'custom' ? parseInt(customDays, 10) : parseInt(expiresInDays, 10);
        if (isNaN(days) || days <= 0) {
          toast.error('Please enter a valid number of days');
          setCreating(false);
          return;
        }
      }

      const res = await fetch('/api/account/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          scopes: selectedScopes,
          expiresInDays: days,
        }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        toast.error(payload.error || 'Failed to create API key');
        return;
      }

      const payload = await res.json();
      setRevealedKey(payload.plaintext);
      setRevealedPrefix(payload.key.key_prefix);
      setRevealedName(payload.key.name);
      
      // Reset form
      setName('');
      setExpiresInDays('30');
      setSelectedScopes([]);
      setCreateOpen(false);
      
      // Reload keys roster
      await fetchKeys();
    } catch (err) {
      console.error('[ApiKeysSettings] create error:', err);
      toast.error('Could not reach the server');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokingKey) return;
    setRevoking(true);
    try {
      const res = await fetch(`/api/account/api-keys/${revokingKey.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        toast.error(payload.error || 'Failed to revoke key');
        return;
      }

      toast.success(`API key "${revokingKey.name}" has been revoked`);
      setKeys((prev) =>
        prev.map((k) =>
          k.id === revokingKey.id
            ? { ...k, revoked_at: new Date().toISOString() }
            : k
        )
      );
      setRevokingKey(null);
    } catch (err) {
      console.error('[ApiKeysSettings] revoke error:', err);
      toast.error('Could not reach the server');
    } finally {
      setRevoking(false);
    }
  };

  const handleCopy = () => {
    if (!revealedKey) return;
    navigator.clipboard.writeText(revealedKey);
    setCopied(true);
    toast.success('Plaintext API key copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const isKeyActive = (key: ApiKey) => {
    if (key.revoked_at) return false;
    if (key.expires_at && new Date(key.expires_at).getTime() <= Date.now()) return false;
    return true;
  };

  const formatKeyDate = (iso: string | null) => {
    if (!iso) return 'Never';
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading || profileLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <section className="animate-in fade-in-50 space-y-6 duration-200">
      <SettingsPanelHead
        title="API keys"
        description="Mint and manage secure API keys for programmatic access to contacts, pipelines, messages, and automation engines."
        action={
          <RequireRole min="admin">
            <Button onClick={() => setCreateOpen(true)} className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="size-4" />
              Create API key
            </Button>
          </RequireRole>
        }
      />

      <div className="space-y-4">
        {keys.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <KeyRound className="size-4 text-primary" />
                API Credentials
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                No API keys have been created for this workspace yet.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
              <KeyRound className="size-10 text-muted-foreground/30" />
              <p className="mt-3 text-sm text-muted-foreground">
                Click "Create API key" above to generate your first credential.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {keys.map((key) => {
              const active = isKeyActive(key);
              const expired = key.expires_at && new Date(key.expires_at).getTime() <= Date.now();
              const revoked = !!key.revoked_at;

              return (
                <Card key={key.id} className={!active ? 'opacity-70 bg-card/50' : ''}>
                  <CardHeader className="pb-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                          {key.name}
                          <Badge variant="outline" className="font-mono text-[11px] bg-muted py-0 text-muted-foreground border-border">
                            {key.key_prefix}
                          </Badge>
                        </CardTitle>
                        <CardDescription className="text-xs text-muted-foreground mt-1">
                          Created on {formatKeyDate(key.created_at)}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        {revoked ? (
                          <Badge className="bg-red-500/10 text-red-400 border-red-500/30">Revoked</Badge>
                        ) : expired ? (
                          <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/30">Expired</Badge>
                        ) : (
                          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">Active</Badge>
                        )}

                        {canEditSettings && active && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setRevokingKey(key)}
                            className="h-8 border-red-500/30 bg-red-500/5 text-red-400 hover:bg-red-500/20 hover:text-red-300"
                          >
                            <Trash2 className="size-3.5 mr-1" />
                            Revoke
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="grid gap-x-6 gap-y-2 sm:grid-cols-3">
                      <div>
                        <span className="text-xs text-muted-foreground block">Last used</span>
                        <span className="text-foreground font-medium text-xs">
                          {key.last_used_at ? formatKeyDate(key.last_used_at) : 'Never'}
                        </span>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground block">Expires</span>
                        <span className="text-foreground font-medium text-xs">
                          {key.expires_at ? formatKeyDate(key.expires_at) : 'Never (Permanent)'}
                        </span>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground block">Scopes</span>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {key.scopes.length === 0 ? (
                            <Badge variant="outline" className="text-[10px] py-0 border-border text-muted-foreground">
                              None (Read-only Profile)
                            </Badge>
                          ) : (
                            key.scopes.map((scope) => (
                              <Badge key={scope} variant="secondary" className="text-[10px] py-0 font-mono bg-primary/10 text-primary border-primary/20">
                                {scope}
                              </Badge>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Key Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-popover border-border max-w-lg overflow-y-auto max-h-[90vh]">
          <form onSubmit={handleCreate} className="space-y-5">
            <DialogHeader>
              <DialogTitle className="text-foreground flex items-center gap-2">
                <KeyRound className="size-5 text-primary" />
                Create API Key
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Mint a new secret token. Plaintext credentials are shown exactly once.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="key-name" className="text-foreground text-sm font-medium">
                  Key Name
                </Label>
                <Input
                  id="key-name"
                  placeholder="e.g. Zapier Integration, Dev Script"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-muted border-border text-foreground"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="expiry" className="text-foreground text-sm font-medium">
                  Expiration
                </Label>
                <select
                  id="expiry"
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(e.target.value)}
                  className="h-9 w-full rounded-lg border border-border bg-muted px-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                >
                  <option value="7">7 Days</option>
                  <option value="30">30 Days</option>
                  <option value="90">90 Days</option>
                  <option value="365">1 Year</option>
                  <option value="never">Never (Permanent)</option>
                  <option value="custom">Custom days...</option>
                </select>
              </div>

              {expiresInDays === 'custom' && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-150">
                  <Label htmlFor="custom-days" className="text-foreground text-sm font-medium">
                    Custom Expiration (Days)
                  </Label>
                  <Input
                    id="custom-days"
                    type="number"
                    min="1"
                    max="365"
                    value={customDays}
                    onChange={(e) => setCustomDays(e.target.value)}
                    className="bg-muted border-border text-foreground"
                  />
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-foreground text-sm font-medium">
                    Scopes (Permissions)
                  </Label>
                  <Button
                    type="button"
                    variant="link"
                    onClick={handleSelectAllScopes}
                    className="h-auto p-0 text-xs text-primary hover:text-primary/80"
                  >
                    {selectedScopes.length === API_SCOPES.length ? 'Clear All' : 'Select All'}
                  </Button>
                </div>
                
                <div className="border border-border rounded-lg bg-muted p-3 space-y-2.5 divide-y divide-border/40">
                  {API_SCOPES.map((scope) => {
                    const checked = selectedScopes.includes(scope);
                    return (
                      <div key={scope} className="flex items-start gap-3 pt-2.5 first:pt-0">
                        <input
                          type="checkbox"
                          id={`scope-${scope}`}
                          checked={checked}
                          onChange={() => handleToggleScope(scope)}
                          className="mt-1 size-4 rounded border-border text-primary bg-background focus:ring-primary focus:ring-offset-background"
                        />
                        <div className="min-w-0 flex-1">
                          <Label
                            htmlFor={`scope-${scope}`}
                            className="font-mono text-xs font-semibold text-foreground cursor-pointer block"
                          >
                            {scope}
                          </Label>
                          <span className="text-[11px] text-muted-foreground leading-normal block mt-0.5">
                            {SCOPE_DESCRIPTIONS[scope]}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
                className="border-border text-muted-foreground hover:bg-muted"
                disabled={creating}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={creating}
              >
                {creating ? (
                  <>
                    <Loader2 className="size-4 mr-1.5 animate-spin" />
                    Minting...
                  </>
                ) : (
                  'Generate Key'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reveal Key Dialog (One-time only!) */}
      <Dialog
        open={revealedKey !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRevealedKey(null);
            setRevealedPrefix(null);
            setRevealedName(null);
          }
        }}
      >
        <DialogContent className="bg-popover border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <ShieldAlert className="size-5 text-amber-500 animate-pulse" />
              API Key Generated
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs leading-normal">
              Copy this plaintext secret key now. It is stored using a secure one-way cryptographic hash (SHA-256), which means **we can never display this key to you again**. If you leave this dialog, you must revoke and re-issue the key.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex items-start gap-2.5">
              <AlertTriangle className="size-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-300 leading-normal">
                <strong>Warning:</strong> Treat this key like a password. Anyone who obtains this key will have access to call this workspace's APIs with the granted scopes.
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-xs text-muted-foreground block">Key name: {revealedName}</span>
              <div className="flex gap-2">
                <div className="bg-muted border border-border rounded-lg p-2.5 flex-1 font-mono text-sm break-all text-emerald-400 select-all font-semibold select-text">
                  {revealedKey}
                </div>
                <Button onClick={handleCopy} size="icon" className="h-auto px-3 bg-primary text-primary-foreground hover:bg-primary/90 shrink-0">
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              onClick={() => {
                setRevealedKey(null);
                setRevealedPrefix(null);
                setRevealedName(null);
              }}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              I Have Saved My API Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Key Dialog */}
      <Dialog
        open={revokingKey !== null}
        onOpenChange={(open) => {
          if (!open) setRevokingKey(null);
        }}
      >
        <DialogContent className="bg-popover border-border sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-popover-foreground">
              <AlertTriangle className="size-4 text-red-500" />
              Revoke API Key
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs leading-normal">
              Are you sure you want to revoke the API key <strong>"{revokingKey?.name}"</strong> ({revokingKey?.key_prefix})?
              <span className="block mt-2 text-red-400 font-semibold">
                This action is immediate and cannot be undone. All scripts and integrations using this key will immediately start failing with 401 Unauthorized errors.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              onClick={() => setRevokingKey(null)}
              className="border-border text-muted-foreground hover:bg-muted"
              disabled={revoking}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRevoke}
              disabled={revoking}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {revoking ? (
                <>
                  <Loader2 className="size-4 mr-1 animate-spin" />
                  Revoking...
                </>
              ) : (
                'Revoke Key'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
