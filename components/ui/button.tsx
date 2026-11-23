import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

// Paper buttons: navy fill with paper text and 3px corners for the main action,
// a transparent button with a 1px inset line for quieter ones, and navy text
// for the quietest. Colours are the @theme tokens in app/globals.css.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[3px] text-sm font-semibold transition-colors cursor-pointer disabled:pointer-events-none disabled:opacity-55 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy aria-invalid:outline-solid aria-invalid:outline-2 aria-invalid:outline-[#8a3324]",
  {
    variants: {
      variant: {
        default: "bg-navy text-paper hover:bg-navy-hi",
        destructive:
          "bg-[#8a3324] text-paper hover:bg-[#742a1e] focus-visible:outline-[#8a3324]",
        outline:
          "bg-transparent text-ink shadow-[inset_0_0_0_1px_var(--color-line-2)] hover:bg-accent",
        secondary:
          "bg-paper-hi text-ink shadow-[inset_0_0_0_1px_var(--color-line-2)] hover:bg-accent",
        ghost:
          "bg-transparent text-navy-ink shadow-none hover:bg-accent",
        link: "bg-transparent text-navy-ink shadow-none underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 has-[>svg]:px-3.5",
        xs: "h-7 gap-1 px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-11 px-6 text-[15px] has-[>svg]:px-4",
        icon: "size-10",
        "icon-xs": "size-7 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
