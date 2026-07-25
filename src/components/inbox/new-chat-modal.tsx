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
      <DialogContent className="sm:max-w-[480px] bg-slate-900 border-slate-800 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <MessageSquare className="h-5 w-5 text-[#00aef0]" />
            Start New Chat
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Select an existing contact or enter a phone number to start messaging on WhatsApp.
          </DialogDescription>
        </DialogHeader>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-800 my-2">
          <button
            type="button"
            onClick={() => setTab("existing")}
            className={cn(
              "flex-1 pb-2 text-xs font-semibold border-b-2 transition-colors",
              tab === "existing"
                ? "border-[#00aef0] text-[#00aef0]"
                : "border-transparent text-slate-400 hover:text-slate-200"
            )}
          >
            Select Existing Contact
          </button>
          <button
            type="button"
            onClick={() => setTab("new")}
            className={cn(
              "flex-1 pb-2 text-xs font-semibold border-b-2 transition-colors flex items-center justify-center gap-1.5",
              tab === "new"
                ? "border-[#00aef0] text-[#00aef0]"
                : "border-transparent text-slate-400 hover:text-slate-200"
            )}
          >
            <UserPlus className="h-3.5 w-3.5" />
            New Phone Number
          </button>
        </div>

        {tab === "existing" ? (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or phone..."
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 pl-9"
              />
            </div>

            <div className="max-h-[260px] overflow-y-auto space-y-1 pr-1">
              {loadingContacts ? (
                <div className="flex items-center justify-center py-8 text-slate-400">
                  <Loader2 className="h-5 w-5 animate-spin text-[#00aef0] mr-2" />
                  Loading contacts...
                </div>
              ) : filteredContacts.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-sm">
                  {contacts.length === 0
                    ? "No contacts found in this workspace yet."
                    : "No matching contacts."}
                  <div className="mt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setTab("new")}
                      className="border-slate-700 text-slate-300 hover:text-white"
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
                    className="flex w-full items-center justify-between p-2.5 rounded-lg bg-slate-800/40 hover:bg-slate-800 border border-slate-800/60 hover:border-slate-700 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#00aef0]/10 text-sm font-semibold text-[#00aef0]">
                        {(c.name || c.phone || "C").charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {c.name || c.phone}
                        </p>
                        <p className="text-xs text-slate-400 truncate flex items-center gap-1">
                          <Phone className="h-3 w-3 text-slate-500" />
                          {c.phone}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-[#00aef0] hover:text-[#00aef0] hover:bg-[#00aef0]/10 shrink-0"
                    >
                      Chat
                    </Button>
                  </button>
                ))
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreateNewContactAndChat} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Phone Number (Required)</Label>
              <Input
                type="tel"
                placeholder="e.g. +919876543210 or +14155552671"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                required
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 font-mono text-sm"
              />
              <p className="text-[11px] text-slate-500">
                Must include country code (e.g. +91 for India, +1 for US/Canada).
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Contact Name (Optional)</Label>
              <Input
                placeholder="e.g. Rahul Sharma"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Email Address (Optional)</Label>
              <Input
                type="email"
                placeholder="e.g. rahul@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 text-sm"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="text-slate-400 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting || !newPhone.trim()}
                className="bg-[#00aef0] hover:bg-[#00aef0]/90 text-white"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Starting...
                  </>
                ) : (
                  <>
                    <MessageSquare className="h-4 w-4 mr-2" />
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
