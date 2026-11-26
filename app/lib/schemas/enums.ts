import { z } from "zod"

export const CASE_TYPES = ["return", "complaint"] as const
export const CATEGORIES = [
  "laptop",
  "smartphone",
  "tablet",
  "desktop",
  "monitor",
  "tv",
  "audio",
  "wearable",
  "other",
] as const
export const DECISIONS = ["Akceptacja", "Odrzucenie", "Weryfikacja ręczna"] as const
export const ROUTES = ["rule", "fast", "escalated"] as const
export const REMEDIES = ["repair", "replacement"] as const

export type CaseType = (typeof CASE_TYPES)[number]
export type Category = (typeof CATEGORIES)[number]
export type Decision = (typeof DECISIONS)[number]
export type Route = (typeof ROUTES)[number]
export type Remedy = (typeof REMEDIES)[number]

export const CaseTypeSchema = z.enum(CASE_TYPES)
export const CategorySchema = z.enum(CATEGORIES)
export const DecisionSchema = z.enum(DECISIONS)
export const RouteSchema = z.enum(ROUTES)
export const RemedySchema = z.enum(REMEDIES)
