import AxeBuilder from "@axe-core/playwright"
import { test } from "@playwright/test"
import { pl } from "../../lib/i18n/pl"
import { createCase, daysAgo, expect, photo } from "./helpers"

// AC-45 / AC-46 and TAC-003-04/05. Runs on the desktop (1440 px) and mobile (360 px) projects.

const seriousOrCritical = (impact: string | null | undefined) => impact === "serious" || impact === "critical"

async function expectNoHorizontalScroll(page: import("@playwright/test").Page): Promise<void> {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }))
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth)
}

// Only the inner region may scroll vertically: the document itself must fit the viewport (no second scrollbar).
async function expectNoPageVerticalScroll(page: import("@playwright/test").Page): Promise<void> {
  const { scrollHeight, innerHeight } = await page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    innerHeight: window.innerHeight,
  }))
  expect(scrollHeight).toBeLessThanOrEqual(innerHeight)
}

async function expectNoSeriousA11yIssues(page: import("@playwright/test").Page): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze()
  const blocking = results.violations.filter((v) => seriousOrCritical(v.impact))
  expect(blocking.map((v) => `${v.id} (${v.impact}): ${v.help}`)).toEqual([])
}

test("form page at the viewport width has no horizontal scroll (AC-45, TAC-003-04)", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("heading", { name: pl.form.title })).toBeVisible()
  await expectNoHorizontalScroll(page)
})

test("form page: only the inner region scrolls, the page has no vertical scrollbar", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("heading", { name: pl.form.title })).toBeVisible()
  await expectNoPageVerticalScroll(page)
  // Short desktop-like viewport: the form no longer fits, still only <main> may scroll.
  await page.setViewportSize({ width: 1440, height: 749 })
  await expectNoPageVerticalScroll(page)
})

test("form page has no serious or critical axe violations (AC-46, TAC-003-05)", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("heading", { name: pl.form.title })).toBeVisible()
  await expectNoSeriousA11yIssues(page)
})

// One real case serves the three chat-page checks (each submission takes 10-40 s and costs credits).
test("chat page: no horizontal scroll (AC-45), no serious axe violations (AC-46), mobile summary collapsed (PRD 9.3)", async ({ page }, testInfo) => {
  await createCase(page, {
    caseType: "return",
    category: "laptop",
    purchaseDate: daysAgo(10),
    photoPath: photo.laptop2Webp,
  })

  if (testInfo.project.name === "mobile") {
    await test.step("mobile: case summary is collapsed by default on /chat (PRD 9.3)", async () => {
      // Expanded summary shows the "Dni od zakupu" row; collapsed shows only the case type and decision badge.
      await expect(page.getByText(pl.summary.daysSincePurchase)).toBeHidden()
    })
  }
  await test.step("no horizontal scroll (AC-45, TAC-003-04)", () => expectNoHorizontalScroll(page))
  await test.step("only the inner region scrolls, no page vertical scroll", () => expectNoPageVerticalScroll(page))
  await test.step("no serious or critical axe violations (AC-46, TAC-003-05)", () => expectNoSeriousA11yIssues(page))
})
