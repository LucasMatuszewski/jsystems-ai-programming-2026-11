"use client"

import { DecisionCard } from "@/components/chat/decision-card"
import { TextPart } from "@/components/parts/text-part"
import { pl } from "@/lib/i18n/pl"
import type { CaseUIMessage } from "@/lib/types/chat"

// Renders message parts in their original order (PRD AC-21, ADR-003 3.2).
// reasoning, reasoning-file, step-start and unknown parts render nothing (TAC-003-02).
export function MessageParts({ message }: { message: CaseUIMessage }) {
  return (
    <>
      {message.parts.map((part, index) => {
        const key = `${index}-${part.type}`

        switch (part.type) {
          case "text":
            return part.text.trim() ? <TextPart key={key} part={part} /> : null

          case "data-decision":
            return (
              <DecisionCard
                key={key}
                kind="initial"
                decision={part.data.decision}
                ruleRefs={part.data.ruleRefs}
                remedy={part.data.remedy}
              />
            )

          case "tool-update_recommendation":
            switch (part.state) {
              case "input-streaming":
              case "input-available":
                return (
                  <p key={key} className="text-sm text-muted-foreground">
                    {pl.chat.updatingRecommendation}
                  </p>
                )
              case "output-available":
                return (
                  <DecisionCard
                    key={key}
                    kind="update"
                    decision={part.output.newDecision}
                    previousDecision={part.output.previousDecision}
                    reason={part.output.reason}
                    ruleRefs={part.output.ruleRefs}
                    remedy={part.output.remedy}
                  />
                )
              default:
                return null
            }

          default:
            return null
        }
      })}
    </>
  )
}
