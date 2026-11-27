import { describe, expect, it } from "vitest"
import { addYears, isValidIsoDate, todayInWarsaw } from "@/lib/dates"
import {
  MAX_IMAGE_BYTES,
  fieldErrorsFromZod,
  makeCaseFormFieldsSchema,
  parseCaseFormData,
} from "@/lib/schemas"

const TODAY = "2026-11-26"
const schema = makeCaseFormFieldsSchema(TODAY)

const valid = {
  caseType: "return",
  category: "laptop",
  model: "ThinkPad X1",
  purchaseDate: "2026-11-16",
  reason: "",
  consent: true,
}

function errorsFor(overrides: Record<string, unknown>) {
  const result = schema.safeParse({ ...valid, ...overrides })
  return result.success ? {} : fieldErrorsFromZod(result.error)
}

describe("constants", () => {
  it("limits the image to 10 MB", () => {
    expect(MAX_IMAGE_BYTES).toBe(10485760)
  })
})

describe("dates", () => {
  it("computes today in Europe/Warsaw", () => {
    expect(todayInWarsaw(new Date("2026-11-25T23:30:00Z"))).toBe("2026-11-26")
    expect(todayInWarsaw(new Date("2026-07-01T21:59:00Z"))).toBe("2026-07-01")
    expect(todayInWarsaw(new Date("2026-07-01T22:00:00Z"))).toBe("2026-07-02")
  })
  it("adds years and clamps leap days", () => {
    expect(addYears("2026-11-26", -5)).toBe("2021-11-26")
    expect(addYears("2024-02-29", 1)).toBe("2025-02-28")
  })
  it("validates ISO dates", () => {
    expect(isValidIsoDate("2026-02-28")).toBe(true)
    expect(isValidIsoDate("2026-02-30")).toBe(false)
    expect(isValidIsoDate("26-02-2026")).toBe(false)
  })
})

describe("CaseFormFields", () => {
  it("accepts a valid return without a reason", () => {
    expect(schema.safeParse(valid).success).toBe(true)
  })

  it.each([
    ["", "required"],
    [" a ", "model_length"],
    ["ab", null],
    ["a".repeat(100), null],
    ["a".repeat(101), "model_length"],
    [`  ${"a".repeat(100)}  `, null],
  ])("model %j -> %s", (model, code) => {
    expect(errorsFor({ model }).model ?? null).toBe(code)
  })

  it("trims the model", () => {
    const r = schema.parse({ ...valid, model: "  Pixel 9  " })
    expect(r.model).toBe("Pixel 9")
  })

  it.each([
    ["2026-11-26", null],
    ["2026-11-27", "date_future"],
    ["2021-11-26", null],
    ["2021-11-25", "date_too_old"],
    ["", "required"],
  ])("purchaseDate %s -> %s", (purchaseDate, code) => {
    expect(errorsFor({ purchaseDate }).purchaseDate ?? null).toBe(code)
  })

  it("requires 20 trimmed characters for complaints", () => {
    const base = { caseType: "complaint" }
    expect(errorsFor({ ...base, reason: "a".repeat(19) }).reason).toBe("reason_too_short")
    expect(errorsFor({ ...base, reason: `  ${"a".repeat(19)}  ` }).reason).toBe("reason_too_short")
    expect(errorsFor({ ...base, reason: "a".repeat(20) }).reason).toBeUndefined()
    expect(errorsFor({ ...base, reason: "" }).reason).toBe("reason_too_short")
  })

  it("allows an empty reason for returns and caps at 2000", () => {
    expect(errorsFor({ reason: "" }).reason).toBeUndefined()
    expect(errorsFor({ reason: "a".repeat(2000) }).reason).toBeUndefined()
    expect(errorsFor({ reason: "a".repeat(2001) }).reason).toBe("reason_too_long")
  })

  it("requires consent", () => {
    expect(errorsFor({ consent: false }).consent).toBe("consent_required")
    expect(errorsFor({ consent: undefined }).consent).toBe("consent_required")
  })

  it("rejects invalid options with codes", () => {
    expect(errorsFor({ category: "toaster" }).category).toBe("invalid_option")
    expect(errorsFor({ caseType: "exchange" }).caseType).toBe("invalid_option")
    expect(errorsFor({ category: "" }).category).toBe("required")
    expect(errorsFor({ caseType: undefined }).caseType).toBe("required")
  })
})

describe("parseCaseFormData", () => {
  function fd(entries: Record<string, string>) {
    const f = new FormData()
    for (const [k, v] of Object.entries(entries)) f.set(k, v)
    f.set("image", new File([new Uint8Array([1])], "x.jpg"))
    return f
  }

  it("parses valid data and maps consent", () => {
    const r = parseCaseFormData(fd({ ...stringify(valid), consent: "true" }), TODAY)
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.consent).toBe(true)
  })

  it("returns field error codes", () => {
    const r = parseCaseFormData(
      fd({ caseType: "complaint", category: "laptop", model: "x", purchaseDate: "2030-01-01", reason: "short", consent: "false" }),
      TODAY,
    )
    expect(r).toEqual({
      success: false,
      fieldErrors: {
        model: "model_length",
        purchaseDate: "date_future",
        reason: "reason_too_short",
        consent: "consent_required",
      },
    })
  })

  it("treats missing fields as required", () => {
    const r = parseCaseFormData(new FormData(), TODAY)
    expect(r.success).toBe(false)
    if (!r.success) expect(r.fieldErrors.caseType).toBe("required")
  })
})

function stringify(o: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, String(v)]))
}
