import { test } from "@playwright/test"
import { pl } from "../../lib/i18n/pl"
import {
  MODEL,
  caseTypeRadio,
  daysAgo,
  expect,
  fillCaseForm,
  photo,
  photoInput,
  submitCase,
} from "./helpers"

// Polish locale so the native date input uses dd.mm.yyyy segments.
test.use({ locale: "pl-PL" })

// PRD 4.4 Alternative: validation errors on the form (AC-04..AC-13, AC-46).

test("empty submit shows errors, focuses the first invalid field and sends no request (AC-12)", async ({ page }) => {
  const apiRequests: string[] = []
  page.on("request", (req) => {
    if (req.url().includes("/api/cases")) apiRequests.push(req.url())
  })

  await page.goto("/")
  await submitCase(page)

  await expect(page.getByText(pl.errors.required).first()).toBeVisible()
  await expect(caseTypeRadio(page, "return")).toBeFocused()
  expect(apiRequests).toEqual([])
})

test("complaint without a reason shows the reason error (AC-06)", async ({ page }) => {
  await page.goto("/")
  await fillCaseForm(page, {
    caseType: "complaint",
    category: "smartphone",
    purchaseDate: daysAgo(400),
    photoPath: photo.phone1Jpg,
  })
  await submitCase(page)

  await expect(page.getByText(pl.errors.reason_too_short)).toBeVisible()
  await expect(page.getByLabel(pl.labels.reason)).toBeFocused()
})

test("future purchase date is rejected (AC-05)", async ({ page }) => {
  await page.goto("/")
  await fillCaseForm(page, {
    caseType: "return",
    category: "laptop",
    purchaseDate: daysAgo(-3),
    photoPath: photo.laptop2Webp,
  })
  await submitCase(page)

  await expect(page.getByText(pl.errors.date_future)).toBeVisible()
})

test("SVG logo is rejected with the unsupported type message (AC-09)", async ({ page }) => {
  await page.goto("/")
  await expect(photoInput(page)).toBeAttached()
  await photoInput(page).setInputFiles(photo.logoSvg)

  await expect(page.getByText(pl.errors.unsupported_media_type)).toBeVisible()
  await expect(page.getByRole("button", { name: pl.changePhoto })).toHaveCount(0)
})

test("JPEG named .png is accepted with thumbnail, file name and change action (AC-08, AC-10)", async ({ page }) => {
  await page.goto("/")
  // Fail fast (5 s) if the photo input is missing, instead of waiting for the 120 s test timeout.
  await expect(photoInput(page)).toBeAttached()
  await photoInput(page).setInputFiles(photo.laptop1Png)

  await expect(page.getByText("laptop-1.png")).toBeVisible()
  await expect(page.locator('img[src^="blob:"]')).toBeVisible()
  await expect(page.getByRole("button", { name: pl.changePhoto })).toBeVisible()
  await expect(page.getByText(pl.errors.unsupported_media_type)).toHaveCount(0)
})

test("entered values and the selected photo are kept after a validation error (AC-12)", async ({ page }) => {
  await page.goto("/")
  await fillCaseForm(page, {
    caseType: "return",
    category: "laptop",
    model: MODEL,
    purchaseDate: daysAgo(10),
    photoPath: photo.laptop1Png,
    consent: false, // trigger the consent error
  })
  await submitCase(page)

  await expect(page.getByText(pl.errors.consent_required)).toBeVisible()
  await expect(page.getByLabel(pl.labels.model)).toHaveValue(MODEL)
  await expect(page.getByText("laptop-1.png")).toBeVisible()
})

test("whole form can be completed with the keyboard only (AC-46)", async ({ page }) => {
  await page.goto("/")

  // Every step first waits (5 s) for its element, so a missing form fails fast.
  // Case type: focus the first radio and select it with Space.
  await expect(caseTypeRadio(page, "return")).toBeAttached()
  await caseTypeRadio(page, "return").focus()
  await page.keyboard.press("Space")
  await page.keyboard.press("Tab")

  // Category select: type-ahead selects "Laptop".
  await expect(page.getByLabel(pl.labels.category)).toBeFocused()
  await page.keyboard.type(pl.categories.laptop)
  await page.keyboard.press("Tab")

  // Model text.
  await expect(page.getByLabel(pl.labels.model)).toBeFocused()
  await page.keyboard.type(MODEL)
  await page.keyboard.press("Tab")

  // Date: pl-PL segments dd, mm, yyyy.
  const date = new Date()
  date.setDate(date.getDate() - 10)
  const dd = String(date.getDate()).padStart(2, "0")
  const mm = String(date.getMonth() + 1).padStart(2, "0")
  const yyyy = String(date.getFullYear())
  await expect(page.getByLabel(pl.labels.purchaseDate)).toBeFocused()
  await page.keyboard.type(`${dd}${mm}${yyyy}`)

  // Photo: Enter on the drop-zone button opens the file chooser.
  const photoButton = page.getByLabel(pl.labels.photo)
  await expect(photoButton).toBeVisible()
  await photoButton.focus()
  const chooser = page.waitForEvent("filechooser", { timeout: 5_000 })
  await page.keyboard.press("Enter")
  await (await chooser).setFiles(photo.laptop2Webp)

  // Consent checkbox, then submit with Enter.
  const consent = page.getByRole("checkbox", { name: pl.consent })
  await expect(consent).toBeVisible()
  await consent.focus()
  await page.keyboard.press("Space")
  const submit = page.getByRole("button", { name: pl.form.submit })
  await expect(submit).toBeVisible()
  await submit.focus()
  await page.keyboard.press("Enter")

  await expect(page).toHaveURL(/\/chat\/?$/, { timeout: 90_000 })
})
