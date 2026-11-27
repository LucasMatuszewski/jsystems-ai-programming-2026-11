import { test } from "@playwright/test"
import { COMPLAINT_REASON, daysAgo, expect, expectFirstMessageInvariants, fillCaseForm, photo, submitCase, waitForChat } from "./helpers"

// Date rules (ADR 000 section 10): deterministic rejection by the policy, not by the model's taste.

test("return 45 days after purchase is rejected (Odrzucenie) citing R-4", async ({ page }) => {
  await page.goto("/")
  await fillCaseForm(page, {
    caseType: "return",
    category: "laptop",
    purchaseDate: daysAgo(45),
    reason: "Nie chcę już urządzenia.",
    photoPath: photo.laptop2Webp,
  })
  await submitCase(page)
  await waitForChat(page)
  await expectFirstMessageInvariants(page)

  await expect(page.getByRole("log").getByText("Odrzucenie", { exact: true }).first()).toBeVisible()
  await expect(page.getByRole("log").getByText(/\bR-4\b/).first()).toBeVisible()
})

test("complaint 800 days after purchase is rejected citing C-2", async ({ page }) => {
  await page.goto("/")
  await fillCaseForm(page, {
    caseType: "complaint",
    category: "smartphone",
    purchaseDate: daysAgo(800),
    reason: COMPLAINT_REASON,
    photoPath: photo.phone1Jpg,
  })
  await submitCase(page)
  await waitForChat(page)
  await expectFirstMessageInvariants(page)

  await expect(page.getByRole("log").getByText("Odrzucenie", { exact: true }).first()).toBeVisible()
  await expect(page.getByRole("log").getByText(/\bC-2\b/).first()).toBeVisible()
})
