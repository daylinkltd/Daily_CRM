"use client";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  KeyboardEvent,
} from "react";
import {
  Send,
  LayoutTemplate,
  Paperclip,
  Image as ImageIcon,
  Video,
  FileText,
  Mic,
  Square,
  X,
  Loader2,
  Sparkles,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GatedButton } from "@/components/ui/gated-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCan } from "@/hooks/use-can";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  uploadAccountMedia,
  deleteAccountMedia,
  MEDIA_MAX_BYTES_BY_KIND,
} from "@/lib/storage/upload-media";
import {
  describeMicError,
  describeRecordingSupport,
  getAudioContextConstructor,
  readMicPermissionState,
  readRecordingEnv,
} from "@/lib/media/mic-support";
import { ReplyQuote } from "./reply-quote";
import { IconAction } from "@/components/ui/icon-action";

/** Media content types an agent can send from the composer. */
export type ComposerMediaKind = "image" | "video" | "document" | "audio";

/** Supabase Storage bucket holding agent-sent chat attachments (migration 023). */
export const CHAT_MEDIA_BUCKET = "chat-media";

/** Meta caps media captions at 1024 chars. Enforced here and in the send route. */
export const MEDIA_CAPTION_MAX = 1024;

/** Hard cap on a single voice recording so it can't blow the upload/
 *  transcode limits — auto-stops the recorder when reached. */
const MAX_RECORDING_SECONDS = 5 * 60;

export interface SendMediaPayload {
  kind: ComposerMediaKind;
  /** Public chat-media URL Meta fetches at send time. */
  mediaUrl: string;
  /** Storage object path — lets the caller GC the object if the send fails. */
  path: string;
  /** Optional caption (image/video/document only). */
  caption?: string;
  /** Original file name — surfaced to the recipient for documents. */
  filename?: string;
  replyToId?: string;
}

interface ReplyDraft {
  /** Internal UUID of the message being replied to — sent back through onSend. */
  id: string;
  authorLabel: string;
  preview: string;
}

// Mirrors the chat-media bucket's allowed_mime_types (migration 023) for
// the file picker so unsupported files are rejected before upload rather
// than failing with a confusing Storage error. Audio has no picker — it's
// captured via the recorder.
const PICKER_ACCEPT: Record<"image" | "video" | "document", string> = {
  image: "image/png,image/jpeg,image/webp",
  video: "video/mp4,video/3gpp",
  document:
    "application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain",
};

interface MediaDraft {
  kind: ComposerMediaKind;
  mediaUrl: string;
  /** Storage path — used to GC the object if the draft is discarded. */
  path: string;
  filename: string;
  caption: string;
}

interface MessageComposerProps {
  conversationId: string;
  sessionExpired: boolean;
  onSend: (text: string, replyToId?: string) => void;
  onSendMedia: (payload: SendMediaPayload) => void;
  onOpenTemplates: () => void;
  replyTo?: ReplyDraft | null;
  onClearReply?: () => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Worker that encodes mic input to Ogg/Opus entirely in the browser
 *  (vendored from opus-recorder into /public). Recording client-side in a
 *  Meta-accepted format means no server ffmpeg / transcode step. */
const OPUS_ENCODER_PATH = "/opus/encoderWorker.min.js";

export function MessageComposer({
  conversationId,
  sessionExpired,
  onSend,
  onSendMedia,
  onOpenTemplates,
  replyTo,
  onClearReply,
}: MessageComposerProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [suggestedDraft, setSuggestedDraft] = useState<string | null>(null);
  const [loadingDraft, setLoadingDraft] = useState(false);

  const fetchDraft = useCallback(async () => {
    if (!conversationId) return;
    setLoadingDraft(true);
    setSuggestedDraft(null);
    try {
      const response = await fetch("/api/whatsapp/suggest-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.draft) {
          setSuggestedDraft(data.draft);
        }
      }
    } catch (err) {
      console.error("Failed to fetch AI suggestion:", err);
    } finally {
      setLoadingDraft(false);
    }
  }, [conversationId]);

  useEffect(() => {
    fetchDraft();
  }, [conversationId, fetchDraft]);

  // Media attachment state. `draft` holds an uploaded-but-not-yet-sent
  // attachment; `busy` covers the upload/transcode window.
  const [draft, setDraft] = useState<MediaDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  // Mirror of `draft` for the unmount cleanup, which can't read render
  // state. Kept in sync below so navigating away with a staged-but-unsent
  // attachment GCs the orphaned object.
  const draftRef = useRef<MediaDraft | null>(null);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  // Best-effort GC of a staged object the user never sent. Fire-and-forget.
  const removeStaged = useCallback((path: string | undefined) => {
    if (!path) return;
    void deleteAccountMedia(CHAT_MEDIA_BUCKET, path).catch(() => {});
  }, []);

  // Voice recording state. The recorder encodes Ogg/Opus in-browser
  // (opus-recorder) so there's no server-side transcode.
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const recorderRef = useRef<import("opus-recorder").default | null>(null);
  const cancelledRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // We own the mic stream and the AudioContext (see startRecording) —
  // opus-recorder only tears down resources it opened itself, so both are
  // released here or the browser keeps showing its "recording" indicator.
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  // Re-entry guard for the window between the click and `recording` going
  // true (permission prompt + encoder import) — the menu item is still
  // clickable there, and a second run would open a second mic stream.
  const startingRef = useRef(false);

  // Viewers (read-only role) can browse the inbox but never send.
  // For solo users this is always true — single-owner accounts pass
  // every capability — so the disabled branch is a no-op there.
  const canSend = useCan("send-messages");
  const readOnly = !canSend;
  // Media (like free-form text) is only allowed inside the 24h window.
  const inputsDisabled = readOnly || sessionExpired;

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Stop the mic tracks. Done as its own step (and as early as possible)
  // because it's what clears the browser tab's red "recording" indicator.
  const releaseMic = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  // Full audio teardown: mic tracks + the AudioContext we created for the
  // encoder. Safe to call twice.
  const releaseAudio = useCallback(() => {
    releaseMic();
    const context = audioContextRef.current;
    audioContextRef.current = null;
    if (context && context.state !== "closed") {
      void context.close().catch(() => {});
    }
  }, [releaseMic]);

  // Tear down any live recording + timer on unmount so a mid-record
  // navigation doesn't leak the mic, and GC a staged-but-unsent
  // attachment so it doesn't orphan in the bucket.
  useEffect(() => {
    return () => {
      clearTimer();
      cancelledRef.current = true;
      void recorderRef.current?.stop().catch(() => {});
      recorderRef.current = null;
      releaseAudio();
      removeStaged(draftRef.current?.path);
    };
  }, [clearTimer, releaseAudio, removeStaged]);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    // Max 4 lines (~96px)
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
  }, []);

  const handleUseDraft = useCallback(() => {
    if (!suggestedDraft) return;
    setText(suggestedDraft);
    setSuggestedDraft(null);
    if (textareaRef.current) {
      textareaRef.current.focus();
      setTimeout(() => adjustHeight(), 50);
    }
  }, [suggestedDraft, adjustHeight]);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || sending || sessionExpired) return;

    setSending(true);
    try {
      onSend(trimmed, replyTo?.id);
      setText("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    } finally {
      setSending(false);
    }
  }, [text, sending, sessionExpired, onSend, replyTo?.id]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(e.target.value);
      adjustHeight();
    },
    [adjustHeight]
  );

  // Upload a captured file to chat-media and stage it as a draft.
  const stageUpload = useCallback(
    async (kind: ComposerMediaKind, file: File) => {
      // Per-kind ceiling mirrors Meta's caps (image 5 MB, etc.) so we
      // reject before upload rather than orphaning an object that Meta
      // would then refuse at send.
      const max = MEDIA_MAX_BYTES_BY_KIND[kind];
      if (file.size > max) {
        toast.error(
          `File is ${(file.size / 1024 / 1024).toFixed(1)} MB — ${kind} limit is ${Math.round(
            max / 1024 / 1024,
          )} MB.`,
        );
        return;
      }
      setBusy(true);
      try {
        const { publicUrl, path } = await uploadAccountMedia(CHAT_MEDIA_BUCKET, file);
        // Replacing an existing draft? GC the previous object first.
        removeStaged(draftRef.current?.path);
        setDraft({ kind, mediaUrl: publicUrl, path, filename: file.name, caption: "" });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Upload failed.");
      } finally {
        setBusy(false);
      }
    },
    [removeStaged],
  );

  const handlePicked = useCallback(
    (kind: "image" | "video" | "document", file: File | undefined) => {
      if (file) void stageUpload(kind, file);
    },
    [stageUpload],
  );

  // ---- Voice recording (client-side Ogg/Opus, no server transcode) ---

  // The encoded Ogg/Opus file from opus-recorder → upload as an audio
  // draft. WhatsApp renders Ogg/Opus as a playable voice note.
  const finalizeRecording = useCallback(
    async (bytes: Uint8Array) => {
      // Uint8Array is a valid BlobPart at runtime; the cast sidesteps the
      // lib.dom ArrayBufferLike-vs-ArrayBuffer generic mismatch.
      const file = new File([bytes as unknown as BlobPart], `voice-${Date.now()}.ogg`, {
        type: "audio/ogg",
      });
      if (file.size === 0) return; // cancelled / empty take
      if (file.size > MEDIA_MAX_BYTES_BY_KIND.audio) {
        toast.error("Recording is too long (over 16 MB).");
        return;
      }
      setBusy(true);
      try {
        const { publicUrl, path } = await uploadAccountMedia(CHAT_MEDIA_BUCKET, file);
        removeStaged(draftRef.current?.path);
        setDraft({ kind: "audio", mediaUrl: publicUrl, path, filename: file.name, caption: "" });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Upload failed.");
      } finally {
        setBusy(false);
      }
    },
    [removeStaged],
  );

  const startRecording = useCallback(async () => {
    if (inputsDisabled || busy || recording || startingRef.current) return;

    // Capability gate first: over plain http `navigator.mediaDevices` is
    // undefined *because the context isn't secure*, which must not be
    // reported as a permission problem (see lib/media/mic-support).
    const support = describeRecordingSupport(readRecordingEnv());
    if (!support.ok) {
      toast.error(support.message);
      return;
    }

    startingRef.current = true;
    try {
      // Request the mic FIRST, as the first await in the click handler.
      // opus-recorder would otherwise call getUserMedia itself from inside
      // start() — after the ~400 KB encoder import has been awaited, by
      // which point Safari/Firefox may no longer treat the call as
      // user-initiated and refuse to show the "Allow microphone?" prompt.
      // Doing it here also means we see the real rejection reason.
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch (err) {
        // permissions.query distinguishes "blocked in site settings" from
        // "prompt dismissed" — both reject with NotAllowedError.
        const permission = await readMicPermissionState();
        toast.error(describeMicError(err, permission));
        return;
      }
      streamRef.current = stream;

      try {
        // Lazy-load the encoder (≈400 KB worker) only when the user records,
        // keeping it out of the main bundle.
        const { default: Recorder } = await import("opus-recorder");
        // Mid-flight cancel/unmount already released the stream — don't
        // spin the encoder up against dead tracks.
        if (streamRef.current !== stream) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        const AudioContextCtor = getAudioContextConstructor();
        if (!AudioContextCtor) throw new Error("Web Audio is unavailable");
        const context = new AudioContextCtor();
        audioContextRef.current = context;
        const recorder = new Recorder({
          encoderPath: OPUS_ENCODER_PATH,
          numberOfChannels: 1,
          encoderApplication: 2048, // VOIP — tuned for speech
          encoderSampleRate: 48000,
          streamPages: false, // one callback with the complete file on stop
          // Our stream/context, so the recorder skips its own getUserMedia.
          sourceNode: context.createMediaStreamSource(stream),
        });
        cancelledRef.current = false;
        recorder.ondataavailable = (bytes) => {
          if (cancelledRef.current) return;
          void finalizeRecording(bytes);
        };
        recorderRef.current = recorder;
        await recorder.start();
        setRecording(true);
        setRecordSeconds(0);
        timerRef.current = setInterval(
          () => setRecordSeconds((s) => s + 1),
          1000,
        );
      } catch (err) {
        // The encoder failed, not the mic — say so, and always hand the mic
        // back so the tab's recording indicator clears.
        void recorderRef.current?.stop().catch(() => {});
        recorderRef.current = null;
        releaseAudio();
        const detail = err instanceof Error ? err.message : "";
        toast.error(
          detail
            ? `Couldn't start the recorder: ${detail}`
            : "Couldn't start the recorder. Please try again.",
        );
      }
    } finally {
      startingRef.current = false;
    }
  }, [inputsDisabled, busy, recording, finalizeRecording, releaseAudio]);

  // Shared teardown for stop + cancel. `stop()` flushes the encoder and
  // (unless cancelled) fires ondataavailable, so the AudioContext is only
  // closed once that promise settles.
  const endRecording = useCallback(
    (cancelled: boolean) => {
      cancelledRef.current = cancelled;
      clearTimer();
      setRecording(false);
      // Release the mic immediately — the encoder no longer needs input,
      // and this is what clears the browser's recording indicator.
      releaseMic();
      const recorder = recorderRef.current;
      recorderRef.current = null;
      if (!recorder) {
        releaseAudio();
        return;
      }
      void recorder
        .stop()
        .catch(() => {})
        .finally(() => releaseAudio());
    },
    [clearTimer, releaseAudio, releaseMic],
  );

  const stopRecording = useCallback(() => endRecording(false), [endRecording]);

  const cancelRecording = useCallback(() => endRecording(true), [endRecording]);

  // Auto-stop at the cap so a forgotten recording can't blow the
  // upload size limit.
  useEffect(() => {
    if (recording && recordSeconds >= MAX_RECORDING_SECONDS) {
      stopRecording();
    }
  }, [recording, recordSeconds, stopRecording]);

  // ---- Draft send / discard -----------------------------------------

  const sendDraft = useCallback(() => {
    if (!draft || busy) return;
    onSendMedia({
      kind: draft.kind,
      mediaUrl: draft.mediaUrl,
      path: draft.path,
      // Audio takes no caption (Meta rejects it). Everything else: the
      // trimmed caption, or undefined when blank.
      caption:
        draft.kind === "audio" ? undefined : draft.caption.trim() || undefined,
      filename: draft.kind === "document" ? draft.filename : undefined,
      replyToId: replyTo?.id,
    });
    // The object is now owned by the sent message — clear without GC.
    setDraft(null);
    onClearReply?.();
  }, [draft, busy, onSendMedia, replyTo?.id, onClearReply]);

  // Discard GCs the staged object — it was uploaded but never sent.
  const discardDraft = useCallback(() => {
    removeStaged(draft?.path);
    setDraft(null);
  }, [draft?.path, removeStaged]);

  const setCaption = useCallback((caption: string) => {
    setDraft((d) => (d ? { ...d, caption } : d));
  }, []);

  // ---- Render --------------------------------------------------------

  return (
    <div className="border-t border-border bg-card p-3">
      {replyTo && (
        <div className="mb-2">
          <ReplyQuote
            authorLabel={replyTo.authorLabel}
            preview={replyTo.preview}
            onDismiss={onClearReply}
          />
        </div>
      )}

      {/* AI Smart Draft Card */}
      {loadingDraft && (
        <div className="mb-2 flex items-center gap-2 rounded-xl border border-border/50 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          <span>Generating AI reply draft...</span>
        </div>
      )}

      {suggestedDraft && !loadingDraft && (
        <div className="mb-3 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-1.5 font-semibold text-primary text-xs tracking-wide">
              <Sparkles className="h-3.5 w-3.5 animate-pulse" />
              <span>AI SUGGESTED DRAFT</span>
            </div>
            <button
              type="button"
              onClick={() => setSuggestedDraft(null)}
              aria-label="Dismiss suggestion"
              className="rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="mt-1.5 text-xs text-foreground leading-relaxed whitespace-pre-wrap">
            {suggestedDraft}
          </p>
          <div className="mt-2.5 flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleUseDraft}
              className="h-7 text-xs bg-primary/10 border-primary/20 text-primary hover:bg-primary/20"
            >
              Use Draft
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={fetchDraft}
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
            >
              Regenerate
            </Button>
          </div>
        </div>
      )}

      {sessionExpired && (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-muted/50 px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
              <Clock className="h-4 w-4 text-muted-foreground" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground">
                Session window closed
              </p>
              <p className="text-[11px] text-muted-foreground">
                WhatsApp only allows freeform replies within 24 hours of the
                customer&apos;s last message — send a template to re-engage.
              </p>
            </div>
          </div>
          <GatedButton
            size="sm"
            canAct={!readOnly}
            gateReason="send messages"
            className="h-8 shrink-0 bg-primary text-xs text-primary-foreground hover:bg-primary/90"
            onClick={onOpenTemplates}
          >
            <LayoutTemplate className="mr-1.5 h-3.5 w-3.5" />
            Send template
          </GatedButton>
        </div>
      )}

      {/* Hidden file inputs driven by the attach menu. */}
      <input
        ref={imageInputRef}
        type="file"
        accept={PICKER_ACCEPT.image}
        className="hidden"
        onChange={(e) => {
          handlePicked("image", e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept={PICKER_ACCEPT.video}
        className="hidden"
        onChange={(e) => {
          handlePicked("video", e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={documentInputRef}
        type="file"
        accept={PICKER_ACCEPT.document}
        className="hidden"
        onChange={(e) => {
          handlePicked("document", e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {draft ? (
        <MediaDraftPreview
          draft={draft}
          busy={busy}
          readOnly={readOnly}
          onCaptionChange={setCaption}
          onDiscard={discardDraft}
          onSend={sendDraft}
        />
      ) : recording ? (
        // Recording bar — replaces the composer while the mic is live.
        <div className="flex items-center gap-3 rounded-xl border border-border bg-muted px-4 py-2.5">
          <span className="flex h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-destructive" />
          <span className="flex-1 text-sm text-foreground">
            Recording… {formatDuration(recordSeconds)} /{" "}
            {formatDuration(MAX_RECORDING_SECONDS)}
          </span>
          <button
            type="button"
            onClick={cancelRecording}
            className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            Cancel
          </button>
          <IconAction
            label="Stop and attach"
            icon={<Square className="h-4 w-4" />}
            onClick={stopRecording}
            className="h-9 w-9 shrink-0 rounded-full bg-primary p-0 hover:bg-primary/90"
          />
        </div>
      ) : (
        <div className="flex items-end gap-2">
          {/* Attach menu — photo / video / document / voice. */}
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={inputsDisabled || busy}
              title={
                readOnly
                  ? "Read-only — your role can't send messages"
                  : inputsDisabled
                    ? undefined
                    : "Attach media"
              }
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full p-0 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Paperclip className="h-4 w-4" />
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="border-border bg-popover">
              <DropdownMenuItem onClick={() => imageInputRef.current?.click()}>
                <ImageIcon className="mr-2 h-4 w-4" />
                Photo
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => videoInputRef.current?.click()}>
                <Video className="mr-2 h-4 w-4" />
                Video
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => documentInputRef.current?.click()}>
                <FileText className="mr-2 h-4 w-4" />
                Document
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void startRecording()}>
                <Mic className="mr-2 h-4 w-4" />
                Voice note
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <GatedButton
            variant="ghost"
            size="sm"
            canAct={!readOnly}
            gateReason="send messages"
            title={readOnly ? undefined : "Send template"}
            className="h-9 w-9 shrink-0 rounded-full p-0 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={onOpenTemplates}
          >
            <LayoutTemplate className="h-4 w-4" />
          </GatedButton>

          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={
              readOnly
                ? "Read-only — viewers can browse but not reply"
                : sessionExpired
                  ? "Session window closed — send a template to re-engage"
                  : "Type a message... (Shift+Enter for new line)"
            }
            disabled={sessionExpired || readOnly}
            rows={1}
            // Textarea keeps its own inline title — the GatedButton
            // wrapping pattern doesn't apply to non-button inputs.
            // The placeholder text also surfaces the read-only state.
            title={readOnly ? "Read-only — your role can't send messages" : undefined}
            className={cn(
              "flex-1 resize-none rounded-xl border border-border bg-muted px-4 py-2.5 text-sm text-foreground placeholder-muted-foreground outline-none transition-[color,border-color,box-shadow] focus:border-primary/50 focus:ring-2 focus:ring-primary/15",
              (sessionExpired || readOnly) && "cursor-not-allowed opacity-50"
            )}
          />

          <GatedButton
            size="sm"
            canAct={!readOnly}
            gateReason="send messages"
            disabled={!text.trim() || sessionExpired || sending}
            onClick={handleSend}
            className="h-9 w-9 shrink-0 rounded-full bg-primary p-0 hover:bg-primary/90 disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </GatedButton>
        </div>
      )}

      {/* Hint sits outside the flex row so its height doesn't push
          `items-end` buttons below the textarea. Indented to line up
          under the textarea left edge. */}
      {!draft && !recording && (
        <p className="mt-1 pl-[5.5rem] text-[10px] text-muted-foreground">
          Type &apos;/&apos; for quick replies
        </p>
      )}
    </div>
  );
}

/**
 * Staged-attachment preview with caption + send/discard. Declared at
 * module scope (not nested in MessageComposer) so React keeps it mounted
 * across the parent's re-renders — a nested component would remount the
 * caption input on every keystroke and drop focus.
 */
function MediaDraftPreview({
  draft,
  busy,
  readOnly,
  onCaptionChange,
  onDiscard,
  onSend,
}: {
  draft: MediaDraft;
  busy: boolean;
  readOnly: boolean;
  onCaptionChange: (caption: string) => void;
  onDiscard: () => void;
  onSend: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/40 p-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          {draft.kind === "image" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={draft.mediaUrl}
              alt={draft.filename}
              className="max-h-40 rounded-lg object-cover"
            />
          )}
          {draft.kind === "video" && (
            <video src={draft.mediaUrl} controls className="max-h-40 rounded-lg" />
          )}
          {draft.kind === "audio" && (
            <audio src={draft.mediaUrl} controls className="w-full" />
          )}
          {draft.kind === "document" && (
            <div className="flex items-center gap-2 text-sm text-foreground">
              <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
              <span className="truncate">{draft.filename}</span>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onDiscard}
          aria-label="Remove attachment"
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-2 flex items-end gap-2">
        {draft.kind !== "audio" && (
          <input
            value={draft.caption}
            maxLength={MEDIA_CAPTION_MAX}
            onChange={(e) => onCaptionChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            placeholder="Add a caption…"
            className="flex-1 rounded-xl border border-border bg-muted px-4 py-2.5 text-sm text-foreground placeholder-muted-foreground outline-none transition-[color,border-color,box-shadow] focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
          />
        )}
        <GatedButton
          size="sm"
          canAct={!readOnly}
          gateReason="send messages"
          disabled={busy}
          onClick={onSend}
          className={cn(
            "h-9 w-9 shrink-0 rounded-full bg-primary p-0 hover:bg-primary/90 disabled:opacity-40",
            draft.kind === "audio" && "ml-auto",
          )}
        >
          <Send className="h-4 w-4" />
        </GatedButton>
      </div>
    </div>
  );
}
