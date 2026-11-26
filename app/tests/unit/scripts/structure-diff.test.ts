import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import {
  captureFromExchange,
  diffCapture,
  diffShapes,
  shapeOf,
} from "../../../scripts/lib/structure-diff"

const errorsDir = path.join(process.cwd(), "tests", "fixtures", "openrouter", "errors")

type RecordedExchange = { response?: { status: number; body: string } }
type RecordedFixture = { exchanges: RecordedExchange[] }

function loadErrorFixture(name: string): RecordedFixture {
  return JSON.parse(fs.readFileSync(path.join(errorsDir, name), "utf8")) as RecordedFixture
}

const deactivatedA = loadErrorFixture("decisions-upstream-account-deactivated-1.json")
const deactivatedB = loadErrorFixture("decisions-upstream-account-deactivated-2.json")

const baselineA = captureFromExchange(deactivatedA.exchanges[0]!.response)
const baselineB = captureFromExchange(deactivatedB.exchanges[0]!.response)

describe("shapeOf", () => {
  it("keeps keys and replaces leaf values with their JSON types", () => {
    expect(shapeOf({ a: "x", b: 1, c: null, d: true, e: { f: [] } })).toEqual({
      a: "string",
      b: "number",
      c: "null",
      d: "boolean",
      e: { f: [] },
    })
  })

  it("keeps the shape of the first array element only", () => {
    expect(shapeOf([{ id: 1 }, { id: "ignored" }])).toEqual([{ id: "number" }])
  })
})

describe("captureFromExchange", () => {
  it("parses the recorded error body into JSON and keeps the status", () => {
    expect(baselineA.status).toBe(401)
    expect(baselineA.body).toEqual(JSON.parse(deactivatedA.exchanges[0]!.response!.body))
  })

  it("returns null status and body when there was no HTTP response", () => {
    expect(captureFromExchange(undefined)).toEqual({ status: null, body: null })
  })
})

describe("diffCapture with real recorded error bodies", () => {
  it("reports no difference between two recordings of the same upstream error", () => {
    expect(diffCapture(baselineA, baselineB)).toEqual([])
  })

  it("reports a status difference", () => {
    const diffs = diffCapture(baselineA, { ...baselineB, status: 200 })
    expect(diffs).toEqual(["status: baseline=401 live=200"])
  })

  it("reports a missing HTTP response as a status difference", () => {
    const diffs = diffCapture(baselineA, { status: null, body: null })
    expect(diffs.some((d) => d.startsWith("status: baseline=401 live=null"))).toBe(true)
  })

  it("reports a renamed key inside the error body", () => {
    const live = structuredClone(baselineB)
    const error = (live.body as { error: Record<string, unknown> }).error
    error.error_code = error.code
    delete error.code
    const diffs = diffCapture(baselineA, live)
    expect(diffs).toContain(".error.code: only in fixture")
    expect(diffs).toContain(".error.error_code: only in live")
  })

  it("reports a value type change inside the error body", () => {
    const live = structuredClone(baselineB)
    const error = (live.body as { error: Record<string, unknown> }).error
    error.code = "account_deactivated"
    expect(diffCapture(baselineA, live)).toEqual([".error.code: fixture=\"number\" live=\"string\""])
  })

  it("reports a missing top-level key", () => {
    const live = { status: 401, body: {} }
    expect(diffCapture(baselineA, live)).toEqual([".error: only in fixture"])
  })
})

describe("diffShapes", () => {
  it("reports array against object mismatch", () => {
    expect(diffShapes({ a: [] }, { a: {} })).toEqual([".a: array mismatch"])
  })
})
