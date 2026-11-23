import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-ink placeholder:text-ink-2/70 selection:bg-navy selection:text-paper border-line-2 bg-paper-hi text-ink h-10 w-full min-w-0 rounded-md border px-3 py-1 text-base font-medium transition-[color,border-color] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-semibold read-only:text-ink-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-55 md:text-[15px]",
        "focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-navy",
        "aria-invalid:border-[#8a3324]",
        className
      )}
      {...props}
    />
  )
}

export { Input }
