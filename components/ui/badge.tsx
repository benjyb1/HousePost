import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

// Paper labels: 3px corners, never a pill. Navy for "on", navy tint for
// neutral facts, muted red only for something that went wrong.
const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-[3px] border border-transparent px-1.5 py-0.5 text-xs font-semibold leading-tight w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy aria-invalid:border-[#8a3324] transition-colors overflow-hidden",
  {
    variants: {
      variant: {
        default: "bg-navy text-paper [a&]:hover:bg-navy-hi",
        secondary: "bg-navy-tint text-navy-ink [a&]:hover:bg-[#d8dfeb]",
        destructive: "bg-[#f6e7e3] text-[#8a3324] [a&]:hover:bg-[#f0dad4]",
        outline: "border-line-2 text-ink [a&]:hover:bg-accent",
        ghost: "text-ink-2 [a&]:hover:bg-accent [a&]:hover:text-ink",
        link: "text-navy-ink underline-offset-4 [a&]:hover:underline",
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
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
