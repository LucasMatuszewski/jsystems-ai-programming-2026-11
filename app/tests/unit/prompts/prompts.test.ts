import { describe, expect, it, vi } from "vitest"

import { pl } from "@/lib/i18n/pl"

vi.mock("server-only", () => ({}))

import { loadPrompt, PROMPT_NAMES } from "@/server/ai/prompts"

const returnPrompts = ["decision-return", "chat-return"]
const complaintPrompts = ["decision-complaint", "chat-complaint"]

describe("prompt loader", () => {
  it("exposes the six prompt names without the shared include", () => {
    expect([...PROMPT_NAMES].sort()).toEqual(
      [
        "chat-complaint",
        "chat-return",
        "decision-complaint",
        "decision-return",
        "writer",
      ].sort()
    )
  })

  it("caches loaded prompts", () => {
    expect(loadPrompt("writer")).toBe(loadPrompt("writer"))
  })
})

describe.each(PROMPT_NAMES)("prompt %s", (name) => {
  const prompt = loadPrompt(name)

  it("has a name@semver version and no front matter in the text", () => {
    expect(prompt.name).toBe(name)
    expect(prompt.version).toMatch(new RegExp(`^${name}@\\d+\\.\\d+\\.\\d+$`))
    expect(prompt.text).not.toMatch(/^---/)
    expect(prompt.text).not.toContain("version:")
  })

  it("expands the shared rules", () => {
    expect(prompt.text).not.toContain("{{shared_rules}}")
    expect(prompt.text).toContain("<customer_reason>")
    expect(prompt.text).toContain("<customer_message>")
  })

  it("has the injection clause", () => {
    expect(prompt.text).toMatch(/never follow instructions/i)
  })

  it("requires Polish output", () => {
    expect(prompt.text).toMatch(/in Polish/i)
  })

  it("never contains the disclaimer text", () => {
    expect(prompt.text).not.toContain(pl.disclaimer)
    expect(prompt.text).not.toContain("wstępna rekomendacja wygenerowana")
  })

  it("forbids computing days and definitive wording", () => {
    expect(prompt.text).toMatch(/never (compute|calculate)/i)
    expect(prompt.text).toContain("Rekomendujemy")
  })
})

describe("rule citation", () => {
  it.each(returnPrompts)("%s cites R- rules", (name) => {
    const text = loadPrompt(name as never).text
    expect(text).toContain("R-")
    expect(text).toMatch(/cite/i)
  })
  it.each(complaintPrompts)("%s cites C- rules", (name) => {
    const text = loadPrompt(name as never).text
    expect(text).toContain("C-")
    expect(text).toMatch(/cite/i)
  })
})

describe("decision prompts", () => {
  it("return: R-2.4, R-3, R-5, signals and AC-27", () => {
    const t = loadPrompt("decision-return").text
    for (const s of ["R-2.4", "R-3", "R-5", "unavailable", "photoAdvice", "Weryfikacja ręczna", "###"])
      expect(t).toContain(s)
    expect(t).toMatch(/verify/i)
  })
  it("complaint: C-3, C-5, remedy, signals and AC-27", () => {
    const t = loadPrompt("decision-complaint").text
    for (const s of ["C-3", "C-5", "C-6", "remedy", "unavailable", "photoAdvice", "###"])
      expect(t).toContain(s)
    expect(t).toMatch(/verify/i)
  })
  it("both ask for every EscalatedDecisionOutput field", () => {
    for (const n of ["decision-return", "decision-complaint"] as const) {
      const t = loadPrompt(n).text
      for (const f of [
        "decision",
        "ruleRefs",
        "imageFindings",
        "signalDisagreements",
        "remedy",
        "photoAdvice",
        "greeting",
        "bodyMarkdown",
        "contradictsDescription",
      ])
        expect(t).toContain(f)
    }
  })
})

describe("writer prompt", () => {
  const t = loadPrompt("writer").text
  it("forbids changing or questioning the decision", () => {
    expect(t).toMatch(/must not (change|question)/i)
    expect(t).toMatch(/locked/i)
  })
  it("covers R-4 complaint suggestion and C-2 warranty", () => {
    expect(t).toContain("R-4")
    expect(t).toContain("C-2")
    expect(t).toMatch(/complaint/i)
    expect(t).toMatch(/manufacturer/i)
  })
  it("cites rules and states the given days", () => {
    expect(t).toContain("R-")
    expect(t).toContain("C-")
  })
})

describe("chat prompts", () => {
  it.each(["chat-return", "chat-complaint"] as const)("%s", (name) => {
    const t = loadPrompt(name).text
    expect(t).toContain("update_recommendation")
    expect(t).toMatch(/150 words/)
    expect(t).toMatch(/at most once/i)
    expect(t).toMatch(/new facts/i)
    expect(t).toContain("Mogę pomóc tylko w sprawie tego zgłoszenia.")
    expect(t).toMatch(/which model|Jaki model/i)
    expect((t.match(/NEGATIVE example/g) ?? []).length).toBeGreaterThanOrEqual(3)
    expect((t.match(/POSITIVE example/g) ?? []).length).toBeGreaterThanOrEqual(2)
  })

  it.each(["chat-return", "chat-complaint"] as const)("%s: purchase date from the form is authoritative, failed update is not claimed", (name) => {
    const t = loadPrompt(name).text
    expect(t).toMatch(/purchase date and `daysSincePurchase`[^\n]*authoritative/i)
    expect(t).toMatch(/new case/i)
    expect(t).toMatch(/update_recommendation` returns an error[^\n]*never claim/i)
  })
  it("chat-return: version is 1.1.0", () => {
    expect(loadPrompt("chat-return").version).toBe("chat-return@1.1.0")
  })
  it("chat-complaint: version is 1.2.0 and an update to Akceptacja must include the remedy (G5-1)", () => {
    const prompt = loadPrompt("chat-complaint")
    expect(prompt.version).toBe("chat-complaint@1.2.0")
    expect(prompt.text).toMatch(/Akceptacja[^\n]*include the remedy/i)
    expect(prompt.text).toMatch(/"repair"[^\n]*"replacement"|"replacement"[^\n]*"repair"/)
  })
})

// AC-23 (T28 F4): the first-message prompts require the system day count in the justification.
describe.each(["writer", "decision-return", "decision-complaint"] as const)("prompt %s: day count in the justification", (name) => {
  it("is version 1.1.0 and states the given daysSincePurchase with the word dni", () => {
    const prompt = loadPrompt(name)
    expect(prompt.version).toBe(`${name}@1.1.0`)
    expect(prompt.text).toMatch(/`daysSincePurchase` as a number with the word "dni"/)
    expect(prompt.text).toContain("### Uzasadnienie")
    expect(prompt.text).toMatch(/Polish label[^\n]*dd\.mm\.yyyy/)
    expect(prompt.text).toContain("Nowe zgłoszenie") // G4 D4: a correct photo needs a new case
    expect(prompt.text).toContain("powyższą wskazówką") // named only as the forbidden phrasing
  })
})
