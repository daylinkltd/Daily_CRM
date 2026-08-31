"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  Code,
  Link as LinkIcon,
  RotateCcw,
  RotateCw,
  RemoveFormatting,
} from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";
import { normalisePastedHtml } from "@/lib/paste-normalise";
import {
  textDraftKey,
  parseTextDraft,
  serializeTextDraft,
  describeAge,
} from "@/lib/tables/draft-storage";
import { markdownToHtml, sanitizeHtml } from "@/lib/markdown-utils";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
  disabled?: boolean;
  /**
   * Distinguishes this editor's draft from others on the same page. Only
   * needed when a page has more than one rich editor; otherwise the route
   * is enough.
   */
  draftScope?: string;
  /** Set false for a field where local recovery is unwanted. */
  autosave?: boolean;
}


/**
 * Toolbar button.
 *
 * `onMouseDown` preventDefault is the load-bearing part: without it,
 * pressing a toolbar button moves focus to the button and the browser
 * DISCARDS the contentEditable selection. execCommand then has no range
 * to act on, so heading, list, bold — everything needing a selection —
 * silently did nothing. Re-focusing afterwards does not help, because the
 * range is already gone.
 *
 * Declared at module scope, not inside the editor: a component created
 * during render is a new type on every keystroke, which remounts every
 * button and throws away their DOM state.
 */
function ToolbarButton({
  onAction,
  label,
  disabled,
  className,
  children,
}: {
  onAction: () => void;
  label: string;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      title={label}
      aria-label={label}
      disabled={disabled}
      className={cn("size-8 p-0", className)}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onAction}
    >
      {children}
    </Button>
  );
}

export function RichTextEditor({
  draftScope,
  autosave = true,
  value,
  onChange,
  placeholder = "Write content here...",
  className = "",
  minHeight = "160px",
  disabled = false,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isUpdatingRef = useRef(false);
  const [isFocused, setIsFocused] = useState(false);

  // Synchronize internal innerHTML when external `value` prop changes
  useEffect(() => {
    if (!editorRef.current) return;
    if (isUpdatingRef.current) {
      isUpdatingRef.current = false;
      return;
    }
    const formattedHtml = markdownToHtml(value || "");
    if (editorRef.current.innerHTML !== formattedHtml) {
      editorRef.current.innerHTML = formattedHtml;
    }
  }, [value]);

  /**
   * Crash recovery for long-form text.
   *
   * Motivating incident: someone typed a long policy, the tab closed, and
   * the work was gone with no way to recover it. Every rich editor now
   * keeps a local draft as you type.
   *
   * Two deliberate constraints:
   *  * The draft is OFFERED, never auto-applied. Silently replacing what
   *    the server sent could let a stale draft clobber a colleague's newer
   *    edit, and the person would never know.
   *  * The key is derived from the route so this works with no changes at
   *    any of the 31 call sites. `draftScope` disambiguates a page with
   *    more than one editor.
   */
  const scope =
    draftScope ??
    (typeof window !== "undefined" ? `${window.location.pathname}:${placeholder ?? "body"}` : "");
  const storageKey = textDraftKey(scope);

  const [recovered, setRecovered] = useState<{ html: string; at: number; baseChanged: boolean } | null>(null);
  const [draftDismissed, setDraftDismissed] = useState(false);
  const [blockValue, setBlockValue] = useState("p");
  const [fontSizeValue, setFontSizeValue] = useState("3");
  // Position of the floating selection toolbar, null when nothing is selected.
  const [bubble, setBubble] = useState<{ top: number; left: number } | null>(null);
  // What the server gave us when this editor mounted, so a draft can tell
  // whether the underlying record has since changed.
  const baseValueRef = useRef(value);

  // Offer any surviving draft once, on mount.
  useEffect(() => {
    if (!autosave || disabled || typeof window === "undefined") return;
    const found = parseTextDraft(window.localStorage.getItem(storageKey), value, Date.now());
    if (found) setRecovered(found);
    // Intentionally mount-only: re-running as `value` changes would keep
    // re-offering a draft the user has already dismissed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist as the user types, debounced so we are not writing per keystroke.
  useEffect(() => {
    if (!autosave || disabled || typeof window === "undefined") return;
    const t = setTimeout(() => {
      const payload = serializeTextDraft(value, baseValueRef.current, Date.now());
      if (payload) window.localStorage.setItem(storageKey, payload);
      // Content now matches what was loaded — it has been saved, so stop
      // holding a draft that would nag on the next visit.
      else window.localStorage.removeItem(storageKey);
    }, 600);
    return () => clearTimeout(t);
  }, [value, autosave, disabled, storageKey]);

  /**
   * Show the floating toolbar over a non-empty selection inside this
   * editor, so formatting is reachable without scrolling to the top of a
   * long document.
   */
  const updateBubble = () => {
    if (disabled || typeof window === "undefined") return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      setBubble(null);
      return;
    }
    const range = sel.getRangeAt(0);
    // Only for selections that belong to THIS editor — several can be on
    // one page.
    if (!editorRef.current?.contains(range.commonAncestorContainer)) {
      setBubble(null);
      return;
    }
    const rect = range.getBoundingClientRect();
    const host = editorRef.current.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      setBubble(null);
      return;
    }
    setBubble({
      // Relative to the editor shell, which is the positioning context.
      top: rect.top - host.top - 44,
      left: Math.max(4, rect.left - host.left + rect.width / 2 - 90),
    });
    setBlockValue(currentBlock());
  };

  useEffect(() => {
    if (disabled) return;
    const onSelectionChange = () => updateBubble();
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);

  const handleInput = () => {
    if (!editorRef.current) return;
    isUpdatingRef.current = true;
    const html = editorRef.current.innerHTML;
    // Clean empty breaks
    const cleanHtml = html === "<br>" || html === "<div><br></div>" ? "" : html;
    onChange(cleanHtml);
  };

  /**
   * A contenteditable accepts the clipboard's full HTML, so pasting
   * from a web page or Word can carry scripts, event handlers and a
   * mountain of foreign styling. Insert an allowlisted version
   * instead. Rendering sanitises again (defence in depth), but
   * cleaning here keeps what we *store* clean too.
   */
  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const items = Array.from(e.clipboardData.items);
    const imageItem = items.find((item) => item.type.startsWith("image/"));

    if (imageItem) {
      e.preventDefault();
      const file = imageItem.getAsFile();
      if (file) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          const src = evt.target?.result as string;
          if (src) {
            document.execCommand(
              "insertHTML",
              false,
              `<img src="${src}" alt="Pasted Image" class="max-w-full h-auto rounded my-2 border border-border" />`
            );
            handleInput();
          }
        };
        reader.readAsDataURL(file);
      }
      return;
    }

    const html = e.clipboardData.getData("text/html");
    const text = e.clipboardData.getData("text/plain");
    if (!html && !text) return;
    e.preventDefault();
    if (html) {
      document.execCommand("insertHTML", false, sanitizeHtml(normalisePastedHtml(html)));
    } else {
      document.execCommand("insertText", false, text);
    }
    handleInput();
  };

  const exec = (command: string, value: string | undefined = undefined) => {
    if (disabled) return;
    editorRef.current?.focus();
    // THE fix for "bold does not survive a save". With styleWithCSS on —
    // which is the default in some engines and gets switched on implicitly
    // by other operations — the browser emits
    // `<span style="font-weight:700">` instead of `<b>`. The sanitiser
    // strips `style` (correctly; it carries url() and expression()), so the
    // formatting was thrown away on save and came back plain. Off, the
    // browser emits semantic tags, which the allowlist keeps.
    try {
      document.execCommand("styleWithCSS", false, "false");
    } catch {
      // Not supported everywhere; the command below still runs.
    }
    document.execCommand(command, false, value);
    handleInput();
  };

  /** Font size 1–7 as execCommand understands it, labelled in points. */
  const FONT_SIZES: { value: string; label: string }[] = [
    { value: "1", label: "8 pt" },
    { value: "2", label: "10 pt" },
    { value: "3", label: "12 pt" },
    { value: "4", label: "14 pt" },
    { value: "5", label: "18 pt" },
    { value: "6", label: "24 pt" },
    { value: "7", label: "36 pt" },
  ];

  const BLOCK_OPTIONS: { value: string; label: string }[] = [
    { value: "p", label: "Normal text" },
    { value: "h1", label: "Heading 1" },
    { value: "h2", label: "Heading 2" },
    { value: "h3", label: "Heading 3" },
    { value: "blockquote", label: "Quote" },
    { value: "pre", label: "Code block" },
  ];

  /** The block tag the caret currently sits in, for the dropdown. */
  const currentBlock = (): string => {
    try {
      const v = (document.queryCommandValue("formatBlock") || "").toLowerCase().replace(/[<>]/g, "");
      return BLOCK_OPTIONS.some((o) => o.value === v) ? v : "p";
    } catch {
      return "p";
    }
  };

  /**
   * Sets the block directly rather than toggling. A dropdown showing the
   * current value makes "turn this heading back into normal text" an
   * explicit choice — pressing an H1 button to undo an H1 was the part
   * people could not find.
   */
  const applyBlock = (tag: string) => {
    if (disabled) return;
    editorRef.current?.focus();
    try {
      document.execCommand("styleWithCSS", false, "false");
    } catch {
      /* ignore */
    }
    document.execCommand("formatBlock", false, tag);
    handleInput();
    setBlockValue(tag);
  };

  /**
   * Block formatting is a TOGGLE, not a one-way apply.
   *
   * Calling formatBlock("h1") on a selection that is already an h1
   * produced nested `<h1><h1>…</h1></h1>`, and that malformed nesting
   * then broke later commands — a bullet list applied over it silently
   * did nothing. Pressing the active heading now returns the block to a
   * paragraph, which is what every editor does and what stops the
   * nesting.
   */
  const toggleBlock = (tag: string) => {
    if (disabled) return;
    editorRef.current?.focus();
    let current = "";
    try {
      current = (document.queryCommandValue("formatBlock") || "").toLowerCase();
    } catch {
      current = "";
    }
    // Engines report this as either "h1" or "<h1>".
    const normalised = current.replace(/[<>]/g, "");
    document.execCommand("formatBlock", false, normalised === tag ? "p" : tag);
    handleInput();
  };

  const handleAddLink = () => {
    if (disabled) return;
    const url = prompt("Enter URL:", "https://");
    if (url) {
      exec("createLink", url);
    }
  };

  const isEmpty = !value || value === "<br>" || value === "<div><br></div>";

  return (
    <div
      className={`relative rounded-md border border-input bg-card shadow-sm transition-colors ${
        isFocused ? "ring-2 ring-ring border-transparent" : ""
      } ${disabled ? "opacity-60 pointer-events-none" : ""} ${className}`}
    >
      {recovered && !draftDismissed && (
        <div className="flex flex-wrap items-center gap-2 border-b border-amber-500/25 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-800 dark:text-amber-300">
          <RotateCcw className="size-3.5 shrink-0" />
          <span className="min-w-0 flex-1">
            Unsaved text from {describeAge(recovered.at, Date.now())} was recovered
            {recovered.baseChanged
              ? " — but this record has changed since, so restoring will replace the current text."
              : "."}
          </span>
          <button
            type="button"
            onClick={() => {
              // Applied only on request: the draft may be older than what
              // the server now holds.
              onChange(recovered.html);
              if (editorRef.current) editorRef.current.innerHTML = recovered.html;
              setDraftDismissed(true);
            }}
            className="shrink-0 rounded-md bg-amber-600 px-2 py-1 font-medium text-white"
          >
            Restore it
          </button>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") window.localStorage.removeItem(storageKey);
              setDraftDismissed(true);
            }}
            className="shrink-0 rounded-md px-2 py-1 font-medium underline"
          >
            Discard
          </button>
        </div>
      )}

      {/* Toolbar. `sticky` so it stays reachable partway down a long
          document instead of forcing a scroll back to the top. It sticks to
          the top of the nearest scroll container, which is the editor's own
          overflow area or the dialog body. */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-1 rounded-t-md border-b border-border/80 bg-muted/95 p-1.5 text-foreground backdrop-blur supports-[backdrop-filter]:bg-muted/80">
        <ToolbarButton onAction={() => exec("bold")} label="Bold (Ctrl+B)" disabled={disabled}>
          <Bold className="size-4" />
        </ToolbarButton>
        <ToolbarButton onAction={() => exec("italic")} label="Italic (Ctrl+I)" disabled={disabled}>
          <Italic className="size-4" />
        </ToolbarButton>
        <ToolbarButton onAction={() => exec("underline")} label="Underline (Ctrl+U)" disabled={disabled}>
          <Underline className="size-4" />
        </ToolbarButton>
        <ToolbarButton onAction={() => exec("strikeThrough")} label="Strikethrough" disabled={disabled}>
          <Strikethrough className="size-4" />
        </ToolbarButton>

        <div className="h-4 w-px bg-border mx-0.5" />

        <select
          aria-label="Paragraph style"
          value={blockValue}
          disabled={disabled}
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => applyBlock(e.target.value)}
          className="h-7 rounded-md border border-input bg-background px-1.5 text-[11px]"
        >
          {BLOCK_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <select
          aria-label="Font size"
          value={fontSizeValue}
          disabled={disabled}
          onChange={(e) => {
            setFontSizeValue(e.target.value);
            exec("fontSize", e.target.value);
          }}
          className="h-7 rounded-md border border-input bg-background px-1.5 text-[11px]"
        >
          {FONT_SIZES.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>


        <div className="h-4 w-px bg-border mx-0.5" />

        <ToolbarButton onAction={() => exec("insertUnorderedList")} label="Bullet List" disabled={disabled}>
          <List className="size-4" />
        </ToolbarButton>
        <ToolbarButton onAction={() => exec("insertOrderedList")} label="Numbered List" disabled={disabled}>
          <ListOrdered className="size-4" />
        </ToolbarButton>
        <ToolbarButton onAction={() => toggleBlock("blockquote")} label="Quote" disabled={disabled}>
          <Quote className="size-4" />
        </ToolbarButton>
        <ToolbarButton onAction={() => toggleBlock("pre")} label="Code Block" disabled={disabled}>
          <Code className="size-4" />
        </ToolbarButton>

        <div className="h-4 w-px bg-border mx-0.5" />

        <ToolbarButton onAction={handleAddLink} label="Insert Link" disabled={disabled}>
          <LinkIcon className="size-4" />
        </ToolbarButton>
        <ToolbarButton onAction={() => exec("removeFormat")} label="Clear Formatting" disabled={disabled}>
          <RemoveFormatting className="size-4" />
        </ToolbarButton>

        <div className="ml-auto flex items-center gap-0.5">
          <ToolbarButton onAction={() => exec("undo")} label="Undo" disabled={disabled}>
            <RotateCcw className="size-3.5" />
          </ToolbarButton>
          <ToolbarButton onAction={() => exec("redo")} label="Redo" disabled={disabled}>
            <RotateCw className="size-3.5" />
          </ToolbarButton>
        </div>
      </div>

      {/* Editor Content Area */}
      <div className="relative p-3">
        {isEmpty && !isFocused && (
          <div className="pointer-events-none absolute left-3 top-3 text-xs text-muted-foreground select-none">
            {placeholder}
          </div>
        )}
        {bubble && !disabled && (
          <div
            // Appears over the selection so formatting is reachable in a
            // long document without going back to the toolbar.
            style={{ top: bubble.top, left: bubble.left }}
            className="absolute z-30 flex items-center gap-0.5 rounded-lg border border-border bg-popover px-1 py-0.5 shadow-lg"
            // Keep the selection alive: any focus change would collapse it
            // and leave execCommand with nothing to act on.
            onMouseDown={(e) => e.preventDefault()}
          >
            <ToolbarButton onAction={() => exec("bold")} label="Bold" disabled={disabled}>
              <Bold className="size-3.5" />
            </ToolbarButton>
            <ToolbarButton onAction={() => exec("italic")} label="Italic" disabled={disabled}>
              <Italic className="size-3.5" />
            </ToolbarButton>
            <ToolbarButton onAction={() => exec("underline")} label="Underline" disabled={disabled}>
              <Underline className="size-3.5" />
            </ToolbarButton>
            <div className="mx-0.5 h-4 w-px bg-border" />
            <select
              aria-label="Paragraph style"
              value={blockValue}
              onChange={(e) => applyBlock(e.target.value)}
              className="h-6 rounded border border-input bg-background px-1 text-[11px]"
            >
              {BLOCK_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <select
              aria-label="Font size"
              value={fontSizeValue}
              onChange={(e) => {
                setFontSizeValue(e.target.value);
                exec("fontSize", e.target.value);
              }}
              className="h-6 rounded border border-input bg-background px-1 text-[11px]"
            >
              {FONT_SIZES.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ToolbarButton onAction={handleAddLink} label="Insert link" disabled={disabled}>
              <LinkIcon className="size-3.5" />
            </ToolbarButton>
          </div>
        )}

        <div
          ref={editorRef}
          contentEditable={!disabled}
          onInput={handleInput}
          onPaste={handlePaste}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false);
            // Delayed: clicking the bubble itself blurs the editor, and
            // removing it immediately would cancel the click.
            setTimeout(() => setBubble(null), 200);
          }}
          onKeyUp={updateBubble}
          onMouseUp={updateBubble}
          style={{ minHeight }}
          className="rich-text max-w-none overflow-y-auto text-xs leading-relaxed focus:outline-none"
        />
      </div>
    </div>
  );
}
