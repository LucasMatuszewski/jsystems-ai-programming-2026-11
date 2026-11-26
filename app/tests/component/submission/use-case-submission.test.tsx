import path from "node:path"
import { act, render, renderHook, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { AnalysisErrorBanner } from "@/components/case-submission/analysis-error-banner"
import { useCaseSubmission, type SubmissionState } from "@/components/case-submission/use-case-submission"
import { pl } from "@/lib/i18n/pl"
import { SESSION_KEY } from "@/lib/session-store"
import type { CaseFormFields, CaseSessionPayload, StoredSession } from "@/lib/schemas"
import { replayAppResponse } from "@/tests/helpers/replay-app"
import { steppedRecording } from "./stepped-response"

const cases = (name: string) => path.resolve(process.cwd(), "tests/fixtures/app/cases", name)

const values: CaseFormFields = {
  caseType: "return",
  category: "laptop",
  model: "Lenovo ThinkPad E14",
  purchaseDate: "2026-11-16",
  reason: "",
  consent: true,
}
const photo = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], "laptop-2.webp", { type: "image/webp" })

async function recordedResult(): Promise<CaseSessionPayload> {
  const body = await replayAppResponse(cases("escalated-return-laptop-2.ndjson.json")).text()
  const result = body
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as { type: string; case?: CaseSessionPayload })
    .find((event) => event.type === "result")
  if (!result?.case) throw new Error("no result event")
  return result.case
}

beforeEach(() => {
  window.sessionStorage.clear()
})

describe("useCaseSubmission", () => {
  it("shows the upload, analysis and decision stages in order and passes the payload to onSuccess", async () => {
    const expected = await recordedResult()
    const { response, step } = await steppedRecording("escalated-return-laptop-2.ndjson.json")
    const fetchImpl = vi.fn(async () => response)
    const onSuccess = vi.fn()

    const { result } = renderHook(() => useCaseSubmission({ fetchImpl, onSuccess }))
    const stageTexts: string[] = []
    const stageOf = (state: SubmissionState) =>
      state.status === "submitting" ? state.stage : state.status

    let submitted: Promise<void> = Promise.resolve()
    act(() => {
      submitted = result.current.submit(values, photo)
    })
    await waitFor(() => expect(result.current.state).toEqual({ status: "submitting", stage: "upload" }))
    stageTexts.push(stageOf(result.current.state))

    await act(() => step())
    await waitFor(() => expect(result.current.state).toEqual({ status: "submitting", stage: "analysis" }))
    stageTexts.push(stageOf(result.current.state))

    await act(() => step())
    await waitFor(() => expect(result.current.state).toEqual({ status: "submitting", stage: "decision" }))
    stageTexts.push(stageOf(result.current.state))

    await act(() => step())
    await act(async () => {
      await submitted
    })

    expect(stageTexts).toEqual(["upload", "analysis", "decision"])
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(onSuccess).toHaveBeenCalledTimes(1)
    expect(onSuccess).toHaveBeenCalledWith(expected)

    const stored = JSON.parse(window.sessionStorage.getItem(SESSION_KEY) ?? "null") as StoredSession
    expect(stored.version).toBe(1)
    expect(stored.case).toEqual(expected)
    expect(stored.messages).toEqual([expected.firstMessage])
  })

  it("posts multipart FormData with the form fields, consent and the image", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      replayAppResponse(cases("escalated-return-laptop-2.ndjson.json")),
    )
    const { result } = renderHook(() => useCaseSubmission({ fetchImpl, onSuccess: vi.fn() }))

    await act(async () => {
      await result.current.submit(values, photo)
    })

    const [url, init] = fetchImpl.mock.calls[0] ?? []
    expect(url).toBe("/api/cases")
    expect(init?.method).toBe("POST")
    const body = init?.body as FormData
    expect(body).toBeInstanceOf(FormData)
    expect(body.get("caseType")).toBe("return")
    expect(body.get("category")).toBe("laptop")
    expect(body.get("model")).toBe("Lenovo ThinkPad E14")
    expect(body.get("purchaseDate")).toBe("2026-11-16")
    expect(body.get("consent")).toBe("true")
    expect(body.get("image")).toBeInstanceOf(File)
  })

  it("keeps the error code for retry when the stream reports an upstream error event", async () => {
    const fetchImpl = vi.fn(async () => replayAppResponse(cases("upstream-failure.ndjson.json")))
    const onSuccess = vi.fn()
    const { result } = renderHook(() => useCaseSubmission({ fetchImpl, onSuccess }))

    await act(async () => {
      await result.current.submit(values, photo)
    })

    expect(result.current.state).toEqual({ status: "error", code: "model_unavailable" })
    expect(onSuccess).not.toHaveBeenCalled()
    expect(window.sessionStorage.getItem(SESSION_KEY)).toBeNull()
  })

  it("maps a 400 pre-stream response to validation_failed", async () => {
    const fetchImpl = vi.fn(async () => replayAppResponse(cases("validation-400.json")))
    const { result } = renderHook(() => useCaseSubmission({ fetchImpl, onSuccess: vi.fn() }))

    await act(async () => {
      await result.current.submit(values, photo)
    })

    expect(result.current.state).toEqual({ status: "error", code: "validation_failed" })
  })

  it("maps a 415 pre-stream response to unsupported_media_type", async () => {
    const fetchImpl = vi.fn(async () => replayAppResponse(cases("unsupported-415.json")))
    const { result } = renderHook(() => useCaseSubmission({ fetchImpl, onSuccess: vi.fn() }))

    await act(async () => {
      await result.current.submit(values, photo)
    })

    expect(result.current.state).toEqual({ status: "error", code: "unsupported_media_type" })
  })

  it("maps a network failure to analysis_failed", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch")
    })
    const { result } = renderHook(() => useCaseSubmission({ fetchImpl, onSuccess: vi.fn() }))

    await act(async () => {
      await result.current.submit(values, photo)
    })

    expect(result.current.state).toEqual({ status: "error", code: "analysis_failed" })
  })

  it("ignores a second submit while one is in flight (AC-13)", async () => {
    const { response, step } = await steppedRecording("escalated-return-laptop-2.ndjson.json")
    const fetchImpl = vi.fn(async () => response)
    const onSuccess = vi.fn()
    const { result } = renderHook(() => useCaseSubmission({ fetchImpl, onSuccess }))

    let first: Promise<void> = Promise.resolve()
    let second: Promise<void> = Promise.resolve()
    act(() => {
      first = result.current.submit(values, photo)
      second = result.current.submit(values, photo)
    })
    await second
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(result.current.state).toEqual({ status: "submitting", stage: "upload" }))

    await act(() => step())
    await act(() => step())
    await act(() => step())
    await act(async () => {
      await first
    })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(onSuccess).toHaveBeenCalledTimes(1)
  })
})

describe("submission UI with the error banner", () => {
  function Harness({
    fixture,
    onSuccess = vi.fn(),
  }: {
    fixture: string
    onSuccess?: (payload: CaseSessionPayload) => void
  }) {
    const fetchImpl = async () => replayAppResponse(cases(fixture))
    const { state, submit } = useCaseSubmission({ fetchImpl, onSuccess })
    return (
      <div>
        <button type="button" onClick={() => void submit(values, photo)}>
          send
        </button>
        <p data-testid="state">{state.status === "error" ? state.code : state.status}</p>
        {state.status === "error" ? (
          <AnalysisErrorBanner code={state.code} onRetry={() => void submit(values, photo)} />
        ) : null}
      </div>
    )
  }

  it("shows the analysis banner with a retry button after an upstream failure, keeping the error for retry", async () => {
    const user = userEvent.setup()
    render(<Harness fixture="upstream-failure.ndjson.json" />)

    await user.click(screen.getByRole("button", { name: "send" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(pl.analysisFailed.banner)
    expect(screen.getByRole("button", { name: pl.analysisFailed.retry })).toBeInTheDocument()
    expect(screen.getByTestId("state")).toHaveTextContent("model_unavailable")
  })

  it("shows the generic validation text for a 400 without a retry button", async () => {
    const user = userEvent.setup()
    render(<Harness fixture="validation-400.json" />)

    await user.click(screen.getByRole("button", { name: "send" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(pl.errors.validation_failed)
    expect(screen.queryByRole("button", { name: pl.analysisFailed.retry })).not.toBeInTheDocument()
  })

  it("shows the generic unsupported media text for a 415", async () => {
    const user = userEvent.setup()
    render(<Harness fixture="unsupported-415.json" />)

    await user.click(screen.getByRole("button", { name: "send" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(pl.errors.unsupported_media_type)
  })
})
