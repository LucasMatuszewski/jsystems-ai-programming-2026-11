import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { MessageParts } from "@/components/chat/message-parts"
import { pl } from "@/lib/i18n/pl"
import { DECISIONS } from "@/lib/schemas/enums"
import type { CaseUIMessage } from "@/lib/types/chat"
import {
  initialVariant,
  recordedFirstMessage,
  recordedToolUpdate,
  updateMessage,
  updatePart,
  withExtraParts,
} from "./fixtures"

// Real /api/cases recordings that end with a `result` event (ADR-006).
const RECORDED_CASES = [
  "rule-return-45d",
  "rule-complaint-800d",
  "escalated-return-laptop-2",
  "escalated-complaint-phone-1",
  "mismatch-tv-phone-3",
] as const

const textNodes = (root: Node) => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  while (walker.nextNode()) nodes.push(walker.currentNode as Text)
  return nodes
}

const findTextNode = (root: Node, text: string) => {
  const node = textNodes(root).find((candidate) => candidate.textContent?.trim() === text)
  if (!node) throw new Error(`text node not found: ${text}`)
  return node
}

const followsInDom = (earlier: Node, later: Node) =>
  Boolean(earlier.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING)

describe("MessageParts: recorded first message (AC-21, AC-31)", () => {
  it.each(RECORDED_CASES)("%s renders greeting, decision card and body in DOM order", (name) => {
    const message = recordedFirstMessage(name)
    const greeting = message.parts[0]
    const body = message.parts[2]
    if (greeting?.type !== "text" || body?.type !== "text") throw new Error("unexpected parts")
    const bodyHeading = /^#{1,6}\s+(.+)$/m.exec(body.text)?.[1]?.trim()
    if (!bodyHeading) throw new Error("recording body has no heading")

    const { container } = render(<MessageParts message={message} />)
    const group = screen.getByRole("group")

    expect(followsInDom(findTextNode(container, greeting.text.trim()), group)).toBe(true)
    expect(followsInDom(group, findTextNode(container, bodyHeading))).toBe(true)
  })

  it.each(RECORDED_CASES)("%s renders Markdown (headings, lists) without raw syntax", (name) => {
    const { container } = render(<MessageParts message={recordedFirstMessage(name)} />)
    expect(container.querySelector("h3")).not.toBeNull()
    expect(container.querySelectorAll("li").length).toBeGreaterThan(0)
    expect(container.textContent).not.toMatch(/###|\*\*/)
  })

  it("renders bold text from the recording as strong (rule-return-45d)", () => {
    const { container } = render(<MessageParts message={recordedFirstMessage("rule-return-45d")} />)
    expect(within(container).getByText("R-4", { selector: "strong" })).toBeInTheDocument()
  })
})

describe("MessageParts: disclaimer on every decision (TAC-003-01)", () => {
  const base = recordedFirstMessage("rule-return-45d")

  it.each(DECISIONS)("initial card for %s carries pl.disclaimer exactly", (decision) => {
    // Derived from rule-return-45d: only the data-decision part's decision is changed.
    render(<MessageParts message={initialVariant(base, decision)} />)
    const group = screen.getByRole("group")
    expect(within(group).getByText(pl.disclaimer)).toBeInTheDocument()
  })

  it.each(DECISIONS)("update card for %s carries pl.disclaimer exactly", (decision) => {
    // Derived from rule-return-45d: a recorded update_recommendation output with newDecision changed.
    render(<MessageParts message={updateMessage(base, decision)} />)
    const group = screen.getByRole("group", { name: new RegExp(pl.updatedRecommendation) })
    expect(within(group).getByText(pl.disclaimer)).toBeInTheDocument()
  })
})

describe("MessageParts: recorded update_recommendation (AC-35)", () => {
  it("shows the updated label, previous → new and the recorded reason", () => {
    const recorded = recordedToolUpdate()
    const message = withExtraParts(recordedFirstMessage("rule-return-45d"), [
      updatePart(recorded.toolCallId, "output-available", recorded.input, recorded.output),
    ])
    render(<MessageParts message={message} />)
    const group = screen.getByRole("group", { name: new RegExp(pl.updatedRecommendation) })
    expect(group).toHaveTextContent(
      `${pl.decisions.Odrzucenie} → ${pl.decisions["Weryfikacja ręczna"]}`,
    )
    expect(within(group).getByText(String(recorded.output.reason))).toBeInTheDocument()
  })

  it.each(["repair", "replacement"] as const)("update card to Akceptacja shows the remedy %s like the first-decision card (G5-1)", (remedy) => {
    const recorded = recordedToolUpdate()
    const message = withExtraParts(recordedFirstMessage("rule-return-45d"), [
      updatePart(recorded.toolCallId, "output-available", recorded.input, {
        ...recorded.output,
        previousDecision: "Weryfikacja ręczna",
        newDecision: "Akceptacja",
        remedy,
      }),
    ])
    render(<MessageParts message={message} />)
    const group = screen.getByRole("group", { name: new RegExp(pl.updatedRecommendation) })
    expect(within(group).getByText(pl.remedies[remedy])).toBeInTheDocument()
  })

  it("update card without a remedy shows no remedy label", () => {
    const recorded = recordedToolUpdate()
    const message = withExtraParts(recordedFirstMessage("rule-return-45d"), [
      updatePart(recorded.toolCallId, "output-available", recorded.input, recorded.output),
    ])
    render(<MessageParts message={message} />)
    const group = screen.getByRole("group", { name: new RegExp(pl.updatedRecommendation) })
    expect(within(group).queryByText(pl.remedies.repair)).toBeNull()
    expect(within(group).queryByText(pl.remedies.replacement)).toBeNull()
  })

  it("input-streaming and input-available show the updating text, not a card", () => {
    const recorded = recordedToolUpdate()
    for (const state of ["input-streaming", "input-available"] as const) {
      const message = withExtraParts(recordedFirstMessage("rule-return-45d"), [
        updatePart(recorded.toolCallId, state, recorded.input),
      ])
      const { unmount } = render(<MessageParts message={message} />)
      expect(screen.getByText(pl.chat.updatingRecommendation)).toBeInTheDocument()
      expect(screen.getAllByRole("group")).toHaveLength(1)
      unmount()
    }
  })

  it("output-error renders nothing for the tool part", () => {
    const recorded = recordedToolUpdate()
    const base = recordedFirstMessage("rule-return-45d")
    const { container: plain } = render(<MessageParts message={base} />)
    const plainHtml = plain.innerHTML
    const { container } = render(
      <MessageParts
        message={withExtraParts(base, [updatePart(recorded.toolCallId, "output-error", recorded.input)])}
      />,
    )
    expect(container.innerHTML).toBe(plainHtml)
    expect(screen.queryByText(pl.chat.updatingRecommendation)).toBeNull()
  })
})

describe("MessageParts: parts that render nothing (TAC-003-02)", () => {
  it("reasoning, reasoning-file, step-start and unknown parts add no output", () => {
    const base = recordedFirstMessage("rule-return-45d")
    const reasoning = recordedToolUpdate().reasoning.slice(0, 120)
    const extra: unknown[] = [
      { type: "step-start" },
      { type: "reasoning", text: reasoning, state: "done" },
      { type: "reasoning-file", url: "https://example.invalid/r.txt", mediaType: "text/plain" },
      { type: "data-unknown-thing", data: { note: "unknown" } },
    ]
    const { container: plain } = render(<MessageParts message={base} />)
    const plainHtml = plain.innerHTML
    const { container } = render(<MessageParts message={withExtraParts(base, extra)} />)
    expect(container.innerHTML).toBe(plainHtml)
    expect(container.textContent).not.toContain(reasoning.slice(0, 40))
  })

  it("a message with only reasoning renders no output at all", () => {
    const message: CaseUIMessage = {
      id: "only-reasoning",
      role: "assistant",
      parts: [{ type: "reasoning", text: "tajne rozumowanie", state: "done" }] as unknown as CaseUIMessage["parts"],
    }
    const { container } = render(<MessageParts message={message} />)
    expect(container.textContent).toBe("")
  })
})
