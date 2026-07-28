import { describe, it, expect } from "vitest";
import {
  describeMicError,
  describeRecordingSupport,
  getAudioContextConstructor,
  readRecordingEnv,
  INSECURE_CONTEXT_MESSAGE,
  UNSUPPORTED_BROWSER_MESSAGE,
  type RecordingEnv,
} from "./mic-support";

const supported: RecordingEnv = {
  isSecureContext: true,
  hasGetUserMedia: true,
  hasAudioContext: true,
  hasWebAssembly: true,
};

describe("describeRecordingSupport", () => {
  it("allows recording when every capability is present", () => {
    expect(describeRecordingSupport(supported)).toEqual({ ok: true });
  });

  it("blames the connection, not permissions, on plain http", () => {
    const result = describeRecordingSupport({
      ...supported,
      isSecureContext: false,
      hasGetUserMedia: false,
    });
    expect(result).toEqual({
      ok: false,
      reason: "insecure-context",
      message: INSECURE_CONTEXT_MESSAGE,
    });
    expect(result.ok === false && result.message).toMatch(/https/);
  });

  it("reports an unsupported browser when getUserMedia is missing in a secure context", () => {
    expect(
      describeRecordingSupport({ ...supported, hasGetUserMedia: false }),
    ).toEqual({
      ok: false,
      reason: "unsupported-browser",
      message: UNSUPPORTED_BROWSER_MESSAGE,
    });
  });

  it("reports an unsupported browser without Web Audio or WebAssembly", () => {
    expect(
      describeRecordingSupport({ ...supported, hasAudioContext: false }).ok,
    ).toBe(false);
    expect(
      describeRecordingSupport({ ...supported, hasWebAssembly: false }).ok,
    ).toBe(false);
  });

  it("does not blame the connection when only Web Audio is missing", () => {
    const result = describeRecordingSupport({
      ...supported,
      isSecureContext: false,
      hasAudioContext: false,
    });
    expect(result.ok === false && result.reason).toBe("unsupported-browser");
  });
});

// The suite runs in vitest's node environment, i.e. no `window` — which is
// exactly the SSR path both helpers have to survive.
describe("server-side rendering", () => {
  it("has no AudioContext constructor without a window", () => {
    expect(getAudioContextConstructor()).toBeNull();
  });

  it("reports an unsupported environment rather than throwing", () => {
    const env = readRecordingEnv();
    expect(env.hasGetUserMedia).toBe(false);
    expect(describeRecordingSupport(env).ok).toBe(false);
  });
});

/** getUserMedia rejects with DOMException; a plain object mimics it fine. */
function err(name: string, message = ""): unknown {
  return { name, message };
}

describe("describeMicError", () => {
  it("tells a blocked user how to re-enable the mic in site settings", () => {
    const msg = describeMicError(err("NotAllowedError"), "denied");
    expect(msg).toMatch(/blocked/i);
    expect(msg).toMatch(/address bar|site settings/i);
  });

  it("treats a dismissed prompt as retryable, not blocked", () => {
    const msg = describeMicError(err("NotAllowedError"), "prompt");
    expect(msg).toMatch(/dismissed/i);
    expect(msg).not.toMatch(/blocked/i);
  });

  it("stays neutral when the permission state is unknown", () => {
    const msg = describeMicError(err("NotAllowedError"), "unknown");
    expect(msg).toMatch(/not granted/i);
  });

  it("maps the legacy Chrome permission alias", () => {
    expect(describeMicError(err("PermissionDeniedError"), "denied")).toMatch(
      /blocked/i,
    );
  });

  it("reports missing hardware rather than a permission problem", () => {
    for (const name of ["NotFoundError", "DevicesNotFoundError"]) {
      const msg = describeMicError(err(name));
      expect(msg).toMatch(/no microphone found/i);
      expect(msg).not.toMatch(/permission|denied/i);
    }
  });

  it("reports a mic held by another app", () => {
    for (const name of ["NotReadableError", "TrackStartError"]) {
      expect(describeMicError(err(name))).toMatch(/in use by another app/i);
    }
  });

  it("maps constraint failures to a device hint", () => {
    expect(describeMicError(err("OverconstrainedError"))).toMatch(
      /audio settings/i,
    );
  });

  it("maps SecurityError to the https message", () => {
    expect(describeMicError(err("SecurityError"))).toBe(
      INSECURE_CONTEXT_MESSAGE,
    );
  });

  it("maps AbortError to a retry hint", () => {
    expect(describeMicError(err("AbortError"))).toMatch(/try again/i);
  });

  it("maps TypeError to the unsupported-browser message", () => {
    expect(describeMicError(err("TypeError"))).toBe(
      UNSUPPORTED_BROWSER_MESSAGE,
    );
  });

  it("surfaces the raw message for unknown errors", () => {
    expect(describeMicError(err("WeirdError", "encoder exploded"))).toBe(
      "Couldn't start recording: encoder exploded",
    );
  });

  it("falls back to a generic message for non-errors", () => {
    expect(describeMicError(null)).toMatch(/microphone is unavailable/i);
    expect(describeMicError("nope")).toMatch(/microphone is unavailable/i);
    expect(describeMicError(undefined)).toMatch(/microphone is unavailable/i);
  });

  it("never claims permission was denied for a non-permission error", () => {
    expect(describeMicError(err("NotFoundError"), "denied")).toMatch(
      /no microphone found/i,
    );
  });
});
