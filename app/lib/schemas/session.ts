import { z } from "zod"
import { todayInWarsaw } from "@/lib/dates"
import { makeCaseFormFieldsSchema, CaseFormValuesSchema, type TodaySource } from "./case-form"
import {
  CaseDecisionSchema,
  DecisionDataSchema,
  ImageFindingsSchema,
  LIKELY_CAUSES,
  PHOTO_QUALITIES,
} from "./decision"
import { DecisionSchema } from "./enums"

export const CHAT_MESSAGE_MAX = 2000
export const CHAT_MAX_MESSAGES = 60

/** Form values without the image (stored and sent as case context): derived from the form schema. */
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

// Limits for the strings of the client-supplied case context: they end up in the system prompt (T28 F3).
export const CONTEXT_TEXT_MAX = 1000
export const CONTEXT_EVIDENCE_MAX = 30
export const CONTEXT_EVIDENCE_ITEM_MAX = 500
export const CONTEXT_SIGNALS_MAX = 20
export const CONTEXT_RULE_REFS_MAX = 10

/** Image findings as sent back by the client: same fields as `ImageFindingsSchema`, with limits. */
const ContextImageFindingsSchema = z.object({
  deviceVisible: z.boolean(),
  categoryMatches: z.boolean(),
  photoQuality: z.enum(PHOTO_QUALITIES),
  damage: z.string().max(CONTEXT_TEXT_MAX),
  signsOfUse: z.string().max(CONTEXT_TEXT_MAX).nullable(),
  likelyCause: z.enum(LIKELY_CAUSES).nullable(),
  evidence: z.array(z.string().max(CONTEXT_EVIDENCE_ITEM_MAX)).max(CONTEXT_EVIDENCE_MAX),
  contradictsDescription: z.boolean(),
}) satisfies z.ZodType<z.infer<typeof ImageFindingsSchema>>

const ContextSignalsSummarySchema = z
  .record(
    z.string().max(40),
    z.object({
      value: z.union([z.boolean(), z.string().max(100), z.number()]),
      confidence: z.number().min(0).max(1),
    }),
  )
  .refine((summary) => Object.keys(summary).length <= CONTEXT_SIGNALS_MAX, "too_many_signals")

const ContextRuleRefsSchema = z.array(z.string().min(1).max(20)).min(1).max(CONTEXT_RULE_REFS_MAX)

function makeCaseContextSchema(today: TodaySource) {
  return z.object({
    caseId: z.uuid(),
    form: makeCaseFormFieldsSchema(today),
    daysSincePurchase: z.number().int().min(0), // advisory only: the server recomputes it from form.purchaseDate
    imageFindings: ContextImageFindingsSchema,
    signalsSummary: ContextSignalsSummarySchema,
    currentDecision: z.object({
      decision: DecisionSchema,
      ruleRefs: ContextRuleRefsSchema,
      source: z.enum(["initial", "update"]),
    }),
  })
}
export const CaseContextSchema = makeCaseContextSchema(() => todayInWarsaw())
export type CaseContext = z.infer<typeof CaseContextSchema>

/** Shape check only; used for the stored session. Chat requests use `ChatMessageSchema`. */
export const UIMessageLikeSchema = z.looseObject({
  id: z.string(),
  role: z.enum(["user", "assistant", "system"]),
  parts: z.array(z.looseObject({ type: z.string() })),
})
export type UIMessageLike = z.infer<typeof UIMessageLikeSchema>

// T28 F2: the client may send only its own text and the parts our UI produces.
const UserTextPartSchema = z.looseObject({ type: z.literal("text"), text: z.string() })
const ChatAssistantPartSchema = z.union([
  z.looseObject({ type: z.literal("text"), text: z.string() }),
  z.looseObject({ type: z.literal("step-start") }),
  z.looseObject({ type: z.literal("data-decision"), data: DecisionDataSchema }),
  z.looseObject({ type: z.literal("tool-update_recommendation") }), // content checked by validateUIMessages
])

export const ChatMessageSchema = z.discriminatedUnion("role", [
  z.looseObject({ id: z.string(), role: z.literal("user"), parts: z.array(UserTextPartSchema).min(1) }),
  z.looseObject({ id: z.string(), role: z.literal("assistant"), parts: z.array(ChatAssistantPartSchema) }),
])

export function makeChatRequestSchema(today: TodaySource) {
  return z
    .object({
      id: z.string().min(1),
      messages: z.array(ChatMessageSchema).min(1).max(CHAT_MAX_MESSAGES, "too_many_messages"),
      caseContext: makeCaseContextSchema(today),
    })
    .superRefine((value, ctx) => {
      const last = value.messages[value.messages.length - 1]
      if (!last) return
      if (last.role !== "user") {
        ctx.addIssue({ code: "custom", path: ["messages"], message: "last_message_not_user" })
        return
      }
      const text = last.parts.map((p) => p.text).join("").trim()
      if (text.length < 1) {
        ctx.addIssue({ code: "custom", path: ["messages"], message: "message_empty" })
      } else if (text.length > CHAT_MESSAGE_MAX) {
        ctx.addIssue({ code: "custom", path: ["messages"], message: "message_too_long" })
      }
    })
}
export const ChatRequestSchema = makeChatRequestSchema(() => todayInWarsaw())
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
