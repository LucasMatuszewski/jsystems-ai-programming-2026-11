import { act, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { pl } from "@/lib/i18n/pl"
import { SESSION_KEY } from "@/lib/session-store"
import { chatErrorChunk, readStored, renderChat, replayChatFetch, storedSession } from "./harness"

const input = () => screen.getByPlaceholderText(pl.chat.inputPlaceholder)
const sendButton = () => screen.getByRole("button", { name: pl.chat.send })
const log = () => screen.getByRole("log")
const UPDATE_FACT =
  "Chcę dodać ważny fakt: laptop nigdy nie był używany, mam oryginalne opakowanie i wszystkie folie ochronne są na swoim miejscu. Smugi na płytce dotykowej to tylko odciski palców ze sklepu."

beforeEach(() => sessionStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe("mount", () => {
  it("renders the stored conversation and makes no request (ADR-006 3.2)", () => {
    const replay = replayChatFetch({ name: "plain-return" })
    renderChat(replay.fetch)
    expect(within(log()).getByText(/Podsumowanie sprawy/)).toBeInTheDocument()
    expect(replay.calls).not.toHaveBeenCalled()
  })
})

describe("plain reply (AC-33)", () => {
  it("shows the user message at once and streams the agent reply after it", async () => {
    const user = userEvent.setup()
    const replay = replayChatFetch({ name: "plain-return" })
    renderChat(replay.fetch)

    await user.type(input(), "Jak mam zapakować laptopa?")
    await user.click(sendButton())

    expect(within(log()).getByText("Jak mam zapakować laptopa?")).toBeInTheDocument()
    await waitFor(() => expect(input()).toBeEnabled())
    expect(replay.calls).toHaveBeenCalledTimes(1)
    const bubbles = log().children
    expect(bubbles.length).toBe(3) // first message, user, agent reply
    expect(bubbles[2]?.textContent?.trim().length).toBeGreaterThan(20)
    expect(input()).toHaveValue("")
  })

  it("sends the stored case context and no policy text (ADR-002 5)", async () => {
    const user = userEvent.setup()
    const replay = replayChatFetch({ name: "plain-return" })
    renderChat(replay.fetch)
    await user.type(input(), "Pytanie")
    await user.click(sendButton())
    await waitFor(() => expect(input()).toBeEnabled())

    const body = replay.bodies[0] as {
      id: string
      messages: Array<{ role: string }>
      caseContext: { caseId: string; currentDecision: { decision: string; source: string }; form: { model: string } }
    }
    expect(Object.keys(body)).toEqual(expect.arrayContaining(["id", "messages", "caseContext"]))
    expect(body.messages.map((m) => m.role)).toEqual(["assistant", "user"])
    expect(body.caseContext.form.model).toBe("Lenovo ThinkPad E14")
    expect(body.caseContext.currentDecision).toMatchObject({ decision: "Weryfikacja ręczna", source: "initial" })
    expect(JSON.stringify(body)).not.toMatch(/instructions|policy/i)
  })
})

describe("recommendation update (AC-35, AC-36)", () => {
  it("shows the update card and moves the summary to the new decision", async () => {
    const user = userEvent.setup()
    const replay = replayChatFetch({ name: "update-return" })
    renderChat(replay.fetch)
    const summary = () => screen.getAllByText(pl.summary.currentDecision)[0]!.parentElement!
    expect(within(summary()).getByText(pl.decisions["Weryfikacja ręczna"])).toBeInTheDocument()

    await user.click(input())
    await user.paste(UPDATE_FACT)
    await user.click(sendButton())

    await waitFor(() => expect(screen.getByRole("group", { name: new RegExp(pl.updatedRecommendation) })).toBeInTheDocument())
    await waitFor(() => expect(input()).toBeEnabled())
    expect(within(summary()).getByText(pl.decisions.Akceptacja)).toBeInTheDocument()
    expect(within(summary()).queryByText(pl.decisions["Weryfikacja ręczna"])).toBeNull()
  })

  it("persists the turn with the update so a refresh keeps the new decision (AC-38)", async () => {
    const user = userEvent.setup()
    const replay = replayChatFetch({ name: "update-return" })
    renderChat(replay.fetch)
    await user.click(input())
    await user.paste(UPDATE_FACT)
    await user.click(sendButton())
    await waitFor(() => expect(input()).toBeEnabled())

    const stored = readStored()
    expect(stored?.messages.map((m) => m.role)).toEqual(["assistant", "user", "assistant"])
    expect(JSON.stringify(stored?.messages[2])).toContain("tool-update_recommendation")
  })
})

describe("failure and retry (AC-42, AC-43)", () => {
  it("keeps the user message and shows the error row with Ponów", async () => {
    const user = userEvent.setup()
    const replay = replayChatFetch({ name: "upstream-failure" })
    renderChat(replay.fetch)
    await user.type(input(), "Jak mam zapakować laptopa?")
    await user.click(sendButton())

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent(pl.chat.errorMessage)
    expect(within(alert).getByRole("button", { name: pl.chat.retry })).toBeInTheDocument()
    expect(within(log()).getByText("Jak mam zapakować laptopa?")).toBeInTheDocument()
    expect(alert.textContent).not.toMatch(/chat_failed|401|openrouter|error/i)
    await waitFor(() => expect(input()).toBeEnabled())
  })

  it("Ponów sends exactly one request, does not duplicate the message and clears the row", async () => {
    const user = userEvent.setup()
    const replay = replayChatFetch({ name: "upstream-failure" }, { name: "plain-return" })
    renderChat(replay.fetch)
    await user.type(input(), "Jak mam zapakować laptopa?")
    await user.click(sendButton())
    await user.click(await screen.findByRole("button", { name: pl.chat.retry }))

    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull())
    await waitFor(() => expect(input()).toBeEnabled())
    expect(replay.calls).toHaveBeenCalledTimes(2)
    expect(within(log()).getAllByText("Jak mam zapakować laptopa?")).toHaveLength(1)
    const second = replay.bodies[1] as { messages: Array<{ role: string }> }
    expect(second.messages.map((m) => m.role)).toEqual(["assistant", "user"])
    expect(log().children.length).toBe(3)
  })
})

describe("stream cut short (T28 F1, AC-42/43)", () => {
  // DERIVED from plain-return: its first events verbatim, then a failure.
  const cutAfter = (events: number) => (body: string) => body.split("\n\n").slice(0, events).join("\n\n") + "\n\n"

  it("partial reply followed by the recorded error chunk: partial text stays, error row with Ponów, no technical text", async () => {
    const user = userEvent.setup()
    const errorChunk = chatErrorChunk()
    const replay = replayChatFetch({ name: "plain-return", derive: (body) => cutAfter(6)(body) + errorChunk + "data: [DONE]\n\n" })
    renderChat(replay.fetch)
    await user.type(input(), "Jak mam zapakować laptopa?")
    await user.click(sendButton())

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent(pl.chat.errorMessage)
    expect(within(alert).getByRole("button", { name: pl.chat.retry })).toBeInTheDocument()
    expect(within(log()).getByText("Jak mam zapakować laptopa?")).toBeInTheDocument()
    expect(log().children.length).toBe(4) // first message, user, partial reply (error row is the 4th child)
    expect(alert.textContent).not.toMatch(/chat_failed|timeout|abort|error/i)
    await waitFor(() => expect(input()).toBeEnabled())
  })

  it("connection dropped mid-stream (derived from plain-return: body errors after 6 events): error row with Ponów", async () => {
    const user = userEvent.setup()
    const replay = replayChatFetch({ name: "plain-return", dropAfter: (body) => cutAfter(6)(body) })
    renderChat(replay.fetch)
    await user.type(input(), "Jak mam zapakować laptopa?")
    await user.click(sendButton())

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent(pl.chat.errorMessage)
    expect(within(alert).getByRole("button", { name: pl.chat.retry })).toBeInTheDocument()
    await waitFor(() => expect(input()).toBeEnabled())
  })

  it("an error before any text (recorded upstream-failure): error row, the empty reply is not shown as a bubble", async () => {
    const user = userEvent.setup()
    const replay = replayChatFetch({ name: "upstream-failure" })
    renderChat(replay.fetch)
    await user.type(input(), "Pytanie")
    await user.click(sendButton())
    await screen.findByRole("alert")
    expect(log().children.length).toBe(3) // first message, user message, error row
  })
})

describe("input rules (AC-32)", () => {
  it("cannot send empty or whitespace-only messages", async () => {
    const user = userEvent.setup()
    const replay = replayChatFetch({ name: "plain-return" })
    renderChat(replay.fetch)
    expect(sendButton()).toBeDisabled()
    await user.type(input(), "   ")
    expect(sendButton()).toBeDisabled()
    await user.keyboard("{Enter}")
    expect(replay.calls).not.toHaveBeenCalled()
  })

  it("cannot send more than 2000 characters, exactly 2000 is fine", async () => {
    const user = userEvent.setup()
    const replay = replayChatFetch({ name: "plain-return" })
    renderChat(replay.fetch)
    await user.click(input())
    await user.paste("a".repeat(2001))
    expect(sendButton()).toBeDisabled()
    expect(screen.getByText(pl.chat.tooLong)).toBeInTheDocument()
    await user.keyboard("{Enter}")
    expect(replay.calls).not.toHaveBeenCalled()

    await user.keyboard("{Backspace}")
    expect(sendButton()).toBeEnabled()
    expect(screen.queryByText(pl.chat.tooLong)).toBeNull()
  })

  it("Enter sends, Shift+Enter inserts a newline", async () => {
    const user = userEvent.setup()
    const replay = replayChatFetch({ name: "plain-return" })
    renderChat(replay.fetch)
    await user.type(input(), "linia 1{Shift>}{Enter}{/Shift}linia 2")
    expect(input()).toHaveValue("linia 1\nlinia 2")
    expect(replay.calls).not.toHaveBeenCalled()

    await user.keyboard("{Enter}")
    await waitFor(() => expect(replay.calls).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(input()).toBeEnabled())
    expect(input()).toHaveValue("")
  })

  it("is disabled while the reply streams and enabled afterwards (AC-33)", async () => {
    const user = userEvent.setup()
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    const replay = replayChatFetch({ name: "plain-return", gate })
    renderChat(replay.fetch)
    await user.type(input(), "Pytanie")
    await user.click(sendButton())

    await waitFor(() => expect(input()).toBeDisabled())
    expect(sendButton()).toBeDisabled()
    await act(async () => release())
    await waitFor(() => expect(input()).toBeEnabled())
  })
})

describe("persistence (AC-38)", () => {
  it("stores the messages after a finished turn", async () => {
    const user = userEvent.setup()
    const replay = replayChatFetch({ name: "plain-return" })
    renderChat(replay.fetch)
    await user.type(input(), "Pytanie")
    await user.click(sendButton())
    await waitFor(() => expect(input()).toBeEnabled())

    const stored = readStored()
    expect(stored?.messages.map((m) => m.role)).toEqual(["assistant", "user", "assistant"])
    expect(stored?.case.caseId).toBe(storedSession().case.caseId)
  })

  it("shows a notice and keeps working when the storage quota is exceeded", async () => {
    const user = userEvent.setup()
    const quota = new DOMException("full", "QuotaExceededError")
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw quota
    })
    const replay = replayChatFetch({ name: "plain-return" })
    renderChat(replay.fetch)
    await user.type(input(), "Pytanie")
    await user.click(sendButton())

    expect(await screen.findByText(pl.chat.storageFailed)).toBeInTheDocument()
    await waitFor(() => expect(input()).toBeEnabled())
    expect(log().children.length).toBe(3)
  })

  it("shows the storage notice at once when the session lives in memory only (T28 F6)", () => {
    const replay = replayChatFetch({ name: "plain-return" })
    renderChat(replay.fetch, storedSession(), { storageUnavailable: true })
    expect(screen.getByRole("status")).toHaveTextContent(pl.chat.storageUnavailable)
    expect(replay.calls).not.toHaveBeenCalled()
  })

  it("restores the stored conversation on a fresh mount without a request", async () => {
    const user = userEvent.setup()
    const first = replayChatFetch({ name: "plain-return" })
    const view = renderChat(first.fetch)
    await user.type(input(), "Pytanie")
    await user.click(sendButton())
    await waitFor(() => expect(input()).toBeEnabled())
    const before = log().textContent
    view.unmount()

    const second = replayChatFetch({ name: "plain-return" })
    renderChat(second.fetch, JSON.parse(sessionStorage.getItem(SESSION_KEY)!))
    expect(log().textContent).toBe(before)
    expect(second.calls).not.toHaveBeenCalled()
  })
})

describe("scrolling (AC-37)", () => {
  it("scrolls the log to the bottom when a message is added", async () => {
    const user = userEvent.setup()
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(1234)
    const replay = replayChatFetch({ name: "plain-return" })
    renderChat(replay.fetch)
    await user.type(input(), "Pytanie")
    await user.click(sendButton())
    await waitFor(() => expect(input()).toBeEnabled())
    // The scroll effect runs after the commit that re-enables the input; wait for its result instead of
    // assuming it already ran when the input became enabled (ordering varies under CPU load).
    await waitFor(() => expect(log().scrollTop).toBe(1234))
  })
})
