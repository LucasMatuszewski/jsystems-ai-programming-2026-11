import { CircleCheckIcon, CircleHelpIcon, CircleXIcon } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { pl } from "@/lib/i18n/pl"
import type { Decision } from "@/lib/schemas/enums"

const STYLES: Record<Decision, { icon: LucideIcon; className: string }> = {
  Akceptacja: { icon: CircleCheckIcon, className: "bg-positive text-surface-raised" },
  Odrzucenie: { icon: CircleXIcon, className: "bg-negative text-surface-raised" },
  "Weryfikacja ręczna": { icon: CircleHelpIcon, className: "bg-accent-warm text-on-accent-warm" },
}

/** Compact decision badge: text and icon, never colour alone (PRD 9.3). Same visuals as DecisionCard. */
export function DecisionBadge({ decision, className }: { decision: Decision; className?: string }) {
  const { icon: Icon, className: tone } = STYLES[decision]
  return (
    <span
      data-slot="decision-badge"
      data-decision={decision}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-card border-[3px] border-hairline px-2.5 py-1 font-sans text-sm font-bold shadow-brand-sm",
        tone,
        className
      )}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      <span>{pl.decisions[decision]}</span>
    </span>
  )
}
