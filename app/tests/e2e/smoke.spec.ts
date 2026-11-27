import { expect, test } from "@playwright/test"

test("smoke: home page responds 200 and shows the header", async ({ page }) => {
  const response = await page.goto("/")
  expect(response?.status()).toBe(200)
  await expect(page.locator("header").first()).toBeVisible()
})
