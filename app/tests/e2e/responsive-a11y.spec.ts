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

async function expectNoSeriousA11yIssues(page: import("@playwright/test").Page): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze()
  const blocking = results.violations.filter((v) => seriousOrCritical(v.impact))
  expect(blocking.map((v) => `${v.id} (${v.impact}): ${v.help}`)).toEqual([])
}

test("form page at the viewport width has no horizontal scroll (AC-45, TAC-003-04)", async ({ page }) => {
  test.fail()
  await page.goto("/")
  await expect(page.getByRole("heading", { name: pl.form.title })).toBeVisible()
  await expectNoHorizontalScroll(page)
})

test("chat page at the viewport width has no horizontal scroll (AC-45, TAC-003-04)", async ({ page }) => {
  test.fail()
  await createCase(page, {
    caseType: "return",
    category: "laptop",
    purchaseDate: daysAgo(10),
    photoPath: photo.laptop2Webp,
  })
  await expectNoHorizontalScroll(page)
})

test("form page has no serious or critical axe violations (AC-46, TAC-003-05)", async ({ page }) => {
  test.fail()
  await page.goto("/")
  await expect(page.getByRole("heading", { name: pl.form.title })).toBeVisible()
  await expectNoSeriousA11yIssues(page)
})

test("chat page has no serious or critical axe violations (AC-46, TAC-003-05)", async ({ page }) => {
  test.fail()
  await createCase(page, {
    caseType: "return",
    category: "laptop",
    purchaseDate: daysAgo(10),
    photoPath: photo.laptop2Webp,
  })
  await expectNoSeriousA11yIssues(page)
})

test("mobile: case summary is collapsed by default on /chat (PRD 9.3)", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "collapsed summary applies to the 360 px project only")
  test.fail()
  await createCase(page, {
    caseType: "return",
    category: "laptop",
    purchaseDate: daysAgo(10),
    photoPath: photo.laptop2Webp,
  })
  // Expanded summary shows the "Dni od zakupu" row; collapsed shows only the case type and decision badge.
  await expect(page.getByText(pl.summary.daysSincePurchase)).toBeHidden()
})
