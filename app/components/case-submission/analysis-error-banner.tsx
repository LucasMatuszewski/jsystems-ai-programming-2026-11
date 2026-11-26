"use client"

import { Button } from "@/components/ui/button"
import { pl } from "@/lib/i18n/pl"
import type { SubmissionErrorCode } from "./use-case-submission"

type AnalysisCode = "analysis_failed" | "model_unavailable" | "timeout"
type GenericCode = Exclude<SubmissionErrorCode, AnalysisCode>

const ANALYSIS_CODES: ReadonlySet<SubmissionErrorCode> = new Set<AnalysisCode>([
  "analysis_failed",
  "model_unavailable",
  "timeout",
])

/** AC-41 / AC-43: a generic message only; no status codes, provider names or stack traces. */
export function AnalysisErrorBanner({
  code,
  onRetry,
}: {
  code: SubmissionErrorCode
  onRetry: () => void
}) {
  const isAnalysis = ANALYSIS_CODES.has(code)
  const message = isAnalysis ? pl.analysisFailed.banner : pl.errors[code as GenericCode]

  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-xl border-2 border-negative bg-surface-raised p-4 text-on-surface shadow-brand-md sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-sm font-medium">{message}</p>
      {isAnalysis ? (
        <Button type="button" variant="outline" onClick={onRetry}>
          {pl.analysisFailed.retry}
        </Button>
      ) : null}
    </div>
  )
}
