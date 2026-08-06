import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-md border border-transparent px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary/10 text-primary border-primary/20",
        primary: "bg-primary text-primary-foreground",
        secondary:
          "bg-secondary text-secondary-foreground border-border/40",
        outline:
          "border-border text-foreground bg-background",
        destructive:
          "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
        success:
          "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
        warning:
          "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
        ghost:
          "hover:bg-muted text-muted-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
