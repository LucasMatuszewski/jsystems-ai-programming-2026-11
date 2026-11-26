import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { DecisionCard } from "@/components/chat/decision-card"
import { pl } from "@/lib/i18n/pl"
import { DECISIONS } from "@/lib/schemas/enums"

const ICON_CLASS: Record<(typeof DECISIONS)[number], string> = {
  Akceptacja: "lucide-circle-check",
  Odrzucenie: "lucide-circle-x",
  "Weryfikacja ręczna": "lucide-circle-help",
}

describe("DecisionCard", () => {
  it.each(DECISIONS)("shows text and a distinct icon for %s", (decision) => {
    render(<DecisionCard kind="initial" decision={decision} ruleRefs={["R-4"]} />)
    const label = screen.getByText(pl.decisions[decision])
    const badge = label.parentElement
    const svg = badge?.querySelector("svg")
    expect(svg).not.toBeNull()
    expect(svg?.getAttribute("class")).toContain(ICON_CLASS[decision])
  })

  it("uses a different icon for each decision (not colour alone)", () => {
    const classes = DECISIONS.map((decision) => {
      const { unmount } = render(
        <DecisionCard kind="initial" decision={decision} ruleRefs={["R-4"]} />,
      )
      const svg = screen.getByText(pl.decisions[decision]).parentElement?.querySelector("svg")
      const name = svg?.getAttribute("class") ?? ""
      unmount()
      return name
    })
    expect(new Set(classes).size).toBe(DECISIONS.length)
  })

  it.each(DECISIONS)("is a labelled group that names the decision (%s)", (decision) => {
    render(<DecisionCard kind="initial" decision={decision} ruleRefs={["R-4"]} />)
    expect(
      screen.getByRole("group", { name: new RegExp(pl.decisions[decision]) }),
    ).toBeInTheDocument()
  })

  it("shows every rule reference and the remedy label when present", () => {
    render(
      <DecisionCard kind="initial" decision="Akceptacja" ruleRefs={["C-3", "C-5"]} remedy="repair" />,
    )
    const group = screen.getByRole("group")
    expect(within(group).getByText("C-3")).toBeInTheDocument()
    expect(within(group).getByText("C-5")).toBeInTheDocument()
    expect(within(group).getByText(pl.remedies.repair)).toBeInTheDocument()
  })

  it("omits the remedy label when remedy is null", () => {
    render(<DecisionCard kind="initial" decision="Odrzucenie" ruleRefs={["R-4"]} remedy={null} />)
    expect(screen.queryByText(pl.remedies.repair)).not.toBeInTheDocument()
    expect(screen.queryByText(pl.remedies.replacement)).not.toBeInTheDocument()
  })

  it.each(DECISIONS)("attaches the exact disclaimer inside the card for %s (initial)", (decision) => {
    render(<DecisionCard kind="initial" decision={decision} ruleRefs={["R-4"]} />)
    expect(within(screen.getByRole("group")).getByText(pl.disclaimer)).toBeInTheDocument()
  })

  it.each(DECISIONS)("attaches the exact disclaimer inside the card for %s (update)", (decision) => {
    render(
      <DecisionCard
        kind="update"
        decision={decision}
        ruleRefs={["C-6"]}
        previousDecision="Odrzucenie"
        reason="Nowa informacja."
      />,
    )
    expect(within(screen.getByRole("group")).getByText(pl.disclaimer)).toBeInTheDocument()
  })

  it("update shows the updated label, previous → new and the reason", () => {
    render(
      <DecisionCard
        kind="update"
        decision="Weryfikacja ręczna"
        ruleRefs={["C-3", "C-5", "C-6"]}
        previousDecision="Odrzucenie"
        reason="Pasy pojawiły się po aktualizacji."
      />,
    )
    const group = screen.getByRole("group")
    expect(within(group).getByText(pl.updatedRecommendation)).toBeInTheDocument()
    expect(group).toHaveTextContent(
      `${pl.decisions.Odrzucenie} → ${pl.decisions["Weryfikacja ręczna"]}`,
    )
    expect(within(group).getByText("Pasy pojawiły się po aktualizacji.")).toBeInTheDocument()
    expect(group).toHaveAccessibleName(new RegExp(pl.updatedRecommendation))
  })

  it("initial card does not show the updated label", () => {
    render(<DecisionCard kind="initial" decision="Akceptacja" ruleRefs={["R-1"]} />)
    expect(screen.queryByText(pl.updatedRecommendation)).not.toBeInTheDocument()
  })
})
