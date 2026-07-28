import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The hook itself needs a DOM + React renderer, which this project's
 * vitest setup doesn't provide. These tests cover the two behaviours
 * that actually caused production problems, against the same logic
 * shape: never overlap runs, and never run while hidden.
 */

class FakeDoc {
  hidden = false;
  listeners: Record<string, Array<() => void>> = {};
  addEventListener(type: string, fn: () => void) {
    (this.listeners[type] ??= []).push(fn);
  }
  removeEventListener(type: string, fn: () => void) {
    this.listeners[type] = (this.listeners[type] ?? []).filter((f) => f !== fn);
  }
  emit(type: string) {
    for (const fn of this.listeners[type] ?? []) fn();
  }
}

/** Mirrors the guarded runner inside useVisibleInterval. */
function makeRunner(doc: FakeDoc, work: () => Promise<void>) {
  let inFlight = false;
  return async () => {
    if (inFlight) return "skipped-overlap";
    if (doc.hidden) return "skipped-hidden";
    inFlight = true;
    try {
      await work();
      return "ran";
    } finally {
      inFlight = false;
    }
  };
}

describe("visible-interval polling guards", () => {
  let doc: FakeDoc;
  beforeEach(() => {
    doc = new FakeDoc();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not run while the tab is hidden", async () => {
    const work = vi.fn(async () => {});
    const run = makeRunner(doc, work);
    doc.hidden = true;
    expect(await run()).toBe("skipped-hidden");
    expect(work).not.toHaveBeenCalled();
  });

  it("runs once the tab becomes visible again", async () => {
    const work = vi.fn(async () => {});
    const run = makeRunner(doc, work);
    doc.hidden = true;
    await run();
    doc.hidden = false;
    expect(await run()).toBe("ran");
    expect(work).toHaveBeenCalledTimes(1);
  });

  it("skips a tick while a previous fetch is still in flight", async () => {
    let release: () => void = () => {};
    const work = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const run = makeRunner(doc, work);

    const first = run();
    // Second tick arrives before the first response — must not stack a
    // duplicate request (out-of-order responses used to clobber state).
    expect(await run()).toBe("skipped-overlap");
    release();
    expect(await first).toBe("ran");
    expect(work).toHaveBeenCalledTimes(1);
  });
});

describe("optimistic message merge", () => {
  interface Msg {
    id: string;
    content_type: string;
    content_text: string | null;
  }

  /** Same merge the inbox uses in handleMessagesLoaded. */
  function merge(prev: Msg[], loaded: Msg[]): Msg[] {
    const pending = prev.filter((m) => m.id.startsWith("temp-"));
    if (pending.length === 0) return loaded;
    const serverKeys = new Set(
      loaded.map((m) => `${m.content_type}|${m.content_text ?? ""}`),
    );
    const stillPending = pending.filter(
      (m) => !serverKeys.has(`${m.content_type}|${m.content_text ?? ""}`),
    );
    return stillPending.length > 0 ? [...loaded, ...stillPending] : loaded;
  }

  const temp: Msg = { id: "temp-1", content_type: "text", content_text: "hey" };
  const server: Msg = { id: "uuid-1", content_type: "text", content_text: "hi" };

  it("keeps an optimistic bubble the server list does not have yet", () => {
    // This is the flicker: a poll landing between the optimistic insert
    // and the row being readable used to drop the bubble entirely.
    const out = merge([server, temp], [server]);
    expect(out.map((m) => m.id)).toEqual(["uuid-1", "temp-1"]);
  });

  it("drops the optimistic bubble once its real row arrives", () => {
    const real: Msg = { id: "uuid-2", content_type: "text", content_text: "hey" };
    const out = merge([server, temp], [server, real]);
    expect(out.map((m) => m.id)).toEqual(["uuid-1", "uuid-2"]);
  });

  it("returns the server list unchanged when nothing is pending", () => {
    const loaded = [server];
    expect(merge([server], loaded)).toBe(loaded);
  });
});
