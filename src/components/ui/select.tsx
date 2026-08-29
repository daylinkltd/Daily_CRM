"use client"

import * as React from "react"
import { Select as SelectPrimitive } from "@base-ui/react/select"

import { cn } from "@/lib/utils"
import { ChevronDownIcon, CheckIcon, ChevronUpIcon, SearchIcon } from "lucide-react"

interface SelectContextType {
  labelsMap: Map<string, string>;
  registerLabel: (value: string, label: string) => void;
  /** Current search text. Empty string = no filtering. */
  query: string;
  setQuery: (q: string) => void;
}

const SelectContext = React.createContext<SelectContextType | null>(null);

/**
 * Case- and whitespace-insensitive substring match. Kept here so the
 * item filter and the "no results" count can never disagree.
 */
function matchesQuery(label: string | undefined, query: string): boolean {
  if (!query.trim()) return true;
  // An item whose label we can't read stays visible — better a stray
  // row than silently hiding a selectable option.
  if (!label) return true;
  return label.toLowerCase().includes(query.trim().toLowerCase());
}

function Select({ children, onOpenChange, ...props }: SelectPrimitive.Root.Props<any>) {
  const [labelsMap, setLabelsMap] = React.useState<Map<string, string>>(() => new Map());
  const [query, setQuery] = React.useState("");

  // Labels read straight off the JSX, before anything mounts.
  //
  // SelectItem registers its label from an effect, but the items live
  // inside the popup and Base UI only mounts those when it opens. So on
  // first paint `labelsMap` was empty, and a trigger holding a UUID had
  // nothing to resolve it with — it fell through to the placeholder and
  // a saved Department/Manager/Designation read as "Select …" until you
  // opened the dropdown, at which point the items mounted, registered,
  // and the real label appeared. The value was never wrong; only its
  // rendering was.
  //
  // Walking the element tree gives every option's label synchronously
  // on the very first render, with no mounting involved.
  const staticLabels = React.useMemo(() => {
    const out = new Map<string, string>();
    collectItemLabels(children, out);
    return out;
  }, [children]);

  // Registered labels win: an item that mounted knows its own rendered
  // text better than a static read of the tree can.
  const mergedLabels = React.useMemo(() => {
    if (labelsMap.size === 0) return staticLabels;
    const out = new Map(staticLabels);
    for (const [k, v] of labelsMap) out.set(k, v);
    return out;
  }, [staticLabels, labelsMap]);

  const registerLabel = React.useCallback((value: string, label: string) => {
    setLabelsMap((prev) => {
      if (prev.get(value) === label) return prev;
      const next = new Map(prev);
      next.set(value, label);
      return next;
    });
  }, []);

  // Reset the filter whenever the popup closes, so reopening always
  // shows the full list rather than the previous search.
  const handleOpenChange = React.useCallback(
    (open: boolean, eventDetails: any) => {
      if (!open) setQuery("");
      onOpenChange?.(open, eventDetails);
    },
    [onOpenChange]
  );

  return (
    <SelectContext.Provider value={{ labelsMap: mergedLabels, registerLabel, query, setQuery }}>
      <SelectPrimitive.Root onOpenChange={handleOpenChange} {...props}>
        {children}
      </SelectPrimitive.Root>
    </SelectContext.Provider>
  );
}

function SelectGroup({ className, ...props }: SelectPrimitive.Group.Props) {
  return (
    <SelectPrimitive.Group
      data-slot="select-group"
      className={cn("scroll-my-1 p-1", className)}
      {...props}
    />
  )
}

function SelectValue({
  className,
  placeholder,
  children,
  ...props
}: SelectPrimitive.Value.Props & { placeholder?: string }) {
  const ctx = React.useContext(SelectContext);

  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={cn("flex flex-1 text-left", className)}
      {...props}
    >
      {(val: any) => {
        if (children) {
          if (typeof children === "function") {
            return (children as any)(val);
          }
          return children;
        }
        if (val === undefined || val === null || val === "" || val === "none") {
          if (val === "none" && ctx?.labelsMap.has("none")) {
            return ctx.labelsMap.get("none");
          }
          return placeholder;
        }
        const valStr = String(val);
        const mappedLabel = ctx?.labelsMap.get(valStr);
        if (mappedLabel) return mappedLabel;
        if (/^[0-9a-fA-F-]{32,36}$/.test(valStr)) {
          return placeholder ?? "-- Select --";
        }
        return valStr;
      }}
    </SelectPrimitive.Value>
  )
}

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: SelectPrimitive.Trigger.Props & {
  size?: "sm" | "default"
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "flex w-full items-center justify-between gap-1.5 rounded-none border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-placeholder:text-muted-foreground data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {children}
      <ChevronDownIcon className="pointer-events-none size-4 text-muted-foreground shrink-0 opacity-70" />
    </SelectPrimitive.Trigger>
  )
}

/** Keys that must reach Base UI so the list stays navigable from the
 *  search box. Everything else is text input and is kept local. */
const NAV_KEYS = new Set([
  "ArrowDown",
  "ArrowUp",
  "Enter",
  "Escape",
  "Tab",
  "PageDown",
  "PageUp",
  "Home",
  "End",
]);

function SelectSearch({ placeholder }: { placeholder?: string }) {
  const ctx = React.useContext(SelectContext);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Base UI focuses the selected item when the popup opens, so claim
  // focus on the next frame instead of fighting it with autoFocus.
  React.useEffect(() => {
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      data-slot="select-search"
      className="sticky top-0 z-20 flex items-center gap-1.5 border-b border-border bg-popover px-2"
    >
      <SearchIcon className="size-3.5 shrink-0 text-muted-foreground" />
      <input
        ref={inputRef}
        type="text"
        value={ctx?.query ?? ""}
        onChange={(e) => ctx?.setQuery(e.target.value)}
        placeholder={placeholder ?? "Search..."}
        // Base UI's Select runs a typeahead that jumps to items as you
        // type; without this it would swallow every keystroke meant
        // for this box. Navigation keys are deliberately let through.
        onKeyDown={(e) => {
          if (!NAV_KEYS.has(e.key)) e.stopPropagation();
        }}
        className="h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        aria-label={placeholder ?? "Search options"}
      />
    </div>
  );
}

function SelectEmpty() {
  const ctx = React.useContext(SelectContext);
  const query = ctx?.query ?? "";
  if (!query.trim() || !ctx || ctx.labelsMap.size === 0) return null;
  const anyMatch = [...ctx.labelsMap.values()].some((l) => matchesQuery(l, query));
  if (anyMatch) return null;
  return (
    <div className="px-2.5 py-4 text-center text-sm text-muted-foreground">
      No results found.
    </div>
  );
}

function SelectContent({
  className,
  children,
  side = "bottom",
  sideOffset = 4,
  align = "start",
  alignOffset = 0,
  alignItemWithTrigger = false,
  searchable = true,
  searchPlaceholder,
  ...props
}: SelectPrimitive.Popup.Props &
  Pick<
    SelectPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset" | "alignItemWithTrigger"
  > & {
    /** Every dropdown is searchable by default; opt out per-use. */
    searchable?: boolean
    searchPlaceholder?: string
  }) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        alignItemWithTrigger={alignItemWithTrigger}
        className="isolate z-50"
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          data-align-trigger={alignItemWithTrigger}
          className={cn("relative isolate z-50 max-h-(--available-height) min-w-(--anchor-width) w-max max-w-md origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-none bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-[align-trigger=true]:animate-none data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95", className )}
          {...props}
        >
          {searchable ? <SelectSearch placeholder={searchPlaceholder} /> : null}
          <SelectScrollUpButton />
          <SelectPrimitive.List>{children}</SelectPrimitive.List>
          {searchable ? <SelectEmpty /> : null}
          <SelectScrollDownButton />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
}

function SelectLabel({
  className,
  ...props
}: SelectPrimitive.GroupLabel.Props) {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-label"
      className={cn("px-1.5 py-1 text-xs text-muted-foreground", className)}
      {...props}
    />
  )
}

/**
 * Flatten an item's children into searchable text. Recurses through
 * elements (not just strings and arrays) so that items rendering an
 * icon beside a label — or wrapping the label in a span — are still
 * matchable by the search filter.
 */
function getLabelFromChildren(children: React.ReactNode): string | undefined {
  if (typeof children === "string" || typeof children === "number") {
    return String(children);
  }
  if (Array.isArray(children)) {
    const text = children.map(getLabelFromChildren).filter(Boolean).join(" ").trim();
    return text || undefined;
  }
  if (React.isValidElement(children)) {
    const nested = (children.props as { children?: React.ReactNode })?.children;
    return nested === undefined ? undefined : getLabelFromChildren(nested);
  }
  return undefined;
}

/**
 * Walk a Select's children and collect every `value -> label` pair it
 * can see, without rendering anything. Elements that carry a `value`
 * prop and resolvable text are treated as options; everything else is
 * recursed into so items nested in fragments, groups or `.map()` output
 * are all found.
 *
 * Options produced by a component that renders SelectItem internally
 * are invisible here — those still resolve on first open, exactly as
 * before.
 */
export function collectItemLabels(
  node: React.ReactNode,
  out: Map<string, string>,
): void {
  React.Children.forEach(node, (child) => {
    if (!React.isValidElement(child)) return;
    const props = child.props as {
      value?: unknown;
      label?: string;
      children?: React.ReactNode;
    };

    if (props.value !== undefined && props.value !== null) {
      const label = props.label ?? getLabelFromChildren(props.children);
      if (label) out.set(String(props.value), label);
    }

    if (props.children) collectItemLabels(props.children, out);
  });
}

function SelectItem({
  className,
  children,
  value,
  label,
  ...props
}: SelectPrimitive.Item.Props & { label?: string }) {
  const ctx = React.useContext(SelectContext);
  const itemLabel = label ?? getLabelFromChildren(children);

  React.useEffect(() => {
    if (ctx && value !== undefined && itemLabel) {
      ctx.registerLabel(String(value), itemLabel);
    }
  }, [ctx, value, itemLabel]);

  // Unmount rather than hide non-matching items: a hidden-but-mounted
  // option stays reachable by Base UI's keyboard navigation, which
  // would let you arrow onto an item the filter says isn't there.
  // The effect above still runs first, so the label stays registered
  // for rendering the trigger's selected value.
  if (!matchesQuery(itemLabel, ctx?.query ?? "")) return null;

  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      value={value}
      label={itemLabel}
      className={cn(
        "relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
        className
      )}
      {...props}
    >
      <SelectPrimitive.ItemText className="flex flex-1 shrink-0 gap-2 whitespace-nowrap">
        {children}
      </SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator
        render={
          <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center" />
        }
      >
        <CheckIcon className="pointer-events-none" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  )
}

function SelectSeparator({
  className,
  ...props
}: SelectPrimitive.Separator.Props) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("pointer-events-none -mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  )
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpArrow>) {
  return (
    <SelectPrimitive.ScrollUpArrow
      data-slot="select-scroll-up-button"
      className={cn(
        "top-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <ChevronUpIcon
      />
    </SelectPrimitive.ScrollUpArrow>
  )
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownArrow>) {
  return (
    <SelectPrimitive.ScrollDownArrow
      data-slot="select-scroll-down-button"
      className={cn(
        "bottom-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <ChevronDownIcon
      />
    </SelectPrimitive.ScrollDownArrow>
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
