import { test } from "@playwright/test"
import { pl } from "../../lib/i18n/pl"
import {
  COMPLAINT_REASON,
  daysAgo,
  expect,
  expectFirstMessageInvariants,
  fillCaseForm,
  photo,
  submitCase,
  waitForChat,
} from "./helpers"

// PRD 4.2 happy path: complaint. Structure and invariants only.

test("complaint case: decision in the enum, a C- rule, and a remedy when accepted", async ({ page }) => {
  await page.goto("/")
  await fillCaseForm(page, {
    caseType: "complaint",
    category: "smartphone",
    purchaseDate: daysAgo(400),
    reason: COMPLAINT_REASON,
    photoPath: photo.phone1Jpg,
  })
  await submitCase(page)
  await waitForChat(page)
  await expectFirstMessageInvariants(page)

  const log = page.getByRole("log")
  await expect(log.getByText(/\bC-\d+(\.\d+)?\b/).first()).toBeVisible()

  const badge = page.getByRole("log").getByText(/^(Akceptacja|Odrzucenie|Weryfikacja ręczna)$/).first()
  if ((await badge.innerText()).trim() === "Akceptacja") {
    const remedy = new RegExp(`${pl.remedies.repair}|${pl.remedies.replacement}`)
    await expect(log.getByText(remedy).first()).toBeVisible()
  }
})
