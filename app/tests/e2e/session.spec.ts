import { test } from "@playwright/test"
import { pl } from "../../lib/i18n/pl"
import { createCase, daysAgo, expect, photo, caseTypeRadio } from "./helpers"

// PRD 4.7 session restore and new case (AC-38, AC-39, TAC-003-03). Session is per browser tab (sessionStorage).

const CASE = {
  caseType: "return" as const,
  category: "laptop" as const,
  purchaseDate: daysAgo(10),
  reason: "Chcę zwrócić urządzenie.",
  photoPath: photo.laptop2Webp,
}

test("reload of /chat restores the same messages in the same order (AC-38)", async ({ page }) => {
  test.fail()
  await createCase(page, CASE)
  const before = await page.locator("body").innerText()

  await page.reload()
  await expect(page).toHaveURL(/\/chat\/?$/)
  await expect(page.getByRole("log")).toBeVisible()
  const after = await page.locator("body").innerText()

  expect(after).toBe(before)
})

test("'Nowe zgłoszenie' + cancel keeps the chat unchanged (AC-39)", async ({ page }) => {
  test.fail()
  await createCase(page, CASE)
  const before = await page.locator("body").innerText()

  await page.getByRole("button", { name: pl.newCase.button }).click()
  await expect(page.getByText(pl.newCase.confirm)).toBeVisible()
  await page.getByRole("button", { name: pl.newCase.cancelButton }).click()

  await expect(page.getByText(pl.newCase.confirm)).toHaveCount(0)
  await expect(page).toHaveURL(/\/chat\/?$/)
  expect(await page.locator("body").innerText()).toBe(before)
})

test("'Nowe zgłoszenie' + confirm clears the session and shows an empty form at / (AC-39)", async ({ page }) => {
  test.fail()
  await createCase(page, CASE)

  await page.getByRole("button", { name: pl.newCase.button }).click()
  await expect(page.getByText(pl.newCase.confirm)).toBeVisible()
  await page.getByRole("button", { name: pl.newCase.confirmButton }).click()

  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole("heading", { name: pl.form.title })).toBeVisible()
  await expect(page.getByLabel(pl.labels.model)).toHaveValue("")
  await expect(caseTypeRadio(page, "return")).not.toBeChecked()
  await expect(caseTypeRadio(page, "complaint")).not.toBeChecked()
})

test("direct visit to /chat without a session redirects to /", async ({ page }) => {
  test.fail()
  await page.goto("/chat")
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole("heading", { name: pl.form.title })).toBeVisible()
})
