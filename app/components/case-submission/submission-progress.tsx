"use client"

import { pl } from "@/lib/i18n/pl"
import type { SubmissionStage } from "./use-case-submission"

const STAGE_INDEX: Record<SubmissionStage, 0 | 1 | 2> = {
  upload: 0,
  analysis: 1,
  decision: 2,
}

/** PRD 9.2: sequential status texts while the case is analysed. */
export function SubmissionProgress({ stage }: { stage: SubmissionStage }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-auto flex w-full max-w-md flex-col items-center gap-4 rounded-xl border-2 border-hairline bg-surface-raised p-6 text-center text-on-surface shadow-brand-lg"
    >
      <span
        aria-hidden="true"
        className="size-10 animate-spin rounded-full border-4 border-hairline border-t-accent-warm motion-reduce:animate-none"
      />
      <p className="font-display text-xl tracking-wide">{pl.progress[STAGE_INDEX[stage]]}</p>
    </div>
  )
}
