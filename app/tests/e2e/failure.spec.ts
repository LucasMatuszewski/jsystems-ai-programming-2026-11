import { test, type Page } from "@playwright/test"
import { pl } from "../../lib/i18n/pl"
import { SESSION_KEY } from "../../lib/session-store"
import { MODEL, createCase, daysAgo, expect, fillCaseForm, photo, submitCase } from "./helpers"

// AC-41 / AC-42 / AC-43 (ADR-000 section 10): the `failure` project runs against a second real server on
// port 3001 started with OPENROUTER_API_KEY=sk-or-v1-invalid. Nothing is mocked; OpenRouter really answers 401.

const VALID_SERVER = "http://localhost:3000"

function countPosts(page: Page, path: string): { count: () => number } {
  let n = 0
  page.on("request", (req) => {
    if (req.method() === "POST" && new URL(req.url()).pathname === path) n += 1
  })
  return { count: () => n }
}

test("failed analysis: banner, entered data kept, retry sends exactly one more request (AC-41, AC-43)", async ({ page }) => {
  const posts = countPosts(page, "/api/cases")
  await page.goto("/")
  await fillCaseForm(page, {
    caseType: "return",
    category: "laptop",
    model: MODEL,
    purchaseDate: daysAgo(10),
    photoPath: photo.laptop2Webp,
  })
  await submitCase(page)

  const banner = page.getByRole("alert").filter({ hasText: pl.analysisFailed.banner })
  await expect(banner).toBeVisible({ timeout: 30_000 })
  expect(posts.count()).toBe(1)
  // No technical details (AC-43).
  await expect(banner).not.toContainText(/401|OpenRouter|sk-or|Unauthorized|stack/i)
  // Data kept (AC-41): the form is still there with the typed model and the chosen photo.
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByLabel(pl.labels.model)).toHaveValue(MODEL)
  await expect(page.getByText("laptop-2.webp")).toBeVisible()

  await page.getByRole("button", { name: pl.analysisFailed.retry }).click()
  await expect(banner).toBeVisible({ timeout: 30_000 })
  await expect(page.getByLabel(pl.labels.model)).toHaveValue(MODEL)
  expect(posts.count()).toBe(2)
})

test("failed chat reply shows the error row, Ponów sends exactly one more request, no duplicate message (AC-42, AC-43)", async ({
  page,
  browser,
}) => {
  // The failing server cannot create a case, so take a real session from the valid server (port 3000).
  const source = await browser.newContext({ baseURL: VALID_SERVER })
  const sourcePage = await source.newPage()
  await createCase(sourcePage, {
    caseType: "return",
    category: "laptop",
    model: MODEL,
    purchaseDate: daysAgo(10),
    photoPath: photo.laptop2Webp,
  })
  const stored = await sourcePage.evaluate((key) => sessionStorage.getItem(key), SESSION_KEY)
  await source.close()
  expect(stored).not.toBeNull()

  await page.addInitScript(
    ([key, value]) => {
      if (!sessionStorage.getItem(key as string)) sessionStorage.setItem(key as string, value as string)
    },
    [SESSION_KEY, stored as string],
  )
  const posts = countPosts(page, "/api/chat")
  await page.goto("/chat")
  await expect(page.getByRole("log")).toBeVisible()

  const question = "Czy mogę dostarczyć paragon?"
  const input = page.getByPlaceholder(pl.chat.inputPlaceholder)
  await input.fill(question)
  await input.press("Enter")

  const errorRow = page.getByRole("alert").filter({ hasText: pl.chat.errorMessage })
  await expect(errorRow).toBeVisible({ timeout: 30_000 })
  expect(posts.count()).toBe(1)
  await expect(errorRow).not.toContainText(/401|OpenRouter|sk-or|Unauthorized|stack/i)

  await page.getByRole("button", { name: pl.chat.retry }).click()
  await expect(errorRow).toBeVisible({ timeout: 30_000 })
  expect(posts.count()).toBe(2)
  await expect(page.getByRole("log").getByText(question)).toHaveCount(1)
})
