import { readFileSync } from "node:fs"
import path from "node:path"
import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { PhotoInput } from "@/components/case-form/photo-input"
import { pl } from "@/lib/i18n/pl"

const assetFile = (rel: string, type: string) =>
  new File(
    [readFileSync(path.resolve(process.cwd(), `../assets/${rel}`))],
    rel.split("/").pop() ?? rel,
    { type },
  )

const createObjectURL = vi.fn(() => "blob:mock-preview")
const revokeObjectURL = vi.fn()

beforeAll(() => {
  Object.defineProperty(URL, "createObjectURL", { value: createObjectURL, configurable: true, writable: true })
  Object.defineProperty(URL, "revokeObjectURL", { value: revokeObjectURL, configurable: true, writable: true })
})

beforeEach(() => {
  createObjectURL.mockClear()
  revokeObjectURL.mockClear()
})

const fileInput = () => document.querySelector('input[type="file"]') as HTMLInputElement

describe("PhotoInput", () => {
  it("accepts only JPEG, PNG and WebP in the native picker", () => {
    render(<PhotoInput id="photo" caseType={undefined} file={null} onChange={vi.fn()} />)
    expect(fileInput().getAttribute("accept")).toBe("image/jpeg,image/png,image/webp")
  })

  it("is labelled and shows the hint for the selected case type and the personal-data note", () => {
    const { rerender } = render(<PhotoInput id="photo" caseType="return" file={null} onChange={vi.fn()} />)
    expect(screen.getByLabelText(pl.labels.photo)).toBeInTheDocument()
    expect(screen.getByText(pl.photoHints.return)).toBeInTheDocument()
    expect(screen.getByText(pl.personalDataNote)).toBeInTheDocument()
    rerender(<PhotoInput id="photo" caseType="complaint" file={null} onChange={vi.fn()} />)
    expect(screen.getByText(pl.photoHints.complaint)).toBeInTheDocument()
    expect(screen.queryByText(pl.photoHints.return)).toBeNull()
  })

  it("accepts a real JPEG named .png through the picker", async () => {
    const user = userEvent.setup({ applyAccept: false })
    const onChange = vi.fn()
    render(<PhotoInput id="photo" caseType="return" file={null} onChange={onChange} />)
    const file = assetFile("example-images/laptop-1.png", "image/png")
    await user.upload(fileInput(), file)
    expect(onChange).toHaveBeenCalledWith(file, null)
  })

  it("rejects logo.svg with the unsupported-type code and keeps no file", async () => {
    const user = userEvent.setup({ applyAccept: false })
    const onChange = vi.fn()
    render(<PhotoInput id="photo" caseType="return" file={null} onChange={onChange} />)
    await user.upload(fileInput(), assetFile("logo.svg", "image/svg+xml"))
    expect(onChange).toHaveBeenCalledWith(null, "unsupported_media_type")
  })

  it("accepts a dropped real file on the drop zone", () => {
    const onChange = vi.fn()
    render(<PhotoInput id="photo" caseType="complaint" file={null} onChange={onChange} />)
    const file = assetFile("example-images/phone-1.jpg", "image/jpeg")
    fireEvent.drop(screen.getByLabelText(pl.labels.photo), { dataTransfer: { files: [file] } })
    return vi.waitFor(() => expect(onChange).toHaveBeenCalledWith(file, null))
  })

  it("shows a thumbnail, the file name and 'Zmień zdjęcie', which opens the picker", async () => {
    const user = userEvent.setup({ applyAccept: false })
    const file = assetFile("example-images/phone-2.jpeg", "image/jpeg")
    render(<PhotoInput id="photo" caseType="return" file={file} onChange={vi.fn()} />)
    expect(screen.getByText("phone-2.jpeg")).toBeInTheDocument()
    expect(createObjectURL).toHaveBeenCalledWith(file)
    const click = vi.spyOn(fileInput(), "click").mockImplementation(() => {})
    await user.click(screen.getByRole("button", { name: pl.changePhoto }))
    expect(click).toHaveBeenCalledTimes(1)
    click.mockRestore()
  })

  it("revokes the object URL when the file changes and on unmount", () => {
    const first = assetFile("example-images/phone-2.jpeg", "image/jpeg")
    const second = assetFile("example-images/phone-3.jpeg", "image/jpeg")
    const { rerender, unmount } = render(<PhotoInput id="photo" caseType="return" file={first} onChange={vi.fn()} />)
    rerender(<PhotoInput id="photo" caseType="return" file={second} onChange={vi.fn()} />)
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-preview")
    revokeObjectURL.mockClear()
    unmount()
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-preview")
  })

  it("shows the error text linked from the photo control", () => {
    render(<PhotoInput id="photo" caseType="return" file={null} error="file_too_large" onChange={vi.fn()} />)
    const alert = screen.getByText(pl.errors.file_too_large)
    expect(alert).toHaveAttribute("role", "alert")
    expect(screen.getByLabelText(pl.labels.photo)).toHaveAttribute("aria-invalid", "true")
    expect(screen.getByLabelText(pl.labels.photo).getAttribute("aria-describedby")).toContain(alert.id)
  })
})
