import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { checkBody, ensureDayCount, dayCountSentence } from "@/server/ai/pipeline/body-checks"

// AC-23 (T28 F4): the justification states the system day count and cites only policy rules.
// The inputs are bodyMarkdown texts taken from the recorded writer/escalated outputs, or variants of them.

const RULES = ["R-2", "R-2.4", "R-3", "R-4", "R-8"]
const RECORDED = `### Podsumowanie
- Kategoria: laptop; model: Lenovo ThinkPad E14.
- Data zakupu: 16.11.2026.

### Uzasadnienie
- Od zakupu upłynęło 10 dni. Rekomendujemy przyjęcie zwrotu. Zgodnie z zasadą R-2 zwrot jest możliwy w ciągu 14 dni.

### Następne kroki
- Prosimy bezpiecznie zapakować laptop (R-8).`
const WITHOUT_DAYS = RECORDED.replace("Od zakupu upłynęło 10 dni. ", "")

describe("checkBody", () => {
  it("accepts a body that states the system day count and cites policy rules only", () => {
    expect(checkBody(RECORDED, 10, RULES)).toEqual({ daysMissing: false, unknownRuleIds: [] })
  })

  it("flags a different day count (35 instead of 10); a policy deadline such as 14 dni does not count", () => {
    expect(checkBody(RECORDED.replace("10 dni", "35 dni"), 10, RULES).daysMissing).toBe(true)
  })

  it("looks inside the Uzasadnienie section only: a day count in Podsumowanie does not count (G4)", () => {
    const summaryOnly = WITHOUT_DAYS.replace("- Data zakupu: 16.11.2026.", "- Data zakupu: 16.11.2026; od zakupu upłynęło 10 dni.")
    expect(checkBody(summaryOnly, 10, RULES).daysMissing).toBe(true)
    expect(checkBody(RECORDED, 10, RULES).daysMissing).toBe(false)
  })

  it("flags a body without a justification section", () => {
    expect(checkBody("### Podsumowanie\n- od zakupu upłynęło 10 dni.", 10, RULES).daysMissing).toBe(true)
  })

  it("flags a body without any day count", () => {
    expect(checkBody(WITHOUT_DAYS.replace(" w ciągu 14 dni", ""), 10, RULES).daysMissing).toBe(true)
  })

  it.each([
    [1, "minął 1 dzień od zakupu"],
    [2, "minęły 2 dni od zakupu"],
    [22, "minęło 22 dni"],
    [5, "w 5 dniach od zakupu"],
    [0, "od zakupu minęło 0 dni"],
  ])("recognises %i days written as %s", (days, text) => {
    expect(checkBody(`### Uzasadnienie\n- ${text}\n\n### Następne kroki\n- x`, days, RULES).daysMissing).toBe(false)
  })

  it.each(["minęło 1 dni od zakupu", "w 1 dniach od zakupu"])("treats the wrong plural for 1 day (%s) as a violation (G4b-1)", (text) => {
    expect(checkBody(`### Uzasadnienie\n- ${text}`, 1, RULES).daysMissing).toBe(true)
  })

  it.each([[1, "minął 1 dzień"], [2, "minęły 2 dni"], [5, "minęło 5 dni"]])("accepts the correct form for %i (G4b-1)", (days, text) => {
    expect(checkBody(`### Uzasadnienie\n- Od zakupu ${text}.`, days, RULES).daysMissing).toBe(false)
  })

  it("does not match a number glued to other digits (110 dni is not 10 dni)", () => {
    expect(checkBody("### Uzasadnienie\n- minęło 110 dni", 10, RULES).daysMissing).toBe(true)
  })

  it("lists rule IDs that are not in the policy", () => {
    expect(checkBody(`${RECORDED} Zgodnie z R-99 oraz C-2.`, 10, RULES).unknownRuleIds).toEqual(["R-99", "C-2"])
  })

  it("accepts sub-rule IDs of the policy and ignores look-alikes such as USB-C-3", () => {
    expect(checkBody(`${RECORDED} Zasada R-2.4 i złącze USB-C-3.`, 10, RULES).unknownRuleIds).toEqual([])
  })
})

describe("dayCountSentence", () => {
  it.each([
    [0, "Od zakupu minęło 0 dni."],
    [1, "Od zakupu minął 1 dzień."],
    [2, "Od zakupu minęły 2 dni."],
    [10, "Od zakupu minęło 10 dni."],
    [45, "Od zakupu minęło 45 dni."],
  ])("%i days", (days, sentence) => {
    expect(dayCountSentence(days)).toBe(sentence)
  })
})

describe("ensureDayCount", () => {
  it("returns the body unchanged when the day count is present", () => {
    expect(ensureDayCount(RECORDED, 10)).toEqual({ bodyMarkdown: RECORDED, inserted: false })
  })

  it("inserts the sentence as the first paragraph of the justification section", () => {
    const { bodyMarkdown, inserted } = ensureDayCount(WITHOUT_DAYS.replace(" w ciągu 14 dni", ""), 10)
    expect(inserted).toBe(true)
    expect(bodyMarkdown).toContain("### Uzasadnienie\n\nOd zakupu minęło 10 dni.\n\n- Rekomendujemy")
    expect(checkBody(bodyMarkdown, 10, RULES).daysMissing).toBe(false)
  })

  it("keeps the other sections as they were", () => {
    const base = WITHOUT_DAYS.replace(" w ciągu 14 dni", "")
    const { bodyMarkdown } = ensureDayCount(base, 10)
    expect(bodyMarkdown.startsWith(base.slice(0, base.indexOf("### Uzasadnienie")))).toBe(true)
    expect(bodyMarkdown.endsWith(base.slice(base.indexOf("### Następne kroki")))).toBe(true)
  })

  it("inserts into the justification even when Podsumowanie already states the days (G4)", () => {
    const body = "### Podsumowanie\n- Od zakupu upłynęło 10 dni.\n\n### Uzasadnienie\n- Rekomendujemy zwrot.\n\n### Następne kroki\n- x"
    const { bodyMarkdown, inserted } = ensureDayCount(body, 10)
    expect(inserted).toBe(true)
    expect(bodyMarkdown).toContain("### Uzasadnienie\n\nOd zakupu minęło 10 dni.\n\n- Rekomendujemy")
  })

  it("normalizes a wrong-plural sentence for 1 day into the correct one (G4b-1)", () => {
    const body = "### Uzasadnienie\n- Od zakupu minęło 1 dni. Rekomendujemy zwrot (R-2).\n\n### Następne kroki\n- x"
    const { bodyMarkdown, normalized } = ensureDayCount(body, 1)
    expect(normalized).toBe(true)
    expect(bodyMarkdown).toBe("### Uzasadnienie\n- Od zakupu minął 1 dzień. Rekomendujemy zwrot (R-2).\n\n### Następne kroki\n- x")
    expect(checkBody(bodyMarkdown, 1, RULES).daysMissing).toBe(false)
  })

  it("replaces only the matched phrase and leaves 11 dni and 14 dni alone (G4b-1)", () => {
    const body = "### Uzasadnienie\n- Zwrot w ciągu 14 dni; minęło 1 dni; 11 dni nie dotyczy."
    expect(ensureDayCount(body, 1).bodyMarkdown).toBe("### Uzasadnienie\n- Zwrot w ciągu 14 dni; minął 1 dzień; 11 dni nie dotyczy.")
  })

  it("does not touch a wrong plural when the count is not 1", () => {
    const body = "### Uzasadnienie\n- Od zakupu minęło 2 dni."
    expect(ensureDayCount(body, 2)).toEqual({ bodyMarkdown: body, inserted: false })
  })

  it("appends a paragraph when there is no justification heading", () => {
    const { bodyMarkdown, inserted } = ensureDayCount("### Podsumowanie\n- Laptop.", 3)
    expect(inserted).toBe(true)
    expect(bodyMarkdown).toBe("### Podsumowanie\n- Laptop.\n\nOd zakupu minęły 3 dni.")
  })
})
