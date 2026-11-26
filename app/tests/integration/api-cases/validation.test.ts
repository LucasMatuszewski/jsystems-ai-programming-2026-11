import { describe, expect, it, vi } from "vitest"
import { handleCasesRequest } from "@/server/cases/handle-cases"
import {
  buildRequest, COMPLAINT_FORM, EXAMPLES, harness, imageFile, LOGO_SVG, RETURN_FORM,
} from "./helpers"

vi.mock("server-only", () => ({}))

// ADR-002 3 image rules, 5 errors; TAC-002-01: invalid input never calls a model.
const photo = () => imageFile(`${EXAMPLES}/laptop-2.webp`, "image/webp")

describe("POST /api/cases pre-stream errors", () => {
  it("400 with field codes for invalid text fields, no model call, one incoming log line", async () => {
    const h = harness()
    const res = await handleCasesRequest(
      buildRequest({ ...RETURN_FORM, model: "A", purchaseDate: "2026-11-27", consent: "false" }, { image: photo() }),
      h.deps,
    )
    expect(res.status).toBe(400)
    expect(res.headers.get("content-type")).toContain("application/json")
    expect(await res.json()).toEqual({
      code: "validation_failed",
      fieldErrors: { model: "model_length", purchaseDate: "date_future", consent: "consent_required" },
    })
    expect(h.fetchCalls()).toBe(0)
    expect(h.upstreamLines()).toEqual([])
    expect(h.incomingLines()).toEqual([expect.objectContaining({ route: "/api/cases", status: 400 })])
  })

  it("400 reason_too_short for a complaint with a short reason", async () => {
    const h = harness()
    const res = await handleCasesRequest(
      buildRequest({ ...COMPLAINT_FORM, reason: "krótko" }, { image: photo() }),
      h.deps,
    )
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ code: "validation_failed", fieldErrors: { reason: "reason_too_short" } })
    expect(h.fetchCalls()).toBe(0)
  })

  it("400 with image required when the image part is missing", async () => {
    const h = harness()
    const res = await handleCasesRequest(buildRequest(RETURN_FORM, { image: null }), h.deps)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ code: "validation_failed", fieldErrors: { image: "required" } })
    expect(h.fetchCalls()).toBe(0)
  })

  it("415 unsupported_media_type for the real logo.svg, no model call", async () => {
    const h = harness()
    const res = await handleCasesRequest(
      buildRequest(RETURN_FORM, { image: imageFile(LOGO_SVG, "image/svg+xml") }),
      h.deps,
    )
    expect(res.status).toBe(415)
    expect(await res.json()).toEqual({ code: "unsupported_media_type" })
    expect(h.fetchCalls()).toBe(0)
    expect(h.upstreamLines()).toEqual([])
  })

  it("413 file_too_large when Content-Length is 11 MB + 1 byte, before parsing", async () => {
    const h = harness()
    const res = await handleCasesRequest(
      buildRequest(RETURN_FORM, { image: photo(), headers: { "content-length": "11534337" } }),
      h.deps,
    )
    expect(res.status).toBe(413)
    expect(await res.json()).toEqual({ code: "file_too_large" })
    expect(h.fetchCalls()).toBe(0)
  })

  // T28 F5: the 11 MB limit holds while reading the body, even without Content-Length (chunked upload).
  it("413 file_too_large for a streamed body over 11 MB without Content-Length, reading stops at the limit", async () => {
    const h = harness()
    const head = new Request("http://localhost:3000/api/cases", { method: "POST", body: (() => { const f = new FormData(); f.append("caseType", "return"); f.append("image", photo()); return f })() })
    const contentType = head.headers.get("content-type") as string
    const headBytes = new Uint8Array(await head.arrayBuffer())
    const filler = new Uint8Array(256 * 1024).fill(0x78)
    let pulled = 0
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1
        if (pulled === 1) controller.enqueue(headBytes)
        else if (pulled > 200) controller.close()
        else controller.enqueue(filler)
      },
    })
    const request = new Request("http://localhost:3000/api/cases", { method: "POST", headers: { "content-type": contentType }, body, duplex: "half" } as RequestInit)
    expect(request.headers.get("content-length")).toBeNull()
    const res = await handleCasesRequest(request, h.deps)
    expect(res.status).toBe(413)
    expect(await res.json()).toEqual({ code: "file_too_large" })
    expect(h.fetchCalls()).toBe(0)
    expect(pulled).toBeLessThan(60) // 11 MB = 44 chunks of 256 KB
  })

  it("500 server_misconfigured without leaking variable values when OPENROUTER_API_KEY is absent", async () => {
    const saved = process.env.OPENROUTER_API_KEY
    delete process.env.OPENROUTER_API_KEY
    try {
      const h = harness()
      const res = await handleCasesRequest(buildRequest(RETURN_FORM, { image: photo() }), {
        now: h.deps.now,
        requestId: h.deps.requestId,
        callLogSink: h.deps.callLogSink,
      })
      expect(res.status).toBe(500)
      const body = await res.json()
      expect(body).toEqual({ code: "server_misconfigured" })
      expect(JSON.stringify(body)).not.toContain("OPENROUTER")
    } finally {
      if (saved !== undefined) process.env.OPENROUTER_API_KEY = saved
    }
  })
})
