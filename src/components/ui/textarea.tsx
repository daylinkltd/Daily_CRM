"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { RichTextEditor } from "@/components/ui/rich-text-editor";

export interface TextareaProps extends React.ComponentProps<"textarea"> {
  plain?: boolean;
}

function Textarea({ className, plain, value, onChange, placeholder, disabled, rows, ...props }: TextareaProps) {
  if (plain) {
    return (
      <textarea
        data-slot="textarea"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
        className={cn(
          "flex field-sizing-content min-h-16 w-full rounded-none border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
          className
        )}
        {...props}
      />
    );
  }

  const strValue = String(value ?? "");

  const handleRichChange = (newHtml: string) => {
    if (onChange) {
      const syntheticEvent = {
        target: {
          name: props.name || "",
          value: newHtml,
        },
        currentTarget: {
          name: props.name || "",
          value: newHtml,
        },
      } as unknown as React.ChangeEvent<HTMLTextAreaElement>;
      onChange(syntheticEvent);
    }
  };

  const minH = rows ? `${Math.max(80, rows * 28)}px` : "120px";

  return (
    <RichTextEditor
      value={strValue}
      onChange={handleRichChange}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
      minHeight={minH}
    />
  );
}

export { Textarea };
