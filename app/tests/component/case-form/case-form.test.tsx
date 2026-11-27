import { readFileSync } from "node:fs"
import path from "node:path"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeAll, describe, expect, it, vi } from "vitest"
import { CaseForm } from "@/components/case-form/case-form"
import { pl } from "@/lib/i18n/pl"
import { CATEGORIES } from "@/lib/schemas"

const TODAY = "2026-11-26"

const assetFile = (rel: string, type: string) =>
  new File(
    [readFileSync(path.resolve(process.cwd(), `../assets/${rel}`))],
    rel.split("/").pop() ?? rel,
    { type },
  )

beforeAll(() => {
  Object.defineProperty(URL, "createObjectURL", { value: vi.fn(() => "blob:mock-preview"), configurable: true, writable: true })
  Object.defineProperty(URL, "revokeObjectURL", { value: vi.fn(), configurable: true, writable: true })
})

const radio = (type: "return" | "complaint") =>
  screen.getByRole("radio", { name: new RegExp(pl.caseTypes[type].label) })
const category = () => screen.getByLabelText(pl.labels.category) as HTMLSelectElement
const model = () => screen.getByLabelText(pl.labels.model) as HTMLInputElement
const purchaseDate = () => screen.getByLabelText(pl.labels.purchaseDate) as HTMLInputElement
const reason = () => screen.getByLabelText(new RegExp(pl.labels.reason)) as HTMLTextAreaElement
const photoControl = () => screen.getByLabelText(pl.labels.photo)
const consent = () => screen.getByRole("checkbox", { name: pl.consent })
const submit = () => screen.getByRole("button", { name: pl.form.submit })
const photoInput = () => document.querySelector('input[type="file"]') as HTMLInputElement

function renderForm(props: Partial<Parameters<typeof CaseForm>[0]> = {}) {
  const onSubmit = vi.fn()
  const user = userEvent.setup({ applyAccept: false })
  const utils = render(<CaseForm onSubmit={onSubmit} today={TODAY} {...props} />)
  return { onSubmit, user, ...utils }
}

async function fillValid(
  user: ReturnType<typeof userEvent.setup>,
  { type = "return", reasonText = "" }: { type?: "return" | "complaint"; reasonText?: string } = {},
) {
  await user.click(radio(type))
  await user.selectOptions(category(), "laptop")
  await user.type(model(), "  Lenovo ThinkPad X1  ")
  fireEvent.change(purchaseDate(), { target: { value: "2026-11-16" } })
  if (reasonText) await user.type(reason(), reasonText)
  await user.upload(photoInput(), assetFile("example-images/laptop-1.png", "image/png"))
  await user.click(consent())
}

describe("CaseForm layout and options", () => {
  it("renders the fields in AC-01 order", () => {
    renderForm()
    const order = [
      radio("return"),
      category(),
      model(),
      purchaseDate(),
      reason(),
      photoControl(),
      consent(),
      submit(),
    ]
    for (let i = 0; i < order.length - 1; i++) {
      const follows = order[i]!.compareDocumentPosition(order[i + 1]!) & Node.DOCUMENT_POSITION_FOLLOWING
      expect(follows, `element ${i} should precede ${i + 1}`).toBeTruthy()
    }
  })

  it("offers exactly the two case types with subtitles and none preselected", () => {
    renderForm()
    expect(screen.getAllByRole("radio")).toHaveLength(2)
    expect(radio("return")).not.toBeChecked()
    expect(radio("complaint")).not.toBeChecked()
    expect(screen.getByText(pl.caseTypes.return.subtitle)).toBeInTheDocument()
    expect(screen.getByText(pl.caseTypes.complaint.subtitle)).toBeInTheDocument()
  })

  it("lists the category placeholder and the nine categories in AC-03 order, none preselected", () => {
    renderForm()
    const options = Array.from(category().options)
    expect(options.map((o) => o.textContent)).toEqual([
      pl.labels.categoryPlaceholder,
      ...CATEGORIES.map((c) => pl.categories[c]),
    ])
    expect(category().value).toBe("")
  })

  it("marks the reason as required only for a complaint and changes the placeholder", async () => {
    const { user } = renderForm()
    expect(reason().labels?.[0]?.textContent).not.toContain(pl.labels.requiredMarker)
    expect(reason().placeholder).toBe("")
    await user.click(radio("complaint"))
    expect(reason().labels?.[0]?.textContent).toContain(pl.labels.requiredMarker)
    expect(reason()).toHaveAttribute("placeholder", pl.placeholders.reason.complaint)
    await user.click(radio("return"))
    expect(reason().labels?.[0]?.textContent).not.toContain(pl.labels.requiredMarker)
    expect(reason()).toHaveAttribute("placeholder", pl.placeholders.reason.return)
  })

  it("sets the date limits: max today, min five years back", () => {
    renderForm()
    expect(purchaseDate()).toHaveAttribute("type", "date")
    expect(purchaseDate()).toHaveAttribute("max", TODAY)
    expect(purchaseDate()).toHaveAttribute("min", "2021-11-26")
  })

  it("shows a live counter for the reason", async () => {
    const { user } = renderForm()
    expect(screen.getByText(`0/2000`)).toBeInTheDocument()
    await user.type(reason(), "abc")
    expect(screen.getByText(`3/2000`)).toBeInTheDocument()
  })
})

describe("CaseForm validation", () => {
  it("requires 20 characters for a complaint reason: 19 fails, 20 passes", async () => {
    const first = renderForm()
    await fillValid(first.user, { type: "complaint", reasonText: "x".repeat(19) })
    await first.user.click(submit())
    expect(await screen.findByText(pl.errors.reason_too_short)).toBeInTheDocument()
    expect(first.onSubmit).not.toHaveBeenCalled()
    first.unmount()

    const second = renderForm()
    await fillValid(second.user, { type: "complaint", reasonText: "x".repeat(20) })
    await second.user.click(submit())
    await waitFor(() => expect(second.onSubmit).toHaveBeenCalledTimes(1))
    expect(screen.queryByText(pl.errors.reason_too_short)).toBeNull()
  })

  it("with an empty form: no onSubmit, errors shown, focus on the first field", async () => {
    const { user, onSubmit } = renderForm()
    await user.click(submit())
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getAllByText(pl.errors.required).length).toBeGreaterThanOrEqual(4)
    expect(model()).toHaveAttribute("aria-invalid", "true")
    expect(model().getAttribute("aria-describedby")).toBeTruthy()
    expect(document.activeElement).toBe(radio("return"))
  })

  it("rejects a purchase date in the future", async () => {
    const { user, onSubmit } = renderForm()
    await fillValid(user)
    fireEvent.change(purchaseDate(), { target: { value: "2026-11-27" } })
    await user.click(submit())
    expect(await screen.findByText(pl.errors.date_future)).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("rejects a purchase date more than five years back", async () => {
    const { user, onSubmit } = renderForm()
    await fillValid(user)
    fireEvent.change(purchaseDate(), { target: { value: "2021-11-25" } })
    await user.click(submit())
    expect(await screen.findByText(pl.errors.date_too_old)).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("rejects logo.svg as a photo with the allowed-formats message", async () => {
    const { user, onSubmit } = renderForm()
    await fillValid(user)
    await user.upload(photoInput(), assetFile("logo.svg", "image/svg+xml"))
    expect(await screen.findByText("Dozwolone formaty: JPG, PNG, WebP.")).toBeInTheDocument()
    await user.click(submit())
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("accepts laptop-1.png because its content is a JPEG (AC-08)", async () => {
    const { user } = renderForm()
    await user.upload(photoInput(), assetFile("example-images/laptop-1.png", "image/png"))
    await waitFor(() => expect(screen.getByText("laptop-1.png")).toBeInTheDocument())
    expect(screen.queryByText(pl.errors.unsupported_media_type)).toBeNull()
  })

  it("requires a photo on submit", async () => {
    const { user, onSubmit } = renderForm()
    await fillValid(user)
    await user.upload(photoInput(), assetFile("logo.svg", "image/svg+xml"))
    await user.click(submit())
    expect(onSubmit).not.toHaveBeenCalled()
    expect(await screen.findByText(pl.errors.unsupported_media_type)).toBeInTheDocument()
  })
})

describe("CaseForm photo replacement and submission", () => {
  it("'Zmień zdjęcie' replaces the file", async () => {
    const { user, onSubmit } = renderForm()
    await fillValid(user)
    expect(await screen.findByText("laptop-1.png")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: pl.changePhoto }))
    await user.upload(photoInput(), assetFile("example-images/phone-1.jpg", "image/jpeg"))
    expect(await screen.findByText("phone-1.jpg")).toBeInTheDocument()
    expect(screen.queryByText("laptop-1.png")).toBeNull()
    await user.click(submit())
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(onSubmit.mock.calls[0]![1].name).toBe("phone-1.jpg")
  })

  it("a valid full submit calls onSubmit once with trimmed values and the File", async () => {
    const { user, onSubmit } = renderForm()
    await fillValid(user, { reasonText: "  Ekran migocze  " })
    await user.click(submit())
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    const [values, file] = onSubmit.mock.calls[0]!
    expect(values).toEqual({
      caseType: "return",
      category: "laptop",
      model: "Lenovo ThinkPad X1",
      purchaseDate: "2026-11-16",
      reason: "Ekran migocze",
      consent: true,
    })
    expect(file).toBeInstanceOf(File)
    expect(file.name).toBe("laptop-1.png")
  })

  it("disabled: the submit button is disabled and a second click sends nothing", async () => {
    const { user, onSubmit, rerender } = renderForm()
    await fillValid(user)
    await user.click(submit())
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    rerender(<CaseForm onSubmit={onSubmit} today={TODAY} disabled />)
    expect(submit()).toBeDisabled()
    await user.click(submit())
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it("initialValues and initialFile restore every field", () => {
    renderForm({
      initialValues: {
        caseType: "complaint",
        category: "tablet",
        model: "iPad Air",
        purchaseDate: "2026-11-01",
        reason: "x".repeat(25),
        consent: true,
      },
      initialFile: assetFile("example-images/laptop-2.webp", "image/webp"),
    })
    expect(radio("complaint")).toBeChecked()
    expect(category().value).toBe("tablet")
    expect(model().value).toBe("iPad Air")
    expect(purchaseDate().value).toBe("2026-11-01")
    expect(reason().value).toBe("x".repeat(25))
    expect(screen.getByText("25/2000")).toBeInTheDocument()
    expect(consent()).toBeChecked()
    expect(screen.getByText("laptop-2.webp")).toBeInTheDocument()
  })
})
