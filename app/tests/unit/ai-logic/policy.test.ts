import path from "node:path"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { describe, expect, it, vi } from "vitest"
import { loadPolicy } from "@/server/ai/logic/policy"

vi.mock("server-only", () => ({}))

describe("loadPolicy", () => {
  it("loads real policy text and extracts root and numbered sub-rule IDs", async () => {
    const [returns, complaints] = await Promise.all([loadPolicy("return"), loadPolicy("complaint")])
    expect(returns.ruleIds).toEqual(
      expect.arrayContaining([
        "R-1", "R-2", "R-2.1", "R-2.4", "R-3", "R-3.1", "R-4", "R-5", "R-6", "R-7", "R-8", "R-8.4",
      ]),
    )
    expect(complaints.ruleIds).toEqual(
      expect.arrayContaining([
        "C-1", "C-2", "C-2.2", "C-3", "C-4", "C-5", "C-6", "C-7", "C-7.3", "C-8", "C-9", "C-9.5",
      ]),
    )
    expect(returns.text).toContain("Return Policy")
    expect(complaints.text).toContain("Complaint Policy")
    expect(returns.version).toMatch(/^[a-f0-9]{12}$/)
    expect(complaints.version).toMatch(/^[a-f0-9]{12}$/)
  })

  it("throws if the policy directory is missing", async () => {
    expect(() => loadPolicy("return", path.resolve("tests", "missing-policies"))).toThrow()
  })

  it("throws if the policy file has no rule IDs", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "policy-without-rules-"))
    try {
      writeFileSync(path.join(dir, "return-policy.md"), "# Unnumbered policy\n", "utf8")
      expect(() => loadPolicy("return", dir)).toThrow(/no rule IDs/i)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
