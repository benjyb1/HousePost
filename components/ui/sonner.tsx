"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

// Paper toasts: a paper-hi card with a 1px line border, 8px corners and a soft
// warm shadow. The richColors variables are set too, so a caller passing
// `richColors` still gets Paper rather than sonner's bright green and red:
// navy for done, muted red for errors, ink for everything else.
const PAPER = "var(--color-paper-hi)"
const LINE = "var(--color-line)"
const INK = "var(--color-ink)"
const NAVY_INK = "var(--color-navy-ink)"
const ERROR = "#8a3324"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast: "!shadow-[0_16px_36px_-18px_rgba(40,30,15,0.4)] !text-[14.5px] !leading-snug",
          title: "!font-semibold",
          description: "!text-ink-2",
        },
      }}
      style={
        {
          fontFamily: "var(--font-sans)",
          "--normal-bg": PAPER,
          "--normal-text": INK,
          "--normal-border": LINE,
          "--success-bg": PAPER,
          "--success-text": NAVY_INK,
          "--success-border": LINE,
          "--info-bg": PAPER,
          "--info-text": INK,
          "--info-border": LINE,
          "--warning-bg": PAPER,
          "--warning-text": INK,
          "--warning-border": LINE,
          "--error-bg": PAPER,
          "--error-text": ERROR,
          "--error-border": "#e9d3cc",
          "--border-radius": "8px",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
