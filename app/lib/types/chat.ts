import type { UIMessage } from "ai"
import type {
  DecisionData,
  UpdateRecommendationInput,
  UpdateRecommendationOutput,
} from "@/lib/schemas/decision"

export type CaseDataParts = { decision: DecisionData }
export type CaseTools = {
  update_recommendation: {
    input: UpdateRecommendationInput
    output: UpdateRecommendationOutput
  }
}

/** Typed chat message shared by client and server (ADR-003 3.4). */
export type CaseUIMessage = UIMessage<never, CaseDataParts, CaseTools>
export type CaseMessagePart = CaseUIMessage["parts"][number]
export type TextMessagePart = Extract<CaseMessagePart, { type: "text" }>
export type DecisionDataPart = Extract<CaseMessagePart, { type: "data-decision" }>
export type UpdateRecommendationPart = Extract<
  CaseMessagePart,
  { type: "tool-update_recommendation" }
>
