"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import { CaseForm, type CaseFormValues } from "@/components/case-form/case-form"
import { AnalysisErrorBanner } from "@/components/case-submission/analysis-error-banner"
import { SubmissionProgress } from "@/components/case-submission/submission-progress"
import { useCaseSubmission } from "@/components/case-submission/use-case-submission"
import { pl } from "@/lib/i18n/pl"
import { useStoredSession } from "./use-stored-session"

/** `/`: the case form. An existing session redirects to /chat (navigation only, no requests; ADR-006 3.2). */
export function HomeScreen() {
  const router = useRouter()
  const { checked, session } = useStoredSession()
  const [kept, setKept] = useState<{ values: CaseFormValues; file: File } | null>(null)

  // Navigation only, no requests.
  useEffect(() => {
    if (session) router.replace("/chat")
  }, [session, router])

  const onSuccess = useCallback(() => router.push("/chat"), [router])
  const { state, submit } = useCaseSubmission({ onSuccess })

  const handleSubmit = (values: CaseFormValues, file: File) => {
    setKept({ values, file })
    void submit(values, file)
  }

  const retry = () => {
    if (kept) void submit(kept.values, kept.file)
  }

  if (!checked || session) {
    return <main className="min-h-0 flex-1" aria-busy="true" />
  }

  const submitting = state.status === "submitting"

  return (
    <main className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="font-display text-4xl tracking-wide">{pl.form.title}</h1>
          <p className="text-on-surface">{pl.form.intro}</p>
        </header>

        {submitting ? (
          <SubmissionProgress stage={state.stage} />
        ) : (
          <>
            {state.status === "error" ? (
              <AnalysisErrorBanner code={state.code} onRetry={retry} />
            ) : null}
            <CaseForm
              onSubmit={handleSubmit}
              initialValues={kept?.values}
              initialFile={kept?.file ?? null}
            />
          </>
        )}
      </div>
    </main>
  )
}
