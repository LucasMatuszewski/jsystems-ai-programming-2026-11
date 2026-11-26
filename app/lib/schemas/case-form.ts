import { z } from "zod"
import { addYears, isValidIsoDate, todayInWarsaw } from "@/lib/dates"
import { CASE_TYPES, CATEGORIES } from "./enums"

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024
export const MODEL_MIN = 2
export const MODEL_MAX = 100
export const REASON_MAX = 2000
export const COMPLAINT_REASON_MIN = 20
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const

export const FORM_FIELD_NAMES = [
  "caseType",
  "category",
  "model",
  "purchaseDate",
  "reason",
  "consent",
] as const

export type FormErrorCode =
  | "required"
  | "model_length"
  | "date_future"
  | "date_too_old"
  | "reason_too_short"
  | "reason_too_long"
  | "consent_required"
  | "invalid_option"

const optionError = (iss: { input?: unknown }) =>
  iss.input === undefined || iss.input === "" ? "required" : "invalid_option"

/** A fixed day (the form and the API use one per request) or a clock read at parse time. */
export type TodaySource = string | (() => string)

/** Error messages are error codes; the UI maps them to Polish via `pl.errors`. */
export function makeCaseFormFieldsSchema(todaySource: TodaySource) {
  const today = () => (typeof todaySource === "function" ? todaySource() : todaySource)
  const oldest = () => addYears(today(), -5)
  return z
    .object({
      caseType: z.enum(CASE_TYPES, { error: optionError }),
      category: z.enum(CATEGORIES, { error: optionError }),
      model: z
        .string({ error: "required" })
        .trim()
        .min(1, "required")
        .min(MODEL_MIN, "model_length")
        .max(MODEL_MAX, "model_length"),
      purchaseDate: z
        .string({ error: "required" })
        .min(1, "required")
        .refine(isValidIsoDate, "required")
        .refine((d) => !isValidIsoDate(d) || d <= today(), "date_future")
        .refine((d) => !isValidIsoDate(d) || d >= oldest(), "date_too_old"),
      reason: z.string().trim().max(REASON_MAX, "reason_too_long").default(""),
      consent: z.literal(true, { error: "consent_required" }),
    })
    .refine(
      (v) => v.caseType !== "complaint" || (v.reason ?? "").length >= COMPLAINT_REASON_MIN,
      {
        path: ["reason"],
        error: "reason_too_short",
        // run even when other fields failed, so all errors are reported at once
        when: (payload) => {
          const v = payload.value as { caseType?: unknown; reason?: unknown }
          return v.caseType === "complaint" && typeof v.reason === "string"
        },
      },
    )
}

export type CaseFormFields = z.infer<ReturnType<typeof makeCaseFormFieldsSchema>>

/**
 * The form values stored in the session and sent as chat case context: the form schema itself,
 * with "today" read at parse time (one source of limits and formats, T28 F3).
 */
export const CaseFormValuesSchema = makeCaseFormFieldsSchema(() => todayInWarsaw())
export type FieldErrors = Record<string, string>

/** First error code per field. */
export function fieldErrorsFromZod(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_form")
    if (!(key in out)) out[key] = issue.message
  }
  return out
}

export type ParsedCaseForm =
  | { success: true; data: CaseFormFields }
  | { success: false; fieldErrors: FieldErrors }

/** Server helper: reads the text fields of the multipart body (the `image` part is handled separately). */
export function parseCaseFormData(formData: FormData, today: string): ParsedCaseForm {
  const raw: Record<string, unknown> = {}
  for (const name of FORM_FIELD_NAMES) {
    const value = formData.get(name)
    if (typeof value !== "string") continue
    raw[name] = name === "consent" ? (value === "true" ? true : value) : value
  }
  const result = makeCaseFormFieldsSchema(today).safeParse(raw)
  if (result.success) return { success: true, data: result.data }
  return { success: false, fieldErrors: fieldErrorsFromZod(result.error) }
}
