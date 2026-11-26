import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-24 w-full resize-y rounded-md border-[3px] border-hairline bg-surface-raised px-3 py-2 font-sans text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:outline-3 focus-visible:outline-accent-warm focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:outline-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
