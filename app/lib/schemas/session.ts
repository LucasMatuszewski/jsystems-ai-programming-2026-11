import { z } from "zod"
import { CaseTypeSchema, CategorySchema } from "./enums"
import {
  CaseDecisionSchema,
  DecisionDataSchema,
  ImageFindingsSchema,
  RuleRefsSchema,
  SignalsSummarySchema,
} from "./decision"
import { DecisionSchema } from "./enums"

export const CHAT_MESSAGE_MAX = 2000
export const CHAT_MAX_MESSAGES = 60

/** Form values without the image (stored and sent as case context). */
export const CaseFormValuesSchema = z.object({
  caseType: CaseTypeSchema,
  category: CategorySchema,
  model: z.string().min(1),
  purchaseDate: z.string().min(1),
  reason: z.string(),
  consent: z.literal(true),
})
export type CaseFormValues = z.infer<typeof CaseFormValuesSchema>

const TextPartSchema = z.object({ type: z.literal("text"), text: z.string() })
const DecisionPartSchema = z.object({ type: z.literal("data-decision"), data: DecisionDataSchema })

export const FirstMessageSchema = z.object({
  id: z.string().min(1),
  role: z.literal("assistant"),
  parts: z.tuple([TextPartSchema, DecisionPartSchema, TextPartSchema]),
})
export type FirstMessage = z.infer<typeof FirstMessageSchema>

export const CaseSessionDecisionSchema = CaseDecisionSchema.omit({
  escalationReasons: true,
  guardsApplied: true,
  firstMessage: true, // delivered as the ready `firstMessage` UIMessage of the payload
})

export const CaseSessionPayloadSchema = z.object({
  caseId: z.uuid(),
  createdAt: z.string().min(1),
  form: CaseFormValuesSchema,
  thumbnailDataUrl: z.string(),
  daysSincePurchase: z.number().int().min(0),
  decision: CaseSessionDecisionSchema,
  firstMessage: FirstMessageSchema,
})
export type CaseSessionPayload = z.infer<typeof CaseSessionPayloadSchema>

export const CaseContextSchema = z.object({
  caseId: z.uuid(),
  form: CaseFormValuesSchema,
  daysSincePurchase: z.number().int().min(0),
  imageFindings: ImageFindingsSchema,
  signalsSummary: SignalsSummarySchema,
  currentDecision: z.object({
    decision: DecisionSchema,
    ruleRefs: RuleRefsSchema,
    source: z.enum(["initial", "update"]),
  }),
})
export type CaseContext = z.infer<typeof CaseContextSchema>

/** Shape check only; full content is validated with `validateUIMessages`. */
export const UIMessageLikeSchema = z.looseObject({
  id: z.string(),
  role: z.enum(["user", "assistant", "system"]),
  parts: z.array(z.looseObject({ type: z.string() })),
})
export type UIMessageLike = z.infer<typeof UIMessageLikeSchema>

export const ChatRequestSchema = z
  .object({
    id: z.string().min(1),
    messages: z.array(UIMessageLikeSchema).min(1).max(CHAT_MAX_MESSAGES, "too_many_messages"),
    caseContext: CaseContextSchema,
  })
  .superRefine((value, ctx) => {
    const last = value.messages[value.messages.length - 1]
    if (!last) return
    if (last.role !== "user") {
      ctx.addIssue({ code: "custom", path: ["messages"], message: "last_message_not_user" })
      return
    }
    const text = last.parts
      .map((p) => (p.type === "text" && typeof p.text === "string" ? p.text : ""))
      .join("")
      .trim()
    if (text.length < 1) {
      ctx.addIssue({ code: "custom", path: ["messages"], message: "message_empty" })
    } else if (text.length > CHAT_MESSAGE_MAX) {
      ctx.addIssue({ code: "custom", path: ["messages"], message: "message_too_long" })
    }
  })
export type ChatRequest = z.infer<typeof ChatRequestSchema>

export const CASES_ERROR_CODES = [
  "analysis_failed",
  "model_unavailable",
  "timeout",
] as const
export type CasesStreamErrorCode = (typeof CASES_ERROR_CODES)[number]

export const CasesStreamEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("stage"), stage: z.enum(["analysis", "decision"]) }),
  z.object({ type: z.literal("result"), case: CaseSessionPayloadSchema }),
  z.object({ type: z.literal("error"), code: z.enum(CASES_ERROR_CODES) }),
])
export type CasesStreamEvent = z.infer<typeof CasesStreamEventSchema>

export const CasesErrorResponseSchema = z.object({
  code: z.enum([
    "validation_failed",
    "file_too_large",
    "unsupported_media_type",
    "server_misconfigured",
  ]),
  fieldErrors: z.record(z.string(), z.string()).optional(),
})
export type CasesErrorResponse = z.infer<typeof CasesErrorResponseSchema>

export const StoredSessionSchema = z.object({
  version: z.literal(1),
  case: CaseSessionPayloadSchema,
  messages: z.array(UIMessageLikeSchema),
})
export type StoredSession = z.infer<typeof StoredSessionSchema>
