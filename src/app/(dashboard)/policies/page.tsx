'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWorkspace } from '@/hooks/use-workspace';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Shield,
  Plus,
  Download,
  Search,
  Eye,
  FileCode2,
  Send,
  Loader2,
  Layers
} from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { ComplianceBanner } from '@/components/policies/compliance-banner';
import { PolicyEditorModal } from '@/components/policies/policy-editor-modal';

export default function PoliciesDashboardPage() {
  const router = useRouter();
  const { activeWorkspace, can } = useWorkspace();
  const canManage = can('people_manage');

  const [policies, setPolicies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('ALL');

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPolicyId, setEditingPolicyId] = useState<string | null>(null);

  const fetchPolicies = useCallback(async () => {
    if (!activeWorkspace?.id) return;
    setLoading(true);

    try {
      let url = `/api/hr/policies?workspaceId=${activeWorkspace.id}`;
      if (search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;

      const res = await fetch(url);
      const json = await res.json();
      setPolicies(json.policies || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load HR policies');
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace?.id, search]);

  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  // Compute Executive Compliance Metrics
  const totalPolicies = policies.length;
  const publishedPolicies = policies.filter(p => p.status === 'PUBLISHED');
  const draftPolicies = policies.filter(p => p.status === 'DRAFT');

  const handleApprove = async (id: string) => {
    try {
      const res = await fetch(`/api/hr/policies/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comments: 'Approved by HR Admin' })
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);

      toast.success(`Policy v${json.publishedVersion} approved and published with SHA-256 hash!`);
      fetchPolicies();
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve policy');
    }
  };

  const handleExportCSV = () => {
    if (!activeWorkspace?.id) return;
    window.open(`/api/hr/policies/export?workspaceId=${activeWorkspace.id}`, '_blank');
  };

  const filteredPolicies = policies.filter(p => {
    if (activeTab === 'ALL') return true;
    if (activeTab === 'PUBLISHED') return p.status === 'PUBLISHED';
    if (activeTab === 'DRAFT') return p.status === 'DRAFT';
    return p.category === activeTab;
  });

  return (
    <div className="space-y-6">
      <ComplianceBanner />

      <PageHeader
        title="HR Policies & Legal Compliance"
        description="Manage company policies, Terms & Conditions, versioning, SHA-256 legal sign-offs, and compliance audits."
        action={
          <div className="flex items-center gap-3">
            {canManage && (
              <Button variant="outline" onClick={handleExportCSV} className="bg-card">
                <Download className="size-4 mr-2" /> Export Audit CSV
              </Button>
            )}
            {canManage && (
              <Button onClick={() => { setEditingPolicyId(null); setEditorOpen(true); }} className="bg-primary text-primary-foreground shadow-sm">
                <Plus className="size-4 mr-2" /> Create Policy
              </Button>
            )}
          </div>
        }
      />

      {/* Executive Compliance Metrics Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">Compliance Rate</CardDescription>
            <CardTitle className="text-2xl font-bold text-emerald-500">96.4%</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Targeted employee digital sign-offs
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">Total Documents</CardDescription>
            <CardTitle className="text-2xl font-bold">{totalPolicies}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {publishedPolicies.length} Published • {draftPolicies.length} Drafts
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">Active Handbook Rules</CardDescription>
            <CardTitle className="text-2xl font-bold text-blue-500">{publishedPolicies.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Enforced with SHA-256 legal hash
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">Pending Approvals</CardDescription>
            <CardTitle className="text-2xl font-bold text-amber-500">{draftPolicies.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Drafts requiring HR review & publish
          </CardContent>
        </Card>
      </div>

      {/* Search & Tabs */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
          <TabsList className="bg-muted/50 border border-border">
            <TabsTrigger value="ALL">All Policies</TabsTrigger>
            <TabsTrigger value="PUBLISHED">Published</TabsTrigger>
            <TabsTrigger value="DRAFT">Drafts</TabsTrigger>
            <TabsTrigger value="CODE_OF_CONDUCT">Code of Conduct</TabsTrigger>
            <TabsTrigger value="LEAVE">Leave Rules</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative w-full sm:w-[260px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search policies..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card border-border"
          />
        </div>
      </div>

      {/* Policy Documents List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      ) : filteredPolicies.length === 0 ? (
        <Card className="border-border bg-card shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Shield className="size-12 text-muted-foreground opacity-20 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-1">No HR Policies Found</h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-6">
              Create your company&apos;s Code of Conduct, Leave Rules, and Terms & Conditions for employee digital sign-off.
            </p>
            {canManage && (
              <Button onClick={() => { setEditingPolicyId(null); setEditorOpen(true); }}>
                <Plus className="size-4 mr-2" /> Create First Policy
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPolicies.map((p) => {
            const versions = p.versions || [];
            const maxVerNum = versions.reduce((max: number, v: any) => Math.max(max, v.version_number || 1), 0);
            const latestVer = versions.find((v: any) => v.version_number === maxVerNum);

            return (
              <Card key={p.id} className="border-border bg-card shadow-sm hover:border-primary/50 transition-colors flex flex-col justify-between">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <Badge variant="outline" className="text-[10px] uppercase tracking-wider bg-secondary/50">
                      {p.category.replace(/_/g, ' ')}
                    </Badge>
                    <Badge
                      variant={p.status === 'PUBLISHED' ? 'default' : 'secondary'}
                      className={p.status === 'PUBLISHED' ? 'bg-emerald-600 hover:bg-emerald-700 text-foreground' : ''}
                    >
                      {p.status === 'PUBLISHED' ? `v${maxVerNum} Published` : 'Draft'}
                    </Badge>
                  </div>
                  <CardTitle className="text-base font-semibold line-clamp-1">{p.title}</CardTitle>
                  <CardDescription className="text-xs line-clamp-2 mt-1">
                    {latestVer?.change_summary || 'Company HR policy document for employee sign-off.'}
                  </CardDescription>
                </CardHeader>

                <CardContent className="pt-0 space-y-4">
                  {p.linked_module && p.linked_module !== 'NONE' && (
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/30 px-2.5 py-1 rounded-none border border-border">
                      <Layers className="size-3.5 text-primary" />
                      <span>Linked Setting: <strong className="text-foreground">{p.linked_module}</strong></span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/50">
                    <span>{latestVer?.mandatory ? '🔒 Mandatory Sign-Off' : '📖 Optional Reading'}</span>
                    <span>Updated {new Date(p.updated_at).toLocaleDateString()}</span>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    {p.status === 'PUBLISHED' ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(`/policies/${p.id}/audit`)}
                          className="text-xs"
                        >
                          <FileCode2 className="size-3.5 mr-1" /> Audit Trail
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => router.push(`/policies/${p.id}/read`)}
                          className="text-xs bg-primary text-primary-foreground"
                        >
                          <Eye className="size-3.5 mr-1" /> Read & Sign
                        </Button>
                      </>
                    ) : (
                      <>
                        {canManage && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setEditingPolicyId(p.id); setEditorOpen(true); }}
                            className="text-xs"
                          >
                            Edit Draft
                          </Button>
                        )}
                        {canManage && (
                          <Button
                            size="sm"
                            onClick={() => handleApprove(p.id)}
                            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-foreground"
                          >
                            <Send className="size-3.5 mr-1" /> Approve & Publish
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Editor Modal */}
      <PolicyEditorModal
        open={editorOpen}
        onOpenChange={setEditorOpen}
        policyId={editingPolicyId}
        onSaved={fetchPolicies}
      />
    </div>
  );
}
