"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  useVisibleInterval,
  REALTIME_BACKUP_POLL_MS,
} from "@/hooks/use-visible-interval";
import { cn } from "@/lib/utils";
import type { Conversation, ConversationStatus } from "@/types";
import { Search, ChevronDown, Bot, Trash2, Bell, BellOff } from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  contactDisplayName,
  contactInitial,
} from "@/lib/contact-display";

interface ConversationListProps {
  activeConversationId: string | null;
  onSelect: (conversation: Conversation) => void;
  conversations: Conversation[];
  onConversationsLoaded: (conversations: Conversation[]) => void;
  workspaceId?: string;
  onOpenNewChat?: () => void;
  /** Message-alert controls (sound + desktop notifications). */
  notificationsEnabled?: boolean;
  notificationPermission?: string;
  onToggleNotifications?: () => void | Promise<void>;
  onDeleteConversation?: (conversationId: string) => void;
  /**
   * Increment to force the fetch effect below to refire. The parent
   * bumps this on realtime reconnect / tab visibility → visible so the
   * list catches up on any events sent while the WS was disconnected
   * or the tab was throttled. Optional so existing callers keep working.
   */
  resyncToken?: number;
  /**
   * Whether the workspace's chatbot feature is enabled — the per-row
   * bot status icon is only rendered when true.
   */
  chatbotEnabled?: boolean;
}

const STATUS_COLORS: Record<ConversationStatus, string> = {
  open: "bg-primary",
  pending: "bg-amber-500",
  closed: "bg-muted-foreground",
};

type InboxFilter = ConversationStatus | "all" | "unread";

/**
 * WhatsApp-style row timestamp: clock time today, "Yesterday", then a
 * compact date — tighter and more scannable than the previous
 * "about 3 hours" relative phrasing.
 */
function formatRowTimestamp(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return format(date, "HH:mm");
  if (isYesterday(date)) return "Yesterday";
  return format(date, "dd/MM/yyyy");
}

const FILTER_OPTIONS: { label: string; value: InboxFilter }[] = [
  { label: "All", value: "all" },
  { label: "Unread", value: "unread" },
  { label: "Open", value: "open" },
  { label: "Pending", value: "pending" },
  { label: "Closed", value: "closed" },
];

export function ConversationList({
  activeConversationId,
  onSelect,
  conversations,
  onConversationsLoaded,
  workspaceId,
  onOpenNewChat,
  notificationsEnabled = false,
  notificationPermission,
  onToggleNotifications,
  onDeleteConversation,
  resyncToken = 0,
  chatbotEnabled = false,
}: ConversationListProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [loading, setLoading] = useState(true);

  const onConversationsLoadedRef = useRef(onConversationsLoaded);
  useEffect(() => {
    onConversationsLoadedRef.current = onConversationsLoaded;
  });

  const fetchConvs = useCallback(async () => {
    if (!workspaceId) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/conversations?workspace_id=${workspaceId}`);
      const payload = await res.json();

      if (res.ok && Array.isArray(payload.conversations)) {
        onConversationsLoadedRef.current(payload.conversations);
        setLoading(false);
        return;
      }
    } catch (err) {
      console.warn("[ConversationList] API fetch failed, trying direct query:", err);
    }

    const supabase = createClient();
    const { data, error } = await supabase
      .from("conversations")
      .select("*, contact:contacts(*)")
      .eq("workspace_id", workspaceId)
      .order("last_message_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch conversations:", error);
      setLoading(false);
      return;
    }

    onConversationsLoadedRef.current(data ?? []);
    setLoading(false);
    // resyncToken is a deliberate dependency: bumping it forces a refetch.
  }, [workspaceId, resyncToken]);

  // Realtime carries the live updates; this is the catch-up net. Paused
  // while the tab is hidden and re-run the moment it's focused again,
  // so an idle tab costs nothing (it used to poll every 4s forever).
  useVisibleInterval(fetchConvs, REALTIME_BACKUP_POLL_MS, {
    enabled: Boolean(workspaceId),
  });

  const filtered = useMemo(() => {
    let result = conversations;

    if (filter === "unread") {
      result = result.filter((c) => c.unread_count > 0);
    } else if (filter !== "all") {
      result = result.filter((c) => c.status === filter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((c) => {
        const name = c.contact?.name?.toLowerCase() ?? "";
        const phone = c.contact?.phone?.toLowerCase() ?? "";
        const lastMsg = c.last_message_text?.toLowerCase() ?? "";
        return name.includes(q) || phone.includes(q) || lastMsg.includes(q);
      });
    }

    return result;
  }, [conversations, filter, search]);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearch(e.target.value);
    },
    []
  );

  const handleSelect = useCallback(
    (conv: Conversation) => {
      onSelect(conv);
    },
    [onSelect]
  );

  const activeFilter = FILTER_OPTIONS.find((o) => o.value === filter);

  return (
    <div className="flex h-full w-full flex-col border-r border-border bg-card lg:w-80">
      {/* Search + Filter + New Chat */}
      <div className="space-y-2 border-b border-border p-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={handleSearchChange}
              placeholder="Search..."
              className="border-border bg-muted pl-9 text-sm text-foreground placeholder-muted-foreground focus:border-primary/50 h-9"
            />
          </div>
          {onToggleNotifications && (
            <button
              type="button"
              onClick={() => void onToggleNotifications()}
              aria-pressed={notificationsEnabled}
              title={
                notificationPermission === "denied"
                  ? "Notifications are blocked for this site — re-enable them in your browser's site settings"
                  : notificationsEnabled
                    ? "Message alerts on — click to mute"
                    : "Message alerts off — click to enable sound and desktop notifications"
              }
              className={cn(
                "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                notificationsEnabled
                  ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
                  : "border-border bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {notificationsEnabled ? (
                <Bell className="h-4 w-4" />
              ) : (
                <BellOff className="h-4 w-4" />
              )}
              <span className="sr-only">
                {notificationsEnabled
                  ? "Mute message alerts"
                  : "Enable message alerts"}
              </span>
            </button>
          )}
          {onOpenNewChat && (
            <Button
              onClick={onOpenNewChat}
              size="sm"
              className="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0 font-medium text-xs px-2.5 h-9"
              title="Start New Chat"
            >
              + New
            </Button>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center justify-center h-7 gap-1 px-2 text-xs text-muted-foreground transition-colors hover:text-foreground rounded-md hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
              {activeFilter?.label ?? "All"}
              <ChevronDown className="h-3 w-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="border-border bg-popover"
          >
            {FILTER_OPTIONS.map((opt) => (
              <DropdownMenuItem
                key={opt.value}
                onClick={() => setFilter(opt.value)}
                className={cn(
                  "text-sm",
                  filter === opt.value
                    ? "text-primary"
                    : "text-popover-foreground"
                )}
              >
                {opt.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Conversation Items.
          `min-h-0` is load-bearing: a flex child defaults to
          min-height:auto, so without it this ScrollArea grows to fit
          every conversation instead of shrinking to the remaining
          space — the list then overflows and gets clipped by the
          parent's overflow-hidden with no scrollbar (issue #229). */}
      <ScrollArea className="min-h-0 flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-12 text-center space-y-3">
            <p className="text-xs font-semibold text-foreground">No conversations found</p>
            <p className="text-[11px] text-muted-foreground max-w-[200px] leading-relaxed">
              Start messaging a contact or enter a phone number to test your WhatsApp setup.
            </p>
            {onOpenNewChat && (
              <Button
                onClick={onOpenNewChat}
                size="sm"
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-xs h-8 px-3 mt-1"
              >
                + Start New Chat
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col">
            {filtered.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isActive={conv.id === activeConversationId}
                onSelect={handleSelect}
                onDelete={onDeleteConversation}
                chatbotEnabled={chatbotEnabled}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onSelect: (conversation: Conversation) => void;
  onDelete?: (conversationId: string) => void;
  chatbotEnabled?: boolean;
}

function ConversationItem({
  conversation,
  isActive,
  onSelect,
  onDelete,
  chatbotEnabled = false,
}: ConversationItemProps) {
  const contact = conversation.contact;
  const displayName = contactDisplayName(contact?.name, contact?.phone);
  const initials = contactInitial(contact?.name, contact?.phone);

  const handleClick = useCallback(() => {
    onSelect(conversation);
  }, [onSelect, conversation]);

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onDelete) {
        onDelete(conversation.id);
      }
    },
    [onDelete, conversation.id]
  );

  const timeAgo = conversation.last_message_at
    ? formatRowTimestamp(conversation.last_message_at)
    : "";
  const hasUnread = conversation.unread_count > 0;

  return (
    // A transparent left accent is always present so the active state's
    // primary accent doesn't shift the row content 2px to the right.
    <div
      onClick={handleClick}
      className={cn(
        "group relative flex w-full items-start gap-3 border-b border-l-2 border-border/40 border-l-transparent px-3 py-3 text-left transition-colors hover:bg-muted/50 cursor-pointer",
        isActive && "border-l-primary bg-muted/70"
      )}
    >
      {/* Avatar */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
        {contact?.avatar_url ? (
          <img
            src={contact.avatar_url}
            alt={displayName}
            className="h-10 w-10 rounded-full object-cover"
          />
        ) : (
          initials
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {/* Unread rows get heavier type — same cue WhatsApp uses. */}
            <span
              className={cn(
                "truncate text-sm text-foreground",
                hasUnread ? "font-semibold" : "font-medium",
              )}
            >
              {displayName}
            </span>
            {chatbotEnabled && (
              <span
                title={
                  conversation.bot_status !== "paused"
                    ? "AI bot active"
                    : "AI bot paused"
                }
                className="shrink-0"
              >
                <Bot
                  className={cn(
                    "h-3.5 w-3.5",
                    conversation.bot_status !== "paused"
                      ? "text-primary"
                      : "text-muted-foreground",
                  )}
                />
              </span>
            )}
          </div>
          <span
            className={cn(
              "shrink-0 text-[10px]",
              hasUnread ? "font-medium text-primary" : "text-muted-foreground",
            )}
          >
            {timeAgo}
          </span>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p
            className={cn(
              "truncate text-xs",
              hasUnread
                ? "font-medium text-foreground/90"
                : "text-muted-foreground",
            )}
          >
            {conversation.last_message_text || "No messages yet"}
          </p>
          <div className="flex shrink-0 items-center gap-1.5">
            {hasUnread && (
              <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold leading-none text-primary-foreground">
                {conversation.unread_count}
              </span>
            )}
            {/* Status dot only for non-default states (pending/closed).
                "open" used to paint a permanent primary-blue dot on every
                row, which read as an unread indicator that never cleared —
                unread state is carried by the count badge above. */}
            {conversation.status !== "open" && (
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  STATUS_COLORS[conversation.status]
                )}
                title={conversation.status}
              />
            )}
            {onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                title="Delete Chat"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
