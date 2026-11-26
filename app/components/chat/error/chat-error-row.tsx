"use client"

import { Button } from "@/components/ui/button"
import { pl } from "@/lib/i18n/pl"

/** Failed reply: a plain Polish message, no technical details (AC-42, AC-43). */
export function ChatErrorRow({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-card border-[3px] border-hairline bg-surface-raised p-3 shadow-brand-sm"
    >
      <p className="text-sm font-medium">{pl.chat.errorMessage}</p>
      <Button type="button" size="sm" variant="outline" onClick={onRetry}>
        {pl.chat.retry}
      </Button>
    </div>
  )
}
