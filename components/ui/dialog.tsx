"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "radix-ui"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"

function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-ink/40",
        className
      )}
      {...props}
    />
  )
}

/**
 * A centred panel over the dimmed page, the same Paper card the send and
 * add-address dialogs always had. Focus moves in when it opens and Tab stays
 * inside; Escape and a click outside close it (pass onEscapeKeyDown /
 * onInteractOutside and call preventDefault to block that while busy).
 *
 * There's no built-in close button: put a <DialogCloseButton> in the header.
 * Our dialogs are opened from state rather than a <DialogTrigger>, so Radix
 * has nothing to hand focus back to on close. We remember what had focus when
 * the dialog opened and return it there.
 */
function DialogContent({
  className,
  children,
  onOpenAutoFocus,
  onCloseAutoFocus,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) {
  const openerRef = React.useRef<HTMLElement | null>(null)

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        onOpenAutoFocus={(event) => {
          const active = document.activeElement
          openerRef.current = active instanceof HTMLElement && active !== document.body ? active : null
          onOpenAutoFocus?.(event)
        }}
        onCloseAutoFocus={(event) => {
          onCloseAutoFocus?.(event)
          if (event.defaultPrevented) return
          const opener = openerRef.current
          if (opener?.isConnected) {
            event.preventDefault()
            opener.focus({ preventScroll: true })
          }
        }}
        className={cn(
          "bg-paper-hi text-ink border-line fixed top-[50%] left-[50%] z-50 w-[calc(100%-2rem)] max-w-md translate-x-[-50%] translate-y-[-50%] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-lg border shadow-[0_16px_36px_-18px_rgba(40,30,15,0.4)] outline-none duration-200",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-[0.98] data-[state=open]:zoom-in-[0.98]",
          className
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

/** The title row: title on the left, close button on the right, a rule beneath. */
function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex items-center justify-between gap-4 border-b border-line py-3 pl-5 pr-3", className)}
      {...props}
    />
  )
}

/** The button row on a Paper strip at the foot of the dialog. Stacks on phones. */
function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 rounded-b-lg border-t border-line bg-paper px-5 py-4 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-snug font-semibold text-ink", className)}
      {...props}
    />
  )
}

function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-ink-2 text-[15px] leading-normal", className)}
      {...props}
    />
  )
}

/** The 40px X button for a <DialogHeader>. Pass `disabled` to stop it closing while busy. */
function DialogCloseButton({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return (
    <DialogPrimitive.Close
      data-slot="dialog-close-button"
      aria-label="Close"
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-[3px] text-ink-2 transition-colors hover:bg-accent hover:text-ink focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-navy disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      {...props}
    >
      <XIcon className="size-5" aria-hidden="true" />
    </DialogPrimitive.Close>
  )
}

export {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
