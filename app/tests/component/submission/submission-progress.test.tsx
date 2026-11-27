import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { SubmissionProgress } from "@/components/case-submission/submission-progress"
import { pl } from "@/lib/i18n/pl"

describe("SubmissionProgress", () => {
  it.each([
    ["upload", 0],
    ["analysis", 1],
    ["decision", 2],
  ] as const)("shows the progress text for stage %s", (stage, index) => {
    render(<SubmissionProgress stage={stage} />)
    expect(screen.getByText(pl.progress[index])).toBeInTheDocument()
  })

  it("announces the status politely", () => {
    render(<SubmissionProgress stage="upload" />)
    const status = screen.getByRole("status")
    expect(status).toHaveAttribute("aria-live", "polite")
    expect(status).toHaveTextContent(pl.progress[0])
  })
})
