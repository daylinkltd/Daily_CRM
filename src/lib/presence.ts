/**
 * Presence — shared types and pure helpers.
 *
 * "Stored" presence is what the heartbeat writes (online / away).
 * "Derived" presence adds offline by checking staleness.
 */

export const HEARTBEAT_MS = 30_000;
export const IDLE_AFTER_MS = 5 * 60_000;
export const OFFLINE_AFTER_MS = HEARTBEAT_MS * 3;

/** Values that appear in the `member_presence.status` column. */
export type StoredPresence = "online" | "away";

export type PresenceStatus = "online" | "away" | "offline";

/** Raw presence row as read from the `member_presence` table. */
export interface PresenceRow {
  status: StoredPresence;
  last_seen_at: string;
}

/**
 * Derive the user-facing presence for a member. A missing row, or a
 * heartbeat staler than OFFLINE_AFTER_MS, reads as offline; otherwise
 * the member's last reported status (online / away) stands.
 */
export function derivePresence(
  stored: StoredPresence | undefined,
  lastSeenAt: string | null | undefined,
  now: number,
): PresenceStatus {
  if (!stored || !lastSeenAt) return "offline";
  const last = new Date(lastSeenAt).getTime();
  if (Number.isNaN(last)) return "offline";
  if (now - last > OFFLINE_AFTER_MS) return "offline";
  return stored;
}

/**
 * Relative "last seen" string for tooltips.
 */
export function formatLastSeen(
  lastSeenAt: string | null | undefined,
  now: number,
): string {
  if (!lastSeenAt) return "a while ago";
  const last = new Date(lastSeenAt).getTime();
  if (Number.isNaN(last)) return "a while ago";

  const diff = Math.max(0, now - last);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins === 1) return "1 minute ago";
  if (mins < 60) return `${mins} minutes ago`;

  const hours = Math.floor(mins / 60);
  if (hours === 1) return "1 hour ago";
  if (hours < 24) return `${hours} hours ago`;

  const days = Math.floor(hours / 24);
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

/**
 * Tooltip / aria label for a presence dot.
 */
export function presenceLabel(
  status: PresenceStatus,
  lastSeenAt: string | null | undefined,
  now: number,
): string {
  switch (status) {
    case "online":
      return "Online — active now";
    case "away":
      return "Away — idle";
    case "offline":
      return `Offline — last seen ${formatLastSeen(lastSeenAt, now)}`;
  }
}

/** Roster header summary. */
export function summarize(statuses: PresenceStatus[]): {
  online: number;
  away: number;
  offline: number;
} {
  const counts = { online: 0, away: 0, offline: 0 };
  for (const s of statuses) counts[s] += 1;
  return counts;
}
