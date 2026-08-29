"use client";

import * as React from "react";

import { RichTextEditor } from "@/components/ui/rich-text-editor";

/**
 * The rich text editor wearing the plain `<Textarea>` API.
 *
 * Same trick as NativeSelect, for the same reason: dozens of call sites
 * already pass `value` and an `onChange` that reads `e.target.value`,
 * and rewriting each one by hand is dozens of chances to break a form.
 * This adapts the event shape so a call site changes only its tag name,
 * and every converted field gets the toolbar, formatting and — via the
 * editor's autosave — draft recovery after an accidental reload.
 *
 * WHERE THIS IS DELIBERATELY *NOT* USED
 *
 * A rich editor stores HTML. That is right for prose someone writes and
 * the app renders, and wrong wherever the value leaves the app as plain
 * text:
 *
 *   • WhatsApp and SMS bodies — those channels render no HTML, so
 *     `<p><strong>Hi</strong></p>` arrives at the customer literally,
 *     and SMS segment counts break on the tag characters.
 *   • Social captions — same, plus per-platform length limits.
 *   • Accounting narration — shown in day books, ledgers and PDFs as
 *     plain strings.
 *   • Table-cell inputs and public form fields — a toolbar inside a
 *     one-row grid cell, or in front of a respondent, is noise.
 *
 * Those keep `<Textarea>`. Everything else uses this.
 */

export interface RichTextAreaProps {
  value?: string | number | null;
  onChange?: (event: { target: { value: string; name?: string } }) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  name?: string;
  id?: string;
  required?: boolean;
  /** Rows from the old textarea become a sensible minimum height. */
  rows?: number;
  /**
   * Distinguishes this field's draft from other editors on the page.
   * Pass one wherever a screen has more than one.
   */
  draftScope?: string;
  /** Set false where local draft recovery is unwanted. */
  autosave?: boolean;
  "aria-label"?: string;
  /**
   * Accepted and ignored. `plain` strips the old textarea's border so a
   * parent could draw its own; the editor brings its own chrome.
   * `autoFocus` and `onKeyDown` targeted the raw element and have no
   * equivalent on a contentEditable surface — accepting them keeps the
   * call sites unchanged rather than scattering conditional props.
   */
  plain?: boolean;
  autoFocus?: boolean;
  onKeyDown?: React.KeyboardEventHandler;
}

export function RichTextArea({
  value,
  onChange,
  placeholder,
  className,
  disabled,
  name,
  id,
  rows,
  draftScope,
  autosave,
}: RichTextAreaProps) {
  const minHeight = rows ? `${Math.max(2, rows) * 24 + 16}px` : undefined;

  return (
    <div id={id} className={className}>
      <RichTextEditor
        value={value === null || value === undefined ? "" : String(value)}
        onChange={(next) => onChange?.({ target: { value: next, name } })}
        placeholder={placeholder}
        disabled={disabled}
        minHeight={minHeight}
        draftScope={draftScope}
        autosave={autosave}
      />
    </div>
  );
}
