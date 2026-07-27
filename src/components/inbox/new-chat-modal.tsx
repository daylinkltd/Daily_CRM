"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Conversation, Contact } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Loader2, UserPlus, MessageSquare, Phone } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface NewChatModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string | undefined;
  onConversationCreated: (conversation: Conversation) => void;
}

export function NewChatModal({
  open,
  onOpenChange,
  workspaceId,
  onConversationCreated,
}: NewChatModalProps) {
  const [tab, setTab] = useState<"existing" | "new">("existing");
  const [search, setSearch] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // New Contact form fields
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");

  useEffect(() => {
    if (!open || !workspaceId) return;

    let cancelled = false;
    const fetchContacts = async () => {
      setLoadingContacts(true);
      const supabase = createClient();
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("name", { ascending: true })
        .limit(100);

      if (cancelled) return;
      if (error) {
        console.error("Failed to fetch contacts:", error);
      } else {
        setContacts(data ?? []);
      }
      setLoadingContacts(false);
    };

    fetchContacts();

    return () => {
      cancelled = true;
    };
  }, [open, workspaceId]);

  const filteredContacts = contacts.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.phone && c.phone.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q))
    );
  });

  const handleStartChatWithContact = async (contactId: string) => {
    if (!workspaceId) {
      toast.error("No active workspace selected");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/conversations/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: workspaceId,
          contact_id: contactId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to start chat");
        return;
      }

      toast.success(
        data.isNew ? "New conversation started" : "Conversation opened"
      );
      onConversationCreated(data.conversation);
      onOpenChange(false);
    } catch (err) {
      console.error("Error starting chat:", err);
      toast.error("Failed to start conversation");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateNewContactAndChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId) {
      toast.error("No active workspace selected");
      return;
    }
    if (!newPhone.trim()) {
      toast.error("Phone number is required");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/conversations/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: workspaceId,
          name: newName.trim(),
          phone: newPhone.trim(),
          email: newEmail.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to start chat");
        return;
      }

      toast.success("New conversation started");
      onConversationCreated(data.conversation);
      // Reset form
      setNewName("");
      setNewPhone("");
      setNewEmail("");
      onOpenChange(false);
    } catch (err) {
      console.error("Error creating contact and starting chat:", err);
      toast.error("Failed to start conversation");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-[460px] p-5 sm:p-6 bg-card text-card-foreground border border-border shadow-xl rounded-xl overflow-hidden">
        <DialogHeader className="p-0 text-left space-y-1">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
            <MessageSquare className="h-5 w-5 text-primary shrink-0" />
            Start New Chat
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Select an existing contact or enter a phone number to start messaging on WhatsApp.
          </DialogDescription>
        </DialogHeader>

        {/* Tab Selection */}
        <div className="flex border-b border-border my-3">
          <button
            type="button"
            onClick={() => setTab("existing")}
            className={cn(
              "flex-1 pb-2 text-xs font-medium border-b-2 transition-colors text-center truncate px-1",
              tab === "existing"
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Select Existing Contact
          </button>
          <button
            type="button"
            onClick={() => setTab("new")}
            className={cn(
              "flex-1 pb-2 text-xs font-medium border-b-2 transition-colors flex items-center justify-center gap-1.5 truncate px-1",
              tab === "new"
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <UserPlus className="h-3.5 w-3.5 shrink-0" />
            New Phone Number
          </button>
        </div>

        {tab === "existing" ? (
          <div className="space-y-3 min-w-0">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or phone..."
                className="w-full bg-muted/50 border-input text-foreground placeholder:text-muted-foreground pl-9 text-xs sm:text-sm h-9 focus-visible:ring-1 focus-visible:ring-primary"
              />
            </div>

            <div className="max-h-[260px] overflow-y-auto space-y-1.5 pr-1 min-w-0">
              {loadingContacts ? (
                <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-primary mr-2" />
                  Loading contacts...
                </div>
              ) : filteredContacts.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-xs space-y-2">
                  <p>
                    {contacts.length === 0
                      ? "No contacts found in this workspace yet."
                      : "No matching contacts."}
                  </p>
                  <div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setTab("new")}
                      className="border-border text-foreground hover:bg-muted text-xs h-8"
                    >
                      <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Enter New Phone Number
                    </Button>
                  </div>
                </div>
              ) : (
                filteredContacts.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    disabled={submitting}
                    onClick={() => handleStartChatWithContact(c.id)}
                    className="flex w-full items-center justify-between p-2.5 rounded-lg bg-muted/40 hover:bg-muted border border-border/50 transition-colors text-left gap-3 min-w-0 group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {(c.name || c.phone || "C").charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-foreground truncate">
                          {c.name || c.phone}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                          <Phone className="h-3 w-3 shrink-0 text-muted-foreground/70" />
                          <span className="truncate">{c.phone}</span>
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-primary hover:text-primary hover:bg-primary/10 shrink-0 text-xs h-7 px-2 font-medium"
                    >
                      Chat
                    </Button>
                  </button>
                ))
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreateNewContactAndChat} className="space-y-3.5 min-w-0">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">
                Phone Number <span className="text-destructive">*</span>
              </Label>
              <Input
                type="tel"
                placeholder="e.g. +919876543210 or +14155552671"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                required
                className="bg-muted/50 border-input text-foreground placeholder:text-muted-foreground font-mono text-xs sm:text-sm h-9 focus-visible:ring-1 focus-visible:ring-primary"
              />
              <p className="text-[11px] text-muted-foreground">
                Must include country code (e.g. +91 for India, +1 for US/Canada).
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Contact Name (Optional)</Label>
              <Input
                placeholder="e.g. Rahul Sharma"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="bg-muted/50 border-input text-foreground placeholder:text-muted-foreground text-xs sm:text-sm h-9 focus-visible:ring-1 focus-visible:ring-primary"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Email Address (Optional)</Label>
              <Input
                type="email"
                placeholder="e.g. rahul@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="bg-muted/50 border-input text-foreground placeholder:text-muted-foreground text-xs sm:text-sm h-9 focus-visible:ring-1 focus-visible:ring-primary"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="text-xs h-8 text-muted-foreground hover:text-foreground"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting || !newPhone.trim()}
                className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs h-8 px-3 font-medium"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    Starting...
                  </>
                ) : (
                  <>
                    <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                    Start Chat
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
