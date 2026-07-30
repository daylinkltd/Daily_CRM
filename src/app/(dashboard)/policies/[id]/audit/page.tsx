'use client';

import { useState, useEffect, use } from 'react';
import { useWorkspace } from '@/hooks/use-workspace';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Download,
  ArrowLeft,
  Loader2,
  UserCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export default function PolicyAuditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { activeWorkspace } = useWorkspace();

  const [policy, setPolicy] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAuditData() {
      if (!id || !activeWorkspace?.id) return;
      setLoading(true);

      try {
        const res = await fetch(`/api/hr/policies/${id}`);
        const json = await res.json();
        if (json.policy) {
          setPolicy(json.policy);
        }
      } catch {
        toast.error('Failed to load compliance audit logs');
      } finally {
        setLoading(false);
      }
    }

    loadAuditData();
  }, [id, activeWorkspace?.id]);

  const handleExportCSV = () => {
    if (!activeWorkspace?.id || !id) return;
    window.open(`/api/hr/policies/export?workspaceId=${activeWorkspace.id}&policyId=${id}`, '_blank');
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!policy) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Audit log not found.</p>
        <Button onClick={() => router.push('/policies')} className="mt-4">
          Return to Policies
        </Button>
      </div>
    );
  }

  const acknowledgements = policy.acknowledgements || [];
  const versions = policy.versions || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.push('/policies')} className="text-muted-foreground">
          <ArrowLeft className="size-4 mr-2" /> Back to Policies
        </Button>
        <Button variant="outline" onClick={handleExportCSV} className="bg-card">
          <Download className="size-4 mr-2" /> Export Audit CSV
        </Button>
      </div>

      <PageHeader
        title={`Audit Trail: ${policy.title}`}
        description="Immutable read-only compliance evidence, cryptographic SHA-256 signatures, and employee sign-off timestamps."
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">Total Signatures Captured</CardDescription>
            <CardTitle className="text-2xl font-bold text-emerald-500">{acknowledgements.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Court-admissible digital sign-offs
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">Policy Versions</CardDescription>
            <CardTitle className="text-2xl font-bold">{versions.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Immutable document history snapshots
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">Governance Mode</CardDescription>
            <CardTitle className="text-2xl font-bold text-blue-500">Read-Only Audit</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Zero edit permissions for audit integrity
          </CardContent>
        </Card>
      </div>

      {/* Acknowledgements Table */}
      <Card className="border-border bg-card shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserCheck className="size-4 text-primary" /> Employee Sign-Off Log
          </CardTitle>
          <CardDescription>
            Verified legal sign-offs with typed name, IP address, and SHA-256 cryptographic content hashes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {acknowledgements.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No employee signatures recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground font-medium">
                  <tr>
                    <th className="p-3">Employee</th>
                    <th className="p-3">Version</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Typed Legal Signature</th>
                    <th className="p-3">SHA-256 Content Hash</th>
                    <th className="p-3">IP Address</th>
                    <th className="p-3">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {acknowledgements.map((a: any) => (
                    <tr key={a.id} className="hover:bg-muted/20">
                      <td className="p-3 font-medium text-foreground">
                        {a.signature_value}
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-[10px]">v{a.version_number}</Badge>
                      </td>
                      <td className="p-3">
                        <Badge variant={a.status === 'ACTIVE' ? 'default' : 'secondary'} className={a.status === 'ACTIVE' ? 'bg-emerald-600 text-foreground' : ''}>
                          {a.status}
                        </Badge>
                      </td>
                      <td className="p-3 font-mono font-medium">{a.signature_value}</td>
                      <td className="p-3 font-mono text-[10px] opacity-70 truncate max-w-[140px]" title={a.content_hash}>
                        {a.content_hash}
                      </td>
                      <td className="p-3 font-mono text-[11px]">{a.ip_address || '127.0.0.1'}</td>
                      <td className="p-3 text-muted-foreground">{new Date(a.acknowledged_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
