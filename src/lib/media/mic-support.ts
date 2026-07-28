/**
 * Microphone / voice-recording capability probes and error mapping.
 *
 * Why this exists: `navigator.mediaDevices` only exists in a **secure
 * context** (https, or http on localhost). Served over plain http on a
 * LAN IP — how this app is usually smoke-tested on a phone — the whole
 * API is `undefined`, and code that lumps that in with a rejected
 * `getUserMedia()` tells the user "microphone permission denied" when the
 * browser never even asked. Same for a missing mic, a mic held by another
 * app, or a dismissed (not denied) prompt.
 *
 * Everything here is pure — the DOM is read once in `readRecordingEnv()`
 * — so the mapping is unit-testable in a node environment.
 */

/** Snapshot of the browser capabilities voice recording needs. */
export interface RecordingEnv {
  /** `window.isSecureContext` — false on plain http over an IP/LAN. */
  isSecureContext: boolean;
  /** `navigator.mediaDevices?.getUserMedia` is callable. */
  hasGetUserMedia: boolean;
  /** Web Audio is available (the Opus encoder runs in an AudioContext). */
  hasAudioContext: boolean;
  /** Encoder worker needs WebAssembly. */
  hasWebAssembly: boolean;
}

export type RecordingSupport =
  | { ok: true }
  | { ok: false; reason: RecordingBlockedReason; message: string };

export type RecordingBlockedReason =
  | "insecure-context"
  | "unsupported-browser";

/** Permission state as reported by `navigator.permissions.query`. */
export type MicPermissionState = "granted" | "denied" | "prompt" | "unknown";

export const INSECURE_CONTEXT_MESSAGE =
  "Recording needs a secure connection (https). Open this app over https or on localhost to record voice notes.";

export const UNSUPPORTED_BROWSER_MESSAGE =
  "Voice recording isn't supported in this browser. Try the latest Chrome, Edge, Firefox or Safari.";

/**
 * The AudioContext constructor, preferring the standard name and falling
 * back to Safari's legacy prefix — the same resolution opus-recorder does
 * internally, so we don't narrow browser support by building the context
 * ourselves. Returns null when Web Audio is unavailable (incl. SSR).
 */
export function getAudioContextConstructor(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  const legacy = (window as Window & { webkitAudioContext?: typeof AudioContext })
    .webkitAudioContext;
  return window.AudioContext ?? legacy ?? null;
}

/**
 * Read the live browser capabilities. Safe to call during SSR — reports
 * an unsupported environment rather than throwing.
 */
export function readRecordingEnv(): RecordingEnv {
  if (typeof window === "undefined") {
    return {
      isSecureContext: false,
      hasGetUserMedia: false,
      hasAudioContext: false,
      hasWebAssembly: false,
    };
  }
  return {
    // Older browsers don't expose isSecureContext at all; assume secure
    // there so we fall through to the generic "unsupported" message
    // instead of wrongly blaming the connection.
    isSecureContext:
      typeof window.isSecureContext === "boolean"
        ? window.isSecureContext
        : true,
    hasGetUserMedia:
      typeof navigator !== "undefined" &&
      typeof navigator.mediaDevices?.getUserMedia === "function",
    hasAudioContext: getAudioContextConstructor() !== null,
    hasWebAssembly: typeof WebAssembly !== "undefined",
  };
}

/**
 * Decide whether recording can even be attempted, and why not.
 *
 * The insecure-context check runs first: on plain http `getUserMedia` is
 * missing *because of* the connection, and saying "unsupported browser"
 * sends the user chasing the wrong problem.
 */
export function describeRecordingSupport(env: RecordingEnv): RecordingSupport {
  if (!env.hasGetUserMedia && !env.isSecureContext) {
    return {
      ok: false,
      reason: "insecure-context",
      message: INSECURE_CONTEXT_MESSAGE,
    };
  }
  if (!env.hasGetUserMedia || !env.hasAudioContext || !env.hasWebAssembly) {
    return {
      ok: false,
      reason: "unsupported-browser",
      message: UNSUPPORTED_BROWSER_MESSAGE,
    };
  }
  return { ok: true };
}

/** `DOMException.name` values `getUserMedia` can reject with. */
type ErrorLike = { name?: unknown; message?: unknown };

function errorName(error: unknown): string {
  const name = (error as ErrorLike | null)?.name;
  return typeof name === "string" ? name : "";
}

function errorMessage(error: unknown): string {
  const message = (error as ErrorLike | null)?.message;
  return typeof message === "string" ? message.trim() : "";
}

/**
 * Turn a `getUserMedia` rejection into a message that names the actual
 * problem and, where possible, the fix.
 *
 * `permissionState` comes from `navigator.permissions.query({ name:
 * "microphone" })` when the browser supports it. It's what separates
 * "the user has blocked the mic for this site" (needs a trip to site
 * settings) from "the user dismissed the prompt" (just try again) —
 * both of which reject with `NotAllowedError`.
 */
export function describeMicError(
  error: unknown,
  permissionState: MicPermissionState = "unknown",
): string {
  const name = errorName(error);
  const raw = errorMessage(error);

  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError": // legacy Chrome
      if (permissionState === "denied") {
        return "Microphone access is blocked for this site. Click the padlock (or camera) icon in the address bar, set Microphone to Allow, then try again.";
      }
      if (permissionState === "prompt") {
        return "Microphone permission was dismissed. Tap the mic again and choose Allow when the browser asks.";
      }
      return "Microphone access was not granted. Tap the mic again and choose Allow — if no prompt appears, enable Microphone for this site in your browser's site settings.";

    case "NotFoundError":
    case "DevicesNotFoundError": // legacy Chrome
      return "No microphone found. Connect or enable a microphone, then try again.";

    case "NotReadableError":
    case "TrackStartError": // legacy Chrome
      return "Your microphone is in use by another app (or the OS blocked it). Close the other app and try again.";

    case "OverconstrainedError":
    case "ConstraintNotSatisfiedError":
      return "No microphone matches the requested audio settings. Try a different input device.";

    case "SecurityError":
      return INSECURE_CONTEXT_MESSAGE;

    case "AbortError":
      return "The microphone stopped responding before recording started. Try again.";

    case "TypeError":
      // getUserMedia with no/empty constraints, or a missing API surface.
      return UNSUPPORTED_BROWSER_MESSAGE;

    default:
      return raw
        ? `Couldn't start recording: ${raw}`
        : "Couldn't start recording — the microphone is unavailable.";
  }
}

/**
 * Best-effort read of the microphone permission. Firefox and some Safari
 * versions don't implement the `microphone` descriptor and throw, which
 * we report as "unknown" so callers fall back to a neutral message.
 */
export async function readMicPermissionState(): Promise<MicPermissionState> {
  if (typeof navigator === "undefined" || !navigator.permissions?.query) {
    return "unknown";
  }
  try {
    const status = await navigator.permissions.query({
      // `microphone` isn't in lib.dom's PermissionName union.
      name: "microphone" as PermissionName,
    });
    return status.state;
  } catch {
    return "unknown";
  }
}
