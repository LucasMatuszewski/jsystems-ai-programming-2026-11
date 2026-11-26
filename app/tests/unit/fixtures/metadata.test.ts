import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

// ADR-006 5: every recording carries metadata, no secrets, no image data.
const root = path.resolve(__dirname, "../../fixtures")

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    return e.isDirectory() ? walk(p) : p.endsWith(".json") ? [p] : []
  })
}

const files = walk(root)

describe("fixture metadata scan", () => {
  it("finds fixtures", () => expect(files.length).toBeGreaterThan(0))

  for (const file of files) {
    const rel = path.relative(root, file)
    describe(rel, () => {
      const text = fs.readFileSync(file, "utf8")
      it("has required meta fields", () => {
        const meta = (JSON.parse(text) as { meta?: Record<string, unknown> }).meta
        expect(meta?.capturedAt).toBeTruthy()
        expect(meta?.target).toBeTruthy()
        expect(meta?.request).toBeTruthy()
        expect(meta?.versions).toBeTruthy()
      })
      it("contains no API key", () => {
        for (const m of text.matchAll(/sk-or-v1-([A-Za-z0-9_-]*)/g)) {
          const tail = m[1] ?? ""
          expect(tail === "invalid" || tail.length <= 10).toBe(true)
        }
      })
      if (rel.startsWith("openrouter")) {
        it("contains no image data", () => {
          expect(text).not.toContain("data:image")
        })
      }
    })
  }
})
