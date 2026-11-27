import { describe, expect, it } from "vitest"
import {
  CONDITION_LEVELS,
  DAMAGE_CAUSES,
  DAMAGE_LOCATIONS,
  DAMAGE_TYPES,
} from "@/lib/schemas/decision"
import { buildSignalQuestions } from "@/server/ai/signals/questions"

// ADR-001 3.3 and A2: choice questions carry a description per option, boolean
// questions carry explicit true/false criteria, score levels are described.
describe("buildSignalQuestions criteria shape", () => {
  const complaint = buildSignalQuestions("complaint", true)
  const ret = buildSignalQuestions("return", true)

  it("keeps the question set per case type", () => {
    expect(Object.keys(ret)).toEqual([
      "photo_usable", "device_visible", "category_match", "damage_visible",
      "damage_type", "damage_location", "condition",
      "signs_of_use", "packaging_visible", "description_consistent",
    ])
    expect(Object.keys(complaint)).toContain("damage_cause")
    expect(Object.keys(complaint)).not.toContain("signs_of_use")
    expect(Object.keys(buildSignalQuestions("return", false))).not.toContain("description_consistent")
  })

  const choices: [string, readonly string[], typeof complaint][] = [
    ["damage_type", DAMAGE_TYPES, complaint],
    ["damage_location", DAMAGE_LOCATIONS, complaint],
    ["damage_cause", DAMAGE_CAUSES, complaint],
  ]
  it.each(choices)("%s criteria is an option -> non-empty description map", (key, options, set) => {
    const q = set[key]
    expect(q?.type).toBe("choice")
    const criteria = (q as { criteria: Record<string, unknown> }).criteria
    expect(Object.keys(criteria)).toEqual([...options])
    for (const description of Object.values(criteria)) {
      expect(typeof description).toBe("string")
      expect((description as string).length).toBeGreaterThan(5)
    }
  })

  it("boolean questions have explicit true and false criteria", () => {
    for (const [key, q] of Object.entries(ret)) {
      if (q.type !== "boolean") continue
      const criteria = (q as { criteria?: { true: string; false: string } }).criteria
      expect(criteria, key).toBeDefined()
      expect(Object.keys(criteria!).sort(), key).toEqual(["false", "true"])
      expect(criteria!.true.length).toBeGreaterThan(5)
      expect(criteria!.false.length).toBeGreaterThan(5)
    }
  })

  it("condition is an ordered array of described levels", () => {
    const q = ret.condition as unknown as { type: string; criteria: string[] }
    expect(q.type).toBe("score")
    expect(q.criteria).toHaveLength(CONDITION_LEVELS.length)
    CONDITION_LEVELS.forEach((c, i) => {
      expect(q.criteria[i]).toContain(c.name)
      expect(q.criteria[i]!.length).toBeGreaterThan(c.name.length + 4)
    })
  })
})
