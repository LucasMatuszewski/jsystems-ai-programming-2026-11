"use client"

import { useCallback, useRef, useState } from "react"
import { readNdjson } from "@/lib/ndjson"
import {
  CasesStreamEventSchema,
  FORM_FIELD_NAMES,
  type CaseFormFields,
  type CaseSessionPayload,
} from "@/lib/schemas"
import { rememberSessionInMemory, writeSession } from "@/lib/session-store"

export type SubmissionStage = "upload" | "analysis" | "decision"

export type SubmissionErrorCode =
  | "validation_failed"
  | "file_too_large"
  | "unsupported_media_type"
  | "server_misconfigured"
  | "analysis_failed"
  | "model_unavailable"
  | "timeout"

export type SubmissionState =
  | { status: "idle" }
  | { status: "submitting"; stage: SubmissionStage }
  | { status: "error"; code: SubmissionErrorCode }

export type UseCaseSubmissionOptions = {
  fetchImpl?: typeof fetch
  onSuccess: (payload: CaseSessionPayload) => void
}

const STATUS_TO_CODE: Partial<Record<number, SubmissionErrorCode>> = {
  400: "validation_failed",
  413: "file_too_large",
  415: "unsupported_media_type",
  500: "server_misconfigured",
}

function buildFormData(values: CaseFormFields, file: File): FormData {
  const body = new FormData()
  for (const name of FORM_FIELD_NAMES) {
    if (name === "consent") body.append(name, "true")
    else body.append(name, String(values[name] ?? ""))
  }
  body.append("image", file, file.name)
  return body
}

/**
 * Event-driven submission of the case form to `POST /api/cases` (ADR-003 3.2).
 * No request is made from an effect (ADR-006 strict-mode rule); the caller's form values are never cleared.
 */
export function useCaseSubmission({ fetchImpl = fetch, onSuccess }: UseCaseSubmissionOptions) {
  const [state, setState] = useState<SubmissionState>({ status: "idle" })
  const inFlight = useRef(false)

  const submit = useCallback(
    async (values: CaseFormFields, file: File): Promise<void> => {
      if (inFlight.current) return
      inFlight.current = true

      const fail = (code: SubmissionErrorCode) => setState({ status: "error", code })
      setState({ status: "submitting", stage: "upload" })

      try {
        let response: Response
        try {
          response = await fetchImpl("/api/cases", { method: "POST", body: buildFormData(values, file) })
        } catch {
          return fail("analysis_failed")
        }
        if (!response.ok) {
          return fail(STATUS_TO_CODE[response.status] ?? "analysis_failed")
        }
        if (!response.body) return fail("analysis_failed")

        for await (const raw of readNdjson(response.body)) {
          const parsed = CasesStreamEventSchema.safeParse(raw)
          if (!parsed.success) return fail("analysis_failed")
          const event = parsed.data
          if (event.type === "stage") {
            setState({ status: "submitting", stage: event.stage === "analysis" ? "analysis" : "decision" })
          } else if (event.type === "error") {
            return fail(event.code)
          } else {
            // A storage failure never loses the paid-for result: it stays in memory and the chat shows a notice (ADR-003 3.3, T28 F6).
            const session = { version: 1 as const, case: event.case, messages: [event.case.firstMessage] }
            if (!writeSession(session).ok) rememberSessionInMemory(session)
            setState({ status: "idle" })
            onSuccess(event.case)
            return
          }
        }
        // stream ended without a terminal event
        fail("analysis_failed")
      } catch {
        fail("analysis_failed")
      } finally {
        inFlight.current = false
      }
    },
    [fetchImpl, onSuccess],
  )

  return { state, submit }
}
