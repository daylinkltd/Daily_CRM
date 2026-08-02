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
import { markdownToHtml, sanitizeHtml } from "@/lib/markdown-utils";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
  disabled?: boolean;
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
    const html = e.clipboardData.getData("text/html");
    const text = e.clipboardData.getData("text/plain");
    if (!html && !text) return;
    e.preventDefault();
    if (html) {
      document.execCommand("insertHTML", false, sanitizeHtml(html));
    } else {
      document.execCommand("insertText", false, text);
    }
    handleInput();
  };

  const exec = (command: string, value: string | undefined = undefined) => {
    if (disabled) return;
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    handleInput();
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
      className={`rounded-md border border-input bg-card shadow-sm transition-colors ${
        isFocused ? "ring-2 ring-ring border-transparent" : ""
      } ${disabled ? "opacity-60 pointer-events-none" : ""} ${className}`}
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-border/80 bg-muted/40 p-1.5 text-foreground">
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

        <ToolbarButton onAction={() => toggleBlock("h1")} label="Heading 1" disabled={disabled}>
          <Heading1 className="size-4" />
        </ToolbarButton>
        <ToolbarButton onAction={() => toggleBlock("h2")} label="Heading 2" disabled={disabled}>
          <Heading2 className="size-4" />
        </ToolbarButton>
        <ToolbarButton onAction={() => toggleBlock("h3")} label="Heading 3" disabled={disabled}>
          <Heading3 className="size-4" />
        </ToolbarButton>

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
        <div
          ref={editorRef}
          contentEditable={!disabled}
          onInput={handleInput}
          onPaste={handlePaste}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={{ minHeight }}
          className="rich-text max-w-none overflow-y-auto text-xs leading-relaxed focus:outline-none"
        />
      </div>
    </div>
  );
}
