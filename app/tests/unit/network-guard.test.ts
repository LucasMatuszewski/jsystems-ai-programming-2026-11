import { describe, expect, it } from "vitest"

describe("node project network guard", () => {
  it("throws on any fetch to openrouter.ai", () => {
    expect(() => fetch("https://openrouter.ai/api/v1/models")).toThrow(
      /blocked/
    )
  })
})
