import { readFileSync } from "node:fs"
import path from "node:path"
import { CasesStreamEventSchema, type CaseSessionPayload } from "@/lib/schemas/session"

/** Parses the `result` event of a recorded /api/cases response (ADR-006 capture). */
export function loadPayload(fixtureName: string): CaseSessionPayload {
  const file = path.resolve(process.cwd(), "tests/fixtures/app/cases", fixtureName)
  const capture = JSON.parse(readFileSync(file, "utf8")) as { response: { body: string } }
  const events = capture.response.body
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => CasesStreamEventSchema.parse(JSON.parse(line)))
  const result = events.find((event) => event.type === "result")
  if (!result || result.type !== "result") throw new Error(`no result event in ${fixtureName}`)
  return result.case
}
