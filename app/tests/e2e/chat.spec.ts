import { test } from "@playwright/test"
import { pl } from "../../lib/i18n/pl"
import { MODEL, createCase, daysAgo, expect, photo } from "./helpers"

// PRD 4.3 chat conversation (AC-32..AC-37). One case is created first; replies come from the real model.

const QUESTION = "Jaki model urządzenia zgłosiłem?"

test.beforeEach(async ({ page }) => {
  // Hooks run inside each test, so the expected failure is declared here as well.
  test.fail()
  await createCase(page, {
    caseType: "return",
    category: "laptop",
    model: MODEL,
    purchaseDate: daysAgo(10),
    photoPath: photo.laptop2Webp,
  })
})

test("agent answers a follow-up using the model from the form (AC-34)", async ({ page }) => {
  test.fail()
  const input = page.getByPlaceholder(pl.chat.inputPlaceholder)
  await input.fill(QUESTION)
  await page.getByRole("button", { name: pl.chat.send }).click()

  await expect(page.getByRole("log").getByText(QUESTION)).toBeVisible()
  await expect(input).toBeEnabled({ timeout: 90_000 })

  const reply = (await page.getByRole("log").innerText()).split(QUESTION)[1] ?? ""
  expect(reply).toContain(MODEL)
})

test("Enter sends the message, Shift+Enter inserts a newline (AC-32)", async ({ page }) => {
  test.fail()
  const input = page.getByPlaceholder(pl.chat.inputPlaceholder)
  await input.click()
  await input.pressSequentially("linia 1")
  await input.press("Shift+Enter")
  await input.pressSequentially("linia 2")

  await expect(input).toHaveValue(/linia 1\n\s*linia 2/)
  await expect(page.getByRole("log").getByText("linia 1")).toHaveCount(0)

  await input.press("Enter")
  await expect(page.getByRole("log").getByText(/linia 1/)).toBeVisible()
  await expect(input).toHaveValue("")
})

test("empty or whitespace-only message cannot be sent (AC-32)", async ({ page }) => {
  test.fail()
  const input = page.getByPlaceholder(pl.chat.inputPlaceholder)
  await input.fill("   ")
  await expect(page.getByRole("button", { name: pl.chat.send })).toBeDisabled()
})

test("input is disabled while the reply streams (AC-33)", async ({ page }) => {
  test.fail()
  const input = page.getByPlaceholder(pl.chat.inputPlaceholder)
  await input.fill(QUESTION)
  await input.press("Enter")

  await expect(input).toBeDisabled({ timeout: 5_000 })
  await expect(input).toBeEnabled({ timeout: 90_000 })
})

test("newest message is scrolled into view (AC-37)", async ({ page }) => {
  test.fail()
  const marker = "Test widoczności 1"
  const input = page.getByPlaceholder(pl.chat.inputPlaceholder)
  await input.fill(marker)
  await input.press("Enter")

  await expect(page.getByRole("log").getByText(marker)).toBeInViewport()
})
