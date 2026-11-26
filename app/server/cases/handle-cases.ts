import "server-only"

import { randomUUID } from "node:crypto"
import {
  CaseFormValuesSchema, CaseSessionDecisionSchema, CaseSessionPayloadSchema, CasesStreamEventSchema,
  parseCaseFormData, type CasesStreamEvent,
} from "@/lib/schemas"
import { todayInWarsaw } from "@/lib/dates"
import { PipelineError, runCasePipeline, type PipelineDeps, type PipelineCaseInput, type PipelineResult } from "@/server/ai/pipeline/run-case-pipeline"
import { createRequestId, defaultSink, logIncoming, type LogSink } from "@/server/ai/log/call-log"
import { EnvError, getEnv, type AppEnv } from "@/server/env"
import { checkSize, inspectImage, makeThumbnail, prepareForModel } from "@/server/image"

// ADR-002 3-5: POST /api/cases. Pre-stream errors are JSON; the stream holds one terminal event.

const ROUTE = "/api/cases"
const MAX_BODY_BYTES = 11 * 1024 * 1024
const PIPELINE_BUDGET_MS = 90_000

type Runner = typeof runCasePipeline

export interface HandleCasesDeps {
  runPipeline?: Runner
  now?: () => Date
  requestId?: string
  callLogSink?: LogSink
  pipelineDeps?: Omit<PipelineDeps, "onStage" | "requestId" | "callLogSink"> & { env?: AppEnv }
}

type ErrorBody = { code: "validation_failed"; fieldErrors: Record<string, string> } | { code: "file_too_large" | "unsupported_media_type" | "server_misconfigured" }

function jsonError(status: number, body: ErrorBody): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } })
}

function terminalCode(error: unknown): "analysis_failed" | "model_unavailable" | "timeout" {
  if (error instanceof PipelineError) {
    if (error.code === "model_unavailable") return "model_unavailable"
    if (error.code === "timeout") return "timeout"
  }
  return "analysis_failed"
}

function buildPayload(
  caseId: string,
  createdAt: string,
  form: unknown,
  thumbnailDataUrl: string,
  result: PipelineResult,
) {
  // Parsing strips escalationReasons, guardsApplied and firstMessage (omitted by the session schema).
  const decision = CaseSessionDecisionSchema.parse(result)
  return CaseSessionPayloadSchema.parse({
    caseId,
    createdAt,
    form: CaseFormValuesSchema.parse(form),
    thumbnailDataUrl,
    daysSincePurchase: result.daysSincePurchase,
    decision,
    firstMessage: {
      id: `initial-${caseId}`,
      role: "assistant",
      parts: [
        { type: "text", text: result.firstMessage.greeting },
        {
          type: "data-decision",
          data: { decision: result.decision, ruleRefs: result.ruleRefs, kind: "initial", remedy: result.remedy },
        },
        { type: "text", text: result.firstMessage.bodyMarkdown },
      ],
    },
  })
}

export async function handleCasesRequest(request: Request, deps: HandleCasesDeps = {}): Promise<Response> {
  const requestId = deps.requestId ?? createRequestId()
  const sink = deps.callLogSink ?? defaultSink
  const now = deps.now ?? deps.pipelineDeps?.now ?? (() => new Date())
  const runPipeline = deps.runPipeline ?? runCasePipeline

  const respond = (response: Response): Response => {
    logIncoming({ requestId, route: ROUTE, status: response.status, sink })
    return response
  }

  const declared = Number(request.headers.get("content-length"))
  if (request.headers.get("content-length") !== null && declared > MAX_BODY_BYTES) {
    return respond(jsonError(413, { code: "file_too_large" }))
  }

  let env: AppEnv
  try {
    env = deps.pipelineDeps?.env ?? getEnv()
  } catch (error) {
    if (error instanceof EnvError) return respond(jsonError(500, { code: "server_misconfigured" }))
    throw error
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return respond(jsonError(400, { code: "validation_failed", fieldErrors: { _form: "required" } }))
  }

  const parsed = parseCaseFormData(formData, todayInWarsaw(now()))
  const imagePart = formData.get("image")
  const hasImage = imagePart instanceof Blob && imagePart.size > 0
  const fieldErrors: Record<string, string> = parsed.success ? {} : { ...parsed.fieldErrors }
  if (!hasImage) fieldErrors.image = "required"
  if (!parsed.success || !hasImage) {
    return respond(jsonError(400, { code: "validation_failed", fieldErrors }))
  }

  const image = imagePart as Blob
  const size = checkSize(image.size)
  if (!size.ok) return respond(jsonError(413, { code: size.code }))

  const original = Buffer.from(await image.arrayBuffer())
  const inspected = await inspectImage(original)
  if (!inspected.ok) return respond(jsonError(415, { code: inspected.code }))

  let modelImage: Awaited<ReturnType<typeof prepareForModel>>
  let thumbnailDataUrl: string
  try {
    modelImage = await prepareForModel(original)
    thumbnailDataUrl = await makeThumbnail(original)
  } catch {
    return respond(jsonError(415, { code: "unsupported_media_type" }))
  }

  const caseInput: PipelineCaseInput = {
    caseType: parsed.data.caseType,
    category: parsed.data.category,
    model: parsed.data.model,
    purchaseDate: parsed.data.purchaseDate,
    reason: parsed.data.reason,
  }
  const formValues = { ...caseInput, consent: true as const }
  const createdAt = now().toISOString()
  const caseId = randomUUID()
  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (event: CasesStreamEvent) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
        } catch {
          // Client went away; the pipeline is aborted through request.signal.
        }
      }
      write({ type: "stage", stage: "analysis" })
      try {
        const signal = AbortSignal.any([request.signal, AbortSignal.timeout(PIPELINE_BUDGET_MS)])
        const result = await runPipeline(caseInput, { buffer: modelImage.buffer, mediaType: modelImage.mediaType }, signal, {
          ...deps.pipelineDeps,
          env,
          now,
          requestId,
          ...(deps.callLogSink ? { callLogSink: deps.callLogSink } : {}),
          onStage: () => write({ type: "stage", stage: "decision" }),
        })
        const payload = buildPayload(caseId, createdAt, formValues, thumbnailDataUrl, result)
        write(CasesStreamEventSchema.parse({ type: "result", case: payload }))
      } catch (error) {
        write({ type: "error", code: terminalCode(error) })
      } finally {
        controller.close()
      }
    },
  })

  return respond(
    new Response(stream, {
      status: 200,
      headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" },
    }),
  )
}
