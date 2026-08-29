"use client";

import * as React from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * A searchable dropdown wearing the native `<select>` API.
 *
 * The app has one dropdown component — `Select` — and it has been
 * searchable by default for a while. But 94 places across 48 files
 * still used a raw `<select>`, so whether you could type to find an
 * option depended entirely on which screen you were standing on. In a
 * list of 200 ledgers or 30 staff that is the difference between a
 * usable field and a scrolling exercise.
 *
 * Rewriting 94 JSX blocks by hand would have meant 94 chances to break
 * a form. This takes the other route: identical props to `<select>` —
 * `value`, `onChange` with `e.target.value`, `className`, `disabled` —
 * and `<option>` children read straight off the element tree. So the
 * change at each call site is the tag name, and every one of them
 * inherits search, keyboard navigation and consistent styling.
 *
 * `onChange` receives an object shaped like the change event those call
 * sites already destructure, which is why none of them needed touching.
 */

interface OptionData {
  value: string;
  label: string;
  disabled?: boolean;
}

/** Read `<option>` descendants without rendering them. */
function collectOptions(node: React.ReactNode, out: OptionData[]): void {
  React.Children.forEach(node, (child) => {
    if (!React.isValidElement(child)) return;
    const props = child.props as {
      value?: unknown;
      disabled?: boolean;
      children?: React.ReactNode;
    };

    if (child.type === "option") {
      const label = textOf(props.children);
      out.push({
        value: String(props.value ?? label ?? ""),
        label: label || String(props.value ?? ""),
        disabled: props.disabled,
      });
      return;
    }

    // Fragments, `.map()` output and wrapper elements all recurse, so
    // options built in a loop are found the same as literal ones.
    if (props.children) collectOptions(props.children, out);
  });
}

/** Flatten an option's children to its visible text. */
function textOf(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (React.isValidElement(node)) {
    return textOf((node.props as { children?: React.ReactNode }).children);
  }
  return "";
}

/**
 * Base UI treats "" as "nothing selected", so an `<option value="">`
 * cannot be a selectable item — it becomes the placeholder instead,
 * which is what those options always meant ("-- Select a task --").
 */
const EMPTY = "";

export interface NativeSelectProps
  extends Omit<
    React.SelectHTMLAttributes<HTMLSelectElement>,
    "onChange" | "value" | "multiple" | "size"
  > {
  value?: string | number | null;
  onChange?: (event: { target: { value: string; name?: string } }) => void;
  /** Text shown when nothing is chosen. Defaults to the "" option's label. */
  placeholder?: string;
  children?: React.ReactNode;
}

export function NativeSelect({
  value,
  onChange,
  children,
  className,
  disabled,
  name,
  id,
  placeholder,
  required,
  "aria-label": ariaLabel,
  ...rest
}: NativeSelectProps) {
  const options = React.useMemo(() => {
    const out: OptionData[] = [];
    collectOptions(children, out);
    return out;
  }, [children]);

  const emptyOption = options.find((o) => o.value === EMPTY);
  const selectable = options.filter((o) => o.value !== EMPTY);

  const current = value === null || value === undefined ? EMPTY : String(value);

  return (
    <Select
      value={current}
      onValueChange={(next) => {
        // Base UI can emit null when clearing; treat that as the empty
        // choice rather than passing null to a handler expecting a string.
        onChange?.({ target: { value: (next as string) ?? EMPTY, name } });
      }}
      disabled={disabled}
      {...rest}
    >
      <SelectTrigger
        id={id}
        aria-label={ariaLabel}
        aria-required={required}
        className={className}
      >
        <SelectValue placeholder={placeholder ?? emptyOption?.label ?? "Select…"} />
      </SelectTrigger>
      <SelectContent>
        {selectable.map((o, i) => (
          <SelectItem key={`${o.value}-${i}`} value={o.value} disabled={o.disabled}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
