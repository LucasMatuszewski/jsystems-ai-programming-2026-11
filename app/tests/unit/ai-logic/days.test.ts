import { describe, expect, it, vi } from "vitest"
import { daysSincePurchase } from "@/server/ai/logic/days"

vi.mock("server-only", () => ({}))

const DAY_MS = 24 * 60 * 60 * 1000
const baseDate = new Date("2026-11-26T11:00:00.000Z")

function daysAgo(days: number): string {
  return new Date(Date.UTC(2026, 10, 26) - days * DAY_MS).toISOString().slice(0, 10)
}

describe("daysSincePurchase", () => {
  it.each([0, 14, 15, 30, 31, 730, 731])("returns %i calendar days", (days) => {
    expect(daysSincePurchase(daysAgo(days), baseDate)).toBe(days)
  })

  it("uses the Warsaw calendar date around midnight UTC", () => {
    expect(daysSincePurchase("2024-01-01", new Date("2024-01-01T23:30:00.000Z"))).toBe(1)
  })

  it("counts calendar days over the Warsaw daylight-saving transition", () => {
    expect(daysSincePurchase("2024-03-30", new Date("2024-03-31T22:00:00.000Z"))).toBe(2)
  })

  it("counts leap day as one calendar day", () => {
    expect(daysSincePurchase("2024-02-29", new Date("2024-03-01T11:00:00.000Z"))).toBe(1)
  })
})
