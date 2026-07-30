'use client';

import { useState, useEffect, useRef, use } from 'react';
import { useWorkspace } from '@/hooks/use-workspace';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ShieldCheck,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  FileCode,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export default function PolicyReadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { activeWorkspace, activeMember } = useWorkspace();

  const [policy, setPolicy] = useState<any>(null);
  const [activeVersion, setActiveVersion] = useState<any>(null);
  const [existingAck, setExistingAck] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Scroll verification & signature state
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  // Real reading time for the acknowledgement record.
  const readStartRef = useRef<number>(Date.now());

  // Content shorter than the scroll box never fires a scroll event —
  // unlock immediately when there is nothing to scroll.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && el.scrollHeight <= el.clientHeight + 30) {
      setScrolledToBottom(true);
    }
  }, [loading, activeVersion?.id]);
  const [agreed, setAgreed] = useState(false);
  const [typedName, setTypedName] = useState('');
  const [signing, setSigning] = useState(false);

  useEffect(() => {
    async function loadPolicyData() {
      if (!id || !activeWorkspace?.id) return;
      setLoading(true);

      try {
        const res = await fetch(`/api/hr/policies/${id}`);
        const json = await res.json();
        if (json.policy) {
          const p = json.policy;
          setPolicy(p);

          const verList = p.versions || [];
          const maxVerNum = verList.reduce((max: number, v: any) => Math.max(max, v.version_number || 1), 0);
          const publishedVer = verList.find((v: any) => v.version_number === maxVerNum);
          setActiveVersion(publishedVer);

          // Check if already signed
          if (activeMember?.id && publishedVer) {
            const acks = p.acknowledgements || [];
            const ack = acks.find((a: any) => a.version_id === publishedVer.id && a.workspace_member_id === activeMember.id && a.status === 'ACTIVE');
            setExistingAck(ack || null);
          }
        }
      } catch {
        toast.error('Failed to load policy document');
      } finally {
        setLoading(false);
      }
    }

    loadPolicyData();
  }, [id, activeWorkspace?.id, activeMember?.id]);

  // Scroll verification handler
  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    if (scrollTop + clientHeight >= scrollHeight - 30) {
      setScrolledToBottom(true);
    }
  };

  const handleSignPolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!typedName.trim()) {
      toast.error('Please type your full legal name');
      return;
    }
    if (!activeWorkspace?.id || !activeMember?.id || !activeVersion) return;

    setSigning(true);
    try {
      const res = await fetch(`/api/hr/policies/${id}/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: activeWorkspace.id,
          versionId: activeVersion.id,
          versionNumber: activeVersion.version_number,
          memberId: activeMember.id,
          signatureValue: typedName.trim(),
          signatureType: 'TYPED_NAME',
          readTimeSeconds: Math.max(1, Math.round((Date.now() - readStartRef.current) / 1000)),
          readTillBottom: scrolledToBottom
        })
      });

      const json = await res.json();
      if (json.error) throw new Error(json.error);

      toast.success('Policy document legally signed and recorded!');
      setExistingAck(json.acknowledgement);
    } catch (err: any) {
      toast.error(err.message || 'Failed to record signature');
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!policy || !activeVersion) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Policy document not found or unpublished.</p>
        <Button onClick={() => router.push('/policies')} className="mt-4">
          Return to Policies
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.push('/policies')} className="text-muted-foreground">
          <ArrowLeft className="size-4 mr-2" /> Back to Policies
        </Button>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs bg-card">
            {policy.category.replace(/_/g, ' ')}
          </Badge>
          <Badge className="bg-emerald-600 text-foreground">
            Version v{activeVersion.version_number}
          </Badge>
        </div>
      </div>

      {/* Policy Reader Header */}
      <Card className="border-border bg-card shadow-sm">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl font-bold text-foreground">{policy.title}</CardTitle>
              <CardDescription className="text-xs mt-1 flex items-center gap-4">
                <span>Published: {new Date(activeVersion.published_at || policy.updated_at).toLocaleDateString()}</span>
                <span>Effective: {new Date(activeVersion.effective_at || policy.created_at).toLocaleDateString()}</span>
              </CardDescription>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-mono text-muted-foreground flex items-center gap-1 justify-end">
                <FileCode className="size-3 text-primary" /> SHA-256 Hash
              </span>
              <span className="text-[10px] font-mono opacity-70 block truncate max-w-[180px]">
                {activeVersion.content_hash || 'SHA-256 Pending'}
              </span>
            </div>
          </div>

          {activeVersion.change_summary && (
            <div className="mt-3 p-2.5 rounded-none bg-primary/5 border border-primary/20 text-xs flex items-center gap-2 text-primary">
              <Sparkles className="size-4 shrink-0" />
              <span><strong>What&apos;s New in v{activeVersion.version_number}:</strong> {activeVersion.change_summary}</span>
            </div>
          )}
        </CardHeader>

        {/* Policy Text Reader Scroll Box */}
        <CardContent>
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="border border-border rounded-lg p-6 max-h-[450px] overflow-y-auto bg-muted/10 font-sans text-sm leading-relaxed space-y-4 shadow-inner"
          >
            {activeVersion.content ? (
              activeVersion.content.split('\n\n').map((paragraph: string, idx: number) => (
                <p key={idx} className="text-foreground/90">{paragraph}</p>
              ))
            ) : (
              <p className="text-muted-foreground italic">No document content available.</p>
            )}
            <div className="pt-8 text-center text-xs text-muted-foreground border-t border-border/40">
              --- END OF POLICY DOCUMENT ---
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Signature Box / Status */}
      {existingAck ? (
        <Card className="border-emerald-500/30 bg-emerald-500/5 shadow-sm">
          <CardContent className="py-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-full bg-emerald-500/20 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="size-6" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                  Policy Legally Signed & Acknowledged
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Signed by <strong>{existingAck.signature_value}</strong> on {new Date(existingAck.acknowledged_at).toLocaleString()}
                </p>
                <span className="text-[10px] font-mono text-muted-foreground opacity-80 block mt-1">
                  SHA-256 Proof: {existingAck.content_hash} • IP: {existingAck.ip_address}
                </span>
              </div>
            </div>
            <Badge variant="outline" className="border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-950">
              Active Signature
            </Badge>
          </CardContent>
        </Card>
      ) : activeVersion.mandatory ? (
        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" /> Legal Digital Signature & Sign-Off
            </CardTitle>
            <CardDescription>
              {scrolledToBottom
                ? 'Document review verified. Type your full legal name below to complete sign-off.'
                : 'Please scroll through the entire document above to unlock the sign-off box.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignPolicy} className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="agree-terms"
                  checked={agreed}
                  onCheckedChange={(c) => setAgreed(!!c)}
                  disabled={!scrolledToBottom}
                />
                <label
                  htmlFor="agree-terms"
                  className={`text-xs ${scrolledToBottom ? 'cursor-pointer text-foreground font-medium' : 'text-muted-foreground'}`}
                >
                  I confirm that I have read, understood, and agree to adhere to all terms in this policy document.
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="sm:col-span-2 space-y-1">
                  <Input
                    placeholder="Type your full legal name (e.g. John Doe)"
                    value={typedName}
                    onChange={(e) => setTypedName(e.target.value)}
                    disabled={!scrolledToBottom || !agreed}
                    className="bg-popover"
                  />
                  <p className="text-[10px] text-muted-foreground">Your typed name serves as your legal digital signature.</p>
                </div>
                <Button
                  type="submit"
                  disabled={!scrolledToBottom || !agreed || !typedName.trim() || signing}
                  className="bg-primary text-primary-foreground h-10"
                >
                  {signing ? <Loader2 className="size-4 animate-spin mr-2" /> : <ShieldCheck className="size-4 mr-2" />}
                  Sign & Acknowledge
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
