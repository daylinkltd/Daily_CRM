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
import { markdownToHtml } from "@/lib/markdown-utils";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
  disabled?: boolean;
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

  const exec = (command: string, value: string | undefined = undefined) => {
    if (disabled) return;
    editorRef.current?.focus();
    document.execCommand(command, false, value);
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
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="size-8 p-0"
          onClick={() => exec("bold")}
          title="Bold (Ctrl+B)"
        >
          <Bold className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="size-8 p-0"
          onClick={() => exec("italic")}
          title="Italic (Ctrl+I)"
        >
          <Italic className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="size-8 p-0"
          onClick={() => exec("underline")}
          title="Underline (Ctrl+U)"
        >
          <Underline className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="size-8 p-0"
          onClick={() => exec("strikeThrough")}
          title="Strikethrough"
        >
          <Strikethrough className="size-4" />
        </Button>

        <div className="h-4 w-px bg-border mx-0.5" />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="size-8 p-0"
          onClick={() => exec("formatBlock", "<h1>")}
          title="Heading 1"
        >
          <Heading1 className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="size-8 p-0"
          onClick={() => exec("formatBlock", "<h2>")}
          title="Heading 2"
        >
          <Heading2 className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="size-8 p-0"
          onClick={() => exec("formatBlock", "<h3>")}
          title="Heading 3"
        >
          <Heading3 className="size-4" />
        </Button>

        <div className="h-4 w-px bg-border mx-0.5" />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="size-8 p-0"
          onClick={() => exec("insertUnorderedList")}
          title="Bullet List"
        >
          <List className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="size-8 p-0"
          onClick={() => exec("insertOrderedList")}
          title="Numbered List"
        >
          <ListOrdered className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="size-8 p-0"
          onClick={() => exec("formatBlock", "<blockquote>")}
          title="Quote"
        >
          <Quote className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="size-8 p-0"
          onClick={() => exec("formatBlock", "<pre>")}
          title="Code Block"
        >
          <Code className="size-4" />
        </Button>

        <div className="h-4 w-px bg-border mx-0.5" />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="size-8 p-0"
          onClick={handleAddLink}
          title="Insert Link"
        >
          <LinkIcon className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="size-8 p-0"
          onClick={() => exec("removeFormat")}
          title="Clear Formatting"
        >
          <RemoveFormatting className="size-4" />
        </Button>

        <div className="ml-auto flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="size-8 p-0 text-muted-foreground"
            onClick={() => exec("undo")}
            title="Undo"
          >
            <RotateCcw className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="size-8 p-0 text-muted-foreground"
            onClick={() => exec("redo")}
            title="Redo"
          >
            <RotateCw className="size-3.5" />
          </Button>
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
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={{ minHeight }}
          className="prose dark:prose-invert max-w-none text-xs focus:outline-none leading-relaxed overflow-y-auto"
        />
      </div>
    </div>
  );
}
