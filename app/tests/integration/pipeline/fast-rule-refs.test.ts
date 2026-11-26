import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { fastRuleRefs } from "@/server/ai/pipeline/run-case-pipeline"

// Pure mapping, boundary values (ADR-006 3.1 allows this for pure functions).
describe("fastRuleRefs", () => {
  it.each([[0, ["R-2"]], [14, ["R-2"]], [15, ["R-3"]], [30, ["R-3"]]])("return day %i -> %j", (days, refs) => {
    expect(fastRuleRefs("return", days)).toEqual(refs)
  })
  it("complaint acceptance -> C-4", () => {
    expect(fastRuleRefs("complaint", 100)).toEqual(["C-4"])
  })
})
