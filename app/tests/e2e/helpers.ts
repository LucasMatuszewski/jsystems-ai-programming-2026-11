import { fileURLToPath } from "node:url"
import { expect as baseExpect, type Locator, type Page } from "@playwright/test"
import { pl } from "../../lib/i18n/pl"

/** Short expect timeout so missing UI fails fast in the red (test.fail) phase. */
export const expect = baseExpect.configure({ timeout: 5_000 })

/** Real example photos only (course rule: uploads use assets/example-images and assets/logo.svg). */
const ASSETS = fileURLToPath(new URL("../../../assets/", import.meta.url))
export const photo = {
  laptop1Png: `${ASSETS}example-images/laptop-1.png`, // JPEG bytes with a .png extension (AC-08)
  laptop2Webp: `${ASSETS}example-images/laptop-2.webp`,
  phone1Jpg: `${ASSETS}example-images/phone-1.jpg`,
  logoSvg: `${ASSETS}logo.svg`, // disallowed type (AC-09)
}

export const MODEL = "Lenovo ThinkPad X1"
export const COMPLAINT_REASON = "Ekran pojawił się pęknięty po upadku z biurka."

export type CaseType = "return" | "complaint"

/** YYYY-MM-DD for "n days ago" in Europe/Warsaw (the app's reference timezone). */
export function daysAgo(n: number, now: Date = new Date()): string {
  const todayParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now)
  const [y, m, d] = todayParts.split("-").map(Number) as [number, number, number]
  const date = new Date(Date.UTC(y, m - 1, d - n))
  return date.toISOString().slice(0, 10)
}

/** Radio card of the case type. The accessible name also contains the subtitle, so match by prefix. */
export function caseTypeRadio(page: Page, type: CaseType): Locator {
  return page.getByRole("radio", { name: pl.caseTypes[type].label, exact: false })
}

export function photoInput(page: Page): Locator {
  return page.locator('input[type="file"]')
}

/** Fills every field of the case form. Each step waits for the element first (5 s), so a missing form fails fast. */
export async function fillCaseForm(
  page: Page,
  values: {
    caseType: CaseType
    category: keyof typeof pl.categories
    model?: string
    purchaseDate: string
    reason?: string
    photoPath?: string
    consent?: boolean
  },
): Promise<void> {
  await expect(page.getByRole("heading", { name: pl.form.title })).toBeVisible()
  await caseTypeRadio(page, values.caseType).check()

  const category = page.getByLabel(pl.labels.category)
  await expect(category).toBeVisible()
  await category.selectOption({ label: pl.categories[values.category] })

  const model = page.getByLabel(pl.labels.model)
  await expect(model).toBeVisible()
  await model.fill(values.model ?? MODEL)

  const date = page.getByLabel(pl.labels.purchaseDate)
  await expect(date).toBeVisible()
  await date.fill(values.purchaseDate)

  if (values.reason !== undefined) {
    await page.getByLabel(pl.labels.reason).fill(values.reason)
  }

  if (values.photoPath) {
    await expect(photoInput(page)).toBeAttached()
    await photoInput(page).setInputFiles(values.photoPath)
  }

  if (values.consent !== false) {
    await page.getByRole("checkbox", { name: pl.consent }).check()
  }
}

/** Clicks "Wyślij zgłoszenie" (the submit button). */
export async function submitCase(page: Page): Promise<void> {
  const submit = page.getByRole("button", { name: pl.form.submit })
  await expect(submit).toBeVisible()
  await submit.click()
}

/** Waits for the chat screen after a successful analysis (TAC-05: first decision within 90 s). */
export async function waitForChat(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/chat\/?$/, { timeout: 90_000 })
  await expect(page.getByRole("log")).toBeVisible()
}

/** Fills and submits a complete case, then waits for /chat. Used by every spec that needs a session. */
export async function createCase(
  page: Page,
  values: Parameters<typeof fillCaseForm>[1],
): Promise<void> {
  await page.goto("/")
  await fillCaseForm(page, values)
  await submitCase(page)
  await waitForChat(page)
}

/** Decision badge text as shown in the chat (exact enum value from pl.decisions). */
export const DECISION_TEXTS = Object.values(pl.decisions)

/** Decision badge in the chat: its text is exactly one of the three enum values. */
export function decisionBadge(page: Page): Locator {
  return page.getByRole("log").getByText(/^(Akceptacja|Odrzucenie|Weryfikacja ręczna)$/).first()
}

/** Invariants of the first agent message (AC-21, AC-22, AC-29, AC-31). Never asserts a specific verdict. */
export async function expectFirstMessageInvariants(page: Page): Promise<void> {
  const log = page.getByRole("log")
  await expect(log).toBeVisible()
  await expect(decisionBadge(page)).toBeVisible()
  // The disclaimer is added by the app, so its wording is exact (AC-29, AC-30).
  await expect(log.getByText(pl.disclaimer, { exact: true }).first()).toBeVisible()
  // At least one policy rule reference, e.g. "R-2" or "C-5" (AC-22).
  await expect(log.getByText(/\b[RC]-\d+(\.\d+)?\b/).first()).toBeVisible()
  // Polish UI text: the disclaimer above is Polish; raw Markdown must not leak (AC-31).
  const text = (await log.innerText()) ?? ""
  expect(text).not.toMatch(/\*\*|^#{1,3}\s/m)
}
