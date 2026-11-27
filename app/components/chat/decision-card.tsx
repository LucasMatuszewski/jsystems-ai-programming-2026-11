"use client"

import { CheckCircle, HelpCircle, XCircle, type LucideIcon } from "lucide-react"

import { pl } from "@/lib/i18n/pl"
import { cn } from "@/lib/utils"
import type { Decision, Remedy } from "@/lib/schemas/enums"

type DecisionCardProps = {
  kind: "initial" | "update"
  decision: Decision
  ruleRefs: string[]
  remedy?: Remedy | null
  previousDecision?: Decision
  reason?: string
}

// Icon + text + colour per decision; the icon and text carry the meaning, colour is extra (AC-21, PRD 9.3).
const DECISION_STYLE: Record<
  Decision,
  { icon: LucideIcon; badge: string }
> = {
  Akceptacja: { icon: CheckCircle, badge: "bg-positive text-surface-raised" },
  Odrzucenie: { icon: XCircle, badge: "bg-negative text-surface-raised" },
  "Weryfikacja ręczna": { icon: HelpCircle, badge: "bg-accent-warm text-on-accent-warm" },
}

export function DecisionCard({
  kind,
  decision,
  ruleRefs,
  remedy,
  previousDecision,
  reason,
}: DecisionCardProps) {
  const style = DECISION_STYLE[decision]
  const Icon = style.icon
  const label = pl.decisions[decision]
  const groupLabel =
    kind === "update" ? `${pl.updatedRecommendation}: ${label}` : label

  return (
    <section
      role="group"
      aria-label={groupLabel}
      className="flex w-full max-w-prose flex-col gap-3 rounded-card border-[3px] border-hairline bg-surface-raised p-4 shadow-brand-md"
    >
      {kind === "update" && (
        <p className="font-display text-lg tracking-wide text-on-surface">
          {pl.updatedRecommendation}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <span
          className={cn(
            "inline-flex w-fit items-center gap-2 rounded-button border-[3px] border-hairline px-3 py-1 shadow-brand-sm",
            style.badge,
          )}
        >
          <Icon aria-hidden="true" className="size-5 shrink-0" />
          <span className="font-display text-xl leading-none tracking-wide">{label}</span>
        </span>

        {kind === "update" && previousDecision && (
          <p className="text-sm text-muted-foreground">
            {pl.decisions[previousDecision]} → {label}
          </p>
        )}
        {kind === "update" && reason && <p className="text-sm">{reason}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <ul className="flex flex-wrap gap-1">
          {ruleRefs.map((ref) => (
            <li
              key={ref}
              className="rounded-button border border-hairline bg-soft-blue px-2 py-0.5 font-mono text-xs"
            >
              {ref}
            </li>
          ))}
        </ul>
        {remedy && <span className="font-medium">{pl.remedies[remedy]}</span>}
      </div>

      <p className="border-t-[3px] border-hairline pt-2 text-xs leading-relaxed text-on-surface">
        {pl.disclaimer}
      </p>
    </section>
  )
}
