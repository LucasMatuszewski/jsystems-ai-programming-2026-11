import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { AnalysisErrorBanner } from "@/components/case-submission/analysis-error-banner"
import { pl } from "@/lib/i18n/pl"

describe("AnalysisErrorBanner (AC-41, AC-43)", () => {
  it.each(["analysis_failed", "model_unavailable", "timeout"] as const)(
    "shows the analysis text and a retry button for %s",
    async (code) => {
      const onRetry = vi.fn()
      const user = userEvent.setup()
      render(<AnalysisErrorBanner code={code} onRetry={onRetry} />)

      expect(screen.getByRole("alert")).toHaveTextContent(pl.analysisFailed.banner)
      await user.click(screen.getByRole("button", { name: pl.analysisFailed.retry }))
      expect(onRetry).toHaveBeenCalledTimes(1)
    },
  )

  it.each([
    ["validation_failed", pl.errors.validation_failed],
    ["unsupported_media_type", pl.errors.unsupported_media_type],
    ["file_too_large", pl.errors.file_too_large],
    ["server_misconfigured", pl.errors.server_misconfigured],
  ] as const)("shows the generic text for %s without technical details", (code, text) => {
    render(<AnalysisErrorBanner code={code} onRetry={vi.fn()} />)

    const alert = screen.getByRole("alert")
    expect(alert).toHaveTextContent(text)
    expect(alert).not.toHaveTextContent(code)
    expect(alert).not.toHaveTextContent(/\b[45]\d\d\b/)
    expect(screen.queryByRole("button", { name: pl.analysisFailed.retry })).not.toBeInTheDocument()
  })
})
