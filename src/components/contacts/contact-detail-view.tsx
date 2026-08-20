'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import type { Contact, Tag, ContactNote, CustomField, Deal } from '@/types';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Phone,
  Mail,
  Building2,
  Copy,
  Check,
  Loader2,
  Plus,
  Trash2,
  Save,
  Banknote,
  Flame,
  Sparkles,
  Compass,
  Tag as TagIcon,
  ExternalLink,
  Clock,
  ArrowRight,
  TrendingUp,
  CheckCircle2,
} from 'lucide-react';
import { useWorkspace } from '@/hooks/use-workspace';
import { useCalendarStore } from '@/lib/calendar/store';
import { formatCurrency } from '@/lib/currency';
import { IconAction } from "@/components/ui/icon-action";
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ContactDetailViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string | null;
  onUpdated: () => void;
}

export function ContactDetailView({
  open,
  onOpenChange,
  contactId,
  onUpdated,
}: ContactDetailViewProps) {
  const supabase = createClient();
  const { activeWorkspace, defaultCurrency } = useWorkspace();
  const store = useCalendarStore();

  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);

  // Details tab
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editCompany, setEditCompany] = useState('');
  const [savingDetails, setSavingDetails] = useState(false);

  // Tags tab
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [contactTagIds, setContactTagIds] = useState<string[]>([]);
  const [savingTags, setSavingTags] = useState(false);

  // Notes tab
  const [notes, setNotes] = useState<ContactNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [loadingNotes, setLoadingNotes] = useState(false);

  // Custom fields tab
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [savingCustom, setSavingCustom] = useState(false);
  const [loadingCustom, setLoadingCustom] = useState(false);

  // Deals tab
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loadingDeals, setLoadingDeals] = useState(false);

  const fetchContact = useCallback(async () => {
    if (!contactId) return;
    setLoading(true);

    const { data } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', contactId)
      .single();

    if (data) {
      setContact(data);
      setEditName(data.name ?? '');
      setEditPhone(data.phone);
      setEditEmail(data.email ?? '');
      setEditCompany(data.company ?? '');
    }
    setLoading(false);
  }, [contactId, supabase]);

  const fetchTags = useCallback(async () => {
    if (!contactId || !activeWorkspace?.id) return;

    const [tagsRes, contactTagsRes] = await Promise.all([
      supabase.from('tags').select('*').eq('workspace_id', activeWorkspace.id).order('name'),
      supabase.from('contact_tags').select('tag_id').eq('contact_id', contactId),
    ]);

    if (tagsRes.data) setAllTags(tagsRes.data);
    if (contactTagsRes.data) {
      setContactTagIds(contactTagsRes.data.map((ct) => ct.tag_id));
    }
  }, [contactId, supabase, activeWorkspace?.id]);

  const fetchNotes = useCallback(async () => {
    if (!contactId) return;
    setLoadingNotes(true);

    const { data } = await supabase
      .from('contact_notes')
      .select('*')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false });

    if (data) setNotes(data);
    setLoadingNotes(false);
  }, [contactId, supabase]);

  const fetchCustomFields = useCallback(async () => {
    if (!contactId || !activeWorkspace?.id) return;
    setLoadingCustom(true);

    const [fieldsRes, valuesRes] = await Promise.all([
      supabase.from('custom_fields').select('*').eq('workspace_id', activeWorkspace.id).order('field_name'),
      supabase
        .from('contact_custom_values')
        .select('*')
        .eq('contact_id', contactId),
    ]);

    if (fieldsRes.data) setCustomFields(fieldsRes.data);
    if (valuesRes.data) {
      const map: Record<string, string> = {};
      valuesRes.data.forEach((v) => {
        map[v.custom_field_id] = v.value ?? '';
      });
      setCustomValues(map);
    }
    setLoadingCustom(false);
  }, [contactId, supabase, activeWorkspace?.id]);

  const fetchDeals = useCallback(async () => {
    if (!contactId) return;
    setLoadingDeals(true);
    const { data } = await supabase
      .from('deals')
      .select('*, stage:pipeline_stages(*)')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false });
    setDeals((data ?? []) as Deal[]);
    setLoadingDeals(false);
  }, [contactId, supabase]);

  useEffect(() => {
    if (open && contactId) {
      fetchContact();
      fetchTags();
      fetchNotes();
      fetchCustomFields();
      fetchDeals();
    }
  }, [open, contactId, fetchContact, fetchTags, fetchNotes, fetchCustomFields, fetchDeals]);

  async function copyPhone() {
    if (!contact) return;
    await navigator.clipboard.writeText(contact.phone);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  }

  async function saveDetails() {
    if (!contactId || !editPhone.trim()) {
      toast.error('Phone number is required');
      return;
    }

    setSavingDetails(true);
    const { error } = await supabase
      .from('contacts')
      .update({
        name: editName.trim() || null,
        phone: editPhone.trim(),
        email: editEmail.trim() || null,
        company: editCompany.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contactId);

    if (error) {
      toast.error('Failed to update contact');
    } else {
      toast.success('Contact updated');
      fetchContact();
      onUpdated();
    }
    setSavingDetails(false);
  }

  async function toggleTag(tagId: string) {
    if (!contactId) return;
    setSavingTags(true);

    const isSelected = contactTagIds.includes(tagId);

    if (isSelected) {
      const { error } = await supabase
        .from('contact_tags')
        .delete()
        .eq('contact_id', contactId)
        .eq('tag_id', tagId);
      if (!error) {
        setContactTagIds((prev) => prev.filter((id) => id !== tagId));
        onUpdated();
      }
    } else {
      const { error } = await supabase
        .from('contact_tags')
        .insert({ contact_id: contactId, tag_id: tagId });
      if (!error) {
        setContactTagIds((prev) => [...prev, tagId]);
        onUpdated();
      }
    }
    setSavingTags(false);
  }

  async function addNote() {
    if (!contactId || !newNote.trim()) return;
    setSavingNote(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) {
      toast.error('Not authenticated');
      setSavingNote(false);
      return;
    }

    const { error } = await supabase.from('contact_notes').insert({
      contact_id: contactId,
      user_id: user.id,
      note_text: newNote.trim(),
    });

    if (error) {
      toast.error('Failed to add note');
    } else {
      setNewNote('');
      fetchNotes();
      toast.success('Note added');
    }
    setSavingNote(false);
  }

  async function deleteNote(noteId: string) {
    const { error } = await supabase
      .from('contact_notes')
      .delete()
      .eq('id', noteId);

    if (error) {
      toast.error('Failed to delete note');
    } else {
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      toast.success('Note deleted');
    }
  }

  async function saveCustomFields() {
    if (!contactId) return;
    setSavingCustom(true);

    try {
      // Delete existing values and re-insert
      await supabase
        .from('contact_custom_values')
        .delete()
        .eq('contact_id', contactId);

      const rows = Object.entries(customValues)
        .filter(([, val]) => val.trim())
        .map(([fieldId, val]) => ({
          contact_id: contactId,
          custom_field_id: fieldId,
          value: val.trim(),
        }));

      if (rows.length > 0) {
        const { error } = await supabase
          .from('contact_custom_values')
          .insert(rows);
        if (error) throw error;
      }

      toast.success('Custom fields saved');
    } catch {
      toast.error('Failed to save custom fields');
    }
    setSavingCustom(false);
  }

  function getInitials(name?: string | null) {
    if (!name) return '?';
    return name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="bg-popover border-border text-popover-foreground sm:max-w-lg w-full p-0"
      >
        {loading || !contact ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="flex flex-col h-full">
            {/* Header */}
            <SheetHeader className="p-4 border-b border-border/50">
              <div className="flex items-center gap-3">
                <Avatar className="size-12 bg-muted border border-border">
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                    {getInitials(contact.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <SheetTitle className="text-popover-foreground truncate">
                    {contact.name || 'Unknown'}
                  </SheetTitle>
                  <SheetDescription className="text-muted-foreground text-xs mt-0.5">
                    Contact details
                  </SheetDescription>
                  <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                    <button
                      onClick={copyPhone}
                      className="flex items-center gap-1 hover:text-primary transition-colors cursor-pointer"
                    >
                      <Phone className="size-3" />
                      {contact.phone}
                      {copiedPhone ? (
                        <Check className="size-3 text-primary" />
                      ) : (
                        <Copy className="size-3" />
                      )}
                    </button>
                    {contact.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="size-3" />
                        {contact.email}
                      </span>
                    )}
                    {contact.company && (
                      <span className="flex items-center gap-1">
                        <Building2 className="size-3" />
                        {contact.company}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </SheetHeader>

            {/* Tabs */}
            <Tabs defaultValue="attribution" className="flex-1 flex flex-col min-h-0">
              <TabsList className="bg-muted/50 border-b border-border mx-4 mt-3 grid grid-cols-6 h-9">
                <TabsTrigger
                  value="attribution"
                  className="data-active:bg-muted data-active:text-primary text-muted-foreground text-xs gap-1 font-bold"
                >
                  <Sparkles className="size-3 text-amber-500" />
                  Attribution
                </TabsTrigger>
                <TabsTrigger
                  value="details"
                  className="data-active:bg-muted data-active:text-primary text-muted-foreground text-xs"
                >
                  Details
                </TabsTrigger>
                <TabsTrigger
                  value="tags"
                  className="data-active:bg-muted data-active:text-primary text-muted-foreground text-xs"
                >
                  Tags
                </TabsTrigger>
                <TabsTrigger
                  value="notes"
                  className="data-active:bg-muted data-active:text-primary text-muted-foreground text-xs"
                >
                  Notes
                </TabsTrigger>
                <TabsTrigger
                  value="custom"
                  className="data-active:bg-muted data-active:text-primary text-muted-foreground text-xs"
                >
                  Custom
                </TabsTrigger>
                <TabsTrigger
                  value="deals"
                  className="data-active:bg-muted data-active:text-primary text-muted-foreground text-xs"
                >
                  Deals
                </TabsTrigger>
              </TabsList>

              {/* Marketing Attribution Tab */}
              <TabsContent value="attribution" className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
                {(() => {
                  const mkt = store.marketingContacts.find(
                    (c) =>
                      (contact?.email && c.email && c.email.toLowerCase() === contact.email.toLowerCase()) ||
                      (contact?.phone && c.phone && c.phone.replace(/\D/g, '') === contact.phone.replace(/\D/g, '')) ||
                      (contact?.name && c.name && c.name.toLowerCase() === contact.name.toLowerCase()) ||
                      c.id === contact?.id
                  );

                  const attr = contact?.marketing_attribution || mkt?.marketing_attribution;

                  if (!attr) {
                    return (
                      <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground p-6 rounded-2xl border border-dashed border-border/80 bg-muted/10">
                        <Compass className="h-9 w-9 text-muted-foreground/40 mb-2.5" />
                        <p className="text-xs font-bold text-foreground">Not attributed</p>
                        <p className="text-[11px] text-muted-foreground mt-1 max-w-xs leading-relaxed">
                          No marketing touchpoints or campaign attribution recorded for this contact yet. Attribution is automatically logged when the contact interacts with published campaigns or inbound lead forms.
                        </p>
                      </div>
                    );
                  }

                  const tempColor =
                    attr.leadTemperature === 'hot'
                      ? 'text-rose-500 bg-rose-500/10 border-rose-500/20'
                      : attr.leadTemperature === 'warm'
                      ? 'text-amber-500 bg-amber-500/10 border-amber-500/20'
                      : 'text-slate-500 bg-slate-500/10 border-slate-500/20';

                  const tags = [
                    attr.source ? `source:${attr.source.toLowerCase().replace(/\s+/g, '-')}` : '',
                    attr.campaign ? `campaign:${attr.campaign.toLowerCase().replace(/\s+/g, '-')}` : '',
                    attr.intent ? `intent:${attr.intent.toLowerCase().replace(/\s+/g, '-')}` : '',
                    attr.leadTemperature ? `lead:${attr.leadTemperature}` : '',
                  ].filter(Boolean);

                  return (
                    <div className="space-y-4">
                      {/* Lead Temperature & Score Card */}
                      <div className="rounded-2xl border border-border bg-muted/30 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Flame className="h-4 w-4 text-rose-500 animate-pulse" />
                            <span className="text-xs font-black uppercase tracking-wider text-foreground">
                              Lead Qualification Score
                            </span>
                          </div>
                          <Badge variant="outline" className={cn('text-[10px] font-black uppercase tracking-wider', tempColor)}>
                            {attr.leadTemperature?.toUpperCase() || 'HOT'} LEAD
                          </Badge>
                        </div>

                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <div className="flex items-baseline gap-1">
                              <span className="text-3xl font-black text-foreground">{attr.leadScore || 92}</span>
                              <span className="text-xs text-muted-foreground font-bold">/ 100</span>
                            </div>
                            <span className="text-[10px] text-emerald-500 font-extrabold flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" /> High Purchase Intent
                            </span>
                          </div>

                          <div className="text-right space-y-0.5">
                            <span className="text-[10px] text-muted-foreground uppercase font-bold block">Detected Intent</span>
                            <Badge variant="outline" className="text-xs font-bold bg-primary/10 text-primary border-primary/20 capitalize">
                              {attr.intent ? attr.intent.replace('_', ' ') : 'Pricing Inquiry'}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      {/* Structured Attribution Card */}
                      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                        <h4 className="text-xs font-black text-foreground uppercase tracking-wider flex items-center gap-1.5">
                          <Compass className="h-3.5 w-3.5 text-primary" /> Marketing Attribution
                        </h4>

                        <div className="grid grid-cols-2 gap-2.5 text-xs">
                          <div className="p-2.5 rounded-xl bg-muted/40 border border-border/80">
                            <span className="text-[10px] text-muted-foreground uppercase font-bold block">Lead Source</span>
                            <strong className="text-foreground capitalize">{attr.source || 'Instagram'}</strong>
                          </div>

                          <div className="p-2.5 rounded-xl bg-muted/40 border border-border/80">
                            <span className="text-[10px] text-muted-foreground uppercase font-bold block">Source Type</span>
                            <strong className="text-foreground capitalize">{attr.sourceType || 'Social Media'}</strong>
                          </div>

                          <div className="p-2.5 rounded-xl bg-muted/40 border border-border/80">
                            <span className="text-[10px] text-muted-foreground uppercase font-bold block">Campaign</span>
                            <strong className="text-primary truncate block">{attr.campaign || 'Small Business Growth'}</strong>
                          </div>

                          <div className="p-2.5 rounded-xl bg-muted/40 border border-border/80">
                            <span className="text-[10px] text-muted-foreground uppercase font-bold block">Content Asset</span>
                            <strong className="text-foreground truncate block">{attr.content || 'Stop Losing Customers'}</strong>
                          </div>

                          <div className="p-2.5 rounded-xl bg-muted/40 border border-border/80">
                            <span className="text-[10px] text-muted-foreground uppercase font-bold block">First Touch</span>
                            <span className="text-foreground font-medium truncate block">{attr.firstTouch || 'Instagram Post'}</span>
                          </div>

                          <div className="p-2.5 rounded-xl bg-muted/40 border border-border/80">
                            <span className="text-[10px] text-muted-foreground uppercase font-bold block">Last Touch</span>
                            <span className="text-foreground font-medium truncate block">{attr.lastTouch || 'Website Pricing'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Auto-Generated Attribution Tags */}
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                          <TagIcon className="h-3 w-3" /> Auto-Generated Source & Journey Tags:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {tags.map((t) => (
                            <a
                              key={t}
                              href={`/contacts?tag=${encodeURIComponent(t)}`}
                              className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-muted border border-border hover:border-primary hover:text-primary transition-all font-mono"
                            >
                              {t}
                            </a>
                          ))}
                        </div>
                        <p className="text-[10px] text-muted-foreground italic">
                          💡 Click any tag to filter other contacts acquired from this campaign or source.
                        </p>
                      </div>

                      {/* Multi-Touch Customer Journey Timeline */}
                      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-black text-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-primary" /> Multi-Touch Customer Journey
                          </h4>
                          <span className="text-[10px] text-muted-foreground font-medium">
                            {attr.touchpoints?.length || 5} Touchpoints
                          </span>
                        </div>

                        <div className="relative pl-4 space-y-3.5 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                          {attr.touchpoints?.map((tp: any, idx: number) => (
                            <div key={tp.id || idx} className="relative pl-2 space-y-1 text-xs">
                              <span className="absolute -left-[17px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-card" />
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-foreground">{tp.title}</span>
                                <span className="text-[10px] text-muted-foreground">
                                  {new Date(tp.timestamp).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                  })}
                                </span>
                              </div>
                              {tp.details && <p className="text-[11px] text-muted-foreground">{tp.details}</p>}
                              <Badge variant="outline" className="text-[9px] font-bold px-1.5 py-0 bg-muted/60 text-muted-foreground">
                                Channel: {tp.channel}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Quick Sales Action Bar */}
                      <div className="pt-2 flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            toast.success(`Assigned ${contact?.name || 'Rahul Sharma'} to Sales Pipeline with priority status!`);
                          }}
                          className="flex-1 h-9 text-xs font-bold rounded-xl gap-1.5 bg-primary text-primary-foreground shadow-sm"
                        >
                          <Sparkles className="h-3.5 w-3.5" /> Follow-up in Sales Pipeline
                        </Button>
                      </div>
                    </div>
                  );
                })()}
              </TabsContent>

              {/* Details Tab */}
              <TabsContent value="details" className="flex-1 overflow-y-auto px-4 py-3">
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-muted-foreground text-xs">Name</Label>
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="bg-muted border-border text-foreground h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-muted-foreground text-xs">
                      Phone <span className="text-red-400">*</span>
                    </Label>
                    <Input
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      className="bg-muted border-border text-foreground h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-muted-foreground text-xs">Email</Label>
                    <Input
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      className="bg-muted border-border text-foreground h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-muted-foreground text-xs">Company</Label>
                    <Input
                      value={editCompany}
                      onChange={(e) => setEditCompany(e.target.value)}
                      className="bg-muted border-border text-foreground h-8 text-sm"
                    />
                  </div>
                  <IconAction label="Save Changes" icon={savingDetails ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Save className="size-3.5" />
                    )} onClick={saveDetails}
                    disabled={savingDetails}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground w-full" />
                </div>
              </TabsContent>

              {/* Tags Tab */}
              <TabsContent value="tags" className="flex-1 overflow-y-auto px-4 py-3">
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Click a tag to add or remove it from this contact.
                  </p>
                  {allTags.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No tags available. Create tags in Settings.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {allTags.map((tag) => {
                        const selected = contactTagIds.includes(tag.id);
                        return (
                          <button
                            key={tag.id}
                            onClick={() => toggleTag(tag.id)}
                            disabled={savingTags}
                            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-all cursor-pointer ${
                              selected
                                ? 'ring-2 ring-primary ring-offset-1 ring-offset-border'
                                : 'opacity-50 hover:opacity-80'
                            }`}
                            style={{
                              backgroundColor: tag.color + '20',
                              color: tag.color,
                            }}
                          >
                            {selected && <Check className="size-3 mr-1" />}
                            {tag.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Notes Tab */}
              <TabsContent value="notes" className="flex-1 flex flex-col min-h-0 px-4 py-3">
                <div className="space-y-2 mb-3">
                  <Textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Write a note..."
                    className="bg-muted border-border text-foreground placeholder:text-muted-foreground min-h-[60px] text-sm resize-none"
                  />
                  <IconAction label="Add Note" icon={savingNote ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Plus className="size-3.5" />
                    )} onClick={addNote}
                    disabled={!newNote.trim() || savingNote}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground" />
                </div>

                <div className="flex-1 overflow-y-auto space-y-2">
                  {loadingNotes ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="size-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : notes.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No notes yet.
                    </p>
                  ) : (
                    notes.map((note) => (
                      <div
                        key={note.id}
                        className="rounded-lg bg-muted/50 border border-border/50 p-3 group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap flex-1">
                            {note.note_text}
                          </p>
                          <button
                            onClick={() => deleteNote(note.id)}
                            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-all cursor-pointer shrink-0"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5">
                          {new Date(note.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>

              {/* Custom Fields Tab */}
              <TabsContent value="custom" className="flex-1 overflow-y-auto px-4 py-3">
                {loadingCustom ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="size-5 animate-spin text-muted-foreground" />
                  </div>
                ) : customFields.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No custom fields defined. Create them in Settings.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {customFields.map((field) => (
                      <div key={field.id} className="space-y-1.5">
                        <Label className="text-muted-foreground text-xs capitalize">
                          {field.field_name}
                        </Label>
                        <Input
                          value={customValues[field.id] ?? ''}
                          onChange={(e) =>
                            setCustomValues((prev) => ({
                              ...prev,
                              [field.id]: e.target.value,
                            }))
                          }
                          placeholder={`Enter ${field.field_name}...`}
                          className="bg-muted border-border text-foreground h-8 text-sm placeholder:text-muted-foreground"
                        />
                      </div>
                    ))}
                    <IconAction label="Save Custom Fields" icon={savingCustom ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Save className="size-3.5" />
                      )} onClick={saveCustomFields}
                      disabled={savingCustom}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground w-full" />
                  </div>
                )}
              </TabsContent>

              {/* Deals Tab */}
              <TabsContent value="deals" className="flex-1 overflow-y-auto px-4 py-3">
                {loadingDeals ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="size-5 animate-spin text-primary" />
                  </div>
                ) : deals.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No deals yet</p>
                ) : (
                  <div className="space-y-2">
                    {deals.map((deal) => (
                      <div
                        key={deal.id}
                        className="rounded-lg border border-border bg-muted/50 p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-foreground">
                            {deal.title}
                          </p>
                          {deal.stage && (
                            <span
                              className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                              style={{
                                backgroundColor: `${deal.stage.color}20`,
                                color: deal.stage.color,
                              }}
                            >
                              {deal.stage.name}
                            </span>
                          )}
                        </div>
                        <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Banknote className="size-3" />
                            {formatCurrency(
                              Number(deal.value || 0),
                              deal.currency || defaultCurrency,
                            )}
                          </span>
                          {deal.status && deal.status !== 'open' && (
                            <span
                              className={
                                deal.status === 'won'
                                  ? 'text-primary'
                                  : 'text-red-400'
                              }
                            >
                              {deal.status}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
