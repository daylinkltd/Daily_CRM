"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Sound + desktop notifications for incoming customer messages.
 *
 * Design notes:
 *
 * - The alert tone is synthesised with the Web Audio API rather than
 *   shipped as an audio file: no binary asset in the repo, no network
 *   request, and it works offline.
 * - Browsers only allow `Notification.requestPermission()` and starting
 *   an AudioContext from a user gesture, so both happen when the user
 *   flips the toggle — never on mount. An AudioContext created without
 *   a gesture starts `suspended` and would play nothing.
 * - The preference is persisted, but permission is authoritative: if
 *   the user later revokes notification permission in the browser, we
 *   fall back to sound only rather than silently doing nothing.
 */

const STORAGE_KEY = "dailycrm.notifications.enabled";

export type NotificationPermissionState =
  | "unsupported"
  | "default"
  | "granted"
  | "denied";

function readStoredEnabled(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

/** Two-tone chime, WhatsApp-ish: short, quiet, non-annoying. */
function playChime(ctx: AudioContext) {
  const now = ctx.currentTime;
  const master = ctx.createGain();
  // Deliberately quiet — this fires on every inbound message.
  master.gain.value = 0.09;
  master.connect(ctx.destination);

  for (const [index, frequency] of [880, 1170].entries()) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = frequency;
    const start = now + index * 0.11;
    const end = start + 0.16;
    // Envelope: instant attack, exponential release. Without the ramp
    // the abrupt stop produces an audible click.
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(1, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(end + 0.02);
  }
}

export interface IncomingNotification {
  /** Stable id used to suppress duplicates across realtime + polling. */
  id: string;
  title: string;
  body: string;
  /** Conversation to open when the notification is clicked. */
  conversationId?: string;
}

export interface UseMessageNotificationsResult {
  enabled: boolean;
  permission: NotificationPermissionState;
  /** Turn alerts on (requests permission) or off. Call from a click. */
  toggle: () => Promise<void>;
  /** Fire an alert. No-op when disabled or already seen. */
  notify: (input: IncomingNotification) => void;
}

export function useMessageNotifications(options: {
  onOpenConversation?: (conversationId: string) => void;
} = {}): UseMessageNotificationsResult {
  const { onOpenConversation } = options;

  const [enabled, setEnabled] = useState(false);
  const [permission, setPermission] =
    useState<NotificationPermissionState>("default");

  const audioCtxRef = useRef<AudioContext | null>(null);
  const seenRef = useRef<Set<string>>(new Set());
  const openConversationRef = useRef(onOpenConversation);
  useEffect(() => {
    openConversationRef.current = onOpenConversation;
  });

  useEffect(() => {
    setEnabled(readStoredEnabled());
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission as NotificationPermissionState);
  }, []);

  useEffect(() => {
    // Release the audio device when the view unmounts.
    return () => {
      void audioCtxRef.current?.close();
      audioCtxRef.current = null;
    };
  }, []);

  const toggle = useCallback(async () => {
    if (enabled) {
      setEnabled(false);
      try {
        window.localStorage.setItem(STORAGE_KEY, "false");
      } catch {
        /* storage unavailable — in-memory state still applies */
      }
      return;
    }

    // Runs inside the click handler, which is what lets the browser
    // show its permission prompt and start audio.
    if (typeof window !== "undefined" && "Notification" in window) {
      try {
        const result = await Notification.requestPermission();
        setPermission(result as NotificationPermissionState);
      } catch {
        // Older Safari uses the callback form; treat as unknown and
        // continue — sound still works without notification permission.
      }
    }

    try {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (Ctor) {
        audioCtxRef.current = audioCtxRef.current ?? new Ctor();
        if (audioCtxRef.current.state === "suspended") {
          await audioCtxRef.current.resume();
        }
        // Confirmation blip so the user hears what they just enabled.
        playChime(audioCtxRef.current);
      }
    } catch {
      /* audio unavailable — notifications may still work */
    }

    setEnabled(true);
    try {
      window.localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      /* ignore */
    }
  }, [enabled]);

  const notify = useCallback(
    (input: IncomingNotification) => {
      if (!enabled) return;
      // Realtime and the backup poll can both surface the same message.
      if (seenRef.current.has(input.id)) return;
      seenRef.current.add(input.id);
      // Bound the set so a long-lived tab doesn't grow it forever.
      if (seenRef.current.size > 500) {
        seenRef.current = new Set(Array.from(seenRef.current).slice(-200));
      }

      const ctx = audioCtxRef.current;
      if (ctx && ctx.state === "running") {
        try {
          playChime(ctx);
        } catch {
          /* ignore audio failures */
        }
      }

      if (
        typeof window !== "undefined" &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        try {
          const notification = new Notification(input.title, {
            body: input.body,
            // Collapses repeat alerts for one chat into a single toast
            // instead of stacking one per message.
            tag: input.conversationId ?? input.id,
            icon: "/icon.png",
          });
          notification.onclick = () => {
            window.focus();
            if (input.conversationId) {
              openConversationRef.current?.(input.conversationId);
            }
            notification.close();
          };
        } catch {
          /* some browsers throw when constructing off a service worker */
        }
      }
    },
    [enabled],
  );

  return { enabled, permission, toggle, notify };
}
