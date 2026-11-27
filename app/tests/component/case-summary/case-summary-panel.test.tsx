import { fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { CaseSummaryPanel } from "@/components/case-summary/case-summary-panel"
import { pl } from "@/lib/i18n/pl"
import { loadPayload } from "./load-payload"

const returnCase = loadPayload("escalated-return-laptop-2.ndjson.json")
const complaintCase = loadPayload("escalated-complaint-phone-1.ndjson.json")

const returnDecision = { decision: returnCase.decision.decision, ruleRefs: returnCase.decision.ruleRefs }
const complaintDecision = { decision: complaintCase.decision.decision, ruleRefs: complaintCase.decision.ruleRefs }

describe("CaseSummaryPanel desktop variant (AC-36)", () => {
  it("shows type, category, model, purchase date, days since purchase and the decision", () => {
    render(
      <CaseSummaryPanel
        variant="desktop"
        payload={returnCase}
        currentDecision={returnDecision}
        onNewCase={vi.fn()}
      />,
    )

    expect(screen.getByText(pl.summary.caseType)).toBeInTheDocument()
    expect(screen.getByText(pl.caseTypes.return.label)).toBeInTheDocument()
    expect(screen.getByText(pl.summary.category)).toBeInTheDocument()
    expect(screen.getByText(pl.categories.laptop)).toBeInTheDocument()
    expect(screen.getByText(pl.summary.model)).toBeInTheDocument()
    expect(screen.getByText("Lenovo ThinkPad E14")).toBeInTheDocument()
    expect(screen.getByText(pl.summary.purchaseDate)).toBeInTheDocument()
    expect(screen.getByText("16.11.2026")).toBeInTheDocument()
    expect(screen.getByText(pl.summary.daysSincePurchase)).toBeInTheDocument()
    expect(screen.getByText("10")).toBeInTheDocument()
    expect(screen.getByText(pl.summary.currentDecision)).toBeInTheDocument()
    expect(screen.getByText(pl.decisions["Weryfikacja ręczna"])).toBeInTheDocument()
  })

  it("renders the complaint case with its own type, category and decision", () => {
    render(
      <CaseSummaryPanel
        variant="desktop"
        payload={complaintCase}
        currentDecision={complaintDecision}
        onNewCase={vi.fn()}
      />,
    )

    expect(screen.getByText(pl.caseTypes.complaint.label)).toBeInTheDocument()
    expect(screen.getByText(pl.categories.smartphone)).toBeInTheDocument()
    expect(screen.getByText("Samsung Galaxy A55")).toBeInTheDocument()
    expect(screen.getByText("22.10.2025")).toBeInTheDocument()
    expect(screen.getByText("400")).toBeInTheDocument()
  })

  it("shows the most recent decision passed in currentDecision, not the payload's first one", () => {
    render(
      <CaseSummaryPanel
        variant="desktop"
        payload={returnCase}
        currentDecision={{ decision: "Akceptacja", ruleRefs: ["R-1"] }}
        onNewCase={vi.fn()}
      />,
    )

    expect(screen.getByText(pl.decisions.Akceptacja)).toBeInTheDocument()
    expect(screen.queryByText(pl.decisions["Weryfikacja ręczna"])).not.toBeInTheDocument()
  })

  it("opens a larger photo dialog when the thumbnail is clicked", async () => {
    const user = userEvent.setup()
    render(
      <CaseSummaryPanel
        variant="desktop"
        payload={returnCase}
        currentDecision={returnDecision}
        onNewCase={vi.fn()}
      />,
    )

    const thumbnail = screen.getByRole("img", { name: pl.summary.photo })
    expect(thumbnail).toHaveAttribute("src", returnCase.thumbnailDataUrl)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()

    await user.click(thumbnail)

    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByRole("img", { name: pl.summary.photo })).toHaveAttribute(
      "src",
      returnCase.thumbnailDataUrl,
    )
  })

  it("opens the new-case confirmation dialog from the Nowe zgłoszenie button", async () => {
    const user = userEvent.setup()
    render(
      <CaseSummaryPanel
        variant="desktop"
        payload={returnCase}
        currentDecision={returnDecision}
        onNewCase={vi.fn()}
      />,
    )

    await user.click(screen.getByRole("button", { name: pl.newCase.button }))

    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText(pl.newCase.confirm)).toBeInTheDocument()
  })

  it("cancel leaves the case untouched: onNewCase is not called and the summary stays", async () => {
    const user = userEvent.setup()
    const onNewCase = vi.fn()
    render(
      <CaseSummaryPanel
        variant="desktop"
        payload={returnCase}
        currentDecision={returnDecision}
        onNewCase={onNewCase}
      />,
    )

    await user.click(screen.getByRole("button", { name: pl.newCase.button }))
    await user.click(await screen.findByRole("button", { name: pl.newCase.cancelButton }))

    expect(onNewCase).not.toHaveBeenCalled()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(screen.getByText("Lenovo ThinkPad E14")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: pl.newCase.button })).toHaveFocus()
  })

  it("confirm calls onNewCase exactly once", async () => {
    const user = userEvent.setup()
    const onNewCase = vi.fn()
    render(
      <CaseSummaryPanel
        variant="desktop"
        payload={returnCase}
        currentDecision={returnDecision}
        onNewCase={onNewCase}
      />,
    )

    await user.click(screen.getByRole("button", { name: pl.newCase.button }))
    await user.click(await screen.findByRole("button", { name: pl.newCase.confirmButton }))

    expect(onNewCase).toHaveBeenCalledTimes(1)
  })

  it("Escape cancels the confirmation without calling onNewCase", async () => {
    const user = userEvent.setup()
    const onNewCase = vi.fn()
    render(
      <CaseSummaryPanel
        variant="desktop"
        payload={returnCase}
        currentDecision={returnDecision}
        onNewCase={onNewCase}
      />,
    )

    await user.click(screen.getByRole("button", { name: pl.newCase.button }))
    await screen.findByRole("dialog")
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })

    expect(await screen.findByText(pl.summary.daysSincePurchase)).toBeInTheDocument()
    expect(onNewCase).not.toHaveBeenCalled()
  })
})

describe("CaseSummaryPanel mobile variant (PRD 9.3)", () => {
  it("is collapsed by default and its trigger shows only the case type and the decision", () => {
    render(
      <CaseSummaryPanel
        variant="mobile"
        payload={returnCase}
        currentDecision={returnDecision}
        onNewCase={vi.fn()}
      />,
    )

    const trigger = screen.getByRole("button", { expanded: false })
    expect(trigger).toHaveTextContent(pl.caseTypes.return.label)
    expect(trigger).toHaveTextContent(pl.decisions["Weryfikacja ręczna"])
    expect(trigger).not.toHaveTextContent("Lenovo ThinkPad E14")
    expect(screen.queryByText("Lenovo ThinkPad E14")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: pl.newCase.button })).not.toBeInTheDocument()
  })

  it("expands to reveal the full summary", async () => {
    const user = userEvent.setup()
    render(
      <CaseSummaryPanel
        variant="mobile"
        payload={returnCase}
        currentDecision={returnDecision}
        onNewCase={vi.fn()}
      />,
    )

    await user.click(screen.getByRole("button", { expanded: false }))

    expect(screen.getByRole("button", { expanded: true })).toBeInTheDocument()
    expect(screen.getByText("Lenovo ThinkPad E14")).toBeVisible()
    expect(screen.getByRole("button", { name: pl.newCase.button })).toBeVisible()
  })
})
