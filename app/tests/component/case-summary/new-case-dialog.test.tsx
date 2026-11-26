import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { NewCaseDialog } from "@/components/case-summary/new-case-dialog"
import { pl } from "@/lib/i18n/pl"

describe("NewCaseDialog (AC-39)", () => {
  it("renders the PRD 4.7 confirmation text and both buttons when open", () => {
    render(<NewCaseDialog open onOpenChange={vi.fn()} onConfirm={vi.fn()} />)

    const dialog = screen.getByRole("dialog")
    expect(dialog).toHaveTextContent(pl.newCase.confirm)
    expect(screen.getByRole("button", { name: pl.newCase.confirmButton })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: pl.newCase.cancelButton })).toBeInTheDocument()
  })

  it("renders nothing when closed", () => {
    render(<NewCaseDialog open={false} onOpenChange={vi.fn()} onConfirm={vi.fn()} />)

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("cancel requests close and does not confirm", async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const onOpenChange = vi.fn()
    render(<NewCaseDialog open onOpenChange={onOpenChange} onConfirm={onConfirm} />)

    await user.click(screen.getByRole("button", { name: pl.newCase.cancelButton }))

    expect(onConfirm).not.toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("confirm calls onConfirm once and requests close", async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const onOpenChange = vi.fn()
    render(<NewCaseDialog open onOpenChange={onOpenChange} onConfirm={onConfirm} />)

    await user.click(screen.getByRole("button", { name: pl.newCase.confirmButton }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("Escape cancels without confirming", () => {
    const onConfirm = vi.fn()
    const onOpenChange = vi.fn()
    render(<NewCaseDialog open onOpenChange={onOpenChange} onConfirm={onConfirm} />)

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })

    expect(onConfirm).not.toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalled()
    expect(onOpenChange.mock.calls[0]?.[0]).toBe(false)
  })

  it("traps focus inside the dialog while open", async () => {
    const user = userEvent.setup()
    render(<NewCaseDialog open onOpenChange={vi.fn()} onConfirm={vi.fn()} />)

    const cancel = screen.getByRole("button", { name: pl.newCase.cancelButton })
    const confirm = screen.getByRole("button", { name: pl.newCase.confirmButton })
    await user.tab()
    await user.tab()
    expect([cancel, confirm]).toContain(document.activeElement)
    await user.tab()
    expect([cancel, confirm]).toContain(document.activeElement)
  })
})
