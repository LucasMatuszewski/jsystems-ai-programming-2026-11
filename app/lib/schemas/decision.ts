import { z } from "zod"
import { DecisionSchema, RemedySchema, RouteSchema } from "./enums"

// ADR-001 3.3 signal keys and option values
export const RETURN_SIGNAL_KEYS = [
  "photo_usable",
  "device_visible",
  "category_match",
  "damage_visible",
  "damage_type",
  "damage_location",
  "condition",
  "signs_of_use",
  "packaging_visible",
  "description_consistent",
] as const
export const COMPLAINT_SIGNAL_KEYS = [
  "photo_usable",
  "device_visible",
  "category_match",
  "damage_visible",
  "damage_type",
  "damage_location",
  "condition",
  "damage_cause",
  "description_consistent",
] as const
export const DAMAGE_TYPES = [
  "none",
  "crack",
  "scratch_or_scuff",
  "dent_or_bend",
  "liquid",
  "burn_or_melt",
  "screen_defect",
  "swelling",
  "opened_or_modified",
  "other",
] as const
export const DAMAGE_LOCATIONS = [
  "none",
  "screen",
  "housing",
  "keyboard_or_buttons",
  "hinge",
  "port",
  "battery_area",
  "other",
] as const
export const CONDITION_LEVELS = [
  { level: 1, name: "broken" },
  { level: 2, name: "clearly_damaged" },
  { level: 3, name: "visible_wear" },
  { level: 4, name: "minor_wear" },
  { level: 5, name: "like_new" },
] as const
export const DAMAGE_CAUSES = [
  "manufacturing_defect",
  "user_caused",
  "no_defect_visible",
  "undetermined",
] as const
export const PHOTO_QUALITIES = ["good", "limited", "unusable"] as const
export const LIKELY_CAUSES = ["manufacturing_defect", "user_caused", "undetermined"] as const

export type SignalKey = (typeof RETURN_SIGNAL_KEYS)[number] | (typeof COMPLAINT_SIGNAL_KEYS)[number]

// ADR-001 4.2
export const SignalAnswerSchema = z.object({
  value: z.union([z.boolean(), z.string(), z.number()]),
  confidence: z.number().min(0).max(1),
  probabilities: z.record(z.string(), z.number()),
})
export type SignalAnswer = z.infer<typeof SignalAnswerSchema>

export const DecisionSignalsSchema = z.object({
  status: z.enum(["ok", "unavailable"]),
  answers: z.record(z.string(), SignalAnswerSchema),
  refusals: z.array(z.string()),
  cost: z.number().nullable(),
  durationMs: z.number(),
  reason: z.string().optional(),
})
export type DecisionSignals = z.infer<typeof DecisionSignalsSchema>

// ADR-001 4.3
export const ImageFindingsSchema = z.object({
  deviceVisible: z.boolean(),
  categoryMatches: z.boolean(),
  photoQuality: z.enum(PHOTO_QUALITIES),
  damage: z.string(),
  signsOfUse: z.string().nullable(),
  likelyCause: z.enum(LIKELY_CAUSES).nullable(),
  evidence: z.array(z.string()),
  contradictsDescription: z.boolean(),
})
export type ImageFindings = z.infer<typeof ImageFindingsSchema>

export const RuleRefsSchema = z.array(z.string().min(1)).min(1)

export const EscalatedDecisionOutputSchema = z.object({
  decision: DecisionSchema,
  ruleRefs: RuleRefsSchema,
  imageFindings: ImageFindingsSchema,
  signalDisagreements: z.array(z.object({ key: z.string(), reason: z.string() })),
  remedy: RemedySchema.nullable(),
  photoAdvice: z.string().nullable(),
  greeting: z.string().min(1),
  bodyMarkdown: z.string().min(1),
})
export type EscalatedDecisionOutput = z.infer<typeof EscalatedDecisionOutputSchema>

// ADR-001 4.4
export const WriterOutputSchema = z.object({
  greeting: z.string().min(1),
  bodyMarkdown: z.string().min(1),
  photoAdvice: z.string().nullable(),
})
export type WriterOutput = z.infer<typeof WriterOutputSchema>

export const SignalsSummarySchema = z.record(
  z.string(),
  z.object({
    value: z.union([z.boolean(), z.string(), z.number()]),
    confidence: z.number().min(0).max(1),
  }),
)
export type SignalsSummary = z.infer<typeof SignalsSummarySchema>

// ADR-001 4.5
export const CaseDecisionSchema = z.object({
  decision: DecisionSchema,
  ruleRefs: RuleRefsSchema,
  route: RouteSchema,
  escalationReasons: z.array(z.string()),
  imageFindings: ImageFindingsSchema,
  signalsSummary: SignalsSummarySchema,
  remedy: RemedySchema.nullable(),
  firstMessage: z.object({ greeting: z.string().min(1), bodyMarkdown: z.string().min(1) }),
  guardsApplied: z.array(z.string()),
  daysSincePurchase: z.number().int().min(0),
  photoAdvice: z.string().nullable(),
})
export type CaseDecision = z.infer<typeof CaseDecisionSchema>

// ADR-003 4: payload of the `data-decision` part
export const DecisionDataSchema = z.object({
  decision: DecisionSchema,
  ruleRefs: RuleRefsSchema,
  kind: z.literal("initial"),
  remedy: RemedySchema.nullable(),
})
export type DecisionData = z.infer<typeof DecisionDataSchema>

// ADR-001 4.6 / 3.8
export const UpdateRecommendationInputSchema = z.object({
  decision: DecisionSchema,
  reason: z.string().min(1),
  ruleRefs: RuleRefsSchema,
})
export type UpdateRecommendationInput = z.infer<typeof UpdateRecommendationInputSchema>

export const UpdateRecommendationOutputSchema = z.object({
  previousDecision: DecisionSchema,
  newDecision: DecisionSchema,
  reason: z.string(),
  ruleRefs: RuleRefsSchema,
  updatedAt: z.string(),
})
export type UpdateRecommendationOutput = z.infer<typeof UpdateRecommendationOutputSchema>
