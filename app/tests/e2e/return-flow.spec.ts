import { test } from "@playwright/test"
import { pl } from "../../lib/i18n/pl"
import { daysAgo, expect, expectFirstMessageInvariants, fillCaseForm, photo, submitCase, waitForChat } from "./helpers"

// PRD 4.1 happy path: return within the time limit. Structure and invariants only, never a verdict.

test("return case: progress texts, then chat with a decision, disclaimer and rule reference within 90 s", async ({ page }) => {
  await page.goto("/")
  await fillCaseForm(page, {
    caseType: "return",
    category: "laptop",
    purchaseDate: daysAgo(10),
    photoPath: photo.laptop2Webp,
  })
  await submitCase(page)

  // Progress texts (9.2) appear in sequence while the analysis runs.
  await expect(page.getByText(pl.progress[0])).toBeVisible()

  await waitForChat(page)
  await expectFirstMessageInvariants(page)
  await expect(page.getByText(/^(Akceptacja|Odrzucenie|Weryfikacja ręczna)$/).first()).toBeVisible()
})
