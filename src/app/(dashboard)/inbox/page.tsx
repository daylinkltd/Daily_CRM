"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Conversation, Message, Contact, ConversationStatus } from "@/types";
import { useRealtime } from "@/hooks/use-realtime";
import { useWorkspace } from "@/hooks/use-workspace";
import { ConversationList } from "@/components/inbox/conversation-list";
import { MessageThread } from "@/components/inbox/message-thread";
import { ContactSidebar } from "@/components/inbox/contact-sidebar";
import { NewChatModal } from "@/components/inbox/new-chat-modal";
import { toast } from "sonner";
import { useMessageNotifications } from "@/hooks/use-message-notifications";
import { WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

export default function InboxPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeWorkspace } = useWorkspace();
  /**
   * `?c=<id>` deep-link support. Used when landing here from the
   * dashboard's recent-conversations list so the right thread opens
   * automatically instead of showing the empty center panel.
   */
  const deepLinkConvId = searchParams.get("c");

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] =
    useState<Conversation | null>(null);
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [whatsappConnected, setWhatsappConnected] = useState<boolean | null>(
    null
  );
  const [newChatModalOpen, setNewChatModalOpen] = useState(false);
  // Whether the workspace's chatbot feature is enabled in Settings.
  // Gates the per-conversation bot toggle/indicators — showing a bot
  // pause/resume control while the chatbot is off is just noise.
  const [chatbotEnabled, setChatbotEnabled] = useState(false);

  useEffect(() => {
    const workspaceId = activeWorkspace?.id;
    if (!workspaceId) {
      setChatbotEnabled(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/whatsapp/chatbot-config?workspace_id=${workspaceId}`
        );
        if (!res.ok) return;
        const config = await res.json();
        if (!cancelled) setChatbotEnabled(!!config?.is_enabled);
      } catch {
        // Leave the toggle hidden when the config can't be fetched.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeWorkspace?.id]);

  // Fire the deep-link auto-select exactly once per URL — subsequent
  // list refreshes (realtime, manual refetch) must not snap the user
  // back to the deep-linked conversation if they've already clicked
  // elsewhere.
  const autoSelectedForDeepLinkRef = useRef<string | null>(null);

  // Mirror of `conversations` for callbacks that must not be recreated
  // when the list changes (the notification click handler).
  const conversationsRef = useRef<Conversation[]>([]);
  useEffect(() => {
    conversationsRef.current = conversations;
  });

  /** Open a thread by id — used when a desktop notification is clicked. */
  const openConversationById = useCallback(
    (conversationId: string) => {
      const match = conversationsRef.current.find(
        (c) => c.id === conversationId
      );
      if (!match) return;
      setActiveConversation(match);
      setActiveContact(match.contact ?? null);
      setMessages([]);
      autoSelectedForDeepLinkRef.current = conversationId;
      router.replace(`/inbox?c=${conversationId}`, { scroll: false });
    },
    [router]
  );

  const {
    enabled: notificationsEnabled,
    permission: notificationPermission,
    toggle: toggleNotifications,
    notify,
  } = useMessageNotifications({ onOpenConversation: openConversationById });

  // Check WhatsApp connection status on mount
  useEffect(() => {
    const checkConnection = async () => {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;

      if (!user) return;

      // Table is `whatsapp_config` (singular) — the previous "whatsapp_configs"
      // query always returned no rows, so the banner always showed "not connected".
      const { data } = await supabase
        .from("whatsapp_config")
        .select("status")
        .eq("user_id", user.id)
        .maybeSingle();

      setWhatsappConnected(data?.status === "connected");
    };

    checkConnection();
  }, []);

  // Handle realtime message events
  const handleMessageEvent = useCallback(
    (event: { eventType: string; new: Message; old: Partial<Message> }) => {
      const newMsg = event.new;

      if (event.eventType === "INSERT") {
        // Add to messages if it belongs to active conversation
        if (
          activeConversation &&
          newMsg.conversation_id === activeConversation.id
        ) {
          setMessages((prev) => {
            // Avoid duplicates
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            // Drop only the optimistic bubble this message replaces —
            // clearing every temp- row would delete other in-flight
            // sends (and failed ones the user still needs to see).
            const withoutOptimistic = prev.filter(
              (m) =>
                !m.id.startsWith("temp-") ||
                m.content_type !== newMsg.content_type ||
                (m.content_text ?? "") !== (newMsg.content_text ?? "")
            );
            return [...withoutOptimistic, newMsg];
          });
        }

        // Alert on inbound customer messages. Skipped when the user is
        // already looking at that thread in a focused tab — they can
        // see it arrive.
        const isInbound = newMsg.sender_type === "customer";
        const isViewingThread =
          activeConversation?.id === newMsg.conversation_id &&
          typeof document !== "undefined" &&
          !document.hidden;
        if (isInbound && !isViewingThread) {
          const contactName =
            conversations.find((c) => c.id === newMsg.conversation_id)?.contact
              ?.name ?? "New message";
          notify({
            id: newMsg.id,
            title: contactName,
            body: newMsg.content_text?.slice(0, 140) || "Sent an attachment",
            conversationId: newMsg.conversation_id,
          });
        }

        // Update conversation list preview
        setConversations((prev) =>
          prev.map((c) =>
            c.id === newMsg.conversation_id
              ? {
                  ...c,
                  last_message_text: newMsg.content_text ?? "",
                  last_message_at: newMsg.created_at,
                  unread_count:
                    activeConversation?.id === newMsg.conversation_id
                      ? 0
                      : c.unread_count + 1,
                }
              : c
          )
        );
      }

      if (event.eventType === "UPDATE") {
        // Update message status
        setMessages((prev) =>
          prev.map((m) => (m.id === newMsg.id ? { ...m, ...newMsg } : m))
        );
      }
    },
    [activeConversation, conversations, notify]
  );

  // Handle realtime conversation events
  const handleConversationEvent = useCallback(
    (event: {
      eventType: string;
      new: Conversation;
      old: Partial<Conversation>;
    }) => {
      const conv = event.new;

      if (event.eventType === "INSERT") {
        setConversations((prev) => [conv, ...prev]);
      }

      if (event.eventType === "UPDATE") {
        setConversations((prev) =>
          prev.map((c) => (c.id === conv.id ? { ...c, ...conv } : c))
        );

        // Update active conversation if it changed
        if (activeConversation && conv.id === activeConversation.id) {
          setActiveConversation((prev) =>
            prev ? { ...prev, ...conv } : prev
          );
        }
      }
    },
    [activeConversation]
  );

  // Subscribe to realtime
  useRealtime({
    channelName: "inbox-realtime",
    onMessageEvent: handleMessageEvent,
    onConversationEvent: handleConversationEvent,
    enabled: true,
  });

  const handleConversationsLoaded = useCallback(
    (loaded: Conversation[]) => {
      // The thread the user is reading is read by definition. Without
      // this, a poll that lands before the server-side unread reset is
      // visible re-shows the badge on the conversation they're looking
      // at, so it blinks back on every refresh.
      const activeId = activeConversation?.id;
      setConversations(
        activeId
          ? loaded.map((c) =>
              c.id === activeId && c.unread_count > 0
                ? { ...c, unread_count: 0 }
                : c,
            )
          : loaded,
      );
      // Resolve a pending deep-link here rather than in an effect — this
      // is an event handler, so the setState calls below are allowed by
      // react-hooks/set-state-in-effect. Runs once per ?c=<id> URL value
      // via the ref, so realtime refreshes of the list can't snap the
      // user back to the deep-linked thread after they've navigated.
      // Only ever auto-select when NOTHING is open yet — i.e. on arrival
      // via a ?c=<id> link. Previously this fired whenever the ref
      // didn't match `deepLinkConvId`, which broke starting a new chat:
      // selecting it calls router.replace(?c=<new>), but `deepLinkConvId`
      // still reads the OLD id for a tick, so the next list poll saw
      // ref(new) !== deepLink(old) and yanked the user back into the
      // previous conversation.
      if (
        deepLinkConvId &&
        !activeConversation &&
        autoSelectedForDeepLinkRef.current !== deepLinkConvId &&
        loaded.length > 0
      ) {
        autoSelectedForDeepLinkRef.current = deepLinkConvId;
        // Nothing is open at this point (guarded above), so applying the
        // deep link can't clobber an already-loaded thread's messages.
        const match = loaded.find((c) => c.id === deepLinkConvId);
        if (match) {
          setActiveConversation(match);
          setActiveContact(match.contact ?? null);
          setMessages([]);
        }
      }
    },
    [deepLinkConvId, activeConversation?.id]
  );

  const handleSelectConversation = useCallback(
    (conv: Conversation) => {
      // Re-clicking the already-active conversation would clear the
      // messages array, but the fetch effect in MessageThread only re-runs
      // when conversationId changes — so messages would stay empty until
      // the user navigated away and back. Bail out early instead.
      if (activeConversation?.id === conv.id) return;
      setActiveConversation(conv);
      setActiveContact(conv.contact ?? null);
      setMessages([]);
      // Optimistically clear the unread badge for the opened thread —
      // MessageThread resets the server-side unread_count, but waiting
      // for realtime/polling to echo that back leaves the badge lingering
      // for a few seconds after the user has already opened the chat.
      if (conv.unread_count > 0) {
        setConversations((prev) =>
          prev.map((c) => (c.id === conv.id ? { ...c, unread_count: 0 } : c))
        );
      }
      // Record the selection on the deep-link ref BEFORE we change the
      // URL. The router.replace below flips `deepLinkConvId`, which can
      // in turn cause ConversationList to refetch and eventually call
      // handleConversationsLoaded again. Without this line, the ref
      // still points at the previous value, the auto-select block
      // sees `ref !== deepLinkConvId`, fires a second time, and
      // clobbers the messages MessageThread just fetched.
      autoSelectedForDeepLinkRef.current = conv.id;
      // Reflect the selection in the URL so a refresh lands the user
      // back in the same thread, and so copy-paste links work. Use
      // replace() to avoid polluting browser history with every click.
      router.replace(`/inbox?c=${conv.id}`, { scroll: false });
    },
    [activeConversation?.id, router]
  );

  // Mobile "back" — deselect the conversation so the list pane comes
  // back. Also clears the ?c= param so a refresh lands on the list
  // instead of re-opening the thread the user just backed out of.
  const handleCloseConversation = useCallback(() => {
    setActiveConversation(null);
    setActiveContact(null);
    setMessages([]);
    // Clearing the ref lets the deep-link auto-selector fire again if
    // the user later visits /inbox?c=<same-id> — desirable UX.
    autoSelectedForDeepLinkRef.current = null;
    router.replace("/inbox", { scroll: false });
  }, [router]);


  /**
   * Merge a freshly-fetched server list with any optimistic messages
   * still in flight.
   *
   * A plain `setMessages(loaded)` was why a just-sent (or just-received)
   * bubble appeared, vanished for a second, then came back: the send
   * inserts a `temp-…` bubble immediately, a poll that lands before the
   * row is readable returns a list without it, and replacing the array
   * wholesale deleted the bubble until the next poll saw the real row.
   *
   * Optimistic bubbles are kept until the server list contains an
   * equivalent message (same kind + text), so a failed send also stays
   * put with its error state instead of silently disappearing.
   */
  const handleMessagesLoaded = useCallback((loaded: Message[]) => {
    setMessages((prev) => {
      const pending = prev.filter((m) => m.id.startsWith("temp-"));
      if (pending.length === 0) return loaded;

      const serverKeys = new Set(
        loaded.map((m) => `${m.content_type}|${m.content_text ?? ""}`),
      );
      const stillPending = pending.filter(
        (m) => !serverKeys.has(`${m.content_type}|${m.content_text ?? ""}`),
      );
      return stillPending.length > 0 ? [...loaded, ...stillPending] : loaded;
    });
  }, []);

  const handleNewMessage = useCallback((msg: Message) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
  }, []);

  const handleUpdateMessage = useCallback(
    (id: string, updates: Partial<Message>) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, ...updates } : m))
      );
    },
    []
  );

  const handleStatusChange = useCallback(
    (conversationId: string, status: ConversationStatus) => {
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, status } : c))
      );
      if (activeConversation?.id === conversationId) {
        setActiveConversation((prev) => (prev ? { ...prev, status } : prev));
      }
    },
    [activeConversation]
  );

  const handleAssignChange = useCallback(
    (conversationId: string, assignedAgentId: string | null) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? { ...c, assigned_agent_id: assignedAgentId ?? undefined }
            : c
        )
      );
      if (activeConversation?.id === conversationId) {
        setActiveConversation((prev) =>
          prev
            ? { ...prev, assigned_agent_id: assignedAgentId ?? undefined }
            : prev
        );
      }
    },
    [activeConversation]
  );

  const handleConversationCreated = useCallback(
    (conv: Conversation) => {
      setConversations((prev) => {
        if (prev.some((c) => c.id === conv.id)) return prev;
        return [conv, ...prev];
      });
      handleSelectConversation(conv);
    },
    [handleSelectConversation]
  );

  const handleDeleteConversation = useCallback(
    async (conversationId: string) => {
      if (!confirm("Are you sure you want to delete this conversation? All messages in this chat will be permanently removed.")) {
        return;
      }

      try {
        const res = await fetch(`/api/conversations/${conversationId}`, {
          method: "DELETE",
        });

        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || "Failed to delete conversation");
          return;
        }

        toast.success("Conversation deleted");
        setConversations((prev) => prev.filter((c) => c.id !== conversationId));
        if (activeConversation?.id === conversationId) {
          setActiveConversation(null);
          setActiveContact(null);
          setMessages([]);
        }
      } catch (err) {
        console.error("Error deleting conversation:", err);
        toast.error("Failed to delete conversation");
      }
    },
    [activeConversation?.id]
  );

  // On mobile (<lg) we show a SINGLE pane — either the list or the
  // thread — rather than cramming both side-by-side. Selecting a
  // conversation slides the thread in; the thread's back button pops
  // it back to the list. On lg+ both panes render side-by-side as
  // before, unchanged.
  const hasActiveConv = !!activeConversation;

  return (
    <div className="-m-4 flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden sm:-m-6">
      {/* WhatsApp connection banner — in the flex column, not absolute,
          so it pushes the panels down instead of overlapping them. */}
      {whatsappConnected === false && (
        <div className="flex shrink-0 items-center justify-center gap-2 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2">
          <WifiOff className="h-4 w-4 text-amber-400" />
          <p className="text-xs text-amber-400">
            WhatsApp® is not connected. Go to Settings to connect your account.
          </p>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel: Conversation list.
            Hidden on mobile when a conversation is selected so the
            thread can occupy the full width. Always visible on lg+. */}
        <div
          className={cn(
            "flex h-full flex-1 lg:flex-none",
            hasActiveConv ? "hidden lg:flex" : "flex",
          )}
        >
          <ConversationList
            activeConversationId={activeConversation?.id ?? null}
            onSelect={handleSelectConversation}
            conversations={conversations}
            onConversationsLoaded={handleConversationsLoaded}
            workspaceId={activeWorkspace?.id}
            onOpenNewChat={() => setNewChatModalOpen(true)}
            onDeleteConversation={handleDeleteConversation}
            chatbotEnabled={chatbotEnabled}
            notificationsEnabled={notificationsEnabled}
            notificationPermission={notificationPermission}
            onToggleNotifications={toggleNotifications}
          />
        </div>

        {/* Center panel: Message thread.
            Hidden on mobile when no conversation is selected so the
            list can occupy the full width. Always visible on lg+
            (shows its own empty-state if no thread is picked yet). */}
        <div
          className={cn(
            "flex h-full flex-1 lg:flex",
            hasActiveConv ? "flex" : "hidden lg:flex",
          )}
        >
          <MessageThread
            conversation={activeConversation}
            contact={activeContact}
            messages={messages}
            onMessagesLoaded={handleMessagesLoaded}
            onNewMessage={handleNewMessage}
            onUpdateMessage={handleUpdateMessage}
            onStatusChange={handleStatusChange}
            onAssignChange={handleAssignChange}
            onBack={handleCloseConversation}
            onOpenNewChat={() => setNewChatModalOpen(true)}
            onDeleteConversation={handleDeleteConversation}
            chatbotEnabled={chatbotEnabled}
          />
        </div>

        {/* Right panel: Contact sidebar — desktop only. */}
        <div className="hidden lg:block">
          <ContactSidebar contact={activeContact} />
        </div>
      </div>

      <NewChatModal
        open={newChatModalOpen}
        onOpenChange={setNewChatModalOpen}
        workspaceId={activeWorkspace?.id}
        onConversationCreated={handleConversationCreated}
      />
    </div>
  );
}
